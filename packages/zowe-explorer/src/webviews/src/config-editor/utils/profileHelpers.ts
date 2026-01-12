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

import { getProfileType, getOriginalProfileKeyWithNested } from "./profileUtils";
import { Configuration, PendingChange, PendingDefault } from "../types";
export type { Configuration, PendingChange, PendingDefault };

export function isProfileDefault(
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);

    if (!profileType) return false;

    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) {
        return pendingDefault.value === profileKey || pendingDefault.value === originalProfileKey;
    }

    const config = configurations[selectedTab!].properties;
    const defaults = config.defaults || {};

    const defaultValue = defaults[profileType];
    if (defaultValue === profileKey || defaultValue === originalProfileKey) {
        return true;
    }

    // Only proceed with rename checks if defaultValue exists and is a string
    if (defaultValue && typeof defaultValue === "string") {
        const configRenames = renames[configPath] || {};
        for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (defaultValue === originalKey && newKey === profileKey) {
                return true;
            }

            if (defaultValue.startsWith(originalKey + ".") && profileKey.startsWith(newKey + ".")) {
                const originalChildPath = defaultValue.substring(originalKey.length + 1);
                const currentChildPath = profileKey.substring(newKey.length + 1);
                if (originalChildPath === currentChildPath) {
                    return true;
                }
            }
        }
    }

    return false;
}

export function isCurrentProfileUntyped(
    selectedProfileKey: string | null,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): boolean {
    if (!selectedProfileKey) return false;
    const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
    return !profileType || profileType.trim() === "";
}
