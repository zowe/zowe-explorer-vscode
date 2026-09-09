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
import VscodeToolbarButton from "@vscode-elements/react-elements/dist/components/VscodeToolbarButton.js";

interface ConfirmableDeleteButtonProps {
  /** When true, shows the confirm/cancel pair instead of the trash button. */
  isConfirming: boolean;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancel: () => void;
  /** When set, wraps the confirm/cancel pair in a div with this class; otherwise an inline flex style is used. */
  confirmWrapperClassName?: string;
  /** Optional id/title for the trash button. */
  deleteId?: string;
  deleteTitle?: string;
}

/**
 * A trash button that turns into a confirm (check) / cancel (close) pair once a delete is
 * requested. Shared by property rows (secure + editable) and the profile header. The confirm
 * button carries destructive styling so the check doesn't read as a plain "save".
 */
export function ConfirmableDeleteButton({
  isConfirming,
  onRequestDelete,
  onConfirmDelete,
  onCancel,
  confirmWrapperClassName,
  deleteId,
  deleteTitle,
}: ConfirmableDeleteButtonProps) {
  if (isConfirming) {
    const confirmCancel = (
      <>
        <VscodeToolbarButton
          className="delete-confirm-button"
          data-testid="confirmable-delete-confirm"
          onClick={onConfirmDelete}
          title={l10n.t("Confirm delete")}
        >
          <span className="codicon codicon-check"></span>
        </VscodeToolbarButton>
        <VscodeToolbarButton onClick={onCancel} title={l10n.t("Cancel")}>
          <span className="codicon codicon-close"></span>
        </VscodeToolbarButton>
      </>
    );

    return confirmWrapperClassName ? (
      <div className={confirmWrapperClassName}>{confirmCancel}</div>
    ) : (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>{confirmCancel}</div>
    );
  }

  return (
    <VscodeToolbarButton id={deleteId} data-testid="confirmable-delete" onClick={onRequestDelete} title={deleteTitle}>
      <span className="codicon codicon-trash"></span>
    </VscodeToolbarButton>
  );
}
