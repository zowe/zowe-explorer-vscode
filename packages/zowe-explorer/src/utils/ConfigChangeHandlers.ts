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
import type { Config } from "@zowe/imperative";
import { ConfigSchemaHelpers } from "./ConfigSchemaHelpers";
import { ConfigUtils } from "./ConfigUtils";
import type { AutostoreToggleChange, ChangeEntry, LayerChangesPayload } from "./ConfigTypes";

export type { ChangeEntry } from "./ConfigTypes";

export class ConfigChangeHandlers {
    /** Apply a complete edit batch to an existing in-memory config, without loading or saving it. */
    public static async stageChanges(message: LayerChangesPayload, config: Config, areSecureValuesAllowed?: () => Promise<boolean>): Promise<void> {
        const groups = ConfigUtils.parseConfigChanges({
            configPath: message.configPath,
            changes: message.changes ?? [],
            deletions: message.deletions ?? [],
            defaultsChanges: message.defaultsChanges ?? [],
            defaultsDeleteKeys: message.defaultsDeleteKeys ?? [],
        });
        for (const group of groups) {
            await this.handleDefaultChanges(group.defaultsChanges, group.defaultsDeleteKeys, group.configPath, config);
            await this.handleProfileChanges(group.changes, group.deletions, group.configPath, areSecureValuesAllowed, config);
        }
    }

    private static transformSecureKeyToProperties(keyOrPath: string): string {
        const parts = keyOrPath.split(".");
        if (parts.length >= 2 && parts[parts.length - 2] === "secure") {
            parts[parts.length - 2] = "properties";
            return parts.join(".");
        }
        return keyOrPath;
    }

    public static activateLayerIfNeeded(configToUse: Config, layerPath: string): void {
        if (layerPath !== configToUse.api.layers.get().path) {
            const layer = configToUse.layers.find((prof) => prof.path === layerPath);
            if (!layer) {
                throw new Error(`Configuration layer no longer exists: ${layerPath}. Reopen or revert the editor before saving.`);
            }
            configToUse.api.layers.activate(layer.user, layer.global);
            if (configToUse.api.layers.get().path !== layerPath) {
                throw new Error(`Cannot activate configuration layer: ${layerPath}`);
            }
        }
    }

    private static async getConfigToUse(teamConfig?: Config): Promise<{ config: Config; isSimulation: boolean }> {
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
    public static async handleDefaultChanges(
        changes: ChangeEntry[],
        deletions: ChangeEntry[],
        activeLayer: string,
        teamConfig?: Config
    ): Promise<void> {
        const { config: configToUse, isSimulation } = await this.getConfigToUse(teamConfig);
        this.activateLayerIfNeeded(configToUse, activeLayer);

        for (const change of changes) {
            if (change.value === "" || change.value == null) {
                configToUse.delete(`defaults.${change.key}`);
            } else {
                configToUse.api.profiles.defaultSet(change.key, change.value);
            }
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
        teamConfig?: Config
    ): Promise<void> {
        const { config: configToUse, isSimulation } = await this.getConfigToUse(teamConfig);

        if (areSecureValuesAllowed && changes.some((change) => change.secure)) {
            const secureValuesAllowed = await areSecureValuesAllowed();
            if (!secureValuesAllowed) {
                throw new Error("Secure storage is unavailable. Your changes have not been saved.");
            }
        }

        this.activateLayerIfNeeded(configToUse, configPath);

        for (const change of changes) {
            const key = this.transformSecureKeyToProperties(change.key);
            // Preview and save must use identical schema-based conversion.
            let profileProps: Map<string, { type: string | string[]; path: string; description?: string }> | undefined;
            const currentLayer = configToUse.api.layers.get();
            let schemaPath: string | undefined;

            if (currentLayer.properties && currentLayer.properties.$schema) {
                schemaPath = path.join(path.dirname(currentLayer.path), currentLayer.properties.$schema);
                profileProps = ConfigSchemaHelpers.getProfileProperties(schemaPath);
            }
            const parseString = profileProps?.has(change.key.split(".")[change.key.split(".").length - 1]) ?? false;
            configToUse.set(key, change.value, { parseString: typeof change.value === "string" && parseString, secure: change.secure });
        }

        for (const deletion of deletions) {
            configToUse.delete(this.transformSecureKeyToProperties(deletion.key));
        }

        // Only save if not in simulation mode
        if (!isSimulation) {
            await configToUse.save();
        }
    }

    /**
     * Applies pending autostore toggles to their target configuration layer.
     */
    public static async handleAutostoreToggle(otherChanges: AutostoreToggleChange[], config?: Config): Promise<void> {
        for (const change of otherChanges) {
            if (change.type === "autostore") {
                const { config: teamConfig, isSimulation } = await this.getConfigToUse(config);
                this.activateLayerIfNeeded(teamConfig, change.configPath);
                teamConfig.set("autoStore", change.value, { parseString: true });
                if (!isSimulation) {
                    await teamConfig.save();
                }
            }
        }
    }
}
