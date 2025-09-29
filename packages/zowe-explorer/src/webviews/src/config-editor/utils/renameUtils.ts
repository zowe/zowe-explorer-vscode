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

export const updateChangesForRenames = (changes: any[], renames: any[]) => {
    if (!renames || renames.length === 0) {
        return changes;
    }

    return changes.map((change) => {
        const updatedChange = { ...change };

        if (updatedChange.profile) {
            let effectiveProfileName = updatedChange.profile;
            const appliedRenames = new Set();
            let changed = true;
            let iteration = 0;
            while (changed && iteration < 10) {
                changed = false;
                iteration++;

                for (const rename of renames) {
                    if (rename.configPath === change.configPath) {
                        const renameKey = `${rename.originalKey}->${rename.newKey}`;

                        if (appliedRenames.has(renameKey)) {
                            continue;
                        }

                        if (effectiveProfileName === rename.originalKey) {
                            effectiveProfileName = rename.newKey;
                            appliedRenames.add(renameKey);
                            changed = true;
                            break;
                        }

                        if (effectiveProfileName.startsWith(rename.originalKey + ".")) {
                            const newEffectiveName = effectiveProfileName.replace(rename.originalKey + ".", rename.newKey + ".");
                            effectiveProfileName = newEffectiveName;
                            appliedRenames.add(renameKey);
                            changed = true;
                            break;
                        }
                    }
                }
            }

            updatedChange.profile = effectiveProfileName;
        }

        // Update the key field to use new profile name - handle complex nested paths
        if (updatedChange.key) {
            let updatedKey = updatedChange.key;
            let keyChanged = true;
            let keyIteration = 0;
            const appliedKeyRenames = new Set(); // Track applied renames for keys

            while (keyChanged && keyIteration < 10) {
                keyChanged = false;
                keyIteration++;

                for (const rename of renames) {
                    if (rename.configPath === change.configPath) {
                        const renameKey = `${rename.originalKey}->${rename.newKey}`;

                        // Skip if we've already applied this exact rename
                        if (appliedKeyRenames.has(renameKey)) {
                            continue;
                        }

                        const originalKeyParts = rename.originalKey.split(".");
                        const newKeyParts = rename.newKey.split(".");

                        if (originalKeyParts.length > 1 && newKeyParts.length > 1) {
                            // Handle complex nested profile renames
                            // Build the pattern to match in the key
                            // For test1.lpar1, we need to match "profiles.test1.profiles.lpar1"
                            const originalPattern = "profiles." + originalKeyParts.join(".profiles.");
                            const newPattern = "profiles." + newKeyParts.join(".profiles.");

                            if (updatedKey.includes(originalPattern)) {
                                // Use replaceAll to handle all occurrences, but this should be exact pattern matches
                                updatedKey = updatedKey.replaceAll(originalPattern, newPattern);
                                appliedKeyRenames.add(renameKey);
                                keyChanged = true;
                                break;
                            }
                        } else {
                            // Handle simple renames
                            // For simple renames like 'b' -> 'a.b', we need to replace 'b' with 'a.b'
                            // but only when 'b' appears as a profile name (preceded by 'profiles')
                            const keyParts = updatedKey.split(".");
                            let updated = false;

                            for (let i = 0; i < keyParts.length; i++) {
                                if (keyParts[i] === rename.originalKey && i > 0 && keyParts[i - 1] === "profiles") {
                                    // Check if this key already represents the correct profile structure
                                    // For example, if we're renaming 'b' to 'a.b' and the key is 'profiles.a.profiles.b',
                                    // this already represents the correct structure for profile 'a.b'
                                    const currentProfileFromKey = extractProfileFromKey(updatedKey);
                                    if (currentProfileFromKey === rename.newKey) {
                                        // The key already represents the correct profile, don't update it
                                        continue;
                                    }

                                    // This is a profile name that needs to be replaced
                                    keyParts[i] = rename.newKey;
                                    updated = true;
                                }
                            }

                            if (updated) {
                                updatedKey = keyParts.join(".");
                                appliedKeyRenames.add(renameKey);
                                keyChanged = true;
                                break;
                            }
                        }
                    }
                }
            }

            updatedChange.key = updatedKey;
        }

        // Update the path array to use new profile name
        if (updatedChange.path && Array.isArray(updatedChange.path)) {
            let updatedPath = [...updatedChange.path];
            let pathChanged = true;
            let pathIteration = 0;
            const appliedPathRenames = new Set(); // Track applied renames for paths

            while (pathChanged && pathIteration < 10) {
                pathChanged = false;
                pathIteration++;

                for (const rename of renames) {
                    if (rename.configPath === change.configPath) {
                        const renameKey = `${rename.originalKey}->${rename.newKey}`;

                        // Skip if we've already applied this exact rename
                        if (appliedPathRenames.has(renameKey)) {
                            continue;
                        }

                        const originalKeyParts = rename.originalKey.split(".");
                        const newKeyParts = rename.newKey.split(".");

                        if (originalKeyParts.length > 1 && newKeyParts.length > 1) {
                            // Handle complex nested profile path updates
                            // Find the position where the original profile path starts in the path array
                            for (let i = 0; i <= updatedPath.length - originalKeyParts.length; i++) {
                                let matches = true;
                                for (let j = 0; j < originalKeyParts.length; j++) {
                                    if (updatedPath[i + j] !== originalKeyParts[j]) {
                                        matches = false;
                                        break;
                                    }
                                }

                                if (matches) {
                                    // Replace the matched segment with the new key parts
                                    updatedPath.splice(i, originalKeyParts.length, ...newKeyParts);
                                    appliedPathRenames.add(renameKey);
                                    pathChanged = true;
                                    break;
                                }
                            }
                        } else {
                            // Handle simple path updates
                            const newPath = updatedPath.map((pathPart: string) => {
                                // Only replace exact matches, not partial matches
                                if (pathPart === rename.originalKey) {
                                    return rename.newKey;
                                }
                                return pathPart;
                            });

                            if (JSON.stringify(newPath) !== JSON.stringify(updatedPath)) {
                                updatedPath = newPath;
                                appliedPathRenames.add(renameKey);
                                pathChanged = true;
                            }
                        }
                    }
                }
            }

            updatedChange.path = updatedPath;
        }

        return updatedChange;
    });
};

