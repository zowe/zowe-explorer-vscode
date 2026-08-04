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

import type { CSSProperties, ReactNode } from "react";
import { useCallback } from "react";
import { useModalClickOutside } from "../hooks/useModalClickOutside";
import { useModalFocus } from "../hooks/useModalFocus";

const FOCUSABLE_SELECTOR = 'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';

interface ModalShellProps {
  isOpen: boolean;
  /** Omit for a non-dismissable modal (no backdrop-click or Escape close), e.g. a blocking error dialog. */
  onClose?: () => void;
  /** Selector for the element to focus when the modal opens; falls back to the first focusable element. */
  initialFocusSelector?: string;
  /** Id of the title element, wired to the panel's aria-labelledby. */
  titleId?: string;
  overlayClassName: string;
  panelClassName: string;
  panelStyle?: CSSProperties;
  panelId?: string;
  /** Extra key handling (e.g. Enter-to-submit) layered on top of the shell's Escape/Tab handling. */
  onKeyDown?: (e: KeyboardEvent) => void;
  children: ReactNode;
}

/**
 * Shared dialog shell: backdrop-click dismiss, Escape-to-close, Tab focus-trap, and
 * role="dialog"/aria-modal semantics. Used by every config-editor modal so each one only owns
 * its content.
 */
export function ModalShell({
  isOpen,
  onClose,
  initialFocusSelector,
  titleId,
  overlayClassName,
  panelClassName,
  panelStyle,
  panelId,
  onKeyDown,
  children,
}: ModalShellProps) {
  const { handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onClose ?? (() => {}));
  const modalRef = useModalFocus(isOpen, initialFocusSelector);

  const handleShellKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onClose) {
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null && !(el as HTMLButtonElement | HTMLInputElement).disabled
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;

          if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      onKeyDown?.(e);
    },
    [onClose, onKeyDown, modalRef]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={overlayClassName}
      onMouseDown={onClose ? handleBackdropMouseDown : (e) => e.stopPropagation()}
      onClick={onClose ? handleBackdropClick : undefined}
      onKeyDown={handleShellKeyDown}
      tabIndex={-1}
    >
      <div
        ref={modalRef}
        id={panelId}
        className={panelClassName}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {children}
      </div>
    </div>
  );
}
