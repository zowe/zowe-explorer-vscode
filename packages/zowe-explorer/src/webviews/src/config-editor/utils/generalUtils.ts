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

// Types
export type PropertySortOrder = "alphabetical" | "merged-first" | "non-merged-first";
export type ProfileSortOrder = "natural" | "alphabetical" | "reverse-alphabetical";

/**
 * Get user-friendly display name for sort order
 */
export function getSortOrderDisplayName(sortOrder: PropertySortOrder): string {
    switch (sortOrder) {
        case "alphabetical":
            return "Alphabetical";
        case "merged-first":
            return "Merged First";
        case "non-merged-first":
            return "Merged Last";
        default:
            return sortOrder;
    }
}

/**
 * Get user-friendly display name for profile sort order
 */
export function getProfileSortOrderDisplayName(sortOrder: ProfileSortOrder): string {
    switch (sortOrder) {
        case "natural":
            return "Natural";
        case "alphabetical":
            return "Alphabetical";
        case "reverse-alphabetical":
            return "Reverse Alphabetical";
        default:
            return sortOrder;
    }
}

/**
 * Get nested property from an object using a path array
 */
export function getNestedProperty(obj: any, path: string[]): any {
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
