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

import { flattenProfiles, extractProfileKeyFromPath } from "./configUtils";
import { getNestedProperty } from "./generalUtils";
import { PendingChange } from "./configUtils";
import { useConsolidatedState, createStateVariables } from "../App";
import { getCurrentEffectiveName, getProfileNameForMergedProperties, updateChangesForRenames } from "./renameUtils";
// Types
export interface Configuration {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
    schemaPath?: string;
}

export interface PendingDefault {
    value: string;
    path: string[];
}

export interface schemaValidation {
    propertySchema: { [key: string]: any };
    validDefaults: string[];
}

/**
 * Get a profile's type, considering pending changes and renames
 */
export function getProfileType(
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | null {
    if (selectedTab === null) return null;
    const configPath = configurations[selectedTab!]!.configPath;

    // Check if this profile was renamed and get the original profile name (handle nested profiles)
    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    // Helper function to check if a profile key matches considering renames
    const isProfileKeyMatch = (entryProfileKey: string): boolean => {
        // Direct match with current or original profile key
        if (entryProfileKey === profileKey || entryProfileKey === originalProfileKey) {
            return true;
        }

        // For nested profiles, check if this entry's profile key would match after applying renames
        if (entryProfileKey.includes(".") || profileKey.includes(".")) {
            // Get the renamed version of the entry's profile key using nested logic
            const renamedEntryProfileKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
            if (renamedEntryProfileKey === profileKey) {
                return true;
            }

            // Also check if the current profile key, when reversed through renames, matches the entry
            const originalOfCurrentKey = getOriginalProfileKey(profileKey, configPath, renames);
            if (entryProfileKey === originalOfCurrentKey) {
                return true;
            }

            // For deeply nested profiles, check if the entry profile key is an ancestor or descendant
            // after applying renames at each level
            const entryParts = entryProfileKey.split(".");
            const currentParts = profileKey.split(".");

            // Check if entry profile is a parent of current profile after renames
            if (entryParts.length < currentParts.length) {
                const currentParentKey = currentParts.slice(0, entryParts.length).join(".");
                const renamedEntryKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
                if (renamedEntryKey === currentParentKey) {
                    return true;
                }
            }

            // Check if current profile is a parent of entry profile after renames
            if (currentParts.length < entryParts.length) {
                const entryParentKey = entryParts.slice(0, currentParts.length).join(".");
                const renamedEntryParentKey = getRenamedProfileKeyWithNested(entryParentKey, configPath, renames);
                if (renamedEntryParentKey === profileKey) {
                    return true;
                }
            }
        }

        return false;
    };

    // Check pending changes first (check with enhanced profile key matching)
    const pendingType = Object.entries(pendingChanges[configPath] ?? {}).find(([key, entry]) => {
        if (!isProfileKeyMatch(entry.profile)) return false;
        const keyParts = key.split(".");
        return keyParts[keyParts.length - 1] === "type";
    });

    if (pendingType) {
        return pendingType[1].value as string;
    }

    // Check existing profiles (check both the current profile key and original profile key)
    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);

    // First try with the current profile key
    let profile = flatProfiles[profileKey];

    // If not found, try with the original profile key
    if (!profile) {
        profile = flatProfiles[originalProfileKey];
    }

    // For nested profiles, if still not found, we need to check if any parent profile was renamed
    // and reconstruct the original path
    if (!profile && profileKey.includes(".")) {
        // Get the original key by reversing all possible renames
        const profileParts = profileKey.split(".");
        let originalPath = "";

        // Try to find the original path by checking each level for renames
        for (let i = 0; i < profileParts.length; i++) {
            const currentLevelPath = profileParts.slice(0, i + 1).join(".");
            const originalLevelPath = getOriginalProfileKey(currentLevelPath, configPath, renames);

            if (i === 0) {
                originalPath = originalLevelPath;
            } else {
                // If this level was renamed, we need to use the original name
                if (originalLevelPath !== currentLevelPath) {
                    // This level or a parent was renamed, reconstruct the path
                    const originalParentParts = originalLevelPath.split(".");
                    const remainingParts = profileParts.slice(originalParentParts.length);
                    originalPath = originalLevelPath + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
                    break;
                } else {
                    originalPath = originalPath + "." + profileParts[i];
                }
            }
        }

        // Try with the reconstructed original path
        if (originalPath !== profileKey && originalPath !== originalProfileKey) {
            profile = flatProfiles[originalPath];
        }
    }

    if (profile && profile.type) {
        return profile.type;
    }

    return null;
}

