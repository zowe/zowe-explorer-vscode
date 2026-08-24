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
import { vi, Mock } from "vitest";
import * as vscode from "vscode";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigEditorPathUtils } from "../../../../src/utils/ConfigEditorPathUtils";
import { FavoritePersistenceUtils } from "../../../../src/utils/FavoritePersistenceUtils";
import * as MoveUtils from "../../../../src/webviews/src/config-editor/utils/moveUtils";

vi.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: vi.fn().mockReturnValue({
            overrideWithEnv: false,
            refresh: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

vi.mock("../../../../src/utils/ConfigEditorPathUtils", () => ({
    ConfigEditorPathUtils: {
        constructNestedProfilePath: vi.fn(),
        getNewProfilePath: vi.fn(),
        updateChangeKey: vi.fn(),
        updateChangePath: vi.fn(),
    },
}));

vi.mock("../../../../src/utils/FavoritePersistenceUtils", () => ({
    FavoritePersistenceUtils: {
        applyProfileRenameToStoredTreePersistence: vi.fn().mockResolvedValue(undefined),
        fireAndForgetExplorerTreeRebuildAfterRename: vi.fn(),
    },
}));

vi.mock("../../../../src/webviews/src/config-editor/utils/moveUtils", () => ({
    updateDefaultsAfterRename: vi.fn(),
    simulateDefaultsUpdateAfterRename: vi.fn(),
}));

// Mock console.warn to avoid noise in tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
    console.warn = vi.fn();
});

afterAll(() => {
    console.warn = originalConsoleWarn;
});

