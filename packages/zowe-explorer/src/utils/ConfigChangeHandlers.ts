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

import { ProfileInfo } from "@zowe/imperative";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as path from "path";
import { ConfigSchemaHelpers } from "./ConfigSchemaHelpers";

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
     */
    public static async handleDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        if (activeLayer !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === activeLayer);
            if (findProfile) {
                profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of changes) {
            profInfo.getTeamConfig().api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            profInfo.getTeamConfig().delete(`defaults.${deletion.key}`);
        }
        await profInfo.getTeamConfig().save();
    }

    /**
     * Handles changes to profile properties
     * @param changes - Array of changes to apply
     * @param deletions - Array of keys to delete
     * @param configPath - Path to the configuration file
     * @param areSecureValuesAllowed - Function to check if secure values are allowed
     */
    public static async handleProfileChanges(
        changes: ChangeEntry[],
        deletions: ChangeEntry[],
        configPath: string,
        areSecureValuesAllowed: () => Promise<boolean>
    ): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        // Check if secure values are allowed before processing changes
        const secureValuesAllowed = await areSecureValuesAllowed();

        // Filter out secure changes if secure values are not allowed
        const filteredChanges = secureValuesAllowed ? changes : changes.filter((change) => !change.secure);

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

        if (configPath !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === configPath);
            if (findProfile) {
                profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        for (const change of filteredChanges) {
            let profileProps: Map<string, { type: string | string[]; path: string; description?: string }> | undefined;
            try {
                // Get the schema path for the current config layer
                const currentLayer = profInfo.getTeamConfig().api.layers.get();
                let schemaPath: string | undefined;

                if (currentLayer.properties && currentLayer.properties.$schema) {
                    schemaPath = path.join(path.dirname(currentLayer.path), currentLayer.properties.$schema);

                    // Get profile properties from the schema
                    profileProps = ConfigSchemaHelpers.getProfileProperties(schemaPath);
                }
                // Check if the key is a string, then we know it does not need to be parsed
                if (!profileProps.has(change.key.split(".")[change.key.split(".").length - 1])) {
                    profInfo.getTeamConfig().set(change.key, change.value, { secure: change.secure });
                } else {
                    profInfo.getTeamConfig().set(change.key, change.value, { parseString: true, secure: change.secure });
                }
            } catch (err) {
                // console.log(err);
            }
        }

        for (const deletion of deletions) {
            try {
                profInfo.getTeamConfig().delete(deletion.key);
            } catch (err) {
                // console.log(err);
            }
        }
        await profInfo.getTeamConfig().save();
    }

    /**
     * Simulates changes to default profile settings without affecting the original config
     * @param changes - Array of changes to simulate
     * @param deletions - Array of keys to simulate deletion
     * @param activeLayer - Path to the active configuration layer
     * @param teamConfig - The team configuration object to modify
     */
    public static simulateDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string, teamConfig: any): void {
        if (activeLayer !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: any) => prof.path === activeLayer);
            teamConfig.api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            teamConfig.api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            teamConfig.delete(`defaults.${deletion.key}`);
        }
    }

    /**
     * Simulates changes to profile properties without affecting the original config
     * @param changes - Array of changes to simulate
     * @param deletions - Array of keys to simulate deletion
     * @param configPath - Path to the configuration file
     * @param teamConfig - The team configuration object to modify
     */
    public static simulateProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string, teamConfig: any): void {
        for (const item of changes) {
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

        if (configPath !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: any) => prof.path === configPath);
            teamConfig.api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            try {
                teamConfig.set(change.key, change.value, { parseString: true, secure: change.secure });
            } catch (err) {
                // console.log(err);
            }
        }

        for (const deletion of deletions) {
            try {
                teamConfig.delete(deletion.key);
            } catch (err) {
                // console.log(err);
            }
        }
    }
}
