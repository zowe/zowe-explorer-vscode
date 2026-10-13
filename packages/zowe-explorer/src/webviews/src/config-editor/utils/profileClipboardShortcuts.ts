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

export function getProfileClipboardShortcut(
    event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">,
    activeElement: Pick<HTMLElement, "tagName" | "isContentEditable"> | null
): "copy" | "cut" | "paste" | undefined {
    if (
        activeElement &&
        (activeElement.isContentEditable || ["INPUT", "TEXTAREA", "VSCODE-TEXTFIELD", "VSCODE-SINGLE-SELECT"].includes(activeElement.tagName))
    )
        return;
    if (!event.ctrlKey && !event.metaKey) return;
    switch (event.key.toLowerCase()) {
        case "c":
            return "copy";
        case "x":
            return "cut";
        case "v":
            return "paste";
    }
}
