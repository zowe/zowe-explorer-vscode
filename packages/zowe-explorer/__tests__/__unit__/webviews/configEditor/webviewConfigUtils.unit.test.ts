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
    flattenKeys,
    flattenProfiles,
    pathFromArray,
    extractProfileKeyFromPath,
    sortConfigEntries,
    parseValueByType,
    stringifyValueByType,
} from "../../../../src/webviews/src/config-editor/utils/configUtils";

describe("webview configUtils", () => {
    describe("pathFromArray", () => {
        it("should join array elements with dots", () => {
            expect(pathFromArray(["profiles", "test", "properties", "host"])).toBe("profiles.test.properties.host");
        });

        it("should return empty string for empty array", () => {
            expect(pathFromArray([])).toBe("");
        });

        it("should return single element for single-item array", () => {
            expect(pathFromArray(["profiles"])).toBe("profiles");
        });
    });

    describe("flattenKeys", () => {
        it("should flatten simple object to dot-notation keys", () => {
            const result = flattenKeys({ host: "localhost", port: 443 });
            expect(result).toEqual({
                host: { value: "localhost", path: ["host"] },
                port: { value: 443, path: ["port"] },
            });
        });

        it("should flatten nested objects", () => {
            const result = flattenKeys({ profiles: { test: { host: "x" } } });
            expect(result["profiles.test.host"]).toEqual({ value: "x", path: ["profiles", "test", "host"] });
        });
    });

    describe("parseValueByType", () => {
        it("should parse boolean true", () => {
            expect(parseValueByType("true", "boolean")).toBe(true);
        });
        it("should parse boolean false", () => {
            expect(parseValueByType("false", "boolean")).toBe(false);
        });
        it("should parse number", () => {
            expect(parseValueByType("443", "number")).toBe(443);
        });
        it("should return value as-is when no type", () => {
            expect(parseValueByType("hello", undefined)).toBe("hello");
        });
        it("should return 0 for non-numeric string when type is number", () => {
            expect(parseValueByType("abc", "number")).toBe(0);
        });
        it("should return value as-is for unknown type", () => {
            expect(parseValueByType("x", "string")).toBe("x");
        });
    });

    describe("stringifyValueByType", () => {
        it("should stringify boolean", () => {
            expect(stringifyValueByType(true)).toBe("true");
            expect(stringifyValueByType(false)).toBe("false");
        });
        it("should stringify number", () => {
            expect(stringifyValueByType(443)).toBe("443");
        });
    });

    describe("flattenProfiles", () => {
        it("should return empty object for null or non-object", () => {
            expect(flattenProfiles(null)).toEqual({});
            expect(flattenProfiles(undefined)).toEqual({});
            expect(flattenProfiles("x")).toEqual({});
        });
        it("should flatten top-level profiles without nested", () => {
            const profiles = { base: { type: "zowe", host: "a" } };
            expect(flattenProfiles(profiles)).toEqual({ base: { type: "zowe", host: "a" } });
        });
        it("should flatten nested profiles and strip profiles key", () => {
            const profiles = { base: { type: "zowe", profiles: { nested: { type: "zowe", host: "b" } } } };
            const result = flattenProfiles(profiles);
            expect(result["base"]).toEqual({ type: "zowe" });
            expect(result["base.nested"]).toEqual({ type: "zowe", host: "b" });
        });
    });

    describe("extractProfileKeyFromPath", () => {
        it("when path[0] !== profiles returns path[0]", () => {
            expect(extractProfileKeyFromPath(["defaults"])).toBe("defaults");
        });
        it("when path is profiles and length 2 returns path[1]", () => {
            expect(extractProfileKeyFromPath(["profiles", "myProfile"])).toBe("myProfile");
        });
        it("when path has single profiles segment returns path[1]", () => {
            expect(extractProfileKeyFromPath(["profiles", "p1", "properties"])).toBe("p1");
        });
        it("when path has multiple profiles segments returns qualified key before properties/type", () => {
            expect(extractProfileKeyFromPath(["profiles", "profiles", "a", "profiles", "b", "properties"])).toBe("a.b");
        });
        it("when multiple profiles and no properties/type returns full profile parts", () => {
            expect(extractProfileKeyFromPath(["profiles", "profiles", "a", "profiles", "b"])).toBe("a.b");
        });
    });

    describe("sortConfigEntries", () => {
        it("sorts type first, then alphabetical keys, then properties, then secure", () => {
            const entries: [string, any][] = [
                ["secure", []],
                ["type", "zowe"],
                ["properties", {}],
                ["host", "x"],
            ];
            const sorted = sortConfigEntries([...entries]);
            expect(sorted[0][0]).toBe("type");
            expect(sorted[1][0]).toBe("host");
            expect(sorted[2][0]).toBe("properties");
            expect(sorted[3][0]).toBe("secure");
        });
        it("uses localeCompare for same-order keys", () => {
            const entries: [string, any][] = [
                ["b", 1],
                ["a", 2],
            ];
            const sorted = sortConfigEntries(entries);
            expect(sorted[0][0]).toBe("a");
            expect(sorted[1][0]).toBe("b");
        });
    });
});
