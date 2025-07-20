import * as l10n from "@vscode/l10n";
import { useState } from "react";

interface PreviewArgsModalProps {
  isOpen: boolean;
  argsData: any[];
  onClose: () => void;
}

export function PreviewArgsModal({ isOpen, argsData, onClose }: PreviewArgsModalProps) {
  const [revealedSecureValues, setRevealedSecureValues] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const toggleSecureValue = (index: number) => {
    const newRevealed = new Set(revealedSecureValues);
    if (newRevealed.has(index)) {
      newRevealed.delete(index);
    } else {
      newRevealed.add(index);
    }
    setRevealedSecureValues(newRevealed);
  };

  const renderValue = (arg: any, index: number) => {
    const isRevealed = revealedSecureValues.has(index);

    if (arg.secure && !isRevealed) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span>********</span>
          <button
            onClick={() => toggleSecureValue(index)}
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              backgroundColor: "transparent",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-secondaryBackground)",
              borderRadius: "3px",
              cursor: "pointer",
              marginLeft: "auto",
            }}
            title="Click to reveal secure value"
          >
            {l10n.t("Show")}
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
          {typeof arg.argValue === "string" ? arg.argValue : JSON.stringify(arg.argValue)}
        </span>
        {arg.secure && (
          <button
            onClick={() => toggleSecureValue(index)}
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              backgroundColor: "transparent",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-secondaryBackground)",
              borderRadius: "3px",
              cursor: "pointer",
              marginLeft: "auto",
            }}
            title="Click to hide secure value"
          >
            {l10n.t("Hide")}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: "800px", maxHeight: "600px", overflow: "auto" }}>
        <h3>{l10n.t("Preview Args")}</h3>
        <div style={{ maxHeight: "400px", overflow: "auto" }}>
          {argsData.length === 0 ? (
            <p>{l10n.t("No arguments found for this profile.")}</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--vscode-panel-border)" }}>
                  <th style={{ textAlign: "left", padding: "8px", fontWeight: "bold", width: "25%" }}>{l10n.t("Argument Name")}</th>
                  <th style={{ textAlign: "left", padding: "8px", fontWeight: "bold", width: "25%" }}>{l10n.t("Value")}</th>
                  <th style={{ textAlign: "left", padding: "8px", fontWeight: "bold", width: "50%" }}>{l10n.t("Location")}</th>
                </tr>
              </thead>
              <tbody>
                {argsData.map((arg, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid var(--vscode-panel-border)" }}>
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>{arg.argName}</td>
                    <td style={{ padding: "8px" }}>{renderValue(arg, index)}</td>
                    <td style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
                      {arg.argLoc?.osLoc ? arg.argLoc.osLoc.join("") : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: "16px" }}>
          <button onClick={onClose}>{l10n.t("Close")}</button>
        </div>
      </div>
    </div>
  );
}
