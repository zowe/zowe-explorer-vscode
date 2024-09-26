import { VSCodeDivider, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";
import { NetworkError } from "@zowe/zowe-explorer-api";

export type ErrorInfoProps = {
  error: NetworkError;
};

export const isNetworkErrorInfo = (val: any): val is ErrorInfoProps => {
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

export const ErrorInfo = ({ error }: ErrorInfoProps) => {
  return (
    <div>
      {error.info.summary}
      <VSCodeTextArea value={error.info?.fullError}>Error Details</VSCodeTextArea>
      <VSCodeDivider />
      {error.info.tips ? <TipList tips={error.info.tips} /> : null}
    </div>
  );
};
