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

import { flattenProfiles, extractProfileKeyFromPath } from "./configUtils";
import {
    Configuration,
    ConfigStateContext,
    SchemaContext,
    RenamesMap,
    DeletionsMap,
    PendingChangesMap,
    MergedPropertiesVisibility,
    MergedPropertiesMap,
    ProfileMap,
} from "../types";

interface GetProfileTypeParams extends ConfigStateContext {
    profileKey: string;
}

export function getProfileType(params: GetProfileTypeParams): string | null {
    const { profileKey, selectedTab, configurations, pendingChanges, renames } = params;

    if (selectedTab === null) return null;
    const configPath = configurations[selectedTab!]!.configPath;

    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    const pendingType = Object.entries(pendingChanges[configPath] ?? {}).find(([key, entry]) => {
        if (entry.profile !== profileKey && entry.profile !== originalProfileKey) return false;
        const keyParts = key.split(".");
        const isProfileLevelType = keyParts[keyParts.length - 1] === "type" && !keyParts.includes("properties");
        return isProfileLevelType;
    });

    if (pendingType) {
        const raw = pendingType[1].value;
        if (raw == null || String(raw).trim() === "") {
            return null;
        }
        return raw as string;
    }

    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    let profile = flatProfiles[profileKey];

    if (!profile) {
        profile = flatProfiles[originalProfileKey];
    }

    if (!profile && profileKey.includes(".")) {
        const profileParts = profileKey.split(".");
        let originalPath = "";

        for (let i = 0; i < profileParts.length; i++) {
            const currentLevelPath = profileParts.slice(0, i + 1).join(".");
            const originalLevelPath = getOriginalProfileKey(currentLevelPath, configPath, renames);

            if (i === 0) {
                originalPath = originalLevelPath;
            } else {
                if (originalLevelPath !== currentLevelPath) {
                    const originalParentParts = originalLevelPath.split(".");
                    const remainingParts = profileParts.slice(originalParentParts.length);
                    originalPath = originalLevelPath + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
                    break;
                } else {
                    originalPath = originalPath + "." + profileParts[i];
                }
            }
        }

        if (originalPath !== profileKey && originalPath !== originalProfileKey) {
            profile = flatProfiles[originalPath];
        }
    }

    if (profile && typeof profile.type === "string") {
        return profile.type;
    }

    return null;
}

export function getRenamedProfileKey(originalKey: string, configPath: string, renames: RenamesMap): string {
    const configRenames = renames[configPath];
    return configRenames?.[originalKey] || originalKey;
}

export function getRenamedProfileKeyWithNested(profileKey: string, configPath: string, renames: RenamesMap): string {
    if (!profileKey.includes(".")) {
        return getRenamedProfileKey(profileKey, configPath, renames);
    }

    const directRename = getRenamedProfileKey(profileKey, configPath, renames);
    if (directRename !== profileKey) {
        return directRename;
    }

    const configRenames = renames[configPath] || {};
    let renamedPath = profileKey;

    let changed = true;
    while (changed) {
        changed = false;
        const sortedRenames = Object.entries(configRenames).sort(([a], [b]) => b.length - a.length);

        for (const [originalKey, newKey] of sortedRenames) {
            if (renamedPath === originalKey) {
                renamedPath = newKey;
                changed = true;
                break;
            }

            if (renamedPath.startsWith(originalKey + ".")) {
                renamedPath = renamedPath.replace(originalKey + ".", newKey + ".");
                changed = true;
                break;
            }
        }
    }

    return renamedPath;
}

export function getOriginalProfileKey(renamedKey: string, configPath: string, renames: RenamesMap): string {
    const configRenames = renames[configPath];
    if (configRenames) {
        const visited = new Set<string>();
        let currentKey = renamedKey;

        while (true) {
            let foundOriginal = false;
            for (const [originalKey, newKey] of Object.entries(configRenames)) {
                if (newKey === currentKey && !visited.has(originalKey)) {
                    visited.add(originalKey);
                    currentKey = originalKey;
                    foundOriginal = true;
                    break;
                }
            }

            if (!foundOriginal) {
                break;
            }
        }

        return currentKey;
    }
    return renamedKey;
}

export function getOriginalProfileKeyWithNested(renamedKey: string, configPath: string, renames: RenamesMap): string {
    if (!renamedKey.includes(".")) {
        return getOriginalProfileKey(renamedKey, configPath, renames);
    }

    const directOriginal = getOriginalProfileKey(renamedKey, configPath, renames);
    if (directOriginal !== renamedKey) {
        return directOriginal;
    }

    const profileParts = renamedKey.split(".");
    let originalPath = "";

    const configRenames = renames[configPath] || {};
    for (const [origKey, _] of Object.entries(configRenames)) {
        if (origKey.includes(".")) {
            const wouldProduce = getRenamedProfileKeyWithNested(origKey, configPath, renames);
            if (wouldProduce === renamedKey) {
                return origKey;
            }
        }
    }

    for (let i = 0; i < profileParts.length; i++) {
        const currentPath = profileParts.slice(0, i + 1).join(".");
        const original = getOriginalProfileKey(currentPath, configPath, renames);

        if (original !== currentPath) {
            const remainingParts = profileParts.slice(i + 1);
            originalPath = original + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
            break;
        } else if (i === 0) {
            originalPath = profileParts[i];
        } else {
            originalPath = originalPath + "." + profileParts[i];
        }
    }

    const profilePartsForParentCheck = originalPath.split(".");

    for (let i = 0; i < profilePartsForParentCheck.length; i++) {
        const parentPath = profilePartsForParentCheck.slice(0, i + 1).join(".");

        for (const [origKey, newKey] of Object.entries(configRenames)) {
            if (newKey === parentPath) {
                const remainingParts = profilePartsForParentCheck.slice(i + 1);
                originalPath = origKey + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
                break;
            }
        }
    }

    return originalPath;
}

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

