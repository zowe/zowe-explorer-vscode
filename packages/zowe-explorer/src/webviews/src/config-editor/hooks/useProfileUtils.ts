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

import { useCallback } from "react";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "./useUtilityHelpers";
import { updateChangesForRenames } from "../utils/renameUtils";
import { flattenProfiles, getRenamedProfileKeyWithNested, sortProfilesAtLevel } from "../utils";

export function useProfileUtils() {
    const {
        configurations,
        selectedTab,
        pendingChanges,
        deletions,
        pendingDefaults,
        defaultsDeletions,
        autostoreChanges,
        renames,
        dragDroppedProfiles,
        configEditorSettings,
    } = useConfigContext();

    const { profileSortOrder } = configEditorSettings;

    const utilityHelpers = useUtilityHelpers();

    const formatPendingChanges = useCallback(() => {
        const changes = Object.entries(pendingChanges).flatMap(([configPath, changesForPath]) =>
            Object.keys(changesForPath).map((key) => {
                const { value, path, profile, secure } = changesForPath[key];
                return { key, value, path, profile, configPath, secure };
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

        const updatedChanges = updateChangesForRenames(changes, renamesData);

        const result = {
            changes: updatedChanges,
            deletions: deleteKeys,
            defaultsChanges,
            defaultsDeleteKeys: defaultsDeleteKeys,
            renames: renamesData,
        };

        return result;
    }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames]);

    const getAvailableProfiles = useCallback(() => {
        if (selectedTab === null) return ["root"];

        const config = configurations[selectedTab].properties;
        const flatProfiles = flattenProfiles(config.profiles);
        const profileNames = Object.keys(flatProfiles);

        const pendingProfiles = new Set<string>();
        Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([_, entry]) => {
            if (entry.profile) {
                pendingProfiles.add(entry.profile);
            }
        });

        const deletedProfiles = new Set<string>();
        const configPath = configurations[selectedTab].configPath;
        const deletedKeys = deletions[configPath] || [];
        deletedKeys.forEach((key) => {
            const keyParts = key.split(".");
            if (keyParts[0] === "profiles" && keyParts.length >= 2) {
                const profileParts: string[] = [];
                for (let i = 1; i < keyParts.length; i++) {
                    if (keyParts[i] !== "profiles") {
                        profileParts.push(keyParts[i]);
                    }
                }
                const profileName = profileParts.join(".");
                deletedProfiles.add(profileName);

                const renamedDeletedProfile = getRenamedProfileKeyWithNested(profileName, configPath, renames);
                if (renamedDeletedProfile !== profileName) {
                    deletedProfiles.add(renamedDeletedProfile);
                }

                profileNames.forEach((existingProfile) => {
                    if (existingProfile.startsWith(profileName + ".")) {
                        deletedProfiles.add(existingProfile);
                        const renamedProfile = getRenamedProfileKeyWithNested(existingProfile, configPath, renames);
                        deletedProfiles.add(renamedProfile);
                    }
                });
            }
        });

        const renamedProfileNames = profileNames.map((profileName) => {
            const configPath = configurations[selectedTab].configPath;
            return getRenamedProfileKeyWithNested(profileName, configPath, renames);
        });

        const allProfiles = new Set(["root", ...renamedProfileNames, ...Array.from(pendingProfiles)]);
        deletedProfiles.forEach((profile) => allProfiles.delete(profile));

        const profilesToSort = Array.from(allProfiles);
        const result = sortProfilesAtLevel(profilesToSort, profileSortOrder);

        return result;
    }, [selectedTab, configurations, pendingChanges, deletions, renames, profileSortOrder]);

    const getAvailableProfilesForConfig = useCallback(
        (configPath: string): string[] => {
            const config = configurations.find((c) => c.configPath === configPath);
            const profilesObj = config?.properties?.profiles;
            if (!profilesObj) {
                return [];
            }

            const pendingProfiles = utilityHelpers.extractPendingProfiles(configPath);

            const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
                const available: string[] = [];
                for (const key of Object.keys(profiles)) {
                    const profile = profiles[key];
                    const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

                    if (!utilityHelpers.isProfileOrParentDeleted(qualifiedKey, configPath)) {
                        available.push(qualifiedKey);
                    }

                    if (profile.profiles) {
                        available.push(...getAvailableProfiles(profile.profiles, qualifiedKey));
                    }
                }
                return available;
            };

            const existingProfiles = getAvailableProfiles(profilesObj);
            const pendingProfileKeys = Object.keys(pendingProfiles).filter(
                (key) => !existingProfiles.includes(key) && !utilityHelpers.isProfileOrParentDeleted(key, configPath)
            );

            return [...existingProfiles, ...pendingProfileKeys];
        },
        [configurations, selectedTab, deletions, utilityHelpers]
    );

    const doesProfileExist = useCallback(
        (profileKey: string, configPath: string): boolean => {
            const availableProfiles = getAvailableProfilesForConfig(configPath);
            return availableProfiles.includes(profileKey);
        },
        [getAvailableProfilesForConfig]
    );

    const hasPendingChanges = useCallback(() => {
        const hasChanges = Object.keys(pendingChanges).length > 0;
        const hasDeletions = Object.entries(deletions).some(([_, keys]) => keys.length > 0);
        const hasPendingDefaults = Object.keys(pendingDefaults).length > 0;
        const hasDefaultsDeletions = Object.entries(defaultsDeletions).some(([_, keys]) => keys.length > 0);
        const hasAutostoreChanges = Object.keys(autostoreChanges).length > 0;
        const hasRenames = Object.entries(renames).some(([_, configRenames]) => Object.keys(configRenames).length > 0);
        const hasDragDroppedProfiles = Object.entries(dragDroppedProfiles).some(([_, profiles]) => profiles.size > 0);

        return (
            hasChanges || hasDeletions || hasPendingDefaults || hasDefaultsDeletions || hasAutostoreChanges || hasRenames || hasDragDroppedProfiles
        );
    }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions, autostoreChanges, renames, dragDroppedProfiles]);

    return {
        formatPendingChanges,
        getAvailableProfiles,
        getAvailableProfilesForConfig,
        doesProfileExist,
        hasPendingChanges,
    };
}