/**
 * Get the renamed profile key for a given original key
 */
export function getRenamedProfileKey(
    originalKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    const configRenames = renames[configPath];
    return configRenames?.[originalKey] || originalKey;
}

/**
 * Get the renamed profile key for nested profiles, checking for renames at each level
 * and handling parent renames that affect child profiles
 */
export function getRenamedProfileKeyWithNested(
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    if (!profileKey.includes(".")) {
        // Simple profile, use the existing function
        return getRenamedProfileKey(profileKey, configPath, renames);
    }

    // First check if there's a direct rename for the complete profile path
    const directRename = getRenamedProfileKey(profileKey, configPath, renames);
    if (directRename !== profileKey) {
        return directRename;
    }

    // Handle nested profiles by applying renames iteratively to handle multiple nested renames
    const configRenames = renames[configPath] || {};
    let renamedPath = profileKey;

    // Apply renames iteratively until no more changes
    let changed = true;
    while (changed) {
        changed = false;

        // Sort renames by length of original key (longest first) to handle nested renames correctly
        const sortedRenames = Object.entries(configRenames).sort(([a], [b]) => b.length - a.length);

        for (const [originalKey, newKey] of sortedRenames) {
            // Check for exact match
            if (renamedPath === originalKey) {
                renamedPath = newKey;
                changed = true;
                break;
            }

            // Check for partial matches (parent renames affecting children)
            if (renamedPath.startsWith(originalKey + ".")) {
                renamedPath = renamedPath.replace(originalKey + ".", newKey + ".");
                changed = true;
                break;
            }
        }
    }

    return renamedPath;
}

/**
 * Get the original profile key for a given renamed key
 */
export function getOriginalProfileKey(
    renamedKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    const configRenames = renames[configPath];
    if (configRenames) {
        // Follow the chain of renames backwards to find the true original key
        const visited = new Set<string>();
        let currentKey = renamedKey;

        while (true) {
            // Find if this current key is the target of any rename
            let foundOriginal = false;
            for (const [originalKey, newKey] of Object.entries(configRenames)) {
                if (newKey === currentKey && !visited.has(originalKey)) {
                    visited.add(originalKey);
                    currentKey = originalKey;
                    foundOriginal = true;
                    break;
                }
            }

            if (!foundOriginal) {
                break;
            }
        }

        return currentKey;
    }
    return renamedKey;
}

/**
 * Get the original profile key for nested profiles, checking for renames at each level
 * and handling parent renames that affect child profiles
 */
