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

import { ConfigChangeHandlers, ChangeEntry } from "../../../../src/utils/ConfigChangeHandlers";
import { Mock, vi } from "vitest";
import { ProfileInfo } from "@zowe/imperative";
import { ConfigSchemaHelpers } from "../../../../src/utils/ConfigSchemaHelpers";

// Mock all external dependencies
vi.mock("@zowe/imperative", () => ({
    ProfileInfo: vi.fn().mockImplementation(() => ({
        readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
        getTeamConfig: vi.fn().mockReturnValue({
            api: {
                layers: {
                    get: vi.fn().mockReturnValue({
                        path: "/mock/config.json",
                        properties: {
                            $schema: "schema.json",
                        },
                    }),
                    activate: vi.fn(),
                },
                profiles: {
                    defaultSet: vi.fn(),
                },
            },
            layers: [],
            delete: vi.fn(),
            set: vi.fn(),
            save: vi.fn(),
        }),
    })),
    ProfileCredentials: {
        defaultCredMgrWithKeytar: vi.fn().mockReturnValue("mock-cred-mgr"),
    },
}));

vi.mock("@zowe/zowe-explorer-api", () => ({
    ProfilesCache: {
        requireKeyring: "mock-keyring",
    },
    ZoweVsCodeExtension: {
        workspaceRoot: {
            uri: {
                fsPath: "/mock/workspace",
            },
        },
    },
}));

vi.mock("../../../../src/utils/ConfigSchemaHelpers", () => ({
    ConfigSchemaHelpers: {
        getProfileProperties: vi.fn().mockReturnValue(new Map()),
    },
}));

vi.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: vi.fn().mockReturnValue({
            overrideWithEnv: false,
        }),
    },
}));

vi.mock("path", () => ({
    join: vi.fn().mockImplementation((...args: string[]) => args.join("/")),
    dirname: vi.fn().mockImplementation((p: string) => p.split("/").slice(0, -1).join("/")),
}));

// Mock other dependencies that might cause initialization issues
vi.mock("../../../../src/extending/ZoweExplorerApiRegister", () => ({
    ZoweExplorerApiRegister: {
        getInstance: vi.fn().mockReturnValue({
            registerUssApi: vi.fn(),
            registerMvsApi: vi.fn(),
            registerJesApi: vi.fn(),
        }),
    },
}));

