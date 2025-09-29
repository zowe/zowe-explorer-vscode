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

import { ProfileSortOrder } from "./generalUtils";

export function sortProfilesAtLevel(profileKeys: string[], profileSortOrder: ProfileSortOrder | null): string[] {
    const currentProfileSortOrder = profileSortOrder || "natural";
    if (currentProfileSortOrder === "natural") {
        return profileKeys;
    }

    const profileInfo = profileKeys.map((profileKey) => {
        const parts = profileKey.split(".");
        const depth = parts.length - 1;
        const parentKey = parts.length > 1 ? parts.slice(0, -1).join(".") : "";
        return { profileKey, depth, parentKey, parts };
    });

    const sortedProfiles: string[] = [];
    const processedProfiles = new Set<string>();

    const addProfileAndDescendants = (profileKey: string) => {
        if (processedProfiles.has(profileKey)) return;

        const children = profileInfo.filter((info) => info.parentKey === profileKey);

        if (currentProfileSortOrder === "alphabetical") {
            children.sort((a, b) => {
                const aName = a.parts[a.parts.length - 1];
                const bName = b.parts[b.parts.length - 1];
                return aName.localeCompare(bName);
            });
        } else if (currentProfileSortOrder === "reverse-alphabetical") {
            children.sort((a, b) => {
                const aName = a.parts[a.parts.length - 1];
                const bName = b.parts[b.parts.length - 1];
                return bName.localeCompare(aName);
            });
        }

        sortedProfiles.push(profileKey);
        processedProfiles.add(profileKey);

        children.forEach((child) => {
            addProfileAndDescendants(child.profileKey);
        });
    };

    const topLevelProfiles = profileInfo.filter((info) => info.depth === 0);

    if (currentProfileSortOrder === "alphabetical") {
        topLevelProfiles.sort((a, b) => {
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return aName.localeCompare(bName);
        });
    } else if (currentProfileSortOrder === "reverse-alphabetical") {
        topLevelProfiles.sort((a, b) => {
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return bName.localeCompare(aName);
        });
    }

    topLevelProfiles.forEach((info) => {
        addProfileAndDescendants(info.profileKey);
    });

    return sortedProfiles;
}
