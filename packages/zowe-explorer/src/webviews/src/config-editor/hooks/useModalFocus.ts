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

export function useModalFocus(isOpen: boolean, focusSelector?: string) {
    const modalRef = useRef<HTMLDivElement>(null);
    const focusAttempted = useRef<boolean>(false);

    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Reset the focus attempt flag when modal opens
            focusAttempted.current = false;

            // Use a small delay to ensure the modal is fully rendered
            const timeoutId = setTimeout(() => {
                if (focusAttempted.current) return; // Prevent multiple focus attempts

                focusAttempted.current = true;

                if (focusSelector) {
                    // Try to focus a specific element within the modal
                    const focusElement = modalRef.current?.querySelector(focusSelector) as HTMLElement;
                    if (focusElement) {
                        focusElement.focus();
                        return;
                    }
                }

                // Fallback: focus the first focusable element in the modal
                const focusableElements = modalRef.current?.querySelectorAll(
                    'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
                ) as NodeListOf<HTMLElement>;

                if (focusableElements && focusableElements.length > 0) {
                    // Find the first visible and enabled element
                    for (let i = 0; i < focusableElements.length; i++) {
                        const element = focusableElements[i];
                        if (element.offsetParent !== null && !(element as any).disabled) {
                            element.focus();
                            break;
                        }
                    }
                }
            }, 100); // Increased delay to ensure modal is fully rendered

            return () => clearTimeout(timeoutId);
        } else {
            // Reset the focus attempt flag when modal closes
            focusAttempted.current = false;
        }
    }, [isOpen, focusSelector]);

    return modalRef;
}
