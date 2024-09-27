import { VSCodeDivider, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";
import { NetworkError } from "@zowe/zowe-explorer-api";

export type ErrorInfoProps = {
  error: NetworkError;
  stackTrace?: string;
};

export const isNetworkError = (val: any): val is NetworkError => {
  return val?.["info"] != null && val.info["summary"] != null;
};

const TipList = ({ tips }: { tips: string[] }) => {
  return (
    <div>
      <h2>Tips</h2>
      <ul>
        {tips.map((tip) => (
          <li>{tip}</li>
        ))}
      </ul>
    </div>
  );
};

export const ErrorInfo = ({ error, stackTrace }: ErrorInfoProps) => {
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
      <VSCodeTextArea value={stackTrace ?? error.info.fullError} resize="vertical" rows={10} style={{ height: "fit-content", width: "100%" }}>
        Full error message
      </VSCodeTextArea>
      <VSCodeDivider />
      {error.info.tips ? <TipList tips={error.info.tips} /> : null}
      <VSCodeDivider />
      <h2>Additional resources</h2>
      <ul>
        <li>
          <a href="https://openmainframeproject.slack.com/">Open Mainframe Project Slack</a>
        </li>
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
