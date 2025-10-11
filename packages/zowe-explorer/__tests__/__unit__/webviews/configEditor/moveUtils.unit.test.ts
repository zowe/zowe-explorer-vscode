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
    moveProfile,
    moveProfileInPlace,
    getSecurePropertiesForProfile,
    moveSecureProperties,
    deleteProfileRecursively,
    updateSecureArrays,
    findSecureArrays,
    isSecurePropertyForProfile,
    updateSecurePropertyPath,
    findProfileInLayer,
    renameProfile,
    renameProfileInPlace,
    updateDefaultsAfterRename,
    simulateDefaultsUpdateAfterRename,
    ConfigMoveAPI,
    IConfigLayer,
} from "../../../../src/webviews/src/config-editor/utils/MoveUtils";

// Mock lodash
jest.mock("lodash", () => ({
    get: jest.fn((obj, path) => {
        const keys = path.split(".");
        let result = obj;
        for (const key of keys) {
            if (result && typeof result === "object" && key in result) {
                result = result[key];
            } else {
                return undefined;
            }
        }
        return result;
    }),
    set: jest.fn((obj, path, value) => {
        const keys = path.split(".");
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== "object") {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }),
}));

// Mock console.warn to avoid noise in tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
    console.warn = jest.fn();
});

afterAll(() => {
    console.warn = originalConsoleWarn;
});

