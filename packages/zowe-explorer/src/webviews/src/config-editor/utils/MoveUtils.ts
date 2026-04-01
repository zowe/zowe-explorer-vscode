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

import { set } from "lodash";
import { ConfigMoveAPI, IConfigLayer, ProfileData } from "../types";

export function moveProfile(api: ConfigMoveAPI, layerActive: () => IConfigLayer, sourcePath: string, targetPath: string): void {
    const sourceProfile = api.get(sourcePath);
    if (!sourceProfile) {
        throw new Error(`Source profile not found at path: ${sourcePath}`);
    }

    const targetProfile = api.get(targetPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${targetPath}`);
    }

    const sourceSecure = sourceProfile.secure || [];

    if (isSameLevelRename(sourcePath, targetPath)) {
        moveProfileInPlaceOrdered(api, layerActive, sourcePath, targetPath);
    } else {
        api.set(targetPath, sourceProfile);
        api.delete(sourcePath);
    }

    moveSecureProperties(api, layerActive, sourcePath, targetPath, sourceSecure);
}

function isSameLevelRename(sourcePath: string, targetPath: string): boolean {
    const sourceParts = sourcePath.split(".");
    const targetParts = targetPath.split(".");

    if (sourceParts.length !== targetParts.length) {
        return false;
    }

    for (let i = 0; i < sourceParts.length - 1; i++) {
        if (sourceParts[i] !== targetParts[i]) {
            return false;
        }
    }

    return true;
}

function moveProfileInPlaceOrdered(api: ConfigMoveAPI, layerActive: () => IConfigLayer, sourcePath: string, targetPath: string): void {
    const sourceParts = sourcePath.split(".");
    const targetParts = targetPath.split(".");
    const sourceName = sourceParts[sourceParts.length - 1];
    const targetName = targetParts[targetParts.length - 1];

    if (sourceParts.length === 1) {
        const currentLayer = layerActive();
        const profiles = currentLayer.properties.profiles;

        const newProfiles: Record<string, ProfileData> = {};
        for (const [key, value] of Object.entries(profiles)) {
            newProfiles[key === sourceName ? targetName : key] = value as ProfileData;
        }

        currentLayer.properties.profiles = newProfiles;
    } else {
        const parentPath = sourceParts.slice(0, -1).join(".");
        const parentProfile: ProfileData | null = api.get(parentPath);

        if (parentProfile) {
            if (parentProfile.profiles) {
                const newProfiles: Record<string, ProfileData> = {};
                for (const [key, value] of Object.entries(parentProfile.profiles)) {
                    newProfiles[key === sourceName ? targetName : key] = value;
                }

                parentProfile.profiles = newProfiles;
                api.set(parentPath, parentProfile);
            } else {
                const newParentProfile: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(parentProfile)) {
                    newParentProfile[key === sourceName ? targetName : key] = value;
                }

                api.set(parentPath, newParentProfile);

                if (parentPath !== "profiles") {
                    const grandParentPath = parentPath.split(".").slice(0, -1).join(".");
                    const grandParent: ProfileData | null = api.get(grandParentPath);
                    if (grandParent) {
                        const parentName = parentPath.split(".").pop();
                        if (parentName && (grandParent as Record<string, unknown>)[parentName]) {
                            (grandParent as Record<string, unknown>)[parentName] = newParentProfile;
                            api.set(grandParentPath, grandParent);
                        }
                    }
                }
            }
        }
    }
}

export function moveProfileInPlace(api: ConfigMoveAPI, layerActive: () => IConfigLayer, sourcePath: string, targetPath: string): void {
    const sourceProfile = api.get(sourcePath);
    if (!sourceProfile) {
        throw new Error(`Source profile not found at path: ${sourcePath}`);
    }

    const targetProfile = api.get(targetPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${targetPath}`);
    }

    const sourceSecure = sourceProfile.secure || [];

    const sourcePathParts = sourcePath.split(".");
    const sourceParentPath = sourcePathParts.slice(0, -1).join(".");
    const sourceName = sourcePathParts[sourcePathParts.length - 1];

    const targetPathParts = targetPath.split(".");
    const targetParentPath = targetPathParts.slice(0, -1).join(".");
    const targetName = targetPathParts[targetPathParts.length - 1];
    if (sourceParentPath === targetParentPath) {
        renameProfileInPlace(api, layerActive, sourcePath, targetPath);
        return;
    }

    if (sourceParentPath) {
        const sourceParentProfile = api.get(sourceParentPath);
        if (sourceParentProfile && sourceParentProfile.profiles) {
            const profileData = sourceParentProfile.profiles[sourceName];
            delete sourceParentProfile.profiles[sourceName];
            api.set(sourceParentPath, sourceParentProfile);

            if (targetParentPath) {
                const targetParentProfile = api.get(targetParentPath);
                if (targetParentProfile && targetParentProfile.profiles) {
                    targetParentProfile.profiles[targetName] = profileData;
                    api.set(targetParentPath, targetParentProfile);
                }
            } else {
                const currentLayer = layerActive();
                currentLayer.properties.profiles[targetName] = profileData;
            }
        }
    } else {
        const currentLayer = layerActive();
        const profileData = currentLayer.properties.profiles[sourceName];
        delete currentLayer.properties.profiles[sourceName];

        if (targetParentPath) {
            const targetParentProfile = api.get(targetParentPath);
            if (targetParentProfile && targetParentProfile.profiles) {
                targetParentProfile.profiles[targetName] = profileData;
                api.set(targetParentPath, targetParentProfile);
            }
        }
    }

    moveSecureProperties(api, layerActive, sourcePath, targetPath, sourceSecure);
}

