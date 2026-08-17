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

import { checkIfRenameCancelsOut, consolidateRenames, detectClosedLoops } from "../utils/renameUtils";
import { getRenamedProfileKeyWithNested, getReplacementProfileAfterDelete } from "../utils/profileUtils";
import { flattenProfiles } from "../utils";

// Types
import type { PendingChange } from "../types";
import type { HandlerContext } from "../hooks/useHandlerContext";

// Profile handler props interface
// Replaced by HandlerContext from ../hooks/useHandlerContext

// Applies a rename (originalKey -> newKey) on top of the existing renames map, consolidating
// chains and dropping any closed loops. Shared by handleRenameProfile's renames-state update and
// resolveKeyAfterRename below, so the two never compute a different result for the same input.
function buildConsolidatedRenames(
    currentRenames: { [originalKey: string]: string },
    originalKey: string,
    newKey: string
): { [originalKey: string]: string } {
    let updatedRenames = { ...currentRenames };
    const wouldCancelOut = checkIfRenameCancelsOut(currentRenames, originalKey, newKey);

    if (wouldCancelOut) {
        const renamesToRemove = new Set<string>();
        renamesToRemove.add(originalKey);
        let currentKey = originalKey;
        while (currentRenames[currentKey]) {
            const targetKey = currentRenames[currentKey];
            renamesToRemove.add(currentKey);
            currentKey = targetKey;
        }
        for (const keyToRemove of renamesToRemove) {
            delete updatedRenames[keyToRemove];
        }
    } else {
        updatedRenames[originalKey] = newKey;
    }

    updatedRenames = consolidateRenames(updatedRenames, originalKey, newKey);

    const closedLoops = detectClosedLoops(updatedRenames);
    if (closedLoops.length > 0) {
        const keysToRemove = new Set<string>();
        closedLoops.forEach((loop) => loop.forEach((key) => keysToRemove.add(key)));
        keysToRemove.forEach((key) => delete updatedRenames[key]);
    }

    return updatedRenames;
}

// Resolves what a profile key (selection, expanded-node entry, etc.) becomes after a rename of
// originalKey -> newKey. Used everywhere handleRenameProfile needs to update a key that might be
// the renamed profile itself, a child of it, or part of a chained rename.
function resolveKeyAfterRename(
    key: string,
    originalKey: string,
    newKey: string,
    oldRenames: { [originalKey: string]: string },
    updatedRenames: { [originalKey: string]: string }
): string {
    const oldRenamedValue = oldRenames[originalKey];

    if (key === originalKey) {
        return newKey;
    }
    if (key.startsWith(originalKey + ".")) {
        return newKey + "." + key.substring(originalKey.length + 1);
    }
    if (oldRenamedValue && key.startsWith(oldRenamedValue + ".")) {
        return newKey + "." + key.substring(oldRenamedValue.length + 1);
    }
    if (key === oldRenamedValue) {
        return newKey;
    }
    for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
        if (key === origKey) {
            return renamedValue;
        }
        if (key === renamedValue) {
            return key;
        }
    }
    return key;
}

