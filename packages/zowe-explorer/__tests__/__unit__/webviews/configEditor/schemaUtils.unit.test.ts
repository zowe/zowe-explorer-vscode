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
            expect(getWizardTypeOptions({ selectedTab: null, configurations: [baseConfig], schemaValidations: {}, pendingChanges: {} })).toEqual([]);
        });
        it("returns schema validDefaults merged with profile types", () => {
            const configs = [{ ...baseConfig, configPath: "/c", properties: { profiles: { p1: { type: "custom" } } } }];
            const schema = { "/c": { validDefaults: ["zowe"] as string[] } };
            const result = getWizardTypeOptions({ selectedTab: 0, configurations: configs, schemaValidations: schema, pendingChanges: {} });
            expect(result).toContain("zowe");
            expect(result).toContain("custom");
            expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b)));
        });
        it("includes types from pending changes", () => {
            const configs = [{ ...baseConfig, configPath: "/c" }];
            const schema = { "/c": { validDefaults: [] as string[] } };
            const pending = { "/c": { "profiles.x.type": { value: "pendingType", path: [], profile: "x" } } };
            const result = getWizardTypeOptions({ selectedTab: 0, configurations: configs, schemaValidations: schema, pendingChanges: pending });
            expect(result).toContain("pendingType");
        });
    });

    describe("getWizardPropertyOptions", () => {
        it("returns [] when selectedTab is null", () => {
            expect(
                getWizardPropertyOptions({
                    selectedTab: null,
                    configurations: [baseConfig],
                    schemaValidations: {},
                    wizardSelectedType: "zowe",
                    wizardProperties: [],
                })
            ).toEqual([]);
        });
        it("returns schema property keys not yet used", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: {}, port: {} } },
                },
            };
            expect(
                getWizardPropertyOptions({
                    selectedTab: 0,
                    configurations: configs,
                    schemaValidations: schema,
                    wizardSelectedType: "zowe",
                    wizardProperties: [],
                })
            ).toEqual(["host", "port"]);
            expect(
                getWizardPropertyOptions({
                    selectedTab: 0,
                    configurations: configs,
                    schemaValidations: schema,
                    wizardSelectedType: "zowe",
                    wizardProperties: [{ key: "host", value: "x" }],
                })
            ).toEqual(["port"]);
        });
        it("falls back to all propertySchema when type not found", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { other: { foo: {} } },
                },
            };
            expect(
                getWizardPropertyOptions({
                    selectedTab: 0,
                    configurations: configs,
                    schemaValidations: schema,
                    wizardSelectedType: "zowe",
                    wizardProperties: [],
                })
            ).toEqual(["foo"]);
        });
    });

    describe("getWizardPropertyDescriptions", () => {
        it("returns {} when selectedTab is null", () => {
            expect(
                getWizardPropertyDescriptions({ selectedTab: null, configurations: [baseConfig], schemaValidations: {}, wizardSelectedType: "zowe" })
            ).toEqual({});
        });
        it("returns descriptions for type", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: { description: "Host name" } } },
                },
            };
            expect(
                getWizardPropertyDescriptions({ selectedTab: 0, configurations: configs, schemaValidations: schema, wizardSelectedType: "zowe" })
            ).toEqual({ host: "Host name" });
        });
        it("falls back to all types when type not in schema", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { other: { foo: { description: "Foo desc" } } },
                },
            };
            expect(
                getWizardPropertyDescriptions({ selectedTab: 0, configurations: configs, schemaValidations: schema, wizardSelectedType: "zowe" })
            ).toEqual({ foo: "Foo desc" });
        });
    });

    describe("getPropertyType", () => {
        it("returns undefined when selectedTab is null", () => {
            expect(
                getPropertyType({
                    propertyKey: "host",
                    selectedTab: null,
                    configurations: [baseConfig],
                    schemaValidations: {},
                    wizardSelectedType: "zowe",
                })
            ).toBeUndefined();
        });
        it("returns undefined when wizardSelectedType is empty", () => {
            expect(
                getPropertyType({ propertyKey: "host", selectedTab: 0, configurations: [baseConfig], schemaValidations: {}, wizardSelectedType: "" })
            ).toBeUndefined();
        });
        it("returns type from schema", () => {
            const configs = [{ ...baseConfig }];
            const schema = {
                [baseConfig.configPath]: {
                    propertySchema: { zowe: { host: { type: "string" } } },
                },
            };
            expect(
                getPropertyType({
                    propertyKey: "host",
                    selectedTab: 0,
                    configurations: configs,
                    schemaValidations: schema,
                    wizardSelectedType: "zowe",
                })
            ).toBe("string");
        });
    });
});
