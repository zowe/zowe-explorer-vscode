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

import { profileKeyToPath } from "../utils/configUtils";
import { mapProfilePath } from "../utils/profilePaths";
import { getEffectiveProfileKeys, planProfileRename, rebaseProfileKey, resolveProfileDestination } from "../utils/profileConflicts";
import { getRenamedProfileKeyWithNested, getOriginalProfileKeyWithNested } from "../utils/profileUtils";
import { flattenProfiles } from "../utils";

// Types
import type { PendingChange } from "../types";
import type { ProfileHandlerContext } from "../store/profileActions";

/** All draft references use effective paths; only the rename map retains saved identities. */
export const handleRenameProfile = (currentKey: string, newKey: string, _isDragDrop: boolean = false, props: ProfileHandlerContext): boolean => {
    const { selectedTab, configurations, renames, pendingChanges, extractPendingProfiles } = props;
    const config = selectedTab === null ? undefined : configurations[selectedTab];
    if (!config) return false;
    const configPath = config.configPath;
    const savedKeys = Object.keys(flattenProfiles(config.properties.profiles));
    const currentRenames = renames[configPath] || {};
    const originalKey = getOriginalProfileKeyWithNested(currentKey, configPath, renames);
    const pendingProfiles = extractPendingProfiles(configPath);
    const profileKeys = getEffectiveProfileKeys(savedKeys, Object.keys(pendingProfiles), currentRenames);
    const destination = resolveProfileDestination({ proposedKey: newKey, sourceKey: currentKey, profileKeys, onConflict: "reject" });
    if (destination.status === "conflict") {
        props.vscodeApi.postMessage({ command: "SHOW_ERROR_MESSAGE", message: destination.message });
        return false;
    }
    if (destination.status === "noop") {
        props.setRenameProfileModalOpen(false);
        return true;
    }
    if (!profileKeys.includes(currentKey)) return false;
    const rebase = (key: string) => rebaseProfileKey(key, currentKey, newKey);
    // Pending-only profiles are moved by rebasing their changes, without inventing a saved source.
    const updatedRenames =
        savedKeys.includes(originalKey) && getRenamedProfileKeyWithNested(originalKey, configPath, renames) === currentKey
            ? planProfileRename(currentRenames, originalKey, currentKey, newKey)
            : Object.fromEntries(Object.entries(currentRenames).map(([key, target]) => [key, rebase(target)]));
    props.setRenames((prev) => {
        const next = { ...prev };
        if (Object.keys(updatedRenames).length) next[configPath] = updatedRenames;
        else delete next[configPath];
        return next;
    });
    if (props.selectedProfileKey) props.setSelectedProfileKey(rebase(props.selectedProfileKey));
    props.setSortOrderVersion((prev) => prev + 1);
    props.setSelectedProfilesByConfig((prev) => {
        const selected = prev[configPath];
        return { ...prev, [configPath]: selected ? rebase(selected) : newKey };
    });
    props.setExpandedNodesByConfig((prev) => {
        const expanded = new Set([...(prev[configPath] || [])].map(rebase));
        const parts = newKey.split(".");
        for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join("."));
        return { ...prev, [configPath]: expanded };
    });
    props.setPendingDefaults((prev) => {
        const defaults = { ...prev[configPath] };
        for (const [type, entry] of Object.entries(defaults)) defaults[type] = { ...entry, value: rebase(entry.value) };
        for (const [type, value] of Object.entries(config.properties.defaults || {})) {
            if (prev[configPath]?.[type] || typeof value !== "string") continue;
            const effective = getRenamedProfileKeyWithNested(value, configPath, renames);
            if (rebase(effective) !== effective) defaults[type] = { value: rebase(effective), path: [type] };
        }
        for (const [type, entry] of Object.entries(defaults)) {
            if (entry.value === config.properties.defaults?.[type]) delete defaults[type];
        }
        const next = { ...prev };
        if (Object.keys(defaults).length) next[configPath] = defaults;
        else delete next[configPath];
        return next;
    });
    const changes: Record<string, PendingChange> = {};
    for (const [key, entry] of Object.entries(pendingChanges[configPath] || {})) {
        changes[mapProfilePath(key, rebase)] = { ...entry, profile: rebase(entry.profile), path: mapProfilePath(entry.path, rebase) };
    }
    // Materialize only missing ancestors, using the effective namespace rather than saved names.
    const parts = newKey.split(".");
    for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(0, i).join(".");
        if (profileKeys.map(rebase).includes(parent)) continue;
        changes[profileKeyToPath(parent).join(".")] = { value: {}, path: [], profile: parent, secure: false };
    }
    props.setPendingChanges((prev) => {
        const next = { ...prev };
        if (Object.keys(changes).length) next[configPath] = changes;
        else delete next[configPath];
        return next;
    });
    props.setDeletions((prev) => ({ ...prev, [configPath]: (prev[configPath] || []).map((key) => mapProfilePath(key, rebase)) }));
    props.setProfileClipboard((clipboard) =>
        clipboard?.type === "cut" && clipboard.configPath === configPath ? { ...clipboard, sourceKey: rebase(clipboard.sourceKey) } : clipboard
    );
    props.setRenameProfileModalOpen(false);
    return true;
};