interface IsPropertyActuallyInheritedParams extends ConfigStateContext {
    profilePath: string;
    currentProfileKey: string | null;
    configPath: string;
    propertyName: string | undefined;
}

export function isPropertyActuallyInherited(params: IsPropertyActuallyInheritedParams): boolean {
    const { profilePath, currentProfileKey, configPath, propertyName, selectedTab, configurations, pendingChanges, renames } = params;

    if (!profilePath || !currentProfileKey) {
        return false;
    }

    if (profilePath === currentProfileKey) {
        return false;
    }

    if (propertyName) {
        const currentProfilePath = `profiles.${currentProfileKey}`;
        const propertyPendingKey = `${currentProfilePath}.properties.${propertyName}`;

        const configRenames = renames[configPath] || {};
        let originalProfileKey = currentProfileKey;

        for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (newKey === currentProfileKey) {
                originalProfileKey = originalKey;
                break;
            }
        }

        const originalProfilePath = `profiles.${originalProfileKey}`;
        const originalPropertyPendingKey = `${originalProfilePath}.properties.${propertyName}`;

        let nestedPropertyPendingKey = "";
        if (originalProfileKey.includes(".")) {
            const profileParts = originalProfileKey.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            pathParts.push("properties", propertyName);
            nestedPropertyPendingKey = pathParts.join(".");
        }

        const hasPendingChanges =
            pendingChanges[configPath]?.[propertyPendingKey] !== undefined ||
            pendingChanges[configPath]?.[originalPropertyPendingKey] !== undefined ||
            (nestedPropertyPendingKey && pendingChanges[configPath]?.[nestedPropertyPendingKey] !== undefined);

        if (hasPendingChanges) {
            return false;
        }
    }

    const renamesForConfig = renames[configPath] || {};

    const getOriginalName = (profileName: string): string => {
        let originalName = profileName;

        let changed = true;
        while (changed) {
            changed = false;

            const sortedRenames = Object.entries(renamesForConfig).sort(([, a], [, b]) => b.length - a.length);

            for (const [originalKey, newKey] of sortedRenames) {
                if (originalName === newKey) {
                    originalName = originalKey;
                    changed = true;
                    break;
                }

                if (originalName.startsWith(newKey + ".")) {
                    originalName = originalName.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                }
            }
        }

        return originalName;
    };

    const originalSourcePath = getOriginalName(profilePath);
    const originalCurrentPath = getOriginalName(currentProfileKey);

    if (originalSourcePath === originalCurrentPath) {
        return false;
    }

    const config = configurations[selectedTab!]?.properties;
    if (config) {
        const checkInheritanceChain = (currentProfile: string, sourceProfile: string): boolean => {
            const currentProfileType = getProfileType({ profileKey: currentProfile, selectedTab, configurations, pendingChanges, renames });
            if (!currentProfileType) return false;

            const defaults = config.defaults || {};
            const defaultForType = defaults[currentProfileType];

            if (defaultForType) {
                const renamedDefault = getRenamedProfileKeyWithNested(defaultForType, configPath, renames);
                if (renamedDefault === sourceProfile) {
                    return true;
                }
            }

            const sourceProfileType = getProfileType({ profileKey: sourceProfile, selectedTab, configurations, pendingChanges, renames });
            if (sourceProfileType && sourceProfileType === currentProfileType) {
                const sourceDefaultForType = defaults[sourceProfileType];
                if (sourceDefaultForType) {
                    const renamedSourceDefault = getRenamedProfileKeyWithNested(sourceDefaultForType, configPath, renames);
                    if (renamedSourceDefault === sourceProfile) {
                        return true;
                    }
                }
            }

            return false;
        };

        if (checkInheritanceChain(currentProfileKey, profilePath)) {
            return true;
        }
    }

    return true;
}

interface MergePendingChangesParams {
    baseObj: Record<string, unknown>;
    path: string[];
    configPath: string;
    pendingChanges: PendingChangesMap;
    renames: RenamesMap;
}

