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

import { ConfigMoveAPI, IConfigLayer } from "../webviews/src/config-editor/utils/MoveUtils";

export class ConfigEditorProfileOperations {
    /**
     * Updates rename keys to handle both parent-first and child-first rename scenarios.
     */
    updateRenameKeysForParentChanges(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const updatedRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];

        // Group renames by configPath to ensure consolidation only happens within the same config
        const renamesByConfigPath = new Map<string, Array<{ originalKey: string; newKey: string; configPath: string }>>();

        for (const rename of renames) {
            if (!renamesByConfigPath.has(rename.configPath)) {
                renamesByConfigPath.set(rename.configPath, []);
            }
            renamesByConfigPath.get(rename.configPath)!.push(rename);
        }

        // Process each configPath separately
        for (const [configPath, configRenames] of renamesByConfigPath) {
            const processedRenames = new Map<string, string>(); // originalKey -> newKey mapping (per configPath)

            // First pass: collect all renames to build a complete mapping for this configPath
            const allRenames = new Map<string, string>();
            for (const rename of configRenames) {
                allRenames.set(rename.originalKey, rename.newKey);
            }

            for (const rename of configRenames) {
                let updatedOriginalKey = rename.originalKey;
                let updatedNewKey = rename.newKey;

                // Check if any parent of this profile has been renamed (only within the same configPath)
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

                    // Find and update any child renames that reference this parent (only within the same configPath)
                    for (let i = 0; i < updatedRenames.length; i++) {
                        const childRename = updatedRenames[i];

                        // Only process child renames from the same configPath
                        if (childRename.configPath !== configPath) {
                            continue;
                        }

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
        }

        return updatedRenames;
    }

    /**
     * Removes duplicate renames that target the same final key
     * Note: This function only consolidates renames within the same configPath
     */
    removeDuplicateRenames(
        renames: Array<{ originalKey: string; newKey: string; configPath: string }>
    ): Array<{ originalKey: string; newKey: string; configPath: string }> {
        const finalRenames: Array<{ originalKey: string; newKey: string; configPath: string }> = [];

        // Group renames by configPath to ensure consolidation only happens within the same config
        const renamesByConfigPath = new Map<string, Array<{ originalKey: string; newKey: string; configPath: string }>>();

        for (const rename of renames) {
            if (!renamesByConfigPath.has(rename.configPath)) {
                renamesByConfigPath.set(rename.configPath, []);
            }
            renamesByConfigPath.get(rename.configPath)!.push(rename);
        }

        // Process each configPath separately
        for (const [, configRenames] of renamesByConfigPath) {
            const seenTargets = new Map<string, { originalKey: string; newKey: string; configPath: string }>();

            for (const rename of configRenames) {
                const targetKey = rename.newKey; // Only use newKey since we're processing within the same configPath
                const renameTail = rename.originalKey.split(".").pop()!;

                if (seenTargets.has(targetKey)) {
                    const existing = seenTargets.get(targetKey)!;
                    const existingTail = existing.originalKey.split(".").pop()!;

                    if (renameTail === existingTail) {
                        // Same newKey + same ending segment -> allow both
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
        }

        return finalRenames;
    }

    /**
     * Checks if a profile rename would create a circular reference
     */
    wouldCreateCircularReference(originalKey: string, newKey: string): boolean {
        // A circular reference occurs when:
        // 1. The new key is a direct child of the original key AND
        // 2. The original key is already a child of the new key in the existing hierarchy

        if (!newKey.startsWith(originalKey + ".")) {
            return false; // Not a child relationship, so no circular reference possible
        }
        const childPart = newKey.substring(originalKey.length + 1);
        if (childPart.includes(originalKey)) {
            return true;
        }

        // check if we're renaming a parent to be a child of itself
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
        // Get the original profile data
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

        // Move secure properties if they exist
        this.moveSecurePropertiesForNestedProfile(configMoveAPI, layerActive, originalPath, childPath, originalKey, newKey);
    }

    /**
     * Moves secure properties for nested profile creation
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
