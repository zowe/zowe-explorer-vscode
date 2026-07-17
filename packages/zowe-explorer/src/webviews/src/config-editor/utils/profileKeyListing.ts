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

import { flattenProfiles } from "./configUtils";
import { Configuration, ConfigStateContext, ProfileMap } from "../types";
import { getProfileType } from "./profileTypeResolution";
import { getRenamedProfileKeyWithNested } from "./profileRenames";

interface GetAvailableProfilesByTypeParams extends ConfigStateContext {
    profileType: string;
}

export function getAvailableProfilesByType(params: GetAvailableProfilesByTypeParams): string[] {
    const { profileType, selectedTab, configurations, pendingChanges, renames = {} } = params;

    if (selectedTab === null) return [];

    const currentConfig = configurations[selectedTab];

    const getProfilesFromConfig = (config: Configuration): string[] => {
        const configProps = config.properties;
        const flatProfiles = flattenProfiles(configProps.profiles);
        const profileNames = Object.keys(flatProfiles);

        const profilesWithPendingTypeChanges = new Set<string>();
        Object.entries(pendingChanges[config.configPath] || {}).forEach(([key, entry]) => {
            if (entry.profile) {
                const keyParts = key.split(".");
                const isTypeKey = keyParts[keyParts.length - 1] === "type" && !keyParts.includes("properties");
                if (isTypeKey) {
                    const profilePathParts = keyParts.slice(0, -1);
                    if (profilePathParts[0] === "profiles") {
                        const profileName = profilePathParts
                            .slice(1)
                            .filter((p) => p !== "profiles")
                            .join(".");
                        profilesWithPendingTypeChanges.add(profileName);
                    }
                }
            }
        });

        const profilesOfType = profileNames.filter((profileKey) => {
            if (profilesWithPendingTypeChanges.has(profileKey)) {
                return false;
            }

            const configIndex = configurations.findIndex((c) => c.configPath === config.configPath);
            const profileTypeValue = getProfileType({
                profileKey,
                selectedTab: configIndex,
                configurations,
                pendingChanges,
                renames,
            });
            return profileTypeValue === profileType;
        });

        const pendingProfiles = new Set<string>();
        Object.entries(pendingChanges[config.configPath] || {}).forEach(([key, entry]) => {
            if (entry.profile) {
                const keyParts = key.split(".");
                const isTypeKey = keyParts[keyParts.length - 1] === "type" && !keyParts.includes("properties");
                if (isTypeKey && entry.value === profileType) {
                    const profilePathParts = keyParts.slice(0, -1);
                    if (profilePathParts[0] === "profiles") {
                        const profileName = profilePathParts
                            .slice(1)
                            .filter((p) => p !== "profiles")
                            .join(".");
                        pendingProfiles.add(profileName);
                    }
                }
            }
        });

        const renamedProfilesOfType = profilesOfType.map((profileKey) => getRenamedProfileKeyWithNested(profileKey, config.configPath, renames));
        const renamedPendingProfiles = Array.from(pendingProfiles).map((profileKey) =>
            getRenamedProfileKeyWithNested(profileKey, config.configPath, renames)
        );

        return [...renamedProfilesOfType, ...renamedPendingProfiles];
    };

    const configsToInclude: Configuration[] = [currentConfig];

    const isProjectUser = currentConfig.user && !currentConfig.global;
    const isProjectTeam = !currentConfig.user && !currentConfig.global;
    const isGlobalUser = currentConfig.user && currentConfig.global;

    if (isProjectUser) {
        const projectTeam = configurations.find((c) => !c.user && !c.global);
        if (projectTeam) configsToInclude.push(projectTeam);
        const globalUser = configurations.find((c) => c.user && c.global);
        if (globalUser) configsToInclude.push(globalUser);
        const globalTeam = configurations.find((c) => !c.user && c.global);
        if (globalTeam) configsToInclude.push(globalTeam);
    } else if (isProjectTeam) {
        const globalUser = configurations.find((c) => c.user && c.global);
        if (globalUser) configsToInclude.push(globalUser);
        const globalTeam = configurations.find((c) => !c.user && c.global);
        if (globalTeam) configsToInclude.push(globalTeam);
    } else if (isGlobalUser) {
        const globalTeam = configurations.find((c) => !c.user && c.global);
        if (globalTeam) configsToInclude.push(globalTeam);
    }

    const allProfiles = new Set<string>();
    configsToInclude.forEach((config) => {
        const profiles = getProfilesFromConfig(config);
        profiles.forEach((p) => allProfiles.add(p));
    });

    return Array.from(allProfiles);
}

