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
    getWizardTypeOptions,
    getWizardPropertyOptions,
    getWizardPropertyDescriptions,
    getPropertyType,
} from "../../../../src/webviews/src/config-editor/utils/schemaUtils";

const baseConfig: any = {
    configPath: "/path",
    properties: { profiles: {} },
};

describe("schemaUtils", () => {
    describe("getWizardTypeOptions", () => {
        it("returns [] when selectedTab is null", () => {
            expect(getWizardTypeOptions(null, [baseConfig], {}, {})).toEqual([]);
        });
        it("returns schema validDefaults merged with profile types", () => {
            const configs = [{ ...baseConfig, configPath: "/c" }];
            const schema = { "/c": { validDefaults: ["zowe"] as string[] } };
            configs[0].properties.profiles = { p1: { type: "custom" } };
            const result = getWizardTypeOptions(0, configs, schema, {});
            expect(result).toContain("zowe");
            expect(result).toContain("custom");
            expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b)));
        });
        it("includes types from pending changes", () => {
            const configs = [{ ...baseConfig, configPath: "/c" }];
            const schema = { "/c": { validDefaults: [] as string[] } };
            const pending = { "/c": { "profiles.x.type": { value: "pendingType", path: [], profile: "x" } } };
            const result = getWizardTypeOptions(0, configs, schema, pending);
            expect(result).toContain("pendingType");
        });
    });

    describe("getWizardPropertyOptions", () => {
        it("returns [] when selectedTab is null", () => {
            expect(getWizardPropertyOptions(null, [baseConfig], {}, "zowe", [])).toEqual([]);
        });
        it("returns schema property keys not yet used", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: {}, port: {} } },
                },
            };
            expect(getWizardPropertyOptions(0, configs, schema, "zowe", [])).toEqual(["host", "port"]);
            expect(getWizardPropertyOptions(0, configs, schema, "zowe", [{ key: "host", value: "x" }])).toEqual(["port"]);
        });
        it("falls back to all propertySchema when type not found", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { other: { foo: {} } },
                },
            };
            expect(getWizardPropertyOptions(0, configs, schema, "zowe", [])).toEqual(["foo"]);
        });
    });

    describe("getWizardPropertyDescriptions", () => {
        it("returns {} when selectedTab is null", () => {
            expect(getWizardPropertyDescriptions(null, [baseConfig], {}, "zowe")).toEqual({});
        });
        it("returns descriptions for type", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: { description: "Host name" } } },
                },
            };
            expect(getWizardPropertyDescriptions(0, configs, schema, "zowe")).toEqual({ host: "Host name" });
        });
        it("falls back to all types when type not in schema", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { other: { foo: { description: "Foo desc" } } },
                },
            };
            expect(getWizardPropertyDescriptions(0, configs, schema, "zowe")).toEqual({ foo: "Foo desc" });
        });
    });

    describe("getPropertyType", () => {
        it("returns undefined when selectedTab is null", () => {
            expect(getPropertyType("host", null, [baseConfig], {}, "zowe")).toBeUndefined();
        });
        it("returns undefined when wizardSelectedType is empty", () => {
            expect(getPropertyType("host", 0, [baseConfig], {}, "")).toBeUndefined();
        });
        it("returns type from schema", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: { type: "string" } } },
                },
            };
            expect(getPropertyType("host", 0, configs, schema, "zowe")).toBe("string");
        });
    });
});