export function mergePendingChangesForProfile(params: MergePendingChangesParams): Record<string, unknown> {
    const { baseObj, path, configPath, pendingChanges, renames } = params;

    const currentProfileKey = extractProfileKeyFromPath(path);
    const pendingChangesAtLevel: Record<string, unknown> = {};

    const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

    const isProfileKeyMatch = (entryProfileKey: string): boolean => {
        if (entryProfileKey === currentProfileKey || entryProfileKey === originalProfileKey) {
            return true;
        }

        if (getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames) === entryProfileKey) {
            return true;
        }

        if (entryProfileKey.includes(".") || currentProfileKey.includes(".")) {
            const renamedEntryProfileKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
            if (renamedEntryProfileKey === currentProfileKey) {
                return true;
            }

            const originalOfCurrentKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);
            if (entryProfileKey === originalOfCurrentKey) {
                return true;
            }

            const entryParts = entryProfileKey.split(".");
            const currentParts = currentProfileKey.split(".");

            if (entryParts.length < currentParts.length) {
                const currentParentKey = currentParts.slice(0, entryParts.length).join(".");
                const renamedEntryKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
                if (renamedEntryKey === currentParentKey) {
                    return true;
                }
            }

            if (currentParts.length < entryParts.length) {
                const entryParentKey = entryParts.slice(0, currentParts.length).join(".");
                const renamedEntryParentKey = getRenamedProfileKeyWithNested(entryParentKey, configPath, renames);
                if (renamedEntryParentKey === currentProfileKey) {
                    return true;
                }
            }
        }

        return false;
    };

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
        if (!isProfileKeyMatch(entry.profile)) {
            return;
        }

        let relativePath: string[] = [];
        const propertiesMarker = ".properties.";
        const markerIndex = key.indexOf(propertiesMarker);

        const isCurrentlyInsideProperties = path[path.length - 1] === "properties";

        if (markerIndex !== -1) {
            const propertyPath = key.substring(markerIndex + propertiesMarker.length);
            const propertyPathParts = propertyPath.split(".");

            if (isCurrentlyInsideProperties) {
                relativePath = propertyPathParts;
            } else {
                relativePath = ["properties", ...propertyPathParts];
            }
        } else {
            if (isCurrentlyInsideProperties) {
                return;
            }

            const keyParts = key.split(".");
            let i = 2;
            while (i < keyParts.length && keyParts[i] === "profiles" && i + 1 < keyParts.length) {
                i += 2;
            }
            if (i < keyParts.length) {
                relativePath = keyParts.slice(i);
            } else {
                relativePath = [];
            }
        }

        if (relativePath.length === 0) {
            return;
        }

        if (relativePath.length === 1) {
            if (relativePath[0] !== "properties" && relativePath[0] !== "profiles") {
                pendingChangesAtLevel[relativePath[0]] = entry.value;
            }
        } else if (relativePath.length > 1 && relativePath[0] !== "profiles") {
            let current: Record<string, unknown> = baseObj;
            for (let i = 0; i < relativePath.length - 1; i++) {
                if (!current[relativePath[i]]) {
                    current[relativePath[i]] = {};
                }
                current = current[relativePath[i]] as Record<string, unknown>;
            }
            current[relativePath[relativePath.length - 1]] = entry.value;
        }

        if (entry.secure && !isCurrentlyInsideProperties) {
            if (!Array.isArray(baseObj.secure)) {
                baseObj.secure = [];
            }

            const keyParts = key.split(".");
            const propertyName = keyParts[keyParts.length - 1];

            if (!(baseObj.secure as string[]).includes(propertyName)) {
                (baseObj.secure as string[]).push(propertyName);
            }
        }
    });

    return { ...baseObj, ...pendingChangesAtLevel };
}

export function isMergedPropertySecure(_displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean): boolean {
    if (!jsonLoc) return false;

    if (secure !== undefined) {
        return secure;
    }

    return false;
}

export function getProfileTypeFromPath(path: string[]): string | null {
    if (path.length < 2 || path[0] !== "profiles") {
        return null;
    }

    let profileName = "";
    for (let i = 1; i < path.length; i++) {
        if (path[i] !== "profiles" && path[i] !== "properties" && path[i] !== "secure") {
            profileName = path[i];
            break;
        }
    }

    return profileName || null;
}

interface CanPropertyBeSecureParams extends SchemaContext {
    displayKey: string;
    selectedProfileKey?: string | null;
}

export function canPropertyBeSecure(params: CanPropertyBeSecureParams): boolean {
    const { displayKey, selectedTab, configurations, schemaValidations, pendingChanges, renames, selectedProfileKey } = params;

    if (!displayKey || selectedTab === null) {
        return false;
    }

    const config = configurations[selectedTab];
    if (!config) {
        return false;
    }

    const configPath = config.configPath;
    const validation = schemaValidations[configPath];

    if (!validation) {
        return false;
    }

    if (selectedProfileKey) {
        const currentProfileType = getProfileType({ profileKey: selectedProfileKey, selectedTab, configurations, pendingChanges, renames });
        if (currentProfileType) {
            const propertySchema = validation.propertySchema[currentProfileType] || {};
            return propertySchema[displayKey]?.secure === true;
        }
    }

    if (validation.propertySchema) {
        for (const profileType in validation.propertySchema) {
            const propertySchema = validation.propertySchema[profileType];
            if (propertySchema[displayKey]?.secure === true) {
                return true;
            }
        }
    }

    return false;
}

interface IsPropertySecureParams {
    fullKey: string;
    displayKey: string;
    path: string[];
    mergedProps?: MergedPropertiesMap;
    selectedTab?: number | null;
    configurations?: Configuration[];
    pendingChanges?: PendingChangesMap;
    renames?: RenamesMap;
}

