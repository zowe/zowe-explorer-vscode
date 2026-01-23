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
import { Configuration, PendingChange, schemaValidation } from "../types";

/**
 * Gets available profile type options from schema and existing profiles.
 */
export function getWizardTypeOptions(
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } }
): string[] {
    if (selectedTab === null) return [];

    const schemaTypes = schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [];
    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles || {});
    const profileTypes = new Set<string>();

    Object.values(flatProfiles).forEach((profile: any) => {
        if (profile?.type && typeof profile.type === "string" && profile.type.trim() !== "") {
            profileTypes.add(profile.type);
        }
    });

    const configPath = configurations[selectedTab].configPath;
    Object.entries(pendingChanges[configPath] || {}).forEach(([key, entry]) => {
        const keyParts = key.split(".");
        if (
            keyParts[keyParts.length - 1] === "type" &&
            !keyParts.includes("properties") &&
            typeof entry.value === "string" &&
            entry.value.trim() !== ""
        ) {
            profileTypes.add(entry.value);
        }
    });

    const allTypes = new Set([...schemaTypes, ...Array.from(profileTypes)]);
    return Array.from(allTypes).sort((a, b) => a.localeCompare(b));
}

/**
 * Gets available property options for the wizard based on selected type.
 */
export function getWizardPropertyOptions(
    selectedTab: number | null,
    configurations: Configuration[],
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    wizardSelectedType: string,
    wizardProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[]
): string[] {
    if (selectedTab === null) return [];

    const allPropertyOptions = new Set<string>();
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        Object.keys(propertySchema[wizardSelectedType]).forEach((key) => allPropertyOptions.add(key));
    } else {
        Object.values(propertySchema).forEach((typeSchema: any) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.keys(typeSchema).forEach((key) => allPropertyOptions.add(key));
            }
        });
    }

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
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    wizardSelectedType: string
): { [key: string]: string } {
    if (selectedTab === null) return {};

    const propertyDescriptions: { [key: string]: string } = {};
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        Object.entries(propertySchema[wizardSelectedType]).forEach(([key, schema]) => {
            if (schema && typeof schema === "object" && "description" in schema && schema.description) {
                propertyDescriptions[key] = schema.description as string;
            }
        });
    } else {
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
    schemaValidations: { [configPath: string]: schemaValidation | undefined },
    wizardSelectedType: string
): string | undefined {
    if (selectedTab === null) return undefined;
    if (!wizardSelectedType) return undefined;
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    return propertySchema[propertyKey]?.type;
}
