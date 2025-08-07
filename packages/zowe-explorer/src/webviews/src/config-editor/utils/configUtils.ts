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

export interface FlattenedConfig {
    [key: string]: { value: string; path: string[] };
}

export interface PendingChange {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
}

export interface PendingChanges {
    [configPath: string]: {
        [key: string]: PendingChange;
    };
}

export function flattenKeys(obj: { [key: string]: any }, parentKey: string = ""): FlattenedConfig {
    let result: FlattenedConfig = {};

    for (const [key, value] of Object.entries(obj)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        const newPath = parentKey ? [...parentKey.split("."), key] : [key];

        if (typeof value === "object") {
            const nestedObject = flattenKeys(value, newKey);
            result = { ...result, ...nestedObject };
        } else {
            result[newKey] = { value: value, path: newPath };
        }
    }

    return result;
}

export function flattenProfiles(profiles: any, parentKey = "", result: Record<string, any> = {}): Record<string, any> {
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

export function pathFromArray(arr: string[]): string {
    return arr.join(".");
}

export function extractProfileKeyFromPath(path: string[]): string {
    if (path[0] === "profiles") {
        if (path.length > 2) {
            // Check if this is a nested profile
            const profilesIndices = [];
            for (let i = 0; i < path.length; i++) {
                if (path[i] === "profiles") {
                    profilesIndices.push(i);
                }
            }
            if (profilesIndices.length > 1) {
                // This is a nested profile - construct the full profile key
                const profileParts = [];
                for (let i = 1; i < path.length; i++) {
                    if (path[i] !== "profiles") {
                        profileParts.push(path[i]);
                    }
                }
                // Stop at the first occurrence of "properties" or "type" to get the actual profile name
                const profileNameEndIndex = profileParts.findIndex((part) => part === "properties" || part === "type");
                if (profileNameEndIndex !== -1) {
                    return profileParts.slice(0, profileNameEndIndex).join(".");
                } else {
                    return profileParts.join(".");
                }
            } else {
                // Top-level profile
                return path[1];
            }
        } else if (path.length === 2) {
            // Top-level profile (e.g., ["profiles", "zxplore"])
            return path[1];
        } else {
            // Fallback
            return path[0];
        }
    } else {
        return path[0];
    }
}

export function sortConfigEntries(entries: [string, any][]): [string, any][] {
    return entries.sort(([keyA], [keyB]) => {
        // Define the order: type, properties, secure, others
        const getOrder = (key: string) => {
            if (key === "type") return 0;
            if (key === "properties") return 2;
            if (key === "secure") return 3;
            return 1; // All others
        };

        const orderA = getOrder(keyA);
        const orderB = getOrder(keyB);

        // If they're in the same section, sort alphabetically
        if (orderA === orderB) {
            return keyA.localeCompare(keyB);
        }

        return orderA - orderB;
    });
}

export function parseValueByType(value: string, type: string | undefined): string | number | boolean {
    if (!type) return value;

    switch (type) {
        case "boolean":
            return value.toLowerCase() === "true";
        case "number":
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        default:
            return value;
    }
}

export function stringifyValueByType(value: string | number | boolean | Object): string {
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    return String(value);
}