interface GetOrderedProfileKeysParams {
    profiles: ProfileMap;
    parentKey?: string;
    deletedProfiles?: string[];
    isProfileOrParentDeleted?: (profileKey: string, deletedProfiles: string[]) => boolean;
}

export function getOrderedProfileKeys(params: GetOrderedProfileKeysParams): string[] {
    const { profiles, parentKey = "", deletedProfiles = [], isProfileOrParentDeleted } = params;

    const keys: string[] = [];
    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

        if (!isProfileOrParentDeleted || !isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
            keys.push(qualifiedKey);
        }

        if (profile.profiles) {
            keys.push(
                ...getOrderedProfileKeys({
                    profiles: profile.profiles as ProfileMap,
                    parentKey: qualifiedKey,
                    deletedProfiles,
                    isProfileOrParentDeleted,
                })
            );
        }
    }
    return keys;
}

export function getAllProfileKeys(profiles: ProfileMap, parentKey = ""): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(profiles)) {
        const profile = profiles[key];
        const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
        keys.push(qualifiedKey);

        if (profile.profiles) {
            keys.push(...getAllProfileKeys(profile.profiles as ProfileMap, qualifiedKey));
        }
    }
    return keys;
}

export function getReplacementProfileAfterDelete(orderedList: string[], deletedProfileKey: string): string | null {
    const filteredSet = new Set(orderedList.filter((p) => p !== deletedProfileKey && !p.startsWith(deletedProfileKey + ".")));
    if (filteredSet.size === 0) return null;

    const deletedIndex = orderedList.indexOf(deletedProfileKey);
    const parentKey = deletedProfileKey.includes(".") ? deletedProfileKey.split(".").slice(0, -1).join(".") : null;

    const isSibling = (p: string): boolean => {
        if (p === deletedProfileKey) return false;
        if (parentKey === null) return !p.includes(".");
        const afterParent = parentKey.length + 1;
        return p.startsWith(parentKey + ".") && !p.substring(afterParent).includes(".");
    };

    if (deletedIndex >= 0) {
        for (let i = deletedIndex + 1; i < orderedList.length; i++) {
            const p = orderedList[i];
            if (filteredSet.has(p) && isSibling(p)) return p;
        }
        for (let i = deletedIndex - 1; i >= 0; i--) {
            const p = orderedList[i];
            if (filteredSet.has(p) && isSibling(p)) return p;
        }
    } else {
        const siblings = orderedList.filter((p) => filteredSet.has(p) && isSibling(p));
        if (siblings.length > 0) {
            const lastIndex = Math.max(...siblings.map((p) => orderedList.indexOf(p)));
            return orderedList[lastIndex];
        }
    }

    if (parentKey !== null && filteredSet.has(parentKey)) return parentKey;

    if (deletedIndex >= 0) {
        for (let i = deletedIndex + 1; i < orderedList.length; i++) {
            const p = orderedList[i];
            if (filteredSet.has(p)) return p;
        }
        for (let i = deletedIndex - 1; i >= 0; i--) {
            const p = orderedList[i];
            if (filteredSet.has(p)) return p;
        }
    }

    const first = orderedList.find((p) => filteredSet.has(p));
    return first ?? null;
}
