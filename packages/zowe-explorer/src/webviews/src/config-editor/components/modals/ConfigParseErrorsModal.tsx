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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          border: "1px solid var(--vscode-panel-border)",
          borderRadius: "6px",
          padding: "20px",
          minWidth: "420px",
          maxWidth: "min(560px, 92vw)",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-parse-errors-title"
      >
        <h2 id="config-parse-errors-title" style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600" }}>
          {l10n.t("Configuration file errors")}
        </h2>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--vscode-descriptionForeground)" }}>
          {l10n.t("Fix the issues below, save the files, or click Refresh. This dialog closes when all files load successfully.")}
        </p>
        <ul style={{ margin: "0 0 16px 0", paddingLeft: "20px", listStyle: "disc" }}>
          {errors.map((err, i) => (
            <li key={`${err.configPath}-${i}`} style={{ marginBottom: "12px" }}>
              {err.configPath ? <div style={{ fontWeight: 600, fontSize: "13px", wordBreak: "break-all" }}>{err.configPath}</div> : null}
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--vscode-errorForeground)",
                  marginTop: "4px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {err.message}
              </div>
              {err.configPath ? (
                <button
                  type="button"
                  onClick={() => handleOpenFile(err)}
                  style={{
                    marginTop: "8px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    cursor: "pointer",
                    backgroundColor: "var(--vscode-button-background)",
                    color: "var(--vscode-button-foreground)",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  {l10n.t("Open in editor")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              cursor: "pointer",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-border)",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Refresh")}
          </button>
        </div>
      </div>
    </div>
  );
}
