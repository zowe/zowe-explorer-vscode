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

import { ConfigMoveAPI, IConfigLayer } from "../webviews/src/config-editor/types";
import { ConfigUtils } from "./ConfigUtils";

export class ConfigEditorProfileOperations {
    /**
     * Validates if a profile name is available for creation
     */
    validateProfileName(
        profileName: string,
        rootProfile: string,
        configPath: string,
        profiles: any,
        pendingChanges: { [configPath: string]: { [key: string]: any } },
        renames: { [configPath: string]: { [originalKey: string]: string } }
    ): { isValid: boolean; message?: string } {
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
                        // Child is NOT an extraction if its newKey is under either the old OR new parent location
                        const staysUnderOldParent =
                            childRename.newKey.startsWith(parentOriginalKey + ".") || childRename.newKey === parentOriginalKey;
                        const movesToUnderNewParent = childRename.newKey.startsWith(parentNewKey + ".") || childRename.newKey === parentNewKey;
                        const isExtraction = !staysUnderOldParent && !movesToUnderNewParent;
                        const childOriginalStartsWithParent = childOriginalParts.length > 1 && childOriginalParts[0] === parentOriginalKey;

                        if (childOriginalStartsWithParent && isExtraction) {
                            // For extractions, don't update the keys - the extraction is sorted first
                            // and should be processed before the parent move. The child is being
                            // extracted OUT of the parent, so its original location is still valid.
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

    isCriticalMoveError(error: any): boolean {
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
    redactSecureValues(knownArgs: any): any {
        if (!knownArgs || typeof knownArgs !== "object") {
            return knownArgs;
        }

        // Handle array case
        if (Array.isArray(knownArgs)) {
            return knownArgs.map((item) => {
                // For array items, check if the item itself is secure
                if (item && typeof item === "object" && "secure" in item && item.secure === true) {
                    const redactedItem = { ...item };

                    // Check for different possible value field names
                    if ("argValue" in redactedItem) {
                        redactedItem.argValue = "REDACTED";
                    } else if ("value" in redactedItem) {
                        redactedItem.value = "REDACTED";
                    }

                    return redactedItem;
                } else {
                    // Recursively process nested objects
                    return this.redactSecureValues(item);
                }
            });
        }

        const redacted = { ...knownArgs };
        for (const [key, value] of Object.entries(redacted)) {
            if (value && typeof value === "object") {
                // Check if this is a secure field
                if ("secure" in value && value.secure === true) {
                    // Redact the appropriate value field based on the data structure
                    const redactedValue = { ...value };

                    // Check for different possible value field names
                    if ("argValue" in redactedValue) {
                        redactedValue.argValue = "REDACTED";
                    } else if ("value" in redactedValue) {
                        redactedValue.value = "REDACTED";
                    }

                    redacted[key] = redactedValue;
                } else {
                    // Recursively process nested objects
                    redacted[key] = this.redactSecureValues(value);
                }
            }
        }
        return redacted;
    }
}
