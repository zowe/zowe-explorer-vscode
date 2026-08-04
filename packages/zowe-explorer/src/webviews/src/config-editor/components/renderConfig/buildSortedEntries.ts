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

import { cloneDeep } from "es-toolkit";
import {
    flattenProfiles,
    extractProfileKeyFromPath,
    sortConfigEntries,
    getProfileType,
    getOriginalProfileKeyWithNested,
    getRenamedProfileKeyWithNested,
    getNestedProperty,
} from "../../utils";
import { isPropertyPendingDeletion as isPropertyPendingDeletionFn } from "../../utils/propertyUtils";
import type { RenderConfigCtx } from "./context";

/**
 * Build the combined config object (base + pending changes + merged/inherited + synthesized
 * secure entries) for a node and return its entries in the currently-selected sort order.
 *
 * Extracted verbatim from the former monolithic `renderConfig`; `combinedConfig` is returned
 * so the caller can still filter secure properties out of the `properties` sub-object.
 */
export function buildSortedEntries(
    ctx: RenderConfigCtx,
    obj: any,
    path: string[],
    mergedProps: any,
    configPath: string
): { combinedConfig: any; sortedEntries: [string, any][] } {
    const {
        configurations,
        selectedTab,
        pendingChanges,
        deletions,
        renames,
        schemaValidations,
        selectedProfileKey,
        showMergedProperties,
        propertySortOrder,
        mergePendingChangesForProfile,
        mergeMergedProperties,
        ensureProfileProperties,
        isCurrentProfileUntyped,
        isPropertyFromMergedProps,
    } = ctx;

    const baseObj = cloneDeep(obj);

    let combinedConfig = mergePendingChangesForProfile(baseObj, path, configPath);

    const originalProperties = baseObj.properties || {};

    if (showMergedProperties !== "hide" && mergedProps && !isCurrentProfileUntyped()) {
        combinedConfig = mergeMergedProperties(combinedConfig, path, mergedProps, configPath);
    }

    combinedConfig = ensureProfileProperties(combinedConfig, path);

    let sortedEntries: [string, any][];

    const isPropertyDeletedConsideringRenames = (propertyKey: string) =>
        isPropertyPendingDeletionFn({ propertyKey, path, configPath, deletions, renames });

    if (path.length > 0 && path[path.length - 1] === "properties") {
        const lockedSortOrder = propertySortOrder;

        const localSortProperties = (entries: [string, any][]): [string, any][] => {
            if (lockedSortOrder === "alphabetical") {
                return [...entries].sort(([a], [b]) => a.localeCompare(b));
            } else if (lockedSortOrder === "merged-first") {
                return [...entries].sort(([a], [b]) => {
                    const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
                    const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

                    if (aIsMerged && !bIsMerged) return -1;
                    if (!aIsMerged && bIsMerged) return 1;

                    return a.localeCompare(b);
                });
            } else if (lockedSortOrder === "non-merged-first") {
                return [...entries].sort(([a], [b]) => {
                    const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
                    const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

                    if (!aIsMerged && bIsMerged) return -1;
                    if (aIsMerged && !bIsMerged) return 1;

                    return a.localeCompare(b);
                });
            } else {
                return [...entries].sort(([a], [b]) => a.localeCompare(b));
            }
        };

        const filteredCombinedConfig = { ...combinedConfig };

        Object.keys(filteredCombinedConfig).forEach((key) => {
            const isDeleted = isPropertyDeletedConsideringRenames(key);

            if (isDeleted) {
                delete filteredCombinedConfig[key];
            }
        });

        const entriesForSorting = Object.entries(filteredCombinedConfig);

        const currentProfileKeyForDisk = extractProfileKeyFromPath(path);
        const originalProfileKeyForDisk = getOriginalProfileKeyWithNested(currentProfileKeyForDisk, configPath, renames);

        const originalPartsForDisk = originalProfileKeyForDisk.split(".");
        const parentConfigPath = ["profiles"];
        for (let i = 0; i < originalPartsForDisk.length; i++) {
            if (i > 0) parentConfigPath.push("profiles");
            parentConfigPath.push(originalPartsForDisk[i]);
        }
        const parentConfig = getNestedProperty(configurations[selectedTab!]?.properties, parentConfigPath) as Record<string, unknown> | undefined;
        const parentSecure = parentConfig?.secure;
        if (parentSecure && Array.isArray(parentSecure)) {
            parentSecure.forEach((securePropertyName: string) => {
                if (!combinedConfig.hasOwnProperty(securePropertyName)) {
                    entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
                }
            });
        }

        if (!parentSecure || (Array.isArray(parentSecure) && parentSecure.length === 0)) {
            const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
            const currentProfile = flatProfiles[originalProfileKeyForDisk];
            if (currentProfile?.secure && Array.isArray(currentProfile.secure)) {
                currentProfile.secure.forEach((securePropertyName: string) => {
                    if (
                        !combinedConfig.hasOwnProperty(securePropertyName) &&
                        !entriesForSorting.some(([existingKey]) => existingKey === securePropertyName)
                    ) {
                        entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
                    }
                });
            }
        }

        const currentProfileKeyForSecure = extractProfileKeyFromPath(path);
        const originalProfileKeyForSecure = getOriginalProfileKeyWithNested(currentProfileKeyForSecure, configPath, renames);
        const renamedProfileKeyForSecure = getRenamedProfileKeyWithNested(originalProfileKeyForSecure, configPath, renames);

        if (configPath && currentProfileKeyForSecure) {
            Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
                const entryProfile = entry.profile;
                const matches =
                    entryProfile === currentProfileKeyForSecure ||
                    entryProfile === originalProfileKeyForSecure ||
                    entryProfile === renamedProfileKeyForSecure;

                if (matches && entry.secure) {
                    const keyParts = key.split(".");
                    const propertyName = keyParts[keyParts.length - 1];
                    if (!combinedConfig.hasOwnProperty(propertyName) && !entriesForSorting.some(([existingKey]) => existingKey === propertyName)) {
                        entriesForSorting.push([propertyName, { _isSecureProperty: true }]);
                    }
                }
            });
        }

        if (mergedProps && showMergedProperties !== "hide" && selectedProfileKey) {
            const currentProfileKey = extractProfileKeyFromPath(path);
            const profileType = getProfileType({ profileKey: currentProfileKey, selectedTab, configurations, pendingChanges, renames });
            const propertySchema = profileType ? schemaValidations[configPath]?.propertySchema[profileType] || {} : {};
            const allowedProperties = Object.keys(propertySchema);

            Object.entries(mergedProps).forEach(([propertyName, propData]: [string, any]) => {
                const isAllowedBySchema = !profileType || allowedProperties.includes(propertyName);
                const isInDeletions = isPropertyDeletedConsideringRenames(propertyName);
                const alreadyInEntries = entriesForSorting.some(([existingKey]) => existingKey === propertyName);
                const wasInOriginal = originalProperties?.hasOwnProperty(propertyName);

                const shouldAdd = !alreadyInEntries && isAllowedBySchema && (!wasInOriginal || isInDeletions);

                if (shouldAdd) {
                    entriesForSorting.push([
                        propertyName,
                        {
                            _isMergedProperty: true,
                            _mergedValue: propData.value,
                            _mergedData: propData,
                        },
                    ]);
                }
            });
        }

        sortedEntries = localSortProperties(entriesForSorting);
    } else {
        sortedEntries = sortConfigEntries(Object.entries(combinedConfig));
    }

    return { combinedConfig, sortedEntries };
}
