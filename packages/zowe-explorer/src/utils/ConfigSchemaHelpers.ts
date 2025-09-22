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
     * Helper function to extract the type from a schema property
     * If the type is an array, use the first value in the array
     * @param typeValue - The type value from the schema (string or string array)
     * @returns The resolved type as a string
     */
    public static resolveSchemaType(typeValue: string | string[] | undefined): string | undefined {
        if (!typeValue) {
            return undefined;
        }

        if (Array.isArray(typeValue)) {
            return typeValue[0];
        }

        return typeValue;
    }

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
                    acc[key] = {
                        type: this.resolveSchemaType(properties[key].type),
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

            // Only process profile properties, not top-level properties
            if (schema.properties && schema.properties.profiles) {
                this.processProfileProperties(schema.properties.profiles, "", result);
            }

            return result;
        } catch (error) {
            console.error(`Error reading schema file: ${error}`);
            return new Map();
        }
    }

    /**
     * Recursively processes profile properties to find non-string types
     * Only processes properties inside profile definitions, not top-level properties
     */
    private static processProfileProperties(
        schema: any,
        currentPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>
    ): void {
        // Handle pattern properties (for profile definitions like "^\\S*$")
        if (schema.patternProperties) {
            for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
                // For pattern properties, we'll use the pattern as the key
                const propPath = currentPath ? `${currentPath}[${pattern}]` : `[${pattern}]`;
                this.processProfileProperty(pattern, propSchema as any, propPath, result);
            }
        }

        // Handle allOf conditions (common in JSON Schema for profile type definitions)
        if (schema.allOf) {
            for (const condition of schema.allOf) {
                if (condition.then) {
                    this.processProfileProperties(condition.then, currentPath, result);
                }
            }
        }

        // Handle properties directly (for when we're inside the then.properties.properties path)
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const propPath = currentPath ? `${currentPath}.${propName}` : propName;
                this.processProfileProperty(propName, propSchema as any, propPath, result);
            }
        }
    }

    /**
     * Processes a single profile property to check its type
     * Focuses only on properties inside profile definitions
     */
    private static processProfileProperty(
        propName: string,
        propSchema: any,
        propPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>
    ): void {
        // Check if the property has a type
        if (propSchema.type) {
            const type = propSchema.type;

            // Only include non-string and non-object properties
            if (typeof type === "string") {
                if (type !== "string" && type !== "object") {
                    result.set(propName, {
                        type,
                        path: propPath,
                        description: propSchema.description,
                    });
                }
            } else if (Array.isArray(type)) {
                // Handle union types (array of types) - only include if array doesn't include "string"modify
                if (!type.includes("string")) {
                    result.set(propName, {
                        type,
                        path: propPath,
                        description: propSchema.description,
                    });
                }
            }
        }

        // Recursively process nested properties, but only within profile context
        if (propSchema.properties || propSchema.patternProperties || propSchema.allOf || propSchema.items) {
            this.processProfileProperties(propSchema, propPath, result);
        }
    }

    /**
     * Recursively processes schema properties to find non-string types
     */
    public static processSchemaProperties(
        schema: any,
        currentPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>
    ): void {
        // Handle properties
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const propPath = currentPath ? `${currentPath}.${propName}` : propName;
                this.processProperty(propName, propSchema as any, propPath, result);
            }
        }

        // Handle pattern properties
        if (schema.patternProperties) {
            for (const [pattern, propSchema] of Object.entries(schema.patternProperties)) {
                // For pattern properties, we'll use the pattern as the key
                const propPath = currentPath ? `${currentPath}[${pattern}]` : `[${pattern}]`;
                this.processProperty(pattern, propSchema as any, propPath, result);
            }
        }

        // Handle allOf conditions (common in JSON Schema)
        if (schema.allOf) {
            for (const condition of schema.allOf) {
                if (condition.then) {
                    this.processSchemaProperties(condition.then, currentPath, result);
                }
            }
        }

        // Handle items in arrays
        if (schema.items) {
            this.processSchemaProperties(schema.items, `${currentPath}[]`, result);
        }
    }

    /**
     * Processes a single property to check if it's non-string
     */
    private static processProperty(
        propName: string,
        propSchema: any,
        propPath: string,
        result: Map<string, { type: string | string[]; path: string; description?: string }>
    ): void {
        // Check if the property has a type and it's not a string
        if (propSchema.type) {
            const type = propSchema.type;

            // Check if it's not a string type
            if (typeof type === "string") {
                if (type !== "string") {
                    result.set(propName, {
                        type,
                        path: propPath,
                        description: propSchema.description,
                    });
                }
            } else if (Array.isArray(type)) {
                // Handle union types (array of types)
                const nonStringTypes = type.filter((t: string) => t !== "string");
                if (nonStringTypes.length > 0) {
                    result.set(propName, {
                        type: nonStringTypes,
                        path: propPath,
                        description: propSchema.description,
                    });
                }
            }
        }

        // Recursively process nested properties
        if (propSchema.properties || propSchema.patternProperties || propSchema.allOf || propSchema.items) {
            this.processSchemaProperties(propSchema, propPath, result);
        }
    }
}
