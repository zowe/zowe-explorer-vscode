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

import { ConfigUtils, LayerModifications } from "../../../../src/utils/ConfigUtils";
import { ChangeEntry } from "../../../../src/utils/ConfigChangeHandlers";
import { schemaValidation } from "../../../../src/utils/ConfigSchemaHelpers";

describe("ConfigUtils", () => {
    describe("parseConfigChanges", () => {
        it("should group changes by configPath correctly", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [
                    {
                        key: "profiles.test1.host",
                        value: "host1",
                        path: ["profiles", "test1", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                    {
                        key: "profiles.test2.host",
                        value: "host2",
                        path: ["profiles", "test2", "host"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                    {
                        key: "profiles.test3.host",
                        value: "host3",
                        path: ["profiles", "test3", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                ],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(2);
            expect(result[0].configPath).toBe("/config1.json");
            expect(result[0].changes).toHaveLength(2);
            expect(result[0].changes[0].key).toBe("profiles.test1.host");
            expect(result[0].changes[1].key).toBe("profiles.test3.host");

            expect(result[1].configPath).toBe("/config2.json");
            expect(result[1].changes).toHaveLength(1);
            expect(result[1].changes[0].key).toBe("profiles.test2.host");
        });

        it("should handle deletions grouping by configPath", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [],
                deletions: [
                    {
                        key: "profiles.test1.host",
                        value: "",
                        path: ["profiles", "test1", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                    {
                        key: "profiles.test2.host",
                        value: "",
                        path: ["profiles", "test2", "host"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                ],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(2);
            expect(result[0].configPath).toBe("/config1.json");
            expect(result[0].deletions).toHaveLength(1);
            expect(result[0].deletions[0].key).toBe("profiles.test1.host");

            expect(result[1].configPath).toBe("/config2.json");
            expect(result[1].deletions).toHaveLength(1);
            expect(result[1].deletions[0].key).toBe("profiles.test2.host");
        });

        it("should handle defaultsChanges grouping by configPath", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [],
                deletions: [],
                defaultsChanges: [
                    {
                        key: "host",
                        value: "default-host",
                        path: ["defaults", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                    {
                        key: "port",
                        value: "443",
                        path: ["defaults", "port"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                ],
                defaultsDeleteKeys: [],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(2);
            expect(result[0].configPath).toBe("/config1.json");
            expect(result[0].defaultsChanges).toHaveLength(1);
            expect(result[0].defaultsChanges[0].key).toBe("host");

            expect(result[1].configPath).toBe("/config2.json");
            expect(result[1].defaultsChanges).toHaveLength(1);
            expect(result[1].defaultsChanges[0].key).toBe("port");
        });

        it("should handle defaultsDeleteKeys grouping by configPath", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [
                    {
                        key: "host",
                        value: "",
                        path: ["defaults", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                    {
                        key: "port",
                        value: "",
                        path: ["defaults", "port"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                ],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(2);
            expect(result[0].configPath).toBe("/config1.json");
            expect(result[0].defaultsDeleteKeys).toHaveLength(1);
            expect(result[0].defaultsDeleteKeys[0].key).toBe("host");

            expect(result[1].configPath).toBe("/config2.json");
            expect(result[1].defaultsDeleteKeys).toHaveLength(1);
            expect(result[1].defaultsDeleteKeys[0].key).toBe("port");
        });

        it("should handle mixed changes across multiple config paths", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [
                    {
                        key: "profiles.test1.host",
                        value: "host1",
                        path: ["profiles", "test1", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                ],
                deletions: [
                    {
                        key: "profiles.test2.host",
                        value: "",
                        path: ["profiles", "test2", "host"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                ],
                defaultsChanges: [
                    {
                        key: "host",
                        value: "default-host",
                        path: ["defaults", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                ],
                defaultsDeleteKeys: [
                    {
                        key: "port",
                        value: "",
                        path: ["defaults", "port"],
                        configPath: "/config2.json",
                        secure: false,
                    },
                ],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(2);

            const config1 = result.find((r) => r.configPath === "/config1.json");
            const config2 = result.find((r) => r.configPath === "/config2.json");

            expect(config1).toBeDefined();
            expect(config1!.changes).toHaveLength(1);
            expect(config1!.defaultsChanges).toHaveLength(1);
            expect(config1!.deletions).toHaveLength(0);
            expect(config1!.defaultsDeleteKeys).toHaveLength(0);

            expect(config2).toBeDefined();
            expect(config2!.deletions).toHaveLength(1);
            expect(config2!.defaultsDeleteKeys).toHaveLength(1);
            expect(config2!.changes).toHaveLength(0);
            expect(config2!.defaultsChanges).toHaveLength(0);
        });

        it("should handle empty arrays gracefully", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(0);
        });

        it("should handle undefined arrays gracefully", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: undefined as any,
                deletions: undefined as any,
                defaultsChanges: undefined as any,
                defaultsDeleteKeys: undefined as any,
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(0);
        });

        it("should handle null arrays gracefully", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: null as any,
                deletions: null as any,
                defaultsChanges: null as any,
                defaultsDeleteKeys: null as any,
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(0);
        });

        it("should create proper group structure for each config path", () => {
            const data: LayerModifications = {
                configPath: "test-path",
                changes: [
                    {
                        key: "profiles.test1.host",
                        value: "host1",
                        path: ["profiles", "test1", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                ],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            };

            const result = ConfigUtils.parseConfigChanges(data);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                configPath: "/config1.json",
                changes: [
                    {
                        key: "profiles.test1.host",
                        value: "host1",
                        path: ["profiles", "test1", "host"],
                        configPath: "/config1.json",
                        secure: false,
                    },
                ],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            });
        });
    });

    describe("processProfilesRecursively", () => {
        let consoleWarnSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
        });

        afterEach(() => {
            consoleWarnSpy.mockRestore();
        });

        it("should return early for null profiles", () => {
            const profiles = null;
            ConfigUtils.processProfilesRecursively(profiles);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should return early for undefined profiles", () => {
            const profiles = undefined;
            ConfigUtils.processProfilesRecursively(profiles);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should return early for non-object profiles", () => {
            const profiles = "not an object";
            ConfigUtils.processProfilesRecursively(profiles);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should return early for array profiles", () => {
            const profiles = ["array", "not", "object"];
            ConfigUtils.processProfilesRecursively(profiles);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should process profiles without schema validation", () => {
            const profiles = {
                testProfile: {
                    type: "zosmf",
                    properties: {
                        host: "test-host",
                        port: 443,
                    },
                },
            };

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles.testProfile.type).toBe("zosmf");
            expect(profiles.testProfile.properties).toEqual({
                host: "test-host",
                port: 443,
            });
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should filter out invalid profile types when schema validation is provided", () => {
            const profiles = {
                validProfile: {
                    type: "zosmf",
                    properties: {
                        host: "test-host",
                    },
                },
                invalidProfile: {
                    type: "invalid-type",
                    properties: {
                        host: "test-host",
                    },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {
                    zosmf: {
                        host: { type: "string" },
                    },
                },
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.validProfile.type).toBe("zosmf");
            expect(profiles.invalidProfile.type).toBeUndefined();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Setting type to undefined for profile "invalidProfile" with invalid type "invalid-type". Valid types are: zosmf'
            );
        });

        it("should handle profiles without type property", () => {
            const profiles = {
                noTypeProfile: {
                    properties: {
                        host: "test-host",
                    },
                } as any,
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {
                    zosmf: {
                        host: { type: "string" },
                    },
                },
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.noTypeProfile.type).toBeUndefined();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should filter out secure properties from profile properties", () => {
            const profiles = {
                secureProfile: {
                    type: "zosmf",
                    secure: ["password", "token"],
                    properties: {
                        host: "test-host",
                        password: "secret-password",
                        token: "secret-token",
                        port: 443,
                    },
                },
            };

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles.secureProfile.properties).toEqual({
                host: "test-host",
                port: 443,
            });
        });

        it("should handle profiles without secure property", () => {
            const profiles = {
                noSecureProfile: {
                    type: "zosmf",
                    properties: {
                        host: "test-host",
                        password: "secret-password",
                    },
                },
            };

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles.noSecureProfile.properties).toEqual({
                host: "test-host",
                password: "secret-password",
            });
        });

        it("should handle profiles without properties", () => {
            const profiles = {
                noPropertiesProfile: {
                    type: "zosmf",
                    secure: ["password"],
                },
            };

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles.noPropertiesProfile).toEqual({
                type: "zosmf",
                secure: ["password"],
            });
        });

        it("should process nested profiles recursively", () => {
            const profiles = {
                parentProfile: {
                    type: "zosmf",
                    properties: {
                        host: "parent-host",
                    },
                    profiles: {
                        childProfile: {
                            type: "invalid-type",
                            secure: ["password"],
                            properties: {
                                host: "child-host",
                                password: "secret",
                            },
                        },
                    },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {
                    zosmf: {
                        host: { type: "string" },
                    },
                },
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.parentProfile.type).toBe("zosmf");
            expect(profiles.parentProfile.profiles.childProfile.type).toBeUndefined();
            expect(profiles.parentProfile.profiles.childProfile.properties).toEqual({
                host: "child-host",
            });
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Setting type to undefined for profile "childProfile" with invalid type "invalid-type". Valid types are: zosmf'
            );
        });

        it("should handle deeply nested profiles", () => {
            const profiles = {
                level1: {
                    type: "zosmf",
                    profiles: {
                        level2: {
                            type: "zosmf",
                            profiles: {
                                level3: {
                                    type: "invalid-type",
                                    properties: {
                                        host: "deep-host",
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {
                    zosmf: {
                        host: { type: "string" },
                    },
                },
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.level1.type).toBe("zosmf");
            expect(profiles.level1.profiles.level2.type).toBe("zosmf");
            expect(profiles.level1.profiles.level2.profiles.level3.type).toBeUndefined();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Setting type to undefined for profile "level3" with invalid type "invalid-type". Valid types are: zosmf'
            );
        });

        it("should handle empty profiles object", () => {
            const profiles = {};

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles).toEqual({});
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should handle schema validation with empty propertySchema", () => {
            const profiles = {
                testProfile: {
                    type: "any-type",
                    properties: {
                        host: "test-host",
                    },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {},
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.testProfile.type).toBeUndefined();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Setting type to undefined for profile "testProfile" with invalid type "any-type". Valid types are: '
            );
        });

        it("should handle schema validation with null propertySchema", () => {
            const profiles = {
                testProfile: {
                    type: "any-type",
                    properties: {
                        host: "test-host",
                    },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: null as any,
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.testProfile.type).toBe("any-type");
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it("should handle multiple invalid profile types in the same profiles object", () => {
            const profiles = {
                invalid1: {
                    type: "invalid-type-1",
                    properties: { host: "host1" },
                },
                invalid2: {
                    type: "invalid-type-2",
                    properties: { host: "host2" },
                },
                valid: {
                    type: "zosmf",
                    properties: { host: "host3" },
                },
            };

            const schemaValidation: schemaValidation = {
                propertySchema: {
                    zosmf: {
                        host: { type: "string" },
                    },
                },
                validDefaults: [],
            };

            ConfigUtils.processProfilesRecursively(profiles, schemaValidation);

            expect(profiles.invalid1.type).toBeUndefined();
            expect(profiles.invalid2.type).toBeUndefined();
            expect(profiles.valid.type).toBe("zosmf");
            expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
        });

        it("should handle secure property with empty array", () => {
            const profiles = {
                emptySecureProfile: {
                    type: "zosmf",
                    secure: [],
                    properties: {
                        host: "test-host",
                        password: "secret-password",
                    },
                },
            };

            ConfigUtils.processProfilesRecursively(profiles);

            expect(profiles.emptySecureProfile.properties).toEqual({
                host: "test-host",
                password: "secret-password",
            });
        });

        it("should handle secure property with non-array value", () => {
            const profiles = {
                invalidSecureProfile: {
                    type: "zosmf",
                    secure: "not-an-array" as any,
                    properties: {
                        host: "test-host",
                        password: "secret-password",
                    },
                },
            };

            // This should not throw an error, but the secure filtering won't work
            expect(() => {
                ConfigUtils.processProfilesRecursively(profiles);
            }).not.toThrow();
        });
    });
});
