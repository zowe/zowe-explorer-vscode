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
import { PendingChange } from "../types";

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
    const newProfileKey = rootProfile === "root" ? profileName.trim() : `${rootProfile}.${profileName.trim()}`;

    const existingProfilesUnderRoot = Object.keys(flatProfiles).some((profileKey) => {
        if (rootProfile === "root") {
            return profileKey === profileName.trim();
        } else {
            return profileKey === `${rootProfile}.${profileName.trim()}` || profileKey.startsWith(`${rootProfile}.${profileName.trim()}.`);
        }
    });

    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
        if (entry.profile) {
            if (rootProfile === "root") {
                return entry.profile === profileName.trim();
            } else {
                return entry.profile === `${rootProfile}.${profileName.trim()}` || entry.profile.startsWith(`${rootProfile}.${profileName.trim()}.`);
            }
        }
        return false;
    });

    const renamesForConfig = renames[configPath] || {};
    const renameIsOccupyingName = Object.entries(renamesForConfig).some(([, newName]) => {
        if (newName === newProfileKey) {
            return true;
        }
        if (newProfileKey.startsWith(newName + ".")) {
            return true;
        }
        if (newName.startsWith(newProfileKey + ".")) {
            return true;
        }

        return false;
    });

    return existingProfilesUnderRoot || pendingProfilesUnderRoot || renameIsOccupyingName;
}
