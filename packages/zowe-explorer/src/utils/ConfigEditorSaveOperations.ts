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
import { Gui } from "@zowe/zowe-explorer-api";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigChangeHandlers } from "./ConfigChangeHandlers";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";
import { FavoritePersistenceUtils } from "./FavoritePersistenceUtils";
import { Profiles } from "../configuration/Profiles";
import { ZoweLogger } from "../tools/ZoweLogger";
import type { ChangeEntry, SaveChangesMessage } from "./ConfigTypes";

class ConfigEditorSaveCancelled extends Error {}

export class ConfigEditorSaveOperations {
    public static revision(contents: Uint8Array): string {
        return createHash("sha256").update(contents).digest("hex");
    }

    public static async readRevision(configPath: string): Promise<string> {
        return this.revision(await vscode.workspace.fs.readFile(vscode.Uri.file(configPath)));
    }

    /** One in-memory edit followed by recoverable layer commits. No writes during validation. */
    public async save(message: SaveChangesMessage, areSecureValuesAllowed: () => Promise<boolean>): Promise<boolean> {
        try {
            await this.saveChanges(message, areSecureValuesAllowed);
            return true;
        } catch (error) {
            if (!(error instanceof ConfigEditorSaveCancelled)) {
                throw error;
            }
            return false;
        }
    }

    private async saveChanges(message: SaveChangesMessage, areSecureValuesAllowed: () => Promise<boolean>): Promise<void> {
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
            const contents = await this.confirmOverwriteIfChanged(configPath, message.revisions?.[configPath]);
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
            await this.assertUnchanged(source.configPath, ConfigEditorSaveOperations.revision(contentsByPath.get(source.configPath)));
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
        operations.stageProfileRenames(message.renames ?? [], profInfo);
        const updated = operations.updateProfileChangesForRenames({ ...message, changes }, message.renames ?? []);
        await ConfigChangeHandlers.stageChanges(updated, config, areSecureValuesAllowed);
        await ConfigChangeHandlers.handleAutostoreToggle(message.otherChanges ?? [], config);

        const attempted: string[] = [];
        const committedRevisions = new Map<string, string>();
        try {
            for (const configPath of paths) {
                const original = originals.get(configPath);
                const contents = await this.confirmOverwriteIfChanged(configPath, ConfigEditorSaveOperations.revision(original.contents));
                if (ConfigEditorSaveOperations.revision(contents) !== ConfigEditorSaveOperations.revision(original.contents)) {
                    // An explicitly approved overwrite must still roll back to the latest external version.
                    const latestConfig = (await ConfigUtils.createProfileInfoAndLoad()).getTeamConfig();
                    ConfigChangeHandlers.activateLayerIfNeeded(latestConfig, configPath);
                    original.layer = latestConfig.api.layers.get();
                    original.contents = contents;
                    await this.assertUnchanged(configPath, ConfigEditorSaveOperations.revision(contents));
                }
                ConfigChangeHandlers.activateLayerIfNeeded(config, configPath);
                attempted.push(configPath); // save may update the vault before a file write fails
                await config.save();
                committedRevisions.set(configPath, await ConfigEditorSaveOperations.readRevision(configPath));
            }
        } catch (error) {
            const failedRestores: string[] = [];
            for (const configPath of attempted.reverse()) {
                const original = originals.get(configPath);
                try {
                    // Do not undo a later edit made by another writer while this save was running.
                    const committedRevision = committedRevisions.get(configPath);
                    if (committedRevision) {
                        await this.assertUnchanged(configPath, committedRevision);
                    }
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
            if (error instanceof ConfigEditorSaveCancelled) {
                throw error;
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

    private async confirmOverwriteIfChanged(configPath: string, revision: string | undefined): Promise<Uint8Array> {
        const contents = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
        this.assertNoDirtyTextDocument(configPath);
        const currentRevision = ConfigEditorSaveOperations.revision(contents);
        if (currentRevision !== revision) {
            const saveAnyway = vscode.l10n.t("Save Anyway");
            const response = await Gui.warningMessage(
                vscode.l10n.t(
                    "This configuration file changed outside the configuration editor. Saving may overwrite external changes.\n{0}",
                    configPath
                ),
                { items: [saveAnyway], vsCodeOpts: { modal: true } }
            );
            if (response !== saveAnyway) {
                throw new ConfigEditorSaveCancelled();
            }
            // Approval applies only to the version shown in the confirmation.
            await this.assertUnchanged(configPath, currentRevision);
        }
        return contents;
    }

    private assertNoDirtyTextDocument(configPath: string): void {
        if (vscode.workspace.textDocuments.some((doc) => doc.uri.fsPath === configPath && doc.isDirty)) {
            throw new Error(vscode.l10n.t("Configuration changed outside this editor: {0}. Save any text edits before retrying.", configPath));
        }
    }

    private async assertUnchanged(configPath: string, revision: string | undefined): Promise<void> {
        this.assertNoDirtyTextDocument(configPath);
        if (!revision || revision !== (await ConfigEditorSaveOperations.readRevision(configPath))) {
            throw new Error(
                `Configuration changed outside this editor: ${configPath}. ` +
                    "Save any text edits, then refresh the configuration editor before retrying."
            );
        }
    }

    private getValue(root: unknown, key: string): unknown {
        return key
            .split(".")
            .reduce<unknown>((value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), root);
    }
}
