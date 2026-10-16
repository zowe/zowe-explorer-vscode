/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import { createHash } from "crypto";
import * as vscode from "vscode";
import type { IConfigLayer } from "@zowe/imperative";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigChangeHandlers } from "./ConfigChangeHandlers";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";
import { FavoritePersistenceUtils } from "./FavoritePersistenceUtils";
import { Profiles } from "../configuration/Profiles";
import { ZoweLogger } from "../tools/ZoweLogger";
import type { ChangeEntry, SaveChangesMessage } from "./ConfigTypes";

export class ConfigEditorSaveOperations {
    public static revision(contents: Uint8Array): string {
        return createHash("sha256").update(contents).digest("hex");
    }

    public static async readRevision(configPath: string): Promise<string> {
        return this.revision(await vscode.workspace.fs.readFile(vscode.Uri.file(configPath)));
    }

    /** One in-memory edit followed by recoverable layer commits. No writes during validation. */
    public async save(message: SaveChangesMessage, areSecureValuesAllowed: () => Promise<boolean>): Promise<void> {
        const operations = new ConfigEditorProfileOperations();
        const grouped = ConfigUtils.parseConfigChanges({
            changes: message.changes ?? [],
            deletions: message.deletions ?? [],
            defaultsChanges: message.defaultsChanges ?? [],
            defaultsDeleteKeys: message.defaultsDeleteKeys ?? [],
        });
        const paths = new Set([
            ...grouped.map((group) => group.configPath),
            ...(message.renames ?? []).map((rename) => rename.configPath),
            ...(message.otherChanges ?? []).map((change) => change.configPath),
        ]);
        const contentsByPath = new Map<string, Uint8Array>();
        for (const configPath of new Set([
            ...paths,
            ...(message.changes ?? []).flatMap((change) => (change.secureSource ? [change.secureSource.configPath] : [])),
        ])) {
            const contents = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
            await this.assertUnchanged(configPath, message.revisions?.[configPath], contents);
            contentsByPath.set(configPath, contents);
        }
        const profInfo = await ConfigUtils.createProfileInfoAndLoad();
        const config = profInfo.getTeamConfig();
        if (config.api.secure.loadFailed) {
            throw new Error("Secure storage could not be loaded. Your changes have not been saved.");
        }
        const originals = new Map<string, { layer: IConfigLayer; contents: Uint8Array }>();
        for (const configPath of paths) {
            ConfigChangeHandlers.activateLayerIfNeeded(config, configPath);
            const layer = config.api.layers.get();
            originals.set(configPath, { layer, contents: contentsByPath.get(configPath) });
        }

        // Capture credentials before renames/deletions can change their source location.
        const changes: ChangeEntry[] = [];
        for (const change of message.changes ?? []) {
            if (!change.secureSource) {
                changes.push({ ...change });
                continue;
            }
            const source = change.secureSource;
            ConfigChangeHandlers.activateLayerIfNeeded(config, source.configPath);
            await this.assertUnchanged(source.configPath, message.revisions?.[source.configPath]);
            const key = `${ConfigEditorPathUtils.constructNestedProfilePath(source.profileKey)}.properties.${source.propertyKey}`;
            const value = this.getValue(config.api.layers.get().properties, key);
            if (value === undefined) {
                throw new Error("A source credential is unavailable. The source profile has not been deleted.");
            }
            changes.push({ ...change, value: value as string, secure: true });
        }
        if (changes.some((change) => change.secure) && !(await areSecureValuesAllowed())) {
            throw new Error("Secure storage is unavailable. Your changes have not been saved.");
        }
        await operations.stageProfileRenames(message.renames ?? [], profInfo);
        const updated = await operations.updateProfileChangesForRenames({ ...message, changes }, message.renames ?? []);
        const staged = ConfigUtils.parseConfigChanges({
            changes: updated.changes ?? [],
            deletions: updated.deletions ?? [],
            defaultsChanges: updated.defaultsChanges ?? [],
            defaultsDeleteKeys: updated.defaultsDeleteKeys ?? [],
        });
        for (const group of staged) {
            await ConfigChangeHandlers.handleDefaultChanges(group.defaultsChanges, group.defaultsDeleteKeys, group.configPath, config);
            await ConfigChangeHandlers.handleProfileChanges(group.changes, group.deletions, group.configPath, areSecureValuesAllowed, config);
        }
        await ConfigChangeHandlers.handleAutostoreToggle(message.otherChanges ?? [], config);

        // Recheck after asynchronous staging, before the first write.
        for (const [configPath, original] of originals) {
            await this.assertUnchanged(configPath, ConfigEditorSaveOperations.revision(original.contents));
        }
        const attempted: string[] = [];
        try {
            for (const configPath of paths) {
                ConfigChangeHandlers.activateLayerIfNeeded(config, configPath);
                attempted.push(configPath); // save may update the vault before a file write fails
                await config.save();
            }
        } catch {
            const failedRestores: string[] = [];
            for (const configPath of attempted.reverse()) {
                const original = originals.get(configPath);
                try {
                    ConfigChangeHandlers.activateLayerIfNeeded(config, configPath);
                    config.api.layers.set(original.layer.properties);
                    await config.save();
                    await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), original.contents);
                } catch {
                    failedRestores.push(configPath);
                }
            }
            if (failedRestores.length > 0) {
                throw new Error(`Save failed and could not restore these files: ${failedRestores.join(", ")}. Check these files before retrying.`);
            }
            throw new Error("Save failed. The original configuration was restored.");
        }

        // Explorer refresh failures cannot turn a committed save into a retry of destructive operations.
        if (message.renames?.length) {
            try {
                await Profiles.getInstance().refresh();
                for (const rename of operations.prepareRenamesForProcessing(message.renames)) {
                    await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);
                    FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename(rename);
                }
            } catch {
                ZoweLogger.warn("Configuration saved, but Explorer profile references could not be refreshed.");
            }
        }
    }

    private async assertUnchanged(configPath: string, revision: string | undefined, contents?: Uint8Array): Promise<void> {
        const dirty = vscode.workspace.textDocuments.some((doc) => doc.uri.fsPath === configPath && doc.isDirty);
        if (
            dirty ||
            !revision ||
            revision !== (contents ? ConfigEditorSaveOperations.revision(contents) : await ConfigEditorSaveOperations.readRevision(configPath))
        ) {
            throw new Error(
                `Configuration changed outside this editor: ${configPath}. Save any text edits, then refresh the configuration editor before retrying.`
            );
        }
    }

    private getValue(root: unknown, key: string): unknown {
        return key
            .split(".")
            .reduce<unknown>((value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), root);
    }
}
