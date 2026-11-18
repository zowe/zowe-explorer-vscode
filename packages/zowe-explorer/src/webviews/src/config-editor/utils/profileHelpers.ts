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

import { getAllQualifiedProfileKeys, getProfileType, getRenamedProfileKeyWithNested } from "./profileUtils";
import { Configuration, PendingChange, PendingDefault, ConfigStateContext, PendingDefaultsMap } from "../types";
export type { Configuration, PendingChange, PendingDefault };

interface IsProfileDefaultParams extends ConfigStateContext {
    profileKey: string;
    pendingDefaults: PendingDefaultsMap;
}

export function isProfileDefault(params: IsProfileDefaultParams): boolean {
    const { profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames } = params;

    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;
    const profileType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });

    if (!profileType) return false;

    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) return pendingDefault.value === profileKey;
    const savedDefault = configurations[selectedTab].properties.defaults?.[profileType];
    return typeof savedDefault === "string" && getRenamedProfileKeyWithNested(savedDefault, configPath, renames) === profileKey;
}

/**
 * When the selected tab is a global config, finds the project config whose `defaults` points at
 * `profileKey` even though that project config has no profile of that name (the dropdown in a
 * project config can pick global profiles). Returns that config's path, or null.
 */
export function getProjectDefaultSource(params: IsProfileDefaultParams): string | null {
    const { profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames } = params;

    if (selectedTab === null || !configurations[selectedTab]?.global) return null;
    const profileType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });
    if (!profileType) return null;

    const source = configurations.find((config) => {
        if (config.global) return false;
        const pendingDefault = pendingDefaults[config.configPath]?.[profileType];
        const savedDefault = config.properties?.defaults?.[profileType];
        const effectiveDefault = pendingDefault ? pendingDefault.value : savedDefault;
        if (effectiveDefault !== profileKey) return false;
        return !getAllQualifiedProfileKeys(config.properties?.profiles).includes(profileKey);
    });
    return source?.configPath ?? null;
}

interface IsCurrentProfileUntypedParams extends ConfigStateContext {
    selectedProfileKey: string | null;
}

export function isCurrentProfileUntyped(params: IsCurrentProfileUntypedParams): boolean {
    const { selectedProfileKey, selectedTab, configurations, pendingChanges, renames } = params;

    if (!selectedProfileKey) return false;
    const profileType = getProfileType({ profileKey: selectedProfileKey, selectedTab, configurations, pendingChanges, renames });
    return !profileType || profileType.trim() === "" || profileType.toLowerCase() === "default";
}
