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

import { ConfigEditorMergedProperties } from "../../../../src/utils/ConfigEditorMergedProperties";
import { ConfigEditorProfileOperations } from "../../../../src/utils/ConfigEditorProfileOperations";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigChangeHandlers } from "../../../../src/utils/ConfigChangeHandlers";
import { vi, Mock } from "vitest";
import * as path from "path";

vi.mock("../../../../src/utils/ConfigUtils", () => ({
    ConfigUtils: {
        createProfileInfoAndLoad: vi.fn(),
        parseConfigChanges: vi.fn(),
    },
}));

vi.mock("../../../../src/utils/ConfigChangeHandlers", () => ({
    ConfigChangeHandlers: {
        handleDefaultChanges: vi.fn(),
        handleProfileChanges: vi.fn(),
    },
}));

const createMockProfileOperations = () =>
    ({
        simulateProfileRenames: vi.fn(),
        updateProfileChangesForRenames: vi.fn(),
        redactSecureValues: vi.fn((knownArgs: unknown) => knownArgs),
    }) as unknown as ConfigEditorProfileOperations;

describe("ConfigEditorMergedProperties", () => {
    let mockProfileOperations: ConfigEditorProfileOperations;
    let mergedProperties: ConfigEditorMergedProperties;

    beforeEach(() => {
        vi.clearAllMocks();
        mockProfileOperations = createMockProfileOperations();
        mergedProperties = new ConfigEditorMergedProperties(mockProfileOperations);
        (mockProfileOperations.redactSecureValues as Mock).mockImplementation((knownArgs: unknown) => knownArgs);
        (ConfigUtils.parseConfigChanges as Mock).mockReturnValue([]);
    });

    describe("getPendingMergedArgsForProfile", () => {
        it("should return merged args for profile successfully", async () => {
            const profPath = "profiles.testProfile";
            const configPath = "/test/config/path";
            const changes = { configPath, changes: [], deletions: [], defaultsChanges: [], defaultsDeleteKeys: [] } as any;
            const renames: any[] = [];

            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({
                    layers: [{ path: configPath, user: true, global: false }],
                    api: {
                        layers: { activate: vi.fn(), get: vi.fn(() => ({ path: configPath })) },
                        secure: { secureFields: vi.fn().mockReturnValue([]) },
                    },
                })),
                getAllProfiles: vi.fn(() => [{ profName: profPath, profType: "zosmf", profLoc: { osLoc: path.normalize(configPath) } }]),
                mergeArgsForProfile: vi.fn(() => ({
                    knownArgs: [{ argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.host" }, argValue: "new.host.com" }],
                })),
            };

            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const result = await mergedProperties.getPendingMergedArgsForProfile(profPath, configPath, changes, renames);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).toHaveBeenCalled();
            expect(mockProfileOperations.redactSecureValues).toHaveBeenCalled();
            expect(result).toEqual([{ argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.host" }, argValue: "new.host.com" }]);
        });

        it("should return undefined when profile is not found", async () => {
            const configPath = "/test/config/path";
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({
                    layers: [],
                    api: { layers: { activate: vi.fn() } },
                })),
                getAllProfiles: vi.fn(() => []),
                mergeArgsForProfile: vi.fn(),
            };

            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const result = await mergedProperties.getPendingMergedArgsForProfile("profiles.nonexistentProfile", configPath, {} as any, []);

            expect(result).toBeUndefined();
            expect(mockProfileInfo.mergeArgsForProfile).not.toHaveBeenCalled();
        });

        it("should simulate renames against the team config when renames are provided", async () => {
            const configPath = "/test/config/path";
            const teamConfig = {
                layers: [],
                api: { layers: { activate: vi.fn() } },
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => teamConfig),
                getAllProfiles: vi.fn(() => []),
                mergeArgsForProfile: vi.fn(),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const renames = [{ originalKey: "profiles.old", newKey: "profiles.new", configPath }];
            (mockProfileOperations.updateProfileChangesForRenames as Mock).mockResolvedValue({ configPath, changes: [], deletions: [] });
            await mergedProperties.getPendingMergedArgsForProfile("profiles.old", configPath, {} as any, renames);

            expect(mockProfileOperations.simulateProfileRenames).toHaveBeenCalledWith(renames, teamConfig);
        });

        it("should route pending changes through updateProfileChangesForRenames when renames are provided", async () => {
            const configPath = "/test/config/path";
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({ layers: [], api: { layers: { activate: vi.fn() } } })),
                getAllProfiles: vi.fn(() => []),
                mergeArgsForProfile: vi.fn(),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const changes = { configPath, changes: [{ key: "a" }], deletions: [], defaultsChanges: [], defaultsDeleteKeys: [] } as any;
            const renames = [{ originalKey: "profiles.old", newKey: "profiles.new", configPath }];
            const effectiveChanges = { configPath, changes: [{ key: "b" }], deletions: [], defaultsChanges: [], defaultsDeleteKeys: [] };
            (mockProfileOperations.updateProfileChangesForRenames as Mock).mockResolvedValue(effectiveChanges);

            await mergedProperties.getPendingMergedArgsForProfile("profiles.old", configPath, changes, renames);

            expect(mockProfileOperations.updateProfileChangesForRenames).toHaveBeenCalledWith(changes, renames);
            expect(ConfigUtils.parseConfigChanges).toHaveBeenCalledWith(effectiveChanges);
        });

        it("should apply pending changes returned by parseConfigChanges", async () => {
            const configPath = "/test/config/path";
            const teamConfig = {
                layers: [],
                api: { layers: { activate: vi.fn() } },
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => teamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "profiles.testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);
            (ConfigUtils.parseConfigChanges as Mock).mockReturnValue([
                { configPath, defaultsChanges: [{ key: "a" }], defaultsDeleteKeys: [], changes: [{ key: "b" }], deletions: [] },
            ]);

            await mergedProperties.getPendingMergedArgsForProfile(
                "profiles.testProfile",
                configPath,
                { configPath, changes: [], deletions: [], defaultsChanges: [], defaultsDeleteKeys: [] } as any,
                []
            );

            expect(ConfigChangeHandlers.handleDefaultChanges).toHaveBeenCalledWith([{ key: "a" }], [], configPath, teamConfig);
            expect(ConfigChangeHandlers.handleProfileChanges).toHaveBeenCalledWith([{ key: "b" }], [], configPath, undefined, teamConfig);
        });

        it("should return undefined and log a warning when mergeArgsForProfile throws", async () => {
            const configPath = "/test/config/path";
            const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({ layers: [], api: { layers: { activate: vi.fn() } } })),
                getAllProfiles: vi.fn(() => [{ profName: "profiles.testProfile", profType: "zosmf", profLoc: { osLoc: path.normalize(configPath) } }]),
                mergeArgsForProfile: vi.fn(() => {
                    throw new Error("schema load failed");
                }),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const result = await mergedProperties.getPendingMergedArgsForProfile(
                "profiles.testProfile",
                configPath,
                { configPath, changes: [], deletions: [], defaultsChanges: [], defaultsDeleteKeys: [] } as any,
                []
            );

            expect(result).toBeUndefined();
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load schema for profile type "zosmf"'));
            consoleWarnSpy.mockRestore();
        });
    });

    describe("layerHasField", () => {
        it("should return true when layer has the field", () => {
            const layer = {
                properties: { profiles: { testProfile: { properties: { host: "test.host.com", port: 443 } } } },
            } as any;
            const result = (mergedProperties as any).layerHasField(layer, "profiles.testProfile.properties.host");
            expect(result).toBe(true);
        });

        it("should return false when layer does not have the field", () => {
            const layer = { properties: { profiles: { testProfile: { properties: { port: 443 } } } } } as any;
            const result = (mergedProperties as any).layerHasField(layer, "profiles.testProfile.properties.host");
            expect(result).toBe(false);
        });

        it("should return false when layer has no properties", () => {
            const result = (mergedProperties as any).layerHasField({} as any, "profiles.testProfile.properties.host");
            expect(result).toBe(false);
        });

        it("should return false when jsonLoc format is invalid", () => {
            const layer = { properties: { profiles: { testProfile: { properties: { host: "test.host.com" } } } } } as any;
            const result = (mergedProperties as any).layerHasField(layer, "invalid.format");
            expect(result).toBe(false);
        });
    });

    describe("applySecureFieldPrecedence", () => {
        it("should mark an argument as secure when the defining layer has it in its secure fields", () => {
            const teamConfig = {
                layers: [
                    { user: true, global: false, properties: { profiles: { testProfile: { properties: { host: "test.host.com" } } } } },
                    { user: false, global: true, properties: { profiles: {} } },
                ],
                api: {
                    secure: {
                        secureFields: vi.fn((opts: { user: boolean; global: boolean }) =>
                            opts.user ? ["profiles.testProfile.properties.host"] : []
                        ),
                    },
                },
            } as any;
            const knownArgs = [{ argLoc: { osLoc: "/c", jsonLoc: "profiles.testProfile.properties.host" } }] as any;

            (mergedProperties as any).applySecureFieldPrecedence(teamConfig, knownArgs);

            expect(knownArgs[0].secure).toBe(true);
        });

        it("should not mark an argument as secure when the defining layer does not have it in its secure fields", () => {
            const teamConfig = {
                layers: [{ user: true, global: false, properties: { profiles: { testProfile: { properties: { host: "test.host.com" } } } } }],
                api: { secure: { secureFields: vi.fn().mockReturnValue([]) } },
            } as any;
            const knownArgs = [{ argLoc: { osLoc: "/c", jsonLoc: "profiles.testProfile.properties.host" } }] as any;

            (mergedProperties as any).applySecureFieldPrecedence(teamConfig, knownArgs);

            expect(knownArgs[0].secure).toBeUndefined();
        });

        it("should fall back to checking every layer's secure fields when no layer defines the field", () => {
            const teamConfig = {
                layers: [{ user: true, global: false, properties: { profiles: {} } }],
                api: { secure: { secureFields: vi.fn().mockReturnValue(["profiles.testProfile.properties.host"]) } },
            } as any;
            const knownArgs = [{ argLoc: { osLoc: "/c", jsonLoc: "profiles.testProfile.properties.host" } }] as any;

            (mergedProperties as any).applySecureFieldPrecedence(teamConfig, knownArgs);

            expect(knownArgs[0].secure).toBe(true);
        });

        it("should do nothing when knownArgs is not an array", () => {
            const teamConfig = { layers: [], api: { secure: { secureFields: vi.fn() } } } as any;
            expect(() => (mergedProperties as any).applySecureFieldPrecedence(teamConfig, undefined)).not.toThrow();
        });

        it("should skip args without an argLoc", () => {
            const teamConfig = { layers: [], api: { secure: { secureFields: vi.fn().mockReturnValue([]) } } } as any;
            const knownArgs = [{}] as any;
            expect(() => (mergedProperties as any).applySecureFieldPrecedence(teamConfig, knownArgs)).not.toThrow();
            expect(knownArgs[0].secure).toBeUndefined();
        });
    });

    describe("getWizardMergedProperties", () => {
        it("should return an empty array when profileType is not provided", async () => {
            const result = await mergedProperties.getWizardMergedProperties("root", "", "/test/config/path");
            expect(result).toEqual([]);
            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should return merged properties for a wizard profile successfully", async () => {
            const configPath = "/test/config/path";
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({
                    layers: [{ path: configPath, user: true, global: false }],
                    api: {
                        layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() },
                        secure: { secureFields: vi.fn().mockReturnValue([]) },
                    },
                    set: vi.fn(),
                    delete: vi.fn(),
                })),
                getAllProfiles: vi.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({
                    knownArgs: [{ argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.host" }, argValue: "test.host.com" }],
                })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const result = await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile", undefined, []);

            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).toHaveBeenCalled();
            expect(result).toEqual([
                { argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.host" }, argValue: "test.host.com" },
            ]);
        });

        it("should return an empty array when the temporary profile cannot be found", async () => {
            const configPath = "/test/config/path";
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({
                    layers: [{ path: configPath, user: true, global: false }],
                    api: { layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() } },
                    set: vi.fn(),
                    delete: vi.fn(),
                })),
                getAllProfiles: vi.fn(() => []),
                mergeArgsForProfile: vi.fn(),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const result = await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "nonexistentProfile");

            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it("should simulate renames and remap the root profile before building the temp profile", async () => {
            const configPath = "/test/config/path";
            const mockTeamConfig = {
                layers: [{ path: configPath, user: true, global: false }],
                api: { layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() } },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => mockTeamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "newParent.child.testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            const renames = [{ originalKey: "profiles.oldParent", newKey: "profiles.newParent", configPath }];

            const result = await mergedProperties.getWizardMergedProperties(
                "oldParent.child",
                "zosmf",
                configPath,
                "testProfile",
                undefined,
                renames
            );

            expect(mockProfileOperations.simulateProfileRenames).toHaveBeenCalledWith(renames, mockTeamConfig);
            expect(result).toBeDefined();
        });

        it("should rethrow and log when simulating renames fails", async () => {
            const configPath = "/test/config/path";
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => ({
                    layers: [],
                    api: { layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn() } },
                })),
                getAllProfiles: vi.fn(() => []),
                mergeArgsForProfile: vi.fn(),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);
            (mockProfileOperations.simulateProfileRenames as Mock).mockImplementation(() => {
                throw new Error("simulation blew up");
            });
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            await expect(
                mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile", undefined, [
                    { originalKey: "profiles.a", newKey: "profiles.b", configPath },
                ])
            ).rejects.toThrow("simulation blew up");

            expect(consoleErrorSpy).toHaveBeenCalledWith("Simulation failed:", "simulation blew up");
            consoleErrorSpy.mockRestore();
        });

        it("should apply pending changes before building the temporary profile", async () => {
            const configPath = "/test/config/path";
            const mockTeamConfig = {
                layers: [{ path: configPath, user: true, global: false }],
                api: { layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() } },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => mockTeamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);
            (ConfigUtils.parseConfigChanges as Mock).mockReturnValue([
                { configPath, defaultsChanges: [{ key: "a" }], defaultsDeleteKeys: [], changes: [{ key: "b" }], deletions: [] },
            ]);

            await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile", {
                configPath,
                changes: [],
                deletions: [],
                defaultsChanges: [],
                defaultsDeleteKeys: [],
            } as any);

            expect(ConfigChangeHandlers.handleDefaultChanges).toHaveBeenCalledWith([{ key: "a" }], [], configPath, mockTeamConfig);
            expect(ConfigChangeHandlers.handleProfileChanges).toHaveBeenCalledWith([{ key: "b" }], [], configPath, undefined, mockTeamConfig);
        });

        it("should activate the requested layer when it differs from the currently active one", async () => {
            const configPath = "/other/config/path";
            const activateSpy = vi.fn();
            const mockTeamConfig = {
                layers: [{ path: configPath, user: false, global: true }],
                api: { layers: { get: vi.fn(() => ({ path: "/current/config/path" })), activate: activateSpy, set: vi.fn() } },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => mockTeamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile");

            expect(activateSpy).toHaveBeenCalledWith(false, true);
        });

        it("should clean up the temporary profile even when merging succeeds", async () => {
            const configPath = "/test/config/path";
            const deleteSpy = vi.fn();
            const mockTeamConfig = {
                layers: [{ path: configPath, user: true, global: false }],
                api: { layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() } },
                set: vi.fn(),
                delete: deleteSpy,
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => mockTeamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);

            await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile");

            expect(deleteSpy).toHaveBeenCalledWith("profiles.testProfile");
        });

        it("should redact secure values detected via secure field precedence", async () => {
            const configPath = "/test/config/path";
            const mockTeamConfig = {
                layers: [{ path: configPath, user: true, global: false }],
                api: {
                    layers: { get: vi.fn(() => ({ path: configPath })), activate: vi.fn(), set: vi.fn() },
                    secure: { secureFields: vi.fn().mockReturnValue(["profiles.testProfile.properties.password"]) },
                },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const mockProfileInfo = {
                getTeamConfig: vi.fn(() => mockTeamConfig),
                getAllProfiles: vi.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: configPath } }]),
                mergeArgsForProfile: vi.fn(() => ({
                    knownArgs: [{ argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.password" }, argValue: "secret" }],
                })),
            };
            (ConfigUtils.createProfileInfoAndLoad as Mock).mockResolvedValue(mockProfileInfo);
            (mockProfileOperations.redactSecureValues as Mock).mockReturnValue([
                { argLoc: { osLoc: configPath, jsonLoc: "profiles.testProfile.properties.password" }, argValue: "secret", secure: true },
            ]);

            const result: any = await mergedProperties.getWizardMergedProperties("root", "zosmf", configPath, "testProfile");

            expect(mockProfileOperations.redactSecureValues).toHaveBeenCalled();
            expect(result[0].secure).toBe(true);
        });
    });
});
