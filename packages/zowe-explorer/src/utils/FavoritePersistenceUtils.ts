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
     * Updates Dataset, USS, and Jobs favorites in local storage after a profile rename is saved.
     */
    public static async applyProfileRenameToStoredFavorites(rename: ProfileRenameForFavorites): Promise<void> {
        for (const schema of FAVORITES_SCHEMAS) {
            const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(schema);
            if (!settings?.persistence) {
                continue;
            }
            const lines = settings.favorites ?? [];
            const updated = lines.map((line) => FavoritePersistenceUtils.rewriteFavoriteLine(line, rename));
            if (updated.some((u, i) => u !== lines[i])) {
                settings.favorites = updated;
                await ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(schema, settings);
            }
        }
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
     * Updates Dataset, USS, and Jobs persisted session lists after a profile rename is saved (tree open-session history).
     */
    public static async applyProfileRenameToStoredSessions(rename: ProfileRenameForFavorites): Promise<void> {
        const renameMap = new Map([
            [rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath }],
        ]);
        for (const schema of FAVORITES_SCHEMAS) {
            const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(schema);
            if (!settings?.persistence) {
                continue;
            }
            const sessions = settings.sessions ?? [];
            const updated = sessions.map((s) => ConfigEditorPathUtils.getNewProfilePath(s, rename.configPath, renameMap));
            if (updated.some((u, i) => u !== sessions[i])) {
                settings.sessions = updated;
                await ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(schema, settings);
            }
        }
    }

    /**
     * Drops session nodes whose profile name changed, then re-adds them so labels, profiles, and URIs match the new name.
     */
    public static async rebuildSessionNodesAfterProfileRename(rename: ProfileRenameForFavorites): Promise<void> {
        const renameMap = new Map([
            [rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath }],
        ]);
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
