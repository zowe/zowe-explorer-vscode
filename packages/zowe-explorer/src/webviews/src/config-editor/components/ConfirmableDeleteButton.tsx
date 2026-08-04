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

interface ConfirmableDeleteButtonProps {
  /** When true, shows the confirm/cancel pair instead of the trash button. */
  isConfirming: boolean;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancel: () => void;
  /** Button class shared by all three buttons (defaults to "action-button"). */
  buttonClassName?: string;
  /** When set, wraps the confirm/cancel pair in a div with this class; otherwise an inline flex style is used. */
  confirmWrapperClassName?: string;
  /** Optional id/title for the trash button. */
  deleteId?: string;
  deleteTitle?: string;
}

/**
 * A trash button that turns into a confirm (check) / cancel (close) pair once a delete is
 * requested. Shared by property rows (secure + editable) and the profile header.
 */
export function ConfirmableDeleteButton({
  isConfirming,
  onRequestDelete,
  onConfirmDelete,
  onCancel,
  buttonClassName = "action-button",
  confirmWrapperClassName,
  deleteId,
  deleteTitle,
}: ConfirmableDeleteButtonProps) {
  if (isConfirming) {
    const confirmCancel = (
      <>
        <button
          className={buttonClassName}
          onClick={onConfirmDelete}
          title={l10n.t("Confirm delete")}
          style={{ color: "var(--vscode-errorForeground)" }}
        >
          <span className="codicon codicon-check"></span>
        </button>
        <button className={buttonClassName} onClick={onCancel} title={l10n.t("Cancel")}>
          <span className="codicon codicon-close"></span>
        </button>
      </>
    );

    return confirmWrapperClassName ? (
      <div className={confirmWrapperClassName}>{confirmCancel}</div>
    ) : (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>{confirmCancel}</div>
    );
  }

  return (
    <button className={buttonClassName} id={deleteId} onClick={onRequestDelete} title={deleteTitle}>
      <span className="codicon codicon-trash"></span>
    </button>
  );
}
