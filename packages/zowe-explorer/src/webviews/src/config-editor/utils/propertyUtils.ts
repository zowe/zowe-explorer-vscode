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
import { getProfileType } from "./profileUtils";
import { PendingChange, Configuration, schemaValidation } from "../types";

/**
 * Internal helper to get property type from schema based on profile type.
 * Centralizes the common logic used by both getPropertyTypeForAddProfile and getPropertyTypeForConfigEditor.
 */
function getPropertyTypeFromSchema(
    propertyKey: string,
    profileType: string | null,
    configPath: string,
    schemaValidations: { [configPath: string]: schemaValidation | undefined }
): string | undefined {
    if (profileType) {
        const propertySchema = schemaValidations[configPath]?.propertySchema[profileType] || {};
        return propertySchema[propertyKey]?.type;
    }

    const schemaValidation = schemaValidations[configPath];
    if (schemaValidation?.propertySchema) {
        for (const type in schemaValidation.propertySchema) {
            const propertySchema = schemaValidation.propertySchema[type];
            if (propertySchema[propertyKey]?.type) {
                return propertySchema[propertyKey].type;
            }
        }
    }

    return undefined;
}

export function getPropertyTypeForAddProfile(
    propertyKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    selectedProfileKey: string | null,
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | undefined {
    if (selectedTab === null) return undefined;

    const configPath = configurations[selectedTab].configPath;
    const currentProfileType = selectedProfileKey ? getProfileTypeFn(selectedProfileKey, selectedTab, configurations, pendingChanges, renames) : null;

    return getPropertyTypeFromSchema(propertyKey, currentProfileType, configPath, schemaValidations);
}

export function getPropertyTypeForConfigEditor(
    propertyKey: string,
    profilePath: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string | undefined {
    if (selectedTab === null) return undefined;

    const configPath = configurations[selectedTab].configPath;
    const profileKey = extractProfileKeyFromPath(profilePath);
    const resolvedType = getProfileTypeFn(profileKey, selectedTab, configurations, pendingChanges, renames);

    return getPropertyTypeFromSchema(propertyKey, resolvedType, configPath, schemaValidations);
}

export function getPropertyDescriptions(
    path: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): { [key: string]: string } {
    const { configPath } = configurations[selectedTab!]!;
    const profileKey = extractProfileKeyFromPath(path);
    const resolvedType = getProfileTypeFn(profileKey, selectedTab, configurations, pendingChanges, renames);

    const propertyDescriptions: { [key: string]: string } = {};
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
        Object.entries(propertySchema[resolvedType]).forEach(([key, schema]) => {
            if (schema && typeof schema === "object" && "description" in schema && schema.description) {
                propertyDescriptions[key] = schema.description as string;
            }
        });
    }

    Object.values(propertySchema).forEach((typeSchema: any) => {
        if (typeSchema && typeof typeSchema === "object") {
            Object.entries(typeSchema).forEach(([key, schema]: [string, any]) => {
                if (schema && typeof schema === "object" && "description" in schema && schema.description && !propertyDescriptions[key]) {
                    propertyDescriptions[key] = schema.description as string;
                }
            });
        }
    });

    return propertyDescriptions;
}

export function fetchTypeOptions(
    path: string[],
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    getProfileTypeFn: typeof getProfileType,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [originalKey: string]: string } }
): string[] {
    const { configPath } = configurations[selectedTab!]!;
    const profileKey = extractProfileKeyFromPath(path);
    const resolvedType = getProfileTypeFn(profileKey, selectedTab, configurations, pendingChanges, renames);

    const allPropertyKeys = new Set<string>();
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
        Object.keys(propertySchema[resolvedType]).forEach((key) => allPropertyKeys.add(key));
    } else {
        Object.values(propertySchema).forEach((typeSchema: any) => {
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

    const deletedProperties = new Set<string>();

    deletedProperties.forEach((deletedProperty) => {
        existingProperties.delete(deletedProperty);
    });

    return Array.from(allPropertyKeys).filter((key) => !existingProperties.has(key));
}

/**
 * Determines if a property key represents a file path property
 * @param key - The property key to check
 * @returns true if the key represents a file path property, false otherwise
 */
export function isFileProperty(key: string): boolean {
    if (!key || typeof key !== "string") return false;
    const filePaths = ["privatekey", "certfile", "certkeyfile"];
    return filePaths.includes(key.toLowerCase());
}
