/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Pure history logic behind the config editor's undo/redo. Kept separate from the hook so the
 * transitions can be tested without rendering.
 */

import { DeletionsMap, PendingChangesMap, PendingDefaultsMap, RenamesMap } from "../types";

export interface UndoableState {
    pendingChanges: PendingChangesMap;
    pendingDefaults: PendingDefaultsMap;
    deletions: DeletionsMap;
    defaultsDeletions: DeletionsMap;
    renames: RenamesMap;
    dragDroppedProfiles: { [configPath: string]: Set<string> };
    autostoreChanges: { [configPath: string]: boolean };
    hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
}

export type UndoableKey = keyof UndoableState;

export interface HistoryEntry {
    before: Partial<UndoableState>;
    after: Partial<UndoableState>;
    /** Identifies a rapid single-field edit so a typing burst collapses into one entry. */
    coalesceKey: string | null;
    time: number;
}

export const HISTORY_LIMIT = 50;
export const COALESCE_WINDOW_MS = 500;

export const UNDOABLE_KEYS: UndoableKey[] = [
    "pendingChanges",
    "pendingDefaults",
    "deletions",
    "defaultsDeletions",
    "renames",
    "dragDroppedProfiles",
    "autostoreChanges",
    "hiddenItems",
];

/**
 * `dragDroppedProfiles` is updated by mutating the existing `Set` behind a shallow-copied outer
 * object, so its sets must be copied to snapshot them. Every other slice is replaced immutably,
 * so holding the previous reference is both correct and cheap.
 */
export function snapshotValue<K extends UndoableKey>(key: K, value: UndoableState[K]): UndoableState[K] {
    if (key !== "dragDroppedProfiles") {
        return value;
    }
    const sets = value as UndoableState["dragDroppedProfiles"];
    return Object.fromEntries(Object.entries(sets).map(([configPath, set]) => [configPath, new Set(set)])) as UndoableState[K];
}

/** The single `pendingChanges` entry that changed, or null when it was not exactly one. */
export function singleChangedPendingKey(before: PendingChangesMap, after: PendingChangesMap): string | null {
    const changed: string[] = [];
    for (const configPath of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const beforeEntries = before[configPath] ?? {};
        const afterEntries = after[configPath] ?? {};
        for (const key of new Set([...Object.keys(beforeEntries), ...Object.keys(afterEntries)])) {
            if (beforeEntries[key]?.value !== afterEntries[key]?.value) {
                changed.push(`${configPath}::${key}`);
                if (changed.length > 1) {
                    return null;
                }
            }
        }
    }
    return changed.length === 1 ? changed[0] : null;
}

/** Builds the entry describing a commit, or null when no tracked slice changed. */
export function buildHistoryEntry(previous: UndoableState, current: UndoableState, time: number): HistoryEntry | null {
    const changedKeys = UNDOABLE_KEYS.filter((key) => previous[key] !== current[key]);
    if (changedKeys.length === 0) {
        return null;
    }

    const before: Partial<UndoableState> = {};
    const after: Partial<UndoableState> = {};
    for (const key of changedKeys) {
        (before as Record<string, unknown>)[key] = snapshotValue(key, previous[key]);
        (after as Record<string, unknown>)[key] = snapshotValue(key, current[key]);
    }

    const coalesceKey =
        changedKeys.length === 1 && changedKeys[0] === "pendingChanges"
            ? singleChangedPendingKey(previous.pendingChanges, current.pendingChanges)
            : null;

    return { before, after, coalesceKey, time };
}

/**
 * Appends `entry`, collapsing it into the previous entry when it continues an edit to the same
 * field, so one undo reverts a whole typing burst. Oldest entries are dropped past the limit.
 */
export function pushHistoryEntry(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
    const top = stack[stack.length - 1];
    if (top && entry.coalesceKey !== null && top.coalesceKey === entry.coalesceKey && entry.time - top.time < COALESCE_WINDOW_MS) {
        return [...stack.slice(0, -1), { ...top, after: entry.after, time: entry.time }];
    }
    return [...stack, entry].slice(-HISTORY_LIMIT);
}

export interface HistoryTransition {
    /** Snapshot the caller should apply. */
    snapshot: Partial<UndoableState>;
    undoStack: HistoryEntry[];
    redoStack: HistoryEntry[];
}

/** Moves the newest undo entry onto the redo stack. Returns null when there is nothing to undo. */
export function undoTransition(undoStack: HistoryEntry[], redoStack: HistoryEntry[]): HistoryTransition | null {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) {
        return null;
    }
    return { snapshot: entry.before, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, entry] };
}

/** Moves the newest redo entry back onto the undo stack. Returns null when there is nothing to redo. */
export function redoTransition(undoStack: HistoryEntry[], redoStack: HistoryEntry[]): HistoryTransition | null {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) {
        return null;
    }
    return { snapshot: entry.after, undoStack: [...undoStack, entry], redoStack: redoStack.slice(0, -1) };
}
