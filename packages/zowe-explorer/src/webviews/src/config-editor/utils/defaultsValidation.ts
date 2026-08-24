/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Detects `defaults` entries that name a profile which does not exist. Shared by the inline
 * warning icon in the Defaults panel and the warning raised on save, so the two cannot disagree.
 */

import { Configuration, DeletionsMap, PendingChangesMap, PendingDefaultsMap, RenamesMap } from "../types";
import { getAvailableProfilesByType } from "./profileKeyListing";

export interface InvalidDefault {
    configPath: string;
    profileType: string;
    profileName: string;
}

interface EffectiveDefaultParams {
    profileType: string;
    configPath: string;
    savedDefaults: { [profileType: string]: unknown };
    pendingDefaults: PendingDefaultsMap;
    renames: RenamesMap;
}

/**
 * The value a defaults dropdown should display: the pending edit if there is one, otherwise the
 * saved value mapped through any pending rename. Returns "" when the default is unset.
 */
export function getEffectiveDefaultValue(params: EffectiveDefaultParams): string {
    const { profileType, configPath, savedDefaults, pendingDefaults, renames } = params;

    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) {
        return pendingDefault.value;
    }

    const savedValue = savedDefaults[profileType];
    if (!savedValue || typeof savedValue !== "string") {
        return "";
    }

    const configRenames = renames[configPath] || {};
    return configRenames[savedValue] ?? savedValue;
}

interface FindInvalidDefaultsParams {
    configurations: Configuration[];
    pendingDefaults: PendingDefaultsMap;
    defaultsDeletions: DeletionsMap;
    pendingChanges: PendingChangesMap;
    renames: RenamesMap;
}

/**
 * Every default across all configurations that names a profile with no match of that type.
 * An empty value means "unset" and is never reported.
 */
export function findInvalidDefaults(params: FindInvalidDefaultsParams): InvalidDefault[] {
    const { configurations, pendingDefaults, defaultsDeletions, pendingChanges, renames } = params;

    return configurations.flatMap((config, index) => {
        const configPath = config.configPath;
        const savedDefaults = (config.properties?.defaults ?? {}) as { [profileType: string]: unknown };
        const staged = defaultsDeletions[configPath] ?? [];

        const profileTypes = new Set([...Object.keys(savedDefaults), ...Object.keys(pendingDefaults[configPath] ?? {})]);

        return Array.from(profileTypes).flatMap((profileType) => {
            if (staged.includes(profileType)) {
                return [];
            }

            const profileName = getEffectiveDefaultValue({ profileType, configPath, savedDefaults, pendingDefaults, renames });
            if (!profileName) {
                return [];
            }

            const availableProfiles = getAvailableProfilesByType({
                profileType,
                selectedTab: index,
                configurations,
                pendingChanges,
                renames,
            });

            return availableProfiles.includes(profileName) ? [] : [{ configPath, profileType, profileName }];
        });
    });
}
