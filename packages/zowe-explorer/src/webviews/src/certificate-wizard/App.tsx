import { useEffect, useState } from "preact/hooks";
import {
  VSCodeButton,
  //VSCodeCheckbox,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDivider,
} from "@vscode/webview-ui-toolkit/react";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [certPath, setCertPath] = useState("");
  const [certKeyPath, setCertKeyPath] = useState("");

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

      setCertPath(event.data.opts.certUri.fsPath);
      setCertKeyPath(event.data.opts.keyUri.fsPath);
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
          <VSCodeDataGrid style={{ marginTop: "1em" }} gridTemplateColumns="15vw 45vw 30vw">
            <h3>Select a certificate and certificate key in PEM format.</h3>
            <VSCodeDataGridRow rowType="header">
              <VSCodeDataGridCell cellType="columnheader" gridColumn="1">
                Type
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="2">
                Value
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="3">
                Actions
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">Certificate File</VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" style={{ height: "24px" }} onClick={() => vscodeApi.postMessage({ command: "promptCert" })}>
                  Browse
                </VSCodeButton>
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">Certificate Key File</VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certKeyPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" style={{ height: "24px" }} onClick={() => vscodeApi.postMessage({ command: "promptCertKey" })}>
                  Browse
                </VSCodeButton>
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
          </VSCodeDataGrid>
          <VSCodeButton style={{ marginTop: "1em" }}>Submit</VSCodeButton>
        </div>
      </div>
    </div>
  );
}
