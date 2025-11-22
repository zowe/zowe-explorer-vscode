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

import { flattenProfiles, extractProfileKeyFromPath, pathFromArray } from "./configUtils";
import { PendingChange } from "./configUtils";
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

export function getProfileType(
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | null {
    if (selectedTab === null) return null;
    const configPath = configurations[selectedTab!]!.configPath;

    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    const pendingType = Object.entries(pendingChanges[configPath] ?? {}).find(([key, entry]) => {
        // Only match exact profile keys for type changes, not parent profiles
        if (entry.profile !== profileKey && entry.profile !== originalProfileKey) return false;
        const keyParts = key.split(".");
        return keyParts[keyParts.length - 1] === "type";
    });

    if (pendingType) {
        return pendingType[1].value as string;
    }

    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    let profile = flatProfiles[profileKey];

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

export function getRenamedProfileKey(
    originalKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    const configRenames = renames[configPath];
    return configRenames?.[originalKey] || originalKey;
}

export function getRenamedProfileKeyWithNested(
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    if (!profileKey.includes(".")) {
        return getRenamedProfileKey(profileKey, configPath, renames);
    }

    const directRename = getRenamedProfileKey(profileKey, configPath, renames);
    if (directRename !== profileKey) {
        return directRename;
    }

    const configRenames = renames[configPath] || {};
    let renamedPath = profileKey;

    let changed = true;
    while (changed) {
        changed = false;
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

export function getAvailableProfilesByType(
    profileType: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } } = {}
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
        const profileTypeValue = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
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

    // Apply renames to all profile names, including nested profiles
    const configPath = configurations[selectedTab].configPath;
    const renamedProfilesOfType = profilesOfType.map((profileKey) => getRenamedProfileKeyWithNested(profileKey, configPath, renames));
    const renamedPendingProfiles = Array.from(pendingProfiles).map((profileKey) => getRenamedProfileKeyWithNested(profileKey, configPath, renames));

    return [...renamedProfilesOfType, ...renamedPendingProfiles];
}

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

export function isPropertyActuallyInherited(
    profilePath: string,
    currentProfileKey: string | null,
    configPath: string,
    propertyName: string | undefined,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (!profilePath || !currentProfileKey) {
        return false;
    }

    // First check if the paths are exactly the same
    if (profilePath === currentProfileKey) {
        return false;
    }

    // Check if there are pending changes for this specific property in the current profile
    // If there are pending changes, the property is not inherited (it's been overridden locally)
    if (propertyName) {
        const currentProfilePath = `profiles.${currentProfileKey}`;
        const propertyPendingKey = `${currentProfilePath}.properties.${propertyName}`;

        // Also check for pending changes under the original profile path (before rename)
        // Find the original profile key by looking for what was renamed to the current key
        const configRenames = renames[configPath] || {};
        let originalProfileKey = currentProfileKey;

        // Look for the original key that was renamed to the current key
        for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (newKey === currentProfileKey) {
                originalProfileKey = originalKey;
                break;
            }
        }

        const originalProfilePath = `profiles.${originalProfileKey}`;
        const originalPropertyPendingKey = `${originalProfilePath}.properties.${propertyName}`;

        // Also check for nested path structure (for cases like zftp.zosmf -> zosmf)
        let nestedPropertyPendingKey = "";
        if (originalProfileKey.includes(".")) {
            // Construct nested path with .profiles segments
            const profileParts = originalProfileKey.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            pathParts.push("properties", propertyName);
            nestedPropertyPendingKey = pathParts.join(".");
        }

        const hasPendingChanges =
            pendingChanges[configPath]?.[propertyPendingKey] !== undefined ||
            pendingChanges[configPath]?.[originalPropertyPendingKey] !== undefined ||
            (nestedPropertyPendingKey && pendingChanges[configPath]?.[nestedPropertyPendingKey] !== undefined);

        if (hasPendingChanges) {
            return false;
        }
    }

    // Get all profile renames in the config
    const renamesForConfig = renames[configPath] || {};

    // Function to get the original profile name (reverse renames)
    const getOriginalName = (profileName: string): string => {
        let originalName = profileName;

        // Apply reverse renames iteratively to get back to the original name
        let changed = true;
        while (changed) {
            changed = false;

            // Sort renames by length of newKey (longest first) to handle nested renames correctly
            const sortedRenames = Object.entries(renamesForConfig).sort(([, a], [, b]) => b.length - a.length);

            for (const [originalKey, newKey] of sortedRenames) {
                // Check for exact match
                if (originalName === newKey) {
                    originalName = originalKey;
                    changed = true;
                    break;
                }

                // Check for partial matches (parent renames affecting children)
                if (originalName.startsWith(newKey + ".")) {
                    originalName = originalName.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                }
            }
        }

        return originalName;
    };

    // Get the original names for both paths
    const originalSourcePath = getOriginalName(profilePath);
    const originalCurrentPath = getOriginalName(currentProfileKey);

    // If the original paths match, this property is not inherited
    if (originalSourcePath === originalCurrentPath) {
        return false;
    }

    // Check if there's an actual inheritance relationship by looking at the profile configuration
    // This handles cases where profiles inherit from base profiles that have been renamed
    const config = configurations[selectedTab!]?.properties;
    if (config) {
        // Check if the current profile inherits from the source profile through the inheritance chain
        const checkInheritanceChain = (currentProfile: string, sourceProfile: string): boolean => {
            // Get the profile type for the current profile
            const currentProfileType = getProfileType(currentProfile, selectedTab, configurations, pendingChanges, renames);
            if (!currentProfileType) return false;

            // Check if the source profile is the default for this profile type
            const defaults = config.defaults || {};
            const defaultForType = defaults[currentProfileType];

            // Apply renames to the default to see if it matches the source profile
            if (defaultForType) {
                const renamedDefault = getRenamedProfileKeyWithNested(defaultForType, configPath, renames);
                if (renamedDefault === sourceProfile) {
                    return true;
                }
            }

            // Also check if the source profile is a base profile that the current profile should inherit from
            // This handles cases where the source profile is a base profile (like global_base1)
            const sourceProfileType = getProfileType(sourceProfile, selectedTab, configurations, pendingChanges, renames);
            if (sourceProfileType && sourceProfileType === currentProfileType) {
                // If both profiles have the same type and the source is a base profile, it's inherited
                // Check if the source profile is a base profile by checking if it's the default for its type
                const sourceDefaultForType = defaults[sourceProfileType];
                if (sourceDefaultForType) {
                    const renamedSourceDefault = getRenamedProfileKeyWithNested(sourceDefaultForType, configPath, renames);
                    if (renamedSourceDefault === sourceProfile) {
                        return true;
                    }
                }
            }

            return false;
        };

        // Check if the current profile inherits from the source profile
        if (checkInheritanceChain(currentProfileKey, profilePath)) {
            return true;
        }
    }

    return true;
}

export function mergePendingChangesForProfile(
    baseObj: any,
    path: string[],
    configPath: string,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): any {
    const fullPath = path.join(".");
    const currentProfileKey = extractProfileKeyFromPath(path);
    const pendingChangesAtLevel: { [key: string]: any } = {};

    // Check if this profile was renamed and get the original profile name (handle nested profiles)
    const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

    // Helper function to check if a profile key matches considering renames
    const isProfileKeyMatch = (entryProfileKey: string): boolean => {
        // Direct match with current or original profile key
        if (entryProfileKey === currentProfileKey || entryProfileKey === originalProfileKey) {
            return true;
        }

        // For nested profiles, check if this entry's profile key would match after applying renames
        if (entryProfileKey.includes(".") || currentProfileKey.includes(".")) {
            // Get the renamed version of the entry's profile key
            const renamedEntryProfileKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
            if (renamedEntryProfileKey === currentProfileKey) {
                return true;
            }

            // Also check if the current profile key, when reversed through renames, matches the entry
            const originalOfCurrentKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);
            if (entryProfileKey === originalOfCurrentKey) {
                return true;
            }

            // For deeply nested profiles, check if the entry profile key is an ancestor or descendant
            // after applying renames at each level
            const entryParts = entryProfileKey.split(".");
            const currentParts = currentProfileKey.split(".");

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
                if (renamedEntryParentKey === currentProfileKey) {
                    return true;
                }
            }
        }

        return false;
    };

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
        // Check if the entry belongs to the current profile considering renames
        if (isProfileKeyMatch(entry.profile) && (key === fullPath || key.startsWith(fullPath + "."))) {
            const keyParts = key.split(".");
            const relativePath = keyParts.slice(path.length);

            if (relativePath.length === 1 && !entry.secure) {
                pendingChangesAtLevel[relativePath[0]] = entry.value;
            } else if (relativePath.length > 1 && relativePath[0] !== "profiles" && !entry.secure) {
                let current = baseObj;
                for (let i = 0; i < relativePath.length - 1; i++) {
                    if (!current[relativePath[i]]) {
                        current[relativePath[i]] = {};
                    }
                    current = current[relativePath[i]];
                }
                current[relativePath[relativePath.length - 1]] = entry.value;
            } else if (entry.secure && path[path.length - 1] !== "properties") {
                // Handle secure properties - they should be added to the secure array
                // Only add to parent profile's secure array, not properties object's secure array
                // Ensure secure array exists
                if (!baseObj.secure) {
                    baseObj.secure = [];
                }

                // For secure properties, the key format is typically "profiles.profileName.secure.propertyName"
                // We need to extract the property name from the key
                const keyParts = key.split(".");
                const propertyName = keyParts[keyParts.length - 1];

                // Add the secure property name to the secure array if not already present
                if (!baseObj.secure.includes(propertyName)) {
                    baseObj.secure.push(propertyName);
                }
            }
        }
    });

    const result = { ...baseObj, ...pendingChangesAtLevel };

    return result;
}

