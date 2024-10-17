import { useEffect, useState } from "preact/hooks";
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridCell, VSCodeDataGridRow, VSCodeDivider } from "@vscode/webview-ui-toolkit/react";
import * as l10n from "@vscode/l10n";
import { isSecureOrigin } from "../utils";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [certPath, setCertPath] = useState("");
  const [certKeyPath, setCertKeyPath] = useState("");
  const [localizationState, setLocalizationState] = useState(null);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      // Prevent users from sending data into webview outside of extension/webview context
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        l10n.config({
          contents: contents,
        });
        setLocalizationState(contents);
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

    vscodeApi.postMessage({ command: "GET_LOCALIZATION" });
    vscodeApi.postMessage({ command: "ready" });
  }, [localizationState]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{l10n.t("Log in to Authentication Service")}</h1>
      </div>
      <VSCodeDivider />
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <VSCodeDataGrid style={{ marginTop: "1em" }} gridTemplateColumns="15vw 45vw 30vw">
            <h3>{l10n.t("Select a certificate and certificate key in PEM format:")}</h3>
            <VSCodeDataGridRow rowType="header">
              <VSCodeDataGridCell cellType="columnheader" gridColumn="1"></VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="2">
                {l10n.t("Value")}
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cellType="columnheader" gridColumn="3">
                {l10n.t("Actions")}
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">
                <strong>{l10n.t("Certificate File")}</strong>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" onClick={() => vscodeApi.postMessage({ command: "promptCert" })}>
                  {l10n.t("Browse")}
                </VSCodeButton>
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>
            <VSCodeDataGridRow>
              <VSCodeDataGridCell gridColumn="1">
                <strong>{l10n.t("Certificate Key File")}</strong>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="2">
                <i>{certKeyPath}</i>
              </VSCodeDataGridCell>
              <VSCodeDataGridCell gridColumn="3">
                <VSCodeButton appearance="secondary" onClick={() => vscodeApi.postMessage({ command: "promptCertKey" })}>
                  {l10n.t("Browse")}
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
              {l10n.t("Submit")}
            </VSCodeButton>
            <VSCodeButton
              appearance="secondary"
              style={{ marginTop: "1em", marginLeft: "1em" }}
              onClick={() => {
                vscodeApi.postMessage({ command: "close" });
              }}
            >
              {l10n.t("Cancel")}
            </VSCodeButton>
          </div>
        </div>
      </div>
    </div>
  );
}
