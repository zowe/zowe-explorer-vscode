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

import * as path from "path";
import { ConfigSchemaHelpers } from "./ConfigSchemaHelpers";
import { ConfigUtils } from "./ConfigUtils";
import type { ChangeEntry } from "./ConfigTypes";

export type { ChangeEntry } from "./ConfigTypes";

export class ConfigChangeHandlers {
    private static transformSecureKeyToProperties(keyOrPath: string): string {
        const parts = keyOrPath.split(".");
        if (parts.length >= 2 && parts[parts.length - 2] === "secure") {
            parts[parts.length - 2] = "properties";
            return parts.join(".");
        }
        return keyOrPath;
    }

    private static activateLayerIfNeeded(configToUse: any, layerPath: string): void {
        if (layerPath !== configToUse.api.layers.get().path) {
            const layer = configToUse.layers.find((prof: any) => prof.path === layerPath);
            if (layer) {
                configToUse.api.layers.activate(layer.user, layer.global);
            }
        }
    }

    private static async getConfigToUse(teamConfig?: any): Promise<{ config: any; isSimulation: boolean }> {
        if (teamConfig) {
            return { config: teamConfig, isSimulation: true };
        }
        const profInfo = await ConfigUtils.createProfileInfoAndLoad();
        return { config: profInfo.getTeamConfig(), isSimulation: false };
    }

    /**
     * Handles changes to default profile settings
     * @param changes - Array of changes to apply
     * @param deletions - Array of keys to delete
     * @param activeLayer - Path to the active configuration layer
     * @param teamConfig - Optional team configuration object. If provided, operates in simulation mode (no save).
     *                    If not provided, creates ProfileInfo and saves changes.
     */
    public static async handleDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string, teamConfig?: any): Promise<void> {
        const { config: configToUse, isSimulation } = await this.getConfigToUse(teamConfig);
        this.activateLayerIfNeeded(configToUse, activeLayer);

        for (const change of changes) {
            configToUse.api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            configToUse.delete(`defaults.${deletion.key}`);
        }

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
        const { config: configToUse, isSimulation } = await this.getConfigToUse(teamConfig);

        let filteredChanges = changes;
        if (!isSimulation && areSecureValuesAllowed) {
            const secureValuesAllowed = await areSecureValuesAllowed();
            filteredChanges = secureValuesAllowed ? changes : changes.filter((change) => !change.secure);
        }

        for (const item of filteredChanges) {
            item.key = this.transformSecureKeyToProperties(item.key);
            if (item.profile) {
                item.profile = this.transformSecureKeyToProperties(item.profile);
            }
        }

        for (const item of deletions) {
            item.key = this.transformSecureKeyToProperties(item.key);
        }

        this.activateLayerIfNeeded(configToUse, configPath);

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