export function getOriginalProfileKeyWithNested(
    renamedKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    if (!renamedKey.includes(".")) {
        // Simple profile, use the existing function
        return getOriginalProfileKey(renamedKey, configPath, renames);
    }

    // First check if there's a direct reverse lookup for the complete profile path
    const directOriginal = getOriginalProfileKey(renamedKey, configPath, renames);
    if (directOriginal !== renamedKey) {
        return directOriginal;
    }

    // Handle nested profiles by checking for renames at each level of nesting
    const profileParts = renamedKey.split(".");
    let originalPath = "";

    // We need to reverse the rename process by checking what original keys would produce this renamed key
    // First, try to find if any existing original key would produce this renamed key when processed through getRenamedProfileKeyWithNested
    const configRenames = renames[configPath] || {};
    for (const [origKey, _] of Object.entries(configRenames)) {
        if (origKey.includes(".")) {
            // Check if this original key would produce our renamedKey when processed
            const wouldProduce = getRenamedProfileKeyWithNested(origKey, configPath, renames);
            if (wouldProduce === renamedKey) {
                return origKey;
            }
        }
    }

    // If no direct match found, fall back to level-by-level reverse processing
    // Check if any parent profile has been renamed by working backwards
    for (let i = 0; i < profileParts.length; i++) {
        const currentPath = profileParts.slice(0, i + 1).join(".");

        // Check if this current path was the result of a rename
        const original = getOriginalProfileKey(currentPath, configPath, renames);

        if (original !== currentPath) {
            // This path was renamed, use the original name and continue building from there
            const remainingParts = profileParts.slice(i + 1);
            originalPath = original + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
            break;
        } else if (i === 0) {
            // First part hasn't been renamed
            originalPath = profileParts[i];
        } else {
            // This part hasn't been renamed, add it to the path
            originalPath = originalPath + "." + profileParts[i];
        }
    }

    // Additional check: Handle the case where a parent was renamed after a child was renamed
    // This handles the reverse scenario: test2.lpar2 should map back to test1.lpar1
    // when we have: test1.lpar1 -> test1.lpar2, then test1 -> test2
    const profilePartsForParentCheck = originalPath.split(".");

    // Check if any parent in the current path needs to be reverted
    for (let i = 0; i < profilePartsForParentCheck.length; i++) {
        const parentPath = profilePartsForParentCheck.slice(0, i + 1).join(".");

        // Check if this parent path was the result of a rename (reverse lookup)
        for (const [origKey, newKey] of Object.entries(configRenames)) {
            if (newKey === parentPath) {
                const remainingParts = profilePartsForParentCheck.slice(i + 1);
                originalPath = origKey + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
                break;
            }
        }
    }

    return originalPath;
}

/**
 * Get profile type from path
 */
export function getProfileTypeFromPath(
    path: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }
): string | undefined {
    if (!path || path.length === 0) {
        return undefined;
    }

    // Get the profile type from the path
    const profileTypePath = path.slice(0, -1); // Remove "properties" from the path
    const profileKey = extractProfileKeyFromPath(path);
    const configPath = configurations[selectedTab!]?.configPath;

    // First check if there's a pending type change
    if (profileKey && configPath) {
        // For nested profiles, we need to construct the correct key that matches how it's stored in pending changes
        let typeKey: string;
        if (profileKey.includes(".")) {
            // This is a nested profile - construct the full path with "profiles" segments
            const profileParts = profileKey.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            pathParts.push("type");
            typeKey = pathParts.join(".");
        } else {
            // Top-level profile
            typeKey = `profiles.${profileKey}.type`;
        }

        const pendingType = pendingChanges[configPath]?.[typeKey]?.value;
        if (pendingType !== undefined && typeof pendingType === "string") {
            // Return the pending type (including empty string for typeless profiles)
            return pendingType;
        }
    }

    // Fall back to the current type from the configuration
    return getNestedProperty(configurations[selectedTab!]?.properties, profileTypePath)?.type;
}

/**
 * Get available profiles by type
 */
export function getAvailableProfilesByType(
    profileType: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }
): string[] {
    if (selectedTab === null) return [];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    // Get all profiles that have pending type changes
    const profilesWithPendingTypeChanges = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([key, entry]) => {
        if (entry.profile) {
            const keyParts = key.split(".");
            const isTypeKey = keyParts[keyParts.length - 1] === "type";
            if (isTypeKey) {
                // Extract the profile name from the key path
                const profilePathParts = keyParts.slice(0, -1); // Remove "type" from the end
                if (profilePathParts[0] === "profiles") {
                    const profileNameParts = profilePathParts.slice(1);
                    const profileName = profileNameParts.join(".");
                    profilesWithPendingTypeChanges.add(profileName);
                }
            }
        }
    });

    // Filter profiles by type, excluding those with pending type changes
    const profilesOfType = profileNames.filter((profileKey) => {
        // Skip profiles that have pending type changes
        if (profilesWithPendingTypeChanges.has(profileKey)) {
            return false;
        }
        const profileTypeValue = getProfileType(profileKey, selectedTab, configurations, pendingChanges, {});
        return profileTypeValue === profileType;
    });

    // Include pending profiles from pendingChanges that match the type
    const pendingProfiles = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([key, entry]) => {
        if (entry.profile) {
            // Check if the pending profile has the correct type
            const keyParts = key.split(".");
            const isTypeKey = keyParts[keyParts.length - 1] === "type";
            if (isTypeKey && entry.value === profileType) {
                // Extract the profile name from the key path
                // Remove "profiles" prefix and get just the profile name
                const profilePathParts = keyParts.slice(0, -1); // Remove "type" from the end
                if (profilePathParts[0] === "profiles") {
                    // Remove "profiles" prefix and get the actual profile name
                    const profileNameParts = profilePathParts.slice(1);
                    const profileName = profileNameParts.join(".");
                    pendingProfiles.add(profileName);
                }
            }
        }
    });
    return [...profilesOfType, ...Array.from(pendingProfiles)];
}

