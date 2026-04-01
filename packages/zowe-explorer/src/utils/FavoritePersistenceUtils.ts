/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { IZoweTreeNode, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Definitions } from "../configuration/Definitions";
import { Profiles } from "../configuration/Profiles";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";

const FAVORITES_SCHEMAS = [PersistenceSchemaEnum.Dataset, PersistenceSchemaEnum.USS, PersistenceSchemaEnum.Job] as const;

export type ProfileRenameForFavorites = { originalKey: string; newKey: string; configPath: string };

export class FavoritePersistenceUtils {
    /**
     * Rewrites one persisted favorite line when its bracketed profile key matches a completed profile rename.
     * Format: {@code [profileName]: label{context}}
     */
    public static rewriteFavoriteLine(line: string, rename: ProfileRenameForFavorites): string {
        const closingSquareBracket = line.indexOf("]");
        if (!line.startsWith("[") || closingSquareBracket === -1) {
            return line;
        }
        const profileName = line.substring(1, closingSquareBracket);
        const renameMap = new Map([[rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath }]]);
        const newProfileName = ConfigEditorPathUtils.getNewProfilePath(profileName, rename.configPath, renameMap);
        if (newProfileName === profileName) {
            return line;
        }
        return `[${newProfileName}]${line.substring(closingSquareBracket + 1)}`;
    }

    /**
     * Rewrites favorites and session history for all trees in one read/modify/write per schema (fewer awaited storage round-trips than separate calls).
     */
    public static async applyProfileRenameToStoredTreePersistence(rename: ProfileRenameForFavorites): Promise<void> {
        const renameMap = new Map([[rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath }]]);
        await Promise.all(
            FAVORITES_SCHEMAS.map(async (schema) => {
                const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(schema);
                if (!settings?.persistence) {
                    return;
                }
                const lines = settings.favorites ?? [];
                const sessions = settings.sessions ?? [];
                const updatedFavorites = lines.map((line) => FavoritePersistenceUtils.rewriteFavoriteLine(line, rename));
                const updatedSessions = sessions.map((s) => ConfigEditorPathUtils.getNewProfilePath(s, rename.configPath, renameMap));
                const favoritesChanged = updatedFavorites.some((u, i) => u !== lines[i]);
                const sessionsChanged = updatedSessions.some((u, i) => u !== sessions[i]);
                if (!favoritesChanged && !sessionsChanged) {
                    return;
                }
                settings.favorites = updatedFavorites;
                settings.sessions = updatedSessions;
                await ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(
                    schema,
                    settings,
                    ZoweLocalStorage.isPersistenceKeyInWorkspace(schema)
                );
            })
        );
    }

    /**
     * Updates Explorer tree views (DS/USS/Jobs) after a rename without blocking the config editor save path.
     * Call after {@link applyProfileRenameToStoredTreePersistence}; storage must be written before this runs.
     */
    public static fireAndForgetExplorerTreeRebuildAfterRename(rename: ProfileRenameForFavorites): void {
        void Promise.all([
            FavoritePersistenceUtils.rebuildFavoritesTreesFromPersistence(),
            FavoritePersistenceUtils.rebuildSessionNodesAfterProfileRename(rename),
        ]).catch((err) => ZoweLogger.warn(`Explorer tree rebuild after profile rename: ${String(err)}`));
    }

    /**
     * Rebuilds in-memory favorites from persistence so tree labels match renamed profiles.
     */
    public static async rebuildFavoritesTreesFromPersistence(): Promise<void> {
        const trees = [SharedTreeProviders.ds, SharedTreeProviders.uss, SharedTreeProviders.job].filter(Boolean);
        for (const tree of trees) {
            tree.mFavorites = [];
            if (tree.refreshFavorites) {
                await tree.refreshFavorites();
            }
            tree.refreshElement(tree.mFavoriteSession);
        }
    }

    /**
     * Drops session nodes whose profile name changed, then re-adds them so labels, profiles, and URIs match the new name.
     */
    public static async rebuildSessionNodesAfterProfileRename(rename: ProfileRenameForFavorites): Promise<void> {
        const renameMap = new Map([[rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath }]]);
        const trees = [SharedTreeProviders.ds, SharedTreeProviders.uss, SharedTreeProviders.job].filter(Boolean);
        const profiles = Profiles.getInstance();
        for (const tree of trees) {
            tree.reloadSessionsFromPersistence();
            const sessionNodes = tree.mSessionNodes.filter((n: IZoweTreeNode) => n !== tree.mFavoriteSession);
            const newNamesToAdd: string[] = [];
            const nodesToRemove: IZoweTreeNode[] = [];
            for (const node of sessionNodes) {
                const name = node.getProfileName?.() ?? String(node.label).trim();
                const newName = ConfigEditorPathUtils.getNewProfilePath(name, rename.configPath, renameMap);
                if (newName !== name) {
                    nodesToRemove.push(node);
                    newNamesToAdd.push(newName);
                }
            }
            if (nodesToRemove.length === 0) {
                continue;
            }
            for (const node of nodesToRemove) {
                tree.mSessionNodes = tree.mSessionNodes.filter((n) => n !== node);
            }
            for (const newName of newNamesToAdd) {
                try {
                    const loaded = profiles.loadNamedProfile(newName.trim());
                    await tree.addSingleSession(loaded);
                } catch (e) {
                    ZoweLogger.warn(`Could not reload session tree node for renamed profile "${newName}": ${String(e)}`);
                }
            }
            tree.refresh();
        }
    }
}