export const handleRenameProfile = (originalKey: string, newKey: string, isDragDrop: boolean = false, props: HandlerContext): boolean => {
    const {
        selectedTab,
        configurations,
        renames,
        selectedProfileKey,
        extractPendingProfiles,
        vscodeApi,
        setRenames,
        setSelectedProfileKey,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDragDroppedProfiles,
    } = props;

    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;

    // Check if we need to use the current effective name instead of the original key
    const currentEffectiveName = getRenamedProfileKeyWithNested(originalKey, configPath, renames);
    if (currentEffectiveName !== originalKey) {
        // Use the current effective name as the original key
        originalKey = currentEffectiveName;
    }

    // Check for circular renames before proceeding (same validation as rename modal)
    const currentRenames = renames[configPath] || {};

    // Special case: if renaming back to the original key, cancel the rename operation
    if (newKey === originalKey) {
        // Remove the rename entry to restore the profile to its original state
        setRenames((prev) => {
            const updatedRenames = { ...prev[configPath] };
            delete updatedRenames[originalKey];
            return {
                ...prev,
                [configPath]: updatedRenames,
            };
        });
        return true; // Return true to indicate success (rename was canceled)
    }

    // Check for circular renames, but allow cancellations
    if (currentRenames[newKey] === originalKey) {
        // Check if this is actually a cancellation (moving back to original location)
        const isCancellation = Object.entries(currentRenames).some(([origKey, targetKey]) => targetKey === originalKey && origKey === newKey);

        if (isCancellation) {
            // This is a cancellation, not a circular rename - allow it to proceed
        } else {
            // Show error message for circular rename
            vscodeApi.postMessage({
                command: "SHOW_ERROR_MESSAGE",
                message: `Cannot rename '${originalKey}' to '${newKey}': This would create a circular rename (${newKey} -> ${originalKey})`,
            });
            return false; // Return false to indicate failure
        }
    }

    // Build the consolidated renames map once; every downstream consumer below (renames state,
    // selected profile, per-config selection, expanded nodes) resolves against this same map,
    // so they can no longer drift out of sync with each other.
    const updatedRenames = buildConsolidatedRenames(currentRenames, originalKey, newKey);

    setRenames((prev) => ({ ...prev, [configPath]: updatedRenames }));

    const newSelectedProfileKey = selectedProfileKey
        ? resolveKeyAfterRename(selectedProfileKey, originalKey, newKey, currentRenames, updatedRenames)
        : selectedProfileKey;

    if (newSelectedProfileKey !== selectedProfileKey) {
        setSelectedProfileKey(newSelectedProfileKey);

        if (newSelectedProfileKey) {
            // Increment sort order version to trigger re-render with updated merged properties
            setSortOrderVersion((prev) => prev + 1);
        }
    }

    // Update the selected profiles by config to reflect the rename
    setSelectedProfilesByConfig((prev) => {
        const currentSelectedProfile = prev[configPath];
        if (!currentSelectedProfile) {
            return prev;
        }

        const newCurrentSelectedProfile = resolveKeyAfterRename(currentSelectedProfile, originalKey, newKey, currentRenames, updatedRenames);

        if (newCurrentSelectedProfile !== currentSelectedProfile) {
            return {
                ...prev,
                [configPath]: newCurrentSelectedProfile,
            };
        }
        return prev;
    });

    // Update expanded nodes to reflect the rename
    setExpandedNodesByConfig((prev) => {
        const currentExpandedNodes = prev[configPath] || new Set();
        const newExpandedNodes = new Set<string>();

        for (const expandedKey of currentExpandedNodes) {
            newExpandedNodes.add(resolveKeyAfterRename(expandedKey, originalKey, newKey, currentRenames, updatedRenames));
        }

        return {
            ...prev,
            [configPath]: newExpandedNodes,
        };
    });

    // Auto-expand parent profiles when a profile is moved to a nested path
    if (newKey !== originalKey && newKey.includes(".")) {
        // Extract the parent path from the new key
        const parentPath = newKey.substring(0, newKey.lastIndexOf("."));

        // Add the parent path to expanded nodes if it's not already expanded
        setExpandedNodesByConfig((prev) => {
            const currentExpandedNodes = prev[configPath] || new Set();
            if (!currentExpandedNodes.has(parentPath)) {
                const newExpandedNodes = new Set(currentExpandedNodes);
                newExpandedNodes.add(parentPath);
                return {
                    ...prev,
                    [configPath]: newExpandedNodes,
                };
            }
            return prev;
        });
    }

    // Update any pending defaults that reference the old profile name or consolidated renames
    setPendingDefaults((prev) => {
        const configDefaults = prev[configPath] || {};
        const updatedDefaults = { ...configDefaults };
        let hasChanges = false;

        // Check each default entry against all consolidated renames
        Object.entries(updatedDefaults).forEach(([profileType, defaultEntry]) => {
            // Check direct rename (full path match)
            if (defaultEntry.value === originalKey) {
                updatedDefaults[profileType] = {
                    ...defaultEntry,
                    value: newKey,
                };
                hasChanges = true;
            }
            // Check child renames (for nested profiles)
            else if (defaultEntry.value.startsWith(originalKey + ".")) {
                const childPath = defaultEntry.value.substring(originalKey.length + 1);
                updatedDefaults[profileType] = {
                    ...defaultEntry,
                    value: newKey + "." + childPath,
                };
                hasChanges = true;
            }
            // Check consolidated renames
            else {
                for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
                    if (defaultEntry.value === origKey) {
                        updatedDefaults[profileType] = {
                            ...defaultEntry,
                            value: renamedValue,
                        };
                        hasChanges = true;
                        break;
                    }
                }
            }
        });

        // Check if the renamed profile was a default profile and create a pending default change
        const config = configurations[selectedTab!].properties;
        const defaults = config.defaults || {};

        // Check if the original profile was a default for any profile type
        for (const [profileType, defaultProfileName] of Object.entries(defaults)) {
            const defaultProfileNameStr = String(defaultProfileName);

            // Check if this profile was a default
            if (defaultProfileNameStr === originalKey) {
                // The renamed profile was a default, create a pending default change
                updatedDefaults[profileType] = {
                    value: newKey,
                    path: [profileType],
                };
                hasChanges = true;
            }

            // Check if any child profiles of the renamed profile were defaults
            // This handles cases like: tso.zosmf is default, tso is renamed to tso1, so tso1.zosmf should remain default
            if (defaultProfileNameStr.startsWith(originalKey + ".")) {
                // This is a child profile that was a default
                const childPath = defaultProfileNameStr.substring(originalKey.length + 1);
                const newChildDefault = newKey + "." + childPath;
                updatedDefaults[profileType] = {
                    value: newChildDefault,
                    path: [profileType],
                };
                hasChanges = true;
            }
        }

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedDefaults,
            };
        }

        return prev;
    });

    // Update any pending changes that reference the old profile name
    setPendingChanges((prev) => {
        const configChanges = prev[configPath] || {};
        const updatedChanges: { [key: string]: PendingChange } = {};
        let hasChanges = false;

        // Helper function to construct new path for nested profiles
        const constructNewPath = (newProfileKey: string): string => {
            if (newProfileKey.includes(".")) {
                // For nested profiles, construct path with "profiles" segments
                const profileParts = newProfileKey.split(".");
                const pathParts = ["profiles"];
                for (let i = 0; i < profileParts.length; i++) {
                    pathParts.push(profileParts[i]);
                    if (i < profileParts.length - 1) {
                        pathParts.push("profiles");
                    }
                }
                return pathParts.join(".");
            } else {
                // Top-level profile
                return `profiles.${newProfileKey}`;
            }
        };

        // Helper function to construct old path for nested profiles
        const constructOldPath = (profileKey: string): string => {
            if (profileKey.includes(".")) {
                // For nested profiles, construct path with "profiles" segments
                const profileParts = profileKey.split(".");
                const pathParts = ["profiles"];
                for (let i = 0; i < profileParts.length; i++) {
                    pathParts.push(profileParts[i]);
                    if (i < profileParts.length - 1) {
                        pathParts.push("profiles");
                    }
                }
                return pathParts.join(".");
            } else {
                // Top-level profile
                return `profiles.${profileKey}`;
            }
        };

        // Process each pending change entry
        Object.entries(configChanges).forEach(([changeKey, changeEntry]) => {
            let newChangeKey = changeKey;
            let newChangeEntry = { ...changeEntry };

            // Check if this pending change belongs to the profile being renamed
            if (changeEntry.profile === originalKey) {
                // Update the profile field
                newChangeEntry.profile = newKey;

                // Update the key path to reflect the new profile structure
                const oldProfilePath = constructOldPath(originalKey);
                const newProfilePath = constructNewPath(newKey);

                if (changeKey.startsWith(oldProfilePath)) {
                    newChangeKey = changeKey.replace(oldProfilePath, newProfilePath);
                    hasChanges = true;
                }
            }
            // Check if this pending change belongs to a child profile being renamed
            else if (changeEntry.profile.startsWith(originalKey + ".")) {
                const childPath = changeEntry.profile.substring(originalKey.length + 1);
                newChangeEntry.profile = newKey + "." + childPath;

                // Update the key path for child profiles
                const oldChildProfilePath = constructOldPath(changeEntry.profile);
                const newChildProfilePath = constructNewPath(newKey + "." + childPath);

                if (changeKey.startsWith(oldChildProfilePath)) {
                    newChangeKey = changeKey.replace(oldChildProfilePath, newChildProfilePath);
                    hasChanges = true;
                }
            }
            // Check consolidated renames
            else {
                for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
                    if (changeEntry.profile === origKey) {
                        newChangeEntry.profile = renamedValue;

                        const oldProfilePath = constructOldPath(origKey);
                        const newProfilePath = constructNewPath(renamedValue);

                        if (changeKey.startsWith(oldProfilePath)) {
                            newChangeKey = changeKey.replace(oldProfilePath, newProfilePath);
                            hasChanges = true;
                        }
                        break;
                    }
                    // Check child profiles of consolidated renames
                    else if (changeEntry.profile.startsWith(origKey + ".")) {
                        const childPath = changeEntry.profile.substring(origKey.length + 1);
                        newChangeEntry.profile = renamedValue + "." + childPath;

                        const oldChildProfilePath = constructOldPath(changeEntry.profile);
                        const newChildProfilePath = constructNewPath(renamedValue + "." + childPath);

                        if (changeKey.startsWith(oldChildProfilePath)) {
                            newChangeKey = changeKey.replace(oldChildProfilePath, newChildProfilePath);
                            hasChanges = true;
                        }
                        break;
                    }
                }
            }

            // Add the entry (either updated or original)
            updatedChanges[newChangeKey] = newChangeEntry;
        });

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedChanges,
            };
        }

        return prev;
    });

    // If the new key is nested, create parent profiles as pending profiles
    if (newKey.includes(".")) {
        const parentParts = newKey.split(".");
        const parentKeys: string[] = [];

        // Create all parent profile keys
        for (let i = 1; i < parentParts.length; i++) {
            parentKeys.push(parentParts.slice(0, i).join("."));
        }

        // Check which parent profiles need to be created
        const config = configurations[selectedTab!];
        const existingProfiles = flattenProfiles(config.properties.profiles);
        const existingProfileKeys = Object.keys(existingProfiles);

        // Get all current profile keys including renamed ones
        const allCurrentProfileKeys = existingProfileKeys.map((key) => getRenamedProfileKeyWithNested(key, configPath, renames));

        // Also include pending profiles
        const pendingProfiles = extractPendingProfiles(configPath);
        const pendingProfileKeys = Object.keys(pendingProfiles);
        allCurrentProfileKeys.push(...pendingProfileKeys);

        // Add pending changes for parent profiles that don't exist
        setPendingChanges((prev) => {
            const newState = { ...prev };
            if (!newState[configPath]) {
                newState[configPath] = {};
            }

            parentKeys.forEach((parentKey) => {
                // Check if this parent key is already a target of another rename operation
                const isRenameTarget = Object.values(renames[configPath] || {}).includes(parentKey);
                if (isRenameTarget) {
                    // This parent profile is already being created by another rename, skip it
                    return;
                }

                // Check if the parent profile exists in original profiles or as a renamed profile
                const existsAsOriginal = existingProfileKeys.includes(parentKey);
                const existsAsRenamed = allCurrentProfileKeys.includes(parentKey);

                if (!existsAsOriginal && !existsAsRenamed) {
                    // Create a pending change for the parent profile (without type)
                    const parentPath = parentKey.split(".");
                    const fullPath = ["profiles"];
                    for (let i = 0; i < parentPath.length; i++) {
                        fullPath.push(parentPath[i]);
                        if (i < parentPath.length - 1) {
                            fullPath.push("profiles");
                        }
                    }

                    const fullPathKey = fullPath.join(".");
                    newState[configPath][fullPathKey] = {
                        value: {}, // Empty object to create the profile structure
                        path: [],
                        profile: parentKey,
                        secure: false,
                    };
                }
            });

            return newState;
        });
    }

    // Track drag-drop operations to disable rename button for affected profiles
    if (isDragDrop) {
        setDragDroppedProfiles((prev) => {
            const newState = { ...prev };
            if (!newState[configPath]) {
                newState[configPath] = new Set();
            }

            // Add the original profile and all its parents/children to the drag-dropped set
            const addProfileAndRelated = (profileKey: string) => {
                newState[configPath].add(profileKey);

                // Add all parent profiles
                const parts = profileKey.split(".");
                for (let i = 1; i < parts.length; i++) {
                    const parentKey = parts.slice(0, i).join(".");
                    newState[configPath].add(parentKey);
                }

                // Add all child profiles that exist in the configuration or renames
                const config = configurations[selectedTab].properties;
                const flatProfiles = flattenProfiles(config.profiles);
                Object.keys(flatProfiles).forEach((existingProfile) => {
                    if (existingProfile.startsWith(profileKey + ".")) {
                        newState[configPath].add(existingProfile);
                    }
                });

                // Also check renamed profiles
                Object.keys(renames[configPath] || {}).forEach((origProfile) => {
                    if (origProfile.startsWith(profileKey + ".")) {
                        newState[configPath].add(origProfile);
                    }
                });
                Object.values(renames[configPath] || {}).forEach((renamedProfile) => {
                    if (renamedProfile.startsWith(profileKey + ".")) {
                        newState[configPath].add(renamedProfile);
                    }
                });
            };

            // Add both the original and new profile keys and their related profiles
            addProfileAndRelated(originalKey);
            addProfileAndRelated(newKey);

            return newState;
        });
    }

    // Note: Secure properties are handled by the backend moveProfile function
    // No need to create pending changes for secure properties during renames

    // Close the modal
    setRenameProfileModalOpen(false);

    return true; // Return true to indicate success
};

