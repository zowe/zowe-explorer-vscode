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

import { RenamesMap, DeletionsMap, ProfileMap } from "../types";

export function getRenamedProfileKey(originalKey: string, configPath: string, renames: RenamesMap): string {
    const configRenames = renames[configPath];
    return configRenames?.[originalKey] || originalKey;
}

export function getRenamedProfileKeyWithNested(profileKey: string, configPath: string, renames: RenamesMap): string {
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
            if (renamedPath === originalKey) {
                renamedPath = newKey;
                changed = true;
                break;
            }

            if (renamedPath.startsWith(originalKey + ".")) {
                renamedPath = renamedPath.replace(originalKey + ".", newKey + ".");
                changed = true;
                break;
            }
        }
    }

    return renamedPath;
}

export function getOriginalProfileKey(renamedKey: string, configPath: string, renames: RenamesMap): string {
    const configRenames = renames[configPath];
    if (configRenames) {
        const visited = new Set<string>();
        let currentKey = renamedKey;

        while (true) {
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

export function getOriginalProfileKeyWithNested(renamedKey: string, configPath: string, renames: RenamesMap): string {
    if (!renamedKey.includes(".")) {
        return getOriginalProfileKey(renamedKey, configPath, renames);
    }

    const directOriginal = getOriginalProfileKey(renamedKey, configPath, renames);
    if (directOriginal !== renamedKey) {
        return directOriginal;
    }

    const profileParts = renamedKey.split(".");
    let originalPath = "";

    const configRenames = renames[configPath] || {};
    for (const [origKey, _] of Object.entries(configRenames)) {
        if (origKey.includes(".")) {
            const wouldProduce = getRenamedProfileKeyWithNested(origKey, configPath, renames);
            if (wouldProduce === renamedKey) {
                return origKey;
            }
        }
    }

    for (let i = 0; i < profileParts.length; i++) {
        const currentPath = profileParts.slice(0, i + 1).join(".");
        const original = getOriginalProfileKey(currentPath, configPath, renames);

        if (original !== currentPath) {
            const remainingParts = profileParts.slice(i + 1);
            originalPath = original + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
            break;
        } else if (i === 0) {
            originalPath = profileParts[i];
        } else {
            originalPath = originalPath + "." + profileParts[i];
        }
    }

    const profilePartsForParentCheck = originalPath.split(".");

    for (let i = 0; i < profilePartsForParentCheck.length; i++) {
        const parentPath = profilePartsForParentCheck.slice(0, i + 1).join(".");

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
 * Whether `profileKey` (or one of its ancestor profiles) is in the deletions list for
 * `configPath`. Lives here (rather than in profileKeyListing/profileUtils) because it has no
 * dependencies of its own and both `mergePendingProfileKeys` and `filterConflictingProfileKeys`
 * below need it — keeping it here avoids a circular import between this module and the others.
 */
export function isProfileOrParentDeleted(profileKey: string, deletions: DeletionsMap, configPath: string): boolean {
    const configDeletions = deletions[configPath];
    if (!configDeletions) return false;

    const deletedProfiles = new Set<string>();
    configDeletions.forEach((key) => {
        const keyParts = key.split(".");
        if (keyParts[0] === "profiles" && keyParts.length >= 2) {
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

    if (deletedProfiles.has(profileKey)) {
        return true;
    }

    const profileParts = profileKey.split(".");
    for (let i = 1; i < profileParts.length; i++) {
        const parentKey = profileParts.slice(0, i).join(".");
        if (deletedProfiles.has(parentKey)) {
            return true;
        }
    }

    return false;
}

interface ApplyRenamesToProfileKeysParams {
    orderedProfileKeys: string[];
    configPath: string;
    renames: RenamesMap;
}

export function applyRenamesToProfileKeys(params: ApplyRenamesToProfileKeysParams): string[] {
    const { orderedProfileKeys, configPath, renames } = params;

    const renamedProfileKeys = orderedProfileKeys.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
    });

    const configRenames = renames[configPath] || {};
    const finalRenamedProfileKeys = renamedProfileKeys.filter((renamedKey) => {
        return !Object.keys(configRenames).includes(renamedKey);
    });

    const renamedOnlyProfiles = Object.keys(configRenames).filter((originalKey) => {
        if (orderedProfileKeys.includes(originalKey)) {
            return false;
        }

        const newKey = configRenames[originalKey];
        const isIntermediate = Object.values(configRenames).includes(originalKey) && Object.keys(configRenames).includes(newKey);
        if (isIntermediate) {
            return false;
        }

        return true;
    });

    const renamedOnlyProfileKeys = renamedOnlyProfiles.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
    });

    const allRenamedProfileKeys = [...finalRenamedProfileKeys, ...renamedOnlyProfileKeys];
    return Array.from(new Set(allRenamedProfileKeys));
}

interface MergePendingProfileKeysParams {
    pendingProfiles: ProfileMap;
    configPath: string;
    renames: RenamesMap;
    deletions: DeletionsMap;
    uniqueRenamedProfileKeys: string[];
}

export function mergePendingProfileKeys(params: MergePendingProfileKeysParams): string[] {
    const { pendingProfiles, configPath, renames, deletions, uniqueRenamedProfileKeys } = params;

    const pendingProfileKeys = Object.keys(pendingProfiles).filter((key) => {
        if (isProfileOrParentDeleted(key, deletions, configPath)) {
            return false;
        }
        return true;
    });

    return pendingProfileKeys.map((profileKey) => {
        let renamedKey = profileKey;
        const configRenames = renames[configPath] || {};

        let changed = true;
        while (changed) {
            changed = false;
            for (const [originalKey, newKey] of Object.entries(configRenames)) {
                if (renamedKey === originalKey) {
                    renamedKey = newKey;
                    changed = true;
                    break;
                }
                if (renamedKey.startsWith(originalKey + ".")) {
                    const newRenamedKey = renamedKey.replace(originalKey + ".", newKey + ".");
                    renamedKey = newRenamedKey;
                    changed = true;
                    break;
                }
            }
        }

        if (Object.keys(configRenames).length === 0 && renamedKey.includes(".")) {
            const rootProfileName = renamedKey.split(".").pop();
            if (rootProfileName && uniqueRenamedProfileKeys.includes(rootProfileName)) {
                renamedKey = rootProfileName;
            }
        }

        return renamedKey;
    });
}

interface FilterConflictingProfileKeysParams {
    uniqueRenamedProfileKeys: string[];
    renamedPendingProfileKeys: string[];
    pendingProfiles: ProfileMap;
    deletions: DeletionsMap;
    configPath: string;
    renames: RenamesMap;
}

export function filterConflictingProfileKeys(params: FilterConflictingProfileKeysParams): string[] {
    const { uniqueRenamedProfileKeys, renamedPendingProfileKeys, pendingProfiles, deletions, configPath, renames } = params;

    const pendingProfileKeys = Object.keys(pendingProfiles);
    const pendingProfileKeysSet = new Set(renamedPendingProfileKeys);
    const originalPendingProfileKeysSet = new Set(pendingProfileKeys);

    return uniqueRenamedProfileKeys.filter((profileKey) => {
        if (isProfileOrParentDeleted(profileKey, deletions, configPath)) {
            return false;
        }

        const hasExactPendingMatch = pendingProfileKeysSet.has(profileKey) || originalPendingProfileKeysSet.has(profileKey);

        const isResultOfRenameWithPending = Object.keys(renames[configPath] || {}).some((originalKey) => {
            const renamedKey = getRenamedProfileKeyWithNested(originalKey, configPath, renames);
            const hasPendingOriginal = Object.keys(pendingProfiles).includes(originalKey);
            return profileKey === renamedKey && hasPendingOriginal;
        });

        const isTargetOfPendingRename = renamedPendingProfileKeys.includes(profileKey);

        const shouldRenamePendingToThisKey =
            !isTargetOfPendingRename &&
            Object.keys(renames[configPath] || {}).length === 0 &&
            pendingProfileKeys.some((pendingKey) => {
                return (
                    pendingKey !== profileKey &&
                    (pendingKey.endsWith("." + profileKey) || pendingKey === profileKey + ".pending" || pendingKey.includes("." + profileKey + "."))
                );
            });

        return !hasExactPendingMatch && !isResultOfRenameWithPending && !isTargetOfPendingRename && !shouldRenamePendingToThisKey;
    });
}

/** All dotted profile keys in the nested `profiles` tree (pre-rename). */
export function getAllQualifiedProfileKeys(profiles: ProfileMap | undefined, parentKey = ""): string[] {
    if (!profiles) {
        return [];
    }
    const keys: string[] = [];
    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
        keys.push(qualifiedKey);
        if (profile.profiles) {
            keys.push(...getAllQualifiedProfileKeys(profile.profiles, qualifiedKey));
        }
    }
    return keys;
}

/** Resolves the stored profile key when `selectedProfileKey` may reflect a pending rename. */
export function resolveOriginalProfileKeyFromRenames(
    selectedProfileKey: string,
    configPath: string,
    profilesRoot: ProfileMap | undefined,
    renames: RenamesMap
): string {
    for (const origKey of getAllQualifiedProfileKeys(profilesRoot)) {
        if (getRenamedProfileKeyWithNested(origKey, configPath, renames) === selectedProfileKey) {
            return origKey;
        }
    }
    return selectedProfileKey;
}
