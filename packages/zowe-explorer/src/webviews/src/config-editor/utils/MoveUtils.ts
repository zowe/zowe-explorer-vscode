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

// @ts-ignore
import { get, set } from "lodash";

export interface ConfigMoveAPI {
    get: (path: string) => any;
    set: (path: string, value: any) => void;
    delete: (path: string) => void;
}

export interface IConfigLayer {
    properties: {
        profiles: { [key: string]: any };
        defaults?: { [key: string]: string };
    };
}

export function moveProfile(api: ConfigMoveAPI, layerActive: () => IConfigLayer, sourcePath: string, targetPath: string): void {
    const sourceProfile = api.get(sourcePath);
    if (!sourceProfile) {
        throw new Error(`Source profile not found at path: ${sourcePath}`);
    }

    // Check if target profile already exists
    const targetProfile = api.get(targetPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${targetPath}`);
    }

    // Get secure properties from source before moving
    const sourceSecure = sourceProfile.secure || [];

    // Use order-preserving move for same-level renames
    if (isSameLevelRename(sourcePath, targetPath)) {
        moveProfileInPlaceOrdered(api, layerActive, sourcePath, targetPath);
    } else {
        // For cross-level moves, use the original approach
        api.set(targetPath, sourceProfile);
        api.delete(sourcePath);
    }

    // Move secure properties if they exist
    moveSecureProperties(api, layerActive, sourcePath, targetPath, sourceSecure);
}

function isSameLevelRename(sourcePath: string, targetPath: string): boolean {
    const sourceParts = sourcePath.split(".");
    const targetParts = targetPath.split(".");

    // Same level if parent paths are identical
    if (sourceParts.length !== targetParts.length) {
        return false;
    }

    // Check if all parts except the last are the same
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
        // Root level profile rename
        const currentLayer = layerActive();
        const profiles = currentLayer.properties.profiles;

        // Create new profiles object with renamed key
        const newProfiles: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(profiles)) {
            if (key === sourceName) {
                newProfiles[targetName] = value;
            } else {
                newProfiles[key] = value;
            }
        }

        // Update the layer with the new profiles object
        currentLayer.properties.profiles = newProfiles;
    } else {
        // Nested profile rename
        const parentPath = sourceParts.slice(0, -1).join(".");
        const parentProfile = api.get(parentPath);

        if (parentProfile) {
            // Check if profiles are stored directly as properties or under a profiles property
            if (parentProfile.profiles) {
                // Create new profiles object with renamed key
                const newProfiles: { [key: string]: any } = {};
                for (const [key, value] of Object.entries(parentProfile.profiles)) {
                    if (key === sourceName) {
                        newProfiles[targetName] = value;
                    } else {
                        newProfiles[key] = value;
                    }
                }

                // Update the parent profile
                parentProfile.profiles = newProfiles;
                api.set(parentPath, parentProfile);
            } else {
                // Profiles are stored directly as properties of the parent object
                // Create new parent object with renamed key
                const newParentProfile: { [key: string]: any } = {};
                for (const [key, value] of Object.entries(parentProfile)) {
                    if (key === sourceName) {
                        newParentProfile[targetName] = value;
                    } else {
                        newParentProfile[key] = value;
                    }
                }

                // Update the parent profile
                api.set(parentPath, newParentProfile);

                // Try alternative approach - update the parent's parent if direct update fails
                if (parentPath !== "profiles") {
                    const grandParentPath = parentPath.split(".").slice(0, -1).join(".");
                    const grandParent = api.get(grandParentPath);
                    if (grandParent) {
                        // Update the parent within the grandparent
                        const parentName = parentPath.split(".").pop();
                        if (parentName && grandParent[parentName]) {
                            grandParent[parentName] = newParentProfile;
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

    // Check if target profile already exists
    const targetProfile = api.get(targetPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${targetPath}`);
    }

    // Get secure properties from source before moving
    const sourceSecure = sourceProfile.secure || [];

    // Get source and target path information
    const sourcePathParts = sourcePath.split(".");
    const sourceParentPath = sourcePathParts.slice(0, -1).join(".");
    const sourceName = sourcePathParts[sourcePathParts.length - 1];

    const targetPathParts = targetPath.split(".");
    const targetParentPath = targetPathParts.slice(0, -1).join(".");
    const targetName = targetPathParts[targetPathParts.length - 1];

    // Handle the move operation
    if (sourceParentPath === targetParentPath) {
        // Same parent
        renameProfileInPlace(api, layerActive, sourcePath, targetPath);
        return;
    }

    // Different parents
    if (sourceParentPath) {
        const sourceParentProfile = api.get(sourceParentPath);
        if (sourceParentProfile && sourceParentProfile.profiles) {
            const profileData = sourceParentProfile.profiles[sourceName];
            delete sourceParentProfile.profiles[sourceName];
            api.set(sourceParentPath, sourceParentProfile);

            // Add to target parent
            if (targetParentPath) {
                const targetParentProfile = api.get(targetParentPath);
                if (targetParentProfile && targetParentProfile.profiles) {
                    targetParentProfile.profiles[targetName] = profileData;
                    api.set(targetParentPath, targetParentProfile);
                }
            } else {
                // Moving to root level
                const currentLayer = layerActive();
                currentLayer.properties.profiles[targetName] = profileData;
            }
        }
    } else {
        // Moving from root level
        const currentLayer = layerActive();
        const profileData = currentLayer.properties.profiles[sourceName];
        delete currentLayer.properties.profiles[sourceName];

        // Add to target parent
        if (targetParentPath) {
            const targetParentProfile = api.get(targetParentPath);
            if (targetParentProfile && targetParentProfile.profiles) {
                targetParentProfile.profiles[targetName] = profileData;
                api.set(targetParentPath, targetParentProfile);
            }
        }
    }

    // Move secure properties if they exist
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
    // Get secure properties from the target path (which now contains the moved profile)
    const targetSecure = getSecurePropertiesForProfile(api, targetPath);

    // Update secure arrays to move secure properties from source to target
    updateSecureArrays(layerActive, sourcePath, targetPath, sourceSecure, targetSecure);
}

