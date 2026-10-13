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

import { useEffect, useRef, useState } from "react";

export interface ProfileContextMenuState {
    x: number;
    y: number;
    profileKey: string | null;
}

export function useProfileContextMenu() {
    const [contextMenu, setContextMenu] = useState<ProfileContextMenuState | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const openContextMenu = (event: Pick<MouseEvent, "clientX" | "clientY">, profileKey: string | null) => {
        const menuWidth = 150;
        const menuHeight = profileKey === null ? 50 : 240;
        const x = event.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : event.clientX;
        const y = event.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : event.clientY;
        setContextMenu({ x, y, profileKey });
    };

    useEffect(() => {
        if (!contextMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) setContextMenu(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setContextMenu(null);
        };
        document.addEventListener("mousedown", handleClickOutside, true);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [contextMenu]);

    return { contextMenu, setContextMenu, contextMenuRef, openContextMenu };
}