vi.mock("../../../../src/tools/ZoweLogger", () => ({
    ZoweLogger: {
        error: vi.fn(),
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock("../../../../src/configuration/Constants", () => ({
    Constants: {
        PROFILES_CACHE: null,
        SETTINGS_OVERRIDE_WITH_ENV_VAR: "zowe.overrides.env",
    },
}));

describe("ConfigChangeHandlers", () => {
    let mockTeamConfig: any;
    let mockLayers: any;
    let mockProfiles: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Mock layers
        mockLayers = {
            find: vi.fn(),
        };

        // Mock profiles API
        mockProfiles = {
            defaultSet: vi.fn(),
        };

        // Mock team config
        mockTeamConfig = {
            api: {
                layers: {
                    get: vi.fn().mockReturnValue({
                        path: "/mock/config.json",
                        properties: {
                            $schema: "schema.json",
                        },
                    }),
                    activate: vi.fn(),
                },
                profiles: mockProfiles,
            },
            layers: mockLayers,
            delete: vi.fn(),
            set: vi.fn(),
            save: vi.fn(),
        };

        // Mock ProfileInfo constructor to return our mock
        vi.mocked(ProfileInfo).mockImplementation(
            () =>
                ({
                    readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
                    getTeamConfig: vi.fn().mockReturnValue(mockTeamConfig),
                } as any)
        );
    });

    describe("handleDefaultChanges", () => {
        it("should handle default changes successfully", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "host",
                    value: "test-host",
                    path: ["defaults", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "port",
                    value: "",
                    path: ["defaults", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const activeLayer = "/mock/config.json";

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer);

            expect(mockProfiles.defaultSet).toHaveBeenCalledWith("host", "test-host");
            expect(mockTeamConfig.delete).toHaveBeenCalledWith("defaults.port");
            expect(mockTeamConfig.save).toHaveBeenCalled();
        });

        it("should activate different layer when activeLayer differs from current", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const activeLayer = "/different/config.json";

            const mockLayer = {
                path: "/different/config.json",
                user: true,
                global: false,
            };

            mockLayers.find.mockReturnValue(mockLayer);
            mockTeamConfig.api.layers.get.mockReturnValue({
                path: "/current/config.json",
            });

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer);

            expect(mockLayers.find).toHaveBeenCalled();
            expect(mockTeamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
        });

        it("should not activate layer when activeLayer matches current", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const activeLayer = "/mock/config.json";

            mockTeamConfig.api.layers.get.mockReturnValue({
                path: "/mock/config.json",
            });

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer);

            expect(mockLayers.find).not.toHaveBeenCalled();
            expect(mockTeamConfig.api.layers.activate).not.toHaveBeenCalled();
        });

        it("should handle multiple changes and deletions", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "tso",
                    value: "tso1",
                    path: ["defaults", "tso"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "zosmf",
                    value: "zosmf1",
                    path: ["defaults", "zosmf"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "ssh",
                    value: "ssh1",
                    path: ["defaults", "ssh"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "base",
                    value: "base1",
                    path: ["defaults", "base"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, "/mock/config.json");

            expect(mockProfiles.defaultSet).toHaveBeenCalledTimes(2);
            expect(mockProfiles.defaultSet).toHaveBeenCalledWith("tso", "tso1");
            expect(mockProfiles.defaultSet).toHaveBeenCalledWith("zosmf", "zosmf1");

            expect(mockTeamConfig.delete).toHaveBeenCalledTimes(2);
            expect(mockTeamConfig.delete).toHaveBeenCalledWith("defaults.ssh");
            expect(mockTeamConfig.delete).toHaveBeenCalledWith("defaults.base");
        });

        it("should handle empty changes and deletions arrays", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, "/mock/config.json");

            expect(mockProfiles.defaultSet).not.toHaveBeenCalled();
            expect(mockTeamConfig.delete).not.toHaveBeenCalled();
            expect(mockTeamConfig.save).toHaveBeenCalled();
        });

        it("should not activate layer when findProfile returns undefined", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const activeLayer = "/different/config.json";

            mockLayers.find.mockReturnValue(undefined);
            mockTeamConfig.api.layers.get.mockReturnValue({
                path: "/current/config.json",
            });

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer);

            expect(mockLayers.find).toHaveBeenCalled();
            expect(mockTeamConfig.api.layers.activate).not.toHaveBeenCalled();
        });
    });

    describe("handleProfileChanges", () => {
        let mockAreSecureValuesAllowed: Mock;

        beforeEach(() => {
            mockAreSecureValuesAllowed = vi.fn().mockResolvedValue(true);
        });

        it("should handle profile changes successfully", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.port",
                    value: "",
                    path: ["profiles", "test", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const configPath = "/mock/config.json";

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, mockAreSecureValuesAllowed);

            expect(mockAreSecureValuesAllowed).toHaveBeenCalled();
            expect(mockTeamConfig.set).toHaveBeenCalledWith("profiles.test.host", "test-host", {
                parseString: false,
                secure: false,
            });
            expect(mockTeamConfig.delete).toHaveBeenCalledWith("profiles.test.port");
            expect(mockTeamConfig.save).toHaveBeenCalled();
        });

        it("should filter out secure changes when secure values not allowed", async () => {
            mockAreSecureValuesAllowed.mockResolvedValue(false);

            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "profiles.test.password",
                    value: "secret",
                    path: ["profiles", "test", "password"],
                    configPath: "/mock/config.json",
                    secure: true,
                },
            ];

            const deletions: ChangeEntry[] = [];

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(mockTeamConfig.set).toHaveBeenCalledTimes(1);
            expect(mockTeamConfig.set).toHaveBeenCalledWith("profiles.test.host", "test-host", {
                parseString: false,
                secure: false,
            });
        });

        it("should transform secure keys to properties in changes", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.secure.password",
                    value: "secret",
                    path: ["profiles", "test", "secure", "password"],
                    configPath: "/mock/config.json",
                    secure: true,
                },
            ];

            const deletions: ChangeEntry[] = [];

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(mockTeamConfig.set).toHaveBeenCalledWith("profiles.test.properties.password", "secret", {
                parseString: false,
                secure: true,
            });
        });

        it("should transform secure keys to properties in profile field", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    profile: "profiles.test.secure.password",
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [];

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(mockTeamConfig.set).toHaveBeenCalledWith("profiles.test.host", "test-host", {
                parseString: false,
                secure: false,
            });
        });

        it("should transform secure keys to properties in deletions", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.secure.password",
                    value: "",
                    path: ["profiles", "test", "secure", "password"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(mockTeamConfig.delete).toHaveBeenCalledWith("profiles.test.properties.password");
        });

        it("should activate different layer when configPath differs from current", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const configPath = "/different/config.json";

            const mockLayer = {
                path: "/different/config.json",
                user: false,
                global: true,
            };

            mockLayers.find.mockReturnValue(mockLayer);
            mockTeamConfig.api.layers.get.mockReturnValue({
                path: "/current/config.json",
            });

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, mockAreSecureValuesAllowed);

            expect(mockLayers.find).toHaveBeenCalled();
            expect(mockTeamConfig.api.layers.activate).toHaveBeenCalledWith(false, true);
        });

        it("should handle schema path and profile properties", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.port",
                    value: "443",
                    path: ["profiles", "test", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [];

            const mockProfileProps = new Map([["port", { type: "number", path: "profiles.test.port" }]]);

            vi.mocked(ConfigSchemaHelpers.getProfileProperties).mockReturnValue(mockProfileProps);

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(ConfigSchemaHelpers.getProfileProperties).toHaveBeenCalledWith("/mock/schema.json");
            expect(mockTeamConfig.set).toHaveBeenCalledWith("profiles.test.port", "443", {
                parseString: true,
                secure: false,
            });
        });

        it("should handle errors in set operation gracefully", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [];

            mockTeamConfig.set.mockImplementation(() => {
                throw new Error("Set operation failed");
            });

            // Should not throw
            await expect(
                ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed)
            ).resolves.not.toThrow();

            expect(mockTeamConfig.set).toHaveBeenCalled();
        });

        it("should handle errors in delete operation gracefully", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            mockTeamConfig.delete.mockImplementation(() => {
                throw new Error("Delete operation failed");
            });

            // Should not throw
            await expect(
                ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed)
            ).resolves.not.toThrow();

            expect(mockTeamConfig.delete).toHaveBeenCalled();
        });

        it("should handle empty changes and deletions arrays", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", mockAreSecureValuesAllowed);

            expect(mockAreSecureValuesAllowed).toHaveBeenCalled();
            expect(mockTeamConfig.set).not.toHaveBeenCalled();
            expect(mockTeamConfig.delete).not.toHaveBeenCalled();
            expect(mockTeamConfig.save).toHaveBeenCalled();
        });
    });

    describe("handleDefaultChanges (simulation mode)", () => {
        it("should simulate default changes without affecting original config", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "ssh",
                    value: "test-ssh",
                    path: ["defaults", "ssh"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "base",
                    value: "",
                    path: ["defaults", "base"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const activeLayer = "/mock/config.json";
            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                    profiles: {
                        defaultSet: vi.fn(),
                    },
                },
                layers: [],
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer, teamConfig);

            expect(teamConfig.api.profiles.defaultSet).toHaveBeenCalledWith("ssh", "test-ssh");
            expect(teamConfig.delete).toHaveBeenCalledWith("defaults.base");
        });

        it("should activate different layer when activeLayer differs from current", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const activeLayer = "/different/config.json";

            const mockLayer = {
                path: "/different/config.json",
                user: true,
                global: false,
            };

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/current/config.json" }),
                        activate: vi.fn(),
                    },
                    profiles: {
                        defaultSet: vi.fn(),
                    },
                },
                layers: [mockLayer],
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, activeLayer, teamConfig);

            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
        });

        it("should handle multiple changes and deletions", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "ssh",
                    value: "ssh1",
                    path: ["defaults", "ssh"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "zosmf",
                    value: "zosmf1",
                    path: ["defaults", "zosmf"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "base",
                    value: "base1",
                    path: ["defaults", "base"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                    profiles: {
                        defaultSet: vi.fn(),
                    },
                },
                layers: [],
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleDefaultChanges(changes, deletions, "/mock/config.json", teamConfig);

            expect(teamConfig.api.profiles.defaultSet).toHaveBeenCalledTimes(2);
            expect(teamConfig.api.profiles.defaultSet).toHaveBeenCalledWith("ssh", "ssh1");
            expect(teamConfig.api.profiles.defaultSet).toHaveBeenCalledWith("zosmf", "zosmf1");
            expect(teamConfig.delete).toHaveBeenCalledWith("defaults.base");
        });
    });

    describe("handleProfileChanges (simulation mode)", () => {
        it("should simulate profile changes without affecting original config", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.port",
                    value: "",
                    path: ["profiles", "test", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const configPath = "/mock/config.json";
            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, undefined, teamConfig);

            expect(teamConfig.set).toHaveBeenCalledWith("profiles.test.host", "test-host", {
                parseString: true,
                secure: false,
            });
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.test.port");
        });

        it("should transform secure keys to properties in changes", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.secure.password",
                    value: "secret",
                    path: ["profiles", "test", "secure", "password"],
                    configPath: "/mock/config.json",
                    secure: true,
                },
            ];

            const deletions: ChangeEntry[] = [];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.set).toHaveBeenCalledWith("profiles.test.properties.password", "secret", {
                parseString: true,
                secure: true,
            });
        });

        it("should transform secure keys to properties in profile field", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    profile: "profiles.test.secure.password",
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.set).toHaveBeenCalledWith("profiles.test.host", "test-host", {
                parseString: true,
                secure: false,
            });
        });

        it("should transform secure keys to properties in deletions", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.secure.password",
                    value: "",
                    path: ["profiles", "test", "secure", "password"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.test.properties.password");
        });

        it("should activate different layer when configPath differs from current", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];
            const configPath = "/different/config.json";

            const mockLayer = {
                path: "/different/config.json",
                user: false,
                global: true,
            };

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/current/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [mockLayer],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, undefined, teamConfig);

            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(false, true);
        });

        it("should handle errors in set operation gracefully", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "test-host",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn().mockImplementation(() => {
                    throw new Error("Set operation failed");
                }),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.set).toHaveBeenCalled();
        });

        it("should handle errors in delete operation gracefully", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test.host",
                    value: "",
                    path: ["profiles", "test", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn().mockImplementation(() => {
                    throw new Error("Delete operation failed");
                }),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.delete).toHaveBeenCalled();
        });

        it("should handle empty changes and deletions arrays", async () => {
            const changes: ChangeEntry[] = [];
            const deletions: ChangeEntry[] = [];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.set).not.toHaveBeenCalled();
            expect(teamConfig.delete).not.toHaveBeenCalled();
        });

        it("should handle multiple changes and deletions", async () => {
            const changes: ChangeEntry[] = [
                {
                    key: "profiles.test1.host",
                    value: "host1",
                    path: ["profiles", "test1", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "profiles.test2.host",
                    value: "host2",
                    path: ["profiles", "test2", "host"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const deletions: ChangeEntry[] = [
                {
                    key: "profiles.test1.port",
                    value: "",
                    path: ["profiles", "test1", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
                {
                    key: "profiles.test2.port",
                    value: "",
                    path: ["profiles", "test2", "port"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ];

            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn().mockReturnValue({ path: "/mock/config.json" }),
                        activate: vi.fn(),
                    },
                },
                layers: [],
                set: vi.fn(),
                delete: vi.fn(),
            };

            await ConfigChangeHandlers.handleProfileChanges(changes, deletions, "/mock/config.json", undefined, teamConfig);

            expect(teamConfig.set).toHaveBeenCalledTimes(2);
            expect(teamConfig.set).toHaveBeenCalledWith("profiles.test1.host", "host1", {
                parseString: true,
                secure: false,
            });
            expect(teamConfig.set).toHaveBeenCalledWith("profiles.test2.host", "host2", {
                parseString: true,
                secure: false,
            });

            expect(teamConfig.delete).toHaveBeenCalledTimes(2);
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.test1.port");
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.test2.port");
        });
    });
});
