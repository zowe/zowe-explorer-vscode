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

import type { RenameChange } from "../types";

/** Converts a dotted profile key into its nested JSON path, without property suffixes. */
export function profileKeyToPath(profileKey: string): string[] {
    return profileKey.split(".").flatMap((part) => ["profiles", part]);
}

/**
 * Resolves a dotted profile name through a chain of renames (e.g. a -> b, b -> c yields "a" -> "c"),
 * also covering renames of an ancestor segment (e.g. rename "a" -> "x" updates "a.child" -> "x.child").
 * Handles renames that change nesting depth in either direction (e.g. "b" -> "a.b" or "a.b" -> "c").
 */
export const applyRenameChainToProfileName = (profileName: string, renames: RenameChange[]): string => {
    let effectiveName = profileName;
    const appliedRenames = new Set<string>();
    let changed = true;

    while (changed) {
        changed = false;

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

/** Split the alternating profiles/name prefix from a JSON path's property suffix. */
export function splitProfilePath(tokens: string[]): { profileKey: string; suffix: string[] } | null {
    if (tokens[0] !== "profiles" || tokens.length < 2) return null;
    const names: string[] = [];
    let index = 0;
    while (tokens[index] === "profiles" && index + 1 < tokens.length) {
        names.push(tokens[index + 1]);
        index += 2;
    }
    return { profileKey: names.join("."), suffix: tokens.slice(index) };
}

/** Rewrite a profile address without touching names inside its properties or secure metadata. */
export function mapProfilePath<T extends string | string[]>(path: T, resolve: (profileKey: string) => string): T {
    const tokens = typeof path === "string" ? path.split(".") : (path as string[]);
    const parsed = splitProfilePath(tokens);
    if (!parsed) return path;
    const profileKey = resolve(parsed.profileKey);
    if (profileKey === parsed.profileKey) return path;
    const result = [...profileKeyToPath(profileKey), ...parsed.suffix];
    return (typeof path === "string" ? result.join(".") : result) as T;
}