export function isPropertySecure(params: IsPropertySecureParams): boolean {
    const { fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames } = params;

    if (!displayKey || !path || path.length === 0) {
        return false;
    }

    if (mergedProps && mergedProps[displayKey]) {
        const mergedPropData = mergedProps[displayKey];
        if (mergedPropData.secure !== undefined) {
            return mergedPropData.secure;
        }
    }

    if (selectedTab !== null && selectedTab !== undefined && configurations && pendingChanges) {
        const config = configurations[selectedTab];
        if (config) {
            const configPath = config.configPath;
            let pendingChange = pendingChanges[configPath]?.[fullKey];

            if (!pendingChange && renames && renames[configPath]) {
                const currentProfileKey = extractProfileKeyFromPath(path);
                const renamedProfileKey = getRenamedProfileKeyWithNested(currentProfileKey, configPath, renames);

                if (renamedProfileKey !== currentProfileKey) {
                    const newProfileParts: string[] = ["profiles"];
                    renamedProfileKey.split(".").forEach((p, idx, arr) => {
                        newProfileParts.push(p);
                        if (idx < arr.length - 1) newProfileParts.push("profiles");
                    });
                    const newPrefix = newProfileParts.join(".");

                    const currentProfilePartsCount = currentProfileKey.split(".").length;
                    const segmentsToSkip = currentProfilePartsCount * 2;
                    const originalFullKeyParts = fullKey.split(".");
                    const propertyPart = originalFullKeyParts.slice(segmentsToSkip).join(".");

                    const renamedFullKey = propertyPart ? `${newPrefix}.${propertyPart}` : newPrefix;

                    pendingChange = pendingChanges[configPath]?.[renamedFullKey];
                }
            }

            if (pendingChange && pendingChange.secure !== undefined) {
                return pendingChange.secure;
            }
        }
    }

    if (selectedTab !== null && selectedTab !== undefined && configurations) {
        const config = configurations[selectedTab];
        if (config) {
            const keyParts = fullKey.split(".");
            const propertyName = keyParts[keyParts.length - 1];

            if (config.secure && config.secure.includes(propertyName)) {
                return true;
            }

            if (path.length >= 2 && path[0] === "profiles" && path[1] && path[2] === "properties") {
                const profileName = path[1];
                const profile = config.properties?.profiles?.[profileName];
                if (profile && profile.secure && Array.isArray(profile.secure) && profile.secure.includes(propertyName)) {
                    return true;
                }
            }

            if (path.length >= 2 && path[0] === "profiles") {
                const currentProfileName = extractProfileKeyFromPath(path);

                let profileToCheck = currentProfileName;
                if (renames && config && renames[config.configPath]) {
                    for (const [originalKey, newKey] of Object.entries(renames[config.configPath])) {
                        if (newKey === currentProfileName) {
                            profileToCheck = originalKey;
                            break;
                        }
                    }

                    if (profileToCheck === currentProfileName && currentProfileName.includes(".")) {
                        const profileParts = currentProfileName.split(".");
                        const lastPart = profileParts[profileParts.length - 1];

                        const originalLastPart = getOriginalProfileKeyWithNested(lastPart, config.configPath, renames);

                        for (const [originalKey, _] of Object.entries(renames[config.configPath])) {
                            if (originalKey === originalLastPart) {
                                profileToCheck = originalKey;
                                break;
                            }
                        }
                    }
                }

                let currentProfile = config.properties?.profiles;
                let i = 1;

                while (i < path.length && currentProfile) {
                    let currentPathSegment = path[i];
                    const nextPathSegment = path[i + 1];

                    if (!currentProfile[currentPathSegment] && renames && renames[config.configPath]) {
                        for (const [originalKey, newKey] of Object.entries(renames[config.configPath])) {
                            if (newKey === currentPathSegment) {
                                currentPathSegment = originalKey;
                                break;
                            }
                            if (currentPathSegment.startsWith(newKey + ".")) {
                                const originalSegment = currentPathSegment.replace(newKey + ".", originalKey + ".");
                                if (currentProfile[originalSegment]) {
                                    currentPathSegment = originalSegment;
                                    break;
                                }
                            }
                        }
                    }

                    if (nextPathSegment === "profiles") {
                        currentProfile = currentProfile[currentPathSegment]?.profiles;
                        i += 2;
                    } else if (nextPathSegment === "properties") {
                        if (
                            currentProfile[currentPathSegment] &&
                            currentProfile[currentPathSegment].secure &&
                            Array.isArray(currentProfile[currentPathSegment].secure)
                        ) {
                            const isSecure = currentProfile[currentPathSegment].secure.includes(propertyName);
                            return isSecure;
                        }
                        break;
                    } else {
                        break;
                    }
                }

                if (profileToCheck && profileToCheck !== currentProfileName) {
                    let profileToLookup = profileToCheck;

                    if (currentProfileName && !currentProfileName.includes(".") && profileToCheck.includes(".")) {
                        profileToLookup = currentProfileName;
                    }

                    const rootProfile = config.properties?.profiles?.[profileToLookup];
                    if (rootProfile && rootProfile.secure && Array.isArray(rootProfile.secure)) {
                        const isSecure = rootProfile.secure.includes(propertyName);
                        return isSecure;
                    }
                }

                if (renames && config && renames[config.configPath]) {
                    let ultimateOriginalProfile = profileToCheck;
                    let foundOriginal = false;

                    for (const [originalKey, newKey] of Object.entries(renames[config.configPath])) {
                        if (newKey === ultimateOriginalProfile) {
                            ultimateOriginalProfile = originalKey;
                            foundOriginal = true;
                            break;
                        }
                    }

                    if (foundOriginal && ultimateOriginalProfile !== profileToCheck) {
                        const ultimateProfile = config.properties?.profiles?.[ultimateOriginalProfile];
                        if (ultimateProfile && ultimateProfile.secure && Array.isArray(ultimateProfile.secure)) {
                            const isSecure = ultimateProfile.secure.includes(propertyName);
                            return isSecure;
                        }
                    }
                }

                if (profileToCheck && profileToCheck.includes(".")) {
                    const nestedProfileParts = profileToCheck.split(".");
                    let nestedProfile = config.properties?.profiles;

                    for (let i = 0; i < nestedProfileParts.length - 1; i++) {
                        nestedProfile = nestedProfile?.[nestedProfileParts[i]]?.profiles;
                    }

                    const finalProfileName = nestedProfileParts[nestedProfileParts.length - 1];
                    const originalNestedProfile = nestedProfile?.[finalProfileName];

                    if (originalNestedProfile && originalNestedProfile.secure && Array.isArray(originalNestedProfile.secure)) {
                        const isSecure = originalNestedProfile.secure.includes(propertyName);
                        return isSecure;
                    }
                }
            }
        }
    }

    return false;
}

