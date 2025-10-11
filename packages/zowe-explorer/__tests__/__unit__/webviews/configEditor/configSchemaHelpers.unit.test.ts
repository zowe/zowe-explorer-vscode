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

import { ConfigSchemaHelpers, schemaValidation } from "../../../../src/utils/ConfigSchemaHelpers";
import * as fs from "fs";

// Mock fs module
jest.mock("fs", () => ({
    readFileSync: jest.fn(),
}));

const MockedFs = fs as jest.Mocked<typeof fs>;

describe("ConfigSchemaHelpers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("generateSchemaValidation", () => {
        it("should generate schema validation from valid schema", () => {
            const schema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        if: {
                                            properties: {
                                                type: { const: "zosmf" },
                                            },
                                        },
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        host: {
                                                            type: "string",
                                                            description: "Host name",
                                                            default: "localhost",
                                                        },
                                                        port: {
                                                            type: "number",
                                                            description: "Port number",
                                                            default: 443,
                                                        },
                                                    },
                                                },
                                                secure: {
                                                    items: {
                                                        enum: ["password", "token"],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    defaults: {
                        properties: {
                            zosmf: {
                                type: "object",
                            },
                        },
                    },
                },
            };

            const result = ConfigSchemaHelpers.generateSchemaValidation(schema);

            expect(result).toEqual({
                propertySchema: {
                    zosmf: {
                        host: {
                            type: "string",
                            description: "Host name",
                            default: "localhost",
                            secure: false,
                        },
                        port: {
                            type: "number",
                            description: "Port number",
                            default: 443,
                            secure: false,
                        },
                    },
                },
                validDefaults: ["zosmf"],
            });
        });

        it("should handle schema with secure properties", () => {
            const schema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        if: {
                                            properties: {
                                                type: { const: "zosmf" },
                                            },
                                        },
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        host: {
                                                            type: "string",
                                                            description: "Host name",
                                                        },
                                                        password: {
                                                            type: "string",
                                                            description: "Password",
                                                        },
                                                    },
                                                },
                                                secure: {
                                                    items: {
                                                        enum: ["password"],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    defaults: {
                        properties: {
                            zosmf: {
                                type: "object",
                            },
                        },
                    },
                },
            };

            const result = ConfigSchemaHelpers.generateSchemaValidation(schema);

            expect(result.propertySchema.zosmf.password.secure).toBe(true);
            expect(result.propertySchema.zosmf.host.secure).toBe(false);
        });

        it("should handle array type values", () => {
            const schema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        if: {
                                            properties: {
                                                type: { const: "zosmf" },
                                            },
                                        },
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        protocol: {
                                                            type: ["string", "null"],
                                                            description: "Protocol",
                                                        },
                                                    },
                                                },
                                                secure: {
                                                    items: {
                                                        enum: [],
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    defaults: {
                        properties: {
                            zosmf: {
                                type: "object",
                            },
                        },
                    },
                },
            };

            const result = ConfigSchemaHelpers.generateSchemaValidation(schema);

            expect(result.propertySchema.zosmf.protocol.type).toBe("string");
        });

        it("should handle schema without allOf rules", () => {
            const schema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [],
                            },
                        },
                    },
                    defaults: {
                        properties: {
                            zosmf: {
                                type: "object",
                            },
                        },
                    },
                },
            };

            const result = ConfigSchemaHelpers.generateSchemaValidation(schema);

            expect(result).toEqual({
                propertySchema: {},
                validDefaults: ["zosmf"],
            });
        });

        it("should handle schema with missing defaults properties", () => {
            const schema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [],
                            },
                        },
                    },
                    defaults: {
                        properties: {},
                    },
                },
            };

            const result = ConfigSchemaHelpers.generateSchemaValidation(schema);

            expect(result.validDefaults).toEqual([]);
        });
    });

    describe("getProfileProperties", () => {
        it("should read and process schema file successfully", () => {
            const mockSchema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        host: {
                                                            type: "string",
                                                            description: "Host name",
                                                        },
                                                        port: {
                                                            type: "number",
                                                            description: "Port number",
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            MockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

            const result = ConfigSchemaHelpers.getProfileProperties("/path/to/schema.json");

            expect(MockedFs.readFileSync).toHaveBeenCalledWith("/path/to/schema.json", "utf8");
            expect(result.size).toBeGreaterThan(0);
        });

        it("should handle file read errors", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            MockedFs.readFileSync.mockImplementation(() => {
                throw new Error("File not found");
            });

            const result = ConfigSchemaHelpers.getProfileProperties("/invalid/path.json");

            expect(result).toEqual(new Map());
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error reading schema file: Error: File not found");

            consoleErrorSpy.mockRestore();
        });

        it("should handle invalid JSON", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
            MockedFs.readFileSync.mockReturnValue("invalid json");

            const result = ConfigSchemaHelpers.getProfileProperties("/path/to/schema.json");

            expect(result).toEqual(new Map());
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it("should handle schema without profiles", () => {
            const mockSchema = {
                properties: {
                    other: {
                        type: "object",
                    },
                },
            };

            MockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

            const result = ConfigSchemaHelpers.getProfileProperties("/path/to/schema.json");

            expect(result).toEqual(new Map());
        });
    });

    describe("processSchemaProperties", () => {
        it("should process schema properties correctly", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                properties: {
                    host: {
                        type: "string",
                        description: "Host name",
                    },
                    port: {
                        type: "number",
                        description: "Port number",
                    },
                    enabled: {
                        type: "boolean",
                        description: "Enable flag",
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(2); // Only non-string types
            expect(result.get("port")).toEqual({
                type: "number",
                path: "port",
                description: "Port number",
            });
            expect(result.get("enabled")).toEqual({
                type: "boolean",
                path: "enabled",
                description: "Enable flag",
            });
        });

        it("should handle pattern properties", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                patternProperties: {
                    "^\\S*$": {
                        properties: {
                            host: {
                                type: "string",
                                description: "Host name",
                            },
                            port: {
                                type: "number",
                                description: "Port number",
                            },
                        },
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(1);
            expect(result.get("port")).toEqual({
                type: "number",
                path: "[^\\S*$].port",
                description: "Port number",
            });
        });

        it("should handle allOf conditions", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                allOf: [
                    {
                        then: {
                            properties: {
                                host: {
                                    type: "string",
                                    description: "Host name",
                                },
                                port: {
                                    type: "number",
                                    description: "Port number",
                                },
                            },
                        },
                    },
                ],
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(1);
            expect(result.get("port")).toEqual({
                type: "number",
                path: "port",
                description: "Port number",
            });
        });

        it("should handle array items", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                items: {
                    properties: {
                        name: {
                            type: "string",
                            description: "Item name",
                        },
                        count: {
                            type: "number",
                            description: "Item count",
                        },
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "items", result);

            expect(result.size).toBe(1);
            expect(result.get("count")).toEqual({
                type: "number",
                path: "items[].count",
                description: "Item count",
            });
        });

        it("should handle union types (array of types)", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                properties: {
                    value: {
                        type: ["string", "number"],
                        description: "String or number value",
                    },
                    flag: {
                        type: ["boolean", "string"],
                        description: "Boolean or string flag",
                    },
                    pure: {
                        type: ["number", "boolean"],
                        description: "Number or boolean only",
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(3);
            expect(result.get("value")).toEqual({
                type: ["number"],
                path: "value",
                description: "String or number value",
            });
            expect(result.get("flag")).toEqual({
                type: ["boolean"],
                path: "flag",
                description: "Boolean or string flag",
            });
            expect(result.get("pure")).toEqual({
                type: ["number", "boolean"],
                path: "pure",
                description: "Number or boolean only",
            });
        });

        it("should handle nested properties", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                properties: {
                    config: {
                        properties: {
                            host: {
                                type: "string",
                                description: "Host name",
                            },
                            port: {
                                type: "number",
                                description: "Port number",
                            },
                            nested: {
                                properties: {
                                    value: {
                                        type: "boolean",
                                        description: "Nested value",
                                    },
                                },
                            },
                        },
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(2);
            expect(result.get("port")).toEqual({
                type: "number",
                path: "config.port",
                description: "Port number",
            });
            expect(result.get("value")).toEqual({
                type: "boolean",
                path: "config.nested.value",
                description: "Nested value",
            });
        });

        it("should handle empty schema", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {};

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(0);
        });

        it("should handle schema with only string types", () => {
            const result = new Map<string, { type: string | string[]; path: string; description?: string }>();
            const schema = {
                properties: {
                    host: {
                        type: "string",
                        description: "Host name",
                    },
                    name: {
                        type: "string",
                        description: "Name",
                    },
                },
            };

            ConfigSchemaHelpers.processSchemaProperties(schema, "", result);

            expect(result.size).toBe(0);
        });
    });

    describe("private methods through public interfaces", () => {
        it("should process profile properties through getProfileProperties", () => {
            const mockSchema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        host: {
                                                            type: "string",
                                                            description: "Host name",
                                                        },
                                                        port: {
                                                            type: "number",
                                                            description: "Port number",
                                                        },
                                                        enabled: {
                                                            type: "boolean",
                                                            description: "Enable flag",
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            MockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

            const result = ConfigSchemaHelpers.getProfileProperties("/path/to/schema.json");

            expect(result.size).toBe(2); // Only non-string types
            expect(result.get("port")).toEqual({
                type: "number",
                path: "[^\\S*$].properties.port",
                description: "Port number",
            });
            expect(result.get("enabled")).toEqual({
                type: "boolean",
                path: "[^\\S*$].properties.enabled",
                description: "Enable flag",
            });
        });

        it("should handle complex nested profile structure", () => {
            const mockSchema = {
                properties: {
                    profiles: {
                        patternProperties: {
                            "^\\S*$": {
                                allOf: [
                                    {
                                        then: {
                                            properties: {
                                                properties: {
                                                    properties: {
                                                        config: {
                                                            properties: {
                                                                host: {
                                                                    type: "string",
                                                                    description: "Host name",
                                                                },
                                                                port: {
                                                                    type: "number",
                                                                    description: "Port number",
                                                                },
                                                            },
                                                        },
                                                        flags: {
                                                            type: ["boolean", "string"],
                                                            description: "Flags",
                                                        },
                                                        pure: {
                                                            type: ["number", "boolean"],
                                                            description: "Pure non-string types",
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            MockedFs.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

            const result = ConfigSchemaHelpers.getProfileProperties("/path/to/schema.json");

            expect(result.size).toBe(2);
            expect(result.get("port")).toEqual({
                type: "number",
                path: "[^\\S*$].properties.config.port",
                description: "Port number",
            });
            expect(result.get("pure")).toEqual({
                type: ["number", "boolean"],
                path: "[^\\S*$].properties.pure",
                description: "Pure non-string types",
            });
        });
    });
});
