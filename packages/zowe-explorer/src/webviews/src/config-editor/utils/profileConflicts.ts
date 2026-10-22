/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import { isValidProfileNamePath } from "./profileNames";
import { splitProfilePath } from "./profilePaths";

/** Rename maps contain original identities and final destinations, never intermediate steps. */
export function resolveProfileKey(key: string, renames: Record<string, string>): string {
    const original = Object.keys(renames)
        .sort((a, b) => b.length - a.length)
        .find((source) => key === source || key.startsWith(source + "."));
    return original === undefined ? key : renames[original] + key.slice(original.length);
}

export function rebaseProfileKey(key: string, source: string, target: string): string {
    return key === source || key.startsWith(source + ".") ? target + key.slice(source.length) : key;
}

/** Saved keys need resolving once; pending changes and deletions already use displayed paths. */
export function getEffectiveProfileKeys(
    savedKeys: string[],
    pendingKeys: string[],
    renames: Record<string, string>,
    deletions: string[] = []
): string[] {
    const deletedProfiles = deletions.flatMap((path) => {
        const parsed = splitProfilePath(path.split("."));
        return parsed && !parsed.suffix.length ? [parsed.profileKey] : [];
    });
    return [...new Set([...savedKeys.map((key) => resolveProfileKey(key, renames)), ...pendingKeys])].filter(
        (key) => !deletedProfiles.some((deleted) => key === deleted || key.startsWith(deleted + "."))
    );
}

export type ProfileDestination = { status: "ready" | "noop"; key: string } | { status: "conflict"; message: string };

/** Shared by rename validation, move previews, paste and duplicate. Never overwrites a profile. */
export function resolveProfileDestination(params: {
    proposedKey: string;
    profileKeys: string[];
    sourceKey?: string;
    onConflict: "reject" | "suffix";
}): ProfileDestination {
    const { proposedKey, profileKeys, sourceKey, onConflict } = params;
    if (!isValidProfileNamePath(proposedKey)) {
        return { status: "conflict", message: "Profile path must contain valid, non-empty profile names" };
    }
    if (proposedKey === sourceKey) return { status: "noop", key: proposedKey };
    if (sourceKey && proposedKey.toLowerCase().startsWith(sourceKey.toLowerCase() + ".")) {
        return { status: "conflict", message: "Cannot move a profile inside itself" };
    }
    const occupied = profileKeys
        .filter((key) => !sourceKey || (key !== sourceKey && !key.startsWith(sourceKey + ".")))
        .map((key) => key.toLowerCase());
    const exists = (candidate: string) => occupied.some((key) => key === candidate.toLowerCase() || key.startsWith(candidate.toLowerCase() + "."));
    if (!exists(proposedKey)) return { status: "ready", key: proposedKey };
    if (onConflict === "reject") return { status: "conflict", message: `Profile '${proposedKey}' already exists` };
    let suffix = 1;
    while (exists(`${proposedKey}_${suffix}`)) suffix++;
    return { status: "ready", key: `${proposedKey}_${suffix}` };
}

/** Keep independent profiles independent, including when a destination reuses a vacated name. */
export function planProfileRename(renames: Record<string, string>, originalKey: string, currentKey: string, newKey: string): Record<string, string> {
    const result = Object.fromEntries(Object.entries(renames).map(([key, target]) => [key, rebaseProfileKey(target, currentKey, newKey)]));
    result[originalKey] = newKey;
    for (const [key, target] of Object.entries(result)) {
        if (key === target) delete result[key];
    }
    return result;
}