/**
 * Get ordered profile keys from profiles object
 */
export function getOrderedProfileKeys(
    profiles: any,
    parentKey = "",
    deletedProfiles: string[] = [],
    isProfileOrParentDeleted?: (profileKey: string, deletedProfiles: string[]) => boolean
): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

        // Add this profile key if it's not deleted
        if (!isProfileOrParentDeleted || !isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
            keys.push(qualifiedKey);
        }

        // Recursively add nested profiles
        if (profile.profiles) {
            keys.push(...getOrderedProfileKeys(profile.profiles, qualifiedKey, deletedProfiles, isProfileOrParentDeleted));
        }
    }
    return keys;
}

/**
 * Get all profile keys from profiles object (including deleted ones)
 */
export function getAllProfileKeys(profiles: any, parentKey = ""): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
        keys.push(qualifiedKey);

        // Recursively add nested profiles
        if (profile.profiles) {
            keys.push(...getAllProfileKeys(profile.profiles, qualifiedKey));
        }
    }
    return keys;
}

// Helper function to check if a profile is set as default
export const isProfileDefault = (profileKey: string): boolean => {
    const { state, setState, ...refs } = useConsolidatedState();

    const { configurations, selectedTab, pendingChanges, renames, pendingDefaults } = createStateVariables(state, setState);
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);

    if (!profileType) return false;

    // Check if this profile was renamed and get the original profile name
    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    // Check pending defaults first
    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) {
        return pendingDefault.value === profileKey || pendingDefault.value === originalProfileKey;
    }

    // Check existing defaults
    const config = configurations[selectedTab!].properties;
    const defaults = config.defaults || {};

    // Check if the current profile is the default
    if (defaults[profileType] === profileKey || defaults[profileType] === originalProfileKey) {
        return true;
    }

    // Check if this profile should be the default due to renames (simulate backend logic)
    // This handles the case where a default profile was renamed and should remain the default
    const configRenames = renames[configPath] || {};
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
        // If the original profile was the default and this is the renamed version
        if (defaults[profileType] === originalKey && newKey === profileKey) {
            return true;
        }
    }

    return false;
};

export const handleDeleteProfile = (profileKey: string, vscodeApi: any) => {
    const { state, setState, ...refs } = useConsolidatedState();
    const {
        selectedTab,
        configurations,
        renames,
        setDeletions,
        setPendingChanges,
        selectedProfileKey,
        setSelectedProfileKey,
        setSelectedProfilesByConfig,
    } = createStateVariables(state, setState);

    if (selectedTab === null) return;
    const configPath = configurations[selectedTab!]!.configPath;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = getCurrentEffectiveName(profileKey, configPath, renames);

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

    // If this profile is currently selected, or if the selected profile is a child of this profile, select the nearest profile
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
        const nearestProfileKey = findOptimalReplacementProfileHelper(profileKey, configPath);

        // Set the nearest profile as selected, or null if no profile available
        setSelectedProfileKey(nearestProfileKey);

        // Also update the stored profiles for this config
        if (configPath) {
            setSelectedProfilesByConfig((prev) => ({
                ...prev,
                [configPath]: nearestProfileKey,
            }));
        }

        // If we found a nearest profile, get its merged properties
        if (nearestProfileKey) {
            // Get the correct profile name for merged properties (handles renames)
            const profileNameForMergedProperties = getProfileNameForMergedProperties(nearestProfileKey, configPath, renames);

            const changes = formatPendingChangesHelper();
            vscodeApi.postMessage({
                command: "GET_MERGED_PROPERTIES",
                profilePath: profileNameForMergedProperties,
                configPath: configPath,
                changes: changes,
                renames: changes.renames,
            });
        }
    }
};

