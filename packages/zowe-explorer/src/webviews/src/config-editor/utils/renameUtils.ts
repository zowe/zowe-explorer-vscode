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

import { FormattedChange, RenameChange, RenamesMap, FormattedPendingChanges, PendingChangesMap, PendingDefaultsMap, DeletionsMap } from "../types";

/**
 * Resolves a dotted profile name through a chain of renames (e.g. a -> b, b -> c yields "a" -> "c"),
 * also covering renames of an ancestor segment (e.g. rename "a" -> "x" updates "a.child" -> "x.child").
 * Handles renames that change nesting depth in either direction (e.g. "b" -> "a.b" or "a.b" -> "c").
 */
const applyRenameChainToProfileName = (profileName: string, renames: RenameChange[]): string => {
    let effectiveName = profileName;
    const appliedRenames = new Set<string>();
    let changed = true;
    let iteration = 0;

    while (changed && iteration < 10) {
        changed = false;
        iteration++;

        for (const rename of renames) {
            const renameKey = `${rename.originalKey}->${rename.newKey}`;
            if (appliedRenames.has(renameKey)) {
                continue;
            }

            if (effectiveName === rename.originalKey) {
                effectiveName = rename.newKey;
            } else if (effectiveName.startsWith(rename.originalKey + ".")) {
                effectiveName = rename.newKey + effectiveName.slice(rename.originalKey.length);
            } else {
                continue;
            }

            appliedRenames.add(renameKey);
            changed = true;
            break;
        }
    }

    return effectiveName;
};

/** Builds the "profiles" token sequence for a dotted profile name, e.g. "a.b" -> ["profiles", "a", "profiles", "b"]. */
const buildProfileTokens = (profileName: string): string[] => profileName.split(".").flatMap((part) => ["profiles", part]);

/**
 * Splits a key/path token array anchored at "profiles" into the dotted profile-name chain it
 * represents and the remaining suffix tokens (e.g. ["properties", "host"]). Returns null when the
 * tokens aren't anchored at a profile (e.g. a path that was truncated elsewhere to just a property name).
 */
const splitProfileChain = (tokens: string[]): { chain: string; suffix: string[] } | null => {
    if (tokens[0] !== "profiles" || tokens.length < 2) {
        return null;
    }

    const chainParts: string[] = [];
    let i = 1;
    while (i < tokens.length) {
        chainParts.push(tokens[i]);
        i++;
        if (tokens[i] === "profiles") {
            i++;
        } else {
            break;
        }
    }

    return { chain: chainParts.join("."), suffix: tokens.slice(i) };
};

/** Applies the resolved rename chain to a key string or path array that's anchored at "profiles". */
const applyRenameChainToTokens = <T extends string | string[]>(tokens: T, renames: RenameChange[]): T => {
    const isString = typeof tokens === "string";
    const tokenArray = isString ? (tokens as string).split(".") : (tokens as string[]);

    const split = splitProfileChain(tokenArray);
    if (!split) {
        return tokens;
    }

    const newChain = applyRenameChainToProfileName(split.chain, renames);
    if (newChain === split.chain) {
        return tokens;
    }

    const newTokens = [...buildProfileTokens(newChain), ...split.suffix];
    return (isString ? newTokens.join(".") : newTokens) as T;
};

export const updateChangesForRenames = (changes: FormattedChange[], renames: RenameChange[]) => {
    if (!renames || renames.length === 0) {
        return changes;
    }

    return changes.map((change) => {
        const updatedChange = { ...change };
        const relevantRenames = renames.filter((rename) => rename.configPath === change.configPath);
        if (relevantRenames.length === 0) {
            return updatedChange;
        }

        if (updatedChange.profile) {
            updatedChange.profile = applyRenameChainToProfileName(updatedChange.profile, relevantRenames);
        }

        if (updatedChange.key) {
            updatedChange.key = applyRenameChainToTokens(updatedChange.key, relevantRenames);
        }

        if (updatedChange.path && Array.isArray(updatedChange.path)) {
            updatedChange.path = applyRenameChainToTokens(updatedChange.path, relevantRenames);
        }

        return updatedChange;
    });
};

