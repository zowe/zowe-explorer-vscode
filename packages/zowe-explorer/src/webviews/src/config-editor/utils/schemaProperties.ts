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

import type { ProfileSchemaEntry, ProfileSchemaMap } from "../types";

/** Select one type when available; otherwise expose all type schemas in their original order. */
export function getRelevantPropertySchemas(propertySchema: ProfileSchemaMap, profileType: string | null): Record<string, ProfileSchemaEntry>[] {
    if (profileType && propertySchema[profileType]) return [propertySchema[profileType]];
    return Object.values(propertySchema).filter((schema) => schema && typeof schema === "object");
}

export function collectSchemaPropertyKeys(schemas: Record<string, ProfileSchemaEntry>[]): string[] {
    return [...new Set(schemas.flatMap((schema) => Object.keys(schema)))];
}

/** Earlier schemas have precedence; later schemas only fill missing descriptions. */
export function collectSchemaPropertyDescriptions(schemas: Record<string, ProfileSchemaEntry>[]): Record<string, string> {
    const descriptions: Record<string, string> = {};
    for (const schema of schemas) {
        for (const [key, property] of Object.entries(schema)) {
            if (property && typeof property === "object" && property.description && !descriptions[key]) descriptions[key] = property.description;
        }
    }
    return descriptions;
}
