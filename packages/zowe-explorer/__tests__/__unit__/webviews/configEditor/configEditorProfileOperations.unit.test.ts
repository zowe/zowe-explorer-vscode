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

import { ConfigEditorProfileOperations } from "../../../../src/utils/ConfigEditorProfileOperations";
import { ConfigMoveAPI, IConfigLayer } from "../../../../src/webviews/src/config-editor/types";
import { vi, Mock, type MockInstance } from "vitest";
import * as vscode from "vscode";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigEditorPathUtils } from "../../../../src/utils/ConfigEditorPathUtils";
import { FavoritePersistenceUtils } from "../../../../src/utils/FavoritePersistenceUtils";
import { createEditorConfig, createEditorLayer, createEditorChange } from "../../../__mocks__/mockCreators/configEditor";
import { findProfile } from "../../../../src/webviews/src/config-editor/utils/configUtils";

vi.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: vi.fn().mockReturnValue({
            overrideWithEnv: false,
            refresh: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

vi.mock("../../../../src/utils/FavoritePersistenceUtils", () => ({
    FavoritePersistenceUtils: {
        applyProfileRenameToStoredTreePersistence: vi.fn().mockResolvedValue(undefined),
        fireAndForgetExplorerTreeRebuildAfterRename: vi.fn(),
    },
}));

describe("ConfigEditorProfileOperations", () => {
    let profileOperations: ConfigEditorProfileOperations;
    let warn: MockInstance;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(ConfigEditorPathUtils, "constructNestedProfilePath");
        vi.spyOn(ConfigEditorPathUtils, "getNewProfilePath");
        vi.spyOn(ConfigEditorPathUtils, "updateChangeKey");
        vi.spyOn(ConfigEditorPathUtils, "updateChangePath");
        profileOperations = new ConfigEditorProfileOperations();
    });

    afterEach(() => vi.restoreAllMocks());

    describe("wouldCreateCircularReference", () => {
        it("should return false for non-child relationship", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "sibling");
            expect(result).toBe(false);
        });

        it("should return false for simple child relationship", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.child");
            expect(result).toBe(false);
        });

        it("should return true for direct circular reference", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.parent");
            expect(result).toBe(true);
        });

        it("should return true for nested circular reference", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.child.parent");
            expect(result).toBe(true);
        });

        it("should return true for complex circular reference", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.child.parent.grandchild");
            expect(result).toBe(true);
        });

        it("should return false for non-circular nested structure", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.child.grandchild");
            expect(result).toBe(false);
        });

        it("should return true when child part equals original key", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.parent.child");
            expect(result).toBe(true);
        });
    });

    describe("isNestedProfileCreation", () => {
        it("should return true for single-level profile creating nested structure", () => {
            const result = profileOperations.isNestedProfileCreation("parent", "parent.child");
            expect(result).toBe(true);
        });

        it("should return false for multi-level original key", () => {
            const result = profileOperations.isNestedProfileCreation("parent.child", "parent.child.grandchild");
            expect(result).toBe(false);
        });

        it("should return false for non-nested rename", () => {
            const result = profileOperations.isNestedProfileCreation("parent", "renamed");
            expect(result).toBe(false);
        });

        it("should return false for same key", () => {
            const result = profileOperations.isNestedProfileCreation("parent", "parent");
            expect(result).toBe(false);
        });
    });

    describe("createNestedProfileStructure", () => {
        let mockConfigMoveAPI: ConfigMoveAPI;
        let mockLayerActive: () => IConfigLayer;

        beforeEach(() => {
            mockConfigMoveAPI = {
                get: vi.fn() as any,
                set: vi.fn() as any,
                delete: vi.fn() as any,
            };
            mockLayerActive = vi.fn().mockReturnValue({
                properties: {
                    profiles: {},
                },
            }) as any;
        });

        it("should create nested profile structure", () => {
            const originalProfile = { host: "localhost", port: 8080 };
            (mockConfigMoveAPI.get as any).mockReturnValue(originalProfile);

            profileOperations.createNestedProfileStructure(
                mockConfigMoveAPI,
                mockLayerActive,
                "profiles.parent",
                "profiles.parent.profiles.child",
                "parent",
                "parent.child"
            );

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent", {
                host: "localhost",
                port: 8080,
                profiles: {
                    child: originalProfile,
                },
            });
            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent.profiles.child", {
                host: "localhost",
                port: 8080,
            });
        });

        it("should throw error when source profile not found", () => {
            (mockConfigMoveAPI.get as any).mockReturnValue(null);

            expect(() => {
                profileOperations.createNestedProfileStructure(
                    mockConfigMoveAPI,
                    mockLayerActive,
                    "profiles.nonexistent",
                    "profiles.nonexistent.profiles.child",
                    "nonexistent",
                    "nonexistent.child"
                );
            }).toThrow("Source profile not found at path: profiles.nonexistent");
        });

        it("should handle profile with existing profiles property", () => {
            const originalProfile = { host: "localhost", profiles: { existing: {} } };
            (mockConfigMoveAPI.get as any).mockReturnValue(originalProfile);

            profileOperations.createNestedProfileStructure(
                mockConfigMoveAPI,
                mockLayerActive,
                "profiles.parent",
                "profiles.parent.profiles.child",
                "parent",
                "parent.child"
            );

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent", {
                host: "localhost",
                profiles: {
                    child: originalProfile,
                },
            });
            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent.profiles.child", {
                host: "localhost",
            });
        });

        it("should move secure properties from parent to child", () => {
            const originalProfile = { host: "localhost", secure: ["password", "token"] };
            (mockConfigMoveAPI.get as any)
                .mockReturnValueOnce(originalProfile) // First call for original profile
                .mockReturnValueOnce(originalProfile) // Second call for secure properties
                .mockReturnValueOnce({ host: "localhost" }) // Third call for child profile
                .mockReturnValueOnce({ host: "localhost", secure: ["password", "token"] }); // Fourth call for parent profile

            profileOperations.createNestedProfileStructure(
                mockConfigMoveAPI,
                mockLayerActive,
                "profiles.parent",
                "profiles.parent.profiles.child",
                "parent",
                "parent.child"
            );

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent.profiles.child.secure", ["password", "token"]);
            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent", {
                host: "localhost",
                profiles: {
                    child: originalProfile,
                },
                secure: ["password", "token"],
            });
        });

        it("should handle secure properties when child profile is null", () => {
            const originalProfile = { host: "localhost", secure: ["password"] };
            (mockConfigMoveAPI.get as any)
                .mockReturnValueOnce(originalProfile) // First call for original profile
                .mockReturnValueOnce(originalProfile) // Second call for secure properties
                .mockReturnValueOnce(null); // Third call for child profile returns null

            profileOperations.createNestedProfileStructure(
                mockConfigMoveAPI,
                mockLayerActive,
                "profiles.parent",
                "profiles.parent.profiles.child",
                "parent",
                "parent.child"
            );

            // Should not call set for child secure properties when child is null
            expect(mockConfigMoveAPI.set).not.toHaveBeenCalledWith("profiles.parent.profiles.child.secure", expect.anything());
        });

        it("should handle secure properties when parent profile has no secure property", () => {
            const originalProfile = { host: "localhost" };
            (mockConfigMoveAPI.get as any)
                .mockReturnValueOnce(originalProfile) // First call for original profile
                .mockReturnValueOnce(originalProfile) // Second call for secure properties
                .mockReturnValueOnce({ host: "localhost" }) // Third call for child profile
                .mockReturnValueOnce({ host: "localhost" }); // Fourth call for parent profile (no secure)

            profileOperations.createNestedProfileStructure(
                mockConfigMoveAPI,
                mockLayerActive,
                "profiles.parent",
                "profiles.parent.profiles.child",
                "parent",
                "parent.child"
            );

            // When there are no secure properties, the secure properties movement should not be called
            expect(mockConfigMoveAPI.set).not.toHaveBeenCalledWith("profiles.parent.profiles.child.secure", expect.anything());
        });

        it("should handle errors in secure properties movement gracefully", () => {
            const originalProfile = { host: "localhost", secure: ["password"] };
            (mockConfigMoveAPI.get as any)
                .mockReturnValueOnce(originalProfile) // First call for original profile
                .mockImplementationOnce(() => {
                    throw new Error("Secure properties error");
                }); // Second call throws error

            // Should not throw error even if secure properties movement fails
            expect(() => {
                profileOperations.createNestedProfileStructure(
                    mockConfigMoveAPI,
                    mockLayerActive,
                    "profiles.parent",
                    "profiles.parent.profiles.child",
                    "parent",
                    "parent.child"
                );
            }).not.toThrow();

            expect(warn).toHaveBeenCalledWith("Failed to move secure properties for nested profile creation: Error: Secure properties error");
        });
    });

    describe("redactSecureValues", () => {
        it("should return non-object input unchanged", () => {
            expect(profileOperations.redactSecureValues("string")).toBe("string");
            expect(profileOperations.redactSecureValues(123)).toBe(123);
            expect(profileOperations.redactSecureValues(null)).toBe(null);
            expect(profileOperations.redactSecureValues(undefined)).toBe(undefined);
        });

        it("should return null/undefined unchanged", () => {
            expect(profileOperations.redactSecureValues(null)).toBe(null);
            expect(profileOperations.redactSecureValues(undefined)).toBe(undefined);
        });

        it("should redact secure values in objects with argValue", () => {
            const input = {
                password: {
                    secure: true,
                    argValue: "secret123",
                },
            };
            const result = profileOperations.redactSecureValues(input);
            expect(result.password.argValue).toBe("REDACTED");
        });

        it("should redact secure values in objects with value", () => {
            const input = {
                password: {
                    secure: true,
                    value: "secret123",
                },
            };
            const result = profileOperations.redactSecureValues(input);
            expect(result.password.value).toBe("REDACTED");
        });

        it("should handle arrays with secure items", () => {
            const input = [
                {
                    secure: true,
                    argValue: "secret123",
                },
            ];
            const result = profileOperations.redactSecureValues(input);
            expect(result[0].argValue).toBe("REDACTED");
        });

        it("should handle arrays with secure items using value field", () => {
            const input = [
                {
                    secure: true,
                    value: "secret123",
                },
            ];
            const result = profileOperations.redactSecureValues(input);
            expect(result[0].value).toBe("REDACTED");
        });

        it("should recursively process nested objects", () => {
            const input = {
                level1: {
                    level2: {
                        password: {
                            secure: true,
                            value: "secret123",
                        },
                    },
                },
            };
            const result = profileOperations.redactSecureValues(input);
            expect(result.level1.level2.password.value).toBe("REDACTED");
        });

        it("should recursively process nested arrays", () => {
            const input = [
                {
                    items: [
                        {
                            password: {
                                secure: true,
                                value: "secret123",
                            },
                        },
                    ],
                },
            ];
            const result = profileOperations.redactSecureValues(input);
            expect(result[0].items[0].password.value).toBe("REDACTED");
        });

        it("should not modify non-secure values", () => {
            const input = {
                username: {
                    secure: false,
                    value: "user123",
                },
                password: {
                    secure: true,
                    value: "secret123",
                },
            };
            const result = profileOperations.redactSecureValues(input);
            expect(result.username.value).toBe("user123");
            expect(result.password.value).toBe("REDACTED");
        });

        it("should handle objects without secure property", () => {
            const input = {
                username: {
                    value: "user123",
                },
            };
            const result = profileOperations.redactSecureValues(input);
            expect(result.username.value).toBe("user123");
        });
    });

    describe("validateProfileName", () => {
        it("should return valid for empty profile name", () => {
            const result = profileOperations.validateProfileName({
                profileName: "",
                rootProfile: "root",
                configPath: "/config.json",
                profiles: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(true);
        });

        it("should return invalid when profile name exists under root", () => {
            const profiles = {
                existingProfile: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "existingProfile",
                rootProfile: "root",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return invalid when profile name differs only by case from an existing profile", () => {
            const profiles = {
                zosmf: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "zOSmF",
                rootProfile: "root",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return invalid when profile name exists under nested root", () => {
            const profiles = {
                parent: {
                    type: "zosmf",
                    profiles: {
                        child: {
                            type: "tso",
                            properties: {},
                        },
                    },
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "child",
                rootProfile: "parent",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return invalid when profile name exists in pending changes", () => {
            const pendingChanges = {
                "/config.json": {
                    "profiles.newProfile.type": {
                        profile: "newProfile",
                        value: "zosmf",
                        path: ["profiles", "newProfile", "type"],
                    },
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "newProfile",
                rootProfile: "root",
                configPath: "/config.json",
                profiles: {},
                pendingChanges,
                renames: {},
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return invalid when profile name conflicts with renamed profile", () => {
            const renames = {
                "/config.json": {
                    oldProfile: "newProfile",
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "newProfile",
                rootProfile: "root",
                configPath: "/config.json",
                profiles: { oldProfile: { type: "zosmf" } },
                pendingChanges: {},
                renames,
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return valid when creating a child under a renamed parent", () => {
            const profiles = {
                oldParent: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "child",
                rootProfile: "newParent",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: { "/config.json": { oldParent: "newParent" } },
            });
            expect(result.isValid).toBe(true);
        });

        it("should return invalid when a child under a renamed parent already exists", () => {
            const profiles = {
                oldParent: {
                    type: "zosmf",
                    profiles: {
                        child: {
                            type: "tso",
                            properties: {},
                        },
                    },
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "child",
                rootProfile: "newParent",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: { "/config.json": { oldParent: "newParent" } },
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toContain("already exists");
        });

        it("should return valid when profile name is available", () => {
            const result = profileOperations.validateProfileName({
                profileName: "newProfile",
                rootProfile: "root",
                configPath: "/config.json",
                profiles: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(true);
        });

        it("should handle nested profile name validation", () => {
            const profiles = {
                parent: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName({
                profileName: "newChild",
                rootProfile: "parent",
                configPath: "/config.json",
                profiles,
                pendingChanges: {},
                renames: {},
            });
            expect(result.isValid).toBe(true);
        });
    });

    describe("prepareRenamesForProcessing", () => {
        it("should drop renames whose originalKey equals its newKey", () => {
            const renames = [
                { originalKey: "profiles.unchanged", newKey: "profiles.unchanged", configPath: "/c" },
                { originalKey: "profiles.changed", newKey: "profiles.renamed", configPath: "/c" },
            ];

            expect(profileOperations.prepareRenamesForProcessing(renames)).toEqual([
                { originalKey: "profiles.changed", newKey: "profiles.renamed", configPath: "/c" },
            ]);
        });

        it("should re-parent an unrenamed child under its renamed parent and drop the now-redundant child rename", () => {
            const renames = [
                { originalKey: "parent.child", newKey: "parent.child", configPath: "/c" },
                { originalKey: "parent", newKey: "renamedParent", configPath: "/c" },
            ];

            const result = profileOperations.prepareRenamesForProcessing(renames);

            // Sorting puts the parent rename first; re-parenting rewrites the child's original/new key to
            // "renamedParent.child" on both sides, which becomes a no-op and gets filtered out - the parent
            // move alone relocates the child, so only the parent rename needs to be applied.
            expect(result).toEqual([{ originalKey: "parent", newKey: "renamedParent", configPath: "/c" }]);
        });

        it("rejects independent profiles targeting the same final key", () => {
            const renames = [
                { originalKey: "profiles.one", newKey: "profiles.renamed", configPath: "/c" },
                { originalKey: "profiles.two", newKey: "profiles.renamed", configPath: "/c" },
            ];

            expect(() => profileOperations.prepareRenamesForProcessing(renames)).toThrow("Conflicting profile renames");
        });
    });

    describe("stageProfileRenames", () => {
        let teamConfig: any;
        let mockReadProfilesFromDisk: Mock;
        let mockProfileInfo: any;

        beforeEach(() => {
            teamConfig = {
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: {
                    layers: {
                        activate: vi.fn(),
                        get: vi.fn(() => ({
                            properties: {
                                profiles: {
                                    testProfile: { type: "zosmf", properties: { host: "test.host.com" } },
                                },
                            },
                        })),
                    },
                },
                set: vi.fn(),
                delete: vi.fn(),
                save: vi.fn().mockResolvedValue(undefined),
            };
            mockReadProfilesFromDisk = vi.fn().mockResolvedValue(undefined);
            mockProfileInfo = {
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: vi.fn(() => teamConfig),
            };
            vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue(mockProfileInfo);
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation((key: string) => `profiles.${key}`);
        });

        it("should return early without loading profiles when renames array is empty", () => {
            profileOperations.stageProfileRenames([], mockProfileInfo);
            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should stage a rename without persisting or refreshing", () => {
            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            profileOperations.stageProfileRenames(renames, mockProfileInfo);

            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
            expect(teamConfig.set).toHaveBeenCalledWith(
                "profiles.renamedProfile",
                { type: "zosmf", properties: { host: "test.host.com" } },
                { parseString: true }
            );
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.testProfile");
            expect(teamConfig.save).not.toHaveBeenCalled();
            expect(mockReadProfilesFromDisk).not.toHaveBeenCalled();
            expect(FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence).not.toHaveBeenCalled();
            expect(FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename).not.toHaveBeenCalled();
        });

        it("should reject a conflicting target before writing", () => {
            // Both source and target already exist under the layer, which is a critical ("already exists") error.
            (teamConfig.api.layers.get as Mock).mockReturnValue({
                properties: {
                    profiles: {
                        testProfile: { type: "zosmf" },
                        renamedProfile: { type: "zosmf" },
                    },
                },
            });
            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined as any);

            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            expect(() => profileOperations.stageProfileRenames(renames, mockProfileInfo)).toThrow("already exists");

            expect(showErrorMessageSpy).not.toHaveBeenCalled();
            showErrorMessageSpy.mockRestore();
        });

        it("should reject invalid paths before writing", () => {
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation(() => {
                throw new Error("Some non-critical failure");
            });
            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined as any);

            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            expect(() => profileOperations.stageProfileRenames(renames, mockProfileInfo)).toThrow("Some non-critical failure");

            expect(showErrorMessageSpy).not.toHaveBeenCalled();
            showErrorMessageSpy.mockRestore();
        });
    });

    describe.each(["stage", "preview"] as const)("%s rename results", (mode) => {
        const configPath = "/mock/team.json";
        const setup = () =>
            createEditorConfig([
                createEditorLayer({
                    path: configPath,
                    properties: {
                        profiles: {
                            base: {
                                type: "base",
                                properties: { host: "original", password: "synthetic" },
                                secure: ["password"],
                                profiles: {
                                    child: { type: "zosmf", properties: { port: 443 } },
                                },
                            },
                            group: {},
                        },
                        defaults: { base: "base", zosmf: "base.child", ssh: "unrelated" },
                    },
                }),
            ]);
        const apply = (memory: ReturnType<typeof setup>, originalKey: string, newKey: string) => {
            const renames = [{ originalKey, newKey, configPath }];
            if (mode === "stage") profileOperations.stageProfileRenames(renames, memory.profileInfo);
            else profileOperations.simulateProfileRenames(renames, memory.config);
        };

        it.each(["renamed", "group.moved"])("preserves the subtree and updates defaults when moving to %s", (target) => {
            const memory = setup();
            const original = structuredClone(memory.config.layers[0].properties.profiles.base);
            apply(memory, "base", target);
            const properties = memory.config.layers[0].properties;
            expect(findProfile(properties.profiles, target)).toEqual(original);
            expect(properties.profiles).not.toHaveProperty("base");
            expect(properties.defaults).toEqual({ base: target, zosmf: `${target}.child`, ssh: "unrelated" });
            expect(memory.save).not.toHaveBeenCalled();
            expect(memory.saved.get(configPath).profiles.base).toEqual(original);
        });

        it("vacates a source before reusing its name regardless of request order", () => {
            const memory = setup();
            const renames = [
                { originalKey: "group", newKey: "base", configPath },
                { originalKey: "base", newKey: "moved", configPath },
            ];
            if (mode === "stage") profileOperations.stageProfileRenames(renames, memory.profileInfo);
            else profileOperations.simulateProfileRenames(renames, memory.config);
            expect(memory.config.layers[0].properties.profiles.base).toEqual({});
            expect(memory.config.layers[0].properties.profiles.moved).toMatchObject({ type: "base", secure: ["password"] });
            expect(memory.config.layers[0].properties.defaults.base).toBe("moved");
        });

        it("preserves a subtree during a case-only rename", () => {
            const memory = setup();
            apply(memory, "base", "BASE");
            expect(memory.config.layers[0].properties.profiles.BASE).toMatchObject({ type: "base", profiles: { child: { type: "zosmf" } } });
            expect(memory.config.layers[0].properties.profiles).not.toHaveProperty("base");
        });

        it("rejects case-insensitive duplicate destinations before changing the configuration", () => {
            const memory = setup();
            const before = structuredClone(memory.config.layers);
            const renames = [
                { originalKey: "base", newKey: "target", configPath },
                { originalKey: "group", newKey: "TARGET", configPath },
            ];
            expect(() =>
                mode === "stage"
                    ? profileOperations.stageProfileRenames(renames, memory.profileInfo)
                    : profileOperations.simulateProfileRenames(renames, memory.config)
            ).toThrow("Conflicting profile renames");
            expect(memory.config.layers).toEqual(before);
            expect(memory.save).not.toHaveBeenCalled();
        });

        it.each([
            ["group.base", "group.base.renamed"],
            ["extracted.base", "extracted"],
        ])("keeps parent and child identities when their final paths are %s and %s", (parentTarget, childTarget) => {
            const memory = setup();
            const renames = [
                { originalKey: "base", newKey: parentTarget, configPath },
                { originalKey: "base.child", newKey: childTarget, configPath },
            ];
            if (mode === "stage") profileOperations.stageProfileRenames(renames, memory.profileInfo);
            else profileOperations.simulateProfileRenames(renames, memory.config);
            expect(findProfile(memory.config.layers[0].properties.profiles, parentTarget)).toMatchObject({ type: "base" });
            expect(findProfile(memory.config.layers[0].properties.profiles, childTarget)).toMatchObject({ type: "zosmf", properties: { port: 443 } });
            expect(memory.config.layers[0].properties.defaults).toMatchObject({ base: parentTarget, zosmf: childTarget });
        });

        it("extracts a nested child while retaining the parent's properties and credentials", () => {
            const memory = setup();
            apply(memory, "base.child", "extracted");
            const properties = memory.config.layers[0].properties;
            expect(properties.profiles.extracted).toEqual({ type: "zosmf", properties: { port: 443 } });
            expect(properties.profiles.base).toMatchObject({ properties: { host: "original", password: "synthetic" }, secure: ["password"] });
            expect(properties.profiles.base.profiles).not.toHaveProperty("child");
            expect(properties.defaults).toEqual({ base: "base", zosmf: "extracted", ssh: "unrelated" });
            expect(memory.save).not.toHaveBeenCalled();
        });

        it("creates a nested profile with secure metadata at the child", () => {
            const memory = setup();
            delete memory.config.layers[0].properties.profiles.base.profiles;
            delete memory.config.layers[0].properties.defaults.zosmf;
            apply(memory, "base", "base.nested");
            const properties = memory.config.layers[0].properties;
            expect(properties.profiles.base).not.toHaveProperty("secure");
            expect(findProfile(properties.profiles, "base.nested")).toMatchObject({
                type: "base",
                properties: { host: "original", password: "synthetic" },
                secure: ["password"],
            });
            expect(properties.defaults.base).toBe("base.nested");
            expect(memory.save).not.toHaveBeenCalled();
        });

        it("leaves a newly created source for the pending-change redirection step", () => {
            const memory = setup();
            apply(memory, "unsaved", "newName");
            expect(memory.config.layers[0].properties.profiles).not.toHaveProperty("newName");
            const updated = profileOperations.updateProfileChangesForRenames(
                {
                    changes: [createEditorChange("profiles.unsaved.properties.host", "new", { configPath, profile: "unsaved" })],
                },
                [{ originalKey: "unsaved", newKey: "newName", configPath }]
            );
            expect(updated.changes[0]).toMatchObject({
                profile: "newName",
                key: "profiles.newName.properties.host",
                path: ["profiles", "newName", "properties", "host"],
            });
            expect(memory.save).not.toHaveBeenCalled();
        });
    });

    describe("updateProfileChangesForRenames", () => {
        beforeEach(() => {
            vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue({} as any);
        });

        it("should return the message unchanged when there are no renames", () => {
            const message = { command: "SAVE_CHANGES", otherData: "test" } as any;
            const result = profileOperations.updateProfileChangesForRenames(message, []);
            expect(result).toEqual(message);
            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should rewrite changes and deletions using the renamed profile paths", () => {
            const message = {
                changes: [{ configPath: "/config.json", profile: "profiles.oldProfile", key: "profiles.oldProfile.host", path: [] }],
                deletions: [{ configPath: "/config.json", profile: "profiles.oldProfile", key: "profiles.oldProfile.secure", path: [] }],
            } as any;
            const renames = [{ originalKey: "profiles.oldProfile", newKey: "profiles.newProfile", configPath: "/config.json" }];

            (ConfigEditorPathUtils.getNewProfilePath as Mock).mockReturnValue("profiles.newProfile");
            (ConfigEditorPathUtils.updateChangeKey as Mock).mockImplementation((change: any) => change);
            (ConfigEditorPathUtils.updateChangePath as Mock).mockImplementation((change: any) => change);

            const result = profileOperations.updateProfileChangesForRenames(message, renames);

            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
            expect(result.changes[0].profile).toBe("profiles.newProfile");
            expect(result.deletions[0].profile).toBe("profiles.newProfile");
        });

        it("should leave changes without a configPath untouched", () => {
            const message = {
                changes: [{ profile: "profiles.oldProfile", key: "profiles.oldProfile.host", path: [], configPath: undefined }],
            } as any;
            const renames = [{ originalKey: "profiles.oldProfile", newKey: "profiles.newProfile", configPath: "/config.json" }];

            const result = profileOperations.updateProfileChangesForRenames(message, renames);

            expect(result.changes).toEqual(message.changes);
            expect(ConfigEditorPathUtils.getNewProfilePath).not.toHaveBeenCalled();
        });
    });

    describe("simulateProfileRenames", () => {
        beforeEach(() => {
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation((key: string) => `profiles.${key}`);
        });

        it("should return early when renames array is empty", () => {
            const prepareSpy = vi.spyOn(profileOperations, "prepareRenamesForProcessing");
            profileOperations.simulateProfileRenames([], {} as any);
            expect(prepareSpy).not.toHaveBeenCalled();
        });

        it("should warn and return early when teamConfig is null or undefined", () => {
            const renames = [{ originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile", configPath: "/c" }];
            profileOperations.simulateProfileRenames(renames, null as any);
            expect(warn).toHaveBeenCalledWith("Cannot simulate profile renames: teamConfig is null or undefined");
        });

        it("should skip renames whose config layer cannot be found", () => {
            const teamConfig = { layers: [], api: { layers: { activate: vi.fn(), get: vi.fn() } } };
            const renames = [{ originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile", configPath: "/missing" }];

            expect(() => profileOperations.simulateProfileRenames(renames, teamConfig as any)).not.toThrow();
            expect(teamConfig.api.layers.activate).not.toHaveBeenCalled();
        });

        it("should move a profile within the simulated team config", () => {
            const teamConfig = {
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: {
                    layers: {
                        activate: vi.fn(),
                        get: vi.fn(() => ({
                            properties: { profiles: { testProfile: { type: "zosmf", properties: { host: "test.host.com" } } } },
                        })),
                    },
                },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            profileOperations.simulateProfileRenames(renames, teamConfig as any);

            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
            expect(teamConfig.set).toHaveBeenCalledWith(
                "profiles.renamedProfile",
                { type: "zosmf", properties: { host: "test.host.com" } },
                { parseString: true }
            );
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.testProfile");
        });

        it("should create a nested profile structure when the rename nests the profile under itself", () => {
            const teamConfig = {
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: {
                    layers: {
                        activate: vi.fn(),
                        get: vi.fn(() => ({
                            properties: { profiles: { tso: { type: "tso", properties: { host: "test.host.com" } } } },
                        })),
                    },
                },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const renames = [{ originalKey: "tso", newKey: "tso.asdf", configPath: "/test/config/path" }];

            profileOperations.simulateProfileRenames(renames, teamConfig as any);

            expect(teamConfig.set).toHaveBeenCalledWith(
                "profiles.tso",
                expect.objectContaining({ profiles: { asdf: expect.objectContaining({ type: "tso" }) } }),
                { parseString: true }
            );
        });
    });
});