export function isMergedPropertySecure(_displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean): boolean {
    if (!jsonLoc) return false;

    // If we have the secure status from the merged properties data, use it
    if (secure !== undefined) {
        return secure;
    }

    // Otherwise, check if the property is in the secure array of the source profile
    // This is a fallback for cases where the secure status isn't explicitly provided
    // We can't easily determine this without more context, so we'll return false as a safe default
    return false;
}

export function getProfileTypeFromPath(path: string[]): string | null {
    if (path.length < 2 || path[0] !== "profiles") {
        return null;
    }

    // Find the profile name in the path
    let profileName = "";
    for (let i = 1; i < path.length; i++) {
        if (path[i] !== "profiles" && path[i] !== "properties" && path[i] !== "secure") {
            profileName = path[i];
            break;
        }
    }

    return profileName || null;
}

export function canPropertyBeSecure(
    displayKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } },
    selectedProfileKey?: string | null
): boolean {
    if (!displayKey || selectedTab === null) {
        return false;
    }

    const config = configurations[selectedTab];
    if (!config) {
        return false;
    }

    const configPath = config.configPath;
    const schemaValidation = schemaValidations[configPath];

    if (!schemaValidation) {
        return false;
    }

    // For add profile modal, we can use the selectedProfileKey to get the profile type
    if (selectedProfileKey) {
        const currentProfileType = getProfileTypeFn(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
        if (currentProfileType) {
            const propertySchema = schemaValidation.propertySchema[currentProfileType] || {};
            return propertySchema[displayKey]?.secure === true;
        }
    }

    // Fallback: check all profile types for this property
    if (schemaValidation.propertySchema) {
        for (const profileType in schemaValidation.propertySchema) {
            const propertySchema = schemaValidation.propertySchema[profileType];
            if (propertySchema[displayKey]?.secure === true) {
                return true;
            }
        }
    }

    return false;
}

export function isPropertySecure(
    fullKey: string,
    displayKey: string,
    path: string[],
    mergedProps?: any,
    selectedTab?: number | null,
    configurations?: Configuration[],
    pendingChanges?: { [configPath: string]: { [key: string]: PendingChange } },
    renames?: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (!displayKey || !path || path.length === 0) {
        return false;
    }

    // If this is a merged property, check if it's secure from the merged data
    if (mergedProps && mergedProps[displayKey]) {
        const mergedPropData = mergedProps[displayKey];
        if (mergedPropData.secure !== undefined) {
            return mergedPropData.secure;
        }
    }

    // Check if this property is in pending changes with secure flag
    if (selectedTab !== null && selectedTab !== undefined && configurations && pendingChanges) {
        const config = configurations[selectedTab];
        if (config) {
            const configPath = config.configPath;
            const pendingChange = pendingChanges[configPath]?.[fullKey];
            if (pendingChange && pendingChange.secure !== undefined) {
                return pendingChange.secure;
            }
        }
    }

    // Check if this property is in the secure array of the current configuration
    if (selectedTab !== null && selectedTab !== undefined && configurations) {
        const config = configurations[selectedTab];
        if (config) {
            // Extract the property name from the full key (last part of the path)
            const keyParts = fullKey.split(".");
            const propertyName = keyParts[keyParts.length - 1];

            // First check the global secure array
            if (config.secure && config.secure.includes(propertyName)) {
                return true;
            }

            // Direct check for profile secure array - simplified approach
            if (path.length >= 2 && path[0] === "profiles" && path[1] && path[2] === "properties") {
                const profileName = path[1];
                const profile = config.properties?.profiles?.[profileName];
                if (profile && profile.secure && Array.isArray(profile.secure) && profile.secure.includes(propertyName)) {
                    return true;
                }
            }

            // Then check the profile's secure array
            // The path should be something like ["profiles", "profileName", "properties", "propertyName"]
            // For nested profiles, it might be ["profiles", "parentProfile", "profiles", "nestedProfile", "properties", "propertyName"]
            // We need to find the profile and check its secure array
            if (path.length >= 2 && path[0] === "profiles") {
                // Extract the current profile name from the path
                const currentProfileName = extractProfileKeyFromPath(path);

                // Check if this profile has been renamed
                let profileToCheck = currentProfileName;
                if (renames && config && renames[config.configPath]) {
                    // Check if the current profile name is a renamed version
                    for (const [originalKey, newKey] of Object.entries(renames[config.configPath])) {
                        if (newKey === currentProfileName) {
                            profileToCheck = originalKey;
                            break;
                        }
                    }

                    // Also check if this is a nested profile created by drag and drop
                    // For nested profiles like "test.zosmf", check if the last part matches an original profile
                    if (profileToCheck === currentProfileName && currentProfileName.includes(".")) {
                        const profileParts = currentProfileName.split(".");
                        const lastPart = profileParts[profileParts.length - 1];

                        // Check if the last part of the nested profile matches an original profile
                        const originalLastPart = getOriginalProfileKeyWithNested(lastPart, config.configPath, renames);

                        // Check if the original last part matches an original profile in the renames mapping
                        for (const [originalKey, _] of Object.entries(renames[config.configPath])) {
                            if (originalKey === originalLastPart) {
                                profileToCheck = originalKey;
                                break;
                            }
                        }
                    }
                }

                // For nested profiles, we need to navigate through the profile hierarchy
                let currentProfile = config.properties?.profiles;
                let i = 1;

                // Navigate through the actual path structure to find the profile
                while (i < path.length && currentProfile) {
                    const currentPathSegment = path[i];
                    const nextPathSegment = path[i + 1];

                    if (nextPathSegment === "profiles") {
                        // This is a nested profile, go deeper
                        currentProfile = currentProfile[currentPathSegment]?.profiles;
                        i += 2; // Skip "profiles" and move to next profile name
                    } else if (nextPathSegment === "properties") {
                        // We've reached the properties level, check the secure array
                        if (
                            currentProfile[currentPathSegment] &&
                            currentProfile[currentPathSegment].secure &&
                            Array.isArray(currentProfile[currentPathSegment].secure)
                        ) {
                            const isSecure = currentProfile[currentPathSegment].secure.includes(propertyName);

                            return isSecure;
                        }
                        break;
                    } else {
                        // This shouldn't happen in a valid path
                        break;
                    }
                }

                // If we didn't find the secure array in the nested structure, try to find it in the original profile
                // This handles multiple cases:
                // 1. Root → Nested: global_base → z.global_base
                // 2. Nested → Nested: z.global_base → y.global_base
                // 3. Nested → Root: z.global_base → global_base
                if (profileToCheck && profileToCheck !== currentProfileName) {
                    // For case 3 (Nested → Root), we need to look up the current profile name in root level,
                    // not the old nested profile name
                    let profileToLookup = profileToCheck;

                    // If we're moving from nested to root, the current profile name should exist in root level
                    if (currentProfileName && !currentProfileName.includes(".") && profileToCheck.includes(".")) {
                        profileToLookup = currentProfileName;
                    }

                    // Look up the profile in the root level
                    const rootProfile = config.properties?.profiles?.[profileToLookup];
                    if (rootProfile && rootProfile.secure && Array.isArray(rootProfile.secure)) {
                        const isSecure = rootProfile.secure.includes(propertyName);

                        return isSecure;
                    } else {
                    }
                }

                // if we're dealing with a nested profile that was itself created from a rename,
                // we need to check if the original profile (before any renames) has secure properties
                // This handles cases like: global_base → global_base1 → z.global_base1
                if (renames && config && renames[config.configPath]) {
                    // Find the ultimate original profile name by tracing through all renames
                    let ultimateOriginalProfile = profileToCheck;
                    let foundOriginal = false;

                    // Trace back through the rename chain to find the ultimate original
                    for (const [originalKey, newKey] of Object.entries(renames[config.configPath])) {
                        if (newKey === ultimateOriginalProfile) {
                            ultimateOriginalProfile = originalKey;
                            foundOriginal = true;
                            break;
                        }
                    }

                    if (foundOriginal && ultimateOriginalProfile !== profileToCheck) {
                        const ultimateProfile = config.properties?.profiles?.[ultimateOriginalProfile];
                        if (ultimateProfile && ultimateProfile.secure && Array.isArray(ultimateProfile.secure)) {
                            const isSecure = ultimateProfile.secure.includes(propertyName);

                            return isSecure;
                        } else {
                        }
                    } else {
                    }
                }

                // Final fallback: if we're moving from one nested profile to another (or to root) and the original nested profile still exists,
                // look up the secure properties from the original nested profile
                // This handles multiple cases:
                // 1. z.global_base → global_base (nested → root)
                // 2. z.global_base → y.global_base (nested → nested)
                // 3. x.y.global_base → z.global_base (multi-level nested → nested)
                if (profileToCheck && profileToCheck.includes(".")) {
                    // Try to find the original nested profile in the configuration
                    const nestedProfileParts = profileToCheck.split(".");
                    let nestedProfile = config.properties?.profiles;

                    // Navigate to the nested profile
                    for (let i = 0; i < nestedProfileParts.length - 1; i++) {
                        nestedProfile = nestedProfile?.[nestedProfileParts[i]]?.profiles;
                    }

                    const finalProfileName = nestedProfileParts[nestedProfileParts.length - 1];
                    const originalNestedProfile = nestedProfile?.[finalProfileName];

                    if (originalNestedProfile && originalNestedProfile.secure && Array.isArray(originalNestedProfile.secure)) {
                        const isSecure = originalNestedProfile.secure.includes(propertyName);

                        return isSecure;
                    } else {
                    }
                }
            }
        }
    }

    return false;
}

export function handleToggleSecure(
    fullKey: string,
    displayKey: string,
    path: string[],
    selectedTab?: number | null,
    configurations?: Configuration[],
    pendingChanges?: { [configPath: string]: { [key: string]: PendingChange } },
    setPendingChanges?: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingChange } }>>,
    selectedProfileKey?: string | null,
    renames?: { [configPath: string]: { [originalKey: string]: string } }
): void {
    if (selectedTab === null || selectedTab === undefined || !configurations || !pendingChanges || !setPendingChanges) {
        return;
    }

    const config = configurations[selectedTab];
    if (!config) {
        return;
    }

    const configPath = config.configPath;
    const currentPendingChange = pendingChanges[configPath]?.[fullKey];

    // Get the current secure status
    const currentSecure = isPropertySecure(fullKey, displayKey, path, undefined, selectedTab, configurations, pendingChanges, renames);

    // Determine the profile key
    let profileKey = selectedProfileKey || extractProfileKeyFromPath(path);
    if (selectedProfileKey && renames && renames[configPath]) {
        profileKey = getRenamedProfileKeyWithNested(selectedProfileKey, configPath, renames);
    }

    // Toggle the secure status
    const newSecure = !currentSecure;

    // Update pending changes
    setPendingChanges((prev) => ({
        ...prev,
        [configPath]: {
            ...prev[configPath],
            [fullKey]: {
                ...currentPendingChange,
                value: currentPendingChange?.value || "",
                path,
                profile: profileKey,
                secure: newSecure,
            },
        },
    }));
}

