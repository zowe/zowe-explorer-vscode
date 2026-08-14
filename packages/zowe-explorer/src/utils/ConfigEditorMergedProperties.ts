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
            renames && renames.length > 0 ? await this.profileOperations.updateProfileChangesForRenames(changes, renames) : changes;

        const parsedInput: LayerModifications =
            renames && renames.length > 0
                ? {
                      configPath: effectiveChanges.configPath,
                      changes: effectiveChanges.changes ?? [],
                      deletions: effectiveChanges.deletions ?? [],
                      defaultsChanges: effectiveChanges.defaultsChanges ?? [],
                      defaultsDeleteKeys: effectiveChanges.defaultsDeleteKeys ?? [],
                  }
                : (effectiveChanges as LayerModifications);

        const parsedChanges = ConfigUtils.parseConfigChanges(parsedInput);
        for (const change of parsedChanges) {
            if (change.defaultsChanges || change.defaultsDeleteKeys) {
                await ConfigChangeHandlers.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath, teamConfig);
            }

            if (change.changes || change.deletions) {
                await ConfigChangeHandlers.handleProfileChanges(change.changes, change.deletions, change.configPath, undefined, teamConfig);
            }
        }

        const allProfiles = profInfo.getAllProfiles();

        // After simulateProfileRenames, the profile data has been moved to the new location
        // So we need to look for the profile using the new name (after rename simulation)
        let profileNameToLookup = profPath;

        // Apply renames to get the current effective profile name
        if (renames && Array.isArray(renames)) {
            const configRenames = renames.filter((r) => r.configPath === configPath);

            // Apply renames iteratively until no more changes
            let changed = true;
            while (changed) {
                changed = false;

                for (const rename of configRenames) {
                    // Check for exact match
                    if (profileNameToLookup === rename.originalKey) {
                        profileNameToLookup = rename.newKey;
                        changed = true;
                        break;
                    }

                    // Check for partial matches (parent renames affecting children)
                    if (profileNameToLookup.startsWith(rename.originalKey + ".")) {
                        profileNameToLookup = profileNameToLookup.replace(rename.originalKey + ".", rename.newKey + ".");
                        changed = true;
                        break;
                    }
                }
            }
        }

        // Look for the profile using the original name first
        // The allProfiles array contains profiles from the original configuration
        let profile = allProfiles.find((prof) => prof.profName === profPath && prof.profLoc.osLoc?.includes(path.normalize(configPath)));

        // If not found with original name, try with the current effective name
        if (!profile && profileNameToLookup !== profPath) {
            profile = allProfiles.find((prof) => prof.profName === profileNameToLookup && prof.profLoc.osLoc?.includes(path.normalize(configPath)));
        }

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
            const normalized: LayerModifications = {
                configPath: changes.configPath,
                changes: changes.changes ?? [],
                deletions: changes.deletions ?? [],
                defaultsChanges: changes.defaultsChanges ?? [],
                defaultsDeleteKeys: changes.defaultsDeleteKeys ?? [],
            };
            const parsedChanges = ConfigUtils.parseConfigChanges(normalized);
            for (const change of parsedChanges) {
                if (change.defaultsChanges || change.defaultsDeleteKeys) {
                    await ConfigChangeHandlers.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath, teamConfig);
                }
                if (change.changes || change.deletions) {
                    await ConfigChangeHandlers.handleProfileChanges(change.changes, change.deletions, change.configPath, undefined, teamConfig);
                }
            }
        }

        if (configPath !== teamConfig.api.layers.get().path) {
            const findProfile = teamConfig.layers.find((prof: IConfigLayer) => prof.path === configPath);
            if (findProfile) {
                teamConfig.api.layers.activate(findProfile.user, findProfile.global);
            }
        }

        let actualRootProfile = rootProfile;
        if (renames && Array.isArray(renames)) {
            for (const rename of renames) {
                if (rename.configPath === configPath) {
                    if (rootProfile === rename.originalKey) {
                        actualRootProfile = rename.newKey;
                        break;
                    } else if (rootProfile.startsWith(rename.originalKey + ".")) {
                        actualRootProfile = rootProfile.replace(rename.originalKey + ".", rename.newKey + ".");
                        break;
                    }
                }
            }
        }

        const tempProfileName = profileName || `temp_${Date.now()}`;
        let tempProfilePath: string;
        let expectedProfileName: string;

        if (actualRootProfile === "root") {
            tempProfilePath = `profiles.${tempProfileName}`;
            expectedProfileName = tempProfileName;
        } else {
            const profileParts = actualRootProfile.split(".");
            const pathParts = ["profiles"];

            for (const part of profileParts) {
                pathParts.push(part);
                pathParts.push("profiles");
            }

            pathParts.push(tempProfileName);
            tempProfilePath = pathParts.join(".");
            expectedProfileName = `${actualRootProfile}.${tempProfileName}`;
        }

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
