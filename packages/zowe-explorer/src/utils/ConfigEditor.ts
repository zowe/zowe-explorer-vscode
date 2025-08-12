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
import * as vscode from "vscode";
import { ProfileInfo, Config, ConfigBuilder, ConfigSchema } from "@zowe/imperative";
import * as path from "path";
import * as fs from "fs";
import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
type ChangeEntry = {
    key: string;
    value: string;
    path: string[];
    profile?: string;
    configPath: string;
    secure: boolean;
};

type LayerModifications = {
    configPath: string;
    changes: ChangeEntry[];
    deletions: ChangeEntry[];
    defaultsChanges: ChangeEntry[];
    defaultsDeleteKeys: ChangeEntry[];
};

export type schemaValidation = {
    propertySchema: Record<string, Record<string, { type?: string; description?: string }>>;
    validDefaults: string[];
};

type ArrayField = "changes" | "deletions" | "defaultsChanges" | "defaultsDeleteKeys";

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
            viewColumn: vscode.ViewColumn.One,
        });

        this.panel.reveal(vscode.ViewColumn.One, false);

        vscode.commands.executeCommand("workbench.action.keepEditor");

        this.panel.onDidDispose(() => {});
    }

    protected async getLocalConfigs(): Promise<any[]> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const layers = profInfo.getTeamConfig().layers;

        const allConfigs: {
            configPath: string;
            properties: any;
            schema?: any;
            schemaValidation?: schemaValidation;
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

                        // Process profiles recursively to handle nested profiles
                        this.processProfilesRecursively(layer.properties.profiles);

                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema,
                            schemaValidation,
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
                    vscode.window.showErrorMessage(`Error reading or parsing file ${configPath}:`);
                }
            }
        }

        return allConfigs;
    }

    private processProfilesRecursively(profiles: any): void {
        if (!profiles || typeof profiles !== "object") {
            return;
        }

        for (const profileName in profiles) {
            const profile = profiles[profileName];

            // Handle secure properties for current profile
            if (profile.secure && profile.properties) {
                const secureKeys = profile.secure;
                profile.properties = Object.fromEntries(Object.entries(profile.properties).filter(([key]) => !secureKeys.includes(key)));
            }

            // Recursively process nested profiles
            if (profile.profiles) {
                this.processProfilesRecursively(profile.profiles);
            }
        }
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        switch (message.command.toLocaleUpperCase()) {
            case "GET_PROFILES": {
                const configurations = await this.getLocalConfigs();
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: configurations,
                });
                break;
            }
            case "SAVE_CHANGES": {
                const parsedChanges = this.parseConfigChanges(message);
                for (const change of parsedChanges) {
                    if (change.defaultsChanges || change.defaultsDeleteKeys) {
                        await this.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath);
                    }

                    if (change.changes || change.deletions) {
                        await this.handleProfileChanges(change.changes, change.deletions, change.configPath);
                    }
                }
                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
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
            case "GET_ENV_INFORMATION": {
                const hasWorkspace = ZoweVsCodeExtension.workspaceRoot != null;
                await this.panel.webview.postMessage({
                    command: "ENV_INFORMATION",
                    hasWorkspace: hasWorkspace,
                });
                break;
            }
            case "OPEN_CONFIG_FILE_WITH_PROFILE": {
                try {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
                    const editor = await vscode.window.showTextDocument(document);

                    // Find and place cursor at the beginning of the profile in the JSON file
                    const profileKey = message.profileKey;
                    const text = document.getText();
                    const lines = text.split("\n");

                    // Handle nested profiles by splitting the profile key
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
                        // Count global braces
                        for (const char of line) {
                            if (char === "{") {
                                globalBraceCount++;
                            }
                            if (char === "}") {
                                globalBraceCount--;
                            }
                        }
                        // Check if we're entering the profiles section
                        if (trimmedLine.includes('"profiles"')) {
                            if (!inTargetProfile) {
                                // Main profiles section
                                inProfilesSection = true;
                                profileDepth = 0;
                                inTargetProfile = false;
                                targetProfileBraceCount = 0;
                            } else {
                                // Nested profiles section within a target profile
                                profileDepth++;
                                inTargetProfile = false;
                                targetProfileBraceCount = 0;
                            }
                            continue;
                        }
                        if (inProfilesSection) {
                            // If we're inside a target profile, track its brace count
                            if (inTargetProfile) {
                                for (const char of line) {
                                    if (char === "{") {
                                        targetProfileBraceCount++;
                                    }
                                    if (char === "}") {
                                        targetProfileBraceCount--;
                                    }
                                }

                                // Check if we found a profile within the target profile
                                const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                                if (profileMatch) {
                                    const foundProfileName = profileMatch[1];

                                    // Check if this is the profile we're looking for at the current depth
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
                                // If we exit the target profile, reset
                                if (targetProfileBraceCount === 0) {
                                    inTargetProfile = false;
                                    profileDepth = 0;
                                }
                            } else {
                                // Check if we found a profile (any profile)
                                const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                                if (profileMatch) {
                                    const foundProfileName = profileMatch[1];

                                    // Check if this is the profile we're looking for at the current depth
                                    if (profileParts[profileDepth] === foundProfileName) {
                                        if (profileDepth === profileParts.length - 1) {
                                            // This is the final profile we're looking for
                                            foundProfile = true;
                                            currentLine = i;
                                            // Find the column position at the end of the profile name
                                            const profileNameIndex = line.indexOf(`"${foundProfileName}"`);
                                            currentColumn = profileNameIndex >= 0 ? profileNameIndex + foundProfileName.length + 2 : 0;
                                            break;
                                        } else {
                                            // This is a nested profile, start tracking within this profile
                                            inTargetProfile = true;
                                            targetProfileBraceCount = 1; // Start with 1 for the opening brace
                                            continue;
                                        }
                                    }
                                }
                            }
                            // If we exit the profiles section, reset
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
            case "PREVIEW_ARGS": {
                const mergedArgs = await this.getMergedArgsForProfile(message.profilePath, message.configPath);
                await this.panel.webview.postMessage({
                    command: "PREVIEW_ARGS",
                    mergedArgs,
                });
                break;
            }
            case "GET_MERGED_PROPERTIES": {
                const mergedArgs = await this.getPendingMergedArgsForProfile(message.profilePath, message.configPath, message.changes);
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
                    message.changes
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

                    // Check for existing configuration and handle conflicts
                    const existingFile = await this.checkExistingConfig(rootPath, user);
                    if (existingFile === false) {
                        // User cancelled the operation
                        return;
                    }
                    if (existingFile != null) {
                        user = existingFile.includes("user");
                    }

                    // Load the configuration
                    const config = await Config.load("zowe", {
                        homeDir: FileManagement.getZoweDir(),
                        projectDir: FileManagement.getFullPath(rootPath),
                    });

                    // Activate the appropriate layer
                    if (ZoweVsCodeExtension.workspaceRoot != null) {
                        config.api.layers.activate(user, global, rootPath);
                    }

                    // Get known CLI configurations
                    const knownCliConfig: any[] = (ZoweVsCodeExtension as any).profilesCache.getCoreProfileTypes();
                    knownCliConfig.push(...(ZoweVsCodeExtension as any).profilesCache.getConfigArray());
                    knownCliConfig.push(ProfileConstants.BaseProfile);
                    config.setSchema(ConfigSchema.buildSchema(knownCliConfig));

                    // Build options for configuration creation
                    const opts: any = {
                        populateProperties: true,
                    };

                    // Build new config and merge with existing layer
                    const impConfig: any = {
                        profiles: [...knownCliConfig],
                        baseProfile: ProfileConstants.BaseProfile,
                    };
                    const newConfig: any = await ConfigBuilder.build(impConfig, global, opts);

                    // Merge and save the configuration
                    config.api.layers.merge(newConfig);
                    await config.save(false);

                    // Get the config file name
                    let configName;
                    if (user) {
                        configName = config.userConfigName;
                    } else {
                        configName = config.configName;
                    }

                    // Open the config file
                    await ZoweVsCodeExtension.openConfigFile(path.join(rootPath, configName));

                    // Refresh the configurations in the webview
                    await this.panel.webview.postMessage({
                        command: "CONFIGURATIONS",
                        contents: await this.getLocalConfigs(),
                    });
                } catch (error) {
                    vscode.window.showErrorMessage("Error creating new configuration");
                }
                break;
            }
            default:
                break;
        }
    }

    private async handleDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        if (activeLayer !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === activeLayer);
            if (findProfile) {
                profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of changes) {
            profInfo.getTeamConfig().api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            profInfo.getTeamConfig().delete(`defaults.${deletion.key}`);
        }
        await profInfo.getTeamConfig().save();
    }

    private async handleProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        for (const item of changes) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }

            if (item.profile) {
                const profileParts = item.profile.split(".");
                if (profileParts[profileParts.length - 2] === "secure") {
                    profileParts[profileParts.length - 2] = "properties";
                    item.profile = profileParts.join(".");
                }
            }
        }

        for (const item of deletions) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }
        }

        if (configPath !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === configPath);
            if (findProfile) {
                profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of changes) {
            try {
                profInfo.getTeamConfig().set(change.key, change.value, { parseString: true, secure: change.secure });
            } catch (err) {
                // console.log(err);
            }
        }

        for (const deletion of deletions) {
            try {
                profInfo.getTeamConfig().delete(deletion.key);
            } catch (err) {
                // console.log(err);
            }
        }
        await profInfo.getTeamConfig().save();
    }

    private parseConfigChanges(data: LayerModifications): LayerModifications[] {
        const groups: Record<string, LayerModifications> = {};

        const addToGroup = (items: ChangeEntry[], field: ArrayField): any => {
            for (const item of items) {
                const configPath = item.configPath;
                if (!groups[configPath]) {
                    groups[configPath] = {
                        configPath,
                        changes: [],
                        deletions: [],
                        defaultsChanges: [],
                        defaultsDeleteKeys: [],
                    };
                }
                groups[configPath][field].push(item);
            }
        };

        addToGroup(data.changes || [], "changes");
        addToGroup(data.deletions || [], "deletions");
        addToGroup(data.defaultsChanges || [], "defaultsChanges");
        addToGroup(data.defaultsDeleteKeys || [], "defaultsDeleteKeys");

        return Object.values(groups);
    }

    private generateSchemaValidation(schema: any): schemaValidation {
        const propertySchema: Record<string, Record<string, { type?: string; description?: string }>> = {};
        const allOf = schema.properties.profiles.patternProperties["^\\S*$"].allOf;

        for (const rule of allOf) {
            const profileType = rule?.if?.properties?.type?.const;
            const properties = rule?.then?.properties?.properties?.properties;

            if (profileType && properties) {
                propertySchema[profileType] = Object.keys(properties).reduce((acc, key) => {
                    acc[key] = {
                        type: properties[key].type,
                        description: properties[key].description,
                    };
                    return acc;
                }, {} as Record<string, { type?: string; description?: string }>);
            }
        }

        return {
            validDefaults: Object.keys(schema.properties.defaults.properties) ?? undefined,
            propertySchema,
        };
    }

    // WIP
    private async getMergedArgsForProfile(profPath: string, configPath: string): Promise<any> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const allProfiles = profInfo.getAllProfiles();
        const profile = allProfiles.find((prof) => prof.profName === profPath && prof.profLoc.osLoc?.includes(path.normalize(configPath)));
        if (!profile) {
            return;
        }
        const mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        return mergedArgs.knownArgs;
    }
    private async getPendingMergedArgsForProfile(profPath: string, configPath: string, changes: any): Promise<any> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        // Create a copy of the team config to simulate changes without affecting the original
        const teamConfig = profInfo.getTeamConfig();

        // Apply changes to simulate pending modifications
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
        const profile = allProfiles.find((prof) => prof.profName === profPath && prof.profLoc.osLoc?.includes(path.normalize(configPath)));
        if (!profile) {
            return;
        }

        const mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        return mergedArgs.knownArgs;
    }

    private simulateDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string, teamConfig: any): void {
        if (activeLayer !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: any) => prof.path === activeLayer);
            teamConfig.api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            teamConfig.api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            teamConfig.delete(`defaults.${deletion.key}`);
        }
    }

    private simulateProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string, teamConfig: any): void {
        for (const item of changes) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }
            if (item.profile) {
                const profileParts = item.profile.split(".");
                if (profileParts[profileParts.length - 2] === "secure") {
                    profileParts[profileParts.length - 2] = "properties";
                    item.profile = profileParts.join(".");
                }
            }
        }

        for (const item of deletions) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }
        }

        if (configPath !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: any) => prof.path === configPath);
            teamConfig.api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            try {
                teamConfig.set(change.key, change.value, { parseString: true, secure: change.secure });
            } catch (err) {
                // console.log(err);
            }
        }

        for (const deletion of deletions) {
            try {
                teamConfig.delete(deletion.key);
            } catch (err) {
                // console.log(err);
            }
        }
    }

    private async getWizardMergedProperties(rootProfile: string, profileType: string, configPath: string, changes?: any): Promise<any> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        const teamConfig = profInfo.getTeamConfig();

        // Apply pending changes if provided
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

        if (rootProfile === "root") {
            if (profileType) {
                // Create a temporary profile instance with the type
                const tempProfileName = `temp_${Date.now()}`;
                const profilePath = `profiles.${tempProfileName}`;

                // Set the type for the temporary profile
                teamConfig.set(`${profilePath}.type`, profileType, { parseString: true });

                // Get the merged args for this temporary profile
                const allProfiles = profInfo.getAllProfiles();
                const tempProfile = allProfiles.find((prof) => prof.profName === tempProfileName);

                if (tempProfile) {
                    const mergedArgs = profInfo.mergeArgsForProfile(tempProfile, { getSecureVals: true });
                    return mergedArgs.knownArgs || [];
                }
            }
        } else {
            // Find the specified root profile
            const allProfiles = profInfo.getAllProfiles();
            const rootProfileInstance = allProfiles.find(
                (prof) => prof.profName === rootProfile && prof.profLoc.osLoc?.includes(path.normalize(configPath))
            );

            if (!rootProfileInstance) {
                return [];
            }

            // Get merged properties for the root profile
            const mergedArgs = profInfo.mergeArgsForProfile(rootProfileInstance, { getSecureVals: true });
            return mergedArgs.knownArgs || [];
        }
    }

    private async checkExistingConfig(filePath: string, user: boolean): Promise<string | false | null> {
        const existingLayers = await ZoweVsCodeExtension.getConfigLayers();

        // Check for both zowe.config.json and zowe.config.user.json in the directory
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
