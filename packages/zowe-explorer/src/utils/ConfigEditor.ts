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

import { DeferredPromise, WebView, ZoweVsCodeExtension, FileManagement } from "@zowe/zowe-explorer-api";
import { LocalStorageAccess } from "../tools/ZoweLocalStorage";
import * as vscode from "vscode";
import { ProfileInfo, Config, ConfigBuilder, ConfigSchema } from "@zowe/imperative";
import * as path from "path";
import * as fs from "fs";
import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
import { ConfigSchemaHelpers, schemaValidation } from "./ConfigSchemaHelpers";
import { ConfigChangeHandlers, ChangeEntry } from "./ConfigChangeHandlers";
import { ConfigUtils, LayerModifications } from "./ConfigUtils";
import {
    ConfigMoveAPI,
    moveProfile,
    updateDefaultsAfterRename,
    simulateDefaultsUpdateAfterRename,
} from "../webviews/src/config-editor/utils/MoveUtils";

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public initialSelection?: {
        profileName: string;
        configPath: string;
        profileType: string;
    };

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
            viewColumn: vscode.ViewColumn.One,
        });

        this.panel.reveal(vscode.ViewColumn.One, false);

        vscode.commands.executeCommand("workbench.action.keepEditor");

        this.panel.onDidDispose(() => {});

        // Ensure the webview is properly initialized by sending initial data
        this.initializeWebview();
    }

    private async initializeWebview(): Promise<void> {
        // Send initial data to ensure the webview is properly initialized
        const configurations = await this.getLocalConfigs();
        const secureValuesAllowed = await this.areSecureValuesAllowed();

        await this.panel.webview.postMessage({
            command: "CONFIGURATIONS",
            contents: configurations,
            secureValuesAllowed,
        });
    }

    private async areSecureValuesAllowed(): Promise<boolean> {
        const profilesCache = (ZoweVsCodeExtension as any).profilesCache;
        if (!profilesCache) {
            return false;
        }
        try {
            return (((await profilesCache.getProfileInfo()) as any).mCredentials.isCredentialManagerInAppSettings() ?? false) as boolean;
        } catch (_err) {
            return false;
        }
    }

    protected async getLocalConfigs(): Promise<any[]> {
        const profInfo = new ProfileInfo("zowe");
        try {
            await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Error reading profiles from disk: ${errorMessage}`);

            // Try to extract file path from error message and open it
            const fileMatch = errorMessage.match(/file '([^']+)'/);
            if (fileMatch && fileMatch[1]) {
                const filePath = fileMatch[1];
                try {
                    // Extract line and column information if available
                    const lineMatch = errorMessage.match(/Line (\d+)/);
                    const columnMatch = errorMessage.match(/Column (\d+)/);

                    const line = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
                    const column = columnMatch ? parseInt(columnMatch[1]) - 1 : 0;

                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                    const editor = await vscode.window.showTextDocument(document);

                    const position = new vscode.Position(line, column);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                } catch (openError) {
                    // Ignore file open errors
                }
            }

            return [];
        }
        const layers = profInfo.getTeamConfig().layers;

        const allConfigs: {
            configPath: string;
            properties: any;
            schema?: any;
            schemaValidation?: schemaValidation;
            schemaPath?: string;
            global: boolean;
            user: boolean;
        }[] = [];

        for (const layer of layers) {
            if (layer.exists) {
                const configPath = path.resolve(layer.path);
                try {
                    if (layer.properties && layer.properties.$schema) {
                        const schemaPath = path.join(path.dirname(configPath), layer.properties.$schema);
                        const schemaContent = fs.readFileSync(schemaPath, { encoding: "utf8" });
                        const schema = JSON.parse(schemaContent);
                        const schemaValidation = this.generateSchemaValidation(schema);

                        this.processProfilesRecursively(layer.properties.profiles);

                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema,
                            schemaValidation,
                            schemaPath,
                            global: layer.global,
                            user: layer.user,
                        });
                    } else {
                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema: undefined,
                            global: layer.global,
                            user: layer.user,
                        });
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`Error reading or parsing file ${configPath}: ${errorMessage}`);

                    try {
                        const lineMatch = errorMessage.match(/Line (\d+)/);
                        const columnMatch = errorMessage.match(/Column (\d+)/);

                        const line = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
                        const column = columnMatch ? parseInt(columnMatch[1]) - 1 : 0;

                        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
                        const editor = await vscode.window.showTextDocument(document);

                        const position = new vscode.Position(line, column);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    } catch (openError) {
                        // Ignore file open errors
                    }
                }
            }
        }

        return allConfigs;
    }

    private processProfilesRecursively(profiles: any): void {
        ConfigUtils.processProfilesRecursively(profiles);
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        switch (message.command.toLocaleUpperCase()) {
            case "GET_PROFILES": {
                const profInfo = new ProfileInfo("zowe");
                try {
                    await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
                } catch (err) {
                    // Let getLocalConfigs handle any errors
                }

                const configurations = await this.getLocalConfigs();
                const secureValuesAllowed = await this.areSecureValuesAllowed();
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: configurations,
                    secureValuesAllowed,
                });

                break;
            }
            case "SAVE_CHANGES": {
                // Process renames first
                if (message.renames && Array.isArray(message.renames)) {
                    await this.handleProfileRenames(message.renames);
                }

                // Update profile changes to use new names after renames are processed
                let updatedMessage = message;
                if (message.renames && Array.isArray(message.renames)) {
                    updatedMessage = await this.updateProfileChangesForRenames(message, message.renames);
                }

                // Process changes with updated profile names
                const parsedChanges = this.parseConfigChanges(updatedMessage);
                for (const change of parsedChanges) {
                    if (change.defaultsChanges || change.defaultsDeleteKeys) {
                        await this.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath);
                    }

                    if (change.changes || change.deletions) {
                        await this.handleProfileChanges(change.changes, change.deletions, change.configPath);
                    }
                }

                if (message.otherChanges) {
                    await this.handleOtherChanges(message.otherChanges);
                }

                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

                const configs = await this.getLocalConfigs();
                const secureValuesAllowed = await this.areSecureValuesAllowed();

                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: configs,
                    secureValuesAllowed,
                });

                await this.panel.webview.postMessage({
                    command: "DISABLE_OVERLAY",
                });
                break;
            }
            case "OPEN_CONFIG_FILE": {
                try {
                    vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
                } catch {
                    vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}:`);
                }
                break;
            }
            case "REVEAL_IN_FINDER": {
                try {
                    const fileUri = vscode.Uri.file(message.filePath);
                    await vscode.commands.executeCommand("revealFileInOS", fileUri);
                } catch (error) {
                    vscode.window.showErrorMessage(`Error revealing file in explorer: ${message.filePath}`);
                }
                break;
            }
            case "OPEN_SCHEMA_FILE": {
                try {
                    vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
                } catch {
                    vscode.window.showErrorMessage(`Error opening schema file: ${message.filePath as string}:`);
                }
                break;
            }
            case "GET_ENV_INFORMATION": {
                const hasWorkspace = ZoweVsCodeExtension.workspaceRoot != null;
                await this.panel.webview.postMessage({
                    command: "ENV_INFORMATION",
                    hasWorkspace: hasWorkspace,
                });
                break;
            }
            case "INITIAL_SELECTION": {
                this.initialSelection = {
                    profileName: message.profileName,
                    configPath: message.configPath,
                    profileType: message.profileType,
                };
                break;
            }
            case "CONFIGURATIONS_READY": {
                if (this.initialSelection) {
                    await this.panel.webview.postMessage({
                        command: "INITIAL_SELECTION",
                        profileName: this.initialSelection.profileName,
                        configPath: this.initialSelection.configPath,
                        profileType: this.initialSelection.profileType,
                    });
                    this.initialSelection = undefined;
                }
                break;
            }
            case "OPEN_CONFIG_FILE_WITH_PROFILE": {
                try {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
                    const editor = await vscode.window.showTextDocument(document);

                    const profileKey = message.profileKey;
                    const text = document.getText();
                    const lines = text.split("\n");

                    const profileParts = profileKey.split(".");
                    let currentLine = -1;
                    let currentColumn = 0;
                    let foundProfile = false;
                    let globalBraceCount = 0;
                    let inProfilesSection = false;
                    let profileDepth = 0;
                    let inTargetProfile = false;
                    let targetProfileBraceCount = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const trimmedLine = line.trim();
                        for (const char of line) {
                            if (char === "{") {
                                globalBraceCount++;
                            }
                            if (char === "}") {
                                globalBraceCount--;
                            }
                        }
                        if (trimmedLine.includes('"profiles"')) {
                            if (!inTargetProfile) {
                                inProfilesSection = true;
                                profileDepth = 0;
                                inTargetProfile = false;
                                targetProfileBraceCount = 0;
                            } else {
                                profileDepth++;
                                inTargetProfile = false;
                                targetProfileBraceCount = 0;
                            }
                            continue;
                        }
                        if (inProfilesSection) {
                            if (inTargetProfile) {
                                for (const char of line) {
                                    if (char === "{") {
                                        targetProfileBraceCount++;
                                    }
                                    if (char === "}") {
                                        targetProfileBraceCount--;
                                    }
                                }

                                const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                                if (profileMatch) {
                                    const foundProfileName = profileMatch[1];

                                    if (profileParts[profileDepth] === foundProfileName) {
                                        if (profileDepth === profileParts.length - 1) {
                                            // This is the final profile we're looking for
                                            foundProfile = true;
                                            currentLine = i;
                                            // Find the column position at the end of the profile name
                                            const profileNameIndex = line.indexOf(`"${foundProfileName}"`);
                                            currentColumn = profileNameIndex >= 0 ? profileNameIndex + foundProfileName.length + 2 : 0;
                                            break;
                                        }
                                    }
                                }
                                if (targetProfileBraceCount === 0) {
                                    inTargetProfile = false;
                                    profileDepth = 0;
                                }
                            } else {
                                const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                                if (profileMatch) {
                                    const foundProfileName = profileMatch[1];

                                    if (profileParts[profileDepth] === foundProfileName) {
                                        if (profileDepth === profileParts.length - 1) {
                                            foundProfile = true;
                                            currentLine = i;
                                            const profileNameIndex = line.indexOf(`"${foundProfileName}"`);
                                            currentColumn = profileNameIndex >= 0 ? profileNameIndex + foundProfileName.length + 2 : 0;
                                            break;
                                        } else {
                                            inTargetProfile = true;
                                            targetProfileBraceCount = 1;
                                            continue;
                                        }
                                    }
                                }
                            }
                            if (globalBraceCount === 0) {
                                inProfilesSection = false;
                                profileDepth = 0;
                                inTargetProfile = false;
                                targetProfileBraceCount = 0;
                            }
                        }
                    }
                    if (foundProfile && currentLine !== -1) {
                        const position = new vscode.Position(currentLine, currentColumn);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    } else {
                        vscode.window.showInformationMessage(`Profile "${profileKey as string}" not found in the config file.`);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}`);
                }
                break;
            }

            case "GET_MERGED_PROPERTIES": {
                const mergedArgs = await this.getPendingMergedArgsForProfile(
                    message.profilePath,
                    message.configPath,
                    message.changes,
                    message.renames
                );
                await this.panel.webview.postMessage({
                    command: "MERGED_PROPERTIES",
                    mergedArgs,
                });
                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
                break;
            }
            case "GET_WIZARD_MERGED_PROPERTIES": {
                const mergedArgs = await this.getWizardMergedProperties(
                    message.rootProfile,
                    message.profileType,
                    message.configPath,
                    message.profileName,
                    message.changes,
                    message.renames
                );
                await this.panel.webview.postMessage({
                    command: "WIZARD_MERGED_PROPERTIES",
                    mergedArgs,
                });
                break;
            }

            case "SELECT_FILE": {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: "Select File",
                    filters: {
                        "All Files": ["*"],
                    },
                };

                const fileUri = await vscode.window.showOpenDialog(options);
                if (fileUri && fileUri.length > 0) {
                    const filePath = fileUri[0].fsPath;
                    await this.panel.webview.postMessage({
                        command: "FILE_SELECTED",
                        filePath: filePath,
                        propertyIndex: message.propertyIndex,
                        isNewProperty: message.isNewProperty,
                        source: message.source,
                    });
                }
                break;
            }
            case "CREATE_NEW_CONFIG": {
                try {
                    const configType = message.configType;
                    let global = false;
                    let user = false;
                    let rootPath = "";

                    // Parse config type
                    if (configType === "global-team") {
                        global = true;
                        user = false;
                        rootPath = FileManagement.getZoweDir();
                    } else if (configType === "global-user") {
                        global = true;
                        user = true;
                        rootPath = FileManagement.getZoweDir();
                    } else if (configType === "project-team") {
                        global = false;
                        user = false;
                        rootPath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath || "";
                    } else if (configType === "project-user") {
                        global = false;
                        user = true;
                        rootPath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath || "";
                    }

                    if (!rootPath) {
                        vscode.window.showErrorMessage("Cannot create project configuration: No workspace is open.");
                        break;
                    }

                    if (global && !fs.existsSync(rootPath)) {
                        try {
                            fs.mkdirSync(rootPath, { recursive: true });
                        } catch (dirError) {
                            vscode.window.showErrorMessage(
                                `Cannot create directory ${rootPath}: ${dirError instanceof Error ? dirError.message : String(dirError)}`
                            );
                            break;
                        }
                    }

                    const existingFile = await this.checkExistingConfig(rootPath, user);
                    if (existingFile === false) {
                        return;
                    }
                    if (existingFile != null) {
                        user = existingFile.includes("user");
                    }

                    const config = await Config.load("zowe", {
                        homeDir: FileManagement.getZoweDir(),
                        projectDir: FileManagement.getFullPath(rootPath),
                    });

                    if (global) {
                        config.api.layers.activate(user, global);
                    } else if (ZoweVsCodeExtension.workspaceRoot != null) {
                        config.api.layers.activate(user, global, rootPath);
                    }

                    const knownCliConfig: any[] = (ZoweVsCodeExtension as any).profilesCache.getCoreProfileTypes();
                    knownCliConfig.push(...(ZoweVsCodeExtension as any).profilesCache.getConfigArray());
                    knownCliConfig.push(ProfileConstants.BaseProfile);
                    config.setSchema(ConfigSchema.buildSchema(knownCliConfig));

                    const opts: any = {
                        populateProperties: true,
                    };

                    const impConfig: any = {
                        profiles: [...knownCliConfig],
                        baseProfile: ProfileConstants.BaseProfile,
                    };

                    const newConfig: any = await ConfigBuilder.build(impConfig, global, opts);

                    config.api.layers.merge(newConfig);
                    await config.save(false);

                    let configName;
                    if (user) {
                        configName = config.userConfigName;
                    } else {
                        configName = config.configName;
                    }

                    const configFilePath = path.join(rootPath, configName);

                    // Ensure the file is fully written to disk
                    await new Promise((resolve) => setTimeout(resolve, 100));

                    if (fs.existsSync(configFilePath)) {
                        await ZoweVsCodeExtension.openConfigFile(configFilePath);
                        vscode.window.showInformationMessage(`Configuration file created and opened: ${configFilePath}`);
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to create configuration file at: ${configFilePath}. Please check permissions and try again.`
                        );
                    }

                    const configs = await this.getLocalConfigs();
                    await this.panel.webview.postMessage({
                        command: "CONFIGURATIONS",
                        contents: configs,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Error creating new configuration: ${errorMessage}`);
                }
                break;
            }
            case "GET_LOCAL_STORAGE_VALUE": {
                try {
                    const { key } = message;
                    const value = LocalStorageAccess.getValue(key);
                    await this.panel.webview.postMessage({
                        command: "LOCAL_STORAGE_VALUE",
                        key,
                        value,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    await this.panel.webview.postMessage({
                        command: "LOCAL_STORAGE_ERROR",
                        key: message.key,
                        error: errorMessage,
                    });
                }
                break;
            }
            case "OPEN_VSCODE_SETTINGS": {
                try {
                    const searchText = message.searchText || "";
                    await vscode.commands.executeCommand("workbench.action.openSettings", searchText);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Error opening VS Code settings: ${errorMessage}`);
                }
                break;
            }
            case "SET_LOCAL_STORAGE_VALUE": {
                try {
                    const { key, value } = message;
                    await LocalStorageAccess.setValue(key, value);
                    await this.panel.webview.postMessage({
                        command: "LOCAL_STORAGE_SET_SUCCESS",
                        key,
                        value,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    await this.panel.webview.postMessage({
                        command: "LOCAL_STORAGE_ERROR",
                        key: message.key,
                        error: errorMessage,
                    });
                }
                break;
            }

            default:
                break;
        }
    }

    private async handleDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string): Promise<void> {
        await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer);
    }

    private async handleProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string): Promise<void> {
        await ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, () => this.areSecureValuesAllowed());
    }

    private async handleOtherChanges(otherChanges: any[]): Promise<void> {
        for (const change of otherChanges) {
            if (change.type === "autostore") {
                await this.handleAutostoreChange(change.configPath, change.value);
            }
        }
    }

    private async handleProfileRenames(renames: Array<{ originalKey: string; newKey: string; configPath: string }>): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        for (const rename of renames) {
            try {
                // Get the team config
                const teamConfig = profInfo.getTeamConfig();

                const targetLayer = teamConfig.layers.find((layer: any) => layer.path === rename.configPath);

                if (!targetLayer) {
                    throw new Error(`Configuration layer not found for path: ${rename.configPath}`);
                }

                teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

                const configMoveAPI: ConfigMoveAPI = {
                    get: (path: string) => {
                        const currentLayer = teamConfig.api.layers.get();
                        const profiles = currentLayer.properties.profiles;

                        const profileKey = path.replace("profiles.", "");

                        const findNestedProfile = (key: string, profilesObj: any): any => {
                            const parts = key.split(".");
                            let current: any = profilesObj;

                            for (let i = 0; i < parts.length; i++) {
                                const part = parts[i];

                                if (part === "profiles") {
                                    continue;
                                }

                                if (!current || !current[part]) {
                                    return null;
                                }
                                current = current[part];

                                if (i === parts.length - 1) {
                                    return current;
                                }

                                if (current && typeof current === "object" && current.profiles) {
                                    current = current.profiles;
                                } else if (i < parts.length - 1) {
                                    return null;
                                }
                            }
                            return current;
                        };

                        const result = findNestedProfile(profileKey, profiles);
                        return result;
                    },
                    set: (path: string, value: any) => {
                        return (teamConfig as any).set(path, value, { parseString: true });
                    },
                    delete: (path: string) => {
                        return (teamConfig as any).delete(path);
                    },
                };

                const layerActive = () => ({
                    properties: {
                        profiles: teamConfig.api.layers.get().properties.profiles,
                    },
                });

                const originalPath = this.constructNestedProfilePath(rename.originalKey);
                const newPath = this.constructNestedProfilePath(rename.newKey);

                // Check if the original profile exists
                const originalProfile = configMoveAPI.get(originalPath);
                if (!originalProfile) {
                    throw new Error(`Cannot rename profile '${rename.originalKey}': Profile does not exist`);
                }

                const existingTargetProfile = configMoveAPI.get(newPath);
                if (existingTargetProfile) {
                    throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Profile '${rename.newKey}' already exists`);
                }

                // Additional safety check: ensure we're not creating a circular reference
                if (rename.newKey.startsWith(rename.originalKey + ".")) {
                    throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Would create circular reference`);
                }

                moveProfile(configMoveAPI, layerActive, originalPath, newPath);

                // Update any defaults that reference the old profile name
                updateDefaultsAfterRename(
                    () => teamConfig.api.layers.get(),
                    rename.originalKey,
                    rename.newKey,
                    (updatedDefaults) => teamConfig.set("defaults", updatedDefaults, { parseString: true })
                );

                await teamConfig.save();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Error renaming profile from '${rename.originalKey}' to '${rename.newKey}': ${errorMessage}`);
                throw error;
            }
        }
    }

    private constructNestedProfilePath(profileKey: string): string {
        const profileParts = profileKey.split(".");
        const pathParts = ["profiles"];

        for (const part of profileParts) {
            pathParts.push(part);
            pathParts.push("profiles");
        }

        // Remove the last "profiles" since we don't need it for the final path
        pathParts.pop();
        return pathParts.join(".");
    }

    private async handleAutostoreChange(configPath: string, value: boolean): Promise<void> {
        try {
            const profInfo = new ProfileInfo("zowe");
            await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
            const teamConfig = profInfo.getTeamConfig();

            const targetLayer = teamConfig.layers.find((layer: any) => layer.path === configPath);

            if (targetLayer) {
                teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

                teamConfig.set("autoStore", value, { parseString: true });

                await teamConfig.save();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error updating autostore setting: ${errorMessage}`);
        }
    }

    private parseConfigChanges(data: LayerModifications): LayerModifications[] {
        return ConfigUtils.parseConfigChanges(data);
    }

    private generateSchemaValidation(schema: any): schemaValidation {
        return ConfigSchemaHelpers.generateSchemaValidation(schema);
    }

    /**
     * Updates profile changes to use new profile names before processing
     * This prevents duplicate profiles by ensuring changes target the correct names
     * Uses TeamConfig API for more reliable profile path resolution
     */
    private async updateProfileChangesForRenames(
        message: any,
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Promise<any> {
        if (!renames || renames.length === 0) {
            return message;
        }

        // Initialize TeamConfig for profile API access
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        const updatedMessage = { ...message };

        // Create a map of all renames for easier lookup
        const renameMap = new Map<string, { oldKey: string; newKey: string; configPath: string }>();
        renames.forEach((rename) => {
            renameMap.set(rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath });
        });

        // Helper function to get the new name for a profile path
        const getNewProfilePath = (profilePath: string, configPath: string, includeProfilesSegments = false): string => {
            // Split the path into parts to handle nested profiles
            const parts = profilePath.split(".");
            let newPath = parts.slice();
            let modified = false;

            // Check each part and its parent combinations for renames
            for (let i = parts.length; i > 0; i--) {
                const partialPath = parts.slice(0, i).join(".");
                const rename = renameMap.get(partialPath);
                if (rename && rename.configPath === configPath) {
                    // Replace this part of the path with the new name
                    const remainingParts = parts.slice(i);
                    newPath = [...rename.newKey.split("."), ...remainingParts];
                    modified = true;
                    break;
                }
            }

            if (includeProfilesSegments) {
                // Always convert profile path to include 'profiles' segments
                // e.g., "test.lpar2" -> ["profiles", "test", "profiles", "lpar2"]
                // or "test" -> ["profiles", "test"]
                const pathWithProfiles: string[] = [];
                const pathParts = modified ? newPath : parts;

                // Always start with "profiles"
                pathWithProfiles.push("profiles");

                // Add each part with "profiles" between them
                for (let i = 0; i < pathParts.length; i++) {
                    pathWithProfiles.push(pathParts[i]);
                    // Add "profiles" between parts, but not after the last one
                    if (i < pathParts.length - 1) {
                        pathWithProfiles.push("profiles");
                    }
                }
                return pathWithProfiles.join(".");
            }

            return modified ? newPath.join(".") : profilePath;
        };

        // Update changes
        if (updatedMessage.changes) {
            updatedMessage.changes = updatedMessage.changes.map((change: any) => {
                if (change.configPath) {
                    const updatedChange = { ...change };

                    // Update the profile field
                    if (updatedChange.profile) {
                        updatedChange.profile = getNewProfilePath(updatedChange.profile, change.configPath);
                    }

                    // Update the key field
                    if (updatedChange.key) {
                        const keyParts = updatedChange.key.split(".");
                        // Extract the profile path and property/type
                        let propertyPath = "";
                        let inProfile = false;
                        let currentProfile = "";
                        let profileEndIndex = -1;

                        // Find where the profile path ends
                        for (let i = 0; i < keyParts.length; i++) {
                            const part = keyParts[i];
                            if (part === "profiles") {
                                inProfile = true;
                                continue;
                            }
                            if (part === "properties") {
                                propertyPath = keyParts.slice(i).join(".");
                                profileEndIndex = i;
                                break;
                            }
                            if (part === "type" || part === "secure") {
                                // For direct profile properties like 'type' or 'secure' (not under 'properties')
                                propertyPath = keyParts.slice(i).join(".");
                                profileEndIndex = i;
                                break;
                            }
                            if (inProfile) {
                                if (currentProfile) {
                                    currentProfile += "." + part;
                                } else {
                                    currentProfile = part;
                                }
                            }
                        }

                        // If we didn't find properties, type, or secure, the entire path might be a profile path
                        if (profileEndIndex === -1 && inProfile) {
                            // This might be a profile-only key (though this should be rare)
                            profileEndIndex = keyParts.length;
                        }

                        if (currentProfile) {
                            // Get the new profile path with 'profiles' segments included
                            const newProfilePath = getNewProfilePath(currentProfile, change.configPath, true);
                            // Combine with property path
                            updatedChange.key = propertyPath ? `${newProfilePath}.${propertyPath}` : newProfilePath;
                        }
                    }

                    // Update the path array
                    if (updatedChange.path && Array.isArray(updatedChange.path)) {
                        // Extract the profile path from the path array
                        let currentProfile = "";
                        let propertyPath: string[] = [];
                        let foundPropertySection = false;

                        for (const part of updatedChange.path) {
                            if (part === "properties" || part === "type" || part === "secure") {
                                foundPropertySection = true;
                                propertyPath.push(part);
                                continue;
                            }
                            if (!foundPropertySection) {
                                if (part !== "profiles") {
                                    if (currentProfile) {
                                        currentProfile += "." + part;
                                    } else {
                                        currentProfile = part;
                                    }
                                }
                            } else {
                                propertyPath.push(part);
                            }
                        }

                        if (currentProfile) {
                            // Get the new profile path with 'profiles' segments
                            const newProfilePath = getNewProfilePath(currentProfile, change.configPath, true);
                            // Split into array and combine with property path
                            updatedChange.path = [...newProfilePath.split("."), ...propertyPath];
                        }
                    }

                    return updatedChange;
                }
                return change;
            });
        }

        // Update profile deletions to use new names
        if (updatedMessage.deletions) {
            updatedMessage.deletions = updatedMessage.deletions.map((deletion: any) => {
                if (deletion.configPath) {
                    const updatedDeletion = { ...deletion };

                    // Update the profile field
                    if (updatedDeletion.profile) {
                        updatedDeletion.profile = getNewProfilePath(updatedDeletion.profile, deletion.configPath);
                    }

                    // Update the key field
                    if (updatedDeletion.key) {
                        const keyParts = updatedDeletion.key.split(".");
                        // Extract the profile path and property
                        let propertyPath = "";
                        let inProfile = false;
                        let currentProfile = "";

                        for (let i = 0; i < keyParts.length; i++) {
                            const part = keyParts[i];
                            if (part === "profiles") {
                                inProfile = true;
                                continue;
                            }
                            if (part === "properties") {
                                propertyPath = keyParts.slice(i).join(".");
                                break;
                            }
                            if (inProfile) {
                                if (currentProfile) {
                                    currentProfile += "." + part;
                                } else {
                                    currentProfile = part;
                                }
                            }
                        }

                        if (currentProfile) {
                            // Get the new profile path with 'profiles' segments included
                            const newProfilePath = getNewProfilePath(currentProfile, deletion.configPath, true);
                            // Combine with property path
                            updatedDeletion.key = propertyPath ? `${newProfilePath}.${propertyPath}` : newProfilePath;
                        }
                    }

                    // Update the path array
                    if (updatedDeletion.path && Array.isArray(updatedDeletion.path)) {
                        const pathStr = updatedDeletion.path.join(".");
                        // Get the new path with 'profiles' segments included
                        const updatedPathStr = getNewProfilePath(pathStr, deletion.configPath, true);
                        updatedDeletion.path = updatedPathStr.split(".");
                    }

                    return updatedDeletion;
                }
                return deletion;
            });
        }
        return updatedMessage;
    }

    private async getPendingMergedArgsForProfile(
        profPath: string,
        configPath: string,
        changes: any,
        renames?: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Promise<any> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        const teamConfig = profInfo.getTeamConfig();
        const parsedChanges = this.parseConfigChanges(changes);
        for (const change of parsedChanges) {
            if (change.defaultsChanges || change.defaultsDeleteKeys) {
                this.simulateDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath, teamConfig);
            }

            if (change.changes || change.deletions) {
                this.simulateProfileChanges(change.changes, change.deletions, change.configPath, teamConfig);
            }
        }

        if (renames && Array.isArray(renames)) {
            this.simulateProfileRenames(renames, teamConfig);
        }

        const allProfiles = profInfo.getAllProfiles();

        let actualProfileName = profPath;
        if (renames && Array.isArray(renames)) {
            const rename = renames.find((r) => r.originalKey === profPath && r.configPath === configPath);
            if (rename) {
                actualProfileName = rename.newKey;
            }
        }

        const profile = allProfiles.find((prof) => prof.profName === actualProfileName && prof.profLoc.osLoc?.includes(path.normalize(configPath)));
        if (!profile) {
            return;
        }

        const mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        return mergedArgs.knownArgs;
    }

    private simulateDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string, teamConfig: any): void {
        ConfigChangeHandlers.simulateDefaultChanges(changes, deletions, activeLayer, teamConfig);
    }

    private simulateProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string, teamConfig: any): void {
        ConfigChangeHandlers.simulateProfileChanges(changes, deletions, configPath, teamConfig);
    }

    private simulateProfileRenames(renames: Array<{ originalKey: string; newKey: string; configPath: string }>, teamConfig: any): void {
        for (const rename of renames) {
            try {
                const targetLayer = teamConfig.layers.find((layer: any) => layer.path === rename.configPath);

                if (!targetLayer) {
                    continue; // Skip if layer not found
                }

                teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

                const configMoveAPI: ConfigMoveAPI = {
                    get: (path: string) => {
                        const currentLayer = teamConfig.api.layers.get();
                        const profiles = currentLayer.properties.profiles;

                        const profileKey = path.replace("profiles.", "");

                        const findNestedProfile = (key: string, profilesObj: any): any => {
                            const parts = key.split(".");
                            let current: any = profilesObj;

                            for (let i = 0; i < parts.length; i++) {
                                const part = parts[i];

                                if (part === "profiles") {
                                    continue;
                                }

                                if (!current || !current[part]) {
                                    return null;
                                }
                                current = current[part];

                                if (i === parts.length - 1) {
                                    return current;
                                }

                                if (current && typeof current === "object" && current.profiles) {
                                    current = current.profiles;
                                } else if (i < parts.length - 1) {
                                    return null;
                                }
                            }
                            return current;
                        };

                        return findNestedProfile(profileKey, profiles);
                    },
                    set: (path: string, value: any) => teamConfig.set(path, value, { parseString: true }),
                    delete: (path: string) => teamConfig.delete(path),
                };

                const layerActive = () => ({
                    properties: {
                        profiles: teamConfig.api.layers.get().properties.profiles,
                    },
                });

                const originalPath = this.constructNestedProfilePath(rename.originalKey);
                const newPath = this.constructNestedProfilePath(rename.newKey);
                moveProfile(configMoveAPI, layerActive, originalPath, newPath);

                // Simulate defaults updates for this rename
                simulateDefaultsUpdateAfterRename(() => teamConfig.api.layers.get(), rename.originalKey, rename.newKey);
            } catch (error) {
                continue;
            }
        }
    }

    private async getWizardMergedProperties(
        rootProfile: string,
        profileType: string,
        configPath: string,
        profileName?: string,
        changes?: any,
        renames?: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Promise<any> {
        if (!profileType) {
            return [];
        }

        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        const teamConfig = profInfo.getTeamConfig();

        if (changes) {
            const parsedChanges = this.parseConfigChanges(changes);
            for (const change of parsedChanges) {
                if (change.defaultsChanges || change.defaultsDeleteKeys) {
                    this.simulateDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath, teamConfig);
                }
                if (change.changes || change.deletions) {
                    this.simulateProfileChanges(change.changes, change.deletions, change.configPath, teamConfig);
                }
            }
        }

        if (renames && Array.isArray(renames)) {
            this.simulateProfileRenames(renames, teamConfig);
        }

        if (configPath !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: any) => prof.path === configPath);
            if (findProfile) {
                teamConfig.api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        let actualRootProfile = rootProfile;
        if (renames && Array.isArray(renames)) {
            for (const rename of renames) {
                if (rename.configPath === configPath) {
                    if (rootProfile === rename.originalKey) {
                        actualRootProfile = rename.newKey;
                        break;
                    } else if (rootProfile.startsWith(rename.originalKey + ".")) {
                        actualRootProfile = rootProfile.replace(rename.originalKey + ".", rename.newKey + ".");
                        break;
                    }
                }
            }
        }

        const tempProfileName = profileName || `temp_${Date.now()}`;
        let tempProfilePath: string;
        let expectedProfileName: string;

        if (actualRootProfile === "root") {
            tempProfilePath = `profiles.${tempProfileName}`;
            expectedProfileName = tempProfileName;
        } else {
            const profileParts = actualRootProfile.split(".");
            const pathParts = ["profiles"];

            for (const part of profileParts) {
                pathParts.push(part);
                pathParts.push("profiles");
            }

            pathParts.push(tempProfileName);
            tempProfilePath = pathParts.join(".");
            expectedProfileName = `${actualRootProfile}.${tempProfileName}`;
        }

        try {
            teamConfig.set(tempProfilePath, { type: profileType }, { parseString: true });

            const allProfiles = profInfo.getAllProfiles();
            const tempProfile = allProfiles.find((prof) => prof.profName === expectedProfileName);

            if (!tempProfile) {
                return [];
            }

            const mergedArgs = profInfo.mergeArgsForProfile(tempProfile, { getSecureVals: true });
            return mergedArgs.knownArgs || [];
        } finally {
            try {
                teamConfig.delete(tempProfilePath);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }

    private async checkExistingConfig(filePath: string, user: boolean): Promise<string | false | null> {
        const existingLayers = await ZoweVsCodeExtension.getConfigLayers();

        const configFiles = user ? ["zowe.config.user.json"] : ["zowe.config.json"];
        const foundLayer = existingLayers.find((layer) => {
            const layerDir = path.dirname(layer.path);
            const layerFile = path.basename(layer.path);
            return layerDir === filePath && configFiles.includes(layerFile);
        });

        if (foundLayer == null) {
            return null;
        }
        const createButton = "Create New";
        const message =
            `A Team Configuration File already exists in this location\n{0}\n` + `Continuing may alter the existing file, would you like to proceed?`;
        const response = await vscode.window.showInformationMessage(message, { modal: true }, createButton);
        if (response) {
            return path.basename(foundLayer.path);
        } else {
            await ZoweVsCodeExtension.openConfigFile(foundLayer.path);
        }
        return false;
    }
}
