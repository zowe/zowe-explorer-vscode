import { VSCodeButton, VSCodeDivider, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";
import { NetworkError } from "@zowe/zowe-explorer-api";
import { TipList } from "./TipList";
import { useState } from "preact/hooks";
import PersistentVSCodeAPI from "../../PersistentVSCodeAPI";

export type ErrorInfoProps = {
  error: NetworkError;
  stackTrace?: string;
};

export const isNetworkError = (val: any): val is NetworkError => {
  return val?.["info"] != null && val.info["summary"] != null;
};

export const ErrorInfo = ({ error, stackTrace }: ErrorInfoProps) => {
  const [errorDisplayed, setErrorDisplayed] = useState(false);
  return (
    <div>
      <h2>Error details</h2>
      <p>
        <span style={{ fontWeight: "bold" }}>Code: </span>
        {error.info.errorCode ?? "Not available"}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>
          Description: <br />
        </span>
        {error.info.summary}
      </p>
      <details style={{ marginBottom: "0.5rem" }}>
        <summary
          style={{ cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", userSelect: "none" }}
          onClick={() => setErrorDisplayed((prev) => !prev)}
        >
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ display: "flex", alignItems: "center" }}>
              {errorDisplayed ? (
                <span slot="start" className="codicon codicon-chevron-down" style={{ marginTop: "1px" }}></span>
              ) : (
                <span slot="start" className="codicon codicon-chevron-right" style={{ marginTop: "1px" }}></span>
              )}
              &nbsp; Full error summary
            </span>
            <span>
              <VSCodeButton
                appearance="secondary"
                onClick={(e: MouseEvent) => {
                  e.stopImmediatePropagation();
                  PersistentVSCodeAPI.getVSCodeAPI().postMessage({
                    command: "copy",
                  });
                }}
              >
                Copy details
              </VSCodeButton>
            </span>
          </span>
        </summary>
        <VSCodeTextArea
          value={stackTrace ?? error.info.fullError}
          resize="vertical"
          rows={10}
          style={{ height: "fit-content", marginTop: "0.5rem", width: "100%" }}
        />
      </details>
      <VSCodeDivider />
      {error.info.tips ? <TipList tips={error.info.tips} /> : null}
      <VSCodeDivider />
      <h2>Additional resources</h2>
      <ul>
        <li>
          <a href="https://github.com/zowe/zowe-explorer-vscode/">GitHub</a>
        </li>
        <li>
          <a href="https://openmainframeproject.slack.com/">Slack: Open Mainframe Project</a>
        </li>
        <br />
        <li>
          <a href="https://docs.zowe.org">Zowe Docs</a>
        </li>
        <ul>
          <li>
            <a href="https://docs.zowe.org/stable/troubleshoot/ze/troubleshoot-ze/#connection-issues-with-zowe-explorer">
              Troubleshooting: Connection issues with Zowe Explorer
            </a>
          </li>
        </ul>
      </ul>
    </div>
  );
};