describe("ConfigEditorProfileOperations", () => {
    let profileOperations: ConfigEditorProfileOperations;

    beforeEach(() => {
        profileOperations = new ConfigEditorProfileOperations();
        vi.clearAllMocks();
    });

    describe("updateRenameKeysForParentChanges", () => {
        it("should return empty array for empty input", () => {
            const result = profileOperations.updateRenameKeysForParentChanges([]);
            expect(result).toEqual([]);
        });

        it("should handle single rename without parent changes", () => {
            const renames = [{ originalKey: "profile1", newKey: "renamed1", configPath: "/config.json" }];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual(renames);
        });

        it("should handle parent-first rename scenario", () => {
            const renames = [
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
                { originalKey: "parent.child", newKey: "parent.child", configPath: "/config.json" },
            ];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual([
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
                { originalKey: "newParent.child", newKey: "newParent.child", configPath: "/config.json" },
            ]);
        });

        it("should handle child-first rename scenario", () => {
            const renames = [
                { originalKey: "parent.child", newKey: "parent.newChild", configPath: "/config.json" },
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
            ];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual([
                { originalKey: "newParent.child", newKey: "newParent.newChild", configPath: "/config.json" },
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
            ]);
        });

        it("should handle multiple config paths separately", () => {
            const renames = [
                { originalKey: "profile1", newKey: "renamed1", configPath: "/config1.json" },
                { originalKey: "profile2", newKey: "renamed2", configPath: "/config2.json" },
            ];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual(renames);
        });

        it("should handle complex nested renames", () => {
            const renames = [
                { originalKey: "a", newKey: "x", configPath: "/config.json" },
                { originalKey: "a.b", newKey: "a.b", configPath: "/config.json" },
                { originalKey: "a.b.c", newKey: "a.b.c", configPath: "/config.json" },
            ];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual([
                { originalKey: "a", newKey: "x", configPath: "/config.json" },
                { originalKey: "x.b", newKey: "x.b", configPath: "/config.json" },
                { originalKey: "x.b.c", newKey: "x.b.c", configPath: "/config.json" },
            ]);
        });

        it("should handle child rename with new key starting with old parent", () => {
            const renames = [
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
                { originalKey: "parent.child", newKey: "parent.child", configPath: "/config.json" },
            ];
            const result = profileOperations.updateRenameKeysForParentChanges(renames);
            expect(result).toEqual([
                { originalKey: "parent", newKey: "newParent", configPath: "/config.json" },
                { originalKey: "newParent.child", newKey: "newParent.child", configPath: "/config.json" },
            ]);
        });
    });

    describe("removeDuplicateRenames", () => {
        it("should return empty array for empty input", () => {
            const result = profileOperations.removeDuplicateRenames([]);
            expect(result).toEqual([]);
        });

        it("should return single rename unchanged", () => {
            const renames = [{ originalKey: "profile1", newKey: "renamed1", configPath: "/config.json" }];
            const result = profileOperations.removeDuplicateRenames(renames);
            expect(result).toEqual(renames);
        });

        it("should remove duplicate renames with same target", () => {
            const renames = [
                { originalKey: "profile1", newKey: "renamed", configPath: "/config.json" },
                { originalKey: "profile2", newKey: "renamed", configPath: "/config.json" },
            ];
            const result = profileOperations.removeDuplicateRenames(renames);
            expect(result).toHaveLength(1);
            expect(result[0].originalKey).toBe("profile1");
        });

        it("should keep renames with same target but different ending segments", () => {
            const renames = [
                { originalKey: "profile1", newKey: "renamed", configPath: "/config.json" },
                { originalKey: "profile1", newKey: "renamed", configPath: "/config.json" },
            ];
            const result = profileOperations.removeDuplicateRenames(renames);
            expect(result).toHaveLength(2);
        });

        it("should prefer shorter original key path for duplicates", () => {
            const renames = [
                { originalKey: "a.b.c", newKey: "renamed", configPath: "/config.json" },
                { originalKey: "a.b", newKey: "renamed", configPath: "/config.json" },
            ];
            const result = profileOperations.removeDuplicateRenames(renames);
            expect(result).toHaveLength(1);
            expect(result[0].originalKey).toBe("a.b");
        });

        it("should handle multiple config paths separately", () => {
            const renames = [
                { originalKey: "profile1", newKey: "renamed", configPath: "/config1.json" },
                { originalKey: "profile2", newKey: "renamed", configPath: "/config2.json" },
            ];
            const result = profileOperations.removeDuplicateRenames(renames);
            expect(result).toHaveLength(2);
        });
    });

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

        it("should return true when child part exactly equals original key", () => {
            const result = profileOperations.wouldCreateCircularReference("parent", "parent.parent");
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

            expect(console.warn).toHaveBeenCalledWith("Failed to move secure properties for nested profile creation: Error: Secure properties error");
        });
    });

    describe("validateConfigMoveAPI", () => {
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

        it("should pass validation with valid API", () => {
            expect(() => {
                profileOperations.validateConfigMoveAPI(mockConfigMoveAPI, mockLayerActive);
            }).not.toThrow();
        });

        it("should throw error for null ConfigMoveAPI", () => {
            expect(() => {
                profileOperations.validateConfigMoveAPI(null as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI is null or undefined");
        });

        it("should throw error for undefined ConfigMoveAPI", () => {
            expect(() => {
                profileOperations.validateConfigMoveAPI(undefined as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI is null or undefined");
        });

        it("should throw error for missing get function", () => {
            const invalidAPI = { set: vi.fn(), delete: vi.fn() };
            expect(() => {
                profileOperations.validateConfigMoveAPI(invalidAPI as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI.get is not a function");
        });

        it("should throw error for missing set function", () => {
            const invalidAPI = { get: vi.fn(), delete: vi.fn() };
            expect(() => {
                profileOperations.validateConfigMoveAPI(invalidAPI as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI.set is not a function");
        });

        it("should throw error for missing delete function", () => {
            const invalidAPI = { get: vi.fn(), set: vi.fn() };
            expect(() => {
                profileOperations.validateConfigMoveAPI(invalidAPI as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI.delete is not a function");
        });

        it("should throw error for non-function layerActive", () => {
            expect(() => {
                profileOperations.validateConfigMoveAPI(mockConfigMoveAPI, "not-a-function" as any);
            }).toThrow("layerActive is not a function");
        });

        it("should throw error for invalid layer structure", () => {
            (mockLayerActive as any).mockReturnValue({ properties: {} } as any);
            expect(() => {
                profileOperations.validateConfigMoveAPI(mockConfigMoveAPI, mockLayerActive);
            }).toThrow("Invalid layer structure: missing properties or profiles");
        });

        it("should throw error for layerActive that throws", () => {
            (mockLayerActive as any).mockImplementation(() => {
                throw new Error("Layer error");
            });
            expect(() => {
                profileOperations.validateConfigMoveAPI(mockConfigMoveAPI, mockLayerActive);
            }).toThrow("Failed to validate layer: Layer error");
        });
    });

    describe("handleMoveUtilsError", () => {
        it("should format error message for regular operation", () => {
            const error = new Error("Test error");
            const result = profileOperations.handleMoveUtilsError(error, "rename", "old", "new");
            expect(result).toBe("rename from 'old' to 'new': Test error");
        });

        it("should format error message for simulation", () => {
            const error = new Error("Test error");
            const result = profileOperations.handleMoveUtilsError(error, "rename", "old", "new", true);
            expect(result).toBe("Simulation failed for rename from 'old' to 'new': Test error");
        });

        it("should handle non-Error objects", () => {
            const result = profileOperations.handleMoveUtilsError("String error", "rename", "old", "new");
            expect(result).toBe("rename from 'old' to 'new': String error");
        });
    });

    describe("isCriticalMoveError", () => {
        it("should return true for profile already exists error", () => {
            const error = new Error("Profile 'test' already exists");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(true);
        });

        it("should return true for target profile already exists error", () => {
            const error = new Error("Target profile already exists");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(true);
        });

        it("should return true for profile with name already exists error", () => {
            const error = new Error("Profile with name 'test' already exists");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(true);
        });

        it("should return true for cannot rename profile already exists error", () => {
            const error = new Error("Cannot rename profile 'test'. Profile 'test' already exists");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(true);
        });

        it("should return true for circular reference error", () => {
            const error = new Error("Cannot rename profile 'test'. Would create circular reference");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(true);
        });

        it("should return false for non-critical error", () => {
            const error = new Error("Some other error");
            const result = profileOperations.isCriticalMoveError(error);
            expect(result).toBe(false);
        });

        it("should handle non-Error objects", () => {
            const result = profileOperations.isCriticalMoveError("String error");
            expect(result).toBe(false);
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
            expect(result.message).toBe("Profile name already exists under this root");
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
            expect(result.message).toBe("Profile name already exists under this root");
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
            expect(result.message).toBe("Profile name already exists in pending changes");
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
                profiles: {},
                pendingChanges: {},
                renames,
            });
            expect(result.isValid).toBe(false);
            expect(result.message).toBe("Profile name conflicts with a renamed profile");
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

    describe("sortRenamesByDepth", () => {
        it("should sort renames by newKey depth first, then by originalKey depth", () => {
            const renames = [
                { originalKey: "profiles.parent.child.grandchild", newKey: "profiles.parent.child.renamedGrandchild", configPath: "/c" },
                { originalKey: "profiles.parent", newKey: "profiles.renamedParent", configPath: "/c" },
                { originalKey: "profiles.parent.child", newKey: "profiles.parent.renamedChild", configPath: "/c" },
                { originalKey: "profiles.other.deep.nested.profile", newKey: "profiles.parent.renamedChild", configPath: "/c" },
                { originalKey: "profiles.simple", newKey: "profiles.parent.renamedChild", configPath: "/c" },
            ];

            const sortedRenames = profileOperations.sortRenamesByDepth(renames);

            expect(sortedRenames).toHaveLength(5);
            expect(sortedRenames[0].newKey).toBe("profiles.renamedParent");
            expect(sortedRenames[1].newKey).toBe("profiles.parent.renamedChild");
            expect(sortedRenames[2].newKey).toBe("profiles.parent.renamedChild");
            expect(sortedRenames[3].newKey).toBe("profiles.parent.renamedChild");
            expect(sortedRenames[4].newKey).toBe("profiles.parent.child.renamedGrandchild");

            // Secondary sort by originalKey depth for renames that share the same newKey depth
            expect(sortedRenames[1].originalKey).toBe("profiles.simple");
            expect(sortedRenames[2].originalKey).toBe("profiles.parent.child");
            expect(sortedRenames[3].originalKey).toBe("profiles.other.deep.nested.profile");
        });

        it("should handle empty array", () => {
            expect(profileOperations.sortRenamesByDepth([])).toEqual([]);
        });

        it("should handle single rename", () => {
            const renames = [{ originalKey: "profiles.test", newKey: "profiles.renamed", configPath: "/c" }];
            expect(profileOperations.sortRenamesByDepth(renames)).toEqual(renames);
        });
    });

    describe("prepareRenamesForProcessing", () => {
        it("should drop renames whose originalKey equals its newKey", () => {
            const renames = [
                { originalKey: "profiles.unchanged", newKey: "profiles.unchanged", configPath: "/c" },
                { originalKey: "profiles.changed", newKey: "profiles.renamed", configPath: "/c" },
            ];

            const result = profileOperations.prepareRenamesForProcessing(renames);

            expect(result).toHaveLength(1);
            expect(result[0].originalKey).toBe("profiles.changed");
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

        it("should remove duplicate renames that target the same final key", () => {
            const renames = [
                { originalKey: "profiles.one", newKey: "profiles.renamed", configPath: "/c" },
                { originalKey: "profiles.two", newKey: "profiles.renamed", configPath: "/c" },
            ];

            const result = profileOperations.prepareRenamesForProcessing(renames);

            expect(result).toHaveLength(1);
        });
    });

    describe("handleProfileRenames", () => {
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
            vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue(mockProfileInfo as any);
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation((key: string) => `profiles.${key}`);
        });

        it("should return early without loading profiles when renames array is empty", async () => {
            await profileOperations.handleProfileRenames([]);
            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should apply a single profile rename end-to-end", async () => {
            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            await profileOperations.handleProfileRenames(renames);

            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
            expect(teamConfig.set).toHaveBeenCalledWith(
                "profiles.renamedProfile",
                { type: "zosmf", properties: { host: "test.host.com" } },
                { parseString: true }
            );
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.testProfile");
            expect(teamConfig.save).toHaveBeenCalled();
            expect(mockReadProfilesFromDisk).toHaveBeenCalled();
            expect(FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence).toHaveBeenCalledWith(renames[0]);
            expect(FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename).toHaveBeenCalledWith(renames[0]);
        });

        it("should show a cancellation error and abort the batch when a critical error occurs", async () => {
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

            await expect(profileOperations.handleProfileRenames(renames)).rejects.toThrow("Critical error during profile rename");

            expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Save operation cancelled"));
            showErrorMessageSpy.mockRestore();
        });

        it("should show an error message and continue when a non-critical error occurs", async () => {
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation(() => {
                throw new Error("Some non-critical failure");
            });
            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined as any);

            const renames = [{ originalKey: "testProfile", newKey: "renamedProfile", configPath: "/test/config/path" }];

            await expect(profileOperations.handleProfileRenames(renames)).resolves.toBeUndefined();

            expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Error renaming profile"));
            showErrorMessageSpy.mockRestore();
        });
    });

    describe("getProfileFromTeamConfig", () => {
        it("should find a top-level profile", () => {
            const teamConfig = {
                api: { layers: { get: () => ({ properties: { profiles: { testProfile: { type: "zosmf" } } } }) } },
            };
            const result = (profileOperations as any).getProfileFromTeamConfig(teamConfig, "profiles.testProfile");
            expect(result).toEqual({ type: "zosmf" });
        });

        it("should return null when the profile does not exist", () => {
            const teamConfig = {
                api: { layers: { get: () => ({ properties: { profiles: {} } }) } },
            };
            const result = (profileOperations as any).getProfileFromTeamConfig(teamConfig, "profiles.missing");
            expect(result).toBeNull();
        });
    });

    describe("moveProfileDirectly", () => {
        it("should throw when the source profile does not exist", () => {
            const teamConfig = {
                api: { layers: { get: vi.fn(() => ({ properties: { profiles: {} } })) } },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const layerActive = () => ({ properties: { profiles: {} } });

            expect(() => {
                (profileOperations as any).moveProfileDirectly(teamConfig, layerActive, "profiles.nonexistent", "profiles.targetProfile");
            }).toThrow("Source profile not found at path: profiles.nonexistent");
        });

        it("should throw when the target profile already exists", () => {
            const teamConfig = {
                api: {
                    layers: {
                        get: vi.fn(() => ({ properties: { profiles: { sourceProfile: { type: "zosmf" }, targetProfile: { type: "zosmf" } } } })),
                    },
                },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const layerActive = () => ({ properties: { profiles: { sourceProfile: { type: "zosmf" }, targetProfile: { type: "zosmf" } } } });

            expect(() => {
                (profileOperations as any).moveProfileDirectly(teamConfig, layerActive, "profiles.sourceProfile", "profiles.targetProfile");
            }).toThrow("Target profile already exists at path: profiles.targetProfile");
        });

        it("should move the profile by setting the target path and deleting the source path", () => {
            const teamConfig = {
                api: { layers: { get: vi.fn(() => ({ properties: { profiles: { sourceProfile: { type: "zosmf" } } } })) } },
                set: vi.fn(),
                delete: vi.fn(),
            };
            const layerActive = () => ({ properties: { profiles: { sourceProfile: { type: "zosmf" } } } });

            (profileOperations as any).moveProfileDirectly(teamConfig, layerActive, "profiles.sourceProfile", "profiles.targetProfile");

            expect(teamConfig.set).toHaveBeenCalledWith("profiles.targetProfile", { type: "zosmf" }, { parseString: true });
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.sourceProfile");
        });
    });

    describe("createTeamConfigAdapter", () => {
        it("should delegate get/set/delete to the underlying team config", () => {
            const teamConfig = {
                api: { layers: { get: vi.fn(() => ({ properties: { profiles: { testProfile: { type: "zosmf" } } } })) } },
                set: vi.fn(),
                delete: vi.fn(),
            };

            const adapter = (profileOperations as any).createTeamConfigAdapter(teamConfig);

            expect(adapter.get("profiles.testProfile")).toEqual({ type: "zosmf" });

            adapter.set("profiles.testProfile", { type: "zosmf", properties: {} });
            expect(teamConfig.set).toHaveBeenCalledWith("profiles.testProfile", { type: "zosmf", properties: {} }, { parseString: true });

            adapter.delete("profiles.testProfile");
            expect(teamConfig.delete).toHaveBeenCalledWith("profiles.testProfile");
        });
    });

    describe("createNestedProfileStructureDirectly", () => {
        it("should create a nested profile structure via the team config adapter", () => {
            const teamConfig = {
                api: {
                    layers: { get: vi.fn(() => ({ properties: { profiles: { tso: { type: "tso", properties: { host: "test.host.com" } } } } })) },
                },
                set: vi.fn(),
            };

            (profileOperations as any).createNestedProfileStructureDirectly(teamConfig, "profiles.tso", "profiles.tso.asdf", "tso", "tso.asdf");

            expect(teamConfig.set).toHaveBeenCalledWith(
                "profiles.tso",
                expect.objectContaining({
                    type: "tso",
                    profiles: { asdf: expect.objectContaining({ type: "tso" }) },
                }),
                { parseString: true }
            );
        });
    });

    describe("findNestedProfile", () => {
        it("should handle various nested and top-level lookup scenarios", () => {
            const profilesObj = {
                parent: {
                    type: "zosmf",
                    properties: { host: "test.host.com" },
                    profiles: { child: { type: "zosmf", properties: { host: "child.host.com" } } },
                },
                simple: { type: "zosmf", properties: { host: "simple.host.com" } },
            };

            const nestedResult = (profileOperations as any).findNestedProfile("parent.child", profilesObj);
            expect(nestedResult).toEqual({ type: "zosmf", properties: { host: "child.host.com" } });

            const simpleResult = (profileOperations as any).findNestedProfile("simple", profilesObj);
            expect(simpleResult).toEqual({ type: "zosmf", properties: { host: "simple.host.com" } });

            const nonExistentResult = (profileOperations as any).findNestedProfile("nonexistent", profilesObj);
            expect(nonExistentResult).toBeNull();
        });
    });

    describe("validateProfileRename", () => {
        it("should allow the rename when the original profile exists and the target does not", () => {
            const mockTeamConfig = { api: { layers: { get: vi.fn() } } };
            const getProfileFromTeamConfigSpy = vi
                .spyOn(profileOperations as any, "getProfileFromTeamConfig")
                .mockReturnValueOnce({ type: "zosmf" }) // original profile exists
                .mockReturnValueOnce(null); // target profile doesn't exist

            const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };
            const result = (profileOperations as any).validateProfileRename(
                mockTeamConfig,
                "profiles.testProfile",
                "profiles.renamedProfile",
                rename
            );

            expect(result).toEqual({ skip: false });
            expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.testProfile");
            expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.renamedProfile");
        });

        it("should return skip:true when the original profile does not exist yet", () => {
            const mockTeamConfig = { api: { layers: { get: vi.fn() } } };
            const getProfileFromTeamConfigSpy = vi.spyOn(profileOperations as any, "getProfileFromTeamConfig").mockReturnValueOnce(null);

            const rename = { originalKey: "profiles.nonExistentProfile", newKey: "profiles.renamedProfile" };
            const result = (profileOperations as any).validateProfileRename(
                mockTeamConfig,
                "profiles.nonExistentProfile",
                "profiles.renamedProfile",
                rename
            );

            expect(result).toEqual({ skip: true });
            expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.nonExistentProfile");
        });

        it("should throw when the target profile already exists", () => {
            const mockTeamConfig = { api: { layers: { get: vi.fn() } } };
            const getProfileFromTeamConfigSpy = vi
                .spyOn(profileOperations as any, "getProfileFromTeamConfig")
                .mockReturnValueOnce({ type: "zosmf" })
                .mockReturnValueOnce({ type: "zosmf" });

            const rename = { originalKey: "profiles.testProfile", newKey: "profiles.existingProfile" };

            expect(() => {
                (profileOperations as any).validateProfileRename(mockTeamConfig, "profiles.testProfile", "profiles.existingProfile", rename);
            }).toThrow(
                "Cannot rename profile 'profiles.testProfile' to 'profiles.existingProfile': Profile 'profiles.existingProfile' already exists"
            );

            expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.testProfile");
            expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.existingProfile");
        });
    });

    describe("updateDefaultsAfterRename", () => {
        it("should apply updated defaults returned by MoveUtils", () => {
            const mockTeamConfig = {
                api: { layers: { get: vi.fn().mockReturnValue({ properties: { defaults: { zosmf: "profiles.testProfile" } } }) } },
                set: vi.fn(),
            };

            (MoveUtils.updateDefaultsAfterRename as Mock).mockImplementation((layerActive: any, originalKey: string, newKey: string, update: any) => {
                const defaults = layerActive().properties.defaults;
                const updated = { ...defaults };
                if (updated.zosmf === originalKey) {
                    updated.zosmf = newKey;
                }
                update(updated);
            });

            const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

            expect(() => {
                (profileOperations as any).updateDefaultsAfterRename(mockTeamConfig, rename);
            }).not.toThrow();

            expect(mockTeamConfig.set).toHaveBeenCalledWith("defaults", { zosmf: "profiles.renamedProfile" }, { parseString: true });
        });

        it("should swallow errors from MoveUtils and log a warning", () => {
            const mockTeamConfig = {
                api: { layers: { get: vi.fn().mockReturnValue({ properties: { defaults: {} } }) } },
                set: vi.fn(),
            };

            (MoveUtils.updateDefaultsAfterRename as Mock).mockImplementation(() => {
                throw new Error("Defaults update failed");
            });

            const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

            expect(() => {
                (profileOperations as any).updateDefaultsAfterRename(mockTeamConfig, rename);
            }).not.toThrow();

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining("update defaults from 'profiles.testProfile' to 'profiles.renamedProfile': Defaults update failed")
            );
        });

        it("should update defaults referencing a child of the renamed profile", () => {
            const mockTeamConfig = {
                api: {
                    layers: {
                        get: vi
                            .fn()
                            .mockReturnValue({ properties: { defaults: { zosmf: "profiles.testProfile", tso: "profiles.testProfile.tso" } } }),
                    },
                },
                set: vi.fn(),
            };

            (MoveUtils.updateDefaultsAfterRename as Mock).mockImplementation((layerActive: any, originalKey: string, newKey: string, update: any) => {
                const defaults = layerActive().properties.defaults;
                const updated = { ...defaults };
                let hasChanges = false;
                Object.entries(updated).forEach(([type, name]) => {
                    if (typeof name === "string" && name.startsWith(originalKey + ".")) {
                        updated[type] = newKey + name.substring(originalKey.length);
                        hasChanges = true;
                    }
                });
                if (hasChanges) {
                    update(updated);
                }
            });

            const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };
            (profileOperations as any).updateDefaultsAfterRename(mockTeamConfig, rename);

            expect(mockTeamConfig.set).toHaveBeenCalledWith(
                "defaults",
                { zosmf: "profiles.testProfile", tso: "profiles.renamedProfile.tso" },
                { parseString: true }
            );
        });
    });

    describe("handleRenameError", () => {
        it("should show an error message for a non-critical error without throwing", () => {
            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined as any);

            expect(() => {
                (profileOperations as any).handleRenameError(new Error("Some failure"), { originalKey: "a", newKey: "b" });
            }).not.toThrow();

            expect(showErrorMessageSpy).toHaveBeenCalledWith("Error renaming profile from 'a' to 'b': Some failure");
            showErrorMessageSpy.mockRestore();
        });

        it("should show a cancellation message and rethrow for a critical error", () => {
            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined as any);

            expect(() => {
                (profileOperations as any).handleRenameError(new Error("Profile 'b' already exists"), { originalKey: "a", newKey: "b" });
            }).toThrow("Critical error during profile rename");

            expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Save operation cancelled"));
            showErrorMessageSpy.mockRestore();
        });
    });

    describe("updateProfileChangesForRenames", () => {
        beforeEach(() => {
            vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue({} as any);
        });

        it("should return the message unchanged when there are no renames", async () => {
            const message = { command: "SAVE_CHANGES", otherData: "test" } as any;
            const result = await profileOperations.updateProfileChangesForRenames(message, []);
            expect(result).toEqual(message);
            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should rewrite changes and deletions using the renamed profile paths", async () => {
            const message = {
                changes: [{ configPath: "/config.json", profile: "profiles.oldProfile", key: "profiles.oldProfile.host", path: [] }],
                deletions: [{ configPath: "/config.json", profile: "profiles.oldProfile", key: "profiles.oldProfile.secure", path: [] }],
            } as any;
            const renames = [{ originalKey: "profiles.oldProfile", newKey: "profiles.newProfile", configPath: "/config.json" }];

            (ConfigEditorPathUtils.getNewProfilePath as Mock).mockReturnValue("profiles.newProfile");
            (ConfigEditorPathUtils.updateChangeKey as Mock).mockImplementation((change: any) => change);
            (ConfigEditorPathUtils.updateChangePath as Mock).mockImplementation((change: any) => change);

            const result = await profileOperations.updateProfileChangesForRenames(message, renames);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(result.changes![0].profile).toBe("profiles.newProfile");
            expect(result.deletions![0].profile).toBe("profiles.newProfile");
        });

        it("should leave changes without a configPath untouched", async () => {
            const message = {
                changes: [{ profile: "profiles.oldProfile", key: "profiles.oldProfile.host", path: [], configPath: undefined }],
            } as any;
            const renames = [{ originalKey: "profiles.oldProfile", newKey: "profiles.newProfile", configPath: "/config.json" }];

            const result = await profileOperations.updateProfileChangesForRenames(message, renames);

            expect(result.changes).toEqual(message.changes);
            expect(ConfigEditorPathUtils.getNewProfilePath).not.toHaveBeenCalled();
        });
    });

    describe("simulateProfileRenames", () => {
        beforeEach(() => {
            (ConfigEditorPathUtils.constructNestedProfilePath as Mock).mockImplementation((key: string) => `profiles.${key}`);
        });

        it("should return early when renames array is empty", () => {
            const removeDuplicateRenamesSpy = vi.spyOn(profileOperations, "removeDuplicateRenames");
            profileOperations.simulateProfileRenames([], {} as any);
            expect(removeDuplicateRenamesSpy).not.toHaveBeenCalled();
        });

        it("should warn and return early when teamConfig is null or undefined", () => {
            const renames = [{ originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile", configPath: "/c" }];
            profileOperations.simulateProfileRenames(renames, null as any);
            expect(console.warn).toHaveBeenCalledWith("Cannot simulate profile renames: teamConfig is null or undefined");
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
            expect(MoveUtils.simulateDefaultsUpdateAfterRename).toHaveBeenCalledWith(expect.any(Function), "testProfile", "renamedProfile");
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
