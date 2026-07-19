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
import { RenamesMap, PendingChangesMap } from "../types";
import { getOriginalProfileKeyWithNested, getRenamedProfileKeyWithNested } from "./profileRenames";

// Split by concern into sibling modules; re-exported here so every existing
// `from "./profileUtils"` / `from "../utils/profileUtils"` import keeps working unchanged.
export * from "./profileRenames";
export * from "./profileTypeResolution";
export * from "./profileKeyListing";
export * from "./profileSecure";
export * from "./profileMergedProperties";

interface MergePendingChangesParams {
    baseObj: Record<string, unknown>;
    path: string[];
    configPath: string;
    pendingChanges: PendingChangesMap;
    renames: RenamesMap;
}

export function mergePendingChangesForProfile(params: MergePendingChangesParams): Record<string, unknown> {
    const { baseObj, path, configPath, pendingChanges, renames } = params;

    const currentProfileKey = extractProfileKeyFromPath(path);
    const pendingChangesAtLevel: Record<string, unknown> = {};

    const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

    const isProfileKeyMatch = (entryProfileKey: string): boolean => {
        if (entryProfileKey === currentProfileKey || entryProfileKey === originalProfileKey) {
            return true;
        }

        if (getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames) === entryProfileKey) {
            return true;
        }

        if (entryProfileKey.includes(".") || currentProfileKey.includes(".")) {
            const renamedEntryProfileKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
            if (renamedEntryProfileKey === currentProfileKey) {
                return true;
            }

            const originalOfCurrentKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);
            if (entryProfileKey === originalOfCurrentKey) {
                return true;
            }

            const entryParts = entryProfileKey.split(".");
            const currentParts = currentProfileKey.split(".");

            if (entryParts.length < currentParts.length) {
                const currentParentKey = currentParts.slice(0, entryParts.length).join(".");
                const renamedEntryKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
                if (renamedEntryKey === currentParentKey) {
                    return true;
                }
            }

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
        if (!isProfileKeyMatch(entry.profile)) {
            return;
        }

        let relativePath: string[] = [];
        const propertiesMarker = ".properties.";
        const markerIndex = key.indexOf(propertiesMarker);

        const isCurrentlyInsideProperties = path[path.length - 1] === "properties";

        if (markerIndex !== -1) {
            const propertyPath = key.substring(markerIndex + propertiesMarker.length);
            const propertyPathParts = propertyPath.split(".");

            if (isCurrentlyInsideProperties) {
                relativePath = propertyPathParts;
            } else {
                relativePath = ["properties", ...propertyPathParts];
            }
        } else {
            if (isCurrentlyInsideProperties) {
                return;
            }

            const keyParts = key.split(".");
            let i = 2;
            while (i < keyParts.length && keyParts[i] === "profiles" && i + 1 < keyParts.length) {
                i += 2;
            }
            if (i < keyParts.length) {
                relativePath = keyParts.slice(i);
            } else {
                relativePath = [];
            }
        }

        if (relativePath.length === 0) {
            return;
        }

        if (relativePath.length === 1) {
            if (relativePath[0] !== "properties" && relativePath[0] !== "profiles") {
                pendingChangesAtLevel[relativePath[0]] = entry.value;
            }
        } else if (relativePath.length > 1 && relativePath[0] !== "profiles") {
            let current: Record<string, unknown> = baseObj;
            for (let i = 0; i < relativePath.length - 1; i++) {
                if (!current[relativePath[i]]) {
                    current[relativePath[i]] = {};
                }
                current = current[relativePath[i]] as Record<string, unknown>;
            }
            current[relativePath[relativePath.length - 1]] = entry.value;
        }

        if (entry.secure && !isCurrentlyInsideProperties) {
            if (!Array.isArray(baseObj.secure)) {
                baseObj.secure = [];
            }

            const keyParts = key.split(".");
            const propertyName = keyParts[keyParts.length - 1];

            if (!(baseObj.secure as string[]).includes(propertyName)) {
                (baseObj.secure as string[]).push(propertyName);
            }
        }
    });

    return { ...baseObj, ...pendingChangesAtLevel };
}

export function getProfileTypeFromPath(path: string[]): string | null {
    if (path.length < 2 || path[0] !== "profiles") {
        return null;
    }

    let profileName = "";
    for (let i = 1; i < path.length; i++) {
        if (path[i] !== "profiles" && path[i] !== "properties" && path[i] !== "secure") {
            profileName = path[i];
            break;
        }
    }

    return profileName || null;
}

export function extractPendingProfiles(pendingChanges: PendingChangesMap, configPath: string): string[] {
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
