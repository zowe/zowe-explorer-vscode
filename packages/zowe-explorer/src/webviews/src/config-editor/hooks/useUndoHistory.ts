/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Undo/redo for the config editor's unsaved-change state.
 *
 * Rather than wrapping every setter (there are ~35 call sites, and recording inside a state
 * updater would double-fire under StrictMode), this observes the tracked slices in an effect and
 * records a transaction whenever a commit changes any of them. React batches the setter calls
 * made by one user action into a single commit, so one action produces one undo entry.
 *
 * The transition logic itself lives in `utils/undoHistory` so it can be tested without rendering.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
    HistoryEntry,
    UNDOABLE_KEYS,
    UndoableKey,
    UndoableState,
    buildHistoryEntry,
    pushHistoryEntry,
    redoTransition,
    undoTransition,
} from "../utils/undoHistory";

export type { UndoableState, UndoableKey } from "../utils/undoHistory";

export type UndoableSetters = {
    [K in UndoableKey]: (value: UndoableState[K]) => void;
};

export function useUndoHistory(current: UndoableState, setters: UndoableSetters) {
    const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
    const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

    const previousRef = useRef<UndoableState>(current);
    /** Set while applying an undo/redo/clear so the resulting commit is not itself recorded. */
    const suspendedRef = useRef(false);

    // Held in a ref so `undo`/`redo` keep a stable identity across renders even though callers
    // pass a fresh setters object each time.
    const settersRef = useRef(setters);
    settersRef.current = setters;

    const applySnapshot = useCallback((snapshot: Partial<UndoableState>) => {
        for (const key of UNDOABLE_KEYS) {
            if (key in snapshot) {
                (settersRef.current[key] as (value: unknown) => void)(snapshot[key]);
            }
        }
    }, []);

    useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = current;

        if (suspendedRef.current) {
            suspendedRef.current = false;
            return;
        }

        const entry = buildHistoryEntry(previous, current, Date.now());
        if (!entry) {
            return;
        }

        setUndoStack((stack) => pushHistoryEntry(stack, entry));
        setRedoStack([]);
    }, [
        current.pendingChanges,
        current.pendingDefaults,
        current.deletions,
        current.defaultsDeletions,
        current.renames,
        current.dragDroppedProfiles,
        current.autostoreChanges,
        current.hiddenItems,
    ]);

    const undo = useCallback(() => {
        const transition = undoTransition(undoStack, redoStack);
        if (!transition) {
            return;
        }
        suspendedRef.current = true;
        applySnapshot(transition.snapshot);
        setUndoStack(transition.undoStack);
        setRedoStack(transition.redoStack);
    }, [undoStack, redoStack, applySnapshot]);

    const redo = useCallback(() => {
        const transition = redoTransition(undoStack, redoStack);
        if (!transition) {
            return;
        }
        suspendedRef.current = true;
        applySnapshot(transition.snapshot);
        setUndoStack(transition.undoStack);
        setRedoStack(transition.redoStack);
    }, [undoStack, redoStack, applySnapshot]);

    /** Drops all history — used after a save and whenever state is reloaded from disk. */
    const clearHistory = useCallback(() => {
        suspendedRef.current = true;
        setUndoStack([]);
        setRedoStack([]);
    }, []);

    return {
        undo,
        redo,
        clearHistory,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
    };
}
