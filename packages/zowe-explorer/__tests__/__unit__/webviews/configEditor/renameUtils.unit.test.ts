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
    updateChangesForRenames,
    getProfileNameForMergedProperties,
    consolidateRenames,
    consolidateConflictingRenames,
    getCurrentEffectiveName,
    detectClosedLoops,
    checkIfRenameCancelsOut,
    hasPendingRename,
} from "../../../../src/webviews/src/config-editor/utils/renameUtils";

describe("renameUtils", () => {
    describe("updateChangesForRenames", () => {
        it("returns changes when renames empty", () => {
            const changes = [{ profile: "p1", key: "k", path: [], configPath: "/c" }];
            expect(updateChangesForRenames(changes, [])).toEqual(changes);
        });
        it("updates profile when rename matches", () => {
            const changes = [
                { profile: "old", key: "profiles.old.properties.host", path: ["profiles", "old", "properties", "host"], configPath: "/c" },
            ];
            const renames = [{ configPath: "/c", originalKey: "old", newKey: "new" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].profile).toBe("new");
        });
        it("updates profile when profile starts with originalKey + dot (nested)", () => {
            const changes = [
                {
                    profile: "old.child",
                    key: "profiles.old.profiles.child.properties.host",
                    path: ["profiles", "old", "profiles", "child", "properties", "host"],
                    configPath: "/c",
                },
            ];
            const renames = [{ configPath: "/c", originalKey: "old", newKey: "renamed" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].profile).toBe("renamed.child");
        });
        it("updates key for simple rename when key contains profiles.originalKey", () => {
            const changes = [
                { profile: "new", key: "profiles.old.properties.host", path: ["profiles", "old", "properties", "host"], configPath: "/c" },
            ];
            const renames = [{ configPath: "/c", originalKey: "old", newKey: "new" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].key).toBe("profiles.new.properties.host");
        });
        it("updates path when rename applies", () => {
            const changes = [
                { profile: "new", key: "profiles.new.properties.host", path: ["profiles", "old", "properties", "host"], configPath: "/c" },
            ];
            const renames = [{ configPath: "/c", originalKey: "old", newKey: "new" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].path).toEqual(["profiles", "new", "properties", "host"]);
        });
        it("returns changes when renames is null or undefined", () => {
            const changes = [{ profile: "p1", key: "k", path: [], configPath: "/c" }];
            expect(updateChangesForRenames(changes, null as any)).toEqual(changes);
            expect(updateChangesForRenames(changes, undefined as any)).toEqual(changes);
        });
        it("skips already applied rename (appliedRenames)", () => {
            const changes = [{ profile: "old", key: "profiles.old.properties.x", path: ["profiles", "old", "properties", "x"], configPath: "/c" }];
            const renames = [
                { configPath: "/c", originalKey: "old", newKey: "new" },
                { configPath: "/c", originalKey: "old", newKey: "other" },
            ];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].profile).toBe("new");
        });
        it("updates key for nested profile rename (originalKey/newKey with dots)", () => {
            const changes = [
                {
                    profile: "x.y",
                    key: "profiles.a.profiles.b.properties.host",
                    path: ["profiles", "a", "b", "properties", "host"],
                    configPath: "/c",
                },
            ];
            const renames = [{ configPath: "/c", originalKey: "a.b", newKey: "x.y" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].key).toBe("profiles.x.profiles.y.properties.host");
        });
        it("does not update key when currentProfileFromKey already equals rename.newKey", () => {
            const changes = [
                {
                    profile: "a.b",
                    key: "profiles.a.profiles.b.properties.host",
                    path: ["profiles", "a", "b", "properties", "host"],
                    configPath: "/c",
                },
            ];
            const renames = [{ configPath: "/c", originalKey: "b", newKey: "a.b" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].key).toBe("profiles.a.profiles.b.properties.host");
        });
        it("updates path for nested profile rename (multi-segment originalKey/newKey)", () => {
            const changes = [
                {
                    profile: "x.y",
                    key: "profiles.x.profiles.y.properties.host",
                    path: ["profiles", "a", "b", "properties", "host"],
                    configPath: "/c",
                },
            ];
            const renames = [{ configPath: "/c", originalKey: "a.b", newKey: "x.y" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].path).toEqual(["profiles", "x", "y", "properties", "host"]);
        });
        it("leaves change unchanged when rename configPath does not match", () => {
            const changes = [{ profile: "old", key: "profiles.old.x", path: ["profiles", "old", "x"], configPath: "/c" }];
            const renames = [{ configPath: "/other", originalKey: "old", newKey: "new" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].profile).toBe("old");
            expect(result[0].key).toBe("profiles.old.x");
        });
        it("does not mutate change when no profile", () => {
            const changes = [{ key: "profiles.old.x", path: ["profiles", "old", "x"], configPath: "/c" }];
            const renames = [{ configPath: "/c", originalKey: "old", newKey: "new" }];
            const result = updateChangesForRenames(changes, renames);
            expect(result[0].key).toBe("profiles.new.x");
            expect(result[0].path).toEqual(["profiles", "new", "x"]);
        });
    });

    describe("getProfileNameForMergedProperties", () => {
        it("returns profileKey when no renames", () => {
            expect(getProfileNameForMergedProperties("p1", "/c", {})).toBe("p1");
        });
        it("reverses rename for exact match", () => {
            const renames = { "/c": { orig: "p1" } };
            expect(getProfileNameForMergedProperties("p1", "/c", renames)).toBe("orig");
        });
        it("reverses nested rename", () => {
            const renames = { "/c": { a: "a.b" } };
            expect(getProfileNameForMergedProperties("a.b", "/c", renames)).toBe("a");
        });
        it("reverses multiple renames when config has several entries (sorted by length)", () => {
            const renames = { "/c": { short: "long.name", long: "long.name.nested" } };
            expect(getProfileNameForMergedProperties("long.name.nested", "/c", renames)).toBe("long");
        });
    });

    describe("consolidateRenames", () => {
        it("removes entry when newKey equals originalKey", () => {
            expect(consolidateRenames({ a: "b" }, "a", "a")).toEqual({});
        });
        it("adds rename and consolidates", () => {
            const result = consolidateRenames({}, "x", "y");
            expect(result.x).toBe("y");
        });
    });

    describe("consolidateConflictingRenames", () => {
        it("removes redundant child when parent rename implies same target", () => {
            const renames = { a: "a.b", "a.b": "a.b.c" };
            const result = consolidateConflictingRenames(renames);
            expect(result["a.b"]).toBeUndefined();
            expect(result["a"]).toBe("a.b.c");
        });
        it("removes direct cycle A->B B->A", () => {
            const renames = { a: "b", b: "a" };
            const result = consolidateConflictingRenames(renames);
            expect(Object.keys(result).length).toBe(0);
        });
        it("consolidates chain A->B B->C to A->C", () => {
            const renames = { a: "b", b: "c" };
            const result = consolidateConflictingRenames(renames);
            expect(result.a).toBe("c");
            expect(result.b).toBeUndefined();
        });
        it("removes child when parent rename implies same target (early removal)", () => {
            const renames = { a: "a.b", "a.b": "a.b.c" };
            const result = consolidateConflictingRenames(renames);
            expect(result["a.b"]).toBeUndefined();
            expect(result.a).toBe("a.b.c");
        });
        it("updates child renames when parent is renamed (third pass)", () => {
            const renames = { a: "x", "x.b": "x.b" };
            const result = consolidateConflictingRenames(renames);
            expect(result.a).toBe("x");
            expect(result["x.b"]).toBeUndefined();
        });
        it("handles parent renames affecting children (parentRename pass)", () => {
            const renames = { a: "b", b: "c", "b.child": "b.child" };
            const result = consolidateConflictingRenames(renames);
            expect(result.a).toBe("c");
        });
        it("handles child target update when parent path changes (fourth pass)", () => {
            const renames = { a: "x", "a.b": "a.b" };
            const result = consolidateConflictingRenames(renames);
            expect(result.a).toBe("x");
        });
        it("handles extraction (child under old parent, target not under new parent)", () => {
            const renames = { a: "x", "a.b": "other" };
            const result = consolidateConflictingRenames(renames);
            expect(result["a.b"]).toBe("other");
        });
        it("removes intermediate renames (fifth pass)", () => {
            const renames = { a: "b", b: "c" };
            const result = consolidateConflictingRenames(renames);
            expect(result.a).toBe("c");
            expect(result.b).toBeUndefined();
        });
        it("updates child when parent part is renamed (additional pass)", () => {
            const renames = { zftp: "tso.zftp", "zftp.zosmf": "zftp.zosmf" };
            const result = consolidateConflictingRenames(renames);
            expect(result.zftp).toBe("tso.zftp");
        });
        it("resolves direct conflict when two renames target same key", () => {
            const renames = { longname: "target", short: "target" };
            const result = consolidateConflictingRenames(renames);
            const keys = Object.keys(result);
            expect(keys.length).toBe(1);
            expect(result[keys[0]]).toBe("target");
        });
    });

    describe("getCurrentEffectiveName", () => {
        it("returns profileKey when no renames", () => {
            expect(getCurrentEffectiveName("p1", "/c", {})).toBe("p1");
        });
        it("applies single rename", () => {
            const renames = { "/c": { orig: "p1" } };
            expect(getCurrentEffectiveName("orig", "/c", renames)).toBe("p1");
        });
        it("applies nested rename without prefix re-apply", () => {
            const renames = { "/c": { orig: "renamed" } };
            expect(getCurrentEffectiveName("orig", "/c", renames)).toBe("renamed");
        });
        it("applies rename when effectiveName starts with originalKey + dot", () => {
            const renames = { "/c": { a: "x" } };
            expect(getCurrentEffectiveName("a.b", "/c", renames)).toBe("x.b");
        });
    });

    describe("detectClosedLoops", () => {
        it("returns empty when no renames", () => {
            expect(detectClosedLoops({})).toEqual([]);
        });
        it("detects cycle a->b b->a", () => {
            const loops = detectClosedLoops({ a: "b", b: "a" });
            expect(loops.length).toBeGreaterThanOrEqual(1);
            expect(loops.some((l) => l.includes("a") && l.includes("b"))).toBe(true);
        });
        it("returns empty when chain has no loop (a->b->c)", () => {
            expect(detectClosedLoops({ a: "b", b: "c" })).toEqual([]);
        });
    });

    describe("checkIfRenameCancelsOut", () => {
        it("returns true when newKey equals originalKey", () => {
            expect(checkIfRenameCancelsOut({}, "a", "a")).toBe(true);
        });
        it("returns true when B->A and we add A->B", () => {
            expect(checkIfRenameCancelsOut({ b: "a" }, "a", "b")).toBe(true);
        });
        it("returns false when no cancel", () => {
            expect(checkIfRenameCancelsOut({}, "a", "b")).toBe(false);
        });
        it("returns true when chain leads back to newKey", () => {
            const renames = { a: "b", b: "c" };
            expect(checkIfRenameCancelsOut(renames, "a", "c")).toBe(true);
        });
    });

    describe("hasPendingRename", () => {
        it("returns false when no configPath", () => {
            expect(hasPendingRename("p1", "", {})).toBe(false);
        });
        it("returns true when profileKey is a newKey in renames", () => {
            const renames = { "/c": { orig: "p1" } };
            expect(hasPendingRename("p1", "/c", renames)).toBe(true);
        });
        it("returns false when profileKey not in renames", () => {
            expect(hasPendingRename("p1", "/c", { "/c": {} })).toBe(false);
        });
    });
});