interface HandleToggleSecureParams {
    fullKey: string;
    displayKey: string;
    path: string[];
    value: unknown;
    selectedTab?: number | null;
    configurations?: Configuration[];
    pendingChanges?: PendingChangesMap;
    setPendingChanges?: React.Dispatch<React.SetStateAction<PendingChangesMap>>;
    selectedProfileKey?: string | null;
    renames?: RenamesMap;
}

export function handleToggleSecure(params: HandleToggleSecureParams): void {
    const { fullKey, displayKey, path, value, selectedTab, configurations, pendingChanges, setPendingChanges, selectedProfileKey, renames } = params;

    if (selectedTab === null || selectedTab === undefined || !configurations || !pendingChanges || !setPendingChanges) {
        return;
    }

    const config = configurations[selectedTab];
    if (!config) {
        return;
    }

    const configPath = config.configPath;
    const currentPendingChange = pendingChanges[configPath]?.[fullKey];

    const currentSecure = isPropertySecure({ fullKey, displayKey, path, selectedTab, configurations, pendingChanges, renames });

    let profileKey = selectedProfileKey || extractProfileKeyFromPath(path);
    if (selectedProfileKey && renames && renames[configPath]) {
        profileKey = getRenamedProfileKeyWithNested(selectedProfileKey, configPath, renames);
    }

    const newSecure = !currentSecure;

    const resolvedValue =
        currentPendingChange?.value !== undefined
            ? currentPendingChange.value
            : value !== undefined
            ? (value as string | number | boolean | Record<string, any>)
            : "";

    setPendingChanges((prev) => ({
        ...prev,
        [configPath]: {
            ...prev[configPath],
            [fullKey]: {
                value: resolvedValue,
                path,
                profile: profileKey,
                secure: newSecure,
            },
        },
    }));
}

export function hasPendingSecureChanges(configPath: string, pendingChanges: PendingChangesMap): boolean {
    const configPendingChanges = pendingChanges[configPath];
    if (!configPendingChanges) return false;

    return Object.values(configPendingChanges).some((change) => change.secure === true);
}

export function extractPendingProfiles(pendingChanges: PendingChangesMap, configPath: string): string[] {
    const configPendingChanges = pendingChanges[configPath];
    if (!configPendingChanges) return [];

    const profiles = new Set<string>();

    Object.entries(configPendingChanges).forEach(([_key, change]) => {
        if (change.profile) {
            profiles.add(change.profile);
        }
    });

    return Array.from(profiles);
}

export function isProfileOrParentDeleted(profileKey: string, deletions: DeletionsMap, configPath: string): boolean {
    const configDeletions = deletions[configPath];
    if (!configDeletions) return false;

    const deletedProfiles = new Set<string>();
    configDeletions.forEach((key) => {
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
        }
    });

    if (deletedProfiles.has(profileKey)) {
        return true;
    }

    const profileParts = profileKey.split(".");
    for (let i = 1; i < profileParts.length; i++) {
        const parentKey = profileParts.slice(0, i).join(".");
        if (deletedProfiles.has(parentKey)) {
            return true;
        }
    }

    return false;
}

interface MergeMergedPropertiesParams extends SchemaContext {
    combinedConfig: Record<string, unknown>;
    path: string[];
    mergedProps: MergedPropertiesMap;
    configPath: string;
    deletions: DeletionsMap;
    showMergedProperties?: MergedPropertiesVisibility;
}

export function mergeMergedProperties(params: MergeMergedPropertiesParams): Record<string, unknown> {
    const {
        combinedConfig,
        path,
        mergedProps,
        configPath,
        selectedTab,
        configurations,
        pendingChanges,
        renames,
        schemaValidations,
        deletions,
        showMergedProperties,
    } = params;

    if (!mergedProps || path.length === 0 || path[path.length - 1] === "type" || path[path.length - 1] === "secure") {
        return combinedConfig;
    }

    if (path[path.length - 1] === "properties") {
        return combinedConfig;
    }

    if (!combinedConfig.hasOwnProperty("properties")) {
        (combinedConfig as Record<string, unknown>).properties = {};
    }

    const currentProfileName = extractProfileKeyFromPath(path);
    const profileType = getProfileType({ profileKey: currentProfileName, selectedTab, configurations, pendingChanges, renames });
    const propertySchema = schemaValidations[configPath]?.propertySchema[profileType || ""] || {};
    const allowedProperties = Object.keys(propertySchema);
    const fullPath = path.join(".");

    const currentProfileKey = extractProfileKeyFromPath(path);

    const configRenames = renames[configPath] || {};
    let originalProfileKey = currentProfileKey;

    for (const [originalKey, newKey] of Object.entries(configRenames)) {
        if (newKey === currentProfileKey) {
            originalProfileKey = originalKey;
            break;
        }
    }

    if (currentProfileKey !== originalProfileKey) {
        // Profile was renamed - continue to merge merged properties
    }

    Object.entries(mergedProps).forEach(([key, propData]) => {
        const pendingKey = `${fullPath}.properties.${key}`;

        const currentPK = extractProfileKeyFromPath(path);
        const originalPK = getOriginalProfileKeyWithNested(currentPK, configPath, renames);

        let originalPath: string;
        if (originalPK.includes(".")) {
            const profileParts = originalPK.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            originalPath = pathParts.join(".");
        } else {
            originalPath = `profiles.${originalPK}`;
        }

        const originalPendingKey = `${originalPath}.properties.${key}`;

        const isInPendingChanges =
            pendingChanges[configPath]?.[pendingKey] !== undefined || pendingChanges[configPath]?.[originalPendingKey] !== undefined;

        let isInDeletions = (deletions[configPath] ?? []).includes(pendingKey) || (deletions[configPath] ?? []).includes(originalPendingKey);

        if (!isInDeletions && originalPK.includes(".")) {
            const profileParts = originalPK.split(".");
            const pathParts = ["profiles"];
            for (let i = 0; i < profileParts.length; i++) {
                pathParts.push(profileParts[i]);
                if (i < profileParts.length - 1) {
                    pathParts.push("profiles");
                }
            }
            pathParts.push("properties", key);
            const nestedPendingKey = pathParts.join(".");
            isInDeletions = (deletions[configPath] ?? []).includes(nestedPendingKey);
        }

        const isAllowedBySchema = showMergedProperties === "unfiltered" || allowedProperties.includes(key);

        const properties = combinedConfig.properties as Record<string, unknown>;
        const shouldAddMerged = isAllowedBySchema && !isInPendingChanges && (isInDeletions || !properties.hasOwnProperty(key));

        if (shouldAddMerged) {
            if (typeof propData.value !== "object" || propData.value === null) {
                properties[key] = propData.value;
            }
        }
    });

    return combinedConfig;
}

