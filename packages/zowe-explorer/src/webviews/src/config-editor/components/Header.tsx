import * as l10n from "@vscode/l10n";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

export function Header() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        position: "sticky",
        top: 0,
        background: "var(--vscode-editor-background)",
        padding: "8px 16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{/* Header is now empty, buttons moved to tabs */}</div>
    </div>
  );
}
