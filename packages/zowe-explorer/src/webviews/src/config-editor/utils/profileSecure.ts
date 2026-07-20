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
import { Configuration, SchemaContext, RenamesMap, PendingChangesMap, MergedPropertiesMap, DeletionsMap } from "../types";
import { getProfileType } from "./profileTypeResolution";
import { getRenamedProfileKeyWithNested, getOriginalProfileKeyWithNested } from "./profileRenames";

export function isMergedPropertySecure(_displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean): boolean {
    if (!jsonLoc) return false;

    if (secure !== undefined) {
        return secure;
    }

    return false;
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

export function hasPendingSecureChangesForProfile(profileKey: string, configPath: string, pendingChanges: PendingChangesMap): boolean {
    const configPendingChanges = pendingChanges[configPath];
    if (!configPendingChanges) return false;

    return Object.values(configPendingChanges).some((change) => change.secure === true && change.profile === profileKey);
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
