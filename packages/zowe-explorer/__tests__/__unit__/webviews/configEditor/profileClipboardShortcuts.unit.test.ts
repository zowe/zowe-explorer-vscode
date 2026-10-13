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

import { getProfileClipboardShortcut } from "../../../../src/webviews/src/config-editor/utils/profileClipboardShortcuts";

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
});