export function hasPendingSecureChanges(configPath: string, pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }): boolean {
    const configPendingChanges = pendingChanges[configPath];
    if (!configPendingChanges) return false;

    return Object.values(configPendingChanges).some((change) => change.secure === true);
}

export function extractPendingProfiles(pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }, configPath: string): string[] {
    const configPendingChanges = pendingChanges[configPath];
    if (!configPendingChanges) return [];

    const profiles = new Set<string>();

    Object.entries(configPendingChanges).forEach(([_key, change]) => {
        if (change.profile) {
            profiles.add(change.profile);
        }
    });

    return Array.from(profiles);
}

export function isProfileOrParentDeleted(profileKey: string, deletions: { [configPath: string]: string[] }, configPath: string): boolean {
    const configDeletions = deletions[configPath];
    if (!configDeletions) return false;

    // Extract profile names from deletion keys (deletion keys are full paths like "profiles.profile1.profiles.profile2")
    const deletedProfiles = new Set<string>();
    configDeletions.forEach((key) => {
        // Extract profile name from deletion key
        const keyParts = key.split(".");
        if (keyParts[0] === "profiles" && keyParts.length >= 2) {
            // Handle all profile types (simple, nested, deeply nested)
            // The deletion key structure is: profiles.profile1.profiles.profile2.profiles.profile3...
            // We need to extract: profile1.profile2.profile3...
            const profileParts: string[] = [];
            for (let i = 1; i < keyParts.length; i++) {
                if (keyParts[i] !== "profiles") {
                    profileParts.push(keyParts[i]);
                }
            }
            const profileName = profileParts.join(".");
            deletedProfiles.add(profileName);
        }
    });

    // Check if the profile itself is deleted
    if (deletedProfiles.has(profileKey)) {
        return true;
    }

    // Check if any parent profile is deleted
    const profileParts = profileKey.split(".");
    for (let i = 1; i < profileParts.length; i++) {
        const parentKey = profileParts.slice(0, i).join(".");
        if (deletedProfiles.has(parentKey)) {
            return true;
        }
    }

    return false;
}

