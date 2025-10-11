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

import { ConfigEditorPathUtils } from "../../../../src/utils/ConfigEditorPathUtils";

describe("ConfigEditorPathUtils", () => {
    describe("constructNestedProfilePath", () => {
        it("should construct nested profile path for single profile", () => {
            const result = ConfigEditorPathUtils.constructNestedProfilePath("testProfile");
            expect(result).toBe("profiles.testProfile");
        });

        it("should construct nested profile path for nested profiles", () => {
            const result = ConfigEditorPathUtils.constructNestedProfilePath("parent.child");
            expect(result).toBe("profiles.parent.profiles.child");
        });

        it("should construct nested profile path for deeply nested profiles", () => {
            const result = ConfigEditorPathUtils.constructNestedProfilePath("a.b.c.d");
            expect(result).toBe("profiles.a.profiles.b.profiles.c.profiles.d");
        });

        it("should throw error for empty profile key", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath("");
            }).toThrow("Profile key must be a non-empty string");
        });

        it("should throw error for null profile key", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath(null as any);
            }).toThrow("Profile key must be a non-empty string");
        });

        it("should throw error for undefined profile key", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath(undefined as any);
            }).toThrow("Profile key must be a non-empty string");
        });

        it("should throw error for non-string profile key", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath(123 as any);
            }).toThrow("Profile key must be a non-empty string");
        });

        it("should throw error for profile key with empty parts", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath("test..profile");
            }).toThrow("Profile key parts cannot be empty");
        });

        it("should throw error for profile key with whitespace-only parts", () => {
            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath("test. .profile");
            }).toThrow("Profile key parts cannot be empty");
        });

        it("should handle edge case with split result", () => {
            // This test covers the theoretical case where split might return empty array
            // In practice, split(".") on a non-empty string will never return empty array
            // But we test the condition for completeness
            const originalSplit = String.prototype.split;
            String.prototype.split = jest.fn().mockReturnValue([]);

            expect(() => {
                ConfigEditorPathUtils.constructNestedProfilePath("test");
            }).toThrow("Profile key cannot be empty");

            // Restore original split
            String.prototype.split = originalSplit;
        });
    });

    describe("getNewProfilePath", () => {
        let renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>;

        beforeEach(() => {
            renameMap = new Map();
        });

        it("should return original path when no renames match", () => {
            const result = ConfigEditorPathUtils.getNewProfilePath("test.profile", "/config.json", renameMap);
            expect(result).toBe("test.profile");
        });

        it("should return original path with profiles segments when includeProfilesSegments is true", () => {
            const result = ConfigEditorPathUtils.getNewProfilePath("test.profile", "/config.json", renameMap, true);
            expect(result).toBe("profiles.test.profiles.profile");
        });

        it("should apply rename for exact match", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("test", "/config.json", renameMap);
            expect(result).toBe("renamed");
        });

        it("should apply rename for partial match", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("test.profile", "/config.json", renameMap);
            expect(result).toBe("renamed.profile");
        });

        it("should apply rename for nested partial match", () => {
            renameMap.set("test.profile", { oldKey: "test.profile", newKey: "renamed.profile", configPath: "/config.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("test.profile.sub", "/config.json", renameMap);
            expect(result).toBe("renamed.profile.sub");
        });

        it("should apply rename with profiles segments when includeProfilesSegments is true", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("test.profile", "/config.json", renameMap, true);
            expect(result).toBe("profiles.renamed.profiles.profile");
        });

        it("should not apply rename for different config path", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/other.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("test", "/config.json", renameMap);
            expect(result).toBe("test");
        });

        it("should handle complex nested renames", () => {
            renameMap.set("a.b", { oldKey: "a.b", newKey: "x.y", configPath: "/config.json" });
            const result = ConfigEditorPathUtils.getNewProfilePath("a.b.c.d", "/config.json", renameMap);
            expect(result).toBe("x.y.c.d");
        });

        it("should handle single profile with profiles segments", () => {
            const result = ConfigEditorPathUtils.getNewProfilePath("test", "/config.json", renameMap, true);
            expect(result).toBe("profiles.test");
        });
    });

    describe("updateChangeKey", () => {
        let renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>;

        beforeEach(() => {
            renameMap = new Map();
        });

        it("should return unchanged change when no key", () => {
            const change = { value: "test" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result).toEqual(change);
        });

        it("should return unchanged change when no renames match", () => {
            const change = { key: "profiles.test.properties.host", value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result).toEqual(change);
        });

        it("should update key for profile rename with properties", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { key: "profiles.test.properties.host", value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.renamed.properties.host");
        });

        it("should update key for nested profile rename with properties", () => {
            renameMap.set("test.profile", { oldKey: "test.profile", newKey: "renamed.profile", configPath: "/config.json" });
            const change = { key: "profiles.test.profiles.profile.properties.host", value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.renamed.profiles.profile.properties.host");
        });

        it("should update key for profile rename with type", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { key: "profiles.test.type", value: "zosmf" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.renamed.type");
        });

        it("should update key for profile rename with secure", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { key: "profiles.test.secure", value: ["password"] };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.renamed.secure");
        });

        it("should handle profile-only key", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { key: "profiles.test", value: "profile" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.renamed");
        });

        it("should not update key for different config path", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/other.json" });
            const change = { key: "profiles.test.properties.host", value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.test.properties.host");
        });

        it("should handle complex nested profile paths", () => {
            renameMap.set("a.b", { oldKey: "a.b", newKey: "x.y", configPath: "/config.json" });
            const change = { key: "profiles.a.profiles.b.properties.host", value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result.key).toBe("profiles.x.profiles.y.properties.host");
        });

        it("should preserve other change properties", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { key: "profiles.test.properties.host", value: "localhost", type: "string" };
            const result = ConfigEditorPathUtils.updateChangeKey(change, "/config.json", renameMap);
            expect(result).toEqual({
                key: "profiles.renamed.properties.host",
                value: "localhost",
                type: "string",
            });
        });
    });

    describe("updateChangePath", () => {
        let renameMap: Map<string, { oldKey: string; newKey: string; configPath: string }>;

        beforeEach(() => {
            renameMap = new Map();
        });

        it("should return unchanged change when no path", () => {
            const change = { value: "test" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result).toEqual(change);
        });

        it("should return unchanged change when path is not array", () => {
            const change = { path: "not-an-array", value: "test" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result).toEqual(change);
        });

        it("should return unchanged change when no renames match", () => {
            const change = { path: ["profiles", "test", "properties", "host"], value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result).toEqual(change);
        });

        it("should update path for profile rename with properties", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "properties", "host"], value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed", "properties", "host"]);
        });

        it("should update path for nested profile rename with properties", () => {
            renameMap.set("test.profile", { oldKey: "test.profile", newKey: "renamed.profile", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "profiles", "profile", "properties", "host"], value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed", "profiles", "profile", "properties", "host"]);
        });

        it("should update path for profile rename with type", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "type"], value: "zosmf" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed", "type"]);
        });

        it("should update path for profile rename with secure", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "secure"], value: ["password"] };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed", "secure"]);
        });

        it("should handle profile-only path", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test"], value: "profile" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed"]);
        });

        it("should not update path for different config path", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/other.json" });
            const change = { path: ["profiles", "test", "properties", "host"], value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "test", "properties", "host"]);
        });

        it("should handle complex nested profile paths", () => {
            renameMap.set("a.b", { oldKey: "a.b", newKey: "x.y", configPath: "/config.json" });
            const change = { path: ["profiles", "a", "profiles", "b", "properties", "host"], value: "localhost" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "x", "profiles", "y", "properties", "host"]);
        });

        it("should preserve other change properties", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "properties", "host"], value: "localhost", type: "string" };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result).toEqual({
                path: ["profiles", "renamed", "properties", "host"],
                value: "localhost",
                type: "string",
            });
        });

        it("should handle path with multiple property sections", () => {
            renameMap.set("test", { oldKey: "test", newKey: "renamed", configPath: "/config.json" });
            const change = { path: ["profiles", "test", "properties", "host", "port"], value: 8080 };
            const result = ConfigEditorPathUtils.updateChangePath(change, "/config.json", renameMap);
            expect(result.path).toEqual(["profiles", "renamed", "properties", "host", "port"]);
        });
    });
});
