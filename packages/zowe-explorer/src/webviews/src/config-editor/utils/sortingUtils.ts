/**
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v2.0 which accompanies this distribution,
 * and is available at https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { ProfileSortOrder } from "./configUtils";

/**
 * Sort profiles at each level while maintaining parent-child relationships
 */
export function sortProfilesAtLevel(profileKeys: string[], profileSortOrder: ProfileSortOrder | null): string[] {
    const currentProfileSortOrder = profileSortOrder || "natural";
    if (currentProfileSortOrder === "natural") {
        return profileKeys; // No sorting, maintain original order
    }

    // Create a map of profiles with their depth and parent information
    const profileInfo = profileKeys.map((profileKey) => {
        const parts = profileKey.split(".");
        const depth = parts.length - 1;
        const parentKey = parts.length > 1 ? parts.slice(0, -1).join(".") : "";
        return { profileKey, depth, parentKey, parts };
    });

    // Sort profiles while maintaining parent-child relationships
    const sortedProfiles: string[] = [];
    const processedProfiles = new Set<string>();

    // Helper function to add a profile and its descendants
    const addProfileAndDescendants = (profileKey: string) => {
        if (processedProfiles.has(profileKey)) return;

        // Find all profiles that have this profile as a parent
        const children = profileInfo.filter((info) => info.parentKey === profileKey);

        // Sort children based on the current sort order
        // For renamed profiles, we need to be more careful about sorting
        if (currentProfileSortOrder === "alphabetical") {
            children.sort((a, b) => {
                // Extract just the profile name (last part) for comparison
                const aName = a.parts[a.parts.length - 1];
                const bName = b.parts[b.parts.length - 1];
                return aName.localeCompare(bName);
            });
        } else if (currentProfileSortOrder === "reverse-alphabetical") {
            children.sort((a, b) => {
                // Extract just the profile name (last part) for comparison
                const aName = a.parts[a.parts.length - 1];
                const bName = b.parts[b.parts.length - 1];
                return bName.localeCompare(aName);
            });
        }

        // Add the current profile
        sortedProfiles.push(profileKey);
        processedProfiles.add(profileKey);

        // Recursively add all children
        children.forEach((child) => {
            addProfileAndDescendants(child.profileKey);
        });
    };

    // Get all top-level profiles (depth 0)
    const topLevelProfiles = profileInfo.filter((info) => info.depth === 0);

    // Sort top-level profiles
    if (currentProfileSortOrder === "alphabetical") {
        topLevelProfiles.sort((a, b) => {
            // Extract just the profile name (last part) for comparison
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return aName.localeCompare(bName);
        });
    } else if (currentProfileSortOrder === "reverse-alphabetical") {
        topLevelProfiles.sort((a, b) => {
            // Extract just the profile name (last part) for comparison
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return bName.localeCompare(aName);
        });
    }

    // Process each top-level profile and its descendants
    topLevelProfiles.forEach((info) => {
        addProfileAndDescendants(info.profileKey);
    });

    return sortedProfiles;
}
