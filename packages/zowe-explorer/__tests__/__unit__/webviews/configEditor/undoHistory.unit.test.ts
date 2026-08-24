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
    COALESCE_WINDOW_MS,
    HISTORY_LIMIT,
    HistoryEntry,
    UndoableState,
    buildHistoryEntry,
    pushHistoryEntry,
    redoTransition,
    singleChangedPendingKey,
    snapshotValue,
    undoTransition,
} from "../../../../src/webviews/src/config-editor/utils/undoHistory";

const configPath = "/c";

// A single base instance: React keeps the identity of slices that did not change between
// commits, and `buildHistoryEntry` relies on that to detect which slices actually moved.
const BASE: UndoableState = {
    pendingChanges: {},
    pendingDefaults: {},
    deletions: {},
    defaultsDeletions: {},
    renames: {},
    dragDroppedProfiles: {},
    autostoreChanges: {},
    hiddenItems: {},
};

const emptyState = (): UndoableState => BASE;

const withPending = (key: string, value: string): UndoableState => ({
    ...BASE,
    pendingChanges: { [configPath]: { [key]: { value, path: [], profile: "p1" } } } as any,
});

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    before: {},
    after: {},
    coalesceKey: null,
    time: 0,
    ...overrides,
});

describe("undoHistory", () => {
    describe("snapshotValue", () => {
        it("copies the sets in dragDroppedProfiles, which are mutated in place", () => {
            const original = { [configPath]: new Set(["a"]) };
            const snapshot = snapshotValue("dragDroppedProfiles", original);

            original[configPath].add("b");

            expect(Array.from(snapshot[configPath])).toEqual(["a"]);
            expect(snapshot[configPath]).not.toBe(original[configPath]);
        });

        it("holds the reference for immutably-updated slices", () => {
            const original = { [configPath]: ["x"] };
            expect(snapshotValue("deletions", original)).toBe(original);
        });
    });

    describe("singleChangedPendingKey", () => {
        it("returns the one key whose value changed", () => {
            const before = { [configPath]: { "profiles.p1.properties.host": { value: "a" } } } as any;
            const after = { [configPath]: { "profiles.p1.properties.host": { value: "ab" } } } as any;
            expect(singleChangedPendingKey(before, after)).toBe(`${configPath}::profiles.p1.properties.host`);
        });

        it("returns null when two keys changed", () => {
            const before = { [configPath]: { a: { value: "1" }, b: { value: "1" } } } as any;
            const after = { [configPath]: { a: { value: "2" }, b: { value: "2" } } } as any;
            expect(singleChangedPendingKey(before, after)).toBeNull();
        });

        it("returns null when nothing changed", () => {
            const same = { [configPath]: { a: { value: "1" } } } as any;
            expect(singleChangedPendingKey(same, same)).toBeNull();
        });
    });

    describe("buildHistoryEntry", () => {
        it("returns null when no tracked slice changed", () => {
            const state = emptyState();
            expect(buildHistoryEntry(state, state, 0)).toBeNull();
        });

        it("captures only the slices that changed", () => {
            const previous = emptyState();
            const current = withPending("k", "v");
            const built = buildHistoryEntry(previous, current, 5)!;

            expect(Object.keys(built.before)).toEqual(["pendingChanges"]);
            expect(built.before.pendingChanges).toBe(previous.pendingChanges);
            expect(built.after.pendingChanges).toBe(current.pendingChanges);
            expect(built.time).toBe(5);
        });

        it("sets a coalesce key for a single-field edit", () => {
            const built = buildHistoryEntry(withPending("k", "a"), withPending("k", "ab"), 0)!;
            expect(built.coalesceKey).toBe(`${configPath}::k`);
        });

        it("does not set a coalesce key when more than one slice changed", () => {
            const previous = emptyState();
            const current: UndoableState = { ...withPending("k", "v"), renames: { [configPath]: { a: "b" } } };
            expect(previous).toBe(BASE);
            expect(buildHistoryEntry(previous, current, 0)!.coalesceKey).toBeNull();
        });
    });

    describe("pushHistoryEntry", () => {
        it("appends an entry that cannot coalesce", () => {
            const stack = pushHistoryEntry([], entry({ time: 0 }));
            expect(pushHistoryEntry(stack, entry({ time: 1 }))).toHaveLength(2);
        });

        it("collapses a typing burst on the same field into one entry", () => {
            const first = entry({ coalesceKey: "k", time: 0, before: { renames: {} }, after: { autostoreChanges: {} } });
            const second = entry({ coalesceKey: "k", time: 100, after: { hiddenItems: {} } });

            const stack = pushHistoryEntry(pushHistoryEntry([], first), second);

            expect(stack).toHaveLength(1);
            // The original `before` is kept so one undo reverts the whole burst...
            expect(stack[0].before).toBe(first.before);
            // ...while `after` advances to the latest value.
            expect(stack[0].after).toBe(second.after);
            expect(stack[0].time).toBe(100);
        });

        it("does not collapse once the coalesce window has passed", () => {
            const first = entry({ coalesceKey: "k", time: 0 });
            const second = entry({ coalesceKey: "k", time: COALESCE_WINDOW_MS });
            expect(pushHistoryEntry(pushHistoryEntry([], first), second)).toHaveLength(2);
        });

        it("does not collapse edits to different fields", () => {
            const first = entry({ coalesceKey: "a", time: 0 });
            const second = entry({ coalesceKey: "b", time: 1 });
            expect(pushHistoryEntry(pushHistoryEntry([], first), second)).toHaveLength(2);
        });

        it("drops the oldest entries past the limit", () => {
            let stack: HistoryEntry[] = [];
            for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
                stack = pushHistoryEntry(stack, entry({ time: i }));
            }
            expect(stack).toHaveLength(HISTORY_LIMIT);
            expect(stack[0].time).toBe(10);
        });
    });

    describe("undo/redo transitions", () => {
        it("returns null when there is nothing to undo or redo", () => {
            expect(undoTransition([], [])).toBeNull();
            expect(redoTransition([], [])).toBeNull();
        });

        it("undo yields the before-snapshot and moves the entry to the redo stack", () => {
            const only = entry({ before: { renames: {} }, after: { hiddenItems: {} } });
            const transition = undoTransition([only], [])!;

            expect(transition.snapshot).toBe(only.before);
            expect(transition.undoStack).toEqual([]);
            expect(transition.redoStack).toEqual([only]);
        });

        it("redo yields the after-snapshot and moves the entry back", () => {
            const only = entry({ before: { renames: {} }, after: { hiddenItems: {} } });
            const transition = redoTransition([], [only])!;

            expect(transition.snapshot).toBe(only.after);
            expect(transition.undoStack).toEqual([only]);
            expect(transition.redoStack).toEqual([]);
        });

        it("undoes in newest-first order and redoes in reverse", () => {
            const first = entry({ time: 1 });
            const second = entry({ time: 2 });

            const afterFirstUndo = undoTransition([first, second], [])!;
            expect(afterFirstUndo.redoStack).toEqual([second]);

            const afterSecondUndo = undoTransition(afterFirstUndo.undoStack, afterFirstUndo.redoStack)!;
            expect(afterSecondUndo.undoStack).toEqual([]);
            expect(afterSecondUndo.redoStack).toEqual([second, first]);

            const afterRedo = redoTransition(afterSecondUndo.undoStack, afterSecondUndo.redoStack)!;
            expect(afterRedo.undoStack).toEqual([first]);
            expect(afterRedo.redoStack).toEqual([second]);
        });
    });
});
