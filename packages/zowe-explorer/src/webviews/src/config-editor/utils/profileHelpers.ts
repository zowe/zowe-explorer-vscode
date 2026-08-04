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

import type { Dispatch, SetStateAction } from "react";
import { getProfileType, getOriginalProfileKeyWithNested } from "./profileUtils";
import { Configuration, PendingChange, PendingDefault, ConfigStateContext, PendingDefaultsMap } from "../types";
export type { Configuration, PendingChange, PendingDefault };

type SimplePendingDefaultsMap = { [configPath: string]: { [key: string]: { value: string; path: string[] } } };

interface ToggleProfileDefaultParams {
    profileKey: string;
    profileType: string | null;
    isDefault: boolean;
    configurations?: any[];
    selectedTab?: number | null;
    setPendingDefaults?: Dispatch<SetStateAction<SimplePendingDefaultsMap>>;
    onSetAsDefault?: (profileKey: string) => void;
}

/**
 * Toggle a profile's default status: clears the current default when it is already the default,
 * otherwise sets it. Shared by the tree and flat profile lists' star buttons.
 */
export function toggleProfileDefault(params: ToggleProfileDefaultParams): void {
    const { profileKey, profileType, isDefault, configurations, selectedTab, setPendingDefaults, onSetAsDefault } = params;

    if (!profileType) return; // Don't allow interaction if no type

    if (isDefault) {
        // If already default, deselect it by setting to empty
        if (setPendingDefaults && configurations && selectedTab !== null && selectedTab !== undefined) {
            const configPath = configurations[selectedTab]!.configPath;
            setPendingDefaults((prev) => ({
                ...prev,
                [configPath]: {
                    ...prev[configPath],
                    [profileType]: { value: "", path: [profileType] },
                },
            }));
        }
    } else if (onSetAsDefault) {
        // Set as default
        onSetAsDefault(profileKey);
    }
}

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

interface IsCurrentProfileUntypedParams extends ConfigStateContext {
    selectedProfileKey: string | null;
}

export function isCurrentProfileUntyped(params: IsCurrentProfileUntypedParams): boolean {
    const { selectedProfileKey, selectedTab, configurations, pendingChanges, renames } = params;

    if (!selectedProfileKey) return false;
    const profileType = getProfileType({ profileKey: selectedProfileKey, selectedTab, configurations, pendingChanges, renames });
    return !profileType || profileType.trim() === "" || profileType.toLowerCase() === "default";
}
