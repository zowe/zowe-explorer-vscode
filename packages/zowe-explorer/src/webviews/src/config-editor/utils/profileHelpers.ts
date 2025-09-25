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

import { getProfileType } from "./profileUtils";

// Types
export interface Configuration {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
    schemaPath?: string;
}

export interface PendingChange {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
}

export interface PendingDefault {
    value: string;
    path: string[];
}

/**
 * Check if a profile is set as default
 */
export function isProfileDefault(
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
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
    const defaultValue = defaults[profileType];
    if (defaultValue === profileKey || defaultValue === originalProfileKey) {
        return true;
    }

    // Check if this profile should be the default due to renames (simulate backend logic)
    // This handles the case where a default profile was renamed and should remain the default
    const configRenames = renames[configPath] || {};
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
        // Check if the original profile was the default and this is the renamed version
        if (defaultValue === originalKey && newKey === profileKey) {
            return true;
        }

        // Check if this profile is a child of a renamed profile that was a default
        // This handles cases like: tso.zosmf was default, tso was renamed to tso1, so tso1.zosmf should be default
        if (defaultValue.startsWith(originalKey + ".") && profileKey.startsWith(newKey + ".")) {
            const originalChildPath = defaultValue.substring(originalKey.length + 1);
            const currentChildPath = profileKey.substring(newKey.length + 1);
            if (originalChildPath === currentChildPath) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if current profile is untyped
 */
export function isCurrentProfileUntyped(
    selectedProfileKey: string | null,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (!selectedProfileKey) return false;
    const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
    return !profileType || profileType.trim() === "";
}

/**
 * Helper function to get original profile key with nested structure
 */
function getOriginalProfileKeyWithNested(
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string {
    const configRenames = renames[configPath] || {};

    // Find the original key by looking through all renames
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
        if (newKey === profileKey) {
            return originalKey;
        }
    }

    // If no rename found, return the current key
    return profileKey;
}
