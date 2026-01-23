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

// Mock console.warn to avoid noise in tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
    console.warn = jest.fn();
});

afterAll(() => {
    console.warn = originalConsoleWarn;
});

describe("ConfigEditorProfileOperations", () => {
    let profileOperations: ConfigEditorProfileOperations;

    beforeEach(() => {
        profileOperations = new ConfigEditorProfileOperations();
        jest.clearAllMocks();
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
                get: jest.fn() as jest.MockedFunction<(path: string) => any>,
                set: jest.fn() as jest.MockedFunction<(path: string, value: any) => void>,
                delete: jest.fn() as jest.MockedFunction<(path: string) => void>,
            };
            mockLayerActive = jest.fn().mockReturnValue({
                properties: {
                    profiles: {},
                },
            }) as jest.MockedFunction<() => IConfigLayer>;
        });

        it("should create nested profile structure", () => {
            const originalProfile = { host: "localhost", port: 8080 };
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>).mockReturnValue(originalProfile);

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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>).mockReturnValue(null);

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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>).mockReturnValue(originalProfile);

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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>)
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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>)
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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>)
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
            (mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>)
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
                get: jest.fn() as jest.MockedFunction<(path: string) => any>,
                set: jest.fn() as jest.MockedFunction<(path: string, value: any) => void>,
                delete: jest.fn() as jest.MockedFunction<(path: string) => void>,
            };
            mockLayerActive = jest.fn().mockReturnValue({
                properties: {
                    profiles: {},
                },
            }) as jest.MockedFunction<() => IConfigLayer>;
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
            const invalidAPI = { set: jest.fn(), delete: jest.fn() };
            expect(() => {
                profileOperations.validateConfigMoveAPI(invalidAPI as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI.get is not a function");
        });

        it("should throw error for missing set function", () => {
            const invalidAPI = { get: jest.fn(), delete: jest.fn() };
            expect(() => {
                profileOperations.validateConfigMoveAPI(invalidAPI as any, mockLayerActive);
            }).toThrow("ConfigMoveAPI.set is not a function");
        });

        it("should throw error for missing delete function", () => {
            const invalidAPI = { get: jest.fn(), set: jest.fn() };
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
            (mockLayerActive as jest.MockedFunction<() => IConfigLayer>).mockReturnValue({ properties: {} } as any);
            expect(() => {
                profileOperations.validateConfigMoveAPI(mockConfigMoveAPI, mockLayerActive);
            }).toThrow("Invalid layer structure: missing properties or profiles");
        });

        it("should throw error for layerActive that throws", () => {
            (mockLayerActive as jest.MockedFunction<() => IConfigLayer>).mockImplementation(() => {
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
            const result = profileOperations.validateProfileName("", "root", "/config.json", {}, {}, {});
            expect(result.isValid).toBe(true);
        });

        it("should return invalid when profile name exists under root", () => {
            const profiles = {
                existingProfile: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName("existingProfile", "root", "/config.json", profiles, {}, {});
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
            const result = profileOperations.validateProfileName("child", "parent", "/config.json", profiles, {}, {});
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
            const result = profileOperations.validateProfileName("newProfile", "root", "/config.json", {}, pendingChanges, {});
            expect(result.isValid).toBe(false);
            expect(result.message).toBe("Profile name already exists in pending changes");
        });

        it("should return invalid when profile name conflicts with renamed profile", () => {
            const renames = {
                "/config.json": {
                    oldProfile: "newProfile",
                },
            };
            const result = profileOperations.validateProfileName("newProfile", "root", "/config.json", {}, {}, renames);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe("Profile name conflicts with a renamed profile");
        });

        it("should return valid when profile name is available", () => {
            const result = profileOperations.validateProfileName("newProfile", "root", "/config.json", {}, {}, {});
            expect(result.isValid).toBe(true);
        });

        it("should handle nested profile name validation", () => {
            const profiles = {
                parent: {
                    type: "zosmf",
                    properties: {},
                },
            };
            const result = profileOperations.validateProfileName("newChild", "parent", "/config.json", profiles, {}, {});
            expect(result.isValid).toBe(true);
        });
    });
});
