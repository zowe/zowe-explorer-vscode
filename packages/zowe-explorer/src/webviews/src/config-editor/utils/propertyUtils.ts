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

import { extractProfileKeyFromPath } from "./configUtils";
import { getProfileType } from "./profileUtils";
import { PendingChange } from "./configUtils";
import { schemaValidation, Configuration } from "./profileUtils";
// Types

/**
 * Get property type for add profile modal
 */
export function getPropertyTypeForAddProfile(
    propertyKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    selectedProfileKey: string | null,
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | undefined {
    if (selectedTab === null) return undefined;

    // Try to get the profile type from the current selected profile
    const currentProfileType = selectedProfileKey ? getProfileTypeFn(selectedProfileKey, selectedTab, configurations, pendingChanges, renames) : null;
    if (currentProfileType) {
        const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[currentProfileType] || {};
        return propertySchema[propertyKey]?.type;
    }

    // Fallback: check all profile types for this property
    const configPath = configurations[selectedTab].configPath;
    const schemaValidation = schemaValidations[configPath];
    if (schemaValidation?.propertySchema) {
        for (const profileType in schemaValidation.propertySchema) {
            const propertySchema = schemaValidation.propertySchema[profileType];
            if (propertySchema[propertyKey]?.type) {
                return propertySchema[propertyKey].type;
            }
        }
    }

    return undefined;
}

/**
 * Get property type for the main config editor
 */
export function getPropertyTypeForConfigEditor(
    propertyKey: string,
    profilePath: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | undefined {
    if (selectedTab === null) return undefined;

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(profilePath);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileTypeFn(profileKey, selectedTab, configurations, pendingChanges, renames);

    if (resolvedType) {
        const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[resolvedType] || {};
        return propertySchema[propertyKey]?.type;
    }

    // Fallback: check all profile types for this property
    const configPath = configurations[selectedTab].configPath;
    const schemaValidation = schemaValidations[configPath];
    if (schemaValidation?.propertySchema) {
        for (const profileType in schemaValidation.propertySchema) {
            const propertySchema = schemaValidation.propertySchema[profileType];
            if (propertySchema[propertyKey]?.type) {
                return propertySchema[propertyKey].type;
            }
        }
    }

    return undefined;
}

/**
 * Get options for input key for profile dropdown
 */
export function fetchTypeOptions(
    path: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string[] {
    const { configPath } = configurations[selectedTab!]!;

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(path);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileTypeFn(profileKey, selectedTab, configurations, pendingChanges, renames);

    // Get all available property schemas from all profile types
    const allPropertyKeys = new Set<string>();
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
        // If profile has a type, get properties from that type
        Object.keys(propertySchema[resolvedType]).forEach((key) => allPropertyKeys.add(key));
    } else {
        // If no type is selected, get properties from all available types
        Object.values(propertySchema).forEach((typeSchema: any) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.keys(typeSchema).forEach((key) => allPropertyKeys.add(key));
            }
        });
    }

    // Get existing properties for this profile (both from current profile and pending changes)
    const existingProperties = new Set<string>();

    // Get properties from the current profile
    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const currentProfile = flatProfiles[profileKey];
    if (currentProfile && currentProfile.properties) {
        Object.keys(currentProfile.properties).forEach((key) => existingProperties.add(key));
    }

    // Get secure properties from the current profile
    if (currentProfile && currentProfile.secure && Array.isArray(currentProfile.secure)) {
        currentProfile.secure.forEach((key: string) => existingProperties.add(key));
    }

    // Get properties from pending changes for this profile
    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
        if (entry.profile === profileKey) {
            const keyParts = key.split(".");
            if (keyParts.includes("properties")) {
                const propertyName = keyParts[keyParts.length - 1];
                existingProperties.add(propertyName);
            }
            // Also check for secure properties in pending changes
            if (entry.secure) {
                const propertyName = keyParts[keyParts.length - 1];
                existingProperties.add(propertyName);
            }
        }
    });

    // Get deleted properties for this profile and remove them from existing properties
    const deletedProperties = new Set<string>();
    // Note: deletions parameter would need to be passed to this function
    // For now, we'll skip this part as it requires additional context

    // Remove deleted properties from existing properties (so they become available again)
    deletedProperties.forEach((deletedProperty) => {
        existingProperties.delete(deletedProperty);
    });

    // Filter out existing properties from the available options
    return Array.from(allPropertyKeys).filter((key) => !existingProperties.has(key));
}

/**
 * Flatten profiles helper function (imported from configUtils)
 */
function flattenProfiles(profiles: any, parentKey = "", result: Record<string, any> = {}): Record<string, any> {
    if (!profiles || typeof profiles !== "object") return result;

    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

        // Create a copy of the profile without the nested profiles
        const profileCopy = { ...profile };
        delete profileCopy.profiles;

        result[qualifiedKey] = profileCopy;

        // If this profile contains a nested `profiles` object, flatten those too
        if (profile.profiles) {
            flattenProfiles(profile.profiles, qualifiedKey, result);
        }
    }

    return result;
}
