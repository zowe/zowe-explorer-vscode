import { useEffect, useState } from "preact/hooks";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDivider,
  VSCodeProgressRing,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";

const vscodeApi = acquireVsCodeApi();

export function App() {
  useEffect(() => {
    window.addEventListener("message", (event) => {
      // Prevent users from sending data into webview outside of extension/webview context
      const eventUrl = new URL(event.origin);
      const isWebUser =
        (eventUrl.protocol === document.location.protocol && eventUrl.hostname === document.location.hostname) ||
        eventUrl.hostname.endsWith(".github.dev");
      const isLocalVSCodeUser = eventUrl.protocol === "vscode-webview:";

      if (!isWebUser && !isLocalVSCodeUser) {
        return;
      }
    });
    // signal to extension that webview is ready for data; prevents race condition during initialization
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Certificate wizard</h1>
      </div>
      <VSCodeDivider />
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <VSCodeButton>Select certificate</VSCodeButton>
        </div>
      </div>
    </div>
  );
}
