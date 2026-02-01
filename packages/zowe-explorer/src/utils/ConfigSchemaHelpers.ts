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

import * as fs from "fs";

export type schemaValidation = {
    propertySchema: Record<string, Record<string, { type?: string; description?: string; default?: any; secure?: boolean }>>;
    validDefaults: string[];
};

export class ConfigSchemaHelpers {
    /**
     * Generates schema validation information from a JSON schema
     * @param schema - The JSON schema object
     * @returns Schema validation object with property schemas and valid defaults
     */
    public static generateSchemaValidation(schema: any): schemaValidation {
        const propertySchema: Record<string, Record<string, { type?: string; description?: string; default?: any; secure?: boolean }>> = {};
        const allOf = schema.properties.profiles.patternProperties["^\\S*$"].allOf;

        for (const rule of allOf) {
            const profileType = rule?.if?.properties?.type?.const;
            const properties = rule?.then?.properties?.properties?.properties;
            const secureProperties = rule?.then?.properties?.secure?.items?.enum || [];

            if (profileType && properties) {
                propertySchema[profileType] = Object.keys(properties).reduce((acc, key) => {
                    const typeValue = properties[key].type;
                    const resolvedType = !typeValue ? undefined : Array.isArray(typeValue) ? typeValue[0] : typeValue;

                    acc[key] = {
                        type: resolvedType,
                        description: properties[key].description,
                        default: properties[key].default,
                        secure: secureProperties.includes(key),
                    };
                    return acc;
                }, {} as Record<string, { type?: string; description?: string; default?: any; secure?: boolean }>);
            }
        }

        return {
            validDefaults: Object.keys(schema.properties.defaults.properties) ?? undefined,
            propertySchema,
        };
    }

    /**
     * Helper function that takes a schema path and returns a map of all properties
     * that are inside profile properties, where the key is the property name and the value is the type.
     * Only checks properties inside profile properties, not top-level properties.
     *
     * @param schemaPath - Path to the JSON schema file
     * @returns Map of profile properties with their types and paths
     */
    public static getProfileProperties(schemaPath: string): Map<string, { type: string | string[]; path: string; description?: string }> {
        const result = new Map<string, { type: string | string[]; path: string; description?: string }>();

        try {
            // Read and parse the schema file
            const schemaContent = fs.readFileSync(schemaPath, "utf8");
            const schema = JSON.parse(schemaContent);

            if (schema.properties && schema.properties.profiles) {
                this.processSchemaRecursive(schema.properties.profiles, "", result, {
                    profileContext: true,
                    processItems: false,
                });
            }

            return result;
        } catch (error) {
            console.error(`Error reading schema file: ${error}`);
            return new Map();
        }
    }

    private static processSchemaRecursive(
        schema: any,
        currentPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>,
        options: { profileContext: boolean; processItems: boolean }
    ): void {
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const propPath = currentPath ? `${currentPath}.${propName}` : propName;
                this.processProperty(propName, propSchema as any, propPath, result, options);
            }
        }

        if (schema.patternProperties) {
            for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
                const propPath = currentPath ? `${currentPath}[${pattern}]` : `[${pattern}]`;
                this.processProperty(pattern, propSchema as any, propPath, result, options);
            }
        }

        if (schema.allOf) {
            for (const condition of schema.allOf) {
                if (condition.then) {
                    this.processSchemaRecursive(condition.then, currentPath, result, options);
                }
            }
        }

        if (options.processItems && schema.items) {
            this.processSchemaRecursive(schema.items, `${currentPath}[]`, result, options);
        }
    }

    private static processProperty(
        propName: string,
        propSchema: any,
        propPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>,
        options: { profileContext: boolean; processItems: boolean }
    ): void {
        if (propSchema.type) {
            const type = propSchema.type;
            const { include, resolvedType } = this.shouldIncludeType(type, options.profileContext);

            if (include) {
                result.set(propName, {
                    type: resolvedType,
                    path: propPath,
                    description: propSchema.description,
                });
            }
        }

        if (propSchema.properties || propSchema.patternProperties || propSchema.allOf || propSchema.items) {
            this.processSchemaRecursive(propSchema, propPath, result, options);
        }
    }

    private static shouldIncludeType(
        type: string | string[],
        profileContext: boolean
    ): { include: boolean; resolvedType: string | string[] } {
        if (typeof type === "string") {
            const include = profileContext ? type !== "string" && type !== "object" : type !== "string";
            return { include, resolvedType: type };
        }
        const nonStringTypes = type.filter((t: string) => t !== "string");
        const include = profileContext ? !type.includes("string") : nonStringTypes.length > 0;
        const resolvedType = profileContext ? type : nonStringTypes;
        return { include, resolvedType };
    }

    public static processSchemaProperties(
        schema: any,
        currentPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>
    ): void {
        this.processSchemaRecursive(schema, currentPath, result, { profileContext: false, processItems: true });
    }
}
