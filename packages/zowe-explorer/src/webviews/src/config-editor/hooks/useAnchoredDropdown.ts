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

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

export function useAnchoredDropdown(isOpen: boolean, onClose: () => void) {
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
        position: "fixed",
        visibility: "hidden",
    });
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        if (!isOpen || !triggerRef.current || !menuRef.current) return;

        const anchorRect = triggerRef.current.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = anchorRect.bottom + 2;
        // Align right edge of menu with right edge of anchor by default so it expands inward
        let left = anchorRect.right - menuRect.width;

        // Clamp right edge to viewport
        if (left + menuRect.width > vw - 8) {
            left = vw - menuRect.width - 8;
        }
        // Clamp left edge to viewport
        if (left < 8) {
            left = 8;
        }

        let maxHeight: number | undefined;

        // Flip above anchor if overflowing bottom of viewport
        if (top + menuRect.height > vh - 8) {
            const flippedTop = anchorRect.top - menuRect.height - 2;
            if (flippedTop >= 8) {
                top = flippedTop;
            } else {
                // Place on whichever side has more room and constrain height
                const spaceBelow = vh - anchorRect.bottom - 10;
                const spaceAbove = anchorRect.top - 10;
                if (spaceAbove > spaceBelow) {
                    top = Math.max(8, anchorRect.top - spaceAbove);
                    maxHeight = spaceAbove;
                } else {
                    top = anchorRect.bottom + 2;
                    maxHeight = spaceBelow;
                }
            }
        }

        setMenuStyle({
            position: "fixed",
            top: `${top}px`,
            left: `${left}px`,
            right: "auto",
            maxHeight: maxHeight ? `${maxHeight}px` : undefined,
            overflowY: maxHeight ? "auto" : undefined,
            visibility: "visible",
            zIndex: 1000,
        });
    }, [isOpen]);

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
        } else {
            setMenuStyle({
                position: "fixed",
                visibility: "hidden",
            });
        }
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current && !triggerRef.current.contains(target) && menuRef.current && !menuRef.current.contains(target)) {
                onClose();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        const handleScrollOrResize = () => {
            onClose();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("scroll", handleScrollOrResize, true);
            window.removeEventListener("resize", handleScrollOrResize);
        };
    }, [isOpen, onClose]);

    return { triggerRef, menuRef, menuStyle };
}
