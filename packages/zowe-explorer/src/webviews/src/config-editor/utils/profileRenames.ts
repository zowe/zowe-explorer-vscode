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

import { resolveProfileKey } from "./profileConflicts";
import { splitProfilePath } from "./profilePaths";
import { RenamesMap, DeletionsMap, ProfileMap } from "../types";

/** Original identities resolve directly to final paths; a vacated name may belong to another profile. */
export function getRenamedProfileKey(originalKey: string, configPath: string, renames: RenamesMap): string {
    return renames[configPath]?.[originalKey] || originalKey;
}

export function getRenamedProfileKeyWithNested(profileKey: string, configPath: string, renames: RenamesMap): string {
    return resolveProfileKey(profileKey, renames[configPath] || {});
}

export function getOriginalProfileKey(renamedKey: string, configPath: string, renames: RenamesMap): string {
    return Object.entries(renames[configPath] || {}).find(([, target]) => target === renamedKey)?.[0] || renamedKey;
}

export function getOriginalProfileKeyWithNested(renamedKey: string, configPath: string, renames: RenamesMap): string {
    const inverse = Object.fromEntries(Object.entries(renames[configPath] || {}).map(([original, target]) => [target, original]));
    return resolveProfileKey(renamedKey, inverse);
}

/**
 * Whether `profileKey` (or one of its ancestor profiles) is in the deletions list for
 * `configPath`. Lives here (rather than in profileKeyListing/profileUtils) because it has no
 * dependencies of its own and both `mergePendingProfileKeys` and `filterConflictingProfileKeys`
 * below need it — keeping it here avoids a circular import between this module and the others.
 */
export function isProfileOrParentDeleted(profileKey: string, deletions: DeletionsMap, configPath: string): boolean {
    return getDeletedProfileKeys(deletions, configPath).some((key) => profileKey === key || profileKey.startsWith(key + "."));
}

/** Whole-profile deletions only; deleting a property must not hide its owning profile. */
export function getDeletedProfileKeys(deletions: DeletionsMap, configPath: string, _renames: RenamesMap = {}): string[] {
    const result = new Set<string>();
    for (const key of deletions[configPath] ?? []) {
        const parsed = splitProfilePath(key.split("."));
        if (!parsed || parsed.suffix.length) continue;
        result.add(parsed.profileKey);
    }
    return [...result];
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

    return [...new Set(renamedProfileKeys)];
}

/**
 * Whether `qualifiedKey`'s immediate parent path corresponds to a real profile (on-disk or
 * still pending). Used to distinguish a nested pending profile (e.g. a brand-new
 * "test.zosmf") from a stale/broken path prefix left over from an unrelated operation — only the
 * latter should ever be collapsed down to its bare leaf name.
 */
function hasRealParentProfile(qualifiedKey: string, uniqueRenamedProfileKeys: string[], otherPendingKeys: string[]): boolean {
    const lastDot = qualifiedKey.lastIndexOf(".");
    if (lastDot === -1) return false;
    const parentPath = qualifiedKey.slice(0, lastDot);
    if (uniqueRenamedProfileKeys.includes(parentPath)) return true;
    return otherPendingKeys.some((key) => key !== qualifiedKey && (key === parentPath || key.startsWith(parentPath + ".")));
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

    const pendingProfileKeys = Object.keys(pendingProfiles).filter((key) => !isProfileOrParentDeleted(key, deletions, configPath));

    return pendingProfileKeys.map((profileKey) => {
        let renamedKey = getRenamedProfileKeyWithNested(profileKey, configPath, renames);

        const configRenames = renames[configPath] || {};
        if (
            Object.keys(configRenames).length === 0 &&
            renamedKey.includes(".") &&
            !hasRealParentProfile(renamedKey, uniqueRenamedProfileKeys, pendingProfileKeys)
        ) {
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
                const matchesLeaf =
                    pendingKey !== profileKey &&
                    (pendingKey.endsWith("." + profileKey) || pendingKey === profileKey + ".pending" || pendingKey.includes("." + profileKey + "."));
                return matchesLeaf && !hasRealParentProfile(pendingKey, uniqueRenamedProfileKeys, pendingProfileKeys);
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
