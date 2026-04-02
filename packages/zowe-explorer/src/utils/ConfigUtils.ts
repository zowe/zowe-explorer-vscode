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

import { ProfileCredentials, ProfileInfo } from "@zowe/imperative";
import { ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Profiles } from "../configuration/Profiles";
import type { ChangeEntry, FlattenedProfilesMap, LayerModifications, NestedProfilesMap } from "./ConfigTypes";
import { schemaValidation } from "./ConfigSchemaHelpers";

export type { ChangeEntry, LayerModifications } from "./ConfigTypes";

type ArrayField = "changes" | "deletions" | "defaultsChanges" | "defaultsDeleteKeys";

export class ConfigUtils {
    /**
     * Creates a ProfileInfo instance for Zowe and loads profiles from disk.
     * @returns ProfileInfo after readProfilesFromDisk
     */
    public static async createProfileInfoAndLoad(): Promise<ProfileInfo> {
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as InstanceType<typeof Profiles> & { overrideWithEnv?: boolean }).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        return profInfo;
    }

    /**
     * Parses configuration changes and groups them by config path
     * @param data - The layer modifications data
     * @returns Array of grouped layer modifications
     */
    public static parseConfigChanges(data: LayerModifications): LayerModifications[] {
        const groups: Record<string, LayerModifications> = {};

        const addToGroup = (items: ChangeEntry[], field: ArrayField): void => {
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
    public static processProfilesRecursively(profiles: NestedProfilesMap | undefined | null, schemaValidation?: schemaValidation): void {
        if (!profiles || typeof profiles !== "object") {
            return;
        }
        // Process profiles and filter out invalid ones
        const profileNames = Object.keys(profiles);
        for (const profileName of profileNames) {
            const profile = profiles[profileName] as Record<string, unknown>;

            // Handle secure properties for current profile
            if (profile.secure && profile.properties) {
                const secureKeys = profile.secure as string[];
                profile.properties = Object.fromEntries(
                    Object.entries(profile.properties as Record<string, unknown>).filter(([key]) => !secureKeys.includes(key))
                );
            }

            // Recursively process nested profiles
            if (profile.profiles) {
                this.processProfilesRecursively(profile.profiles as NestedProfilesMap, schemaValidation);
            }
        }
    }

    /**
     * Flattens nested profiles into a single-level object with dot-notation keys
     * @param profiles - The profiles object to flatten
     * @param parentKey - The parent key for nested profiles (internal use)
     * @param result - The accumulator object (internal use)
     * @returns Flattened profiles object
     */
    public static flattenProfiles(
        profiles: NestedProfilesMap | undefined | null,
        parentKey = "",
        result: FlattenedProfilesMap = {}
    ): FlattenedProfilesMap {
        if (!profiles || typeof profiles !== "object") return result;

        for (const key of Object.keys(profiles)) {
            const profile = profiles[key] as Record<string, unknown>;
            const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

            const profileCopy = { ...profile };
            delete profileCopy.profiles;

            result[qualifiedKey] = profileCopy;

            if (profile.profiles) {
                this.flattenProfiles(profile.profiles as NestedProfilesMap, qualifiedKey, result);
            }
        }

        return result;
    }
}
