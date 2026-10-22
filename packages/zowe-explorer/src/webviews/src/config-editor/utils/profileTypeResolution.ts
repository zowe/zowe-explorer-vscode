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

import { findProfile } from "./configUtils";
import { ConfigStateContext } from "../types";
import { getRenamedProfileKeyWithNested, getOriginalProfileKeyWithNested } from "./profileRenames";

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
        if (entry.profile !== profileKey) return false;
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
    const profile =
        getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames) === profileKey
            ? findProfile(config.profiles, originalProfileKey)
            : undefined;

    if (profile && typeof profile.type === "string") {
        const t = profile.type.trim();
        return t === "" ? null : t;
    }

    return null;
}
