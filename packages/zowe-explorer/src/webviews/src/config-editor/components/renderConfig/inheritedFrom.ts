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

/**
 * Extract the logical profile path (e.g. `lpar1.zosmf`) from a merged-property `jsonLoc`.
 * `jsonLoc` looks like `profiles.lpar1.profiles.zosmf.properties.host`; we drop the leading
 * segment and the trailing `properties.<name>`, then strip the interleaved `profiles` markers.
 */
function extractProfilePathFromJsonLoc(jsonLoc: string): string {
    const jsonLocParts = jsonLoc.split(".");
    const profilePathParts = jsonLocParts.slice(1, -2);
    return profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") || "unknown profile";
}

export interface InheritedFromParts {
    profilePath: string;
    configPath: string;
}

/**
 * Resolves the `{ profilePath, configPath }` a merged property was inherited from, for
 * display in the `InheritedFromIndicator` popover.
 */
export function getInheritedFromParts(jsonLoc: string, osLoc?: string[]): InheritedFromParts {
    return {
        profilePath: extractProfilePathFromJsonLoc(jsonLoc),
        configPath: osLoc?.[0] || "unknown config",
    };
}

/**
 * Rename-aware variant used by the editable property row. Returns `undefined` when the source
 * resolves to the current profile (i.e. the value isn't actually inherited), and rewrites the
 * source profile name when it has itself been renamed.
 */
export function getInheritedFromPartsWithRenames(
    jsonLoc: string,
    osLoc: string[] | undefined,
    selectedProfileKey: string | null,
    configPath: string | undefined,
    renames: { [configPath: string]: { [originalKey: string]: string } }
): InheritedFromParts | undefined {
    let profilePath = extractProfilePathFromJsonLoc(jsonLoc);

    // Check if this is the current profile or its renamed version.
    const currentProfileKey = selectedProfileKey || "";

    // Get both old and new names for the current profile.
    const isCurrentProfileRenamed = Object.entries(renames[configPath!] || {}).find(
        ([oldName, newName]) => newName === currentProfileKey || oldName === currentProfileKey
    );

    if (isCurrentProfileRenamed) {
        const [oldName, newName] = isCurrentProfileRenamed;
        // If the profilePath matches either the old or new name, this is not actually inherited.
        if (profilePath === oldName || profilePath === newName) {
            return undefined;
        }
    } else if (profilePath === currentProfileKey) {
        // If not renamed but matches current profile, not inherited.
        return undefined;
    }

    const fullConfigPath = osLoc?.[0] || "unknown config";

    // Check if the source profile has been renamed and use its new name.
    const sourceProfileRenamed = Object.entries(renames[configPath!] || {}).find(([oldName]) => oldName === profilePath);
    if (sourceProfileRenamed) {
        profilePath = sourceProfileRenamed[1];
    }

    return { profilePath, configPath: fullConfigPath };
}
