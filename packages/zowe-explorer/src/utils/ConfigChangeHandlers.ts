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
import * as path from "path";
import { ConfigSchemaHelpers } from "./ConfigSchemaHelpers";
import { Profiles } from "../configuration/Profiles";

export type ChangeEntry = {
    key: string;
    value: string;
    path: string[];
    profile?: string;
    configPath: string;
    secure: boolean;
};

export class ConfigChangeHandlers {
    /**
     * Handles changes to default profile settings
     * @param changes - Array of changes to apply
     * @param deletions - Array of keys to delete
     * @param activeLayer - Path to the active configuration layer
     * @param teamConfig - Optional team configuration object. If provided, operates in simulation mode (no save).
     *                    If not provided, creates ProfileInfo and saves changes.
     */
    public static async handleDefaultChanges(
        changes: ChangeEntry[],
        deletions: ChangeEntry[],
        activeLayer: string,
        teamConfig?: any
    ): Promise<void> {
        let configToUse: any;
        const isSimulation = !!teamConfig;

        if (teamConfig) {
            // Simulation mode: use provided teamConfig
            configToUse = teamConfig;
        } else {
            // Normal mode: create ProfileInfo and read from disk
            const profInfo = new ProfileInfo("zowe", {
                overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
                credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
            });
            await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
            configToUse = profInfo.getTeamConfig();
        }

        if (activeLayer !== configToUse.api.layers.get().path) {
            const findProfile = configToUse.layers.find((prof: any) => prof.path === activeLayer);
            if (findProfile) {
                configToUse.api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of changes) {
            configToUse.api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            configToUse.delete(`defaults.${deletion.key}`);
        }

        // Only save if not in simulation mode
        if (!isSimulation) {
            await configToUse.save();
        }
    }

    /**
     * Handles changes to profile properties
     * @param changes - Array of changes to apply
     * @param deletions - Array of keys to delete
     * @param configPath - Path to the configuration file
     * @param areSecureValuesAllowed - Function to check if secure values are allowed (optional in simulation mode)
     * @param teamConfig - Optional team configuration object. If provided, operates in simulation mode (no save).
     *                    If not provided, creates ProfileInfo and saves changes.
     */
    public static async handleProfileChanges(
        changes: ChangeEntry[],
        deletions: ChangeEntry[],
        configPath: string,
        areSecureValuesAllowed?: () => Promise<boolean>,
        teamConfig?: any
    ): Promise<void> {
        let configToUse: any;
        const isSimulation = !!teamConfig;

        if (teamConfig) {
            // Simulation mode: use provided teamConfig
            configToUse = teamConfig;
        } else {
            // Normal mode: create ProfileInfo and read from disk
            const profInfo = new ProfileInfo("zowe", {
                overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
                credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
            });
            await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
            configToUse = profInfo.getTeamConfig();
        }

        // Filter secure values only in normal mode (when areSecureValuesAllowed is provided)
        let filteredChanges = changes;
        if (!isSimulation && areSecureValuesAllowed) {
            const secureValuesAllowed = await areSecureValuesAllowed();
            filteredChanges = secureValuesAllowed ? changes : changes.filter((change) => !change.secure);
        }

        // Transform secure keys to properties
        for (const item of filteredChanges) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }

            if (item.profile) {
                const profileParts = item.profile.split(".");
                if (profileParts[profileParts.length - 2] === "secure") {
                    profileParts[profileParts.length - 2] = "properties";
                    item.profile = profileParts.join(".");
                }
            }
        }

        for (const item of deletions) {
            const keyParts = item.key.split(".");
            if (keyParts[keyParts.length - 2] === "secure") {
                keyParts[keyParts.length - 2] = "properties";
                item.key = keyParts.join(".");
            }
        }

        if (configPath !== configToUse.api.layers.get().path) {
            const findProfile = configToUse.layers.find((prof: any) => prof.path === configPath);
            if (findProfile) {
                configToUse.api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of filteredChanges) {
            try {
                if (isSimulation) {
                    // Simulation mode: use parseString: true (simpler, no schema validation)
                    configToUse.set(change.key, change.value, { parseString: true, secure: change.secure });
                } else {
                    // Normal mode: use schema validation
                    let profileProps: Map<string, { type: string | string[]; path: string; description?: string }> | undefined;
                    const currentLayer = configToUse.api.layers.get();
                    let schemaPath: string | undefined;

                    if (currentLayer.properties && currentLayer.properties.$schema) {
                        schemaPath = path.join(path.dirname(currentLayer.path), currentLayer.properties.$schema);
                        profileProps = ConfigSchemaHelpers.getProfileProperties(schemaPath);
                    }
                    const parseString = profileProps?.has(change.key.split(".")[change.key.split(".").length - 1]) ?? false;
                    configToUse.set(change.key, change.value, { parseString, secure: change.secure });
                }
            } catch {}
        }

        for (const deletion of deletions) {
            try {
                configToUse.delete(deletion.key);
            } catch {}
        }

        // Only save if not in simulation mode
        if (!isSimulation) {
            await configToUse.save();
        }
    }

}
