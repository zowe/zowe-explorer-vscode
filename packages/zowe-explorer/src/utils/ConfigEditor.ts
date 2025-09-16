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
    IConfigLayer,
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
                try {
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
                } catch (error) {
                    // If a critical error occurred during save, cancel the entire operation
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Save operation failed:", errorMessage);

                    // Refresh configurations to clear the saving state and show current state
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

                    // Don't re-throw the error to prevent unhandled promise rejection
                }
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
            case "SHOW_ERROR_MESSAGE": {
                vscode.window.showErrorMessage(message.message);
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

    /**
     * Updates rename keys to handle both parent-first and child-first rename scenarios.
     *
     * Parent-first scenario:
     * - test1 -> test12
     * - test1.lpar1 -> test12.lpar12
     * Result: test12.lpar1 -> test12.lpar12
     *
     * Child-first scenario:
     * - test1.lpar1 -> test1.lpar2
     * - test1 -> test12
     * Result: test12.lpar2 -> test12.lpar2 (no change needed for child, parent path updated)
     */
    private updateRenameKeysForParentChanges(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const updatedRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];
        const processedRenames = new Map<string, string>(); // originalKey -> newKey mapping

        // First pass: collect all renames to build a complete mapping
        const allRenames = new Map<string, string>();
        for (const rename of renames) {
            allRenames.set(rename.originalKey, rename.newKey);
        }

        for (const rename of renames) {
            let updatedOriginalKey = rename.originalKey;
            let updatedNewKey = rename.newKey;

            // Check if any parent of this profile has been renamed
            const originalParts = rename.originalKey.split(".");
            const newParts = rename.newKey.split(".");

            // Update the original key to reflect any parent renames
            for (let i = 0; i < originalParts.length; i++) {
                const parentPath = originalParts.slice(0, i + 1).join(".");
                if (processedRenames.has(parentPath)) {
                    // Replace the parent part in the original key
                    const newParentPath = processedRenames.get(parentPath)!;
                    const remainingParts = originalParts.slice(i + 1);
                    updatedOriginalKey = remainingParts.length > 0 ? `${newParentPath}.${remainingParts.join(".")}` : newParentPath;
                    break; // Only apply the first matching parent rename
                }
            }

            // Update the new key to reflect any parent renames
            for (let i = 0; i < newParts.length; i++) {
                const parentPath = newParts.slice(0, i + 1).join(".");
                if (processedRenames.has(parentPath)) {
                    // Replace the parent part in the new key
                    const newParentPath = processedRenames.get(parentPath)!;
                    const remainingParts = newParts.slice(i + 1);
                    updatedNewKey = remainingParts.length > 0 ? `${newParentPath}.${remainingParts.join(".")}` : newParentPath;
                    break; // Only apply the first matching parent rename
                }
            }

            // Handle child-first scenario: if this is a parent rename, update any existing child renames
            if (originalParts.length === 1) {
                // This is a parent rename
                const parentOriginalKey = rename.originalKey;
                const parentNewKey = rename.newKey;

                // Find and update any child renames that reference this parent
                for (let i = 0; i < updatedRenames.length; i++) {
                    const childRename = updatedRenames[i];
                    const childOriginalParts = childRename.originalKey.split(".");
                    const childNewParts = childRename.newKey.split(".");

                    // Check if this child rename starts with the parent we're renaming
                    // Either in the original key or the new key
                    const childStartsWithParent =
                        (childOriginalParts.length > 1 && childOriginalParts[0] === parentOriginalKey) ||
                        (childNewParts.length > 1 && childNewParts[0] === parentOriginalKey);

                    if (childStartsWithParent) {
                        // Update the child's original key to use the new parent name
                        let updatedChildOriginalKey = childRename.originalKey;
                        if (childOriginalParts.length > 1 && childOriginalParts[0] === parentOriginalKey) {
                            const childRemainingParts = childOriginalParts.slice(1);
                            updatedChildOriginalKey = `${parentNewKey}.${childRemainingParts.join(".")}`;
                        }

                        // Update the child's new key to use the new parent name if it also starts with the old parent
                        let updatedChildNewKey = childRename.newKey;
                        if (childNewParts.length > 1 && childNewParts[0] === parentOriginalKey) {
                            const childNewRemainingParts = childNewParts.slice(1);
                            updatedChildNewKey = `${parentNewKey}.${childNewRemainingParts.join(".")}`;
                        }

                        // Update the child rename in the array
                        updatedRenames[i] = {
                            originalKey: updatedChildOriginalKey,
                            newKey: updatedChildNewKey,
                            configPath: childRename.configPath,
                        };
                    }
                }
            }

            // Add the updated rename
            updatedRenames.push({
                originalKey: updatedOriginalKey,
                newKey: updatedNewKey,
                configPath: rename.configPath,
            });

            // Track this rename for future reference - use the updated keys
            processedRenames.set(updatedOriginalKey, updatedNewKey);
        }

        // Second pass is no longer needed - the first pass handles child renames correctly

        return updatedRenames;
    }

    /**
     * Removes duplicate renames that target the same final key
     * This prevents conflicts when multiple renames result in the same target profile
     */
    private removeDuplicateRenames(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const finalRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];
        const seenTargets = new Map<string, { originalKey: string; newKey: string; configPath: string }>();

        for (const rename of renames) {
            const targetKey = `${rename.newKey}:${rename.configPath}`;
            const renameTail = rename.originalKey.split(".").pop()!;

            if (seenTargets.has(targetKey)) {
                const existing = seenTargets.get(targetKey)!;
                const existingTail = existing.originalKey.split(".").pop()!;

                if (renameTail === existingTail) {
                    // Same newKey + configPath + same ending segment -> allow both
                    finalRenames.push(rename);
                    continue;
                }

                // Otherwise, keep the one with the shorter original key path
                if (rename.originalKey.split(".").length < existing.originalKey.split(".").length) {
                    const index = finalRenames.findIndex((r) => r === existing);
                    if (index !== -1) {
                        finalRenames[index] = rename;
                        seenTargets.set(targetKey, rename);
                    }
                }
                // else skip
            } else {
                finalRenames.push(rename);
                seenTargets.set(targetKey, rename);
            }
        }

        return finalRenames;
    }

    private async handleProfileRenames(renames: Array<{ originalKey: string; newKey: string; configPath: string }>): Promise<void> {
        if (!renames || renames.length === 0) {
            return;
        }

        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        // Process renames in order - sort by depth to ensure parent renames happen before child renames
        const sortedRenames = [...renames].sort((a, b) => {
            // Primary sort: by newKey depth (shorter paths first)
            const depthA = a.newKey.split(".").length;
            const depthB = b.newKey.split(".").length;

            if (depthA !== depthB) {
                return depthA - depthB;
            }

            // Secondary sort: by originalKey depth when newKey depths are equal
            const originalDepthA = a.originalKey.split(".").length;
            const originalDepthB = b.originalKey.split(".").length;
            return originalDepthA - originalDepthB;
        });

        // Update rename keys to reflect parent renames that have already been processed
        const updatedRenames = this.updateRenameKeysForParentChanges(sortedRenames);

        // Remove duplicate renames that target the same final key
        const finalRenames = this.removeDuplicateRenames(updatedRenames);

        // Filter out no-op renames (where originalKey === newKey)
        const filteredRenames = finalRenames.filter((rename) => rename.originalKey !== rename.newKey);

        // Get the team config once for all renames
        const teamConfig = profInfo.getTeamConfig();

        for (const rename of filteredRenames) {
            try {
                // Pre-validate the rename operation before making any changes
                let originalPath: string;
                let newPath: string;

                try {
                    originalPath = this.constructNestedProfilePath(rename.originalKey);
                    newPath = this.constructNestedProfilePath(rename.newKey);
                } catch (pathError) {
                    const pathErrorMessage = pathError instanceof Error ? pathError.message : String(pathError);
                    vscode.window.showErrorMessage(
                        `Invalid profile path for rename '${rename.originalKey}' to '${rename.newKey}': ${pathErrorMessage}`
                    );
                    continue; // Skip this rename and continue with others
                }

                // Check for circular reference BEFORE making any changes
                if (this.wouldCreateCircularReference(rename.originalKey, rename.newKey)) {
                    const errorMessage = `Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Would create circular reference`;
                    vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
                    throw new Error(`Critical error during profile rename: ${errorMessage}`);
                }

                const targetLayer = teamConfig.layers.find((layer: any) => layer.path === rename.configPath);

                if (!targetLayer) {
                    vscode.window.showErrorMessage(`Configuration layer not found for path: ${rename.configPath}`);
                    continue; // Skip this rename and continue with others
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

                // Check if the original profile exists
                const originalProfile = configMoveAPI.get(originalPath);
                if (!originalProfile) {
                    // If the original profile doesn't exist, it's likely being created through changes
                    // rather than renamed from an existing profile. Skip this rename operation silently.
                    continue; // Skip this rename and continue with others
                }

                const existingTargetProfile = configMoveAPI.get(newPath);
                if (existingTargetProfile) {
                    const errorMessage = `Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Profile '${rename.newKey}' already exists`;
                    vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
                    throw new Error(`Critical error during profile rename: ${errorMessage}`);
                }

                // Validate ConfigMoveAPI before use
                try {
                    this.validateConfigMoveAPI(configMoveAPI, layerActive);
                } catch (validationError) {
                    const errorMessage = this.handleMoveUtilsError(validationError, "validate ConfigMoveAPI", rename.originalKey, rename.newKey);
                    vscode.window.showErrorMessage(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                try {
                    // Check if this is a nested profile creation (e.g., 'tso' -> 'tso.asdf')
                    if (this.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
                        this.createNestedProfileStructure(configMoveAPI, layerActive, originalPath, newPath, rename.originalKey, rename.newKey);
                    } else {
                        moveProfile(configMoveAPI, layerActive, originalPath, newPath);
                    }
                } catch (moveError) {
                    const errorMessage = this.handleMoveUtilsError(moveError, "move profile", originalPath, newPath);

                    // Check if this is a critical error that should cancel the entire save operation
                    if (this.isCriticalMoveError(moveError)) {
                        vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
                        throw new Error(`Critical error during profile rename: ${errorMessage}`);
                    }

                    vscode.window.showErrorMessage(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                // Update any defaults that reference the old profile name
                try {
                    updateDefaultsAfterRename(
                        () => teamConfig.api.layers.get(),
                        rename.originalKey,
                        rename.newKey,
                        (updatedDefaults) => teamConfig.set("defaults", updatedDefaults, { parseString: true })
                    );
                } catch (defaultsError) {
                    const errorMessage = this.handleMoveUtilsError(defaultsError, "update defaults", rename.originalKey, rename.newKey);
                    // Log the error but don't fail the entire rename operation
                    console.warn(errorMessage);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Check if this is a critical error that should cancel the entire save operation
                if (this.isCriticalMoveError(error)) {
                    // Re-throw critical errors so they can be caught by the outer try-catch block
                    throw error;
                }

                vscode.window.showErrorMessage(
                    `Unexpected error renaming profile from '${rename.originalKey}' to '${rename.newKey}': ${errorMessage}`
                );
                // Don't throw the error - continue with other renames
            }
        }

        // Save all changes once after all renames are processed successfully
        await teamConfig.save();
    }

    private constructNestedProfilePath(profileKey: string): string {
        if (!profileKey || typeof profileKey !== "string") {
            throw new Error("Profile key must be a non-empty string");
        }

        const profileParts = profileKey.split(".");
        if (profileParts.length === 0) {
            throw new Error("Profile key cannot be empty");
        }

        const pathParts = ["profiles"];

        for (const part of profileParts) {
            if (!part || part.trim() === "") {
                throw new Error("Profile key parts cannot be empty");
            }
            pathParts.push(part);
            pathParts.push("profiles");
        }

        // Remove the last "profiles" since we don't need it for the final path
        pathParts.pop();
        return pathParts.join(".");
    }

    /**
     * Validates the ConfigMoveAPI before calling MoveUtils functions
     * @param configMoveAPI The ConfigMoveAPI to validate
     * @param layerActive The layer active function
     * @throws Error if validation fails
     */
    private validateConfigMoveAPI(configMoveAPI: ConfigMoveAPI, layerActive: () => IConfigLayer): void {
        if (!configMoveAPI) {
            throw new Error("ConfigMoveAPI is null or undefined");
        }

        if (typeof configMoveAPI.get !== "function") {
            throw new Error("ConfigMoveAPI.get is not a function");
        }

        if (typeof configMoveAPI.set !== "function") {
            throw new Error("ConfigMoveAPI.set is not a function");
        }

        if (typeof configMoveAPI.delete !== "function") {
            throw new Error("ConfigMoveAPI.delete is not a function");
        }

        if (typeof layerActive !== "function") {
            throw new Error("layerActive is not a function");
        }

        try {
            const layer = layerActive();
            if (!layer || !layer.properties || !layer.properties.profiles) {
                throw new Error("Invalid layer structure: missing properties or profiles");
            }
        } catch (error) {
            throw new Error(`Failed to validate layer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handles errors from MoveUtils functions with consistent error messaging
     * @param error The error that occurred
     * @param operation The operation that failed (e.g., "move profile", "update defaults")
     * @param originalKey The original profile key
     * @param newKey The new profile key
     * @param isSimulation Whether this is a simulation operation
     * @returns A formatted error message
     */
    private handleMoveUtilsError(error: unknown, operation: string, originalKey: string, newKey: string, isSimulation: boolean = false): string {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const simulationPrefix = isSimulation ? "Simulation failed for " : "";
        return `${simulationPrefix}${operation} from '${originalKey}' to '${newKey}': ${errorMessage}`;
    }

    private isCriticalMoveError(error: any): boolean {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Critical errors that should cancel the entire save operation
        const criticalErrorPatterns = [
            /Profile.*already exists/i,
            /Target profile already exists/i,
            /Profile with name.*already exists/i,
            /Cannot rename profile.*Profile.*already exists/i,
            /Cannot rename profile.*Would create circular reference/i,
        ];

        return criticalErrorPatterns.some((pattern) => pattern.test(errorMessage));
    }

    /**
     * Checks if a profile rename would create a circular reference
     * @param originalKey The original profile key
     * @param newKey The new profile key
     * @returns true if the rename would create a circular reference
     */
    private wouldCreateCircularReference(originalKey: string, newKey: string): boolean {
        // A circular reference occurs when:
        // 1. The new key is a direct child of the original key AND
        // 2. The original key is already a child of the new key in the existing hierarchy

        // First, check if newKey is a direct child of originalKey
        if (!newKey.startsWith(originalKey + ".")) {
            return false; // Not a child relationship, so no circular reference possible
        }

        // Extract the child part
        const childPart = newKey.substring(originalKey.length + 1);

        // Check if the child part contains the original key (indicating a potential circular reference)
        // This would happen if we're trying to rename 'parent' to 'parent.child' where 'child'
        // already contains a reference to 'parent'
        if (childPart.includes(originalKey)) {
            return true;
        }

        // Additional check: if we're renaming a parent to be a child of itself
        // e.g., 'parent' -> 'parent.parent' or 'parent' -> 'parent.child.parent'
        const childParts = childPart.split(".");
        for (const part of childParts) {
            if (part === originalKey) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if a rename operation is creating a nested profile structure
     * @param originalKey The original profile key
     * @param newKey The new profile key
     * @returns true if this is creating a nested profile structure
     */
    private isNestedProfileCreation(originalKey: string, newKey: string): boolean {
        // This is a nested profile creation if:
        // 1. The new key starts with the original key + "."
        // 2. The original key is a single-level profile (no dots)
        return newKey.startsWith(originalKey + ".") && !originalKey.includes(".");
    }

    /**
     * Creates a nested profile structure when renaming a profile to create a parent-child relationship
     * @param configMoveAPI The ConfigMoveAPI instance
     * @param layerActive The layer active function
     * @param originalPath The original profile path
     * @param newPath The new profile path
     * @param originalKey The original profile key
     * @param newKey The new profile key
     */
    private createNestedProfileStructure(
        configMoveAPI: ConfigMoveAPI,
        layerActive: () => IConfigLayer,
        originalPath: string,
        newPath: string,
        originalKey: string,
        newKey: string
    ): void {
        // Get the original profile data
        const originalProfile = configMoveAPI.get(originalPath);
        if (!originalProfile) {
            throw new Error(`Source profile not found at path: ${originalPath}`);
        }

        // Extract the child profile name from the new key
        const childProfileName = newKey.substring(originalKey.length + 1);

        // Create the new parent profile structure
        const newParentProfile = {
            ...originalProfile,
            profiles: {
                [childProfileName]: originalProfile,
            },
        };

        // Remove the profiles property from the child profile to avoid duplication
        const childProfile = { ...originalProfile };
        delete childProfile.profiles;

        // Set the new parent profile structure
        configMoveAPI.set(originalPath, newParentProfile);

        // Update the child profile within the parent
        const childPath = `${originalPath}.profiles.${childProfileName}`;
        configMoveAPI.set(childPath, childProfile);

        // Move secure properties if they exist
        this.moveSecurePropertiesForNestedProfile(configMoveAPI, layerActive, originalPath, childPath, originalKey, newKey);
    }

    /**
     * Moves secure properties for nested profile creation
     * @param configMoveAPI The ConfigMoveAPI instance
     * @param layerActive The layer active function
     * @param parentPath The parent profile path
     * @param childPath The child profile path
     * @param originalKey The original profile key
     * @param newKey The new profile key
     */
    private moveSecurePropertiesForNestedProfile(
        configMoveAPI: ConfigMoveAPI,
        layerActive: () => IConfigLayer,
        parentPath: string,
        childPath: string,
        originalKey: string,
        newKey: string
    ): void {
        try {
            // Get secure properties from the original profile
            const originalProfile = configMoveAPI.get(parentPath);
            const secureProperties = originalProfile?.secure || [];

            if (secureProperties.length > 0) {
                // Set secure properties on the child profile
                const childProfile = configMoveAPI.get(childPath);
                if (childProfile) {
                    configMoveAPI.set(`${childPath}.secure`, secureProperties);
                }

                // Remove secure properties from the parent profile
                const parentProfile = configMoveAPI.get(parentPath);
                if (parentProfile && parentProfile.secure) {
                    delete parentProfile.secure;
                    configMoveAPI.set(parentPath, parentProfile);
                }
            }
        } catch (error) {
            // Log error but don't fail the operation
            console.warn(`Failed to move secure properties for nested profile creation: ${error}`);
        }
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

    private redactSecureValues(knownArgs: any): any {
        if (!knownArgs || typeof knownArgs !== "object") {
            return knownArgs;
        }

        // Handle array case
        if (Array.isArray(knownArgs)) {
            return knownArgs.map((item) => this.redactSecureValues(item));
        }

        const redacted = { ...knownArgs };
        for (const [key, value] of Object.entries(redacted)) {
            if (value && typeof value === "object") {
                // Check if this is a secure field
                if ("secure" in value && value.secure === true) {
                    redacted[key] = {
                        ...value,
                        value: "REDACTED",
                    };
                } else {
                    // Recursively process nested objects
                    redacted[key] = this.redactSecureValues(value);
                }
            }
        }
        return redacted;
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

        // Simulate profile renames FIRST, so that default changes can reference the renamed profiles
        if (renames && Array.isArray(renames)) {
            this.simulateProfileRenames(renames, teamConfig);
        }

        const parsedChanges = this.parseConfigChanges(changes);
        for (const change of parsedChanges) {
            if (change.defaultsChanges || change.defaultsDeleteKeys) {
                this.simulateDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath, teamConfig);
            }

            if (change.changes || change.deletions) {
                this.simulateProfileChanges(change.changes, change.deletions, change.configPath, teamConfig);
            }
        }

        const allProfiles = profInfo.getAllProfiles();

        // After simulateProfileRenames, the profile data has been moved to the new location
        // So we need to look for the profile using the new name (after rename simulation)
        let profileNameToLookup = profPath;

        // Apply renames to get the current effective profile name
        if (renames && Array.isArray(renames)) {
            const configRenames = renames.filter((r) => r.configPath === configPath);

            // Apply renames iteratively until no more changes
            let changed = true;
            while (changed) {
                changed = false;

                for (const rename of configRenames) {
                    // Check for exact match
                    if (profileNameToLookup === rename.originalKey) {
                        profileNameToLookup = rename.newKey;
                        changed = true;
                        break;
                    }

                    // Check for partial matches (parent renames affecting children)
                    if (profileNameToLookup.startsWith(rename.originalKey + ".")) {
                        profileNameToLookup = profileNameToLookup.replace(rename.originalKey + ".", rename.newKey + ".");
                        changed = true;
                        break;
                    }
                }
            }
        }

        // Look for the profile using the original name first
        // The allProfiles array contains profiles from the original configuration
        let profile = allProfiles.find((prof) => prof.profName === profPath && prof.profLoc.osLoc?.includes(path.normalize(configPath)));

        // If not found with original name, try with the current effective name
        if (!profile && profileNameToLookup !== profPath) {
            profile = allProfiles.find((prof) => prof.profName === profileNameToLookup && prof.profLoc.osLoc?.includes(path.normalize(configPath)));
        }

        if (!profile) {
            return;
        }

        const mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        const redacted = this.redactSecureValues(mergedArgs.knownArgs);
        return redacted;
    }

    private simulateDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string, teamConfig: any): void {
        ConfigChangeHandlers.simulateDefaultChanges(changes, deletions, activeLayer, teamConfig);
    }

    private simulateProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string, teamConfig: any): void {
        ConfigChangeHandlers.simulateProfileChanges(changes, deletions, configPath, teamConfig);
    }

    private simulateProfileRenames(renames: Array<{ originalKey: string; newKey: string; configPath: string }>, teamConfig: any): void {
        if (!renames || renames.length === 0) {
            return;
        }

        if (!teamConfig) {
            console.warn("Cannot simulate profile renames: teamConfig is null or undefined");
            return;
        }

        // Process renames in order - no special sorting needed since client handles consolidation
        const sortedRenames = [...renames].sort((a, b) => {
            // Primary sort: by newKey depth (shorter paths first)
            const depthA = a.newKey.split(".").length;
            const depthB = b.newKey.split(".").length;

            if (depthA !== depthB) {
                return depthA - depthB;
            }

            // Secondary sort: by originalKey depth when newKey depths are equal
            const originalDepthA = a.originalKey.split(".").length;
            const originalDepthB = b.originalKey.split(".").length;
            return originalDepthA - originalDepthB;
        });

        // Update rename keys to reflect parent renames that have already been processed
        const updatedRenames = this.updateRenameKeysForParentChanges(sortedRenames);

        // Remove duplicate renames that target the same final key
        const finalRenames = this.removeDuplicateRenames(updatedRenames);

        // Filter out no-op renames (where originalKey === newKey)
        const filteredRenames = finalRenames.filter((rename) => rename.originalKey !== rename.newKey);

        for (const rename of filteredRenames) {
            try {
                // Skip if the original and new keys are the same (no-op rename)
                if (rename.originalKey === rename.newKey) {
                    continue;
                }

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

                let originalPath: string;
                let newPath: string;

                try {
                    originalPath = this.constructNestedProfilePath(rename.originalKey);
                    newPath = this.constructNestedProfilePath(rename.newKey);
                } catch (pathError) {
                    const errorMessage = this.handleMoveUtilsError(pathError, "construct profile path", rename.originalKey, rename.newKey, true);
                    console.warn(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                // Validate ConfigMoveAPI before use
                try {
                    this.validateConfigMoveAPI(configMoveAPI, layerActive);
                } catch (validationError) {
                    const errorMessage = this.handleMoveUtilsError(
                        validationError,
                        "validate ConfigMoveAPI",
                        rename.originalKey,
                        rename.newKey,
                        true
                    );
                    console.warn(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                try {
                    // Check if this is a nested profile creation (e.g., 'tso' -> 'tso.asdf')
                    if (this.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
                        this.createNestedProfileStructure(configMoveAPI, layerActive, originalPath, newPath, rename.originalKey, rename.newKey);
                    } else {
                        moveProfile(configMoveAPI, layerActive, originalPath, newPath);
                    }
                } catch (moveError) {
                    const errorMessage = this.handleMoveUtilsError(moveError, "simulate move profile", originalPath, newPath, true);
                    console.warn(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                // Simulate defaults updates for this rename
                try {
                    simulateDefaultsUpdateAfterRename(() => teamConfig.api.layers.get(), rename.originalKey, rename.newKey);
                } catch (defaultsError) {
                    const errorMessage = this.handleMoveUtilsError(
                        defaultsError,
                        "simulate defaults update",
                        rename.originalKey,
                        rename.newKey,
                        true
                    );
                    console.warn(errorMessage);
                    // Continue execution as this is simulation only
                }
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

        // Simulate profile renames FIRST, so that default changes can reference the renamed profiles
        if (renames && Array.isArray(renames)) {
            this.simulateProfileRenames(renames, teamConfig);
        }

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
            const redacted = this.redactSecureValues(mergedArgs.knownArgs);
            return redacted || [];
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
