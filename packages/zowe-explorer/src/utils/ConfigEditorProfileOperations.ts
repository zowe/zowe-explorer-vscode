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

import * as vscode from "vscode";
import type { Config, IConfigLayer as ImperativeConfigLayer, ProfileInfo } from "@zowe/imperative";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { ConfigMoveAPI, IConfigLayer } from "../webviews/src/config-editor/types";
import { updateDefaultsAfterRename, simulateDefaultsUpdateAfterRename } from "../webviews/src/config-editor/utils/moveUtils";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";
import { FavoritePersistenceUtils } from "./FavoritePersistenceUtils";
import { Profiles } from "../configuration/Profiles";
import type {
    LayerChangesPayload,
    NestedProfilesMap,
    PendingChangesByConfig,
    ProfileRenameEntry,
    ProfileTreeNode,
    RenameMapByConfig,
} from "./ConfigTypes";

export type ValidateProfileNameOptions = {
    profileName: string;
    rootProfile: string;
    configPath: string;
    profiles: NestedProfilesMap;
    pendingChanges: PendingChangesByConfig;
    renames: RenameMapByConfig;
};

export class ConfigEditorProfileOperations {
    /**
     * Validates if a profile name is available for creation
     */
    validateProfileName(options: ValidateProfileNameOptions): { isValid: boolean; message?: string } {
        const { profileName, rootProfile, configPath, profiles, pendingChanges, renames } = options;
        if (!profileName.trim()) {
            return { isValid: true };
        }

        const flatProfiles = ConfigUtils.flattenProfiles(profiles);
        const newProfileKey = rootProfile === "root" ? profileName.trim() : `${rootProfile}.${profileName.trim()}`;

        const existingProfilesUnderRoot = Object.keys(flatProfiles).some((profileKey) => {
            if (rootProfile === "root") {
                return profileKey === profileName.trim();
            } else {
                return profileKey === `${rootProfile}.${profileName.trim()}` || profileKey.startsWith(`${rootProfile}.${profileName.trim()}.`);
            }
        });

        if (existingProfilesUnderRoot) {
            return { isValid: false, message: "Profile name already exists under this root" };
        }

        const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
            if (entry.profile) {
                if (rootProfile === "root") {
                    return entry.profile === profileName.trim();
                } else {
                    return (
                        entry.profile === `${rootProfile}.${profileName.trim()}` || entry.profile.startsWith(`${rootProfile}.${profileName.trim()}.`)
                    );
                }
            }
            return false;
        });

        if (pendingProfilesUnderRoot) {
            return { isValid: false, message: "Profile name already exists in pending changes" };
        }

        const renamesForConfig = renames[configPath] || {};
        const renameIsOccupyingName = Object.entries(renamesForConfig).some(([, newName]) => {
            if (newName === newProfileKey) {
                return true;
            }
            if (newProfileKey.startsWith(newName + ".")) {
                return true;
            }
            if (newName.startsWith(newProfileKey + ".")) {
                return true;
            }
            return false;
        });

        if (renameIsOccupyingName) {
            return { isValid: false, message: "Profile name conflicts with a renamed profile" };
        }

        return { isValid: true };
    }

    /**
     * Updates rename keys to handle both parent-first and child-first rename scenarios.
     */
    updateRenameKeysForParentChanges(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const updatedRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];

        const renamesByConfigPath = new Map<string, Array<{ originalKey: string; newKey: string; configPath: string }>>();

        for (const rename of renames) {
            if (!renamesByConfigPath.has(rename.configPath)) {
                renamesByConfigPath.set(rename.configPath, []);
            }
            renamesByConfigPath.get(rename.configPath)!.push(rename);
        }

        for (const [configPath, configRenames] of renamesByConfigPath) {
            const processedRenames = new Map<string, string>();

            const allRenames = new Map<string, string>();
            for (const rename of configRenames) {
                allRenames.set(rename.originalKey, rename.newKey);
            }

            for (const rename of configRenames) {
                let updatedOriginalKey = rename.originalKey;
                let updatedNewKey = rename.newKey;

                const originalParts = rename.originalKey.split(".");
                const newParts = rename.newKey.split(".");

                for (let i = 0; i < originalParts.length; i++) {
                    const parentPath = originalParts.slice(0, i + 1).join(".");
                    if (processedRenames.has(parentPath)) {
                        const newParentPath = processedRenames.get(parentPath)!;
                        const remainingParts = originalParts.slice(i + 1);
                        updatedOriginalKey = remainingParts.length > 0 ? `${newParentPath}.${remainingParts.join(".")}` : newParentPath;
                        break;
                    }
                }

                for (let i = 0; i < newParts.length; i++) {
                    const parentPath = newParts.slice(0, i + 1).join(".");
                    if (processedRenames.has(parentPath)) {
                        const newParentPath = processedRenames.get(parentPath)!;
                        const remainingParts = newParts.slice(i + 1);
                        updatedNewKey = remainingParts.length > 0 ? `${newParentPath}.${remainingParts.join(".")}` : newParentPath;
                        break;
                    }
                }

                if (originalParts.length === 1) {
                    const parentOriginalKey = rename.originalKey;
                    const parentNewKey = rename.newKey;

                    for (let i = 0; i < updatedRenames.length; i++) {
                        const childRename = updatedRenames[i];

                        if (childRename.configPath !== configPath) {
                            continue;
                        }

                        const childOriginalParts = childRename.originalKey.split(".");
                        const childNewParts = childRename.newKey.split(".");

                        // Check if child is an extraction (moving OUT of the parent entirely)
                        const staysUnderOldParent =
                            childRename.newKey.startsWith(parentOriginalKey + ".") || childRename.newKey === parentOriginalKey;
                        const movesToUnderNewParent = childRename.newKey.startsWith(parentNewKey + ".") || childRename.newKey === parentNewKey;
                        const isExtraction = !staysUnderOldParent && !movesToUnderNewParent;
                        const childOriginalStartsWithParent = childOriginalParts.length > 1 && childOriginalParts[0] === parentOriginalKey;

                        if (childOriginalStartsWithParent && isExtraction) {
                            // For extractions, don't update the keys - the extraction is sorted first
                            continue;
                        }

                        const childStartsWithParent =
                            childOriginalStartsWithParent || (childNewParts.length > 1 && childNewParts[0] === parentOriginalKey);

                        if (childStartsWithParent) {
                            let updatedChildOriginalKey = childRename.originalKey;
                            if (childOriginalStartsWithParent) {
                                const childRemainingParts = childOriginalParts.slice(1);
                                updatedChildOriginalKey = `${parentNewKey}.${childRemainingParts.join(".")}`;
                            }

                            let updatedChildNewKey = childRename.newKey;
                            if (childNewParts.length > 1 && childNewParts[0] === parentOriginalKey) {
                                const childNewRemainingParts = childNewParts.slice(1);
                                updatedChildNewKey = `${parentNewKey}.${childNewRemainingParts.join(".")}`;
                            }

                            updatedRenames[i] = {
                                originalKey: updatedChildOriginalKey,
                                newKey: updatedChildNewKey,
                                configPath: childRename.configPath,
                            };
                        }
                    }
                }

                updatedRenames.push({
                    originalKey: updatedOriginalKey,
                    newKey: updatedNewKey,
                    configPath: rename.configPath,
                });

                processedRenames.set(updatedOriginalKey, updatedNewKey);
            }
        }

        return updatedRenames;
    }

    /**
     * Removes duplicate renames that target the same final key
     */
    removeDuplicateRenames(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const finalRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];

        const renamesByConfigPath = new Map<string, Array<{ originalKey: string; newKey: string; configPath: string }>>();

        for (const rename of renames) {
            if (!renamesByConfigPath.has(rename.configPath)) {
                renamesByConfigPath.set(rename.configPath, []);
            }
            renamesByConfigPath.get(rename.configPath)!.push(rename);
        }

        for (const [, configRenames] of renamesByConfigPath) {
            const seenTargets = new Map<string, { originalKey: string; newKey: string; configPath: string }>();

            for (const rename of configRenames) {
                const targetKey = rename.newKey;
                const renameTail = rename.originalKey.split(".").pop()!;

                if (seenTargets.has(targetKey)) {
                    const existing = seenTargets.get(targetKey)!;
                    const existingTail = existing.originalKey.split(".").pop()!;

                    if (renameTail === existingTail) {
                        finalRenames.push(rename);
                        continue;
                    }

                    if (rename.originalKey.split(".").length < existing.originalKey.split(".").length) {
                        const index = finalRenames.findIndex((r) => r === existing);
                        if (index !== -1) {
                            finalRenames[index] = rename;
                            seenTargets.set(targetKey, rename);
                        }
                    }
                } else {
                    finalRenames.push(rename);
                    seenTargets.set(targetKey, rename);
                }
            }
        }

        return finalRenames;
    }

    /**
     * Checks if a profile rename would create a circular reference
     */
    wouldCreateCircularReference(originalKey: string, newKey: string): boolean {
        if (!newKey.startsWith(originalKey + ".")) {
            return false;
        }
        const childPart = newKey.substring(originalKey.length + 1);
        if (childPart.includes(originalKey)) {
            return true;
        }

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
     */
    isNestedProfileCreation(originalKey: string, newKey: string): boolean {
        // 1. The new key starts with the original key + "."
        // 2. The original key is a single-level profile (no dots)
        return newKey.startsWith(originalKey + ".") && !originalKey.includes(".");
    }

    /**
     * Creates a nested profile structure when renaming a profile to create a parent-child relationship
     */
    createNestedProfileStructure(
        configMoveAPI: ConfigMoveAPI,
        layerActive: () => IConfigLayer,
        originalPath: string,
        newPath: string,
        originalKey: string,
        newKey: string
    ): void {
        const originalProfile = configMoveAPI.get(originalPath);
        if (!originalProfile) {
            throw new Error(`Source profile not found at path: ${originalPath}`);
        }

        const childProfileName = newKey.substring(originalKey.length + 1);

        const newParentProfile = {
            ...originalProfile,
            profiles: {
                [childProfileName]: originalProfile,
            },
        };

        const childProfile = { ...originalProfile };
        delete childProfile.profiles;
        configMoveAPI.set(originalPath, newParentProfile);
        const childPath = `${originalPath}.profiles.${childProfileName}`;
        configMoveAPI.set(childPath, childProfile);

        this.moveSecurePropertiesForNestedProfile(configMoveAPI, originalPath, childPath);
    }

    /**
     * Moves secure properties for nested profile creation
     */
    private moveSecurePropertiesForNestedProfile(configMoveAPI: ConfigMoveAPI, parentPath: string, childPath: string): void {
        try {
            const originalProfile = configMoveAPI.get(parentPath);
            const secureProperties = originalProfile?.secure || [];

            if (secureProperties.length > 0) {
                const childProfile = configMoveAPI.get(childPath);
                if (childProfile) {
                    configMoveAPI.set(`${childPath}.secure`, secureProperties);
                }

                const parentProfile = configMoveAPI.get(parentPath);
                if (parentProfile && parentProfile.secure) {
                    delete parentProfile.secure;
                    configMoveAPI.set(parentPath, parentProfile);
                }
            }
        } catch (error) {
            console.warn(`Failed to move secure properties for nested profile creation: ${error}`);
        }
    }

    /**
     * Validates the ConfigMoveAPI before calling MoveUtils functions
     */
    validateConfigMoveAPI(configMoveAPI: ConfigMoveAPI, layerActive: () => IConfigLayer): void {
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
     */
    handleMoveUtilsError(error: unknown, operation: string, originalKey: string, newKey: string, isSimulation: boolean = false): string {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const simulationPrefix = isSimulation ? "Simulation failed for " : "";
        return `${simulationPrefix}${operation} from '${originalKey}' to '${newKey}': ${errorMessage}`;
    }

    isCriticalMoveError(error: unknown): boolean {
        const errorMessage = error instanceof Error ? error.message : String(error);

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
     * Redacts secure values from profile data
     */
    redactSecureValues(knownArgs: unknown): unknown {
        if (!knownArgs || typeof knownArgs !== "object") {
            return knownArgs;
        }

        // Handle array case
        if (Array.isArray(knownArgs)) {
            return knownArgs.map((item) => {
                if (item && typeof item === "object" && "secure" in item && item.secure === true) {
                    const redactedItem = { ...item };

                    if ("argValue" in redactedItem && redactedItem.argValue != null) {
                        redactedItem.argValue = "REDACTED";
                    } else if ("value" in redactedItem && redactedItem.value != null) {
                        redactedItem.value = "REDACTED";
                    }

                    return redactedItem;
                } else {
                    return this.redactSecureValues(item);
                }
            });
        }

        const redacted = { ...knownArgs };
        for (const [key, value] of Object.entries(redacted)) {
            if (value && typeof value === "object") {
                if ("secure" in value && value.secure === true) {
                    const redactedValue = { ...value };

                    if ("argValue" in redactedValue && redactedValue.argValue != null) {
                        redactedValue.argValue = "REDACTED";
                    } else if ("value" in redactedValue && redactedValue.value != null) {
                        redactedValue.value = "REDACTED";
                    }

                    redacted[key] = redactedValue;
                } else {
                    redacted[key] = this.redactSecureValues(value);
                }
            }
        }
        return redacted;
    }

    /**
     * Sorts renames so that parent-of renames are processed before extractions, and shallower
     * target depths are applied before deeper ones.
     */
    sortRenamesByDepth(renames: ProfileRenameEntry[]): ProfileRenameEntry[] {
        return [...renames].sort((a, b) => {
            const aIsParentOfB = b.originalKey.startsWith(a.originalKey + ".");
            const bIsParentOfA = a.originalKey.startsWith(b.originalKey + ".");

            if (aIsParentOfB) {
                // B is an extraction if its new location is NOT under A's old OR new location
                const bStaysUnderAOld = b.newKey.startsWith(a.originalKey + ".") || b.newKey === a.originalKey;
                const bMovesToUnderANew = b.newKey.startsWith(a.newKey + ".") || b.newKey === a.newKey;
                const bIsExtraction = !bStaysUnderAOld && !bMovesToUnderANew;
                if (bIsExtraction) {
                    return 1;
                }
            }

            if (bIsParentOfA) {
                // A is an extraction if its new location is NOT under B's old OR new location
                const aStaysUnderBOld = a.newKey.startsWith(b.originalKey + ".") || a.newKey === b.originalKey;
                const aMovesToUnderBNew = a.newKey.startsWith(b.newKey + ".") || a.newKey === b.newKey;
                const aIsExtraction = !aStaysUnderBOld && !aMovesToUnderBNew;
                if (aIsExtraction) {
                    return -1;
                }
            }

            const depthA = a.newKey.split(".").length;
            const depthB = b.newKey.split(".").length;

            if (depthA !== depthB) {
                return depthA - depthB;
            }

            const originalDepthA = a.originalKey.split(".").length;
            const originalDepthB = b.originalKey.split(".").length;
            return originalDepthA - originalDepthB;
        });
    }

    /**
     * Sorts, re-parents, and de-duplicates a batch of renames before they are applied or simulated.
     */
    prepareRenamesForProcessing(renames: ProfileRenameEntry[]): ProfileRenameEntry[] {
        const sortedRenames = this.sortRenamesByDepth(renames);
        const updatedRenames = this.updateRenameKeysForParentChanges(sortedRenames);
        const finalRenames = this.removeDuplicateRenames(updatedRenames);
        return finalRenames.filter((rename) => rename.originalKey !== rename.newKey);
    }

    /**
     * Applies a batch of profile renames to disk: moves each profile within the team config,
     * updates defaults, persists the config, and refreshes profile/favorite state.
     */
    async handleProfileRenames(renames: ProfileRenameEntry[]): Promise<void> {
        if (!renames || renames.length === 0) {
            return;
        }

        const profInfo = await ConfigUtils.createProfileInfoAndLoad();
        const preparedRenames = this.prepareRenamesForProcessing(renames);

        for (const rename of preparedRenames) {
            try {
                await this.processSingleRename(rename, profInfo);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (this.isCriticalMoveError(error)) {
                    vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
                    throw new Error(`Critical error during profile rename: ${errorMessage}`);
                }
                this.handleRenameError(error, rename);
            }
        }
    }

    private async processSingleRename(rename: ProfileRenameEntry, profInfo: ProfileInfo): Promise<void> {
        const originalPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.originalKey);
        const newPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.newKey);

        if (this.wouldCreateCircularReference(rename.originalKey, rename.newKey)) {
            throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Would create circular reference`);
        }

        const teamConfig = profInfo.getTeamConfig();
        const targetLayer = teamConfig.layers.find((layer: ImperativeConfigLayer) => layer.path === rename.configPath);

        if (!targetLayer) {
            throw new Error(`Configuration layer not found for path: ${rename.configPath}`);
        }

        teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

        const layerActive = (): { properties: { profiles: NestedProfilesMap } } => ({
            properties: {
                profiles: teamConfig.api.layers.get().properties.profiles as NestedProfilesMap,
            },
        });

        const validationResult = this.validateProfileRename(teamConfig, originalPath, newPath, rename);
        if (validationResult.skip) {
            // Profile doesn't exist yet (newly created) - skip rename, changes will be redirected
            return;
        }

        if (this.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
            this.createNestedProfileStructureDirectly(teamConfig, originalPath, newPath, rename.originalKey, rename.newKey);
        } else {
            this.moveProfileDirectly(teamConfig, layerActive, originalPath, newPath);
        }

        this.updateDefaultsAfterRename(teamConfig, rename);

        await teamConfig.save();
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        // loadNamedProfile (favorites + session rebuild) reads ProfilesCache.allProfiles, updated only by refresh().
        await Profiles.getInstance().refresh();
        await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);
        // Do not await: Explorer tree refresh (favorites + sessions) is slow and does not affect config editor webview state.
        FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename(rename);
    }

    private getProfileFromTeamConfig(teamConfig: Config, path: string): ProfileTreeNode | null {
        const currentLayer = teamConfig.api.layers.get();
        const profiles = currentLayer.properties.profiles as NestedProfilesMap | undefined;
        const profileKey = path.replace("profiles.", "");
        return this.findNestedProfile(profileKey, profiles);
    }

    private moveProfileDirectly(
        teamConfig: Config,
        layerActive: () => { properties: { profiles: NestedProfilesMap } },
        sourcePath: string,
        targetPath: string
    ): void {
        const sourceProfile = this.getProfileFromTeamConfig(teamConfig, sourcePath);
        if (!sourceProfile) {
            throw new Error(`Source profile not found at path: ${sourcePath}`);
        }

        const targetProfile = this.getProfileFromTeamConfig(teamConfig, targetPath);
        if (targetProfile) {
            throw new Error(`Target profile already exists at path: ${targetPath}`);
        }

        teamConfig.set(targetPath, sourceProfile as unknown, { parseString: true });
        teamConfig.delete(sourcePath);
    }

    private createTeamConfigAdapter(teamConfig: Config): ConfigMoveAPI {
        return {
            get: (path: string) => this.getProfileFromTeamConfig(teamConfig, path),
            set: (path: string, value: unknown) => teamConfig.set(path, value, { parseString: true }),
            delete: (path: string) => teamConfig.delete(path),
        };
    }

    private createNestedProfileStructureDirectly(
        teamConfig: Config,
        originalPath: string,
        newPath: string,
        originalKey: string,
        newKey: string
    ): void {
        const configAdapter = this.createTeamConfigAdapter(teamConfig);
        const layerActive = (): { properties: { profiles: NestedProfilesMap } } => ({
            properties: {
                profiles: teamConfig.api.layers.get().properties.profiles as NestedProfilesMap,
            },
        });
        this.createNestedProfileStructure(configAdapter, layerActive, originalPath, newPath, originalKey, newKey);
    }

    private findNestedProfile(key: string, profilesObj: NestedProfilesMap | ProfileTreeNode | null | undefined): ProfileTreeNode | null {
        const parts = key.split(".");
        let current: unknown = profilesObj;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part === "profiles") {
                continue;
            }

            const cur = current as Record<string, unknown>;
            if (!cur || cur[part] === undefined) {
                return null;
            }
            current = cur[part];

            if (i === parts.length - 1) {
                return current as ProfileTreeNode;
            }

            if (current && typeof current === "object" && current !== null && "profiles" in current) {
                current = (current as ProfileTreeNode).profiles;
            } else if (i < parts.length - 1) {
                return null;
            }
        }
        return current as ProfileTreeNode | null;
    }

    private validateProfileRename(
        teamConfig: Config,
        originalPath: string,
        newPath: string,
        rename: { originalKey: string; newKey: string }
    ): { skip: boolean } {
        const originalProfile = this.getProfileFromTeamConfig(teamConfig, originalPath);
        if (!originalProfile) {
            // Profile doesn't exist in config - this is likely a newly created profile
            // that hasn't been saved yet. Skip the rename operation; the pending changes
            // will be redirected to the new location by updateProfileChangesForRenames.
            return { skip: true };
        }

        const existingTargetProfile = this.getProfileFromTeamConfig(teamConfig, newPath);
        if (existingTargetProfile) {
            throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Profile '${rename.newKey}' already exists`);
        }

        return { skip: false };
    }

    private updateDefaultsAfterRename(teamConfig: Config, rename: { originalKey: string; newKey: string }): void {
        try {
            updateDefaultsAfterRename(
                () => teamConfig.api.layers.get(),
                rename.originalKey,
                rename.newKey,
                (updatedDefaults) => teamConfig.set("defaults", updatedDefaults, { parseString: true })
            );
        } catch (defaultsError) {
            const errorMessage = this.handleMoveUtilsError(defaultsError, "update defaults", rename.originalKey, rename.newKey);
            console.warn(errorMessage);
        }
    }

    private handleRenameError(error: unknown, rename: { originalKey: string; newKey: string }): void {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (this.isCriticalMoveError(error)) {
            vscode.window.showErrorMessage(`Save operation cancelled: ${errorMessage}`);
            throw new Error(`Critical error during profile rename: ${errorMessage}`);
        }

        vscode.window.showErrorMessage(`Error renaming profile from '${rename.originalKey}' to '${rename.newKey}': ${errorMessage}`);
    }

    /**
     * Updates profile changes to use new profile names before processing
     * This prevents duplicate profiles by ensuring changes target the correct names
     * Uses TeamConfig API for more reliable profile path resolution
     */
    async updateProfileChangesForRenames(message: LayerChangesPayload, renames: ProfileRenameEntry[]): Promise<LayerChangesPayload> {
        if (!renames || renames.length === 0) {
            return message;
        }

        await ConfigUtils.createProfileInfoAndLoad();

        const updatedMessage = { ...message };

        const renameMap = new Map<string, { oldKey: string; newKey: string; configPath: string }>();
        renames.forEach((rename) => {
            renameMap.set(rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath });
        });

        // Update changes
        if (updatedMessage.changes) {
            updatedMessage.changes = updatedMessage.changes.map((change) => {
                if (change.configPath) {
                    let updatedChange = { ...change };

                    if (updatedChange.profile) {
                        updatedChange.profile = ConfigEditorPathUtils.getNewProfilePath(updatedChange.profile, change.configPath, renameMap);
                    }

                    updatedChange = ConfigEditorPathUtils.updateChangeKey(updatedChange, change.configPath, renameMap) as typeof updatedChange;
                    updatedChange = ConfigEditorPathUtils.updateChangePath(updatedChange, change.configPath, renameMap) as typeof updatedChange;

                    return updatedChange;
                }
                return change;
            });
        }

        // Update profile deletions to use new names
        if (updatedMessage.deletions) {
            updatedMessage.deletions = updatedMessage.deletions.map((deletion) => {
                if (deletion.configPath) {
                    let updatedDeletion = { ...deletion };

                    if (updatedDeletion.profile) {
                        updatedDeletion.profile = ConfigEditorPathUtils.getNewProfilePath(updatedDeletion.profile, deletion.configPath, renameMap);
                    }

                    updatedDeletion = ConfigEditorPathUtils.updateChangeKey(updatedDeletion, deletion.configPath, renameMap) as typeof updatedDeletion;
                    updatedDeletion = ConfigEditorPathUtils.updateChangePath(updatedDeletion, deletion.configPath, renameMap) as typeof updatedDeletion;

                    return updatedDeletion;
                }
                return deletion;
            });
        }
        return updatedMessage;
    }

    /**
     * Simulates a batch of profile renames against an in-memory team config (no disk writes),
     * used to compute merged/effective properties as if the renames had already been applied.
     */
    simulateProfileRenames(renames: ProfileRenameEntry[], teamConfig: Config): void {
        if (!renames || renames.length === 0) {
            return;
        }

        if (!teamConfig) {
            console.warn("Cannot simulate profile renames: teamConfig is null or undefined");
            return;
        }

        const preparedRenames = this.prepareRenamesForProcessing(renames);

        for (const rename of preparedRenames) {
            try {
                const targetLayer = teamConfig.layers.find((layer: ImperativeConfigLayer) => layer.path === rename.configPath);

                if (!targetLayer) {
                    continue; // Skip if layer not found
                }

                teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

                const layerActive = (): { properties: { profiles: NestedProfilesMap } } => ({
                    properties: {
                        profiles: teamConfig.api.layers.get().properties.profiles as NestedProfilesMap,
                    },
                });

                let originalPath: string;
                let newPath: string;

                try {
                    originalPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.originalKey);
                    newPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.newKey);
                } catch (pathError) {
                    const errorMessage = this.handleMoveUtilsError(pathError, "construct profile path", rename.originalKey, rename.newKey, true);
                    throw new Error(`${errorMessage}. Cannot proceed with operation - rename state is invalid.`);
                }

                try {
                    if (this.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
                        this.createNestedProfileStructureDirectly(teamConfig, originalPath, newPath, rename.originalKey, rename.newKey);
                    } else {
                        this.moveProfileDirectly(teamConfig, layerActive, originalPath, newPath);
                    }
                } catch (moveError) {
                    const errorMessage = this.handleMoveUtilsError(moveError, "simulate move profile", originalPath, newPath, true);
                    throw new Error(`${errorMessage}. Cannot proceed with operation - rename state is invalid.`);
                }

                // Simulate defaults updates for this rename
                try {
                    simulateDefaultsUpdateAfterRename(() => teamConfig.api.layers.get(), rename.originalKey, rename.newKey);
                } catch (defaultsError) {
                    const errorMessage = this.handleMoveUtilsError(defaultsError, "simulate defaults update", rename.originalKey, rename.newKey, true);
                    console.warn(errorMessage);
                }
            } catch (error) {
                continue;
            }
        }
    }
}
