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
    getProfileType,
    getRenamedProfileKey,
    getRenamedProfileKeyWithNested,
    getOriginalProfileKey,
    getOriginalProfileKeyWithNested,
    getAvailableProfilesByType,
    getOrderedProfileKeys,
    getAllProfileKeys,
    isPropertyActuallyInherited,
    isMergedPropertySecure,
    getProfileTypeFromPath,
    hasPendingSecureChanges,
    extractPendingProfiles,
    isProfileOrParentDeleted,
    ensureProfileProperties,
    applyRenamesToProfileKeys,
    mergePendingProfileKeys,
    filterConflictingProfileKeys,
    mergePendingChangesForProfile,
    canPropertyBeSecure,
    isPropertySecure,
    filterSecureProperties,
    mergePendingSecureProperties,
    mergeMergedProperties,
    isPropertyFromMergedProps,
} from "../../../../src/webviews/src/config-editor/utils/profileUtils";

const configPath = "/c";

describe("profileUtils", () => {
    describe("getRenamedProfileKey", () => {
        it("returns originalKey when no renames for configPath", () => {
            expect(getRenamedProfileKey("p1", configPath, {})).toBe("p1");
        });
        it("returns newKey when rename exists", () => {
            const renames = { [configPath]: { orig: "p1" } };
            expect(getRenamedProfileKey("orig", configPath, renames)).toBe("p1");
        });
        it("returns originalKey when configPath has no renames", () => {
            expect(getRenamedProfileKey("p1", configPath, { "/other": { a: "b" } })).toBe("p1");
        });
    });

    describe("getRenamedProfileKeyWithNested", () => {
        it("delegates to getRenamedProfileKey when profileKey has no dot", () => {
            const renames = { [configPath]: { a: "x" } };
            expect(getRenamedProfileKeyWithNested("a", configPath, renames)).toBe("x");
        });
        it("applies nested rename when path starts with originalKey + dot", () => {
            const renames = { [configPath]: { a: "x" } };
            expect(getRenamedProfileKeyWithNested("a.b", configPath, renames)).toBe("x.b");
        });
        it("returns profileKey when no matching renames", () => {
            expect(getRenamedProfileKeyWithNested("p1", configPath, {})).toBe("p1");
        });
    });

    describe("getOriginalProfileKey", () => {
        it("returns renamedKey when no renames for configPath", () => {
            expect(getOriginalProfileKey("p1", configPath, {})).toBe("p1");
        });
        it("returns originalKey when newKey matches renamedKey", () => {
            const renames = { [configPath]: { orig: "p1" } };
            expect(getOriginalProfileKey("p1", configPath, renames)).toBe("orig");
        });
        it("follows chain of renames", () => {
            const renames = { [configPath]: { a: "b", b: "c" } };
            expect(getOriginalProfileKey("c", configPath, renames)).toBe("a");
        });
    });

    describe("getOriginalProfileKeyWithNested", () => {
        it("delegates to getOriginalProfileKey when key has no dot", () => {
            const renames = { [configPath]: { orig: "p1" } };
            expect(getOriginalProfileKeyWithNested("p1", configPath, renames)).toBe("orig");
        });
        it("reverses nested rename when path starts with newKey + dot", () => {
            const renames = { [configPath]: { a: "x" } };
            expect(getOriginalProfileKeyWithNested("x.b", configPath, renames)).toBe("a.b");
        });
        it("uses level-by-level reverse when direct original equals renamedKey", () => {
            const renames = { [configPath]: { "a.b": "x.y" } };
            expect(getOriginalProfileKeyWithNested("x.y", configPath, renames)).toBe("a.b");
        });
        it("reverts parent path when parentPath was result of rename", () => {
            const renames = { [configPath]: { origParent: "viewedParent" } };
            expect(getOriginalProfileKeyWithNested("viewedParent.child", configPath, renames)).toBe("origParent.child");
        });
    });

    describe("getProfileType", () => {
        it("returns null when selectedTab is null", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
            expect(getProfileType("p1", null, configs, {}, {})).toBeNull();
        });
        it("returns type from config when profile exists", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
            expect(getProfileType("p1", 0, configs, {}, {})).toBe("zowe");
        });
        it("returns type from pending change when present", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
            const pendingChanges = {
                [configPath]: {
                    "profiles.p1.type": { value: "other", path: [], profile: "p1" },
                },
            };
            expect(getProfileType("p1", 0, configs, pendingChanges, {})).toBe("other");
        });
        it("returns type for nested profile using original path when profile was renamed", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: {
                            orig: {
                                type: "zowe",
                                properties: {},
                                profiles: { child: { type: "zowe", properties: {} } },
                            },
                        },
                    },
                } as any,
            ];
            const renames = { [configPath]: { orig: "renamed" } };
            expect(getProfileType("renamed.child", 0, configs, {}, renames)).toBe("zowe");
        });
        it("returns type from originalProfileKey when profileKey not in flatProfiles", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: { origName: { type: "zowe", properties: {} } },
                    },
                } as any,
            ];
            const renames = { [configPath]: { origName: "displayName" } };
            expect(getProfileType("displayName", 0, configs, {}, renames)).toBe("zowe");
        });
    });

    describe("getAvailableProfilesByType", () => {
        it("returns empty when selectedTab is null", () => {
            expect(getAvailableProfilesByType("zowe", null, [], {}, {})).toEqual([]);
        });
        it("returns profiles of given type from current config", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: {
                            p1: { type: "zowe", properties: {} },
                            p2: { type: "zowe", properties: {} },
                            p3: { type: "other", properties: {} },
                        },
                    },
                } as any,
            ];
            const result = getAvailableProfilesByType("zowe", 0, configs, {}, {});
            expect(result).toContain("p1");
            expect(result).toContain("p2");
            expect(result).not.toContain("p3");
        });
        it("includes config hierarchy when currentConfig is project user", () => {
            const configs = [
                { configPath: "/project", user: true, global: false, properties: { profiles: { pu: { type: "zowe", properties: {} } } } } as any,
                { configPath: "/team", user: false, global: false, properties: { profiles: { pt: { type: "zowe", properties: {} } } } } as any,
                { configPath: "/global", user: true, global: true, properties: { profiles: { gu: { type: "zowe", properties: {} } } } } as any,
            ];
            const result = getAvailableProfilesByType("zowe", 0, configs, {}, {});
            expect(result).toContain("pu");
            expect(result).toContain("pt");
            expect(result).toContain("gu");
        });
        it("excludes profiles with pending type change from saved profiles", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
            const pendingChanges = {
                [configPath]: { "profiles.p1.type": { value: "other", path: [], profile: "p1" } },
            };
            const result = getAvailableProfilesByType("zowe", 0, configs, pendingChanges, {});
            expect(result).not.toContain("p1");
        });
        it("includes pending profiles of given type", () => {
            const configs = [{ configPath, properties: { profiles: {} } } as any];
            const pendingChanges = {
                [configPath]: { "profiles.newP.type": { value: "zowe", path: [], profile: "newP" } },
            };
            const result = getAvailableProfilesByType("zowe", 0, configs, pendingChanges, {});
            expect(result).toContain("newP");
        });
        it("includes only global team when currentConfig is global user", () => {
            const configs = [
                { configPath: "/project", user: true, global: false, properties: { profiles: { pu: { type: "zowe", properties: {} } } } } as any,
                { configPath: "/globalUser", user: true, global: true, properties: { profiles: { gu: { type: "zowe", properties: {} } } } } as any,
                { configPath: "/globalTeam", user: false, global: true, properties: { profiles: { gt: { type: "zowe", properties: {} } } } } as any,
            ];
            const result = getAvailableProfilesByType("zowe", 1, configs, {}, {});
            expect(result).toContain("gu");
            expect(result).toContain("gt");
        });
    });

    describe("getAllProfileKeys", () => {
        it("returns empty for empty profiles", () => {
            expect(getAllProfileKeys({})).toEqual([]);
        });
        it("returns top-level profile keys", () => {
            const profiles = { p1: { type: "zowe" }, p2: { type: "zowe" } };
            expect(getAllProfileKeys(profiles).sort()).toEqual(["p1", "p2"]);
        });
        it("returns nested profile keys with dot notation", () => {
            const profiles = { parent: { type: "zowe", profiles: { child: { type: "zowe" } } } };
            expect(getAllProfileKeys(profiles).sort()).toEqual(["parent", "parent.child"]);
        });
    });

    describe("getOrderedProfileKeys", () => {
        it("returns empty for empty profiles", () => {
            expect(getOrderedProfileKeys({})).toEqual([]);
        });
        it("returns keys in object order", () => {
            const profiles = { p1: { type: "zowe" }, p2: { type: "zowe" } };
            expect(getOrderedProfileKeys(profiles)).toEqual(["p1", "p2"]);
        });
        it("excludes deleted profiles when isProfileOrParentDeleted returns true", () => {
            const profiles = { p1: { type: "zowe" }, p2: { type: "zowe" } };
            const deleted = ["p2"];
            const isDeleted = (key: string, list: string[]) => list.includes(key);
            expect(getOrderedProfileKeys(profiles, "", deleted, isDeleted)).toEqual(["p1"]);
        });
        it("includes nested keys", () => {
            const profiles = { parent: { type: "zowe", profiles: { child: { type: "zowe" } } } };
            expect(getOrderedProfileKeys(profiles)).toEqual(["parent", "parent.child"]);
        });
    });

    describe("isPropertyActuallyInherited", () => {
        it("returns false when profilePath or currentProfileKey is empty", () => {
            const configs = [{ configPath, properties: { profiles: {} } } as any];
            expect(isPropertyActuallyInherited("", "p1", configPath, "host", 0, configs, {}, {})).toBe(false);
            expect(isPropertyActuallyInherited("base", "", configPath, "host", 0, configs, {}, {})).toBe(false);
        });
        it("returns false when profilePath equals currentProfileKey", () => {
            const configs = [{ configPath, properties: { profiles: {} } } as any];
            expect(isPropertyActuallyInherited("p1", "p1", configPath, "host", 0, configs, {}, {})).toBe(false);
        });
        it("returns false when property has pending change in current profile", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any];
            const pendingChanges = {
                [configPath]: { "profiles.p1.properties.host": { value: "h", path: [], profile: "p1" } },
            };
            expect(isPropertyActuallyInherited("base", "p1", configPath, "host", 0, configs, pendingChanges, {})).toBe(false);
        });
        it("returns false when original paths match after reverse renames", () => {
            const configs = [{ configPath, properties: { profiles: {} } } as any];
            const renames = { [configPath]: { base: "p1" } };
            expect(isPropertyActuallyInherited("p1", "base", configPath, undefined, 0, configs, {}, renames)).toBe(false);
        });
        it("returns true when current profile inherits from source via defaults", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: { base: { type: "zowe", properties: {} }, child: { type: "zowe", properties: {} } },
                        defaults: { zowe: "base" },
                    },
                } as any,
            ];
            expect(isPropertyActuallyInherited("base", "child", configPath, undefined, 0, configs, {}, {})).toBe(true);
        });
        it("returns true when original paths differ after partial rename reverse (parent rename affects child)", () => {
            const configs = [{ configPath, properties: { profiles: {} } }] as any;
            const renames = { [configPath]: { base: "renamedBase" } };
            expect(isPropertyActuallyInherited("renamedBase.child", "other", configPath, undefined, 0, configs, {}, renames)).toBe(true);
        });
        it("returns true when no config and paths differ", () => {
            const configs = [{ configPath }] as any;
            expect(isPropertyActuallyInherited("base", "child", configPath, undefined, 0, configs, {}, {})).toBe(true);
        });
        it("returns true when source is default for type (renamed default)", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: { origBase: { type: "zowe", properties: {} }, child: { type: "zowe", properties: {} } },
                        defaults: { zowe: "origBase" },
                    },
                } as any,
            ];
            const renames = { [configPath]: { origBase: "base" } };
            expect(isPropertyActuallyInherited("base", "child", configPath, undefined, 0, configs, {}, renames)).toBe(true);
        });
        it("returns true when source profile is default for current profile type", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: { base1: { type: "zowe", properties: {} }, base2: { type: "zowe", properties: {} } },
                        defaults: { zowe: "base1" },
                    },
                } as any,
            ];
            expect(isPropertyActuallyInherited("base1", "base2", configPath, undefined, 0, configs, {}, {})).toBe(true);
        });
    });

    describe("getProfileTypeFromPath", () => {
        it("returns null when path length < 2", () => {
            expect(getProfileTypeFromPath([])).toBeNull();
            expect(getProfileTypeFromPath(["profiles"])).toBeNull();
        });
        it("returns null when path[0] is not profiles", () => {
            expect(getProfileTypeFromPath(["other", "p1"])).toBeNull();
        });
        it("returns first profile name segment after profiles", () => {
            expect(getProfileTypeFromPath(["profiles", "p1", "properties", "host"])).toBe("p1");
        });
    });

    describe("isMergedPropertySecure", () => {
        it("returns false when jsonLoc is empty", () => {
            expect(isMergedPropertySecure("k", "")).toBe(false);
        });
        it("returns secure when secure is true", () => {
            expect(isMergedPropertySecure("k", "loc", undefined, true)).toBe(true);
        });
        it("returns false when secure is false", () => {
            expect(isMergedPropertySecure("k", "loc", undefined, false)).toBe(false);
        });
        it("returns false when secure is undefined (fallback)", () => {
            expect(isMergedPropertySecure("k", "loc")).toBe(false);
        });
    });

    describe("hasPendingSecureChanges", () => {
        it("returns false when no pending changes for configPath", () => {
            expect(hasPendingSecureChanges(configPath, {})).toBe(false);
        });
        it("returns true when a pending change has secure true", () => {
            const pending = { [configPath]: { "profiles.p1.properties.host": { value: "x", path: [], profile: "p1", secure: true } } };
            expect(hasPendingSecureChanges(configPath, pending)).toBe(true);
        });
        it("returns false when pending changes have no secure true", () => {
            const pending = { [configPath]: { "profiles.p1.properties.host": { value: "x", path: [], profile: "p1" } } };
            expect(hasPendingSecureChanges(configPath, pending)).toBe(false);
        });
    });

    describe("extractPendingProfiles", () => {
        it("returns empty when no pending changes for configPath", () => {
            expect(extractPendingProfiles({}, configPath)).toEqual([]);
        });
        it("returns unique profile names from pending changes", () => {
            const pending = {
                [configPath]: {
                    "profiles.p1.type": { value: "zowe", path: [], profile: "p1" },
                    "profiles.p1.properties.host": { value: "h", path: [], profile: "p1" },
                    "profiles.p2.type": { value: "zowe", path: [], profile: "p2" },
                },
            };
            expect(extractPendingProfiles(pending, configPath).sort()).toEqual(["p1", "p2"]);
        });
    });

    describe("isProfileOrParentDeleted", () => {
        it("returns false when no deletions for configPath", () => {
            expect(isProfileOrParentDeleted("p1", {}, configPath)).toBe(false);
        });
        it("returns true when profile key is in deletions", () => {
            const deletions = { [configPath]: ["profiles.p1"] };
            expect(isProfileOrParentDeleted("p1", deletions, configPath)).toBe(true);
        });
        it("returns true when parent profile is deleted", () => {
            const deletions = { [configPath]: ["profiles.parent"] };
            expect(isProfileOrParentDeleted("parent.child", deletions, configPath)).toBe(true);
        });
        it("returns false when profile and parents not deleted", () => {
            const deletions = { [configPath]: ["profiles.other"] };
            expect(isProfileOrParentDeleted("p1", deletions, configPath)).toBe(false);
        });
    });

    describe("ensureProfileProperties", () => {
        it("adds properties, secure, type when path does not end with type/properties/secure", () => {
            const combined: any = {};
            ensureProfileProperties(combined, ["profiles", "p1"]);
            expect(combined.properties).toEqual({});
            expect(combined.secure).toEqual([]);
            expect(combined.type).toBe("");
        });
        it("does not mutate when path ends with type", () => {
            const combined: any = { type: "zowe" };
            ensureProfileProperties(combined, ["profiles", "p1", "type"]);
            expect(combined.properties).toBeUndefined();
        });
        it("does not mutate when path ends with properties", () => {
            const combined: any = {};
            ensureProfileProperties(combined, ["profiles", "p1", "properties"]);
            expect(combined.properties).toBeUndefined();
        });
        it("does not mutate when path ends with secure", () => {
            const combined: any = {};
            ensureProfileProperties(combined, ["profiles", "p1", "secure"]);
            expect(combined.properties).toBeUndefined();
        });
    });

    describe("applyRenamesToProfileKeys", () => {
        it("returns keys with renames applied", () => {
            const renames = { [configPath]: { a: "x" } };
            expect(applyRenamesToProfileKeys(["a", "b"], configPath, renames)).toEqual(["x", "b"]);
        });
        it("filters out intermediate renamed keys", () => {
            const renames = { [configPath]: { a: "b", b: "c" } };
            const result = applyRenamesToProfileKeys(["a"], configPath, renames);
            expect(result).toContain("c");
            expect(result).not.toContain("b");
        });
        it("includes renamed-only profiles not in ordered keys", () => {
            const renames = { [configPath]: { newProfile: "renamedNew" } };
            const result = applyRenamesToProfileKeys(["p1"], configPath, renames);
            expect(result).toContain("renamedNew");
            expect(result).toContain("p1");
        });
    });

    describe("mergePendingProfileKeys", () => {
        it("returns renamed pending profile keys", () => {
            const renames = { [configPath]: { orig: "renamed" } };
            const pendingProfiles = { orig: { type: "zowe" } };
            expect(mergePendingProfileKeys(pendingProfiles, configPath, renames, {}, ["renamed"])).toContain("renamed");
        });
        it("excludes deleted pending profiles", () => {
            const deletions = { [configPath]: ["profiles.p1"] };
            const pendingProfiles = { p1: { type: "zowe" } };
            expect(mergePendingProfileKeys(pendingProfiles, configPath, {}, deletions, [])).toEqual([]);
        });
        it("applies nested rename when pending key starts with originalKey + dot", () => {
            const renames = { [configPath]: { parent: "renamedParent" } };
            const pendingProfiles = { "parent.child": { type: "zowe" } };
            expect(mergePendingProfileKeys(pendingProfiles, configPath, renames, {}, [])).toContain("renamedParent.child");
        });
        it("moves pending nested back to root when renames empty and root name in uniqueRenamedProfileKeys", () => {
            const pendingProfiles = { "parent.child": { type: "zowe" } };
            const result = mergePendingProfileKeys(pendingProfiles, configPath, {}, {}, ["child"]);
            expect(result).toContain("child");
        });
    });

    describe("filterConflictingProfileKeys", () => {
        it("filters out keys that are in renamedPendingProfileKeys", () => {
            const uniqueRenamed = ["p1", "p2"];
            const renamedPending = ["p1"];
            const pendingProfiles = { p1: {} };
            expect(filterConflictingProfileKeys(uniqueRenamed, renamedPending, pendingProfiles, {}, configPath, {})).toEqual(["p2"]);
        });
        it("filters out keys that are deleted", () => {
            const deletions = { [configPath]: ["profiles.p1"] };
            const uniqueRenamed = ["p1", "p2"];
            expect(filterConflictingProfileKeys(uniqueRenamed, [], {}, deletions, configPath, {})).toEqual(["p2"]);
        });
        it("filters out key that is result of rename with pending original", () => {
            const renames = { [configPath]: { orig: "renamed" } };
            const pendingProfiles = { orig: {} };
            const uniqueRenamed = ["renamed", "p2"];
            expect(filterConflictingProfileKeys(uniqueRenamed, ["renamed"], pendingProfiles, {}, configPath, renames)).toEqual(["p2"]);
        });
        it("filters out key when shouldRenamePendingToThisKey (pending key ends with profileKey)", () => {
            const uniqueRenamed = ["p1"];
            const pendingProfiles = { "parent.p1": {} };
            expect(filterConflictingProfileKeys(uniqueRenamed, [], pendingProfiles, {}, configPath, {})).toEqual([]);
        });
        it("filters out key when it appears in original pending profile keys (no renames)", () => {
            const uniqueRenamed = ["p1", "p2"];
            const pendingProfiles = { p1: {} };
            expect(filterConflictingProfileKeys(uniqueRenamed, [], pendingProfiles, {}, configPath, {})).toEqual(["p2"]);
        });
        it("filters out key when it is target of pending rename", () => {
            const uniqueRenamed = ["target", "p2"];
            const renamedPending = ["target"];
            const pendingProfiles = { orig: {} };
            const renames = { [configPath]: { orig: "target" } };
            expect(filterConflictingProfileKeys(uniqueRenamed, renamedPending, pendingProfiles, {}, configPath, renames)).toEqual(["p2"]);
        });
    });

    describe("mergePendingChangesForProfile", () => {
        it("merges pending changes under current path into baseObj", () => {
            const baseObj = { type: "zowe", properties: {} };
            const path = ["profiles", "p1"];
            const pendingChanges = {
                [configPath]: {
                    "profiles.p1.properties.host": { value: "localhost", path: [], profile: "p1" },
                },
            };
            const result = mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, {});
            expect(result.properties).toEqual({ host: "localhost" });
        });
        it("merges under original path when profile was renamed", () => {
            const baseObj = { type: "zowe", properties: {} };
            const path = ["profiles", "renamed"];
            const renames = { [configPath]: { orig: "renamed" } };
            const pendingChanges = {
                [configPath]: {
                    "profiles.orig.properties.host": { value: "h", path: [], profile: "orig" },
                },
            };
            const result = mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, renames);
            expect(result.properties).toEqual({ host: "h" });
        });
        it("adds secure property to baseObj.secure when entry.secure", () => {
            const baseObj = { type: "zowe", properties: {} };
            const path = ["profiles", "p1"];
            const pendingChanges = {
                [configPath]: {
                    "profiles.p1.secure.password": { value: "p", path: ["profiles", "p1", "secure", "password"], profile: "p1", secure: true },
                },
            };
            const result = mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, {});
            expect(result.secure).toContain("password");
        });
        it("matches entry by renamed form of original profile key", () => {
            const baseObj = { type: "zowe", properties: {} };
            const path = ["profiles", "renamed"];
            const renames = { [configPath]: { orig: "renamed" } };
            const pendingChanges = {
                [configPath]: {
                    "profiles.renamed.properties.host": { value: "h", path: [], profile: "renamed" },
                },
            };
            const result = mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, renames);
            expect(result.properties?.host).toBe("h");
        });
        it("merges nested property under relativePath length > 1", () => {
            const baseObj = { type: "zowe", properties: {} };
            const path = ["profiles", "p1"];
            const pendingChanges = {
                [configPath]: {
                    "profiles.p1.nested.level.key": { value: "v", path: [], profile: "p1" },
                },
            };
            const result = mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, {});
            expect(result.nested?.level?.key).toBe("v");
        });
    });

    describe("canPropertyBeSecure", () => {
        const schemaWithValidDefaults = (propertySchema: any) => ({ propertySchema, validDefaults: [] as string[] });
        it("returns false when displayKey empty or selectedTab null", () => {
            const configs = [{ configPath }] as any;
            const schemaValidations = { [configPath]: schemaWithValidDefaults({ zowe: { host: { secure: true } } }) };
            expect(canPropertyBeSecure("", 0, configs, schemaValidations, getProfileType, {}, {})).toBe(false);
            expect(canPropertyBeSecure("host", null, configs, schemaValidations, getProfileType, {}, {})).toBe(false);
        });
        it("returns true when selectedProfileKey has type and schema marks property secure", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const schemaValidations = { [configPath]: schemaWithValidDefaults({ zowe: { password: { secure: true } } }) };
            expect(canPropertyBeSecure("password", 0, configs, schemaValidations, getProfileType, {}, {}, "p1")).toBe(true);
        });
        it("returns true from fallback when any profile type has property secure", () => {
            const configs = [{ configPath }] as any;
            const schemaValidations = { [configPath]: schemaWithValidDefaults({ zowe: { token: { secure: true } } }) };
            expect(canPropertyBeSecure("token", 0, configs, schemaValidations, getProfileType, {}, {})).toBe(true);
        });
        it("returns false when config at selectedTab is missing", () => {
            const configs: any[] = [];
            const schemaValidations = { [configPath]: schemaWithValidDefaults({ zowe: {} }) };
            expect(canPropertyBeSecure("host", 0, configs, schemaValidations, getProfileType, {}, {})).toBe(false);
        });
        it("returns false when schemaValidation is missing for configPath", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            expect(canPropertyBeSecure("host", 0, configs, {}, getProfileType, {}, {}, "p1")).toBe(false);
        });
    });

    describe("isPropertySecure", () => {
        it("returns false when displayKey or path empty", () => {
            expect(isPropertySecure("k", "", [], undefined)).toBe(false);
            expect(isPropertySecure("k", "host", [], undefined)).toBe(false);
        });
        it("returns secure from mergedProps when present", () => {
            const mergedProps = { host: { secure: true } };
            expect(isPropertySecure("profiles.p1.properties.host", "host", ["profiles", "p1", "properties", "host"], mergedProps)).toBe(true);
        });
        it("returns secure from pending change when present", () => {
            const configs = [{ configPath, properties: { profiles: {} } }] as any;
            const pendingChanges = {
                [configPath]: { "profiles.p1.properties.host": { value: "h", path: [], profile: "p1", secure: true } },
            };
            expect(
                isPropertySecure(
                    "profiles.p1.properties.host",
                    "host",
                    ["profiles", "p1", "properties", "host"],
                    undefined,
                    0,
                    configs,
                    pendingChanges
                )
            ).toBe(true);
        });
        it("returns true when config.secure includes property name", () => {
            const configs = [{ configPath, secure: ["password"], properties: { profiles: {} } }] as any;
            expect(
                isPropertySecure("profiles.p1.properties.password", "password", ["profiles", "p1", "properties", "password"], undefined, 0, configs)
            ).toBe(true);
        });
        it("returns true when profile secure array includes property", () => {
            const configs = [
                {
                    configPath,
                    properties: { profiles: { p1: { type: "zowe", properties: {}, secure: ["token"] } } },
                },
            ] as any;
            expect(isPropertySecure("profiles.p1.properties.token", "token", ["profiles", "p1", "properties", "token"], undefined, 0, configs)).toBe(
                true
            );
        });
        it("returns false from mergedProps when secure is false", () => {
            const mergedProps = { host: { secure: false } };
            expect(
                isPropertySecure("profiles.p1.properties.host", "host", ["profiles", "p1", "properties", "host"], mergedProps)
            ).toBe(false);
        });
        it("returns true for nested profile secure via path navigation", () => {
            const configs = [
                {
                    configPath,
                    properties: {
                        profiles: {
                            parent: {
                                type: "zowe",
                                properties: {},
                                profiles: { child: { type: "zowe", properties: {}, secure: ["secret"] } },
                            },
                        },
                    },
                },
            ] as any;
            const path = ["profiles", "parent", "profiles", "child", "properties", "secret"];
            expect(
                isPropertySecure("profiles.parent.profiles.child.properties.secret", "secret", path, undefined, 0, configs)
            ).toBe(true);
        });
        it("returns true when profile was renamed and secure in original profile", () => {
            const configs = [
                {
                    configPath,
                    properties: { profiles: { orig: { type: "zowe", properties: {}, secure: ["pass"] } } },
                },
            ] as any;
            const renames = { [configPath]: { orig: "renamed" } };
            const path = ["profiles", "renamed", "properties", "pass"];
            expect(
                isPropertySecure("profiles.renamed.properties.pass", "pass", path, undefined, 0, configs, {}, renames)
            ).toBe(true);
        });
    });

    describe("filterSecureProperties", () => {
        it("returns value when combinedConfig has no secure array", () => {
            const value = { host: "h", password: "p" };
            expect(filterSecureProperties(value, {}, undefined, {}, {}, undefined)).toBe(value);
        });
        it("removes keys in combinedConfig.secure when not in deletions or mergedProps insecure", () => {
            const value = { host: "h", password: "p" };
            const combinedConfig = { secure: ["password"] };
            expect(filterSecureProperties(value, combinedConfig, configPath, {}, {}, undefined)).toEqual({ host: "h" });
        });
        it("returns null when all properties filtered", () => {
            const value = { password: "p" };
            const combinedConfig = { secure: ["password"] };
            expect(filterSecureProperties(value, combinedConfig, configPath, {}, {}, undefined)).toBeNull();
        });
        it("keeps secure property when in deletions", () => {
            const value = { host: "h", password: "p" };
            const combinedConfig = { secure: ["password"] };
            const deletions = { [configPath]: ["profiles.p1.properties.password"] };
            expect(filterSecureProperties(value, combinedConfig, configPath, {}, deletions, undefined)).toEqual({ host: "h", password: "p" });
        });
        it("keeps secure property when mergedProps has secure false", () => {
            const value = { host: "h", password: "p" };
            const combinedConfig = { secure: ["password"] };
            const mergedProps = { password: { secure: false } };
            expect(filterSecureProperties(value, combinedConfig, configPath, {}, {}, mergedProps)).toEqual({ host: "h", password: "p" });
        });
        it("keeps secure property when has pending insecure property with same key", () => {
            const value = { host: "h", password: "p" };
            const combinedConfig = { secure: ["password"] };
            const pendingChanges = {
                [configPath]: { "profiles.p1.properties.password": { value: "x", path: [], profile: "p1", secure: false } },
            };
            expect(filterSecureProperties(value, combinedConfig, configPath, pendingChanges, {}, undefined)).toEqual({ host: "h", password: "p" });
        });
    });

    describe("mergePendingSecureProperties", () => {
        it("returns sorted base array when no pending secure", () => {
            const value = ["token"];
            expect(mergePendingSecureProperties(value, ["profiles", "p1"], configPath, {}, undefined)).toEqual(["token"]);
        });
        it("adds pending secure props and sorts", () => {
            const value: string[] = [];
            const pendingChanges = {
                [configPath]: {
                    "profiles.p1.secure.password": { value: "p", path: ["profiles", "p1", "secure", "password"], profile: "p1", secure: true },
                },
            };
            const result = mergePendingSecureProperties(value, ["profiles", "p1"], configPath, pendingChanges, undefined);
            expect(result).toContain("password");
        });
        it("matches entry by renamed profile when key is under current path and entry.profile is original name", () => {
            const value: string[] = [];
            const renames = { [configPath]: { orig: "renamed" } };
            const pendingChanges = {
                [configPath]: {
                    "profiles.renamed.secure.token": { value: "t", path: ["profiles", "renamed", "secure", "token"], profile: "orig", secure: true },
                },
            };
            const result = mergePendingSecureProperties(value, ["profiles", "renamed"], configPath, pendingChanges, renames);
            expect(result).toContain("token");
        });
        it("filters base array when pending insecure property exists for same prop", () => {
            const value = ["password"];
            const pendingChanges = {
                [configPath]: { "profiles.p1.properties.password": { value: "x", path: [], profile: "p1", secure: false } },
            };
            const result = mergePendingSecureProperties(value, ["profiles", "p1"], configPath, pendingChanges, undefined);
            expect(result).not.toContain("password");
        });
    });

    describe("mergeMergedProperties", () => {
        it("returns combinedConfig when mergedProps falsy or path empty or path ends with type or secure", () => {
            const combined: any = {};
            expect(mergeMergedProperties(combined, ["profiles", "p1"], undefined, configPath, 0, [], {}, {}, {}, {}, undefined)).toBe(combined);
            expect(mergeMergedProperties(combined, [], { host: {} }, configPath, 0, [], {}, {}, {}, {}, undefined)).toBe(combined);
            expect(mergeMergedProperties(combined, ["profiles", "p1", "type"], {}, configPath, 0, [], {}, {}, {}, {}, undefined)).toBe(combined);
            expect(mergeMergedProperties(combined, ["profiles", "p1", "secure"], {}, configPath, 0, [], {}, {}, {}, {}, undefined)).toBe(combined);
        });
        it("returns combinedConfig when path ends with properties", () => {
            const combined: any = {};
            expect(mergeMergedProperties(combined, ["profiles", "p1", "properties"], {}, configPath, 0, [], {}, {}, {}, {}, undefined)).toBe(
                combined
            );
        });
        it("adds merged property when allowed by schema and not in pending", () => {
            const combined: any = { properties: {} };
            const mergedProps = { host: { value: "h", jsonLoc: "", osLoc: [] } };
            const schemaValidations = { [configPath]: { propertySchema: { zowe: { host: {} } }, validDefaults: [] as string[] } };
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const result = mergeMergedProperties(
                combined,
                ["profiles", "p1"],
                mergedProps,
                configPath,
                0,
                configs,
                {},
                {},
                schemaValidations,
                {},
                undefined
            );
            expect(result.properties.host).toBe("h");
        });
        it("ensures combinedConfig.properties when missing", () => {
            const combined: any = {};
            const mergedProps = { host: { value: "h", jsonLoc: "profiles.p1.properties.host", osLoc: [] } };
            const schemaValidations = { [configPath]: { propertySchema: { zowe: { host: {} } }, validDefaults: [] as string[] } };
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            mergeMergedProperties(combined, ["profiles", "p1"], mergedProps, configPath, 0, configs, {}, {}, schemaValidations, {}, undefined);
            expect(combined.properties).toBeDefined();
            expect(combined.properties.host).toBe("h");
        });
        it("adds merged property when in deletions", () => {
            const combined: any = { properties: {} };
            const mergedProps = { host: { value: "inherited", jsonLoc: "profiles.base.properties.host", osLoc: [] } };
            const schemaValidations = { [configPath]: { propertySchema: { zowe: { host: {} } }, validDefaults: [] as string[] } };
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const deletions = { [configPath]: ["profiles.p1.properties.host"] };
            const result = mergeMergedProperties(
                combined,
                ["profiles", "p1"],
                mergedProps,
                configPath,
                0,
                configs,
                {},
                {},
                schemaValidations,
                deletions,
                undefined
            );
            expect(result.properties.host).toBe("inherited");
        });
        it("shows all merged properties when showMergedProperties is unfiltered", () => {
            const combined: any = { properties: {} };
            const mergedProps = { customProp: { value: "v", jsonLoc: "", osLoc: [] } };
            const schemaValidations = { [configPath]: { propertySchema: { zowe: {} }, validDefaults: [] as string[] } };
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const result = mergeMergedProperties(
                combined,
                ["profiles", "p1"],
                mergedProps,
                configPath,
                0,
                configs,
                {},
                {},
                schemaValidations,
                {},
                "unfiltered"
            );
            expect(result.properties.customProp).toBe("v");
        });
        it("does not add non-primitive merged value", () => {
            const combined: any = { properties: {} };
            const mergedProps = { nested: { value: { a: 1 }, jsonLoc: "", osLoc: [] } };
            const schemaValidations = { [configPath]: { propertySchema: { zowe: { nested: {} } }, validDefaults: [] as string[] } };
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            mergeMergedProperties(combined, ["profiles", "p1"], mergedProps, configPath, 0, configs, {}, {}, schemaValidations, {}, undefined);
            expect(combined.properties.nested).toBeUndefined();
        });
    });

    describe("isPropertyFromMergedProps", () => {
        const pathP1 = ["profiles", "p1", "properties", "host"];
        const callIsFromMerged = (show: string | boolean, configs: any[], isInherited: () => boolean) =>
            isPropertyFromMergedProps(
                "host",
                pathP1,
                { host: { jsonLoc: "profiles.base.properties.host", osLoc: [configPath] } },
                configPath,
                show,
                0,
                configs,
                {} as { [k: string]: { [key: string]: any } },
                {} as { [k: string]: { [originalKey: string]: string } },
                "p1",
                isInherited
            );
        it("returns false when displayKey is undefined", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            expect(
                isPropertyFromMergedProps(
                    undefined,
                    pathP1,
                    { host: { jsonLoc: "profiles.base.properties.host", osLoc: [configPath] } },
                    configPath,
                    "show",
                    0,
                    configs,
                    {},
                    {},
                    "p1",
                    () => true
                )
            ).toBe(false);
        });
        it("returns false when showMergedProperties is hide or false", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            expect(callIsFromMerged("hide", configs, () => true)).toBe(false);
            expect(callIsFromMerged(false, configs, () => true)).toBe(false);
        });
        it("returns false when profile is untyped", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "", properties: {} } } } }] as any;
            expect(callIsFromMerged("show", configs, () => true)).toBe(false);
        });
        it("returns true when isPropertyActuallyInherited returns true and paths equal", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            expect(callIsFromMerged("show", configs, () => true)).toBe(true);
        });
        it("returns false when not inherited and not same profile name in different config", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const mergedProps = { host: { jsonLoc: "profiles.other.properties.host", osLoc: [configPath] } };
            expect(
                isPropertyFromMergedProps(
                    "host",
                    pathP1,
                    mergedProps,
                    configPath,
                    "show",
                    0,
                    configs,
                    {} as { [k: string]: { [key: string]: any } },
                    {} as { [k: string]: { [originalKey: string]: string } },
                    "p1",
                    () => false
                )
            ).toBe(false);
        });
        it("returns true when same profile name in different config (osLoc differs from selected)", () => {
            const otherPath = "/other-config";
            const configs = [
                { configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any,
                { configPath: otherPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } } as any,
            ];
            const mergedProps = { host: { jsonLoc: "profiles.p1.properties.host", osLoc: [otherPath] } };
            expect(
                isPropertyFromMergedProps(
                    "host",
                    pathP1,
                    mergedProps,
                    configPath,
                    "show",
                    0,
                    configs,
                    {} as { [k: string]: { [key: string]: any } },
                    {} as { [k: string]: { [originalKey: string]: string } },
                    "p1",
                    () => false
                )
            ).toBe(true);
        });
        it("when profile has been renamed, returns false when jsonLoc refers to current profile", () => {
            const configs = [{ configPath, properties: { profiles: { renamed: { type: "zowe", properties: {} } } } }] as any;
            const renames = { [configPath]: { orig: "renamed" } };
            const mergedProps = { host: { jsonLoc: "profiles.renamed.properties.host", osLoc: [configPath] } };
            const path = ["profiles", "renamed", "properties", "host"];
            const result = isPropertyFromMergedProps(
                "host",
                path,
                mergedProps,
                configPath,
                "show",
                0,
                configs,
                {},
                renames,
                "renamed",
                () => false
            );
            expect(result).toBe(false);
        });
        it("when profile has been renamed, returns false when jsonLoc is old name of current profile", () => {
            const configs = [{ configPath, properties: { profiles: { renamed: { type: "zowe", properties: {} } } } }] as any;
            const renames = { [configPath]: { orig: "renamed" } };
            const mergedProps = { host: { jsonLoc: "profiles.orig.properties.host", osLoc: [configPath] } };
            const path = ["profiles", "renamed", "properties", "host"];
            const result = isPropertyFromMergedProps(
                "host",
                path,
                mergedProps,
                configPath,
                "show",
                0,
                configs,
                {},
                renames,
                "renamed",
                () => true
            );
            expect(result).toBe(false);
        });
        it("when not renamed, returns true when jsonLoc indicates different profile", () => {
            const configs = [{ configPath, properties: { profiles: { p1: { type: "zowe", properties: {} } } } }] as any;
            const mergedProps = { host: { jsonLoc: "profiles.base.properties.host", osLoc: [configPath] } };
            const result = isPropertyFromMergedProps(
                "host",
                pathP1,
                mergedProps,
                configPath,
                "show",
                0,
                configs,
                {},
                {},
                "p1",
                () => true
            );
            expect(result).toBe(true);
        });
    });
});
