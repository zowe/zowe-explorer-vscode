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

import * as l10n from "@vscode/l10n";
import { useModalClickOutside, useModalFocus } from "../../hooks";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  type: "property" | "profile";
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({ isOpen, type, name, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, ".delete-confirm-button");

  const getTitle = () => {
    if (type === "profile") {
      return l10n.t("Delete Profile");
    }
    return l10n.t("Delete Property");
  };

  const getMessage = () => {
    if (type === "profile") {
      return l10n.t('Are you sure you want to delete the profile "{0}"? This action cannot be undone.', name);
    }
    return l10n.t('Are you sure you want to delete the property "{0}"? This action cannot be undone.', name);
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className="modal" ref={modalRef} style={{ minWidth: "400px", maxWidth: "500px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>{getTitle()}</h2>
          <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.5", color: "var(--vscode-foreground)" }}>{getMessage()}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
          <button
            className="modal-button secondary"
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              height: "32px",
              lineHeight: "16px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-secondaryBorder)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "normal",
            }}
          >
            {l10n.t("Cancel")}
          </button>
          <button
            className="modal-button delete-confirm-button"
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              height: "32px",
              lineHeight: "16px",
              backgroundColor: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
              border: "1px solid var(--vscode-button-border)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            {l10n.t("Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
