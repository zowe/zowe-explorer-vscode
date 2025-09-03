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

    // Copy the profile to the new location
    api.set(targetPath, sourceProfile);

    // Delete the original profile
    api.delete(sourcePath);

    // Move secure properties if they exist
    moveSecureProperties(api, layerActive, sourcePath, targetPath);
}

export function getSecurePropertiesForProfile(api: ConfigMoveAPI, layerActive: () => IConfigLayer, profilePath: string): string[] {
    const profile = api.get(profilePath);
    return profile?.secure || [];
}

export function moveSecureProperties(api: ConfigMoveAPI, layerActive: () => IConfigLayer, sourcePath: string, targetPath: string): void {
    const sourceSecure = getSecurePropertiesForProfile(api, layerActive, sourcePath);
    const targetSecure = getSecurePropertiesForProfile(api, layerActive, targetPath);

    // Update secure arrays
    updateSecureArrays(api, layerActive, sourcePath, targetPath, sourceSecure, targetSecure);
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
    api: ConfigMoveAPI,
    layerActive: () => IConfigLayer,
    sourcePath: string,
    targetPath: string,
    sourceSecure: string[],
    targetSecure: string[]
): void {
    const secureArrays = findSecureArrays(api, layerActive, sourcePath, targetPath);

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

export function findSecureArrays(
    api: ConfigMoveAPI,
    layerActive: () => IConfigLayer,
    sourcePath: string,
    targetPath: string
): Array<{ profile: any; profilePath: string; secure: string[] }> {
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
    const originalName = pathParts[pathParts.length - 1] || "";
    const parentPath = pathParts.slice(0, -1).join(".");

    // Construct the new path
    const newPath = parentPath ? `${parentPath}.${newName}` : newName;

    // Check if the new name already exists
    const existingProfile = api.get(newPath);
    if (existingProfile) {
        throw new Error(`Profile with name '${newName}' already exists`);
    }

    // Move the profile to the new location
    moveProfile(api, layerActive, originalPath, newPath);

    return newPath;
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
            if (profileName === originalKey) {
                // Update the default to reference the new profile name
                updatedDefaults[profileType] = newKey;
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
            if (profileName === originalKey) {
                // Simulate updating the default to reference the new profile name
                simulatedDefaults[profileType] = newKey;
            }
        });

        // Update the layer properties with simulated defaults
        currentLayer.properties.defaults = simulatedDefaults;
    } catch (error) {
        // Log error but don't fail the simulation
        console.warn(`Failed to simulate defaults update after profile rename: ${error}`);
    }
}