export function getSecurePropertiesForProfile(api: ConfigMoveAPI, profilePath: string): string[] {
    const profile = api.get(profilePath);
    return profile?.secure || [];
}

export function moveSecureProperties(
    api: ConfigMoveAPI,
    layerActive: () => IConfigLayer,
    sourcePath: string,
    targetPath: string,
    sourceSecure: string[]
): void {
    const targetSecure = getSecurePropertiesForProfile(api, targetPath);
    updateSecureArrays(layerActive, sourcePath, targetPath, sourceSecure, targetSecure);
}

export function deleteProfileRecursively(api: ConfigMoveAPI, layerActive: () => IConfigLayer, profilePath: string): void {
    const profile = api.get(profilePath);
    if (!profile) {
        return;
    }

    if (profile.profiles) {
        const nestedProfiles = Object.keys(profile.profiles);
        for (const nestedProfile of nestedProfiles) {
            const nestedPath = `${profilePath}.profiles.${nestedProfile}`;
            deleteProfileRecursively(api, layerActive, nestedPath);
        }
    }

    api.delete(profilePath);
}

export function updateSecureArrays(
    layerActive: () => IConfigLayer,
    sourcePath: string,
    targetPath: string,
    sourceSecure: string[],
    targetSecure: string[]
): void {
    const secureArrays = findSecureArrays(layerActive);

    for (const secureArray of secureArrays) {
        const currentSecure = secureArray.secure || [];
        let updatedSecure = [...currentSecure];

        for (const secureProp of sourceSecure) {
            const sourceSecurePath = `${sourcePath}.secure.${secureProp}`;
            if (isSecurePropertyForProfile(secureArray.profilePath, sourceSecurePath)) {
                updatedSecure = updatedSecure.filter((prop) => prop !== secureProp);
            }
        }

        for (const secureProp of targetSecure) {
            const targetSecurePath = `${targetPath}.secure.${secureProp}`;
            if (isSecurePropertyForProfile(secureArray.profilePath, targetSecurePath)) {
                if (!updatedSecure.includes(secureProp)) {
                    updatedSecure.push(secureProp);
                }
            }
        }

        if (JSON.stringify(updatedSecure) !== JSON.stringify(currentSecure)) {
            set(secureArray.profile, "secure", updatedSecure);
        }
    }
}

interface SecureArrayEntry {
    profile: ProfileData;
    profilePath: string;
    secure: string[];
}

export function findSecureArrays(layerActive: () => IConfigLayer): SecureArrayEntry[] {
    const secureArrays: SecureArrayEntry[] = [];
    const currentLayer = layerActive();
    const profiles = currentLayer.properties.profiles;

    const findSecureArraysRecursive = (profileObj: ProfileData, profilePath: string) => {
        if (profileObj.secure && Array.isArray(profileObj.secure)) {
            secureArrays.push({
                profile: profileObj,
                profilePath,
                secure: profileObj.secure,
            });
        }

        if (profileObj.profiles) {
            for (const [nestedProfileName, nestedProfile] of Object.entries(profileObj.profiles)) {
                findSecureArraysRecursive(nestedProfile, `${profilePath}.profiles.${nestedProfileName}`);
            }
        }
    };

    for (const [profileName, profile] of Object.entries(profiles)) {
        findSecureArraysRecursive(profile as ProfileData, `profiles.${profileName}`);
    }

    return secureArrays;
}

export function isSecurePropertyForProfile(profilePath: string, securePropertyPath: string): boolean {
    const profilePathParts = profilePath.split(".");
    const securePropertyPathParts = securePropertyPath.split(".");

    for (let i = 0; i < profilePathParts.length; i++) {
        if (profilePathParts[i] !== securePropertyPathParts[i]) {
            return false;
        }
    }

    return true;
}

export function updateSecurePropertyPath(securePropertyPath: string, oldProfilePath: string, newProfilePath: string): string {
    return securePropertyPath.replace(oldProfilePath, newProfilePath);
}

