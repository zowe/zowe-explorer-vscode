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
import { Configuration, PendingChangesMap, SchemaValidationsMap, ProfileSchemaEntry } from "../types";

interface WizardSchemaContext {
    selectedTab: number | null;
    configurations: Configuration[];
    schemaValidations: SchemaValidationsMap;
}

interface GetWizardTypeOptionsParams extends WizardSchemaContext {
    pendingChanges: PendingChangesMap;
}

export function getWizardTypeOptions(params: GetWizardTypeOptionsParams): string[] {
    const { selectedTab, configurations, schemaValidations, pendingChanges } = params;

    if (selectedTab === null) return [];

    const schemaTypes = schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [];
    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles || {});
    const profileTypes = new Set<string>();

    Object.values(flatProfiles).forEach((profile: Record<string, unknown>) => {
        if (profile?.type && typeof profile.type === "string" && (profile.type as string).trim() !== "") {
            profileTypes.add(profile.type as string);
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

interface GetWizardPropertyOptionsParams extends WizardSchemaContext {
    wizardSelectedType: string;
    wizardProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[];
}

export function getWizardPropertyOptions(params: GetWizardPropertyOptionsParams): string[] {
    const { selectedTab, configurations, schemaValidations, wizardSelectedType, wizardProperties } = params;

    if (selectedTab === null) return [];

    const allPropertyOptions = new Set<string>();
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        Object.keys(propertySchema[wizardSelectedType]).forEach((key) => allPropertyOptions.add(key));
    } else {
        Object.values(propertySchema).forEach((typeSchema: Record<string, ProfileSchemaEntry>) => {
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

interface GetWizardPropertyDescriptionsParams extends WizardSchemaContext {
    wizardSelectedType: string;
}

export function getWizardPropertyDescriptions(params: GetWizardPropertyDescriptionsParams): { [key: string]: string } {
    const { selectedTab, configurations, schemaValidations, wizardSelectedType } = params;

    if (selectedTab === null) return {};

    const propertyDescriptions: { [key: string]: string } = {};
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema || {};

    if (wizardSelectedType && propertySchema[wizardSelectedType]) {
        Object.entries(propertySchema[wizardSelectedType]).forEach(([key, schema]) => {
            if (schema && typeof schema === "object" && "description" in schema && schema.description) {
                propertyDescriptions[key] = schema.description;
            }
        });
    } else {
        Object.values(propertySchema).forEach((typeSchema: Record<string, ProfileSchemaEntry>) => {
            if (typeSchema && typeof typeSchema === "object") {
                Object.entries(typeSchema).forEach(([key, schema]) => {
                    if (schema && typeof schema === "object" && "description" in schema && schema.description && !propertyDescriptions[key]) {
                        propertyDescriptions[key] = schema.description;
                    }
                });
            }
        });
    }

    return propertyDescriptions;
}

interface GetPropertyTypeParams extends WizardSchemaContext {
    propertyKey: string;
    wizardSelectedType: string;
}

export function getPropertyType(params: GetPropertyTypeParams): string | undefined {
    const { propertyKey, selectedTab, configurations, schemaValidations, wizardSelectedType } = params;

    if (selectedTab === null) return undefined;
    if (!wizardSelectedType) return undefined;
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    return propertySchema[propertyKey]?.type;
}
