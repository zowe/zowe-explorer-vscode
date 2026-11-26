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

import { useEffect } from "react";
import type { useProfileClipboard } from "./useProfileClipboard";
import { getProfileClipboardShortcut } from "../utils/profileClipboardShortcuts";

/**
 * Owned by ProfileList, which stays mounted when its tree child is displayed.
 * Shortcuts are suspended while the secure-values prompt is open, so an older cut/copy cannot be pasted behind it.
 */
export function useProfileClipboardShortcuts(
    selectedProfileKey: string | null,
    {
        copyProfile,
        pasteProfile,
        pendingClipboardPrompt,
    }: Pick<ReturnType<typeof useProfileClipboard>, "copyProfile" | "pasteProfile" | "pendingClipboardPrompt">
) {
    useEffect(() => {
        if (pendingClipboardPrompt) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const action = getProfileClipboardShortcut(event, document.activeElement as HTMLElement | null);
            if (action === "paste") pasteProfile(selectedProfileKey);
            else if (selectedProfileKey && (action === "copy" || action === "cut")) copyProfile(selectedProfileKey, action === "cut");
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedProfileKey, copyProfile, pasteProfile, pendingClipboardPrompt]);
}
