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

import { extractProfileKeyFromPath, flattenProfiles } from "./configUtils";
import { getProfileType, getOriginalProfileKeyWithNested } from "./profileUtils";
import { SchemaContext, FullConfigContext, RenamesMap, DeletionsMap, SchemaValidationsMap, ProfileSchemaEntry } from "../types";

interface PropertyTypeFromSchemaParams {
    propertyKey: string;
    profileType: string | null;
    configPath: string;
    schemaValidations: SchemaValidationsMap;
}

function getPropertyTypeFromSchema(params: PropertyTypeFromSchemaParams): string | undefined {
    const { propertyKey, profileType, configPath, schemaValidations } = params;

    if (profileType) {
        const propertySchema = schemaValidations[configPath]?.propertySchema[profileType] || {};
        return propertySchema[propertyKey]?.type;
    }

    const validation = schemaValidations[configPath];
    if (validation?.propertySchema) {
        for (const type in validation.propertySchema) {
            const propertySchema = validation.propertySchema[type];
            if (propertySchema[propertyKey]?.type) {
                return propertySchema[propertyKey].type;
            }
        }
    }

    return undefined;
}

interface GetPropertyTypeForAddProfileParams extends SchemaContext {
    propertyKey: string;
    selectedProfileKey: string | null;
}

export function getPropertyTypeForAddProfile(params: GetPropertyTypeForAddProfileParams): string | undefined {
    const { propertyKey, selectedTab, configurations, selectedProfileKey, schemaValidations, pendingChanges, renames } = params;

    if (selectedTab === null) return undefined;

    const configPath = configurations[selectedTab].configPath;
    const currentProfileType = selectedProfileKey
        ? getProfileType({ profileKey: selectedProfileKey, selectedTab, configurations, pendingChanges, renames })
        : null;

    return getPropertyTypeFromSchema({ propertyKey, profileType: currentProfileType, configPath, schemaValidations });
}

interface GetPropertyTypeForConfigEditorParams extends SchemaContext {
    propertyKey: string;
    profilePath: string[];
}

export function getPropertyTypeForConfigEditor(params: GetPropertyTypeForConfigEditorParams): string | undefined {
    const { propertyKey, profilePath, selectedTab, configurations, schemaValidations, pendingChanges, renames } = params;

    if (selectedTab === null) return undefined;

    const configPath = configurations[selectedTab].configPath;
    const profileKey = extractProfileKeyFromPath(profilePath);
    const resolvedType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });

    return getPropertyTypeFromSchema({ propertyKey, profileType: resolvedType, configPath, schemaValidations });
}

interface GetPropertyDescriptionsParams extends SchemaContext {
    path: string[];
}

export function getPropertyDescriptions(params: GetPropertyDescriptionsParams): { [key: string]: string } {
    const { path, selectedTab, configurations, schemaValidations, pendingChanges, renames } = params;

    const { configPath } = configurations[selectedTab!]!;
    const profileKey = extractProfileKeyFromPath(path);
    const resolvedType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });

    const propertyDescriptions: { [key: string]: string } = {};
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
        Object.entries(propertySchema[resolvedType]).forEach(([key, schema]) => {
            if (schema && typeof schema === "object" && "description" in schema && schema.description) {
                propertyDescriptions[key] = schema.description;
            }
        });
    }

    Object.values(propertySchema).forEach((typeSchema: Record<string, ProfileSchemaEntry>) => {
        if (typeSchema && typeof typeSchema === "object") {
            Object.entries(typeSchema).forEach(([key, schema]) => {
                if (schema && typeof schema === "object" && "description" in schema && schema.description && !propertyDescriptions[key]) {
                    propertyDescriptions[key] = schema.description;
                }
            });
        }
    });

    return propertyDescriptions;
}

interface IsPropertyPendingDeletionParams {
    propertyKey: string;
    path: string[];
    configPath: string;
    deletions: DeletionsMap;
    renames: RenamesMap;
}

export function isPropertyPendingDeletion(params: IsPropertyPendingDeletionParams): boolean {
    const { propertyKey, path, configPath, deletions, renames } = params;

    if (path.length === 0 || path[path.length - 1] !== "properties") {
        return false;
    }

    const deletionsList = deletions[configPath] ?? [];
    const currentFullKey = [...path, propertyKey].join(".");
    if (deletionsList.includes(currentFullKey)) {
        return true;
    }

    const currentProfileKey = extractProfileKeyFromPath(path);
    const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);
    if (originalProfileKey === currentProfileKey) {
        return false;
    }

    const currentParts = currentProfileKey.split(".");
    const suffixIndex = 2 * currentParts.length;
    const suffix = path.slice(suffixIndex);

    const originalParts = originalProfileKey.split(".");
    const originalPathPrefix = ["profiles"];
    for (let i = 0; i < originalParts.length; i++) {
        if (i > 0) originalPathPrefix.push("profiles");
        originalPathPrefix.push(originalParts[i]);
    }

    const originalFullKey = [...originalPathPrefix, ...suffix, propertyKey].join(".");
    return deletionsList.includes(originalFullKey);
}

interface FetchTypeOptionsParams extends FullConfigContext {
    path: string[];
    schemaValidations: SchemaValidationsMap;
}

export function fetchTypeOptions(params: FetchTypeOptionsParams): string[] {
    const { path, selectedTab, configurations, schemaValidations, pendingChanges, renames, deletions } = params;

    const { configPath } = configurations[selectedTab!]!;
    const profileKey = extractProfileKeyFromPath(path);
    const resolvedType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });

    const allPropertyKeys = new Set<string>();
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
        Object.keys(propertySchema[resolvedType]).forEach((key) => allPropertyKeys.add(key));
    } else {
        Object.values(propertySchema).forEach((typeSchema: Record<string, ProfileSchemaEntry>) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.keys(typeSchema).forEach((key) => allPropertyKeys.add(key));
            }
        });
    }

    const existingProperties = new Set<string>();

    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const currentProfile = flatProfiles[profileKey];
    if (currentProfile && currentProfile.properties) {
        Object.keys(currentProfile.properties).forEach((key) => existingProperties.add(key));
    }

    if (currentProfile && currentProfile.secure && Array.isArray(currentProfile.secure)) {
        currentProfile.secure.forEach((key: string) => existingProperties.add(key));
    }

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
        if (entry.profile === profileKey) {
            const keyParts = key.split(".");
            if (keyParts.includes("properties")) {
                const propertyName = keyParts[keyParts.length - 1];
                existingProperties.add(propertyName);
            }
            if (entry.secure) {
                const propertyName = keyParts[keyParts.length - 1];
                existingProperties.add(propertyName);
            }
        }
    });

    Array.from(existingProperties).forEach((propName) => {
        if (isPropertyPendingDeletion({ propertyKey: propName, path, configPath, deletions, renames })) {
            existingProperties.delete(propName);
        }
    });

    return Array.from(allPropertyKeys).filter((key) => !existingProperties.has(key));
}

export function isFileProperty(key: string): boolean {
    if (!key || typeof key !== "string") return false;
    const filePaths = ["privatekey", "certfile", "certkeyfile"];
    return filePaths.includes(key.toLowerCase());
}
