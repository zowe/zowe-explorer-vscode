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

import type { Config, IConfigLayer as ImperativeConfigLayer, ProfileInfo } from "@zowe/imperative";
import { ConfigMoveAPI, IConfigLayer } from "../webviews/src/config-editor/types";
import { updateDefaultsAfterRename } from "../webviews/src/config-editor/utils/moveUtils";
import { getEffectiveProfileKeys, resolveProfileDestination, resolveProfileKey } from "../webviews/src/config-editor/utils/profileConflicts";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigEditorPathUtils } from "./ConfigEditorPathUtils";
import type {
    LayerChangesPayload,
    ChangeEntry,
    NestedProfilesMap,
    PendingChangesByConfig,
    ProfileRenameEntry,
    ProfileTreeNode,
    RenameMapByConfig,
} from "./ConfigTypes";

export type ValidateProfileNameOptions = {
    profileName: string;
    rootProfile: string;
    configPath: string;
    profiles: NestedProfilesMap;
    pendingChanges: PendingChangesByConfig;
    renames: RenameMapByConfig;
};

export class ConfigEditorProfileOperations {
    /** Property names that must never appear as a profile segment (mirrors Imperative's UNSAFE_PROP_NAMES). */
    private static readonly RESERVED_PROFILE_SEGMENTS = ["__proto__", "constructor", "prototype"];

    /**
     * Validates if a profile name is available for creation
     */
    validateProfileName(options: ValidateProfileNameOptions): { isValid: boolean; message?: string } {
        const { profileName, rootProfile, configPath, profiles, pendingChanges, renames } = options;
        if (!profileName.trim()) {
            return { isValid: true };
        }

        // Enforce Imperative's own constraint here as well: the webview validates characters, but
        // drag-and-drop renames reach the config without passing through any UI validation.
        const unsafeSegment = profileName
            .trim()
            .split(".")
            .find((segment) => segment.length === 0 || ConfigEditorProfileOperations.RESERVED_PROFILE_SEGMENTS.includes(segment));
        if (unsafeSegment !== undefined) {
            return {
                isValid: false,
                message: "Profile names may not be empty, contain consecutive dots, or use the names __proto__, constructor, or prototype",
            };
        }

        const newProfileKey = rootProfile === "root" ? profileName.trim() : `${rootProfile}.${profileName.trim()}`;
        const result = resolveProfileDestination({
            proposedKey: newProfileKey,
            profileKeys: getEffectiveProfileKeys(
                Object.keys(ConfigUtils.flattenProfiles(profiles)),
                Object.values(pendingChanges[configPath] || {}).flatMap((entry) => (entry.profile ? [entry.profile] : [])),
                renames[configPath] || {}
            ),
            onConflict: "reject",
        });
        return result.status === "conflict" ? { isValid: false, message: result.message } : { isValid: true };
    }

