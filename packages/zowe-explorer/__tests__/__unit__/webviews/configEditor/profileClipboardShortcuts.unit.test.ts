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

import { vi } from "vitest";

// Run effects synchronously so the hook can be exercised without a React renderer.
let cleanup: (() => void) | undefined;
vi.mock("react", () => ({
    useEffect: (effect: () => (() => void) | void) => {
        cleanup = effect() ?? undefined;
    },
}));

import { getProfileClipboardShortcut } from "../../../../src/webviews/src/config-editor/utils/profileClipboardShortcuts";
import { useProfileClipboardShortcuts } from "../../../../src/webviews/src/config-editor/hooks/useProfileClipboardShortcuts";

describe("profileClipboardShortcuts", () => {
    it.each([
        ["c", "copy"],
        ["X", "cut"],
        ["v", "paste"],
    ])("recognizes %s with either platform modifier", (key, action) => {
        expect(getProfileClipboardShortcut({ key, ctrlKey: true, metaKey: false }, null)).toBe(action);
        expect(getProfileClipboardShortcut({ key, ctrlKey: false, metaKey: true }, null)).toBe(action);
        expect(getProfileClipboardShortcut({ key, ctrlKey: false, metaKey: false }, null)).toBeUndefined();
    });
    it.each(["INPUT", "TEXTAREA", "VSCODE-TEXTFIELD", "VSCODE-SINGLE-SELECT"])("leaves %s editing shortcuts alone", (tagName) => {
        expect(getProfileClipboardShortcut({ key: "v", ctrlKey: true, metaKey: false }, { tagName, isContentEditable: false })).toBeUndefined();
    });
    it("ignores contenteditable elements and unrelated shortcuts", () => {
        expect(getProfileClipboardShortcut({ key: "c", ctrlKey: true, metaKey: false }, { tagName: "DIV", isContentEditable: true })).toBeUndefined();
        expect(getProfileClipboardShortcut({ key: "s", ctrlKey: true, metaKey: false }, null)).toBeUndefined();
    });

    describe("useProfileClipboardShortcuts", () => {
        type Actions = Parameters<typeof useProfileClipboardShortcuts>[1];
        const listeners: Record<string, (event: unknown) => void> = {};
        const addEventListener = vi.fn((type: string, listener: (event: unknown) => void) => {
            listeners[type] = listener;
        });
        const removeEventListener = vi.fn((type: string) => {
            delete listeners[type];
        });
        const copyProfile = vi.fn();
        const pasteProfile = vi.fn();
        const render = (pendingClipboardPrompt: Actions["pendingClipboardPrompt"]) =>
            useProfileClipboardShortcuts("rseProf", { copyProfile, pasteProfile, pendingClipboardPrompt } as unknown as Actions);
        const press = (key: string) => listeners.keydown?.({ key, ctrlKey: true, metaKey: false });

        beforeEach(() => {
            vi.clearAllMocks();
            cleanup = undefined;
            for (const type of Object.keys(listeners)) delete listeners[type];
            vi.stubGlobal("document", { addEventListener, removeEventListener, activeElement: null });
        });
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("handles copy, cut and paste shortcuts when no prompt is open", () => {
            render(null);
            press("c");
            press("x");
            press("v");

            expect(copyProfile).toHaveBeenNthCalledWith(1, "rseProf", false);
            expect(copyProfile).toHaveBeenNthCalledWith(2, "rseProf", true);
            expect(pasteProfile).toHaveBeenCalledWith("rseProf");
        });

        it("does not register a keydown listener while the secure-values prompt is open", () => {
            render({ action: "copy", profileKey: "rseProf", configPath: "/mock/team.json" });
            press("v");
            press("c");
            press("x");

            expect(addEventListener).not.toHaveBeenCalled();
            expect(pasteProfile).not.toHaveBeenCalled();
            expect(copyProfile).not.toHaveBeenCalled();
        });

        it("removes the listener on cleanup", () => {
            render(null);
            cleanup?.();

            expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
            expect(listeners.keydown).toBeUndefined();
        });
    });
});
