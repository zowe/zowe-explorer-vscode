/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Utility for detecting first-time users of the Config Editor.
 */

const TUTORIAL_STORAGE_KEY = "zowe.configEditor.tutorialCompleted";

/**
 * Returns true if the tutorial should be shown.
 * The tutorial shows unless the user has explicitly finished or skipped it.
 * Call resetTutorial() to force it to show again.
 */
export function shouldShowTutorial(): boolean {
    try {
        return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "true";
    } catch {
        // If localStorage is unavailable, always show
        return true;
    }
}

/**
 * Marks the tutorial as completed so it won't show again.
 */
export function markTutorialCompleted(): void {
    try {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch {
        // ignore storage errors
    }
}

/**
 * Marks the tutorial as skipped (same effect as completed).
 */
export function markTutorialSkipped(): void {
    markTutorialCompleted();
}

/**
 * Resets the tutorial state so it will show again on next open.
 * Useful for testing or if the user wants to re-read the tutorial.
 */
export function resetTutorial(): void {
    try {
        localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    } catch {
        // ignore storage errors
    }
}
