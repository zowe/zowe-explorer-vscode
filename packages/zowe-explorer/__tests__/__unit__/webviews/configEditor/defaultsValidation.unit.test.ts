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

import { findInvalidDefaults, getEffectiveDefaultValue } from "../../../../src/webviews/src/config-editor/utils/defaultsValidation";
import { doesSavedProfileExist } from "../../../../src/webviews/src/config-editor/utils/profileKeyListing";

const configPath = "/c";

const configWith = (defaults: Record<string, unknown>, profiles: Record<string, unknown>) =>
    [{ configPath, user: false, global: false, properties: { defaults, profiles } } as any];

describe("defaultsValidation", () => {
    describe("getEffectiveDefaultValue", () => {
        it("prefers a pending edit over the saved value", () => {
            const value = getEffectiveDefaultValue({
                profileType: "zosmf",
                configPath,
                savedDefaults: { zosmf: "saved" },
                pendingDefaults: { [configPath]: { zosmf: { value: "staged", path: ["zosmf"] } } },
                renames: {},
            });
            expect(value).toBe("staged");
        });
        it("maps the saved value through a pending rename", () => {
            const value = getEffectiveDefaultValue({
                profileType: "zosmf",
                configPath,
                savedDefaults: { zosmf: "old" },
                pendingDefaults: {},
                renames: { [configPath]: { old: "new" } },
            });
            expect(value).toBe("new");
        });
        it("returns an empty string when unset", () => {
            const value = getEffectiveDefaultValue({
                profileType: "zosmf",
                configPath,
                savedDefaults: {},
                pendingDefaults: {},
                renames: {},
            });
            expect(value).toBe("");
        });
    });

    describe("findInvalidDefaults", () => {
        it("reports a default naming a profile that does not exist", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "ghost" }, { real: { type: "zosmf", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([{ configPath, profileType: "zosmf", profileName: "ghost" }]);
        });

        it("accepts a default that names an existing profile of that type", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "real" }, { real: { type: "zosmf", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([]);
        });

        it("treats an empty default as unset rather than invalid", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "" }, { real: { type: "zosmf", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([]);
        });

        it("honours a pending rename of the profile the default points at", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "old" }, { old: { type: "zosmf", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: {},
                pendingChanges: {},
                renames: { [configPath]: { old: "new" } },
            });
            expect(result).toEqual([]);
        });

        it("reports a staged default that points at a missing profile", () => {
            const result = findInvalidDefaults({
                configurations: configWith({}, { real: { type: "zosmf", properties: {} } }),
                pendingDefaults: { [configPath]: { zosmf: { value: "ghost", path: ["zosmf"] } } },
                defaultsDeletions: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([{ configPath, profileType: "zosmf", profileName: "ghost" }]);
        });

        it("ignores defaults staged for deletion", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "ghost" }, { real: { type: "zosmf", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: { [configPath]: ["zosmf"] },
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([]);
        });

        it("reports a default naming a profile of a different type", () => {
            const result = findInvalidDefaults({
                configurations: configWith({ zosmf: "other" }, { other: { type: "tso", properties: {} } }),
                pendingDefaults: {},
                defaultsDeletions: {},
                pendingChanges: {},
                renames: {},
            });
            expect(result).toEqual([{ configPath, profileType: "zosmf", profileName: "other" }]);
        });
    });
});

describe("doesSavedProfileExist", () => {
    const configurations = [
        {
            configPath,
            properties: {
                profiles: {
                    lpar1: { type: "zosmf", properties: {}, profiles: { nested: { type: "tso", properties: {} } } },
                    solo: { type: "zosmf", properties: {} },
                },
            },
        } as any,
    ];

    it("finds a top-level profile saved on disk", () => {
        expect(doesSavedProfileExist("solo", configPath, configurations)).toBe(true);
    });

    it("finds a nested profile by its dotted key", () => {
        expect(doesSavedProfileExist("lpar1.nested", configPath, configurations)).toBe(true);
    });

    it("returns false for a profile that exists only as a pending change", () => {
        // The saved config has no "ghost"; pending state is deliberately not consulted, which is
        // what stops a reverted profile from staying selected.
        expect(doesSavedProfileExist("ghost", configPath, configurations)).toBe(false);
    });

    it("returns false for an unknown config path", () => {
        expect(doesSavedProfileExist("solo", "/other", configurations)).toBe(false);
    });

    it("returns false when the config has no profiles", () => {
        expect(doesSavedProfileExist("solo", configPath, [{ configPath, properties: {} } as any])).toBe(false);
    });
});