export function ensureProfileProperties(combinedConfig: Record<string, unknown>, path: string[]): Record<string, unknown> {
    if (path.length > 0 && path[path.length - 1] !== "type" && path[path.length - 1] !== "properties" && path[path.length - 1] !== "secure") {
        if (!combinedConfig.hasOwnProperty("properties")) {
            combinedConfig.properties = {};
        }
        if (!combinedConfig.hasOwnProperty("secure")) {
            combinedConfig.secure = [];
        }
        if (!combinedConfig.hasOwnProperty("type")) {
            combinedConfig.type = "";
        }
    }
    return combinedConfig;
}

interface FilterSecurePropertiesParams {
    value: Record<string, unknown>;
    combinedConfig: Record<string, unknown>;
    configPath: string | undefined;
    pendingChanges: PendingChangesMap;
    deletions: DeletionsMap;
    mergedProps?: MergedPropertiesMap;
}

export function filterSecureProperties(params: FilterSecurePropertiesParams): Record<string, unknown> | null {
    const { value, combinedConfig, configPath, pendingChanges, deletions, mergedProps } = params;

    if (combinedConfig.secure && Array.isArray(combinedConfig.secure)) {
        const secureProperties = combinedConfig.secure as string[];
        const filteredProperties = { ...value };

        Object.keys(filteredProperties).forEach((propKey) => {
            const isSecure = secureProperties.includes(propKey);

            if (isSecure) {
                const isInsecureInMergedProps = mergedProps && mergedProps[propKey] && mergedProps[propKey].secure === false;

                const isInDeletions = configPath && (deletions[configPath] ?? []).some((deletion) => deletion.includes(`properties.${propKey}`));

                const hasPendingInsecureProperty =
                    configPath &&
                    pendingChanges[configPath] &&
                    Object.entries(pendingChanges[configPath]).some(([key, entry]) => {
                        const keyParts = key.split(".");
                        const propertyName = keyParts[keyParts.length - 1];
                        return propertyName === propKey && !entry.secure && key.includes("properties");
                    });

                if (!isInDeletions && !hasPendingInsecureProperty && !isInsecureInMergedProps) {
                    delete filteredProperties[propKey];
                }
            }
        });

        return Object.keys(filteredProperties).length === 0 ? null : filteredProperties;
    }
    return value;
}

interface MergePendingSecurePropertiesParams {
    value: string[];
    path: string[];
    configPath: string;
    pendingChanges: PendingChangesMap;
    renames?: RenamesMap;
}

export function mergePendingSecureProperties(params: MergePendingSecurePropertiesParams): string[] {
    const { value, path, configPath, pendingChanges, renames } = params;

    const profileKey = extractProfileKeyFromPath(path);
    const originalProfileKey = renames ? getOriginalProfileKeyWithNested(profileKey, configPath, renames) : profileKey;
    const renamedProfileKey = renames ? getRenamedProfileKeyWithNested(profileKey, configPath, renames) : profileKey;

    const pendingSecureProps: string[] = Object.entries(pendingChanges[configPath] ?? {})
        .filter(([_, entry]) => {
            if (!entry.secure) return false;

            const entryProfile = entry.profile;
            return entryProfile === profileKey || entryProfile === originalProfileKey || entryProfile === renamedProfileKey;
        })
        .map(([key]) => {
            const parts = key.split(".");
            return parts[parts.length - 1];
        });

    const combined = [...(value || []), ...pendingSecureProps];
    const filtered = combined.filter((prop) => {
        const hasPendingInsecureProperty = Object.entries(pendingChanges[configPath] ?? {}).some(([key, entry]) => {
            const keyParts = key.split(".");
            const propertyName = keyParts[keyParts.length - 1];
            return propertyName === prop && !entry.secure;
        });
        return !hasPendingInsecureProperty;
    });

    return Array.from(new Set(filtered)).sort();
}