export const handleDeleteProfile = (profileKey: string, props: ProfileHandlerContext): void => {
    const {
        selectedTab,
        configurations,
        selectedProfileKey,
        setDeletions,
        setPendingChanges,
        setSelectedProfileKey,
        setSelectedProfilesByConfig,
        setPendingDefaults,
    } = props;

    if (selectedTab === null || !configurations[selectedTab]) return;
    const configPath = configurations[selectedTab].configPath;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = profileKey;

    // Construct the full profile path using the effective profile key
    const fullProfilePath = profileKeyToPath(effectiveProfileKey).join(".");

    // Add to deletions - we'll add all profile-related keys to deletions
    setDeletions((prev) => {
        const newDeletions = { ...prev };
        newDeletions[configPath] = [...(prev[configPath] ?? [])];

        // Add the full profile path to deletions
        newDeletions[configPath].push(fullProfilePath);

        return newDeletions;
    });

    // Clear any pending changes for this profile (using both original and effective keys)
    setPendingChanges((prev) => {
        const newState = { ...prev };
        if (newState[configPath]) {
            newState[configPath] = { ...prev[configPath] };
            // Remove all pending changes that belong to this profile
            Object.keys(newState[configPath]).forEach((key) => {
                const entry = newState[configPath][key];
                if (entry.profile === profileKey || entry.profile === effectiveProfileKey) {
                    delete newState[configPath][key];
                }
            });
        }
        return newState;
    });

    // Remove the deleted profile from defaults if it's set as a default
    const config = configurations[selectedTab].properties;
    const defaults = config.defaults || {};

    const profilesToCheck = [profileKey, effectiveProfileKey];

    // Check if the deleted profile is a default for any profile type
    setPendingDefaults((prev) => {
        const updatedDefaults = { ...prev[configPath] };
        let hasChanges = false;

        Object.entries(updatedDefaults).forEach(([profileType, defaultEntry]) => {
            // Check if this default matches the deleted profile or is a child of it
            if (profilesToCheck.includes(defaultEntry.value) || profilesToCheck.some((p) => defaultEntry.value.startsWith(p + "."))) {
                updatedDefaults[profileType] = { value: "", path: [profileType] };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedDefaults,
            };
        }
        return prev;
    });

    // Check configuration defaults and set to empty string if the deleted profile is a default
    setPendingDefaults((prev) => {
        const updatedDefaults = { ...prev[configPath] };
        let hasChanges = false;

        Object.entries(defaults).forEach(([profileType, defaultProfileName]) => {
            const defaultProfileNameStr = String(defaultProfileName);

            if (profilesToCheck.includes(defaultProfileNameStr) || profilesToCheck.some((p) => defaultProfileNameStr.startsWith(p + "."))) {
                updatedDefaults[profileType] = { value: "", path: [profileType] };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            return {
                ...prev,
                [configPath]: updatedDefaults,
            };
        }
        return prev;
    });

    // If this profile is currently selected, or if the selected profile is a child of this
    // profile, clear the selection instead of jumping to another profile the user didn't ask for.
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
        setSelectedProfileKey(null);

        // Also update the stored profiles for this config
        if (configPath) {
            setSelectedProfilesByConfig((prev) => ({
                ...prev,
                [configPath]: null,
            }));
        }
    }
};

/**
 * Handle navigation to source profile
 */
export const handleNavigateToSource = (props: ProfileHandlerContext) => {
    const { configurations, setSelectedTab, setSelectedProfileKey } = props;

    return (jsonLoc: string, osLoc?: string[]) => {
        const parts = jsonLoc.split(".");

        if (parts.length >= 3 && parts[0] === "profiles") {
            // Find the source profile by looking for the profile name in the path
            // Handle both simple cases (profiles.ssh.port) and nested cases (profiles.ssh.profiles.parent.port)
            let sourceProfile = "";
            let sourceProfilePath = "";

            // Look for the profile name in the path
            for (let i = 1; i < parts.length - 1; i++) {
                if (parts[i + 1] === "profiles") {
                    // This is a nested profile structure
                    // For nested profiles, we need to construct the full profile path
                    // e.g., "profiles.zosmf.profiles.a.profiles.b.properties.port" should navigate to "zosmf.a.b"
                    const parentProfile = parts[i];
                    let nestedProfilePath = [parentProfile];
                    // Start after the first "profiles"
                    let pathIndex = i + 2;

                    // Continue building the nested profile path until we hit a non-profile part
                    while (pathIndex < parts.length - 1 && parts[pathIndex + 1] === "profiles") {
                        nestedProfilePath.push(parts[pathIndex]); // Add the profile name
                        pathIndex += 2; // Skip the "profiles" part
                    }

                    // Add the final profile name if we haven't reached the end
                    if (pathIndex < parts.length) {
                        nestedProfilePath.push(parts[pathIndex]);
                    }

                    sourceProfile = nestedProfilePath.join("."); // e.g., "zosmf.a.b"
                    sourceProfilePath = parts.slice(1, pathIndex + 1).join("."); // e.g., "zosmf.profiles.a.profiles.b"
                    break;
                } else if (i === 1) {
                    // Simple case: profiles.ssh.port
                    sourceProfile = parts[i];
                    sourceProfilePath = parts[i];
                }
            }

            if (sourceProfile) {
                // Find the configuration that contains this profile
                let sourceConfigIndex = -1;

                // If osLoc is provided and indicates a different config, use it to find the correct config
                if (osLoc && osLoc.length > 0) {
                    const osLocString = osLoc.join("");
                    sourceConfigIndex = configurations.findIndex((config) => {
                        return config.configPath === osLocString;
                    });
                }

                // If we couldn't find the config using osLoc, or if osLoc wasn't provided,
                // search through all configurations
                if (sourceConfigIndex === -1) {
                    for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
                        const config = configurations[configIndex];
                        const configProfiles = config.properties?.profiles;

                        if (!configProfiles) {
                            continue;
                        }

                        // Check if this config contains the source profile
                        let profileExists = false;

                        if (sourceProfilePath.includes(".")) {
                            // Nested profile case - we need to check if the nested profile exists
                            const pathParts = sourceProfilePath.split(".");

                            let current = configProfiles;
                            for (const part of pathParts) {
                                if (current && current[part]) {
                                    current = current[part];
                                } else {
                                    current = null;
                                    break;
                                }
                            }
                            profileExists = current !== null;
                        } else {
                            // Simple profile case
                            profileExists = configProfiles.hasOwnProperty(sourceProfile);
                        }

                        if (profileExists) {
                            sourceConfigIndex = configIndex;
                            break;
                        }
                    }
                }

                if (sourceConfigIndex !== -1) {
                    // React batches these into a single update, so the tab and profile change together
                    // in one render instead of needing to be sequenced across ticks.
                    setSelectedTab(sourceConfigIndex);
                    setSelectedProfileKey(sourceProfile);
                }
            }
        }
    };
};

export const handleProfileSelection = (profileKey: string, props: ProfileHandlerContext): void => {
    const { selectedTab, configurations, setSelectedProfileKey, setSelectedProfilesByConfig } = props;

    if (profileKey === "") {
        // Deselect profile
        setSelectedProfileKey(null);
        // Don't clear merged properties - they will be updated when a new profile is selected
        return;
    }

    setSelectedProfileKey(profileKey);

    // Store the selected profile for this configuration
    const configPath = configurations[selectedTab!]?.configPath;
    if (configPath) {
        setSelectedProfilesByConfig((prev) => ({
            ...prev,
            [configPath]: profileKey,
        }));
    }
};
