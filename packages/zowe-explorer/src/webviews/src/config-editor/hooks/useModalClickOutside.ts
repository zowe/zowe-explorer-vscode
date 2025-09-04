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

import { useRef, useCallback } from "react";

export function useModalClickOutside(onClose: () => void) {
    const modalRef = useRef<HTMLDivElement>(null);
    const mouseDownTargetRef = useRef<EventTarget | null>(null);

    const handleBackdropMouseDown = useCallback((e: any) => {
        // Store the target where the mouse down started
        mouseDownTargetRef.current = e.target;
    }, []);

    const handleBackdropClick = useCallback(
        (e: any) => {
            // Only close if the mouse down started on the backdrop (not inside the modal)
            if (mouseDownTargetRef.current === e.currentTarget) {
                onClose();
            }
        },
        [onClose]
    );

    return {
        modalRef,
        handleBackdropMouseDown,
        handleBackdropClick,
    };
}