export function mergeMergedProperties(
    combinedConfig: any,
    path: string[],
    mergedProps: any,
    configPath: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } },
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    deletions: { [configPath: string]: string[] },
    showMergedProperties?: string
): any {
    if (!mergedProps || path.length === 0 || path[path.length - 1] === "type" || path[path.length - 1] === "secure") {
        return combinedConfig;
    }

    // Only process at profile level, not properties level
    if (path[path.length - 1] === "properties") {
        return combinedConfig;
    }

    // Ensure properties object exists
    if (!combinedConfig.hasOwnProperty("properties")) {
        combinedConfig.properties = {};
    }

    const currentProfileName = extractProfileKeyFromPath(path);
    const profileType = getProfileType(currentProfileName, selectedTab, configurations, pendingChanges, renames);
    const propertySchema = schemaValidations[configPath]?.propertySchema[profileType || ""] || {};
    const allowedProperties = Object.keys(propertySchema);
    const fullPath = path.join(".");

    const currentProfileKey = extractProfileKeyFromPath(path);

    // Find the original profile key by looking for what was renamed to the current key
    const configRenames = renames[configPath] || {};
    let originalProfileKey = currentProfileKey;

    // Look for the original key that was renamed to the current key
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
        if (newKey === currentProfileKey) {
            originalProfileKey = originalKey;
            break;
        }
    }

    // Note: Removed early return for renamed profiles to ensure merged properties are always displayed

    if (currentProfileKey !== originalProfileKey) {
    }

    Object.entries(mergedProps).forEach(([key, propData]: [string, any]) => {
        const pendingKey = `${fullPath}.properties.${key}`;

        // Check for pending changes using both current path and original path (considering renames)
        const currentProfileKey = extractProfileKeyFromPath(path);
        const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

        // Construct the original path for pending changes lookup
        // For nested profiles, we need to include "profiles" segments between profile levels
        let originalPath: string;
        if (originalProfileKey.includes(".")) {
            // This is a nested profile - construct the full path with "profiles" segments
            const profileParts = originalProfileKey.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            originalPath = pathParts.join(".");
        } else {
            originalPath = `profiles.${originalProfileKey}`;
        }

        const originalPendingKey = `${originalPath}.properties.${key}`;

        const isInPendingChanges =
            pendingChanges[configPath]?.[pendingKey] !== undefined || pendingChanges[configPath]?.[originalPendingKey] !== undefined;

        // Check for deletions using the same enhanced path logic as pending changes
        let isInDeletions = (deletions[configPath] ?? []).includes(pendingKey) || (deletions[configPath] ?? []).includes(originalPendingKey);

        if (!isInDeletions && originalProfileKey.includes(".")) {
            const profileParts = originalProfileKey.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            pathParts.push("properties", key);
            const nestedPendingKey = pathParts.join(".");
            isInDeletions = (deletions[configPath] ?? []).includes(nestedPendingKey);
        }

        // If showMergedProperties is "unfiltered", skip schema validation and show ALL merged properties
        // Otherwise, only show properties that are valid for the current profile type
        const isAllowedBySchema = showMergedProperties === "unfiltered" || allowedProperties.includes(key);

        // If the property is in deletions, we should add the merged property to replace it
        // For secure properties that were deleted, we still want to show the merged property in properties
        const shouldAddMerged =
            isAllowedBySchema && !isInPendingChanges && (isInDeletions || !combinedConfig.properties.hasOwnProperty(key));

        if (shouldAddMerged) {
            // Only add primitive values to avoid recursion
            if (typeof propData.value !== "object" || propData.value === null) {
                combinedConfig.properties[key] = propData.value;
            }
        }
    });

    return combinedConfig;
}

