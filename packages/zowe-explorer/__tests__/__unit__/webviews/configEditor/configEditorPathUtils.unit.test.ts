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
import type { PathAwareChange } from "../../../../src/utils/ConfigTypes";

describe("ConfigEditorPathUtils", () => {
    describe("constructNestedProfilePath", () => {
        it.each([
            ["testProfile", "profiles.testProfile"],
            ["parent.child", "profiles.parent.profiles.child"],
            ["a.b.c.d", "profiles.a.profiles.b.profiles.c.profiles.d"],
        ])("constructs the nested path for %s", (key, expected) => {
            expect(ConfigEditorPathUtils.constructNestedProfilePath(key)).toBe(expected);
        });
        it.each(["", null, undefined, 123])("rejects a non-profile key: %s", (key) => {
            expect(() => ConfigEditorPathUtils.constructNestedProfilePath(key as string)).toThrow("Profile key must be a non-empty string");
        });
        it.each(["test..profile", "test. .profile"])("rejects empty name segments in %s", (key) => {
            expect(() => ConfigEditorPathUtils.constructNestedProfilePath(key)).toThrow("Profile key parts cannot be empty");
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

    describe.each(["key", "path"] as const)("rename-aware %s adapter", (field) => {
        const update =
            field === "key"
                ? ConfigEditorPathUtils.updateChangeKey.bind(ConfigEditorPathUtils)
                : ConfigEditorPathUtils.updateChangePath.bind(ConfigEditorPathUtils);
        const address = (value: string) => (field === "key" ? value : value.split("."));
        const configPath = "/config.json";

        it.each([
            {
                name: "unmatched profile",
                old: "other",
                target: "renamed",
                input: "profiles.test.properties.host",
                expected: "profiles.test.properties.host",
            },
            {
                name: "property",
                old: "test",
                target: "renamed",
                input: "profiles.test.properties.host",
                expected: "profiles.renamed.properties.host",
            },
            {
                name: "nested profile",
                old: "test.profile",
                target: "renamed.profile",
                input: "profiles.test.profiles.profile.properties.host",
                expected: "profiles.renamed.profiles.profile.properties.host",
            },
            { name: "type", old: "test", target: "renamed", input: "profiles.test.type", expected: "profiles.renamed.type" },
            { name: "secure metadata", old: "test", target: "renamed", input: "profiles.test.secure", expected: "profiles.renamed.secure" },
            { name: "whole profile", old: "test", target: "renamed", input: "profiles.test", expected: "profiles.renamed" },
            {
                name: "different config",
                old: "test",
                target: "renamed",
                input: "profiles.test.properties.host",
                expected: "profiles.test.properties.host",
                otherConfig: true,
            },
            {
                name: "changed ancestors",
                old: "a.b",
                target: "x.y",
                input: "profiles.a.profiles.b.properties.host",
                expected: "profiles.x.profiles.y.properties.host",
            },
            {
                name: "nested property suffix",
                old: "test",
                target: "renamed",
                input: "profiles.test.properties.host.port",
                expected: "profiles.renamed.properties.host.port",
            },
            {
                name: "JSON field names used as profile names",
                old: "properties.type",
                target: "renamed",
                input: "profiles.properties.profiles.type.secure",
                expected: "profiles.renamed.secure",
            },
        ])("rewrites $name while preserving other change fields", ({ old, target, input, expected, otherConfig }) => {
            const map = new Map([[old, { oldKey: old, newKey: target, configPath: otherConfig ? "/other.json" : configPath }]]);
            const change = { [field]: address(input), value: "localhost", type: "string" };
            expect(update(change, configPath, map)).toEqual({ ...change, [field]: address(expected) });
            expect(change[field]).toEqual(address(input));
        });

        it("leaves a change without an address unchanged", () => {
            expect(update({ value: "test" }, configPath, new Map())).toEqual({ value: "test" });
        });
    });

    it("leaves a non-array path unchanged", () => {
        const change = { path: "not-an-array", value: "test" } as unknown as PathAwareChange;
        expect(ConfigEditorPathUtils.updateChangePath(change, "/config.json", new Map())).toEqual(change);
    });
});