interface FormatPendingChangesParams {
    pendingChanges: PendingChangesMap;
    deletions: DeletionsMap;
    pendingDefaults: PendingDefaultsMap;
    defaultsDeletions: DeletionsMap;
    renames: RenamesMap;
}

/**
 * Serializes the pending-changes state (edits, deletions, defaults, renames) into the flat
 * payload shape used both for the merged-properties request and for SAVE_CHANGES.
 */
export function buildFormattedPendingChanges(params: FormatPendingChangesParams): FormattedPendingChanges {
    const { pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames } = params;

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

    const renamesData = Object.entries(renames).flatMap(([configPath, configRenames]) =>
        Object.entries(configRenames).map(([originalKey, newKey]) => ({
            originalKey,
            newKey,
            configPath,
        }))
    );

    const updatedChanges = updateChangesForRenames(changes, renamesData);

    return {
        changes: updatedChanges,
        deletions: deleteKeys,
        defaultsChanges,
        defaultsDeleteKeys,
        renames: renamesData,
    };
}

export const consolidateRenames = (
    existingRenames: { [originalKey: string]: string },
    originalKey: string,
    newKey: string
): { [originalKey: string]: string } => {
    const tempRenames = { ...existingRenames };

    if (newKey === originalKey) {
        delete tempRenames[originalKey];
        return tempRenames;
    }

    tempRenames[originalKey] = newKey;

    const result = consolidateConflictingRenames(tempRenames);
    return result;
};