describe("MoveUtils", () => {
    let mockConfigMoveAPI: ConfigMoveAPI;
    let mockLayerActive: () => IConfigLayer;
    let mockLayer: IConfigLayer;

    // Helper function to cast mock functions
    const mockGet = () => mockConfigMoveAPI.get as jest.MockedFunction<(path: string) => any>;
    const mockSet = () => mockConfigMoveAPI.set as jest.MockedFunction<(path: string, value: any) => void>;
    const mockDelete = () => mockConfigMoveAPI.delete as jest.MockedFunction<(path: string) => void>;
    const mockLayerActiveFn = () => mockLayerActive as jest.MockedFunction<() => IConfigLayer>;

    beforeEach(() => {
        mockLayer = {
            properties: {
                profiles: {
                    profile1: { host: "localhost", port: 8080 },
                    profile2: { host: "remote", port: 9090 },
                },
                defaults: {
                    zosmf: "profile1",
                    tso: "profile2",
                },
            },
        };

        mockConfigMoveAPI = {
            get: jest.fn() as jest.MockedFunction<(path: string) => any>,
            set: jest.fn() as jest.MockedFunction<(path: string, value: any) => void>,
            delete: jest.fn() as jest.MockedFunction<(path: string) => void>,
        };

        mockLayerActive = jest.fn().mockReturnValue(mockLayer) as jest.MockedFunction<() => IConfigLayer>;
        jest.clearAllMocks();
    });

    describe("moveProfile", () => {
        it("should move profile successfully (different levels)", () => {
            const sourceProfile = { host: "localhost", port: 8080 };
            mockGet()
                .mockReturnValueOnce(sourceProfile) // source profile
                .mockReturnValueOnce(undefined); // target profile (doesn't exist)

            moveProfile(mockConfigMoveAPI, mockLayerActive, "profiles.source", "profiles.parent.target");

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent.target", sourceProfile);
            expect(mockConfigMoveAPI.delete).toHaveBeenCalledWith("profiles.source");
        });

        it("should throw error when source profile not found", () => {
            mockGet().mockReturnValue(undefined);

            expect(() => {
                moveProfile(mockConfigMoveAPI, mockLayerActive, "profiles.nonexistent", "profiles.target");
            }).toThrow("Source profile not found at path: profiles.nonexistent");
        });

        it("should throw error when target profile already exists", () => {
            const sourceProfile = { host: "localhost" };
            const targetProfile = { host: "remote" };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(targetProfile);

            expect(() => {
                moveProfile(mockConfigMoveAPI, mockLayerActive, "profiles.source", "profiles.target");
            }).toThrow("Target profile already exists at path: profiles.target");
        });
    });

    describe("moveProfileInPlace", () => {
        it("should move profile in place successfully", () => {
            const sourceProfile = { host: "localhost" };
            const parentProfile = { profiles: { source: sourceProfile } };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(undefined).mockReturnValueOnce(parentProfile);

            // This will call renameProfileInPlace internally, which should work
            moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.source", "profiles.target");

            // The function should complete without throwing
            expect(mockConfigMoveAPI.get).toHaveBeenCalled();
        });

        it("should throw error when source profile not found", () => {
            mockGet().mockReturnValue(undefined);

            expect(() => {
                moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.nonexistent", "profiles.target");
            }).toThrow("Source profile not found at path: profiles.nonexistent");
        });

        it("should throw error when target profile already exists", () => {
            const sourceProfile = { host: "localhost" };
            const targetProfile = { host: "remote" };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(targetProfile);

            expect(() => {
                moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.source", "profiles.target");
            }).toThrow("Target profile already exists at path: profiles.target");
        });

        it("should handle same parent path rename", () => {
            const sourceProfile = { host: "localhost" };
            const parentProfile = { profiles: { source: sourceProfile } };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(undefined).mockReturnValueOnce(parentProfile);

            moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.parent.source", "profiles.parent.target");

            // The function should complete without throwing
            expect(mockConfigMoveAPI.get).toHaveBeenCalled();
        });

        it("should move profile from parent to different parent", () => {
            const sourceProfile = { host: "localhost" };
            const sourceParentProfile = { profiles: { source: sourceProfile } };
            const targetParentProfile = { profiles: {} };
            mockGet()
                .mockReturnValueOnce(sourceProfile)
                .mockReturnValueOnce(undefined)
                .mockReturnValueOnce(sourceParentProfile)
                .mockReturnValueOnce(targetParentProfile);

            moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.parent1.source", "profiles.parent2.target");

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent1", { profiles: {} });
            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent2", { profiles: { target: sourceProfile } });
        });

        it("should move profile from root to parent", () => {
            const sourceProfile = { host: "localhost" };
            const targetParentProfile = { profiles: {} };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(undefined).mockReturnValueOnce(targetParentProfile);

            moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "source", "profiles.parent.target");

            // The function should complete without throwing
            expect(mockConfigMoveAPI.get).toHaveBeenCalled();
        });

        it("should move profile from parent to root", () => {
            const sourceProfile = { host: "localhost" };
            const sourceParentProfile = { profiles: { source: sourceProfile } };
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(undefined).mockReturnValueOnce(sourceParentProfile);

            moveProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.parent.source", "target");

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent", { profiles: {} });
            expect(mockLayer.properties.profiles.target).toBe(sourceProfile);
        });
    });

    describe("getSecurePropertiesForProfile", () => {
        it("should return secure properties from profile", () => {
            const profile = { host: "localhost", secure: ["password", "token"] };
            mockGet().mockReturnValue(profile);

            const result = getSecurePropertiesForProfile(mockConfigMoveAPI, "profiles.test");

            expect(result).toEqual(["password", "token"]);
        });

        it("should return empty array when profile has no secure properties", () => {
            const profile = { host: "localhost" };
            mockGet().mockReturnValue(profile);

            const result = getSecurePropertiesForProfile(mockConfigMoveAPI, "profiles.test");

            expect(result).toEqual([]);
        });

        it("should return empty array when profile is null", () => {
            mockGet().mockReturnValue(null);

            const result = getSecurePropertiesForProfile(mockConfigMoveAPI, "profiles.test");

            expect(result).toEqual([]);
        });
    });

    describe("moveSecureProperties", () => {
        it("should move secure properties", () => {
            const sourceSecure = ["password"];
            const targetSecure = ["token"];
            mockGet().mockReturnValue({ secure: targetSecure });

            moveSecureProperties(mockConfigMoveAPI, mockLayerActive, "profiles.source", "profiles.target", sourceSecure);

            expect(mockConfigMoveAPI.get).toHaveBeenCalledWith("profiles.target");
        });
    });

    describe("deleteProfileRecursively", () => {
        it("should delete profile without nested profiles", () => {
            const profile = { host: "localhost" };
            mockGet().mockReturnValue(profile);

            deleteProfileRecursively(mockConfigMoveAPI, mockLayerActive, "profiles.test");

            expect(mockConfigMoveAPI.delete).toHaveBeenCalledWith("profiles.test");
        });

        it("should delete profile with nested profiles recursively", () => {
            const profile = {
                host: "localhost",
                profiles: {
                    child1: { host: "child1" },
                    child2: { host: "child2" },
                },
            };
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce({ host: "child1" }).mockReturnValueOnce({ host: "child2" });

            deleteProfileRecursively(mockConfigMoveAPI, mockLayerActive, "profiles.parent");

            expect(mockConfigMoveAPI.delete).toHaveBeenCalledWith("profiles.parent.profiles.child1");
            expect(mockConfigMoveAPI.delete).toHaveBeenCalledWith("profiles.parent.profiles.child2");
            expect(mockConfigMoveAPI.delete).toHaveBeenCalledWith("profiles.parent");
        });

        it("should handle non-existent profile gracefully", () => {
            mockGet().mockReturnValue(null);

            expect(() => {
                deleteProfileRecursively(mockConfigMoveAPI, mockLayerActive, "profiles.nonexistent");
            }).not.toThrow();
        });
    });

    describe("updateSecureArrays", () => {
        it("should update secure arrays", () => {
            // Create a layer with secure properties to trigger the update logic
            const layerWithSecure = {
                properties: {
                    profiles: {
                        test: { secure: ["password"] },
                    },
                },
            };

            updateSecureArrays(() => layerWithSecure, "profiles.test", "profiles.test", ["password"], ["token"]);

            // Verify that set was called (mocked lodash.set)
            const { set } = require("lodash");
            expect(set).toHaveBeenCalled();
        });
    });

    describe("findSecureArrays", () => {
        it("should find secure arrays in profiles", () => {
            const layer = {
                properties: {
                    profiles: {
                        profile1: { secure: ["password"] },
                        profile2: { host: "localhost" },
                        profile3: {
                            secure: ["token"],
                            profiles: {
                                child: { secure: ["childToken"] },
                            },
                        },
                    },
                },
            };

            const result = findSecureArrays(() => layer);

            expect(result).toHaveLength(3);
            expect(result[0].profilePath).toBe("profiles.profile1");
            expect(result[1].profilePath).toBe("profiles.profile3");
            expect(result[2].profilePath).toBe("profiles.profile3.profiles.child");
        });

        it("should return empty array when no secure properties", () => {
            const layer = {
                properties: {
                    profiles: {
                        profile1: { host: "localhost" },
                        profile2: { port: 8080 },
                    },
                },
            };

            const result = findSecureArrays(() => layer);

            expect(result).toHaveLength(0);
        });
    });

    describe("isSecurePropertyForProfile", () => {
        it("should return true for matching profile path", () => {
            const result = isSecurePropertyForProfile("profiles.test", "profiles.test.secure.password");
            expect(result).toBe(true);
        });

        it("should return false for non-matching profile path", () => {
            // Clear any previous mocks
            jest.clearAllMocks();
            const result = isSecurePropertyForProfile("profiles.test", "profiles.other.secure.password");
            expect(result).toBe(false);
        });

        it("should return true for exact match", () => {
            const result = isSecurePropertyForProfile("profiles.test", "profiles.test");
            expect(result).toBe(true);
        });
    });

    describe("updateSecurePropertyPath", () => {
        it("should update secure property path", () => {
            const result = updateSecurePropertyPath("profiles.old.secure.password", "profiles.old", "profiles.new");
            expect(result).toBe("profiles.new.secure.password");
        });

        it("should handle multiple occurrences", () => {
            const result = updateSecurePropertyPath("profiles.old.secure.profiles.old.password", "profiles.old", "profiles.new");
            expect(result).toBe("profiles.new.secure.profiles.old.password");
        });
    });

    describe("findProfileInLayer", () => {
        it("should find profile in layer", () => {
            const layer = {
                properties: {
                    profiles: {
                        profile1: { host: "localhost" },
                        profile2: {
                            host: "remote",
                            profiles: {
                                child: { host: "child" },
                            },
                        },
                    },
                },
            };

            const result = findProfileInLayer(layer, "profile1");
            expect(result).toEqual({ host: "localhost" });
        });

        it("should find nested profile in layer", () => {
            const layer = {
                properties: {
                    profiles: {
                        profile1: { host: "localhost" },
                        profile2: {
                            host: "remote",
                            profiles: {
                                child: { host: "child" },
                            },
                        },
                    },
                },
            };

            const result = findProfileInLayer(layer, "profile2.child");
            expect(result).toEqual({ host: "child" });
        });

        it("should return null for non-existent profile", () => {
            const layer = {
                properties: {
                    profiles: {
                        profile1: { host: "localhost" },
                    },
                },
            };

            const result = findProfileInLayer(layer, "nonexistent");
            expect(result).toBeNull();
        });
    });

    describe("renameProfile", () => {
        it("should rename profile successfully", () => {
            const profile = { host: "localhost" };
            const parentProfile = { profiles: { old: profile } };
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce(undefined).mockReturnValueOnce(parentProfile);

            const result = renameProfile(mockConfigMoveAPI, mockLayerActive, "profiles.old", "new");

            expect(result).toBe("profiles.new");
        });

        it("should throw error when profile not found", () => {
            mockGet().mockReturnValue(null);

            expect(() => {
                renameProfile(mockConfigMoveAPI, mockLayerActive, "profiles.nonexistent", "new");
            }).toThrow("Profile not found at path: profiles.nonexistent");
        });

        it("should throw error when new profile already exists", () => {
            const profile = { host: "localhost" };
            const existingProfile = { host: "remote" };
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce(existingProfile);

            expect(() => {
                renameProfile(mockConfigMoveAPI, mockLayerActive, "profiles.old", "existing");
            }).toThrow("Profile with name 'existing' already exists");
        });
    });

    describe("renameProfileInPlace", () => {
        it("should throw error when source profile not found", () => {
            mockGet().mockReturnValue(null);

            expect(() => {
                renameProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.nonexistent", "profiles.new");
            }).toThrow("Source profile not found at path: profiles.nonexistent");
        });

        it("should throw error when target profile already exists", () => {
            const profile = { host: "localhost" };
            const existingProfile = { host: "remote" };
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce(existingProfile);

            expect(() => {
                renameProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.old", "profiles.existing");
            }).toThrow("Target profile already exists at path: profiles.existing");
        });

        it("should handle parent profile rename", () => {
            const profile = { host: "localhost" };
            const parentProfile = { profiles: { old: profile } };
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce(undefined).mockReturnValueOnce(parentProfile);

            renameProfileInPlace(mockConfigMoveAPI, mockLayerActive, "profiles.parent.old", "profiles.parent.new");

            expect(mockConfigMoveAPI.set).toHaveBeenCalledWith("profiles.parent", { profiles: { new: profile } });
        });

        it("should handle root level profile rename", () => {
            const profile = { host: "localhost" };
            // Add the profile to the layer
            mockLayer.properties.profiles.old = profile;
            mockGet().mockReturnValueOnce(profile).mockReturnValueOnce(undefined);

            renameProfileInPlace(mockConfigMoveAPI, mockLayerActive, "old", "new");

            expect(mockLayer.properties.profiles.new).toBe(profile);
            expect(mockLayer.properties.profiles.old).toBeUndefined();
        });
    });

    describe("updateDefaultsAfterRename", () => {
        it("should update defaults after profile rename", () => {
            const updateTeamConfig = jest.fn();

            updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1", updateTeamConfig);

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1");
            expect(updateTeamConfig).toHaveBeenCalledWith(mockLayer.properties.defaults);
        });

        it("should update child profile defaults", () => {
            mockLayer.properties.defaults = {
                zosmf: "profile1.child",
                tso: "profile2",
            };

            updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1.child");
            expect(mockLayer.properties.defaults?.tso).toBe("profile2");
        });

        it("should handle non-string default values", () => {
            mockLayer.properties.defaults = {
                zosmf: "profile1",
                tso: "123", // non-string value
            };

            updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1");
            expect(mockLayer.properties.defaults?.tso).toBe("123");
        });

        it("should handle missing defaults", () => {
            mockLayer.properties.defaults = undefined;

            expect(() => {
                updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();
        });

        it("should handle errors gracefully", () => {
            mockLayerActiveFn().mockImplementation(() => {
                throw new Error("Layer error");
            });

            expect(() => {
                updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();

            expect(console.warn).toHaveBeenCalledWith("Failed to update defaults after profile rename: Error: Layer error");
        });
    });

    describe("simulateDefaultsUpdateAfterRename", () => {
        it("should simulate defaults update after profile rename", () => {
            simulateDefaultsUpdateAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1");
        });

        it("should simulate child profile defaults update", () => {
            mockLayer.properties.defaults = {
                zosmf: "profile1.child",
                tso: "profile2",
            };

            simulateDefaultsUpdateAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1.child");
            expect(mockLayer.properties.defaults?.tso).toBe("profile2");
        });

        it("should handle non-string default values", () => {
            mockLayer.properties.defaults = {
                zosmf: "profile1",
                tso: "123", // non-string value
            };

            simulateDefaultsUpdateAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1");
            expect(mockLayer.properties.defaults?.tso).toBe("123");
        });

        it("should handle missing defaults", () => {
            mockLayer.properties.defaults = undefined;

            expect(() => {
                simulateDefaultsUpdateAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();
        });

        it("should handle errors gracefully", () => {
            mockLayerActiveFn().mockImplementation(() => {
                throw new Error("Layer error");
            });

            expect(() => {
                simulateDefaultsUpdateAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();

            expect(console.warn).toHaveBeenCalledWith("Failed to simulate defaults update after profile rename: Error: Layer error");
        });
    });

    describe("moveProfileInPlaceOrdered (private function) - root level", () => {
        it("should handle root level profile rename", () => {
            const sourceProfile = { host: "localhost" };
            mockLayer.properties.profiles.source = sourceProfile;
            mockGet().mockReturnValueOnce(sourceProfile).mockReturnValueOnce(undefined);

            moveProfile(mockConfigMoveAPI, mockLayerActive, "source", "target");

            expect(mockLayer.properties.profiles.target).toEqual(sourceProfile);
            expect(mockLayer.properties.profiles.source).toBeUndefined();
        });
    });
});