export function findOptimalReplacementProfileHelper(deletedProfileKey: string, configPath: string): string | null {
    const allAvailableProfiles = getAvailableProfilesForConfigHelper(configPath);

    if (allAvailableProfiles.length === 0) {
        return null;
    }

    // Strategy 1: If deleting a nested profile, prefer its parent
    if (deletedProfileKey.includes(".")) {
        const parentKey = deletedProfileKey.split(".").slice(0, -1).join(".");
        if (allAvailableProfiles.includes(parentKey)) {
            return parentKey;
        }
    }

    // Strategy 2: Find siblings (profiles at the same level)
    const deletedParts = deletedProfileKey.split(".");
    if (deletedParts.length > 1) {
        const parentKey = deletedParts.slice(0, -1).join(".");
        const siblings = allAvailableProfiles.filter((profile: any) => profile.startsWith(parentKey + ".") && profile !== deletedProfileKey);
        if (siblings.length > 0) {
            return siblings[0];
        }
    }

    // Strategy 3: Find the next profile in the list
    const currentIndex = allAvailableProfiles.indexOf(deletedProfileKey);
    if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < allAvailableProfiles.length; i++) {
            const candidate = allAvailableProfiles[i];
            if (candidate !== deletedProfileKey) {
                return candidate;
            }
        }

        for (let i = currentIndex - 1; i >= 0; i--) {
            const candidate = allAvailableProfiles[i];
            if (candidate !== deletedProfileKey) {
                return candidate;
            }
        }
    }

    // Strategy 4: Fallback
    return allAvailableProfiles[0] || null;
}

export function getAvailableProfilesForConfigHelper(configPath: string): string[] {
    const { state, setState, ...refs } = useConsolidatedState();
    const { selectedTab, configurations, deletions } = createStateVariables(state, setState);

    const profilesObj = configurations[selectedTab!]?.properties?.profiles;
    if (!profilesObj) {
        return [];
    }

    const pendingProfiles = extractPendingProfiles(configPath);
    const deletedProfiles = deletions[configPath] || [];

    // Get all available profiles (existing + pending) that are not deleted
    const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
        const available: string[] = [];
        for (const key of Object.keys(profiles)) {
            const profile = profiles[key];
            const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

            // Only include profiles that are not deleted
            if (!isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
                available.push(qualifiedKey);
            }

            // Recursively add nested profiles
            if (profile.profiles) {
                available.push(...getAvailableProfiles(profile.profiles, qualifiedKey));
            }
        }
        return available;
    };

    const existingProfiles = getAvailableProfiles(profilesObj);
    const pendingProfileKeys = Object.keys(pendingProfiles).filter(
        (key) => !existingProfiles.includes(key) && !isProfileOrParentDeleted(key, deletedProfiles)
    );

    return [...existingProfiles, ...pendingProfileKeys];
}