export function ensureProfileProperties(combinedConfig: any, path: string[]): any {
    if (path.length > 0 && path[path.length - 1] !== "type" && path[path.length - 1] !== "properties" && path[path.length - 1] !== "secure") {
        if (!combinedConfig.hasOwnProperty("properties")) {
            combinedConfig.properties = {};
        }
        if (!combinedConfig.hasOwnProperty("secure")) {
            combinedConfig.secure = [];
        }
        if (!combinedConfig.hasOwnProperty("type")) {
            combinedConfig.type = "";
        }
    }
    return combinedConfig;
}

export function filterSecureProperties(
    value: any,
    combinedConfig: any,
    configPath: string | undefined,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    deletions: { [configPath: string]: string[] },
    mergedProps?: any
): any {
    if (combinedConfig.secure && Array.isArray(combinedConfig.secure)) {
        const secureProperties = combinedConfig.secure;
        const filteredProperties = { ...value };

        Object.keys(filteredProperties).forEach((propKey) => {
            if (secureProperties.includes(propKey)) {
                // Check if this property is in merged properties and has secure: false
                // If so, don't filter it out even though it's in the local secure array
                const isInsecureInMergedProps = mergedProps && mergedProps[propKey] && mergedProps[propKey].secure === false;

                // Don't filter out properties that are in the deletions list (they should be shown as merged properties)
                const isInDeletions = configPath && (deletions[configPath] ?? []).some((deletion) => deletion.includes(`properties.${propKey}`));

                // Don't filter out secure properties if there's a pending insecure property with the same key
                // This prevents the secure property from being rendered when it will be replaced
                const hasPendingInsecureProperty =
                    configPath &&
                    pendingChanges[configPath] &&
                    Object.entries(pendingChanges[configPath]).some(([key, entry]) => {
                        const keyParts = key.split(".");
                        const propertyName = keyParts[keyParts.length - 1];
                        return propertyName === propKey && !entry.secure && key.includes("properties");
                    });

                if (!isInDeletions && !hasPendingInsecureProperty && !isInsecureInMergedProps) {
                    delete filteredProperties[propKey];
                }
            }
        });

        return Object.keys(filteredProperties).length === 0 ? null : filteredProperties;
    }
    return value;
}

