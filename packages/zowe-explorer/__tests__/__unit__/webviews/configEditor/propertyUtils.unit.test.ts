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
    fetchTypeOptions,
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
};

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