export const extractPendingProfiles = (configPath: string): { [key: string]: any } => {
    const { state, setState, ...refs } = useConsolidatedState();
    const { pendingChanges } = createStateVariables(state, setState);

    const pendingProfiles: { [key: string]: any } = {};

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
        if (!entry.profile) return;

        const keyParts = key.split(".");
        if (keyParts[0] !== "profiles") return;

        // Remove "profiles" prefix and get the profile path
        const profilePathParts = keyParts.slice(1);

        // Find where the profile name ends (before "type" or "properties")
        let profileNameEndIndex = profilePathParts.length;
        for (let i = 0; i < profilePathParts.length; i++) {
            if (profilePathParts[i] === "type" || profilePathParts[i] === "properties") {
                profileNameEndIndex = i;
                break;
            }
        }

        // Extract just the profile name parts
        const profileNameParts = profilePathParts.slice(0, profileNameEndIndex);

        if (profileNameParts.length > 0) {
            // Only create a pending profile entry if this is a profile-level property
            const propertyName = keyParts[keyParts.length - 1];
            const isProfileLevelProperty = propertyName === "type" || (keyParts.includes("properties") && !entry.secure);

            if (isProfileLevelProperty) {
                // Use the entry.profile as the profile key, as it represents the actual profile this change belongs to
                // This is important for moved profiles where the key structure might be different
                const actualProfileKey = entry.profile;

                // Initialize the profile structure if it doesn't exist
                if (!pendingProfiles[actualProfileKey]) {
                    pendingProfiles[actualProfileKey] = {};
                }

                // Add the property to the profile
                if (propertyName === "type") {
                    pendingProfiles[actualProfileKey].type = entry.value;
                } else if (keyParts.includes("properties")) {
                    // Only add non-secure properties to the properties object
                    if (!entry.secure) {
                        if (!pendingProfiles[actualProfileKey].properties) {
                            pendingProfiles[actualProfileKey].properties = {};
                        }
                        pendingProfiles[actualProfileKey].properties[propertyName] = entry.value;
                    }

                    // If this is a secure property, add it to the profile
                    if (entry.secure) {
                        if (!pendingProfiles[actualProfileKey].secure) {
                            pendingProfiles[actualProfileKey].secure = [];
                        }
                        if (!pendingProfiles[actualProfileKey].secure.includes(propertyName)) {
                            pendingProfiles[actualProfileKey].secure.push(propertyName);
                        }
                    }
                }
            }
        }
    });

    return pendingProfiles;
};

// Helper function to check if a profile or its parent is deleted
export const isProfileOrParentDeleted = (profileKey: string, deletedProfiles: string[]): boolean => {
    const { state, setState, ...refs } = useConsolidatedState();
    const { selectedTab, configurations, renames } = createStateVariables(state, setState);
    if (selectedTab === null) return false;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = getCurrentEffectiveName(profileKey, configurations[selectedTab!]!.configPath, renames);

    // Use the effective profile key to check the current hierarchy
    const profileParts = effectiveProfileKey.split(".");

    // Check each level of the current profile hierarchy
    for (let i = 0; i < profileParts.length; i++) {
        const currentLevelProfileKey = profileParts.slice(0, i + 1).join(".");
        let fullProfilePath: string;

        if (i === 0) {
            // Top-level profile
            fullProfilePath = `profiles.${currentLevelProfileKey}`;
        } else {
            // Nested profile - construct the full path for this specific level
            const pathArray = ["profiles"];
            for (let j = 0; j <= i; j++) {
                pathArray.push(profileParts[j]);
                if (j < i) {
                    pathArray.push("profiles");
                }
            }
            fullProfilePath = pathArray.join(".");
        }

        // If any parent profile is deleted, hide this profile
        if (deletedProfiles.includes(fullProfilePath)) {
            return true;
        }
    }
    return false;
};

export const formatPendingChangesHelper = () => {
    const { state, setState, ...refs } = useConsolidatedState();
    const { deletions, pendingChanges, renames, pendingDefaults, defaultsDeletions } = createStateVariables(state, setState);
    const changes = Object.entries(pendingChanges).flatMap(([configPath, changesForPath]) =>
        Object.keys(changesForPath).map((key) => {
            const { value, path, profile, secure } = changesForPath[key];
            return { key, value, path, profile, configPath, secure };
        })
    );

    const deleteKeys = Object.entries(deletions).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath, secure: false })));

    const defaultsChanges = Object.entries(pendingDefaults).flatMap(([configPath, changesForPath]) =>
        Object.keys(changesForPath).map((key) => {
            const { value, path } = changesForPath[key];
            return { key, value, path, configPath, secure: false };
        })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletions).flatMap(([configPath, keys]) =>
        keys.map((key) => ({ key, configPath, secure: false }))
    );

    // Prepare renames data
    const renamesData = Object.entries(renames).flatMap(([configPath, configRenames]) =>
        Object.entries(configRenames).map(([originalKey, newKey]) => ({
            originalKey,
            newKey,
            configPath,
        }))
    );

    const updatedChanges = updateChangesForRenames(changes, renamesData);

    const result = {
        changes: updatedChanges,
        deletions: deleteKeys,
        defaultsChanges,
        defaultsDeleteKeys: defaultsDeleteKeys,
        renames: renamesData,
    };

    return result;
};