export const consolidateConflictingRenames = (renames: { [originalKey: string]: string }): { [originalKey: string]: string } => {
    const consolidated = { ...renames };

    const keysToRemoveEarly: string[] = [];
    let earlyChanged = true;
    while (earlyChanged) {
        earlyChanged = false;

        for (const [originalKey, newKey] of Object.entries(consolidated)) {
            if (originalKey.includes(".")) {
                for (const [parentOriginalKey, parentNewKey] of Object.entries(consolidated)) {
                    if (parentOriginalKey !== originalKey && originalKey.startsWith(parentOriginalKey + ".")) {
                        const childSuffix = originalKey.substring(parentOriginalKey.length + 1);
                        const expectedChildTarget = parentNewKey + "." + childSuffix;

                        if (newKey === expectedChildTarget) {
                            keysToRemoveEarly.push(originalKey);
                            earlyChanged = true;
                            break;
                        }
                    }
                }
            }
        }

        for (const key of keysToRemoveEarly) {
            delete consolidated[key];
        }
        keysToRemoveEarly.length = 0;
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = 10;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const keys = Object.keys(consolidated);

        if (iterations >= maxIterations) {
            break;
        }

        for (const originalKey of keys) {
            const newKey = consolidated[originalKey];
            if (consolidated[newKey] === originalKey) {
                const updatedChildren: Array<{ from: string; to: string }> = [];
                for (const [childOriginalKey, childNewKey] of Object.entries(consolidated)) {
                    if (childNewKey.startsWith(newKey + ".")) {
                        const childSuffix = childNewKey.substring(newKey.length + 1);
                        const updatedChildKey = originalKey + "." + childSuffix;
                        consolidated[childOriginalKey] = updatedChildKey;
                        updatedChildren.push({ from: childNewKey, to: updatedChildKey });
                    }
                }

                delete consolidated[originalKey];
                delete consolidated[newKey];
                changed = true;
            }
        }

        if (changed) continue;

        for (const originalKey of keys) {
            const newKey = consolidated[originalKey];
            if (consolidated[newKey] && consolidated[newKey] !== originalKey) {
                const finalKey = consolidated[newKey];
                const collapsedIntermediateKey = newKey;
                consolidated[originalKey] = finalKey;
                delete consolidated[collapsedIntermediateKey];

                // Other renames may already be anchored under the intermediate key we just
                // collapsed away (e.g. a child dragged onto this profile while it sat at that
                // intermediate location) - re-anchor them under the final key so they don't end
                // up orphaned under a parent path that no longer exists.
                for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
                    if (otherOriginalKey !== originalKey && otherNewKey.startsWith(collapsedIntermediateKey + ".")) {
                        const childSuffix = otherNewKey.substring(collapsedIntermediateKey.length + 1);
                        consolidated[otherOriginalKey] = finalKey + "." + childSuffix;
                    }
                }

                changed = true;
            }
        }

        if (changed) continue; // Restart the loop after consolidating chains

        // Third pass: handle parent-child dependencies
        // Update child renames when their parent is renamed
        for (const originalKey of keys) {
            const newKey = consolidated[originalKey];

            // Find all renames that reference this originalKey as a parent in their source key
            for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
                if (otherOriginalKey !== originalKey) {
                    // Check if otherOriginalKey starts with newKey + "." (child of the new parent location)
                    if (otherOriginalKey.startsWith(newKey + ".")) {
                        // This child's original key needs to be updated because its parent was renamed
                        const childSuffix = otherOriginalKey.substring(newKey.length + 1);
                        const updatedChildOriginalKey = originalKey + "." + childSuffix;

                        // Check if there's already a rename for the updated child original key
                        if (!consolidated[updatedChildOriginalKey]) {
                            // Move the rename to use the correct original key
                            consolidated[updatedChildOriginalKey] = otherNewKey;
                            delete consolidated[otherOriginalKey];
                            changed = true;
                        }
                    }
                }
            }
        }

        // Third pass: handle parent renames that affect children
        // This handles cases where a parent is renamed and we need to update children to use the final target
        for (const [originalKey, newKey] of Object.entries(consolidated)) {
            // Check if this parent is being renamed (i.e., if newKey is a target of another rename)
            const parentRename = Object.entries(consolidated).find(([k, v]) => v === newKey && k !== originalKey);
            if (parentRename) {
                const [, parentNewKey] = parentRename;

                // Update children of this parent to use the final target
                for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
                    if (otherOriginalKey !== originalKey && otherNewKey.startsWith(newKey + ".")) {
                        const childSuffix = otherNewKey.substring(newKey.length + 1);
                        const finalChildKey = parentNewKey + "." + childSuffix;

                        // Check for conflicts
                        const conflictingKey = Object.keys(consolidated).find((k) => consolidated[k] === finalChildKey);
                        if (!conflictingKey || conflictingKey === otherOriginalKey) {
                            consolidated[otherOriginalKey] = finalChildKey;
                            changed = true;
                        }
                    }
                }
            }
        }

        // Fourth pass: handle parent renames that affect child renames
        // This handles cases where a parent rename affects existing child renames
        for (const [originalKey, newKey] of Object.entries(consolidated)) {
            // Find all child renames that need to be updated due to parent rename
            for (const [childOriginalKey, childNewKey] of Object.entries(consolidated)) {
                if (childOriginalKey !== originalKey) {
                    // Check if the child's current target starts with the old parent path
                    if (childNewKey.startsWith(originalKey + ".")) {
                        // This child's target needs to be updated to use the new parent path
                        const childSuffix = childNewKey.substring(originalKey.length + 1);
                        const updatedChildTarget = newKey + "." + childSuffix;

                        // Only update if it would actually change something
                        if (updatedChildTarget !== childNewKey) {
                            consolidated[childOriginalKey] = updatedChildTarget;
                            changed = true;
                        }
                    }
                    // Also check if the child's original key starts with the old parent path
                    else if (childOriginalKey.startsWith(originalKey + ".")) {
                        // Check if this child is an "extraction" - being moved to a location
                        // that is NOT under the parent's new location
                        // If so, it should keep its original key (refers to original config state)
                        const isExtraction = !childNewKey.startsWith(newKey + ".") && childNewKey !== newKey;

                        if (!isExtraction) {
                            // This child's original key is under the renamed parent and should follow it
                            const childSuffix = childOriginalKey.substring(originalKey.length + 1);
                            const newChildOriginalKey = newKey + "." + childSuffix;

                            // Move the rename entry to use the new parent path
                            consolidated[newChildOriginalKey] = childNewKey;
                            delete consolidated[childOriginalKey];
                            changed = true;
                        }
                        // If it's an extraction, keep the original key as-is
                    }
                }
            }
        }

        // Fifth pass: remove intermediate renames that are no longer needed
        // This handles cases where a parent rename makes an intermediate child rename obsolete
        for (const [originalKey, newKey] of Object.entries(consolidated)) {
            // Check if this rename is intermediate (i.e., its target is also being renamed)
            const isIntermediate = Object.keys(consolidated).some((k) => k !== originalKey && consolidated[k] === newKey);

            if (isIntermediate) {
                // Find the final target for this intermediate rename
                let finalTarget = newKey;
                let currentTarget = newKey;

                // Follow the chain to find the final target (with guard against cycles / multiple keys → same value)
                const seenTargets = new Set<string>([currentTarget]);
                while (Object.keys(consolidated).some((k) => k !== originalKey && consolidated[k] === currentTarget)) {
                    const nextTarget = Object.entries(consolidated).find(([k, v]) => v === currentTarget && k !== originalKey);
                    if (nextTarget) {
                        const nextValue = nextTarget[1];
                        if (nextValue === currentTarget || seenTargets.has(nextValue)) {
                            break;
                        }
                        seenTargets.add(nextValue);
                        finalTarget = nextValue;
                        currentTarget = nextValue;
                    } else {
                        break;
                    }
                }

                // Update the original rename to point directly to the final target
                if (finalTarget !== newKey) {
                    consolidated[originalKey] = finalTarget;
                    changed = true;
                }
            }
        }

        // Additional third pass: handle cases where a child's parent part is being renamed
        // This handles cases like zosmf -> zftp.zosmf where zftp is being renamed to tso.zftp
        for (const [originalKey, newKey] of Object.entries(consolidated)) {
            // Look for other renames that have this originalKey as a parent in their target
            for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
                if (otherOriginalKey !== originalKey && otherNewKey.startsWith(originalKey + ".")) {
                    // This is a child of the renamed parent
                    const childSuffix = otherNewKey.substring(originalKey.length + 1);
                    const finalChildKey = newKey + "." + childSuffix;

                    // Check for conflicts
                    const conflictingKey = Object.keys(consolidated).find((k) => consolidated[k] === finalChildKey);
                    if (!conflictingKey || conflictingKey === otherOriginalKey) {
                        consolidated[otherOriginalKey] = finalChildKey;
                        changed = true;
                    }
                }
            }
        }

        // Fourth pass: sort renames to ensure parent renames happen before child renames
        // This prevents conflicts where a child rename creates a structure that conflicts with a parent rename
        const sortedRenames = Object.entries(consolidated).sort(([, newKeyA], [, newKeyB]) => {
            // Sort by depth (shorter paths first) to ensure parents are processed before children
            const depthA = newKeyA.split(".").length;
            const depthB = newKeyB.split(".").length;
            return depthA - depthB;
        });

        // Rebuild consolidated object with sorted order
        const sortedConsolidated: { [originalKey: string]: string } = {};
        for (const [originalKey, newKey] of sortedRenames) {
            sortedConsolidated[originalKey] = newKey;
        }

        Object.assign(consolidated, sortedConsolidated);

        // Fifth pass: handle direct conflicts only (not chaining)
        if (!changed) {
            for (let i = 0; i < keys.length; i++) {
                for (let j = i + 1; j < keys.length; j++) {
                    const key1 = keys[i];
                    const key2 = keys[j];
                    const target1 = consolidated[key1];
                    const target2 = consolidated[key2];

                    // Only consolidate if two profiles rename to the same target
                    if (target1 === target2) {
                        // Keep the shorter original key, remove the longer one
                        if (key1.length <= key2.length) {
                            delete consolidated[key2];
                            changed = true;
                            break;
                        } else {
                            delete consolidated[key1];
                            changed = true;
                            break;
                        }
                    }
                }
                if (changed) break;
            }
        }
    }

    const finalConsolidated = { ...consolidated };
    const keysToRemove: string[] = [];

    for (const [originalKey, newKey] of Object.entries(finalConsolidated)) {
        const isIntermediate = Object.keys(finalConsolidated).some((k) => k !== originalKey && finalConsolidated[k] === newKey);
        if (isIntermediate) {
            keysToRemove.push(originalKey);
        }
    }

    for (const [originalKey, newKey] of Object.entries(finalConsolidated)) {
        const isTargetOfAnother = Object.entries(finalConsolidated).some(([k, v]) => k !== originalKey && v === newKey);
        if (isTargetOfAnother && !keysToRemove.includes(originalKey)) {
            keysToRemove.push(originalKey);
        }
    }

    for (const [originalKey, newKey] of Object.entries(finalConsolidated)) {
        if (originalKey.includes(".") && !keysToRemove.includes(originalKey)) {
            const parentKey = originalKey.substring(0, originalKey.lastIndexOf("."));
            const parentRename = finalConsolidated[parentKey];
            if (parentRename && !originalKey.startsWith(parentRename + ".")) {
                const isExtraction = !newKey.startsWith(parentRename + ".") && newKey !== parentRename;
                if (!isExtraction) {
                    keysToRemove.push(originalKey);
                }
            }
        }
    }

    for (const key of keysToRemove) {
        delete finalConsolidated[key];
    }

    return finalConsolidated;
};