export function deleteProfileRecursively(api: ConfigMoveAPI, layerActive: () => IConfigLayer, profilePath: string): void {
    const profile = api.get(profilePath);
    if (!profile) {
        return;
    }

    // Delete nested profiles first
    if (profile.profiles) {
        const nestedProfiles = Object.keys(profile.profiles);
        for (const nestedProfile of nestedProfiles) {
            const nestedPath = `${profilePath}.profiles.${nestedProfile}`;
            deleteProfileRecursively(api, layerActive, nestedPath);
        }
    }

    // Delete the profile itself
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

        // Remove secure properties from source path
        for (const secureProp of sourceSecure) {
            const sourceSecurePath = `${sourcePath}.secure.${secureProp}`;
            if (isSecurePropertyForProfile(secureArray.profilePath, sourceSecurePath)) {
                updatedSecure = updatedSecure.filter((prop) => prop !== secureProp);
            }
        }

        // Add secure properties to target path
        for (const secureProp of targetSecure) {
            const targetSecurePath = `${targetPath}.secure.${secureProp}`;
            if (isSecurePropertyForProfile(secureArray.profilePath, targetSecurePath)) {
                if (!updatedSecure.includes(secureProp)) {
                    updatedSecure.push(secureProp);
                }
            }
        }

        // Update the secure array
        if (JSON.stringify(updatedSecure) !== JSON.stringify(currentSecure)) {
            set(secureArray.profile, "secure", updatedSecure);
        }
    }
}

export function findSecureArrays(layerActive: () => IConfigLayer): Array<{ profile: any; profilePath: string; secure: string[] }> {
    const secureArrays: Array<{ profile: any; profilePath: string; secure: string[] }> = [];
    const currentLayer = layerActive();
    const profiles = currentLayer.properties.profiles;

    const findSecureArraysRecursive = (profileObj: any, profilePath: string) => {
        if (profileObj.secure && Array.isArray(profileObj.secure)) {
            secureArrays.push({
                profile: profileObj,
                profilePath,
                secure: profileObj.secure,
            });
        }

        if (profileObj.profiles) {
            for (const [nestedProfileName, nestedProfile] of Object.entries(profileObj.profiles)) {
                const nestedPath = `${profilePath}.profiles.${nestedProfileName}`;
                findSecureArraysRecursive(nestedProfile as any, nestedPath);
            }
        }
    };

    for (const [profileName, profile] of Object.entries(profiles)) {
        findSecureArraysRecursive(profile as any, `profiles.${profileName}`);
    }

    return secureArrays;
}

