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

import { getRelevantPropertySchemas, collectSchemaPropertyKeys, collectSchemaPropertyDescriptions } from "./schemaProperties";
import { extractProfileKeyFromPath, flattenProfiles } from "./configUtils";
import { getProfileType } from "./profileUtils";
import { SchemaContext, FullConfigContext, RenamesMap, DeletionsMap, SchemaValidationsMap, MergedPropertiesMap } from "../types";

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

    const propertySchema = schemaValidations[configPath]?.propertySchema || {};
    const preferredSchema = resolvedType ? propertySchema[resolvedType] : undefined;
    const fallbackSchemas = getRelevantPropertySchemas(propertySchema, null);
    return collectSchemaPropertyDescriptions(preferredSchema ? [preferredSchema, ...fallbackSchemas] : fallbackSchemas);
}

interface IsPropertyPendingDeletionParams {
    propertyKey: string;
    path: string[];
    configPath: string;
    deletions: DeletionsMap;
    renames: RenamesMap;
}

export function isPropertyPendingDeletion(params: IsPropertyPendingDeletionParams): boolean {
    const { propertyKey, path, configPath, deletions } = params;

    if (path.length === 0 || path[path.length - 1] !== "properties") {
        return false;
    }

    const deletionsList = deletions[configPath] ?? [];
    const currentFullKey = [...path, propertyKey].join(".");
    if (deletionsList.includes(currentFullKey)) {
        return true;
    }

    return false;
}

interface FetchAllPropertyKeysParams extends SchemaContext {
    path: string[];
}

export function fetchAllPropertyKeys(params: FetchAllPropertyKeysParams): string[] {
    const { path, selectedTab, configurations, schemaValidations, pendingChanges, renames } = params;

    if (selectedTab === null || !configurations[selectedTab]) return [];

    const { configPath } = configurations[selectedTab]!;
    const profileKey = extractProfileKeyFromPath(path);
    const resolvedType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });

    const propertySchema = schemaValidations[configPath]?.propertySchema || {};
    return collectSchemaPropertyKeys(getRelevantPropertySchemas(propertySchema, resolvedType));
}

export function fetchExistingPropertyKeys(params: FullConfigContext & { path: string[] }): string[] {
    const { path, selectedTab, configurations, pendingChanges, renames, deletions } = params;
    if (selectedTab === null || !configurations[selectedTab]) return [];

    const { configPath } = configurations[selectedTab]!;
    const profileKey = extractProfileKeyFromPath(path);

    const existingProperties = new Set<string>();

    const config = configurations[selectedTab].properties;
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

    return Array.from(existingProperties);
}

export function fetchInheritedPropertyKeys(params: { mergedProperties?: MergedPropertiesMap | null; existingProperties?: string[] }): string[] {
    const { mergedProperties, existingProperties = [] } = params;
    if (!mergedProperties) return [];

    const existingSet = new Set(existingProperties);
    const inheritedKeys: string[] = [];

    Object.keys(mergedProperties).forEach((key) => {
        if (key !== "type" && key !== "name" && !existingSet.has(key)) {
            inheritedKeys.push(key);
        }
    });

    return inheritedKeys;
}

interface FetchTypeOptionsParams extends FullConfigContext {
    path: string[];
    schemaValidations: SchemaValidationsMap;
    mergedProperties?: MergedPropertiesMap | null;
}

export function fetchTypeOptions(params: FetchTypeOptionsParams): string[] {
    const allPropertyKeys = fetchAllPropertyKeys(params);
    const existingProperties = new Set(fetchExistingPropertyKeys(params));
    const inheritedProperties = new Set(
        fetchInheritedPropertyKeys({
            mergedProperties: params.mergedProperties,
            existingProperties: Array.from(existingProperties),
        })
    );
    return allPropertyKeys.filter((key) => !existingProperties.has(key) && !inheritedProperties.has(key));
}

export interface ValidateProfilePropertyKeyParams extends FullConfigContext {
    path: string[];
    propertyKey: string;
    isEditingExisting?: boolean;
    mergedProperties?: MergedPropertiesMap | null;
}

export interface PropertyKeyValidationResult {
    isValid: boolean;
    error?: string;
    warning?: string;
}

export function validateProfilePropertyKey(params: ValidateProfilePropertyKeyParams): PropertyKeyValidationResult {
    const { propertyKey, isEditingExisting = false, mergedProperties } = params;
    const trimmedKey = propertyKey.trim();

    if (!trimmedKey) {
        return { isValid: false };
    }

    const existingProperties = fetchExistingPropertyKeys(params);
    if (existingProperties.includes(trimmedKey)) {
        if (isEditingExisting) {
            return { isValid: true };
        }
        return {
            isValid: false,
            error: "Property key already exists",
        };
    }

    const inheritedProperties = fetchInheritedPropertyKeys({
        mergedProperties,
        existingProperties,
    });
    if (inheritedProperties.includes(trimmedKey)) {
        if (isEditingExisting) {
            return { isValid: true };
        }
        return {
            isValid: false,
            error: "Inherited property, change from the parent",
        };
    }

    const allPropertyKeys = fetchAllPropertyKeys(params);
    if (allPropertyKeys.includes(trimmedKey)) {
        return { isValid: true };
    }

    if (allPropertyKeys.length > 0) {
        return {
            isValid: true,
            warning: "Property is not defined in the schema for this profile",
        };
    }

    return { isValid: true };
}

export function isFileProperty(key: string): boolean {
    if (!key || typeof key !== "string") return false;
    const filePaths = ["privatekey", "certfile", "certkeyfile"];
    return filePaths.includes(key.toLowerCase());
}
