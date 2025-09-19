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

export class ConfigEditorPathUtils {
    /**
     * Constructs a nested profile path from a profile key
     */
    static constructNestedProfilePath(profileKey: string): string {
        if (!profileKey || typeof profileKey !== "string") {
            throw new Error("Profile key must be a non-empty string");
        }

        const profileParts = profileKey.split(".");
        if (profileParts.length === 0) {
            throw new Error("Profile key cannot be empty");
        }

        const pathParts = ["profiles"];

        for (const part of profileParts) {
            if (!part || part.trim() === "") {
                throw new Error("Profile key parts cannot be empty");
            }
            pathParts.push(part);
            pathParts.push("profiles");
        }

        // Remove the last "profiles" since we don't need it for the final path
        pathParts.pop();
        return pathParts.join(".");
    }

    /**
     * Gets the new profile path after applying renames
     */
    static getNewProfilePath(
        profilePath: string,
        configPath: string,
        renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>,
        includeProfilesSegments = false
    ): string {
        // Split the path into parts to handle nested profiles
        const parts = profilePath.split(".");
        let newPath = parts.slice();
        let modified = false;

        // Check each part and its parent combinations for renames
        for (let i = parts.length; i > 0; i--) {
            const partialPath = parts.slice(0, i).join(".");
            const rename = renameMap.get(partialPath);
            if (rename && rename.configPath === configPath) {
                // Replace this part of the path with the new name
                const remainingParts = parts.slice(i);
                newPath = [...rename.newKey.split("."), ...remainingParts];
                modified = true;
                break;
            }
        }

        if (includeProfilesSegments) {
            // Always convert profile path to include 'profiles' segments
            // e.g., "test.lpar2" -> ["profiles", "test", "profiles", "lpar2"]
            // or "test" -> ["profiles", "test"]
            const pathWithProfiles: string[] = [];
            const pathParts = modified ? newPath : parts;

            // Always start with "profiles"
            pathWithProfiles.push("profiles");

            // Add each part with "profiles" between them
            for (let i = 0; i < pathParts.length; i++) {
                pathWithProfiles.push(pathParts[i]);
                // Add "profiles" between parts, but not after the last one
                if (i < pathParts.length - 1) {
                    pathWithProfiles.push("profiles");
                }
            }
            return pathWithProfiles.join(".");
        }

        return modified ? newPath.join(".") : profilePath;
    }

    /**
     * Updates a change object's key field to reflect profile renames
     */
    static updateChangeKey(change: any, configPath: string, renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>): any {
        const updatedChange = { ...change };

        if (updatedChange.key) {
            const keyParts = updatedChange.key.split(".");
            // Extract the profile path and property/type
            let propertyPath = "";
            let inProfile = false;
            let currentProfile = "";
            let profileEndIndex = -1;

            // Find where the profile path ends
            for (let i = 0; i < keyParts.length; i++) {
                const part = keyParts[i];
                if (part === "profiles") {
                    inProfile = true;
                    continue;
                }
                if (part === "properties") {
                    propertyPath = keyParts.slice(i).join(".");
                    profileEndIndex = i;
                    break;
                }
                if (part === "type" || part === "secure") {
                    // For direct profile properties like 'type' or 'secure' (not under 'properties')
                    propertyPath = keyParts.slice(i).join(".");
                    profileEndIndex = i;
                    break;
                }
                if (inProfile) {
                    if (currentProfile) {
                        currentProfile += "." + part;
                    } else {
                        currentProfile = part;
                    }
                }
            }

            // If we didn't find properties, type, or secure, the entire path might be a profile path
            if (profileEndIndex === -1 && inProfile) {
                // This might be a profile-only key (though this should be rare)
                profileEndIndex = keyParts.length;
            }

            if (currentProfile) {
                // Get the new profile path with 'profiles' segments included
                const newProfilePath = this.getNewProfilePath(currentProfile, configPath, renameMap, true);
                // Combine with property path
                updatedChange.key = propertyPath ? `${newProfilePath}.${propertyPath}` : newProfilePath;
            }
        }

        return updatedChange;
    }

    /**
     * Updates a change object's path array to reflect profile renames
     */
    static updateChangePath(change: any, configPath: string, renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>): any {
        const updatedChange = { ...change };

        if (updatedChange.path && Array.isArray(updatedChange.path)) {
            // Extract the profile path from the path array
            let currentProfile = "";
            let propertyPath: string[] = [];
            let foundPropertySection = false;

            for (const part of updatedChange.path) {
                if (part === "properties" || part === "type" || part === "secure") {
                    foundPropertySection = true;
                    propertyPath.push(part);
                    continue;
                }
                if (!foundPropertySection) {
                    if (part !== "profiles") {
                        if (currentProfile) {
                            currentProfile += "." + part;
                        } else {
                            currentProfile = part;
                        }
                    }
                } else {
                    propertyPath.push(part);
                }
            }

            if (currentProfile) {
                // Get the new profile path with 'profiles' segments
                const newProfilePath = this.getNewProfilePath(currentProfile, configPath, renameMap, true);
                // Split into array and combine with property path
                updatedChange.path = [...newProfilePath.split("."), ...propertyPath];
            }
        }

        return updatedChange;
    }
}
