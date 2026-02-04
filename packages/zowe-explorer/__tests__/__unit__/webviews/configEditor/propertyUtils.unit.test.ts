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
import { getProfileType } from "../../../../src/webviews/src/config-editor/utils/profileUtils";

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
            expect(getPropertyTypeForAddProfile("host", null, configs, "p1", schema, getProfileType, {}, {})).toBeUndefined();
        });
        it("returns type from schema for selected profile", () => {
            expect(getPropertyTypeForAddProfile("host", 0, configs, "p1", schema, getProfileType, {}, {})).toBe("string");
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
            expect(getPropertyTypeForAddProfile("host", 0, configs, null, schemaMulti, getProfileType, {}, {})).toBe("string");
        });
    });

    describe("getPropertyTypeForConfigEditor", () => {
        it("returns undefined when selectedTab is null", () => {
            expect(
                getPropertyTypeForConfigEditor("host", ["profiles", "p1", "properties"], null, configs, schema, getProfileType, {}, {})
            ).toBeUndefined();
        });
        it("returns type from schema for profile path", () => {
            expect(getPropertyTypeForConfigEditor("host", ["profiles", "p1", "properties"], 0, configs, schema, getProfileType, {}, {})).toBe(
                "string"
            );
        });
    });

    describe("getPropertyDescriptions", () => {
        it("returns descriptions for profile type", () => {
            const result = getPropertyDescriptions(["profiles", "p1", "properties"], 0, configs, schema, getProfileType, {}, {});
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
            const result = getPropertyDescriptions(["profiles", "p2", "properties"], 0, configs2, schema2, getProfileType, {}, {});
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
            const result = fetchTypeOptions(["profiles", "p1", "properties"], 0, configsWithHost, schema, getProfileType, {}, {});
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
            const result = fetchTypeOptions(["profiles", "p1", "properties"], 0, configsSecure, schema, getProfileType, {}, {});
            expect(result).not.toContain("token");
        });
        it("excludes properties from pending changes for same profile", () => {
            const pending = {
                [configPath]: {
                    "profiles.p1.properties.reject": { value: "x", path: [], profile: "p1" },
                },
            };
            const result = fetchTypeOptions(
                ["profiles", "p1", "properties"],
                0,
                configs,
                { [configPath]: { propertySchema: { zowe: { host: {}, port: {}, reject: {} } } } },
                getProfileType,
                pending,
                {}
            );
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
            const result = fetchTypeOptions(["profiles", "p1", "properties"], 0, configsUntyped, schemaMulti, getProfileType, {}, {});
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