    /**
     * Checks if a profile rename would create a circular reference
     */
    wouldCreateCircularReference(originalKey: string, newKey: string): boolean {
        if (!newKey.startsWith(originalKey + ".")) {
            return false;
        }
        const childPart = newKey.substring(originalKey.length + 1);
        if (childPart.includes(originalKey)) {
            return true;
        }

        const childParts = childPart.split(".");
        for (const part of childParts) {
            if (part === originalKey) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if a rename operation is creating a nested profile structure
     */
    isNestedProfileCreation(originalKey: string, newKey: string): boolean {
        // 1. The new key starts with the original key + "."
        // 2. The original key is a single-level profile (no dots)
        return newKey.startsWith(originalKey + ".") && !originalKey.includes(".");
    }

    /**
     * Creates a nested profile structure when renaming a profile to create a parent-child relationship
     */
    createNestedProfileStructure(
        configMoveAPI: ConfigMoveAPI,
        layerActive: () => IConfigLayer,
        originalPath: string,
        newPath: string,
        originalKey: string,
        newKey: string
    ): void {
        const originalProfile = configMoveAPI.get(originalPath);
        if (!originalProfile) {
            throw new Error(`Source profile not found at path: ${originalPath}`);
        }

        const childProfileName = newKey.substring(originalKey.length + 1);

        const newParentProfile = {
            ...originalProfile,
            profiles: {
                [childProfileName]: originalProfile,
            },
        };

        const childProfile = { ...originalProfile };
        delete childProfile.profiles;
        configMoveAPI.set(originalPath, newParentProfile);
        const childPath = `${originalPath}.profiles.${childProfileName}`;
        configMoveAPI.set(childPath, childProfile);

        this.moveSecurePropertiesForNestedProfile(configMoveAPI, originalPath, childPath);
    }

    /**
     * Moves secure properties for nested profile creation
     */
    private moveSecurePropertiesForNestedProfile(configMoveAPI: ConfigMoveAPI, parentPath: string, childPath: string): void {
        try {
            const originalProfile = configMoveAPI.get(parentPath);
            const secureProperties = originalProfile?.secure || [];

            if (secureProperties.length > 0) {
                const childProfile = configMoveAPI.get(childPath);
                // The child normally inherits this metadata from the copied profile. Setting an
                // existing array through the SDK appends the supplied value instead of replacing it.
                if (childProfile && !childProfile.secure?.length) {
                    configMoveAPI.set(`${childPath}.secure`, secureProperties);
                }

                const parentProfile = configMoveAPI.get(parentPath);
                if (parentProfile && parentProfile.secure) {
                    delete parentProfile.secure;
                    configMoveAPI.set(parentPath, parentProfile);
                }
            }
        } catch (error) {
            console.warn(`Failed to move secure properties for nested profile creation: ${error}`);
        }
    }

    /**
     * Redacts secure values from profile data
     */
    redactSecureValues(knownArgs: unknown): unknown {
        if (!knownArgs || typeof knownArgs !== "object") {
            return knownArgs;
        }

        // Handle array case
        if (Array.isArray(knownArgs)) {
            return knownArgs.map((item) => {
                if (item && typeof item === "object" && "secure" in item && item.secure === true) {
                    const redactedItem = { ...item };

                    if ("argValue" in redactedItem && redactedItem.argValue != null) {
                        redactedItem.argValue = "REDACTED";
                    } else if ("value" in redactedItem && redactedItem.value != null) {
                        redactedItem.value = "REDACTED";
                    }

                    return redactedItem;
                } else {
                    return this.redactSecureValues(item);
                }
            });
        }

        const redacted = { ...knownArgs };
        for (const [key, value] of Object.entries(redacted)) {
            if (value && typeof value === "object") {
                if ("secure" in value && value.secure === true) {
                    const redactedValue = { ...value };

                    if ("argValue" in redactedValue && redactedValue.argValue != null) {
                        redactedValue.argValue = "REDACTED";
                    } else if ("value" in redactedValue && redactedValue.value != null) {
                        redactedValue.value = "REDACTED";
                    }

                    redacted[key] = redactedValue;
                } else {
                    redacted[key] = this.redactSecureValues(value);
                }
            }
        }
        return redacted;
    }

    /** Validate independent identities and order moves before reusing their vacated paths. */
    prepareRenamesForProcessing(renames: ProfileRenameEntry[]): ProfileRenameEntry[] {
        const unique = new Map<string, ProfileRenameEntry>();
        const targets = new Map<string, ProfileRenameEntry>();
        for (const rename of renames) {
            const source = JSON.stringify([rename.configPath, rename.originalKey]);
            const target = JSON.stringify([rename.configPath, rename.newKey.toLowerCase()]);
            const priorSource = unique.get(source);
            const priorTarget = targets.get(target);
            if ((priorSource && priorSource.newKey !== rename.newKey) || (priorTarget && priorTarget.originalKey !== rename.originalKey)) {
                throw new Error(`Conflicting profile renames target '${rename.newKey}'`);
            }
            unique.set(source, rename);
            targets.set(target, rename);
        }
        const remaining = [...unique.values()].filter((rename) => rename.originalKey !== rename.newKey);
        const result: ProfileRenameEntry[] = [];
        const applied = new Map<string, Record<string, string>>();
        const dependsOn = (rename: ProfileRenameEntry, other: ProfileRenameEntry): boolean => {
            if (rename === other || rename.configPath !== other.configPath) return false;
            const childOfOther = rename.originalKey.startsWith(other.originalKey + ".");
            const otherChild = other.originalKey.startsWith(rename.originalKey + ".");
            // Extract a child first when it will become the moved parent's destination ancestor.
            if (otherChild) return rename.newKey.startsWith(other.newKey + ".");
            if (childOfOther) return !other.newKey.startsWith(rename.newKey + ".");
            // Vacate a saved source before another independent profile reuses its path.
            if (rename.newKey === other.originalKey || rename.newKey.startsWith(other.originalKey + ".")) return true;
            return rename.newKey.startsWith(other.newKey + ".");
        };
        while (remaining.length) {
            const index = remaining.findIndex((rename) => !remaining.some((other) => dependsOn(rename, other)));
            if (index === -1) throw new Error("Profile renames contain a circular dependency");
            const [rename] = remaining.splice(index, 1);
            const configRenames = applied.get(rename.configPath) || {};
            const originalKey = resolveProfileKey(rename.originalKey, configRenames);
            if (originalKey !== rename.newKey) result.push({ ...rename, originalKey });
            configRenames[rename.originalKey] = rename.newKey;
            applied.set(rename.configPath, configRenames);
        }
        return result;
    }

    /** Stage the entire rename batch before any configuration or credential writes. */
    public stageProfileRenames(renames: ProfileRenameEntry[], profInfo: ProfileInfo): void {
        for (const rename of this.prepareRenamesForProcessing(renames)) {
            this.stageSingleRename(rename, profInfo.getTeamConfig());
        }
    }

    private stageSingleRename(rename: ProfileRenameEntry, teamConfig: Config): void {
        const originalPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.originalKey);
        const newPath = ConfigEditorPathUtils.constructNestedProfilePath(rename.newKey);

        if (this.wouldCreateCircularReference(rename.originalKey, rename.newKey)) {
            throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Would create circular reference`);
        }

        const targetLayer = teamConfig.layers.find((layer: ImperativeConfigLayer) => layer.path === rename.configPath);

        if (!targetLayer) {
            throw new Error(`Configuration layer not found for path: ${rename.configPath}`);
        }

        teamConfig.api.layers.activate(targetLayer.user, targetLayer.global);

        const validationResult = this.validateProfileRename(teamConfig, originalPath, newPath, rename);
        if (validationResult.skip) {
            // Profile doesn't exist yet (newly created) - skip rename, changes will be redirected
            return;
        }

        if (this.isNestedProfileCreation(rename.originalKey, rename.newKey)) {
            this.createNestedProfileStructureDirectly(teamConfig, originalPath, newPath, rename.originalKey, rename.newKey);
        } else {
            this.moveProfileDirectly(teamConfig, originalPath, newPath);
        }

        this.updateDefaultsAfterRename(teamConfig, rename);
    }

    private getProfileFromTeamConfig(teamConfig: Config, path: string): ProfileTreeNode | null {
        const currentLayer = teamConfig.api.layers.get();
        const profiles = currentLayer.properties.profiles as NestedProfilesMap | undefined;
        const profileKey = path.replace("profiles.", "");
        return this.findNestedProfile(profileKey, profiles);
    }

    private moveProfileDirectly(teamConfig: Config, sourcePath: string, targetPath: string): void {
        const sourceProfile = this.getProfileFromTeamConfig(teamConfig, sourcePath);
        if (!sourceProfile) {
            throw new Error(`Source profile not found at path: ${sourcePath}`);
        }

        const targetProfile = this.getProfileFromTeamConfig(teamConfig, targetPath);
        if (targetProfile) {
            throw new Error(`Target profile already exists at path: ${targetPath}`);
        }

        teamConfig.set(targetPath, sourceProfile as unknown, { parseString: true });
        teamConfig.delete(sourcePath);
    }

    private createTeamConfigAdapter(teamConfig: Config): ConfigMoveAPI {
        return {
            get: (path: string) => this.getProfileFromTeamConfig(teamConfig, path),
            set: (path: string, value: unknown) => teamConfig.set(path, value, { parseString: true }),
            delete: (path: string) => teamConfig.delete(path),
        };
    }

    private createNestedProfileStructureDirectly(
        teamConfig: Config,
        originalPath: string,
        newPath: string,
        originalKey: string,
        newKey: string
    ): void {
        const configAdapter = this.createTeamConfigAdapter(teamConfig);
        const layerActive = (): { properties: { profiles: NestedProfilesMap } } => ({
            properties: {
                profiles: teamConfig.api.layers.get().properties.profiles as NestedProfilesMap,
            },
        });
        this.createNestedProfileStructure(configAdapter, layerActive, originalPath, newPath, originalKey, newKey);
    }

    private findNestedProfile(key: string, profilesObj: NestedProfilesMap | ProfileTreeNode | null | undefined): ProfileTreeNode | null {
        const parts = key.split(".");
        let current: unknown = profilesObj;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part === "profiles") {
                continue;
            }

            const cur = current as Record<string, unknown>;
            if (!cur || cur[part] === undefined) {
                return null;
            }
            current = cur[part];

            if (i === parts.length - 1) {
                return current as ProfileTreeNode;
            }

            if (current && typeof current === "object" && current !== null && "profiles" in current) {
                current = (current as ProfileTreeNode).profiles;
            } else if (i < parts.length - 1) {
                return null;
            }
        }
        return current as ProfileTreeNode | null;
    }

    private validateProfileRename(
        teamConfig: Config,
        originalPath: string,
        newPath: string,
        rename: { originalKey: string; newKey: string }
    ): { skip: boolean } {
        const originalProfile = this.getProfileFromTeamConfig(teamConfig, originalPath);
        if (!originalProfile) {
            // Profile doesn't exist in config - this is likely a newly created profile
            // that hasn't been saved yet. Skip the rename operation; the pending changes
            // will be redirected to the new location by updateProfileChangesForRenames.
            return { skip: true };
        }

        const sourceKey = rename.originalKey.toLowerCase();
        const targetKey = rename.newKey.toLowerCase();
        const keys = Object.keys(ConfigUtils.flattenProfiles(teamConfig.api.layers.get().properties.profiles));
        const existingTargetProfile = keys.some(
            (key) =>
                key !== rename.originalKey &&
                (key.toLowerCase() === targetKey || key.toLowerCase().startsWith(targetKey + ".")) &&
                !(sourceKey === targetKey && key.startsWith(rename.originalKey + ".")) &&
                !(targetKey.startsWith(sourceKey + ".") && key.startsWith(rename.originalKey + "."))
        );
        if (existingTargetProfile) {
            throw new Error(`Cannot rename profile '${rename.originalKey}' to '${rename.newKey}': Profile '${rename.newKey}' already exists`);
        }

        return { skip: false };
    }

    private updateDefaultsAfterRename(teamConfig: Config, rename: { originalKey: string; newKey: string }): void {
        updateDefaultsAfterRename(
            () => teamConfig.api.layers.get(),
            rename.originalKey,
            rename.newKey,
            (updatedDefaults) => teamConfig.set("defaults", updatedDefaults, { parseString: true })
        );
    }

    /**
     * Updates profile changes to use new profile names before processing
     * This prevents duplicate profiles by ensuring changes target the correct names
     */
    public updateProfileChangesForRenames(message: LayerChangesPayload, renames: ProfileRenameEntry[]): LayerChangesPayload {
        if (message.profilePathsAreEffective || !renames || renames.length === 0) {
            return message;
        }

        const mapsByConfig = new Map<string, Map<string, { oldKey: string; newKey: string; configPath: string }>>();
        for (const rename of renames) {
            let map = mapsByConfig.get(rename.configPath);
            if (!map) {
                map = new Map();
                mapsByConfig.set(rename.configPath, map);
            }
            map.set(rename.originalKey, { oldKey: rename.originalKey, newKey: rename.newKey, configPath: rename.configPath });
        }
        const update = (change: ChangeEntry): ChangeEntry => {
            const map = mapsByConfig.get(change.configPath);
            if (!map) {
                return change;
            }
            const updated = {
                ...change,
                ...(change.profile && { profile: ConfigEditorPathUtils.getNewProfilePath(change.profile, change.configPath, map) }),
            };
            return ConfigEditorPathUtils.updateChangePath(
                ConfigEditorPathUtils.updateChangeKey(updated, change.configPath, map),
                change.configPath,
                map
            ) as ChangeEntry;
        };
        return {
            ...message,
            ...(message.changes && { changes: message.changes.map(update) }),
            ...(message.deletions && { deletions: message.deletions.map(update) }),
        };
    }

    /**
     * Simulates a batch of profile renames against an in-memory team config (no disk writes),
     * used to compute merged/effective properties as if the renames had already been applied.
     */
    simulateProfileRenames(renames: ProfileRenameEntry[], teamConfig: Config): void {
        if (!renames || renames.length === 0) {
            return;
        }

        if (!teamConfig) {
            console.warn("Cannot simulate profile renames: teamConfig is null or undefined");
            return;
        }

        for (const rename of this.prepareRenamesForProcessing(renames)) {
            try {
                this.stageSingleRename(rename, teamConfig);
            } catch {
                // An incomplete draft can fail validation; previews keep processing other renames.
                continue;
            }
        }
    }
}
