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

import { DeferredPromise, WebView, ZoweVsCodeExtension, ProfilesCache } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { ProfileInfo, ProfileCredentials } from "@zowe/imperative";
import * as path from "path";
import * as fs from "fs";
import { ConfigSchemaHelpers, schemaValidation } from "./ConfigSchemaHelpers";
import { ConfigChangeHandlers, ChangeEntry } from "./ConfigChangeHandlers";
import { ConfigUtils, LayerModifications } from "./ConfigUtils";
import {
    ConfigMoveAPI,
    moveProfile,
    updateDefaultsAfterRename,
    simulateDefaultsUpdateAfterRename,
} from "../webviews/src/config-editor/utils/MoveUtils";
import { Profiles } from "../configuration/Profiles";
import { ConfigEditorMessageHandlers } from "./ConfigEditorMessageHandlers";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import { ConfigEditorFileOperations } from "./ConfigEditorFileOperations";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";

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

    private messageHandlers: ConfigEditorMessageHandlers;
    private profileOperations: ConfigEditorProfileOperations;
    private fileOperations: ConfigEditorFileOperations;

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
            viewColumn: vscode.ViewColumn.One,
        });

        // Initialize helper classes
        this.messageHandlers = new ConfigEditorMessageHandlers(
            () => this.getLocalConfigs(),
            () => this.areSecureValuesAllowed(),
            this.panel
        );
        this.profileOperations = new ConfigEditorProfileOperations();
        this.fileOperations = new ConfigEditorFileOperations(() => this.getLocalConfigs());

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

    public async areSecureValuesAllowed(): Promise<boolean> {
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

    public async getLocalConfigs(): Promise<any[]> {
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
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

                        this.processProfilesRecursively(layer.properties.profiles, schemaValidation);

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
                        // Try to find schema in the same directory even if not explicitly referenced
                        let schemaValidation: schemaValidation | undefined;
                        try {
                            const possibleSchemaPath = path.join(path.dirname(configPath), "zowe.schema.json");
                            if (fs.existsSync(possibleSchemaPath)) {
                                const schemaContent = fs.readFileSync(possibleSchemaPath, { encoding: "utf8" });
                                const schema = JSON.parse(schemaContent);
                                schemaValidation = this.generateSchemaValidation(schema);
                            }
                        } catch (err) {
                            // Schema not found or invalid, continue without filtering
                        }

                        // Process profiles with schema validation if available
                        this.processProfilesRecursively(layer.properties.profiles, schemaValidation);

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

    private processProfilesRecursively(profiles: any, schemaValidation?: schemaValidation): void {
        ConfigUtils.processProfilesRecursively(profiles, schemaValidation);
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        switch (message.command.toLocaleUpperCase()) {
            case "GET_PROFILES": {
                await this.messageHandlers.handleGetProfiles();
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
                await this.messageHandlers.handleOpenConfigFile(message);
                break;
            }
            case "REVEAL_IN_FINDER": {
                await this.messageHandlers.handleRevealInFinder(message);
                break;
            }
            case "OPEN_SCHEMA_FILE": {
                await this.messageHandlers.handleOpenSchemaFile(message);
                break;
            }
            case "GET_ENV_INFORMATION": {
                await this.messageHandlers.handleGetEnvInformation();
                break;
            }
            case "GET_ENV_VARS": {
                await this.messageHandlers.handleGetEnvVars(message);
                break;
            }
            case "INITIAL_SELECTION": {
                this.messageHandlers.handleInitialSelection(message, (selection) => {
                    this.initialSelection = selection;
                });
                break;
            }
            case "CONFIGURATIONS_READY": {
                await this.messageHandlers.handleConfigurationsReady(this.initialSelection, (selection) => {
                    this.initialSelection = selection;
                });
                break;
            }
            case "OPEN_CONFIG_FILE_WITH_PROFILE": {
                await this.fileOperations.openConfigFileWithProfile(message);
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
                await this.messageHandlers.handleSelectFile(message);
                break;
            }
            case "CREATE_NEW_CONFIG": {
                const configs = await this.fileOperations.createNewConfig(message);
                if (configs.length > 0) {
                    await this.panel.webview.postMessage({
                        command: "CONFIGURATIONS",
                        contents: configs,
                    });
                }
                break;
            }
            case "GET_LOCAL_STORAGE_VALUE": {
                await this.messageHandlers.handleGetLocalStorageValue(message);
                break;
            }
            case "OPEN_VSCODE_SETTINGS": {
                await this.messageHandlers.handleOpenVscodeSettings(message);
                break;
            }
            case "SET_LOCAL_STORAGE_VALUE": {
                await this.messageHandlers.handleSetLocalStorageValue(message);
                break;
            }
            case "SHOW_ERROR_MESSAGE": {
                this.messageHandlers.handleShowErrorMessage(message);
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
                await this.fileOperations.handleAutostoreChange(change.configPath, change.value);
            }
        }
    }

    private async handleProfileRenames(renames: Array<{ originalKey: string; newKey: string; configPath: string }>): Promise<void> {
        if (!renames || renames.length === 0) {
            return;
        }

        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
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
        const updatedRenames = this.profileOperations.updateRenameKeysForParentChanges(sortedRenames);

        // Remove duplicate renames that target the same final key
        const finalRenames = this.profileOperations.removeDuplicateRenames(updatedRenames);

        // Filter out no-op renames (where originalKey === newKey)
        const filteredRenames = finalRenames.filter((rename) => rename.originalKey !== rename.newKey);

        // Apply renames to configuration files first, then get team config
        for (const rename of filteredRenames) {
            try {
                // Pre-validate the rename operation before making any changes
                let originalPath: string;
                let newPath: string;

                try {
                    originalPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.originalKey);
                    newPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.newKey);
                } catch (pathError) {
                    const pathErrorMessage = pathError instanceof Error ? pathError.message : String(pathError);
                    vscode.window.showErrorMessage(
                        `Invalid profile path for rename '${rename.originalKey}' to '${rename.newKey}': ${pathErrorMessage}`
                    );
                    continue; // Skip this rename and continue with others
                }

                // Check for circular reference BEFORE making any changes
                if (this.profileOperations.wouldCreateCircularReference(rename.originalKey, rename.newKey)) {
                    const errorMessage = `Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Would create circular reference`;
                    vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
                    throw new Error(`Critical error during profile rename: ${errorMessage}`);
                }

                // Get fresh team config for this rename to avoid stale references
                const teamConfig = profInfo.getTeamConfig();
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
                    this.profileOperations.validateConfigMoveAPI(configMoveAPI, layerActive);
                } catch (validationError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(
                        validationError,
                        "validate ConfigMoveAPI",
                        rename.originalKey,
                        rename.newKey
                    );
                    vscode.window.showErrorMessage(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                try {
                    // Check if this is a nested profile creation (e.g., 'tso' -> 'tso.asdf')
                    if (this.profileOperations.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
                        this.profileOperations.createNestedProfileStructure(
                            configMoveAPI,
                            layerActive,
                            originalPath,
                            newPath,
                            rename.originalKey,
                            rename.newKey
                        );
                    } else {
                        moveProfile(configMoveAPI, layerActive, originalPath, newPath);
                    }
                } catch (moveError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(moveError, "move profile", originalPath, newPath);

                    // Check if this is a critical error that should cancel the entire save operation
                    if (this.profileOperations.isCriticalMoveError(moveError)) {
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
                    const errorMessage = this.profileOperations.handleMoveUtilsError(
                        defaultsError,
                        "update defaults",
                        rename.originalKey,
                        rename.newKey
                    );
                    // Log the error but don't fail the entire rename operation
                    console.warn(errorMessage);
                }

                // Save changes immediately after each rename to avoid stale references
                await teamConfig.save();

                // Refresh ProfileInfo to pick up the changes
                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Check if this is a critical error that should cancel the entire save operation
                if (this.profileOperations.isCriticalMoveError(error)) {
                    // Re-throw critical errors so they can be caught by the outer try-catch block
                    throw error;
                }

                vscode.window.showErrorMessage(
                    `Unexpected error renaming profile from '${rename.originalKey}' to '${rename.newKey}': ${errorMessage}`
                );
                // Don't throw the error - continue with other renames
            }
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
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        const updatedMessage = { ...message };

        // Create a map of all renames for easier lookup
        const renameMap = new Map<string, { oldKey: string; newKey: string; configPath: string }>();
        renames.forEach((rename) => {
            renameMap.set(rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath });
        });

        // Update changes
        if (updatedMessage.changes) {
            updatedMessage.changes = updatedMessage.changes.map((change: any) => {
                if (change.configPath) {
                    let updatedChange = { ...change };

                    // Update the profile field
                    if (updatedChange.profile) {
                        updatedChange.profile = ConfigEditorPathUtils.getNewProfilePath(updatedChange.profile, change.configPath, renameMap);
                    }

                    // Update the key field
                    updatedChange = ConfigEditorPathUtils.updateChangeKey(updatedChange, change.configPath, renameMap);

                    // Update the path array
                    updatedChange = ConfigEditorPathUtils.updateChangePath(updatedChange, change.configPath, renameMap);

                    return updatedChange;
                }
                return change;
            });
        }

        // Update profile deletions to use new names
        if (updatedMessage.deletions) {
            updatedMessage.deletions = updatedMessage.deletions.map((deletion: any) => {
                if (deletion.configPath) {
                    let updatedDeletion = { ...deletion };

                    // Update the profile field
                    if (updatedDeletion.profile) {
                        updatedDeletion.profile = ConfigEditorPathUtils.getNewProfilePath(updatedDeletion.profile, deletion.configPath, renameMap);
                    }

                    // Update the key field
                    updatedDeletion = ConfigEditorPathUtils.updateChangeKey(updatedDeletion, deletion.configPath, renameMap);

                    // Update the path array
                    updatedDeletion = ConfigEditorPathUtils.updateChangePath(updatedDeletion, deletion.configPath, renameMap);

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
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
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

        const activateLayer = teamConfig.layers.find((layer) => layer.path === configPath);
        if (activateLayer) {
            teamConfig.api.layers.activate(activateLayer.user, activateLayer.global);
        }

        let mergedArgs;
        try {
            mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        } catch (error) {
            console.warn(`Failed to load schema for profile type "${profile.profType}": ${error.message}`);
            return;
        }

        if (mergedArgs.knownArgs) {
            mergedArgs.knownArgs.forEach((arg) => {
                if (arg.argLoc && arg.argLoc.osLoc && arg.argLoc.jsonLoc) {
                    // Check if this specific field path is secure, respecting layer precedence
                    // Layers are ordered by precedence: project (highest) -> user -> global (lowest)
                    // We need to find the first layer that has a definition for this field
                    let isSecure = false;
                    let fieldFound = false;

                    // Sort layers by precedence (user layers override global layers)
                    const sortedLayers = [...teamConfig.layers].sort((a, b) => {
                        // User layers have higher precedence than global layers
                        if (a.user && !b.user) return -1;
                        if (!a.user && b.user) return 1;
                        // If both are same type, maintain original order
                        return 0;
                    });

                    for (const layer of sortedLayers) {
                        const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });

                        // Check if this layer has the field defined (either as secure or insecure)
                        // We need to check if the field exists in this layer's properties
                        const layerHasField = this.layerHasField(layer, arg.argLoc.jsonLoc);

                        if (layerHasField) {
                            fieldFound = true;
                            // If the field is in the secure array, it's secure
                            isSecure = secFields.includes(arg.argLoc.jsonLoc);
                            break; // Use the first layer that has this field
                        }
                    }

                    // If no layer explicitly defines this field, check if it's secure in any layer
                    if (!fieldFound) {
                        for (const layer of teamConfig.layers) {
                            const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });
                            if (secFields.includes(arg.argLoc.jsonLoc)) {
                                isSecure = true;
                                break;
                            }
                        }
                    }

                    if (isSecure) {
                        arg.secure = true;
                    }
                }
            });
        }
        const redacted = this.profileOperations.redactSecureValues(mergedArgs.knownArgs);
        return redacted;
    }

    /**
     * Check if a layer has a specific field defined in its properties
     * @param layer - The configuration layer to check
     * @param jsonLoc - The JSON location path of the field
     * @returns true if the layer has this field defined
     */
    private layerHasField(layer: any, jsonLoc: string): boolean {
        if (!layer.properties || !layer.properties.profiles) {
            return false;
        }

        // Parse the jsonLoc to find the field in the layer's properties
        // jsonLoc format is typically like "profiles.profileName.properties.fieldName"
        const pathParts = jsonLoc.split(".");

        if (pathParts.length < 4 || pathParts[0] !== "profiles") {
            return false;
        }

        const profileName = pathParts[1];
        const profile = layer.properties.profiles[profileName];

        if (!profile || !profile.properties) {
            return false;
        }

        // Check if the field exists in the profile's properties
        const fieldName = pathParts[pathParts.length - 1];
        return fieldName in profile.properties;
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
        const updatedRenames = this.profileOperations.updateRenameKeysForParentChanges(sortedRenames);

        // Remove duplicate renames that target the same final key
        const finalRenames = this.profileOperations.removeDuplicateRenames(updatedRenames);

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
                    originalPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.originalKey);
                    newPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.newKey);
                } catch (pathError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(
                        pathError,
                        "construct profile path",
                        rename.originalKey,
                        rename.newKey,
                        true
                    );
                    console.warn(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                // Validate ConfigMoveAPI before use
                try {
                    this.profileOperations.validateConfigMoveAPI(configMoveAPI, layerActive);
                } catch (validationError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(
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
                    if (this.profileOperations.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
                        this.profileOperations.createNestedProfileStructure(
                            configMoveAPI,
                            layerActive,
                            originalPath,
                            newPath,
                            rename.originalKey,
                            rename.newKey
                        );
                    } else {
                        moveProfile(configMoveAPI, layerActive, originalPath, newPath);
                    }
                } catch (moveError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(moveError, "simulate move profile", originalPath, newPath, true);
                    console.warn(errorMessage);
                    continue; // Skip this rename and continue with others
                }

                // Simulate defaults updates for this rename
                try {
                    simulateDefaultsUpdateAfterRename(() => teamConfig.api.layers.get(), rename.originalKey, rename.newKey);
                } catch (defaultsError) {
                    const errorMessage = this.profileOperations.handleMoveUtilsError(
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

        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
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

            // Apply the same secure field precedence logic as in getPendingMergedArgsForProfile
            if (mergedArgs.knownArgs) {
                mergedArgs.knownArgs.forEach((arg) => {
                    if (arg.argLoc && arg.argLoc.osLoc && arg.argLoc.jsonLoc) {
                        // Check if this specific field path is secure, respecting layer precedence
                        // Layers are ordered by precedence: project (highest) -> user -> global (lowest)
                        // We need to find the first layer that has a definition for this field
                        let isSecure = false;
                        let fieldFound = false;

                        // Sort layers by precedence (user layers override global layers)
                        const sortedLayers = [...teamConfig.layers].sort((a, b) => {
                            // User layers have higher precedence than global layers
                            if (a.user && !b.user) return -1;
                            if (!a.user && b.user) return 1;
                            // If both are same type, maintain original order
                            return 0;
                        });

                        for (const layer of sortedLayers) {
                            const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });

                            // Check if this layer has the field defined (either as secure or insecure)
                            // We need to check if the field exists in this layer's properties
                            const layerHasField = this.layerHasField(layer, arg.argLoc.jsonLoc);

                            if (layerHasField) {
                                fieldFound = true;
                                // If the field is in the secure array, it's secure
                                isSecure = secFields.includes(arg.argLoc.jsonLoc);
                                break; // Use the first layer that has this field
                            }
                        }

                        // If no layer explicitly defines this field, check if it's secure in any layer
                        if (!fieldFound) {
                            for (const layer of teamConfig.layers) {
                                const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });
                                if (secFields.includes(arg.argLoc.jsonLoc)) {
                                    isSecure = true;
                                    break;
                                }
                            }
                        }

                        if (isSecure) {
                            arg.secure = true;
                        }
                    }
                });
            }

            const redacted = this.profileOperations.redactSecureValues(mergedArgs.knownArgs);
            return redacted || [];
        } finally {
            try {
                teamConfig.delete(tempProfilePath);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }
}
