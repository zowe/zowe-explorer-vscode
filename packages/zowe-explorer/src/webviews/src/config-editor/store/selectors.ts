/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import { flattenKeys } from "../utils";
import type { EditorData } from "./types";
import type { FlattenedConfig } from "../types";
import { doesSavedProfileExist } from "../utils/profileKeyListing";
import { getOriginalProfileKeyWithNested, getRenamedProfileKeyWithNested, isProfileOrParentDeleted } from "../utils/profileRenames";

// Loaded configuration objects are replaced on refresh/save; weak keys let obsolete snapshots be collected.
const flattenedProfiles = new WeakMap<object, FlattenedConfig>();
const flattenedDefaults = new WeakMap<object, FlattenedConfig>();
const emptyFlattened: FlattenedConfig = {};

/** Highlight only a profile whose displayed path already exists in the saved file. */
export function selectCanOpenProfileInFile(
    state: Pick<EditorData, "configurations" | "selectedTab" | "selectedProfileKey" | "renames" | "deletions" | "isSaving">
): boolean {
    const { selectedProfileKey, selectedTab, configurations, renames, deletions, isSaving } = state;
    const config = selectedTab === null ? undefined : configurations[selectedTab];
    if (!selectedProfileKey || !config || isSaving) return false;
    return (
        getOriginalProfileKeyWithNested(selectedProfileKey, config.configPath, renames) === selectedProfileKey &&
        getRenamedProfileKeyWithNested(selectedProfileKey, config.configPath, renames) === selectedProfileKey &&
        !isProfileOrParentDeleted(selectedProfileKey, deletions, config.configPath) &&
        doesSavedProfileExist(selectedProfileKey, config.configPath, configurations)
    );
}

export function selectFlattenedConfig(state: Pick<EditorData, "configurations" | "selectedTab">): FlattenedConfig {
    const config = state.selectedTab === null ? undefined : state.configurations[state.selectedTab];
    const profiles = config?.properties?.profiles;
    if (!profiles) return emptyFlattened;
    let result = flattenedProfiles.get(profiles);
    if (!result) {
        result = flattenKeys(profiles);
        flattenedProfiles.set(profiles, result);
    }
    return result;
}

export function selectFlattenedDefaults(state: Pick<EditorData, "configurations" | "selectedTab">): FlattenedConfig {
    const config = state.selectedTab === null ? undefined : state.configurations[state.selectedTab];
    const source = config?.properties?.defaults;
    if (!source) return emptyFlattened;
    const cached = flattenedDefaults.get(source);
    if (cached) return cached;
    const defaults = flattenKeys(source);
    const result = Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [
            key,
            {
                ...value,
                path: value.path[0] === "defaults" ? value.path : ["defaults", ...value.path],
            },
        ])
    );
    flattenedDefaults.set(source, result);
    return result;
}

export function selectHasPendingChanges(state: EditorData): boolean {
    return (
        Object.keys(state.pendingChanges).length > 0 ||
        Object.values(state.deletions).some((keys) => keys.length > 0) ||
        Object.keys(state.pendingDefaults).length > 0 ||
        Object.values(state.defaultsDeletions).some((keys) => keys.length > 0) ||
        Object.keys(state.autostoreChanges).length > 0 ||
        Object.values(state.renames).some((renames) => Object.keys(renames).length > 0) ||
        Object.values(state.dragDroppedProfiles).some((profiles) => profiles.size > 0)
    );
}
