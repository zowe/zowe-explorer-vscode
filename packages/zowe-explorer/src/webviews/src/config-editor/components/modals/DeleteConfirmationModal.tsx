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
import VscodeButton from "@vscode-elements/react-elements/dist/components/VscodeButton.js";
import { ModalShell } from "../ModalShell";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  type: "property" | "profile";
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({ isOpen, type, name, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

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
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      initialFocusSelector="#delete-confirmation-confirm-button"
      titleId="delete-confirmation-modal-title"
      overlayClassName="modal-backdrop"
      panelClassName="modal"
      panelStyle={{ minWidth: "400px", maxWidth: "500px" }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h2 id="delete-confirmation-modal-title" style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "var(--ce-font-weight-emphasis)" }}>
          {getTitle()}
        </h2>
        <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.5", color: "var(--vscode-foreground)" }}>{getMessage()}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
        <VscodeButton secondary onClick={onCancel}>
          {l10n.t("Cancel")}
        </VscodeButton>
        <VscodeButton id="delete-confirmation-confirm-button" onClick={onConfirm}>
          {l10n.t("Delete")}
        </VscodeButton>
      </div>
    </ModalShell>
  );
}