interface IsPropertyFromMergedPropsParams extends ConfigStateContext {
    displayKey: string | undefined;
    path: string[];
    mergedProps: MergedPropertiesMap;
    configPath: string;
    showMergedProperties: MergedPropertiesVisibility | boolean;
    selectedProfileKey: string | null;
    isPropertyActuallyInheritedFn: (params: IsPropertyActuallyInheritedParams) => boolean;
}

export function isPropertyFromMergedProps(params: IsPropertyFromMergedPropsParams): boolean {
    const {
        displayKey,
        path,
        mergedProps,
        configPath,
        showMergedProperties,
        selectedTab,
        configurations,
        pendingChanges,
        renames,
        selectedProfileKey,
        isPropertyActuallyInheritedFn,
    } = params;

    const originalProfileKey = extractProfileKeyFromPath(path);
    const currentProfileKey = getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames);
    const currentProfileType = getProfileType({ profileKey: currentProfileKey, selectedTab, configurations, pendingChanges, renames });
    const isProfileUntyped = !currentProfileType || currentProfileType.trim() === "";

    if (showMergedProperties === "hide" || showMergedProperties === false || isProfileUntyped || !displayKey) {
        return false;
    }

    const mergedPropData = mergedProps?.[displayKey];
    const jsonLoc = mergedPropData?.jsonLoc;
    const osLoc = mergedPropData?.osLoc;

    const jsonLocParts = jsonLoc ? jsonLoc.split(".") : [];
    const profilePathParts = jsonLocParts.slice(1, -2);
    const profilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

    const isInherited = isPropertyActuallyInheritedFn({
        profilePath,
        currentProfileKey,
        configPath,
        propertyName: displayKey,
        selectedTab,
        configurations,
        pendingChanges,
        renames,
    });

    const isSameProfileNameInDifferentConfig = (() => {
        if (isInherited) return false;

        if (profilePath === currentProfileKey) {
            const selectedConfigPath = configurations[selectedTab!]?.configPath;
            const osLocString = osLoc?.join("") ?? "";
            return selectedConfigPath !== osLocString;
        }

        return false;
    })();

    if (!isInherited && !isSameProfileNameInDifferentConfig) {
        return false;
    }

    const selectedConfigPath = configurations[selectedTab!]?.configPath;
    const osLocString = osLoc?.join("") ?? "";
    const pathsEqual = selectedConfigPath === osLocString;
    const currentProfilePathForComparison = path.slice(0, -1).join(".");

    const currentlyViewedProfileKey = selectedProfileKey;
    const hasBeenRenamed =
        currentlyViewedProfileKey && Object.values(renames[configPath] || {}).some((newName) => newName === currentlyViewedProfileKey);

    if (hasBeenRenamed) {
        const jsonLocPartsInner = jsonLoc ? jsonLoc.split(".") : [];
        let jsonLocProfileName = "";

        if (jsonLocPartsInner.length >= 2 && jsonLocPartsInner[0] === "profiles") {
            let profileParts = [];
            let i = 1;

            while (i < jsonLocPartsInner.length) {
                if (jsonLocPartsInner[i] !== "profiles" && jsonLocPartsInner[i] !== "properties") {
                    profileParts.push(jsonLocPartsInner[i]);
                    i++;
                } else if (jsonLocPartsInner[i] === "profiles") {
                    i++;
                } else if (jsonLocPartsInner[i] === "properties") {
                    break;
                } else {
                    i++;
                }
            }
            jsonLocProfileName = profileParts.join(".");
        }

        const currentProfileParts = currentlyViewedProfileKey ? currentlyViewedProfileKey.split(".") : [];
        const jsonLocProfileParts = jsonLocProfileName ? jsonLocProfileName.split(".") : [];

        const jsonLocRefersToCurrentProfile = (() => {
            if (jsonLocProfileName === currentlyViewedProfileKey) return true;

            const currentProfilePath = currentProfileParts.join(".");
            const jsonLocPath = jsonLocProfileParts.join(".");

            if (jsonLocPath === currentProfilePath) return true;

            if (currentProfileParts.length > 1) {
                const parentProfilePath = currentProfileParts.slice(0, -1).join(".");
                const originalParentKey = Object.keys(renames[configPath] || {}).find(
                    (oldName) => renames[configPath][oldName] === parentProfilePath
                );

                if (originalParentKey) {
                    const childName = currentProfileParts[currentProfileParts.length - 1];
                    const originalPath = `${originalParentKey}.${childName}`;
                    return jsonLocPath === originalPath;
                }
            }

            return false;
        })();

        const jsonLocIsOldNameOfCurrentProfile =
            jsonLocProfileName &&
            Object.keys(renames[configPath] || {}).some(
                (oldName) => oldName === jsonLocProfileName && renames[configPath][oldName] === currentlyViewedProfileKey
            );

        const isFromChildOfRenamedParent =
            currentlyViewedProfileKey &&
            jsonLocProfileName &&
            Object.entries(renames[configPath] || {}).some(([oldName, newName]) => {
                const isCurrentProfileChildOfNewParent = currentlyViewedProfileKey.startsWith(newName + ".");
                const jsonLocRefersToOldParent = jsonLocProfileName === oldName;
                return isCurrentProfileChildOfNewParent && jsonLocRefersToOldParent;
            });

        const result = !pathsEqual || (!jsonLocRefersToCurrentProfile && !jsonLocIsOldNameOfCurrentProfile && !isFromChildOfRenamedParent);

        return result;
    } else {
        const jsonLocIndicatesDifferentProfile = jsonLoc && !jsonLoc.includes(currentProfilePathForComparison + ".properties");

        const isFromSameProfileNameInDifferentConfig = (() => {
            if (!jsonLoc || !osLoc || !selectedConfigPath) return false;

            const jsonLocParts = jsonLoc.split(".");
            const profilePathParts = jsonLocParts.slice(1, -2);
            const sourceProfilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

            const currentProfileName = extractProfileKeyFromPath(path);

            const osLocString = osLoc.join("");
            const isDifferentConfig = selectedConfigPath !== osLocString;
            const isSameProfileName = sourceProfilePath === currentProfileName;

            return isDifferentConfig && isSameProfileName;
        })();

        const result = !pathsEqual || jsonLocIndicatesDifferentProfile || isFromSameProfileNameInDifferentConfig;

        return result;
    }
}

