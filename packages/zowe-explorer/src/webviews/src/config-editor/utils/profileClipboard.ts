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

import { resolveProfileDestination } from "./profileConflicts";
import { flattenProfiles, profileKeyToPath } from "./configUtils";
import {
    getOriginalProfileKeyWithNested,
    getRenamedProfileKeyWithNested,
    isProfileOrParentDeleted,
    isPropertySecure,
    mergePendingChangesForProfile,
} from "./profileUtils";
import type {
    ClipboardProfile,
    ConfigStateContext,
    DeletionsMap,
    PendingChange,
    PendingChangesMap,
    PendingDefaultsMap,
    ProfileClipboard,
} from "../types";

interface CollectClipboardProfilesParams extends ConfigStateContext {
    profileKey: string;
    profileKeys?: string[];
    pendingProfiles: Record<string, unknown>;
    getProfileType: (profileKey: string) => string | null;
    deletions?: DeletionsMap;
}

function deleteProfileField(profile: Record<string, unknown>, field: string): void {
    const parts = field.split(".");
    let parent = profile;
    for (const part of parts.slice(0, -1)) {
        if (!parent[part] || typeof parent[part] !== "object") return;
        parent = parent[part] as Record<string, unknown>;
    }
    delete parent[parts[parts.length - 1]];
}

/** Snapshot the selected profile and descendants, including pending values and secure flags. */
export function collectClipboardProfiles(params: CollectClipboardProfilesParams): ProfileClipboard["profiles"] {
    const { profileKey, pendingProfiles, getProfileType, selectedTab, configurations, pendingChanges, renames, deletions = {} } = params;
    const config = selectedTab === null ? undefined : configurations[selectedTab];
    if (!config) return {};

    const flatProfiles = flattenProfiles(config.properties?.profiles || {});
    const allKeys = new Set(
        Object.keys(flatProfiles)
            .map((key) => getRenamedProfileKeyWithNested(key, config.configPath, renames))
            .concat(Object.keys(pendingProfiles))
    );
    const profiles: ProfileClipboard["profiles"] = {};
    for (const key of allKeys) {
        if (key !== profileKey && !key.startsWith(profileKey + ".")) continue;
        const profilePath = profileKeyToPath(key);
        const originalKey = getOriginalProfileKeyWithNested(key, config.configPath, renames);
        if (isProfileOrParentDeleted(key, deletions, config.configPath)) continue;
        const baseProfile = getRenamedProfileKeyWithNested(originalKey, config.configPath, renames) === key ? flatProfiles[originalKey] || {} : {};
        const profile = mergePendingChangesForProfile({
            baseObj: structuredClone(baseProfile),
            path: profilePath,
            configPath: config.configPath,
            pendingChanges,
            renames,
        });
        const deletedFields = (deletions[config.configPath] ?? []).flatMap((deletedKey) => {
            const prefix = [key, originalKey]
                .map((profileKey) => profileKeyToPath(profileKey).join(".") + ".")
                .find((prefix) => deletedKey.startsWith(prefix));
            return prefix ? [deletedKey.slice(prefix.length)] : [];
        });
        for (const field of deletedFields) {
            deleteProfileField(profile, field);
        }
        // Merging nested pending values must not mutate the saved configuration or an earlier clipboard.
        const properties = (profile.properties ?? {}) as ClipboardProfile["properties"];
        const secure = Object.keys(properties).filter((propertyKey) =>
            isPropertySecure({
                fullKey: [...profilePath, "properties", propertyKey].join("."),
                displayKey: propertyKey,
                path: [...profilePath, "properties", propertyKey],
                selectedTab,
                configurations,
                pendingChanges,
                renames,
            })
        );
        const customFields = Object.fromEntries(
            Object.entries(profile).filter(([field]) => !["properties", "profiles", "type", "secure"].includes(field))
        ) as ClipboardProfile["customFields"];
        const secureSources: NonNullable<ClipboardProfile["secureSources"]> = {};
        // Existing credentials are absent from the webview's redacted properties.
        for (const propertyKey of (profile.secure as string[] | undefined) ?? []) {
            if (deletedFields.includes("properties") || deletedFields.includes(`properties.${propertyKey}`)) continue;
            if (Object.prototype.hasOwnProperty.call(properties, propertyKey)) continue;
            properties[propertyKey] = "";
            secure.push(propertyKey);
            secureSources[propertyKey] = { configPath: config.configPath, profileKey: originalKey, propertyKey };
        }
        for (const entry of Object.values(pendingChanges[config.configPath] ?? {})) {
            if (entry.profile === key && entry.secureSource && Object.prototype.hasOwnProperty.call(properties, entry.path[entry.path.length - 1])) {
                secureSources[entry.path[entry.path.length - 1]] = entry.secureSource;
            }
        }
        profiles[key] = {
            profileKey: key,
            type: deletedFields.includes("type") ? null : getProfileType(key),
            properties,
            secure,
            customFields,
            secureSources,
        };
    }
    return structuredClone(profiles);
}

