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
