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

import { flattenProfiles } from "./configUtils";

interface Configuration {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
}

interface PendingChange {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
}

interface SchemaValidation {
    propertySchema: { [key: string]: any };
    validDefaults: string[];
}

/**
 * Gets available profile type options from schema and existing profiles.
 */
export function getWizardTypeOptions(
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: SchemaValidation | undefined },
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }
): string[] {
    if (selectedTab === null) return [];

    // Get types from schema
    const schemaTypes = schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [];

    // Get unique types from existing profiles
    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles || {});
    const profileTypes = new Set<string>();

    // Extract types from all profiles
    Object.values(flatProfiles).forEach((profile: any) => {
        if (profile?.type && typeof profile.type === "string") {
            profileTypes.add(profile.type);
        }
    });

    // Also check pending changes for types
    const configPath = configurations[selectedTab].configPath;
    Object.entries(pendingChanges[configPath] || {}).forEach(([key, entry]) => {
        if (key.endsWith(".type") && typeof entry.value === "string") {
            profileTypes.add(entry.value);
        }
    });

    // Combine schema types and profile types, removing duplicates
    const allTypes = new Set([...schemaTypes, ...Array.from(profileTypes)]);

    // Return as sorted array
    return Array.from(allTypes).sort((a, b) => a.localeCompare(b));
}

/**
 * Gets available property options for the wizard based on selected type.
 */
export function getWizardPropertyOptions(
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: SchemaValidation | undefined },
    wizardSelectedType: string,
    wizardProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[]
): string[] {
    if (selectedTab === null) return [];

    // Get all available property schemas from all profile types
    const allPropertyOptions = new Set<string>();
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    // If a specific type is selected, get properties from that type
    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        Object.keys(propertySchema[wizardSelectedType]).forEach((key) => allPropertyOptions.add(key));
    } else {
        // If no type is selected, get properties from all available types
        Object.values(propertySchema).forEach((typeSchema: any) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.keys(typeSchema).forEach((key) => allPropertyOptions.add(key));
            }
        });
    }

    // Filter out properties that are already added
    const usedKeys = new Set(wizardProperties.map((prop) => prop.key));
    return Array.from(allPropertyOptions)
        .filter((option) => !usedKeys.has(option))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Gets property descriptions from schema for the wizard.
 */
export function getWizardPropertyDescriptions(
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: SchemaValidation | undefined },
    wizardSelectedType: string
): { [key: string]: string } {
    if (selectedTab === null) return {};

    // Get property descriptions from schema validation
    const propertyDescriptions: { [key: string]: string } = {};
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        // If a specific type is selected, get descriptions from that type
        Object.entries(propertySchema[wizardSelectedType]).forEach(([key, schema]) => {
            if (schema && typeof schema === "object" && "description" in schema && schema.description) {
                propertyDescriptions[key] = schema.description as string;
            }
        });
    } else {
        // If no type is selected, get descriptions from all available types
        Object.values(propertySchema).forEach((typeSchema: any) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.entries(typeSchema).forEach(([key, schema]: [string, any]) => {
                    if (schema && typeof schema === "object" && "description" in schema && schema.description && !propertyDescriptions[key]) {
                        propertyDescriptions[key] = schema.description as string;
                    }
                });
            }
        });
    }

    return propertyDescriptions;
}

/**
 * Gets the property type from schema for a given property key.
 */
export function getPropertyType(
    propertyKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: SchemaValidation | undefined },
    wizardSelectedType: string
): string | undefined {
    if (selectedTab === null) return undefined;
    if (!wizardSelectedType) return undefined;
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    return propertySchema[propertyKey]?.type;
}
