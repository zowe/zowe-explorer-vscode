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

import type { RenamesMap, FormattedPendingChanges, PendingChangesMap, PendingDefaultsMap, DeletionsMap } from "../types";

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
            const { value, path, profile, secure, secureSource } = changesForPath[key];
            return { key, value, path, profile, configPath, secure, ...(secureSource ? { secureSource } : {}) };
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

    return {
        profilePathsAreEffective: true,
        changes,
        deletions: deleteKeys,
        defaultsChanges,
        defaultsDeleteKeys,
        renames: renamesData,
    };
}

export const hasPendingRename = (profileKey: string, configPath: string, renames: RenamesMap): boolean => {
    if (!configPath) {
        return false;
    }
    const renamesForConfig = renames[configPath] || {};
    const result = Object.values(renamesForConfig).includes(profileKey);

    return result;
};