export function mergePendingSecureProperties(
    value: any[],
    path: string[],
    configPath: string,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames?: { [configPath: string]: { [originalKey: string]: string } }
): any[] {
    const pendingSecureProps: string[] = Object.entries(pendingChanges[configPath] ?? {})
        .filter(([, entry]) => {
            if (!entry.secure) return false;

            const expectedSecurePath = pathFromArray(path.concat(["secure"]));
            const actualPath = path.join(".");

            let currentProfileName: string;
            if (path.length >= 2 && path[0] === "profiles") {
                const profileSegments = [];
                for (let i = 1; i < path.length; i++) {
                    if (path[i] !== "profiles" && path[i] !== "secure") {
                        profileSegments.push(path[i]);
                    }
                }
                currentProfileName = profileSegments.join(".");
            } else {
                currentProfileName = path[1] || "";
            }

            // Check if the entry profile matches the current profile name
            // This handles both direct matches and renamed profiles
            const entryProfileMatches =
                entry.profile === currentProfileName || entry.profile.split(".").slice(0, -2).join(".") === currentProfileName;

            // check if this is a renamed profile by looking at the renames mapping
            let renamedProfileMatches = false;
            if (renames && renames[configPath]) {
                // Check if the current profile name is a renamed version of the entry profile
                for (const [originalKey, newKey] of Object.entries(renames[configPath])) {
                    if (newKey === currentProfileName && originalKey === entry.profile) {
                        renamedProfileMatches = true;
                        break;
                    }
                    // check for nested profile renames
                    if (newKey.startsWith(currentProfileName + ".") && originalKey.startsWith(entry.profile + ".")) {
                        renamedProfileMatches = true;
                        break;
                    }
                }

                // check if the entry profile is a renamed version of the current profile name
                // This handles the case where the entry.profile has been updated to the new name
                for (const [originalKey, newKey] of Object.entries(renames[configPath])) {
                    if (originalKey === currentProfileName && newKey === entry.profile) {
                        renamedProfileMatches = true;
                        break;
                    }
                    // Also check for nested profile renames
                    if (originalKey.startsWith(currentProfileName + ".") && newKey.startsWith(entry.profile + ".")) {
                        renamedProfileMatches = true;
                        break;
                    }
                }
            }

            return actualPath === expectedSecurePath && (entryProfileMatches || renamedProfileMatches);
        })
        .map(([, entry]) => String(entry.path[entry.path.length - 1]));

    const baseArray: any[] = Array.isArray(value) ? value : [];

    // Filter out secure properties from the base array if there's a pending insecure property with the same key
    const filteredBaseArray = baseArray.filter((prop) => {
        const hasPendingInsecureProperty = Object.entries(pendingChanges[configPath] ?? {}).some(([key, entry]) => {
            const keyParts = key.split(".");
            const propertyName = keyParts[keyParts.length - 1];
            return propertyName === prop && !entry.secure && key.includes("properties");
        });
        return !hasPendingInsecureProperty;
    });

    // add pending secure props that aren't already in the filtered base array
    const newSecureProps = pendingSecureProps.filter((prop) => !filteredBaseArray.includes(prop));
    const result = newSecureProps.length > 0 ? [...filteredBaseArray, ...newSecureProps] : filteredBaseArray;
    // sort alphabetically
    return result.sort();
}

