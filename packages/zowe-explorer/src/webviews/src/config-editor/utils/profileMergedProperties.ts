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

import { extractProfileKeyFromPath } from "./configUtils";
import { ConfigStateContext, SchemaContext, DeletionsMap, MergedPropertiesVisibility, MergedPropertiesMap } from "../types";
import { getProfileType } from "./profileTypeResolution";
import { getRenamedProfileKeyWithNested, getOriginalProfileKeyWithNested } from "./profileRenames";

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
