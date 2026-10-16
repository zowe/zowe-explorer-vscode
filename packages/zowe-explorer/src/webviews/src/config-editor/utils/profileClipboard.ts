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

import { flattenProfiles, profileKeyToPath } from "./configUtils";
import { getOriginalProfileKeyWithNested, getRenamedProfileKeyWithNested, isPropertySecure, mergePendingChangesForProfile } from "./profileUtils";
import type { ClipboardProfile, ConfigStateContext, PendingChange, PendingChangesMap, PendingDefaultsMap, ProfileClipboard } from "../types";

interface CollectClipboardProfilesParams extends ConfigStateContext {
    profileKey: string;
    profileKeys: string[];
    pendingProfiles: Record<string, unknown>;
    getProfileType: (profileKey: string) => string | null;
}

/** Snapshot the selected profile and descendants, including pending values and secure flags. */
export function collectClipboardProfiles(params: CollectClipboardProfilesParams): ProfileClipboard["profiles"] {
    const { profileKey, profileKeys, pendingProfiles, getProfileType, selectedTab, configurations, pendingChanges, renames } = params;
    const config = selectedTab === null ? undefined : configurations[selectedTab];
    if (!config) return {};

    const flatProfiles = flattenProfiles(config.properties?.profiles || {});
    const allKeys = new Set(
        [...profileKeys, ...Object.keys(flatProfiles), ...Object.keys(pendingProfiles)].map((key) =>
            getRenamedProfileKeyWithNested(key, config.configPath, renames)
        )
    );
    const profiles: ProfileClipboard["profiles"] = {};
    for (const key of allKeys) {
        if (key !== profileKey && !key.startsWith(profileKey + ".")) continue;
        const profilePath = profileKeyToPath(key);
        const originalKey = getOriginalProfileKeyWithNested(key, config.configPath, renames);
        const baseProfile = flatProfiles[originalKey] || {};
        // Merging nested pending values must not mutate the saved configuration or an earlier clipboard.
        const properties = mergePendingChangesForProfile({
            baseObj: structuredClone((baseProfile.properties as Record<string, unknown>) || {}),
            path: [...profilePath, "properties"],
            configPath: config.configPath,
            pendingChanges,
            renames,
        }) as ClipboardProfile["properties"];
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
            Object.entries(baseProfile).filter(([field]) => !["properties", "profiles", "type", "secure"].includes(field))
        ) as ClipboardProfile["customFields"];
        const secureSources: NonNullable<ClipboardProfile["secureSources"]> = {};
        // Existing credentials are absent from the webview's redacted properties.
        for (const propertyKey of (baseProfile.secure as string[] | undefined) ?? []) {
            if (Object.prototype.hasOwnProperty.call(properties, propertyKey)) continue;
            properties[propertyKey] = "";
            secure.push(propertyKey);
            secureSources[propertyKey] = { configPath: config.configPath, profileKey: originalKey, propertyKey };
        }
        for (const entry of Object.values(pendingChanges[config.configPath] ?? {})) {
            if (entry.profile === key && entry.secureSource) {
                secureSources[entry.path[entry.path.length - 1]] = entry.secureSource;
            }
        }
        profiles[key] = { profileKey: key, type: getProfileType(key), properties, secure, customFields, secureSources };
    }
    return structuredClone(profiles);
}

export function getUniqueProfileKey(proposedKey: string, existingKeys: string[]): string {
    const keys = new Set(existingKeys);
    let result = proposedKey;
    for (let suffix = 1; keys.has(result); suffix++) result = `${proposedKey}_${suffix}`;
    return result;
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
            Object.entries(sourceChanges).filter(
                ([, entry]) => entry.profile !== clipboard.sourceKey && !entry.profile.startsWith(clipboard.sourceKey + ".")
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