export const detectClosedLoops = (renames: { [originalKey: string]: string }): string[][] => {
    const loops: string[][] = [];
    const visited = new Set<string>();

    for (const [originalKey] of Object.entries(renames)) {
        if (visited.has(originalKey)) continue;

        const loop: string[] = [];
        let currentKey: string | undefined = originalKey;
        const currentVisited = new Set<string>();

        // Follow the rename chain to detect loops
        while (currentKey && !currentVisited.has(currentKey)) {
            currentVisited.add(currentKey);
            loop.push(currentKey);

            if (renames[currentKey]) {
                const nextKey: string = renames[currentKey];
                if (currentVisited.has(nextKey)) {
                    currentKey = nextKey;
                    break;
                }
                currentKey = nextKey;
            } else {
                currentKey = undefined;
                break;
            }
        }

        // If we found a loop (currentKey re-visited in this chain), it's a closed loop
        if (currentKey && currentVisited.has(currentKey)) {
            // Find the start of the loop
            const loopStartIndex = loop.indexOf(currentKey);
            const closedLoop = loop.slice(loopStartIndex);
            loops.push(closedLoop);

            // Mark all keys in the loop as visited
            closedLoop.forEach((key) => visited.add(key));
        }
    }

    return loops;
};

export const checkIfRenameCancelsOut = (currentRenames: { [originalKey: string]: string }, originalKey: string, newKey: string): boolean => {
    // If this is a direct opposite (A -> B followed by B -> A), it cancels out
    if (currentRenames[newKey] === originalKey) {
        return true;
    }

    // Check if this rename would result in the profile ending up back where it started
    // by following the rename chain from the original key
    const visited = new Set<string>();
    let currentKey = originalKey;

    // Follow the existing rename chain
    while (currentRenames[currentKey] && !visited.has(currentKey)) {
        visited.add(currentKey);
        currentKey = currentRenames[currentKey];
    }

    // If the new rename would take us back to the original starting point, it cancels out
    if (currentKey === newKey) {
        return true;
    }

    // Check if the new rename creates a cycle that ends back at the original key
    // This handles cases like: A -> B, then B -> A (direct opposite)
    if (newKey === originalKey) {
        return true;
    }

    return false;
};

export const hasPendingRename = (profileKey: string, configPath: string, renames: RenamesMap): boolean => {
    if (!configPath) {
        return false;
    }
    const renamesForConfig = renames[configPath] || {};
    const result = Object.values(renamesForConfig).includes(profileKey);

    return result;
};
