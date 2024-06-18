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

      if (!event.data.opts || Object.keys(event.data.opts).length === 0) {
        return;
      }

      if (event.data.opts.cert) {
        setCertPath(event.data.opts.cert);
      }

      if (event.data.opts.certKey) {
        setCertKeyPath(event.data.opts.certKey);
      }
    });

    vscodeApi.postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Log in to Authentication Service</h1>
      </div>
      <VSCodeDivider />
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <VSCodeDataGrid style={{ marginTop: "1em" }} gridTemplateColumns="15vw 45vw 30vw">
            <h3>Select a certificate and certificate key in PEM format:</h3>
            <VSCodeDataGridRow rowType="header">
              <VSCodeDataGridCell cellType="columnheader" gridColumn="1"></VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="2">
                Value
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="3">
                Actions
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">
                <strong>Certificate File</strong>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" onClick={() => vscodeApi.postMessage({ command: "promptCert" })}>
                  Browse
                </VSCodeButton>
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">
                <strong>Certificate Key File</strong>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certKeyPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" onClick={() => vscodeApi.postMessage({ command: "promptCertKey" })}>
                  Browse
                </VSCodeButton>
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
          </VSCodeDataGrid>
          <div style={{ display: "flex" }}>
            <VSCodeButton
              style={{ marginTop: "1em" }}
              onClick={() => {
                vscodeApi.postMessage({ command: "submitted" });
              }}
            >
              Submit
            </VSCodeButton>
            <VSCodeButton
              appearance="secondary"
              style={{ marginTop: "1em", marginLeft: "1em" }}
              onClick={() => {
                vscodeApi.postMessage({ command: "close" });
              }}
            >
              Cancel
            </VSCodeButton>
          </div>
        </div>
      </div>
    </div>
  );
}
