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
import { ConfigStateContext } from "../types";
import { getOriginalProfileKey, getOriginalProfileKeyWithNested } from "./profileRenames";

interface GetProfileTypeParams extends ConfigStateContext {
    profileKey: string;
}

/**
 * Resolves a profile's `type`, checking pending changes first and falling back to the on-disk
 * config. Lives in its own leaf module (depending only on profileRenames) because
 * profileKeyListing/profileSecure/profileMergedProperties all need it, while profileUtils.ts
 * re-exports those three via `export *` — importing this from profileUtils.ts instead would
 * create a circular module dependency.
 */
export function getProfileType(params: GetProfileTypeParams): string | null {
    const { profileKey, selectedTab, configurations, pendingChanges, renames } = params;

    if (selectedTab === null) return null;
    const configPath = configurations[selectedTab!]!.configPath;

    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    const pendingType = Object.entries(pendingChanges[configPath] ?? {}).find(([key, entry]) => {
        if (entry.profile !== profileKey && entry.profile !== originalProfileKey) return false;
        const keyParts = key.split(".");
        const isProfileLevelType = keyParts[keyParts.length - 1] === "type" && !keyParts.includes("properties");
        return isProfileLevelType;
    });

    if (pendingType) {
        const raw = pendingType[1].value;
        if (raw == null || String(raw).trim() === "") {
            return null;
        }
        return raw as string;
    }

    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    let profile = flatProfiles[profileKey];

    if (!profile) {
        profile = flatProfiles[originalProfileKey];
    }

    if (!profile && profileKey.includes(".")) {
        const profileParts = profileKey.split(".");
        let originalPath = "";

        for (let i = 0; i < profileParts.length; i++) {
            const currentLevelPath = profileParts.slice(0, i + 1).join(".");
            const originalLevelPath = getOriginalProfileKey(currentLevelPath, configPath, renames);

            if (i === 0) {
                originalPath = originalLevelPath;
            } else {
                if (originalLevelPath !== currentLevelPath) {
                    const originalParentParts = originalLevelPath.split(".");
                    const remainingParts = profileParts.slice(originalParentParts.length);
                    originalPath = originalLevelPath + (remainingParts.length > 0 ? "." + remainingParts.join(".") : "");
                    break;
                } else {
                    originalPath = originalPath + "." + profileParts[i];
                }
            }
        }

        if (originalPath !== profileKey && originalPath !== originalProfileKey) {
            profile = flatProfiles[originalPath];
        }
    }

    if (profile && typeof profile.type === "string") {
        const t = profile.type.trim();
        return t === "" ? null : t;
    }

    return null;
}