export const handleDeleteProfile = (profileKey: string, props: HandlerContext): void => {
    const {
        selectedTab,
        configurations,
        renames,
        selectedProfileKey,
        setDeletions,
        setPendingChanges,
        setSelectedProfileKey,
        setSelectedProfilesByConfig,
        setPendingDefaults,
        getAvailableProfilesForConfig,
    } = props;

    if (selectedTab === null || !configurations[selectedTab]) return;
    const configPath = configurations[selectedTab].configPath;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = getRenamedProfileKeyWithNested(profileKey, configPath, renames);

    // Construct the full profile path using the effective profile key
    let fullProfilePath: string;
    if (effectiveProfileKey.includes(".")) {
        // Nested profile, construct the full path
        const profileParts = effectiveProfileKey.split(".");
        const pathArray = ["profiles"];
        for (let i = 0; i < profileParts.length; i++) {
            pathArray.push(profileParts[i]);
            if (i < profileParts.length - 1) {
                pathArray.push("profiles");
            }
        }
        fullProfilePath = pathArray.join(".");
    } else {
        // Top-level profile
        fullProfilePath = `profiles.${effectiveProfileKey}`;
    }

    // Add to deletions - we'll add all profile-related keys to deletions
    setDeletions((prev) => {
        const newDeletions = { ...prev };
        if (!newDeletions[configPath]) {
            newDeletions[configPath] = [];
        }

        // Add the full profile path to deletions
        newDeletions[configPath].push(fullProfilePath);

        return newDeletions;
    });

    // Clear any pending changes for this profile (using both original and effective keys)
    setPendingChanges((prev) => {
        const newState = { ...prev };
        if (newState[configPath]) {
            // Remove all pending changes that belong to this profile
            Object.keys(newState[configPath]).forEach((key) => {
                const entry = newState[configPath][key];
                if (entry.profile === profileKey || entry.profile === effectiveProfileKey) {
                    delete newState[configPath][key];
                }
            });
        }
        return newState;
    });

    // Remove the deleted profile from defaults if it's set as a default
    const config = configurations[selectedTab].properties;
    const defaults = config.defaults || {};

    const profilesToCheck = [profileKey, effectiveProfileKey];

    // Check if the deleted profile is a default for any profile type
    setPendingDefaults((prev) => {
        const updatedDefaults = { ...prev[configPath] };
        let hasChanges = false;

        Object.entries(updatedDefaults).forEach(([profileType, defaultEntry]) => {
            // Check if this default matches the deleted profile or is a child of it
            if (profilesToCheck.includes(defaultEntry.value) || profilesToCheck.some((p) => defaultEntry.value.startsWith(p + "."))) {
                updatedDefaults[profileType] = { value: "", path: [profileType] };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedDefaults,
            };
        }
        return prev;
    });

    // Check configuration defaults and set to empty string if the deleted profile is a default
    setPendingDefaults((prev) => {
        const updatedDefaults = { ...prev[configPath] };
        let hasChanges = false;

        Object.entries(defaults).forEach(([profileType, defaultProfileName]) => {
            const defaultProfileNameStr = String(defaultProfileName);

            if (profilesToCheck.includes(defaultProfileNameStr) || profilesToCheck.some((p) => defaultProfileNameStr.startsWith(p + "."))) {
                updatedDefaults[profileType] = { value: "", path: [profileType] };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedDefaults,
            };
        }
        return prev;
    });

    // If this profile is currently selected, or if the selected profile is a child of this profile, select the replacement profile
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
        const orderedProfiles = getAvailableProfilesForConfig(configPath);
        const nearestProfileKey = getReplacementProfileAfterDelete(orderedProfiles, profileKey);

        // Set the nearest profile as selected, or null if no profile available
        setSelectedProfileKey(nearestProfileKey);

        // Also update the stored profiles for this config
        if (configPath) {
            setSelectedProfilesByConfig((prev) => ({
                ...prev,
                [configPath]: nearestProfileKey,
            }));
        }
    }
};

/**
 * Handle navigation to source profile
 */
export const handleNavigateToSource = (props: HandlerContext) => {
    const { configurations, setSelectedTab, setSelectedProfileKey } = props;

    return (jsonLoc: string, osLoc?: string[]) => {
        const parts = jsonLoc.split(".");

        if (parts.length >= 3 && parts[0] === "profiles") {
            // Find the source profile by looking for the profile name in the path
            // Handle both simple cases (profiles.ssh.port) and nested cases (profiles.ssh.profiles.parent.port)
            let sourceProfile = "";
            let sourceProfilePath = "";

            // Look for the profile name in the path
            for (let i = 1; i < parts.length - 1; i++) {
                if (parts[i + 1] === "profiles") {
                    // This is a nested profile structure
                    // For nested profiles, we need to construct the full profile path
                    // e.g., "profiles.zosmf.profiles.a.profiles.b.properties.port" should navigate to "zosmf.a.b"
                    const parentProfile = parts[i];
                    let nestedProfilePath = [parentProfile];
                    // Start after the first "profiles"
                    let pathIndex = i + 2;

                    // Continue building the nested profile path until we hit a non-profile part
                    while (pathIndex < parts.length - 1 && parts[pathIndex + 1] === "profiles") {
                        nestedProfilePath.push(parts[pathIndex]); // Add the profile name
                        pathIndex += 2; // Skip the "profiles" part
                    }

                    // Add the final profile name if we haven't reached the end
                    if (pathIndex < parts.length) {
                        nestedProfilePath.push(parts[pathIndex]);
                    }

                    sourceProfile = nestedProfilePath.join("."); // e.g., "zosmf.a.b"
                    sourceProfilePath = parts.slice(1, pathIndex + 1).join("."); // e.g., "zosmf.profiles.a.profiles.b"
                    break;
                } else if (i === 1) {
                    // Simple case: profiles.ssh.port
                    sourceProfile = parts[i];
                    sourceProfilePath = parts[i];
                }
            }

            if (sourceProfile) {
                // Find the configuration that contains this profile
                let sourceConfigIndex = -1;

                // If osLoc is provided and indicates a different config, use it to find the correct config
                if (osLoc && osLoc.length > 0) {
                    const osLocString = osLoc.join("");
                    sourceConfigIndex = configurations.findIndex((config) => {
                        return config.configPath === osLocString;
                    });
                }

                // If we couldn't find the config using osLoc, or if osLoc wasn't provided,
                // search through all configurations
                if (sourceConfigIndex === -1) {
                    for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                        const config = configurations[configIndex];
                        const configProfiles = config.properties?.profiles;

                        if (!configProfiles) {
                            continue;
                        }

                        // Check if this config contains the source profile
                        let profileExists = false;

                        if (sourceProfilePath.includes(".")) {
                            // Nested profile case - we need to check if the nested profile exists
                            const pathParts = sourceProfilePath.split(".");

                            let current = configProfiles;
                            for (const part of pathParts) {
                                if (current && current[part]) {
                                    current = current[part];
                                } else {
                                    current = null;
                                    break;
                                }
                            }
                            profileExists = current !== null;
                        } else {
                            // Simple profile case
                            profileExists = configProfiles.hasOwnProperty(sourceProfile);
                        }

                        if (profileExists) {
                            sourceConfigIndex = configIndex;
                            break;
                        }
                    }
                }

                if (sourceConfigIndex !== -1) {
                    // React batches these into a single update, so the tab and profile change together
                    // in one render instead of needing to be sequenced across ticks.
                    setSelectedTab(sourceConfigIndex);
                    setSelectedProfileKey(sourceProfile);
                }
            }
        }
    };
};

export const handleProfileSelection = (profileKey: string, props: HandlerContext): void => {
    const { selectedTab, configurations, setSelectedProfileKey, setSelectedProfilesByConfig } = props;

    if (profileKey === "") {
        // Deselect profile
        setSelectedProfileKey(null);
        // Don't clear merged properties - they will be updated when a new profile is selected
        return;
    }

    setSelectedProfileKey(profileKey);

    // Store the selected profile for this configuration
    const configPath = configurations[selectedTab!]?.configPath;
    if (configPath) {
        setSelectedProfilesByConfig((prev) => ({
            ...prev,
            [configPath]: profileKey,
        }));
    }
};