interface ApplyRenamesToProfileKeysParams {
    orderedProfileKeys: string[];
    configPath: string;
    renames: RenamesMap;
}

export function applyRenamesToProfileKeys(params: ApplyRenamesToProfileKeysParams): string[] {
    const { orderedProfileKeys, configPath, renames } = params;

    const renamedProfileKeys = orderedProfileKeys.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
    });

    const configRenames = renames[configPath] || {};
    const finalRenamedProfileKeys = renamedProfileKeys.filter((renamedKey) => {
        return !Object.keys(configRenames).includes(renamedKey);
    });

    const renamedOnlyProfiles = Object.keys(configRenames).filter((originalKey) => {
        if (orderedProfileKeys.includes(originalKey)) {
            return false;
        }

        const newKey = configRenames[originalKey];
        const isIntermediate = Object.values(configRenames).includes(originalKey) && Object.keys(configRenames).includes(newKey);
        if (isIntermediate) {
            return false;
        }

        return true;
    });

    const renamedOnlyProfileKeys = renamedOnlyProfiles.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
    });

    const allRenamedProfileKeys = [...finalRenamedProfileKeys, ...renamedOnlyProfileKeys];
    return Array.from(new Set(allRenamedProfileKeys));
}

interface MergePendingProfileKeysParams {
    pendingProfiles: ProfileMap;
    configPath: string;
    renames: RenamesMap;
    deletions: DeletionsMap;
    uniqueRenamedProfileKeys: string[];
}

export function mergePendingProfileKeys(params: MergePendingProfileKeysParams): string[] {
    const { pendingProfiles, configPath, renames, deletions, uniqueRenamedProfileKeys } = params;

    const pendingProfileKeys = Object.keys(pendingProfiles).filter((key) => {
        if (isProfileOrParentDeleted(key, deletions, configPath)) {
            return false;
        }
        return true;
    });

    return pendingProfileKeys.map((profileKey) => {
        let renamedKey = profileKey;
        const configRenames = renames[configPath] || {};

        let changed = true;
        while (changed) {
            changed = false;
            for (const [originalKey, newKey] of Object.entries(configRenames)) {
                if (renamedKey === originalKey) {
                    renamedKey = newKey;
                    changed = true;
                    break;
                }
                if (renamedKey.startsWith(originalKey + ".")) {
                    const newRenamedKey = renamedKey.replace(originalKey + ".", newKey + ".");
                    renamedKey = newRenamedKey;
                    changed = true;
                    break;
                }
            }
        }

        if (Object.keys(configRenames).length === 0 && renamedKey.includes(".")) {
            const rootProfileName = renamedKey.split(".").pop();
            if (rootProfileName && uniqueRenamedProfileKeys.includes(rootProfileName)) {
                renamedKey = rootProfileName;
            }
        }

        return renamedKey;
    });
}

interface FilterConflictingProfileKeysParams {
    uniqueRenamedProfileKeys: string[];
    renamedPendingProfileKeys: string[];
    pendingProfiles: ProfileMap;
    deletions: DeletionsMap;
    configPath: string;
    renames: RenamesMap;
}

export function filterConflictingProfileKeys(params: FilterConflictingProfileKeysParams): string[] {
    const { uniqueRenamedProfileKeys, renamedPendingProfileKeys, pendingProfiles, deletions, configPath, renames } = params;

    const pendingProfileKeys = Object.keys(pendingProfiles);
    const pendingProfileKeysSet = new Set(renamedPendingProfileKeys);
    const originalPendingProfileKeysSet = new Set(pendingProfileKeys);

    return uniqueRenamedProfileKeys.filter((profileKey) => {
        if (isProfileOrParentDeleted(profileKey, deletions, configPath)) {
            return false;
        }

        const hasExactPendingMatch = pendingProfileKeysSet.has(profileKey) || originalPendingProfileKeysSet.has(profileKey);

        const isResultOfRenameWithPending = Object.keys(renames[configPath] || {}).some((originalKey) => {
            const renamedKey = getRenamedProfileKeyWithNested(originalKey, configPath, renames);
            const hasPendingOriginal = Object.keys(pendingProfiles).includes(originalKey);
            return profileKey === renamedKey && hasPendingOriginal;
        });

        const isTargetOfPendingRename = renamedPendingProfileKeys.includes(profileKey);

        const shouldRenamePendingToThisKey =
            !isTargetOfPendingRename &&
            Object.keys(renames[configPath] || {}).length === 0 &&
            pendingProfileKeys.some((pendingKey) => {
                return (
                    pendingKey !== profileKey &&
                    (pendingKey.endsWith("." + profileKey) || pendingKey === profileKey + ".pending" || pendingKey.includes("." + profileKey + "."))
                );
            });

        return !hasExactPendingMatch && !isResultOfRenameWithPending && !isTargetOfPendingRename && !shouldRenamePendingToThisKey;
    });
}
