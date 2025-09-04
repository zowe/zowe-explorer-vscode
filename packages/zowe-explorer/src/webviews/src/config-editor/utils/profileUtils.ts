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
import { PendingChange } from "./configUtils";
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

    // Handle nested profiles by checking for renames at each level of nesting
    const profileParts = profileKey.split(".");
    let renamedPath = "";

    // Check if any parent profile has been renamed
    for (let i = 0; i < profileParts.length; i++) {
        const currentPath = profileParts.slice(0, i + 1).join(".");

        // Check if this current path has been renamed
        const renamed = getRenamedProfileKey(currentPath, configPath, renames);

        if (renamed !== currentPath) {
            // This path has been renamed, use the new name and continue building from there
            const remainingParts = profileParts.slice(i + 1);
            renamedPath = renamed + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
            break;
        } else if (i === 0) {
            // First part hasn't been renamed
            renamedPath = profileParts[i];
        } else {
            // This part hasn't been renamed, add it to the path
            renamedPath = renamedPath + "." + profileParts[i];
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
        // Find the original key that was renamed to this renamed key
        for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (newKey === renamedKey) {
                return originalKey;
            }
        }
    }
    return renamedKey;
}

/**
 * Get the original profile key for nested profiles, checking for renames at each level
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

    // Handle nested profiles by checking for renames at each level of nesting
    const profileParts = renamedKey.split(".");
    let originalPath = "";

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

/**
 * Get nested property from an object using a path array
 */
function getNestedProperty(obj: any, path: string[]): any {
    let current = obj;
    for (const segment of path) {
        if (current && typeof current === "object" && current.hasOwnProperty(segment)) {
            current = current[segment];
        } else {
            return undefined;
        }
    }
    return current;
}
