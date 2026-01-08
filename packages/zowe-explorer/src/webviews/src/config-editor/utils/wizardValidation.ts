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

interface PendingChange {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
}

/**
 * Checks if a profile name is already taken in the configuration.
 * This is a pure function that can be easily unit tested.
 *
 * @param profileName - The name of the profile to check
 * @param rootProfile - The root profile under which to create the new profile ("root" for top-level)
 * @param configPath - The path to the configuration file
 * @param profiles - The existing profiles object
 * @param pendingChanges - Pending changes that haven't been saved yet
 * @param renames - Profile renames that haven't been saved yet
 * @returns true if the profile name is taken, false otherwise
 */
export function isProfileNameTaken(
    profileName: string,
    rootProfile: string,
    configPath: string,
    profiles: any,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (!profileName.trim()) return false;

    const flatProfiles = flattenProfiles(profiles);

    // Construct the full profile key that would be created
    const newProfileKey = rootProfile === "root" ? profileName.trim() : `${rootProfile}.${profileName.trim()}`;

    // Check existing profiles
    const existingProfilesUnderRoot = Object.keys(flatProfiles).some((profileKey) => {
        if (rootProfile === "root") {
            return profileKey === profileName.trim();
        } else {
            return (
                profileKey === `${rootProfile}.${profileName.trim()}` ||
                profileKey.startsWith(`${rootProfile}.${profileName.trim()}.`)
            );
        }
    });

    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
        if (entry.profile) {
            if (rootProfile === "root") {
                return entry.profile === profileName.trim();
            } else {
                return (
                    entry.profile === `${rootProfile}.${profileName.trim()}` ||
                    entry.profile.startsWith(`${rootProfile}.${profileName.trim()}.`)
                );
            }
        }
        return false;
    });

    // Check if a rename is occupying this name
    const renamesForConfig = renames[configPath] || {};
    const renameIsOccupyingName = Object.entries(renamesForConfig).some(([, newName]) => {
        // Check if the rename will result in a profile with the same name we're trying to create
        if (newName === newProfileKey) {
            return true;
        }

        // Check if the rename will result in a parent profile that would conflict
        // e.g., if we're trying to create "tso2.child" and "tso1" is being renamed to "tso2"
        if (newProfileKey.startsWith(newName + ".")) {
            return true;
        }

        // Check if we're trying to create a profile that would be a parent of the renamed profile
        // e.g., if we're trying to create "tso2" and "tso1.child" is being renamed to "tso2.child"
        if (newName.startsWith(newProfileKey + ".")) {
            return true;
        }

        return false;
    });

    return existingProfilesUnderRoot || pendingProfilesUnderRoot || renameIsOccupyingName;
}
