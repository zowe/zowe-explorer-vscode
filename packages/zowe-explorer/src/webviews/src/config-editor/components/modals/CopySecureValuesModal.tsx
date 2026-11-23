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
import { VscodeButton } from "@vscode-elements/react-elements";
import { ModalShell } from "../ModalShell";

interface CopySecureValuesModalProps {
  isOpen: boolean;
  action: "copy" | "duplicate";
  profileName: string;
  onWithoutSecure: () => void;
  onWithSecure: () => void;
  onCancel: () => void;
}

export function CopySecureValuesModal({ isOpen, action, profileName, onWithoutSecure, onWithSecure, onCancel }: CopySecureValuesModalProps) {
  if (!isOpen) return null;

  const isCopy = action === "copy";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      initialFocusSelector="#copy-secure-without-button"
      titleId="copy-secure-values-modal-title"
      overlayClassName="modal-backdrop"
      panelClassName="modal"
      panelStyle={{ minWidth: "400px", maxWidth: "500px" }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h2 id="copy-secure-values-modal-title" style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "var(--ce-font-weight-emphasis)" }}>
          {isCopy ? l10n.t("Copy Profile") : l10n.t("Duplicate Profile")}
        </h2>
        <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.5", color: "var(--vscode-foreground)" }}>
          {l10n.t(
            'The profile "{0}" contains secure values such as credentials, tokens, or certificate references. Do you want to include them in the new profile?',
            profileName
          )}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
        <VscodeButton secondary onClick={onCancel}>
          {l10n.t("Cancel")}
        </VscodeButton>
        <VscodeButton secondary id="copy-secure-with-button" onClick={onWithSecure}>
          {isCopy ? l10n.t("Copy with secure values") : l10n.t("Duplicate with secure values")}
        </VscodeButton>
        <VscodeButton id="copy-secure-without-button" onClick={onWithoutSecure}>
          {isCopy ? l10n.t("Copy without secure values") : l10n.t("Duplicate without secure values")}
        </VscodeButton>
      </div>
    </ModalShell>
  );
}
