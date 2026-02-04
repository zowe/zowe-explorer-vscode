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

import { isProfileDefault, isCurrentProfileUntyped } from "../../../../src/webviews/src/config-editor/utils/profileHelpers";

const configPath = "/c";
const configs = [
    {
        configPath,
        properties: {
            defaults: { zowe: "base" },
            profiles: { base: { type: "zowe", properties: {} } },
        },
    },
] as any;

describe("profileHelpers", () => {
    describe("isProfileDefault", () => {
        it("returns false when selectedTab is null", () => {
            expect(isProfileDefault("base", null, configs, {}, {}, {})).toBe(false);
        });
        it("returns false when profile has no type", () => {
            const untypedConfigs = [
                {
                    configPath,
                    properties: {
                        defaults: { zowe: "base" },
                        profiles: { base: { properties: {} } },
                    },
                },
            ] as any;
            expect(isProfileDefault("base", 0, untypedConfigs, {}, {}, {})).toBe(false);
        });
        it("returns true when profile matches config default", () => {
            expect(isProfileDefault("base", 0, configs, {}, {}, {})).toBe(true);
        });
        it("returns true when profile matches pending default", () => {
            const pendingDefaults = { [configPath]: { zowe: { value: "base", path: [] } } };
            expect(isProfileDefault("base", 0, configs, {}, pendingDefaults, {})).toBe(true);
        });
        it("returns true when default was renamed to current profile", () => {
            const renames = { [configPath]: { oldBase: "base" } };
            const configsWithRename = [
                {
                    configPath,
                    properties: {
                        defaults: { zowe: "oldBase" },
                        profiles: { base: { type: "zowe", properties: {} } },
                    },
                },
            ] as any;
            expect(isProfileDefault("base", 0, configsWithRename, {}, {}, renames)).toBe(true);
        });
        it("returns false when profile does not match default", () => {
            const configsOther = [
                {
                    configPath,
                    properties: {
                        defaults: { zowe: "other" },
                        profiles: { base: { type: "zowe" }, other: { type: "zowe" } },
                    },
                },
            ] as any;
            expect(isProfileDefault("base", 0, configsOther, {}, {}, {})).toBe(false);
        });
        it("returns true when default matches via rename loop (defaultValue === originalKey && newKey === profileKey)", () => {
            const renames = { [configPath]: { old1: "base", old2: "base" } };
            const configsMulti = [
                {
                    configPath,
                    properties: {
                        defaults: { zowe: "old1" },
                        profiles: { base: { type: "zowe", properties: {} } },
                    },
                },
            ] as any;
            expect(isProfileDefault("base", 0, configsMulti, {}, {}, renames)).toBe(true);
        });
        it("returns true when default is nested and rename applies to parent (child path match)", () => {
            const renames = { [configPath]: { parent: "parentNew", parentNew: "parentX" } };
            const configsNested = [
                {
                    configPath,
                    properties: {
                        defaults: { zowe: "parentNew.old" },
                        profiles: {
                            parentX: { type: "zowe", profiles: { old: { type: "zowe", properties: {} } } },
                        },
                    },
                },
            ] as any;
            expect(isProfileDefault("parentX.old", 0, configsNested, {}, {}, renames)).toBe(true);
        });
    });

    describe("isCurrentProfileUntyped", () => {
        it("returns false when selectedProfileKey is null", () => {
            expect(isCurrentProfileUntyped(null, 0, configs, {}, {})).toBe(false);
        });
        it("returns false when profile has type", () => {
            expect(isCurrentProfileUntyped("base", 0, configs, {}, {})).toBe(false);
        });
        it("returns true when profile has no type", () => {
            const untypedConfigs = [
                {
                    configPath,
                    properties: {
                        profiles: { untyped: { properties: {} } },
                    },
                },
            ] as any;
            expect(isCurrentProfileUntyped("untyped", 0, untypedConfigs, {}, {})).toBe(true);
        });
    });
});