export function getUniqueProfileKey(proposedKey: string, existingKeys: string[]): string {
    const result = resolveProfileDestination({ proposedKey, profileKeys: existingKeys, onConflict: "suffix" });
    if (result.status === "conflict") throw new Error(result.message);
    return result.key;
}

/** Rebase a clipboard subtree into the pending-change shape used by save and merge requests. */
export function buildClipboardChanges(
    profiles: ProfileClipboard["profiles"],
    sourceKey: string,
    destinationKey: string
): Record<string, PendingChange> {
    const changes: Record<string, PendingChange> = {};
    for (const [key, profile] of Object.entries(profiles)) {
        const newKey = destinationKey + key.substring(sourceKey.length);
        const path = profileKeyToPath(newKey);
        const addField = (field: string, value: PendingChange["value"]) => {
            changes[[...path, field].join(".")] = { value: structuredClone(value), path: [field], profile: newKey };
        };
        // Create every node, including untyped empty grouping profiles and descendants.
        addField("properties", {});
        if (profile.type) addField("type", profile.type);
        for (const [propertyKey, value] of Object.entries(profile.properties)) {
            changes[[...path, "properties", propertyKey].join(".")] = {
                value: structuredClone(value),
                path: [propertyKey],
                profile: newKey,
                secure: profile.secure.includes(propertyKey),
                ...(profile.secureSources?.[propertyKey] ? { secureSource: profile.secureSources[propertyKey] } : {}),
            };
        }
        if (profile.secure.length > 0) addField("secure", profile.secure);
        for (const [field, value] of Object.entries(profile.customFields)) addField(field, value);
    }
    return changes;
}

export function removeCutProfileChanges(changes: PendingChangesMap, clipboard: ProfileClipboard): PendingChangesMap {
    const sourceChanges = changes[clipboard.configPath];
    if (!sourceChanges) return changes;
    return {
        ...changes,
        [clipboard.configPath]: Object.fromEntries(
            Object.entries(sourceChanges).filter(([, entry]) =>
                [clipboard.sourceKey, clipboard.originalKey]
                    .filter(Boolean)
                    .every((key) => entry.profile !== key && !entry.profile.startsWith(key + "."))
            )
        ),
    };
}

export function clearCutProfileDefaults(
    defaults: PendingDefaultsMap,
    savedDefaults: Record<string, unknown>,
    clipboard: ProfileClipboard
): PendingDefaultsMap {
    const sourceDefaults = { ...defaults[clipboard.configPath] };
    let changed = false;
    const values = [
        ...Object.entries(sourceDefaults).map(([key, entry]) => [key, entry.value]),
        ...Object.entries(savedDefaults).map(([key, value]) => [key, String(value)]),
    ];
    for (const [type, value] of values) {
        if ((value === clipboard.sourceKey || value.startsWith(clipboard.sourceKey + ".")) && sourceDefaults[type]?.value !== "") {
            sourceDefaults[type] = { value: "", path: [type] };
            changed = true;
        }
    }
    return changed ? { ...defaults, [clipboard.configPath]: sourceDefaults } : defaults;
}
