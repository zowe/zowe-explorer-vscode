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

import {
    getPropertyTypeForAddProfile,
    getPropertyTypeForConfigEditor,
    getPropertyDescriptions,
    fetchAllPropertyKeys,
    fetchExistingPropertyKeys,
    fetchInheritedPropertyKeys,
    fetchTypeOptions,
    validateProfilePropertyKey,
    isFileProperty,
} from "../../../../src/webviews/src/config-editor/utils/propertyUtils";

const configPath = "/c";
const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
const schema = {
    [configPath]: {
        propertySchema: {
            zowe: { host: { type: "string", description: "Host" }, port: { type: "number" } },
        },
    },
} as any;

describe("propertyUtils", () => {
    describe("getPropertyTypeForAddProfile", () => {
        it("returns undefined when selectedTab is null", () => {
            expect(
                getPropertyTypeForAddProfile({
                    propertyKey: "host",
                    selectedTab: null,
                    configurations: configs,
                    selectedProfileKey: "p1",
                    schemaValidations: schema,
                    pendingChanges: {},
                    renames: {},
                })
            ).toBeUndefined();
        });
        it("returns type from schema for selected profile", () => {
            expect(
                getPropertyTypeForAddProfile({
                    propertyKey: "host",
                    selectedTab: 0,
                    configurations: configs,
                    selectedProfileKey: "p1",
                    schemaValidations: schema,
                    pendingChanges: {},
                    renames: {},
                })
            ).toBe("string");
        });
        it("returns type from schema when no profile selected (fallback to all types)", () => {
            const schemaMulti = {
                [configPath]: {
                    propertySchema: {
                        zowe: { host: { type: "string" } },
                        other: { host: { type: "number" } },
                    },
                },
            };
            expect(
                getPropertyTypeForAddProfile({
                    propertyKey: "host",
                    selectedTab: 0,
                    configurations: configs,
                    selectedProfileKey: null,
                    schemaValidations: schemaMulti,
                    pendingChanges: {},
                    renames: {},
                })
            ).toBe("string");
        });
    });

    describe("getPropertyTypeForConfigEditor", () => {
        it("returns undefined when selectedTab is null", () => {
            expect(
                getPropertyTypeForConfigEditor({
                    propertyKey: "host",
                    profilePath: ["profiles", "p1", "properties"],
                    selectedTab: null,
                    configurations: configs,
                    schemaValidations: schema,
                    pendingChanges: {},
                    renames: {},
                })
            ).toBeUndefined();
        });
        it("returns type from schema for profile path", () => {
            expect(
                getPropertyTypeForConfigEditor({
                    propertyKey: "host",
                    profilePath: ["profiles", "p1", "properties"],
                    selectedTab: 0,
                    configurations: configs,
                    schemaValidations: schema,
                    pendingChanges: {},
                    renames: {},
                })
            ).toBe("string");
        });
    });

    describe("getPropertyDescriptions", () => {
        it("returns descriptions for profile type", () => {
            const result = getPropertyDescriptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
            });
            expect(result.host).toBe("Host");
        });
        it("falls back to all types when type not in schema", () => {
            const configs2 = [{ configPath, properties: { profiles: { p2: { type: "other", properties: {} } } } } as any];
            const schema2 = {
                [configPath]: {
                    propertySchema: {
                        other: { foo: { description: "Foo desc" } },
                        zowe: { bar: { description: "Bar desc" } },
                    },
                },
            };
            const result = getPropertyDescriptions({
                path: ["profiles", "p2", "properties"],
                selectedTab: 0,
                configurations: configs2,
                schemaValidations: schema2,
                pendingChanges: {},
                renames: {},
            });
            expect(result.foo).toBe("Foo desc");
            expect(result.bar).toBe("Bar desc");
        });
    });

    describe("fetchTypeOptions", () => {
        it("returns schema keys not in current profile or pending", () => {
            const configsWithHost = [
                {
                    configPath,
                    properties: {
                        profiles: { p1: { type: "zowe", properties: { host: "x" } } },
                    },
                },
            ] as any;
            const result = fetchTypeOptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsWithHost,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result).toContain("port");
            expect(result).not.toContain("host");
        });
        it("includes secure array keys in existing properties", () => {
            const configsSecure = [
                {
                    configPath,
                    properties: {
                        profiles: { p1: { type: "zowe", properties: {}, secure: ["token"] } },
                    },
                },
            ] as any;
            const result = fetchTypeOptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsSecure,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result).not.toContain("token");
        });
        it("excludes properties from pending changes for same profile", () => {
            const pending = {
                [configPath]: {
                    "profiles.p1.properties.reject": { value: "x", path: [], profile: "p1" },
                },
            };
            const result = fetchTypeOptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: { [configPath]: { propertySchema: { zowe: { host: {}, port: {}, reject: {} } } } },
                pendingChanges: pending,
                renames: {},
                deletions: {},
            });
            expect(result).not.toContain("reject");
        });
        it("uses all schema types when resolvedType is null (profile untyped)", () => {
            const configsUntyped = [{ configPath, properties: { profiles: { p1: { properties: {} } } } }] as any;
            const schemaMulti = {
                [configPath]: {
                    propertySchema: {
                        zowe: { host: {} },
                        other: { port: {} },
                    },
                },
            };
            const result = fetchTypeOptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsUntyped,
                schemaValidations: schemaMulti,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result).toContain("host");
            expect(result).toContain("port");
        });
        it("includes schema keys that are pending deletion (not treated as still present)", () => {
            const configsWithHost = [
                {
                    configPath,
                    properties: {
                        profiles: { p1: { type: "zowe", properties: { host: "x" } } },
                    },
                },
            ] as any;
            const result = fetchTypeOptions({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsWithHost,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: { [configPath]: ["profiles.p1.properties.host"] },
            });
            expect(result).toContain("host");
            expect(result).toContain("port");
        });
    });

    describe("fetchExistingPropertyKeys", () => {
        it("returns [] when selectedTab is null", () => {
            const result = fetchExistingPropertyKeys({
                path: ["profiles", "p1", "properties"],
                selectedTab: null,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result).toEqual([]);
        });
        it("returns existing properties and secure properties", () => {
            const configsWithProps = [
                {
                    configPath,
                    properties: {
                        profiles: {
                            p1: {
                                type: "zowe",
                                properties: { host: "example.com", customProp: "val" },
                                secure: ["password"],
                            },
                        },
                    },
                },
            ] as any;
            const result = fetchExistingPropertyKeys({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsWithProps,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result).toContain("host");
            expect(result).toContain("customProp");
            expect(result).toContain("password");
        });
    });

    describe("fetchInheritedPropertyKeys", () => {
        it("returns [] when mergedProperties is not provided", () => {
            expect(fetchInheritedPropertyKeys({})).toEqual([]);
        });

        it("returns inherited properties excluding type, name, and existing local properties", () => {
            const result = fetchInheritedPropertyKeys({
                mergedProperties: {
                    type: { value: "zowe" },
                    name: { value: "p1" },
                    host: { value: "inherited-host" },
                    port: { value: 443 },
                    user: { value: "user1" },
                },
                existingProperties: ["host"],
            });
            expect(result).not.toContain("type");
            expect(result).not.toContain("name");
            expect(result).not.toContain("host");
            expect(result).toContain("port");
            expect(result).toContain("user");
        });
    });

    describe("fetchAllPropertyKeys", () => {
        it("returns [] when selectedTab is null", () => {
            const result = fetchAllPropertyKeys({
                path: ["profiles", "p1", "properties"],
                selectedTab: null,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([]);
        });
        it("returns all schema property keys for profile type", () => {
            const result = fetchAllPropertyKeys({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
            });
            expect(result).toContain("host");
            expect(result).toContain("port");
        });
        it("falls back to all schema types when profile is untyped", () => {
            const configsUntyped = [{ configPath, properties: { profiles: { p1: { properties: {} } } } }] as any;
            const schemaMulti = {
                [configPath]: {
                    propertySchema: {
                        zowe: { host: {} },
                        other: { customProp: {} },
                    },
                },
            };
            const result = fetchAllPropertyKeys({
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsUntyped,
                schemaValidations: schemaMulti,
                pendingChanges: {},
                renames: {},
            });
            expect(result).toContain("host");
            expect(result).toContain("customProp");
        });
    });

    describe("validateProfilePropertyKey", () => {
        it("returns isValid: false when propertyKey is empty or whitespace", () => {
            const resultEmpty = validateProfilePropertyKey({
                propertyKey: "",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(resultEmpty.isValid).toBe(false);

            const resultWhitespace = validateProfilePropertyKey({
                propertyKey: "   ",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(resultWhitespace.isValid).toBe(false);
        });

        it("returns isValid: true when propertyKey is valid in schema and not yet added", () => {
            const result = validateProfilePropertyKey({
                propertyKey: "port",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("returns isValid: false with 'Property key already exists' when property is already in profile", () => {
            const configsWithHost = [
                {
                    configPath,
                    properties: {
                        profiles: { p1: { type: "zowe", properties: { host: "example.com" } } },
                    },
                },
            ] as any;
            const result = validateProfilePropertyKey({
                propertyKey: "host",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsWithHost,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Property key already exists");
        });

        it("returns isValid: false with 'Inherited property, change from the parent' when property is inherited in mergedProperties", () => {
            const result = validateProfilePropertyKey({
                propertyKey: "host",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
                mergedProperties: {
                    host: { value: "inherited-host" },
                },
            });
            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Inherited property, change from the parent");
        });

        it("returns isValid: true when isEditingExisting is true for an existing key", () => {
            const configsWithHost = [
                {
                    configPath,
                    properties: {
                        profiles: { p1: { type: "zowe", properties: { host: "example.com" } } },
                    },
                },
            ] as any;
            const result = validateProfilePropertyKey({
                propertyKey: "host",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configsWithHost,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
                isEditingExisting: true,
            });
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("returns isValid: true with warning when property is not in schema", () => {
            const result = validateProfilePropertyKey({
                propertyKey: "account",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.warning).toBe("Property is not defined in the schema for this profile");
        });

        it("returns isValid: true with warning for random string", () => {
            const result = validateProfilePropertyKey({
                propertyKey: "randomString123",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: schema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.warning).toBe("Property is not defined in the schema for this profile");
        });

        it("returns isValid: true when no schema properties are defined (empty schema fallback)", () => {
            const emptySchema = { [configPath]: { propertySchema: {} } };
            const result = validateProfilePropertyKey({
                propertyKey: "customProp",
                path: ["profiles", "p1", "properties"],
                selectedTab: 0,
                configurations: configs,
                schemaValidations: emptySchema,
                pendingChanges: {},
                renames: {},
                deletions: {},
            });
            expect(result.isValid).toBe(true);
        });
    });

    describe("isFileProperty", () => {
        it("returns true for privatekey, certfile, certkeyfile", () => {
            expect(isFileProperty("privatekey")).toBe(true);
            expect(isFileProperty("certfile")).toBe(true);
            expect(isFileProperty("certkeyfile")).toBe(true);
            expect(isFileProperty("PrivateKey")).toBe(true);
        });
        it("returns false for other keys", () => {
            expect(isFileProperty("host")).toBe(false);
        });
        it("returns false for empty or non-string", () => {
            expect(isFileProperty("")).toBe(false);
            expect(isFileProperty(null as any)).toBe(false);
        });
    });
});