export function isPropertyFromMergedProps(
    displayKey: string | undefined,
    path: string[],
    mergedProps: any,
    configPath: string,
    showMergedProperties: string | boolean,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } },
    selectedProfileKey: string | null,
    isPropertyActuallyInherited: (
        profilePath: string,
        currentProfileKey: string | null,
        configPath: string,
        propertyName: string | undefined,
        selectedTab: number | null,
        configurations: Configuration[],
        pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
        renames: { [configPath: string]: { [originalKey: string]: string } }
    ) => boolean
): boolean {
    // consider properties as merged if showMergedProperties is not "hide" and profile is not untyped
    const originalProfileKey = extractProfileKeyFromPath(path);
    const currentProfileKey = getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames);
    const currentProfileType = getProfileType(currentProfileKey, selectedTab, configurations, pendingChanges, renames);
    const isProfileUntyped = !currentProfileType || currentProfileType.trim() === "";

    if (showMergedProperties === "hide" || showMergedProperties === false || isProfileUntyped || !displayKey) {
        return false;
    }

    const mergedPropData = mergedProps?.[displayKey];
    const jsonLoc = mergedPropData?.jsonLoc;
    const osLoc = mergedPropData?.osLoc;

    // Extract profile path from jsonLoc
    const jsonLocParts = jsonLoc ? jsonLoc.split(".") : [];
    const profilePathParts = jsonLocParts.slice(1, -2);
    const profilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

    // Check if this property is actually inherited
    const isInherited = isPropertyActuallyInherited(
        profilePath,
        currentProfileKey,
        configPath,
        displayKey,
        selectedTab,
        configurations,
        pendingChanges,
        renames
    );

    // case: if isPropertyActuallyInherited returns false but this is a profile with the same name
    // in a different config file, we should still consider it as inherited
    const isSameProfileNameInDifferentConfig = (() => {
        if (isInherited) return false; // Already handled by isPropertyActuallyInherited

        // Check if the profile names match (indicating same profile name in different configs)
        if (profilePath === currentProfileKey) {
            // Check if the source comes from a different config file
            const selectedConfigPath = configurations[selectedTab!]?.configPath;
            const osLocString = osLoc.join("");
            return selectedConfigPath !== osLocString;
        }

        return false;
    })();

    if (!isInherited && !isSameProfileNameInDifferentConfig) {
        return false;
    }

    const selectedConfigPath = configurations[selectedTab!]?.configPath;
    const osLocString = osLoc.join("");
    const pathsEqual = selectedConfigPath === osLocString;
    const currentProfilePathForComparison = path.slice(0, -1).join(".");

    // Check if this profile has been renamed
    const currentlyViewedProfileKey = selectedProfileKey;
    const hasBeenRenamed =
        currentlyViewedProfileKey && Object.values(renames[configPath] || {}).some((newName) => newName === currentlyViewedProfileKey);

    if (hasBeenRenamed) {
        // Extract profile name from jsonLoc
        const jsonLocParts = jsonLoc ? jsonLoc.split(".") : [];
        let jsonLocProfileName = "";

        if (jsonLocParts.length >= 2 && jsonLocParts[0] === "profiles") {
            let profileParts = [];
            let i = 1;

            while (i < jsonLocParts.length) {
                if (jsonLocParts[i] !== "profiles" && jsonLocParts[i] !== "properties") {
                    profileParts.push(jsonLocParts[i]);
                    i++;
                } else if (jsonLocParts[i] === "profiles") {
                    i++;
                } else if (jsonLocParts[i] === "properties") {
                    break;
                } else {
                    i++;
                }
            }
            jsonLocProfileName = profileParts.join(".");
        }

        // Get the full profile path for the current profile and jsonLoc profile
        const currentProfileParts = currentlyViewedProfileKey ? currentlyViewedProfileKey.split(".") : [];
        const jsonLocProfileParts = jsonLocProfileName ? jsonLocProfileName.split(".") : [];

        // Check if the jsonLoc profile name matches the current profile (considering renames)
        const jsonLocRefersToCurrentProfile = (() => {
            // Direct match
            if (jsonLocProfileName === currentlyViewedProfileKey) return true;

            // Check if this is a child profile and its path matches after considering renames
            const currentProfilePath = currentProfileParts.join(".");
            const jsonLocPath = jsonLocProfileParts.join(".");

            // If the jsonLoc path matches the current path exactly (after any renames)
            if (jsonLocPath === currentProfilePath) return true;

            // If we're looking at a child profile, check if its full path matches after parent rename
            if (currentProfileParts.length > 1) {
                const parentProfilePath = currentProfileParts.slice(0, -1).join(".");
                const originalParentKey = Object.keys(renames[configPath] || {}).find(
                    (oldName) => renames[configPath][oldName] === parentProfilePath
                );

                if (originalParentKey) {
                    // Reconstruct the original path using the parent's old name
                    const childName = currentProfileParts[currentProfileParts.length - 1];
                    const originalPath = `${originalParentKey}.${childName}`;
                    return jsonLocPath === originalPath;
                }
            }

            return false;
        })();

        // Check if the jsonLoc profile name is the OLD name that maps to the current profile
        const jsonLocIsOldNameOfCurrentProfile =
            jsonLocProfileName &&
            Object.keys(renames[configPath] || {}).some(
                (oldName) => oldName === jsonLocProfileName && renames[configPath][oldName] === currentlyViewedProfileKey
            );

        // Check if the jsonLoc refers to a child profile of a renamed parent
        const isFromChildOfRenamedParent =
            currentlyViewedProfileKey &&
            jsonLocProfileName &&
            Object.entries(renames[configPath] || {}).some(([oldName, newName]) => {
                // Check if current profile is a child of the new parent name
                const isCurrentProfileChildOfNewParent = currentlyViewedProfileKey.startsWith(newName + ".");
                // Check if jsonLoc refers to the old parent name
                const jsonLocRefersToOldParent = jsonLocProfileName === oldName;
                return isCurrentProfileChildOfNewParent && jsonLocRefersToOldParent;
            });

        const result = !pathsEqual || (!jsonLocRefersToCurrentProfile && !jsonLocIsOldNameOfCurrentProfile && !isFromChildOfRenamedParent);

        return result;
    } else {
        // For non-renamed profiles, use the original logic
        const jsonLocIndicatesDifferentProfile = jsonLoc && !jsonLoc.includes(currentProfilePathForComparison + ".properties");

        // Check if this property comes from a profile with the same name in a different config file
        // This handles the case where profiles with the same name exist in different configs (e.g., "zosmf" in both user and project configs)
        const isFromSameProfileNameInDifferentConfig = (() => {
            if (!jsonLoc || !osLoc || !selectedConfigPath) return false;

            // Extract the profile name from jsonLoc
            const jsonLocParts = jsonLoc.split(".");
            const profilePathParts = jsonLocParts.slice(1, -2);
            const sourceProfilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

            // Get the current profile name being viewed
            const currentProfileName = extractProfileKeyFromPath(path);

            // Check if the source profile name matches the current profile name but comes from a different config
            const osLocString = osLoc.join("");
            const isDifferentConfig = selectedConfigPath !== osLocString;
            const isSameProfileName = sourceProfilePath === currentProfileName;

            return isDifferentConfig && isSameProfileName;
        })();

        const result = !pathsEqual || jsonLocIndicatesDifferentProfile || isFromSameProfileNameInDifferentConfig;

        return result;
    }
}