const extractProfileFromKey = (key: string): string => {
    const parts = key.split(".");
    const profileParts: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "profiles" && i + 1 < parts.length) {
            // Found a profile name
            profileParts.push(parts[i + 1]);
            i++; // Skip the profile name in the next iteration
        }
    }

    return profileParts.join(".");
};

export const getProfileNameForMergedProperties = (
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string => {
    let effectiveProfileKey = profileKey;

    // Apply reverse renames step by step
    if (renames[configPath] && Object.keys(renames[configPath]).length > 0) {
        const configRenames = renames[configPath];

        // Convert to array and sort by newKey length (longest first) to handle nested renames correctly
        const sortedRenames = Object.entries(configRenames).sort(([, a], [, b]) => b.length - a.length);

        let changed = true;

        // Keep applying reverse renames until no more changes
        while (changed) {
            changed = false;

            // Process renames from longest to shortest to handle nested cases
            for (const [originalKey, newKey] of sortedRenames) {
                // Check for exact match
                if (effectiveProfileKey === newKey) {
                    effectiveProfileKey = originalKey;
                    changed = true;
                    break;
                }

                // Check for partial matches (parent renames affecting children)
                if (effectiveProfileKey.startsWith(newKey + ".")) {
                    effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                }
            }
        }
    }

    return effectiveProfileKey;
};

export const consolidateRenames = (
    existingRenames: { [originalKey: string]: string },
    originalKey: string,
    newKey: string
): { [originalKey: string]: string } => {
    const tempRenames = { ...existingRenames };

    // Handle cancellation
    if (newKey === originalKey) {
        delete tempRenames[originalKey];
        return tempRenames;
    }

    // Add/update the rename
    tempRenames[originalKey] = newKey;

    // Consolidate conflicting renames
    const result = consolidateConflictingRenames(tempRenames);
    return result;
};

export const consolidateConflictingRenames = (renames: { [originalKey: string]: string }): { [originalKey: string]: string } => {
    const consolidated = { ...renames };

    // Early cleanup: remove renames that reference non-existent source profiles
    // This happens when a parent profile is renamed, making child profile paths invalid
    const keysToRemoveEarly: string[] = [];

    // We need to do this iteratively because removing one rename might make others invalid
    let earlyChanged = true;
    while (earlyChanged) {
        earlyChanged = false;

        for (const [originalKey] of Object.entries(consolidated)) {
            if (originalKey.includes(".")) {
                // Check if this parent path has been renamed to something else
                for (const [otherOriginalKey] of Object.entries(consolidated)) {
                    if (otherOriginalKey !== originalKey && originalKey.startsWith(otherOriginalKey + ".")) {
                        // This originalKey is a child of otherOriginalKey, which has been renamed
                        // So originalKey is no longer valid as a source
                        keysToRemoveEarly.push(originalKey);
                        earlyChanged = true;
                        break;
                    }
                }
            }
        }

        // Remove invalid renames
        for (const key of keysToRemoveEarly) {
            delete consolidated[key];
        }
        keysToRemoveEarly.length = 0; // Clear for next iteration
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const keys = Object.keys(consolidated);

        if (iterations >= maxIterations) {
            console.warn("[CONSOLIDATION] Maximum iterations reached, breaking to prevent infinite loop");
            console.warn("[CONSOLIDATION] Final state:", consolidated);
            break;
        }

        // First pass: detect and remove opposing renames (A->B, B->A)
        for (const originalKey of keys) {
            const newKey = consolidated[originalKey];
            if (consolidated[newKey] === originalKey) {
                // Before removing, check if any child renames need to be updated
                // Find all renames that have the newKey as a parent
                for (const [childOriginalKey, childNewKey] of Object.entries(consolidated)) {
                    if (childNewKey.startsWith(newKey + ".")) {
                        // This child was depending on the newKey, update it to use originalKey instead
                        const childSuffix = childNewKey.substring(newKey.length + 1);
                        const updatedChildKey = originalKey + "." + childSuffix;
                        consolidated[childOriginalKey] = updatedChildKey;
                    }
                }

                delete consolidated[originalKey];
                delete consolidated[newKey];
                changed = true;
            }
        }

        if (changed) continue; // Restart the loop after removing opposing renames

        // Second pass: handle simple chained renames (A->B, B->C becomes A->C)
        for (const originalKey of keys) {
            const newKey = consolidated[originalKey];

            // Check if newKey is also being renamed (forms a chain)
            if (consolidated[newKey] && consolidated[newKey] !== originalKey) {
                const finalKey = consolidated[newKey];
                consolidated[originalKey] = finalKey;
                // Remove the intermediate rename since it's now consolidated
                delete consolidated[newKey];
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
                        // This child's original key is under the renamed parent
                        const childSuffix = childOriginalKey.substring(originalKey.length + 1);
                        const newChildOriginalKey = newKey + "." + childSuffix;

                        // Move the rename entry to use the new parent path
                        consolidated[newChildOriginalKey] = childNewKey;
                        delete consolidated[childOriginalKey];
                        changed = true;
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

                // Follow the chain to find the final target
                while (Object.keys(consolidated).some((k) => k !== originalKey && consolidated[k] === currentTarget)) {
                    const nextTarget = Object.entries(consolidated).find(([k, v]) => v === currentTarget && k !== originalKey);
                    if (nextTarget) {
                        finalTarget = nextTarget[1];
                        currentTarget = finalTarget;
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

    // Final cleanup: remove intermediate renames that are no longer needed
    const finalConsolidated = { ...consolidated };
    const keysToRemove: string[] = [];

    // First, identify all intermediate renames
    for (const [originalKey, newKey] of Object.entries(finalConsolidated)) {
        // Check if this rename is intermediate (its target is also a key in the renames)
        const isIntermediate = Object.keys(finalConsolidated).some((k) => k !== originalKey && finalConsolidated[k] === newKey);

        if (isIntermediate) {
            // This is an intermediate rename, mark it for removal
            keysToRemove.push(originalKey);
        }
    }

    // Also check for renames that are targets of other renames but not sources
    // These should be removed as they're intermediate steps
    for (const [originalKey, newKey] of Object.entries(finalConsolidated)) {
        // Check if this newKey is a target of another rename
        const isTargetOfAnother = Object.entries(finalConsolidated).some(([k, v]) => k !== originalKey && v === newKey);

        if (isTargetOfAnother && !keysToRemove.includes(originalKey)) {
            // This rename's target is being used by another rename, so this is intermediate
            keysToRemove.push(originalKey);
        }
    }

    // Third, identify orphaned renames where the source profile's parent has been moved
    for (const [originalKey, _] of Object.entries(finalConsolidated)) {
        if (originalKey.includes(".") && !keysToRemove.includes(originalKey)) {
            // This is a nested profile, check if its parent has been renamed
            const parentKey = originalKey.substring(0, originalKey.lastIndexOf("."));

            // Check if the parent has been renamed to a different location
            const parentRename = finalConsolidated[parentKey];
            if (parentRename && !originalKey.startsWith(parentRename + ".")) {
                // The parent was renamed but this child rename wasn't updated accordingly
                // This creates an orphaned rename that should be removed
                keysToRemove.push(originalKey);
            }
        }
    }

    // Remove the intermediate and orphaned renames
    for (const key of keysToRemove) {
        delete finalConsolidated[key];
    }

    return finalConsolidated;
};

export const getCurrentEffectiveName = (
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string => {
    const currentRenames = renames[configPath] || {};
    let effectiveName = profileKey;

    // Apply renames iteratively to handle chained renames
    let changed = true;
    let iteration = 0;
    while (changed && iteration < 10) {
        // Safety limit to prevent infinite loops
        changed = false;
        iteration++;

        for (const [originalKey, newKey] of Object.entries(currentRenames)) {
            if (effectiveName === originalKey) {
                effectiveName = newKey;
                changed = true;
                break;
            }
            if (effectiveName.startsWith(originalKey + ".")) {
                const newEffectiveName = effectiveName.replace(originalKey + ".", newKey + ".");
                effectiveName = newEffectiveName;
                changed = true;
                break;
            }
        }
    }
    return effectiveName;
};

export const detectClosedLoops = (renames: { [originalKey: string]: string }): string[][] => {
    const loops: string[][] = [];
    const visited = new Set<string>();

    for (const [originalKey] of Object.entries(renames)) {
        if (visited.has(originalKey)) continue;

        const loop: string[] = [];
        let currentKey = originalKey;
        const currentVisited = new Set<string>();

        // Follow the rename chain to detect loops
        while (currentKey && !currentVisited.has(currentKey)) {
            currentVisited.add(currentKey);
            loop.push(currentKey);

            if (renames[currentKey]) {
                currentKey = renames[currentKey];
            } else {
                break;
            }
        }

        // If we found a loop (currentKey is in currentVisited), it's a closed loop
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

export const hasPendingRename = (
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean => {
    if (!configPath) {
        return false;
    }
    const renamesForConfig = renames[configPath] || {};

    // Check if this profile is a renamed profile (exists as a value in the renames object)
    const result = Object.values(renamesForConfig).includes(profileKey);

    return result;
};
