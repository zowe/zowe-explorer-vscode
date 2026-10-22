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

import type { Config, IConfigLayer } from "@zowe/imperative";
import * as path from "path";
import { applyRenameChainToProfileName, profileKeyToPath } from "../webviews/src/config-editor/utils/profilePaths";
import { ConfigChangeHandlers } from "./ConfigChangeHandlers";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import type { LayerChangesPayload, LayerModifications, MergedKnownArg, NestedProfilesMap, ProfileRenameEntry, ProfileTreeNode } from "./ConfigTypes";

export class ConfigEditorMergedProperties {
    public constructor(private profileOperations: ConfigEditorProfileOperations) {}

    public async getPendingMergedArgsForProfile(
        profPath: string,
        configPath: string,
        changes: LayerModifications,
        renames?: ProfileRenameEntry[]
    ): Promise<unknown> {
        const profInfo = await ConfigUtils.createProfileInfoAndLoad();
        const teamConfig = profInfo.getTeamConfig();

        if (renames && Array.isArray(renames)) {
            this.profileOperations.simulateProfileRenames(renames, teamConfig);
        }

        const effectiveChanges: LayerChangesPayload =
            renames && renames.length > 0 ? this.profileOperations.updateProfileChangesForRenames(changes, renames) : changes;

        await ConfigChangeHandlers.stageChanges(effectiveChanges, teamConfig);

        const allProfiles = profInfo.getAllProfiles();

        const profileNameToLookup = applyRenameChainToProfileName(
            profPath,
            (renames ?? []).filter((rename) => rename.configPath === configPath)
        );

        // The simulated configuration already uses final names; an original name may now belong to another profile.
        const profile = allProfiles.find((prof) => prof.profName === profileNameToLookup && prof.profLoc.osLoc?.includes(path.normalize(configPath)));

        if (!profile) {
            return;
        }

        const activateLayer = teamConfig.layers.find((layer) => layer.path === configPath);
        if (activateLayer) {
            teamConfig.api.layers.activate(activateLayer.user, activateLayer.global);
        }

        let mergedArgs;
        try {
            mergedArgs = profInfo.mergeArgsForProfile(profile, { getSecureVals: true });
        } catch (error) {
            console.warn(`Failed to load schema for profile type "${profile.profType}": ${error.message}`);
            return;
        }

        if (mergedArgs.knownArgs) {
            this.applySecureFieldPrecedence(teamConfig, mergedArgs.knownArgs as unknown as MergedKnownArg[]);
        }
        const redacted = this.profileOperations.redactSecureValues(mergedArgs.knownArgs);
        return redacted;
    }

    public async getWizardMergedProperties(
        rootProfile: string,
        profileType: string,
        configPath: string,
        profileName?: string,
        changes?: LayerModifications,
        renames?: ProfileRenameEntry[]
    ): Promise<unknown> {
        if (!profileType) {
            return [];
        }

        const profInfo = await ConfigUtils.createProfileInfoAndLoad();

        const teamConfig = profInfo.getTeamConfig();

        try {
            if (renames && Array.isArray(renames)) {
                this.profileOperations.simulateProfileRenames(renames, teamConfig);
            }
        } catch (simulationError) {
            const errorMessage = simulationError instanceof Error ? simulationError.message : String(simulationError);
            console.error("Simulation failed:", errorMessage);
            throw simulationError;
        }

        if (changes) {
            await ConfigChangeHandlers.stageChanges(changes, teamConfig);
        }

        if (configPath !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: IConfigLayer) => prof.path === configPath);
            if (findProfile) {
                teamConfig.api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        const actualRootProfile = changes?.profilePathsAreEffective
            ? rootProfile
            : applyRenameChainToProfileName(
                  rootProfile,
                  (renames ?? []).filter((rename) => rename.configPath === configPath)
              );
        const tempProfileName = profileName || `temp_${Date.now()}`;
        const expectedProfileName = actualRootProfile === "root" ? tempProfileName : `${actualRootProfile}.${tempProfileName}`;
        const tempProfilePath = profileKeyToPath(expectedProfileName).join(".");

        try {
            teamConfig.set(tempProfilePath, { type: profileType }, { parseString: true });

            const allProfiles = profInfo.getAllProfiles();
            const tempProfile = allProfiles.find((prof) => prof.profName === expectedProfileName);

            if (!tempProfile) {
                return [];
            }

            const mergedArgs = profInfo.mergeArgsForProfile(tempProfile, { getSecureVals: true });

            if (mergedArgs.knownArgs) {
                this.applySecureFieldPrecedence(teamConfig, mergedArgs.knownArgs as unknown as MergedKnownArg[]);
            }

            const redacted = this.profileOperations.redactSecureValues(mergedArgs.knownArgs);
            return redacted || [];
        } finally {
            try {
                teamConfig.delete(tempProfilePath);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Check if a layer has a specific field defined in its properties
     * @param layer - The configuration layer to check
     * @param jsonLoc - The JSON location path of the field
     * @returns true if the layer has this field defined
     */
    private layerHasField(layer: IConfigLayer, jsonLoc: string): boolean {
        if (!layer.properties || !layer.properties.profiles) {
            return false;
        }

        // Parse the jsonLoc to find the field in the layer's properties
        // jsonLoc format is typically like "profiles.profileName.properties.fieldName"
        const pathParts = jsonLoc.split(".");

        if (pathParts.length < 4 || pathParts[0] !== "profiles") {
            return false;
        }

        const profileName = pathParts[1];
        const profile = (layer.properties.profiles as NestedProfilesMap | undefined)?.[profileName] as ProfileTreeNode | undefined;

        if (!profile || !profile.properties) {
            return false;
        }

        // Check if the field exists in the profile's properties
        const fieldName = pathParts[pathParts.length - 1];
        return fieldName in (profile.properties as Record<string, unknown>);
    }

    private applySecureFieldPrecedence(teamConfig: Config, knownArgs: MergedKnownArg[]): void {
        if (!knownArgs || !Array.isArray(knownArgs)) {
            return;
        }
        knownArgs.forEach((arg) => {
            if (!arg?.argLoc?.osLoc || !arg?.argLoc?.jsonLoc) {
                return;
            }
            let isSecure = false;
            let fieldFound = false;
            const sortedLayers = [...teamConfig.layers].sort((a, b) => {
                if (a.user && !b.user) return -1;
                if (!a.user && b.user) return 1;
                return 0;
            });
            for (const layer of sortedLayers) {
                const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });
                if (this.layerHasField(layer, arg.argLoc.jsonLoc)) {
                    fieldFound = true;
                    isSecure = secFields.includes(arg.argLoc.jsonLoc);
                    break;
                }
            }
            if (!fieldFound) {
                for (const layer of teamConfig.layers) {
                    const secFields = teamConfig.api.secure.secureFields({ user: layer.user, global: layer.global });
                    if (secFields.includes(arg.argLoc.jsonLoc)) {
                        isSecure = true;
                        break;
                    }
                }
            }
            if (isSecure) {
                arg.secure = true;
            }
        });
    }
}