export function isSecurePropertyForProfile(profilePath: string, securePropertyPath: string): boolean {
    const profilePathParts = profilePath.split(".");
    const securePropertyPathParts = securePropertyPath.split(".");

    // Check if the secure property belongs to this profile
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

export function findProfileInLayer(layer: IConfigLayer, profileName: string): any {
    const profiles = layer.properties.profiles;

    const findProfileRecursive = (profileObj: any, currentPath: string[]): any => {
        for (const [name, profile] of Object.entries(profileObj)) {
            const newPath = [...currentPath, name];
            const profileKey = newPath.join(".");

            if (profileKey === profileName) {
                return profile;
            }

            if ((profile as any).profiles) {
                const found = findProfileRecursive((profile as any).profiles, newPath);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };

    return findProfileRecursive(profiles, []);
}

export function renameProfile(api: ConfigMoveAPI, layerActive: () => IConfigLayer, originalPath: string, newName: string): string {
    const originalProfile = api.get(originalPath);
    if (!originalProfile) {
        throw new Error(`Profile not found at path: ${originalPath}`);
    }

    // Extract the parent path and original name
    const pathParts = originalPath.split(".");
    const parentPath = pathParts.slice(0, -1).join(".");

    // Construct the new path
    const newPath = parentPath ? `${parentPath}.${newName}` : newName;

    // Check if the new name already exists
    const existingProfile = api.get(newPath);
    if (existingProfile) {
        throw new Error(`Profile with name '${newName}' already exists`);
    }

    // Use in-place rename to preserve order instead of move operation
    renameProfileInPlace(api, layerActive, originalPath, newPath);

    return newPath;
}

export function renameProfileInPlace(api: ConfigMoveAPI, layerActive: () => IConfigLayer, originalPath: string, newPath: string): void {
    const originalProfile = api.get(originalPath);
    if (!originalProfile) {
        throw new Error(`Source profile not found at path: ${originalPath}`);
    }

    // Check if target profile already exists
    const targetProfile = api.get(newPath);
    if (targetProfile) {
        throw new Error(`Target profile already exists at path: ${newPath}`);
    }

    // Get secure properties from source before renaming
    const sourceSecure = originalProfile.secure || [];

    // For in-place rename
    const pathParts = originalPath.split(".");
    const parentPath = pathParts.slice(0, -1).join(".");
    const originalName = pathParts[pathParts.length - 1];

    const newPathParts = newPath.split(".");
    const newName = newPathParts[newPathParts.length - 1];

    if (parentPath) {
        // For nested profiles, update the parent's profiles object
        const parentProfile = api.get(parentPath);
        if (parentProfile && parentProfile.profiles) {
            // Store the profile data
            const profileData = parentProfile.profiles[originalName];

            // Remove the old key and add the new key (preserves order)
            delete parentProfile.profiles[originalName];
            parentProfile.profiles[newName] = profileData;

            // Update the parent object
            api.set(parentPath, parentProfile);
        }
    } else {
        // For root-level profiles, update the main profiles object
        const currentLayer = layerActive();
        const profiles = currentLayer.properties.profiles;

        // Store the profile data
        const profileData = profiles[originalName];

        // Remove the old key and add the new key (preserves order)
        delete profiles[originalName];
        profiles[newName] = profileData;

        // Update the layer
        currentLayer.properties.profiles = profiles;
    }

    // Move secure properties if they exist
    moveSecureProperties(api, layerActive, originalPath, newPath, sourceSecure);
}

export function updateDefaultsAfterRename(
    layerActive: () => IConfigLayer,
    originalKey: string,
    newKey: string,
    updateTeamConfig?: (defaults: any) => void
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
            // Check if this profile was a default
            if (profileName === originalKey) {
                // Update the default to reference the new profile
                updatedDefaults[profileType] = newKey;
                hasChanges = true;
            }

            // Check if any child profiles of the renamed profile were defaults
            // This handles cases like: tso.zosmf is default, tso is renamed to tso1, so tso1.zosmf should remain default
            if (profileName.startsWith(originalKey + ".")) {
                // This is a child profile that was a default
                const childPath = profileName.substring(originalKey.length + 1);
                const newChildDefault = newKey + "." + childPath;
                updatedDefaults[profileType] = newChildDefault;
                hasChanges = true;
            }
        });

        // If we made changes, update the layer properties
        if (hasChanges) {
            currentLayer.properties.defaults = updatedDefaults;

            // If a team config update callback is provided, use it
            if (updateTeamConfig) {
                updateTeamConfig(updatedDefaults);
            }
        }
    } catch (error) {
        // Log error but don't fail the rename operation
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

        // Create a copy of defaults to simulate the update
        const simulatedDefaults = { ...defaults };

        // Check each default entry and simulate the update
        Object.entries(simulatedDefaults).forEach(([profileType, profileName]) => {
            // Check if this profile was a default
            if (profileName === originalKey) {
                // Simulate updating the default to reference the new profile
                simulatedDefaults[profileType] = newKey;
            }

            // Check if any child profiles of the renamed profile were defaults
            // This handles cases like: tso.zosmf is default, tso is renamed to tso1, so tso1.zosmf should remain default
            if (profileName.startsWith(originalKey + ".")) {
                // This is a child profile that was a default
                const childPath = profileName.substring(originalKey.length + 1);
                const newChildDefault = newKey + "." + childPath;
                simulatedDefaults[profileType] = newChildDefault;
            }
        });

        // Update the layer properties with simulated defaults
        currentLayer.properties.defaults = simulatedDefaults;
    } catch (error) {
        // Log error but don't fail the simulation
        console.warn(`Failed to simulate defaults update after profile rename: ${error}`);
    }
}
