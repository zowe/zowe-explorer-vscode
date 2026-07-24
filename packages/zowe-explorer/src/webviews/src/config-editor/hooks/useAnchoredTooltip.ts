/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Shared positioning + click-outside-to-close behavior for click-to-show tooltips anchored to
 * an icon button (e.g. field help, "inherited from" info).
 */

import { useState, useRef, useEffect } from "react";

export function useAnchoredTooltip(visible: boolean, onClose: () => void) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Position tooltip relative to viewport when shown
  useEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = anchorRect.top;
    let left = anchorRect.right + 10;

    // Flip left if tooltip would overflow right edge
    if (left + tooltipRect.width > vw - 16) {
      left = anchorRect.left - tooltipRect.width - 10;
    }

    // Clamp left edge
    if (left < 8) left = 8;

    // Flip above if tooltip would overflow bottom edge
    if (top + tooltipRect.height > vh - 16) {
      top = vh - tooltipRect.height - 16;
    }

    if (top < 8) top = 8;

    setStyle({ top: `${top}px`, left: `${left}px` });
  }, [visible]);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  return { style, anchorRef, tooltipRef };
}
