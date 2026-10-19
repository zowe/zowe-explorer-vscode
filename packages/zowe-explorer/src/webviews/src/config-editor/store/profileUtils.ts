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

import type { EditorRuntime } from "./types";
import { extractPendingProfiles, isProfileOrParentDeleted } from "../utils";
import { buildFormattedPendingChanges } from "../utils/renameUtils";
import { getAllQualifiedProfileKeys } from "../utils/profileRenames";
import { getVisibleProfileKeys } from "../utils/profileKeyListing";
import { selectHasPendingChanges } from "./selectors";
import { doesSavedProfileExist as doesSavedProfileExistInConfig } from "../utils/profileKeyListing";
import type { FormattedPendingChanges } from "../types";

export function createProfileUtils(
    state: Pick<
        EditorRuntime,
        | "configurations"
        | "selectedTab"
        | "pendingChanges"
        | "deletions"
        | "pendingDefaults"
        | "defaultsDeletions"
        | "autostoreChanges"
        | "renames"
        | "dragDroppedProfiles"
        | "configEditorSettings"
    >
) {
    const { configurations, selectedTab, pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames, configEditorSettings } = state;

    const { profileSortOrder } = configEditorSettings;

    const formatPendingChanges = (): FormattedPendingChanges =>
        buildFormattedPendingChanges({ pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames });

    const getAvailableProfiles = () => {
        if (selectedTab === null) return ["root"];

        const config = configurations[selectedTab];
        const pendingProfiles = Object.fromEntries(extractPendingProfiles(pendingChanges, config.configPath).map((key) => [key, {}]));
        return [
            "root",
            ...getVisibleProfileKeys({
                profiles: config.properties.profiles,
                pendingProfiles,
                configPath: config.configPath,
                renames,
                deletions,
                sortOrder: profileSortOrder,
            }),
        ];
    };

    const getAvailableProfilesForConfig = (configPath: string): string[] => {
        const config = configurations.find((c) => c.configPath === configPath);
        const profilesObj = config?.properties?.profiles;
        if (!profilesObj) {
            return [];
        }

        const pendingProfiles = extractPendingProfiles(pendingChanges, configPath);

        const existingProfiles = getAllQualifiedProfileKeys(profilesObj).filter((key) => !isProfileOrParentDeleted(key, deletions, configPath));
        const pendingProfileKeys = pendingProfiles.filter(
            (key) => !existingProfiles.includes(key) && !isProfileOrParentDeleted(key, deletions, configPath)
        );

        return [...existingProfiles, ...pendingProfileKeys];
    };

    const doesProfileExist = (profileKey: string, configPath: string): boolean => {
        const availableProfiles = getAvailableProfilesForConfig(configPath);
        return availableProfiles.includes(profileKey);
    };

    const doesSavedProfileExist = (profileKey: string, configPath: string): boolean =>
        doesSavedProfileExistInConfig(profileKey, configPath, configurations);

    const hasPendingChanges = () => selectHasPendingChanges(state);

    return {
        formatPendingChanges,
        getAvailableProfiles,
        getAvailableProfilesForConfig,
        doesProfileExist,
        doesSavedProfileExist,
        hasPendingChanges,
    };
}
