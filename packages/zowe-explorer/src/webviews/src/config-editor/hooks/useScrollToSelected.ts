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

import { useEffect, useRef } from "react";

/**
 * Scrolls the selected profile into view within a scroll container whenever the selection
 * changes, retrying a few times to handle late-rendering rows. Returns the ref to attach to the
 * scroll container. Shared by the tree and flat profile lists.
 */
export function useScrollToSelected(selectedProfileKey: string | null) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedProfileKey && scrollContainerRef.current) {
            const scrollToSelected = () => {
                const selectedElement = scrollContainerRef.current?.querySelector(`[data-profile-key="${selectedProfileKey}"]`);
                if (selectedElement && scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    const containerRect = container.getBoundingClientRect();
                    const elementRect = selectedElement.getBoundingClientRect();

                    const isElementVisible = elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;

                    if (!isElementVisible || elementRect.top < containerRect.top + 50 || elementRect.bottom > containerRect.bottom - 50) {
                        selectedElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                            inline: "nearest",
                        });
                        return true;
                    }
                }
                return false;
            };

            if (!scrollToSelected()) {
                const timeouts = [
                    setTimeout(() => scrollToSelected(), 100),
                    setTimeout(() => scrollToSelected(), 300),
                    setTimeout(() => scrollToSelected(), 500),
                ];

                return () => timeouts.forEach(clearTimeout);
            }
        }
    }, [selectedProfileKey]);

    return scrollContainerRef;
}
