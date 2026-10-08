import { useEffect, useState } from "preact/hooks";
import * as l10n from "@vscode/l10n";
import { isSecureOrigin } from "../utils";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [certPath, setCertPath] = useState("");
  const [certKeyPath, setCertKeyPath] = useState("");
  const [title, setTitle] = useState(l10n.t("Log in to Authentication Service"));
  const [showLoginButton, setShowLoginButton] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState(l10n.t("Save"));
  const [profileName, setProfileName] = useState("");

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

      if (event.data.opts.title) {
        setTitle(event.data.opts.title);
      }
      if (event.data.opts.profileName) {
        setProfileName(l10n.t(`Profile: {0}`, event.data.opts.profileName));
      }
      if (event.data.opts.cert) {
        setCertPath(event.data.opts.cert);
      }

      if (event.data.opts.showLoginButton != null) {
        setShowLoginButton(event.data.opts.showLoginButton);
      }

      if (event.data.opts.saveButtonText) {
        setSaveButtonText(event.data.opts.saveButtonText);
      }

      if (event.data.opts.certKey) {
        setCertKeyPath(event.data.opts.certKey);
      }
    });

    vscodeApi.postMessage({ command: "GET_LOCALIZATION" });
    vscodeApi.postMessage({ command: "ready" });
  }, [localizationState]);

  return (
    <div style={{ minWidth: "25em" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{title}</h1>
      </div>
      <vscode-divider />
      <div style={{ marginTop: "1em" }}>
        <h4>{profileName}</h4>
        <h3>{l10n.t("Select a certificate and certificate key in PEM format:")}</h3>
        <vscode-table style={{ marginTop: "1em" }} columns={["160px", "auto", "110px"]}>
          <vscode-table-header slot="header">
            <vscode-table-header-cell></vscode-table-header-cell>
            <vscode-table-header-cell>{l10n.t("Value")}</vscode-table-header-cell>
            <vscode-table-header-cell>{l10n.t("Actions")}</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body slot="body">
            <vscode-table-row>
              <vscode-table-cell>
                <strong>{l10n.t("Certificate File")}</strong>
              </vscode-table-cell>
              <vscode-table-cell>
                <i>{certPath}</i>
              </vscode-table-cell>
              <vscode-table-cell style={{ padding: "1em" }}>
                <vscode-button secondary onClick={() => vscodeApi.postMessage({ command: "promptCert" })}>
                  {l10n.t("Browse")}
                </vscode-button>
              </vscode-table-cell>
            </vscode-table-row>
            <vscode-table-row>
              <vscode-table-cell>
                <strong>{l10n.t("Certificate Key File")}</strong>
              </vscode-table-cell>
              <vscode-table-cell>
                <i>{certKeyPath}</i>
              </vscode-table-cell>
              <vscode-table-cell style={{ padding: "1em" }}>
                <vscode-button secondary onClick={() => vscodeApi.postMessage({ command: "promptCertKey" })}>
                  {l10n.t("Browse")}
                </vscode-button>
              </vscode-table-cell>
            </vscode-table-row>
          </vscode-table-body>
        </vscode-table>
        <div style={{ display: "flex" }}>
          <vscode-button
            style={{ marginTop: "1em" }}
            onClick={() => {
              vscodeApi.postMessage({ command: "save" });
            }}
          >
            {saveButtonText}
          </vscode-button>
          {showLoginButton ? (
            <vscode-button
              secondary
              style={{ marginLeft: "1em", marginTop: "1em" }}
              onClick={() => {
                vscodeApi.postMessage({ command: "login" });
              }}
            >
              {l10n.t("Log in")}
            </vscode-button>
          ) : null}
          <vscode-button
            id="cancelButton"
            secondary
            style={{ marginTop: "1em", marginLeft: "1em" }}
            onClick={() => {
              vscodeApi.postMessage({ command: "close" });
            }}
          >
            {l10n.t("Cancel")}
          </vscode-button>
        </div>
      </div>
    </div>
  );
}
