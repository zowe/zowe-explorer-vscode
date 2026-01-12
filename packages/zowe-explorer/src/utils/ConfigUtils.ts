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

import { ChangeEntry } from "./ConfigChangeHandlers";
import { schemaValidation } from "./ConfigSchemaHelpers";

export type LayerModifications = {
    configPath: string;
    changes: ChangeEntry[];
    deletions: ChangeEntry[];
    defaultsChanges: ChangeEntry[];
    defaultsDeleteKeys: ChangeEntry[];
};

type ArrayField = "changes" | "deletions" | "defaultsChanges" | "defaultsDeleteKeys";

export class ConfigUtils {
    /**
     * Parses configuration changes and groups them by config path
     * @param data - The layer modifications data
     * @returns Array of grouped layer modifications
     */
    public static parseConfigChanges(data: LayerModifications): LayerModifications[] {
        const groups: Record<string, LayerModifications> = {};

        const addToGroup = (items: ChangeEntry[], field: ArrayField): any => {
            for (const item of items) {
                const configPath = item.configPath;
                if (!groups[configPath]) {
                    groups[configPath] = {
                        configPath,
                        changes: [],
                        deletions: [],
                        defaultsChanges: [],
                        defaultsDeleteKeys: [],
                    };
                }
                groups[configPath][field].push(item);
            }
        };

        addToGroup(data.changes || [], "changes");
        addToGroup(data.deletions || [], "deletions");
        addToGroup(data.defaultsChanges || [], "defaultsChanges");
        addToGroup(data.defaultsDeleteKeys || [], "defaultsDeleteKeys");

        return Object.values(groups);
    }

    /**
     * Processes profiles recursively to handle nested profiles and secure properties
     * @param profiles - The profiles object to process
     * @param schemaValidation - Optional schema validation to filter out invalid profile types
     */
    public static processProfilesRecursively(profiles: any, schemaValidation?: schemaValidation): void {
        if (!profiles || typeof profiles !== "object") {
            return;
        }
        // Process profiles and filter out invalid ones
        const profileNames = Object.keys(profiles);
        for (const profileName of profileNames) {
            const profile = profiles[profileName];

            // Handle secure properties for current profile
            if (profile.secure && profile.properties) {
                const secureKeys = profile.secure;
                profile.properties = Object.fromEntries(Object.entries(profile.properties).filter(([key]) => !secureKeys.includes(key)));
            }

            // Recursively process nested profiles
            if (profile.profiles) {
                this.processProfilesRecursively(profile.profiles, schemaValidation);
            }
        }
    }
}
