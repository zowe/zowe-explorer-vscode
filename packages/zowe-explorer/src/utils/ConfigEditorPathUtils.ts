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

import { mapProfilePath, profileKeyToPath } from "../webviews/src/config-editor/utils/profilePaths";
import type { PathAwareChange } from "./ConfigTypes";

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

        if (profileParts.some((part) => !part.trim())) {
            throw new Error("Profile key parts cannot be empty");
        }
        return profileKeyToPath(profileKey).join(".");
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
        const parts = profilePath.split(".");
        let newPath = parts.slice();
        let modified = false;
        for (let i = parts.length; i > 0; i--) {
            const partialPath = parts.slice(0, i).join(".");
            const rename = renameMap.get(partialPath);
            if (rename && rename.configPath === configPath) {
                const remainingParts = parts.slice(i);
                newPath = [...rename.newKey.split("."), ...remainingParts];
                modified = true;
                break;
            }
        }

        const effectivePath = modified ? newPath.join(".") : profilePath;
        return includeProfilesSegments ? profileKeyToPath(effectivePath).join(".") : effectivePath;
    }

    /**
     * Updates a change object's key field to reflect profile renames
     */
    static updateChangeKey(
        change: PathAwareChange,
        configPath: string,
        renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>
    ): PathAwareChange {
        return {
            ...change,
            ...(change.key && { key: mapProfilePath(change.key, (key) => this.getNewProfilePath(key, configPath, renameMap)) }),
        };
    }

    static updateChangePath(
        change: PathAwareChange,
        configPath: string,
        renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>
    ): PathAwareChange {
        return {
            ...change,
            ...(Array.isArray(change.path) && { path: mapProfilePath(change.path, (key) => this.getNewProfilePath(key, configPath, renameMap)) }),
        };
    }
}
