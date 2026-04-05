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
import type { ConfigParseError } from "../../types";
import { useModalFocus } from "../../hooks";

interface ConfigParseErrorsModalProps {
  errors: ConfigParseError[];
  vscodeApi: { postMessage: (msg: object) => void };
}

export function ConfigParseErrorsModal({ errors, vscodeApi }: ConfigParseErrorsModalProps) {
  const modalRef = useModalFocus(errors.length > 0, "button:not([disabled])");

  if (errors.length === 0) {
    return null;
  }

  const handleOpenFile = (err: ConfigParseError) => {
    if (!err.configPath) {
      return;
    }
    const payload: { command: string; filePath: string; line?: number; column?: number } = {
      command: "OPEN_CONFIG_FILE",
      filePath: err.configPath,
    };
    if (err.line !== undefined && err.column !== undefined) {
      payload.line = err.line;
      payload.column = err.column;
    }
    vscodeApi.postMessage(payload);
  };

  const handleRefresh = () => {
    vscodeApi.postMessage({ command: "GET_PROFILES" });
  };

  return (
    <div className="config-editor-modal-overlay config-editor-modal-overlay--elevated" onMouseDown={(e) => e.stopPropagation()}>
      <div
        ref={modalRef}
        className="config-editor-modal-panel config-editor-modal-panel--parse-errors"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-parse-errors-title"
      >
        <h2 id="config-parse-errors-title" className="config-editor-modal-title">
          {l10n.t("Configuration file errors")}
        </h2>
        <p className="config-editor-modal-description">
          {l10n.t("Fix the issues below, save the files, or click Refresh. This dialog closes when all files load successfully.")}
        </p>
        <ul className="config-parse-errors-list">
          {errors.map((err, i) => (
            <li key={`${err.configPath}-${i}`}>
              {err.configPath ? <div className="config-parse-error-path">{err.configPath}</div> : null}
              <div className="config-parse-error-message">{err.message}</div>
              {err.configPath ? (
                <button type="button" onClick={() => handleOpenFile(err)} className="config-parse-error-open-btn">
                  {l10n.t("Open in editor")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={handleRefresh} className="config-editor-btn-secondary-outline">
            {l10n.t("Refresh")}
          </button>
        </div>
      </div>
    </div>
  );
}