export function findProfileInLayer(layer: IConfigLayer, profileName: string): ProfileData | null {
    const profiles = layer.properties.profiles;

    const findProfileRecursive = (profileObj: Record<string, ProfileData>, currentPath: string[]): ProfileData | null => {
        for (const [name, profile] of Object.entries(profileObj)) {
            const newPath = [...currentPath, name];
            const profileKey = newPath.join(".");

            if (profileKey === profileName) {
                return profile;
            }

            if (profile.profiles) {
                const found = findProfileRecursive(profile.profiles, newPath);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };

    return findProfileRecursive(profiles as Record<string, ProfileData>, []);
}

export function renameProfile(api: ConfigMoveAPI, layerActive: () => IConfigLayer, originalPath: string, newName: string): string {
    const originalProfile = api.get(originalPath);
    if (!originalProfile) {
        throw new Error(`Profile not found at path: ${originalPath}`);
    }

    const pathParts = originalPath.split(".");
    const parentPath = pathParts.slice(0, -1).join(".");

    const newPath = parentPath ? `${parentPath}.${newName}` : newName;

    const existingProfile = api.get(newPath);
    if (existingProfile) {
        throw new Error(`Profile with name '${newName}' already exists`);
    }

    renameProfileInPlace(api, layerActive, originalPath, newPath);

    return newPath;
}

export function renameProfileInPlace(api: ConfigMoveAPI, layerActive: () => IConfigLayer, originalPath: string, newPath: string): void {
    const originalProfile = api.get(originalPath);
    if (!originalProfile) {
        throw new Error(`Source profile not found at path: ${originalPath}`);
    }

    const targetProfile = api.get(newPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${newPath}`);
    }

    const sourceSecure = originalProfile.secure || [];

    const pathParts = originalPath.split(".");
    const parentPath = pathParts.slice(0, -1).join(".");
    const originalName = pathParts[pathParts.length - 1];

    const newPathParts = newPath.split(".");
    const newName = newPathParts[newPathParts.length - 1];

    if (parentPath) {
        const parentProfile = api.get(parentPath);
        if (parentProfile && parentProfile.profiles) {
            const profileData = parentProfile.profiles[originalName];
            delete parentProfile.profiles[originalName];
            parentProfile.profiles[newName] = profileData;
            api.set(parentPath, parentProfile);
        }
    } else {
        const currentLayer = layerActive();
        const profiles = currentLayer.properties.profiles;
        const profileData = profiles[originalName];
        delete profiles[originalName];
        profiles[newName] = profileData;
        currentLayer.properties.profiles = profiles;
    }

    moveSecureProperties(api, layerActive, originalPath, newPath, sourceSecure);
}

export function updateDefaultsAfterRename(
    layerActive: () => IConfigLayer,
    originalKey: string,
    newKey: string,
    updateTeamConfig?: (defaults: Record<string, string>) => void
): void {
    try {
        const currentLayer = layerActive();
        const defaults = currentLayer.properties.defaults;

        if (!defaults) {
            return;
        }

        let hasChanges = false;
        const updatedDefaults = { ...defaults };

        // Check each default entry
        Object.entries(updatedDefaults).forEach(([profileType, profileName]) => {
            if (typeof profileName === "string") {
                // Check if this profile was a default
                if (profileName === originalKey) {
                    // Update the default to reference the new profile
                    updatedDefaults[profileType] = newKey;
                    hasChanges = true;
                }

                // Check if any child profiles of the renamed profile were defaults
                // This handles cases like: tso.zosmf is default, tso is renamed to tso1, so tso1.zosmf should remain default
                if (profileName.startsWith(originalKey + ".")) {
                    const childPath = profileName.substring(originalKey.length + 1);
                    const newChildDefault = newKey + "." + childPath;
                    updatedDefaults[profileType] = newChildDefault;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            currentLayer.properties.defaults = updatedDefaults;

            if (updateTeamConfig) {
                updateTeamConfig(updatedDefaults);
            }
        }
    } catch (error) {
        console.warn(`Failed to update defaults after profile rename: ${error}`);
    }
}

export function simulateDefaultsUpdateAfterRename(layerActive: () => IConfigLayer, originalKey: string, newKey: string): void {
    try {
        const currentLayer = layerActive();
        const defaults = currentLayer.properties.defaults;

        if (!defaults) {
            return;
        }

        const simulatedDefaults = { ...defaults };

        Object.entries(simulatedDefaults).forEach(([profileType, profileName]) => {
            if (typeof profileName === "string") {
                if (profileName === originalKey) {
                    simulatedDefaults[profileType] = newKey;
                }

                if (profileName.startsWith(originalKey + ".")) {
                    const childPath = profileName.substring(originalKey.length + 1);
                    const newChildDefault = newKey + "." + childPath;
                    simulatedDefaults[profileType] = newChildDefault;
                }
            }
        });

        currentLayer.properties.defaults = simulatedDefaults;
    } catch (error) {
        console.warn(`Failed to simulate defaults update after profile rename: ${error}`);
    }
}
