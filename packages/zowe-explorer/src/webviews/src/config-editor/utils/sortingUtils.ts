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

import { ProfileSortOrder } from "../types";

export function sortProfilesAtLevel(profileKeys: string[], profileSortOrder: ProfileSortOrder | null): string[] {
    const currentProfileSortOrder = profileSortOrder || "natural";
    if (currentProfileSortOrder === "natural") {
        return profileKeys;
    }

    const childrenByParent = new Map<string, string[]>();
    for (const key of profileKeys) {
        const lastDot = key.lastIndexOf(".");
        const parent = lastDot === -1 ? "" : key.slice(0, lastDot);
        const children = childrenByParent.get(parent) ?? [];
        children.push(key);
        childrenByParent.set(parent, children);
    }
    const direction = currentProfileSortOrder === "reverse-alphabetical" ? -1 : 1;
    if (currentProfileSortOrder === "alphabetical" || currentProfileSortOrder === "reverse-alphabetical") {
        for (const children of childrenByParent.values()) {
            children.sort((a, b) => direction * a.slice(a.lastIndexOf(".") + 1).localeCompare(b.slice(b.lastIndexOf(".") + 1)));
        }
    }
    const result: string[] = [];
    const visited = new Set<string>();
    const visitChildren = (parent: string) => {
        for (const key of childrenByParent.get(parent) ?? []) {
            if (visited.has(key)) continue;
            visited.add(key);
            result.push(key);
            visitChildren(key);
        }
    };
    visitChildren("");
    return result;
}
