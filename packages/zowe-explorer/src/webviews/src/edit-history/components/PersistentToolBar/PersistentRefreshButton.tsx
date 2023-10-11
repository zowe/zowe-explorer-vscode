import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentRefreshButton({ type }: { type: string }): JSXInternal.Element {
  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "refresh",
      attrs: {
        type,
      },
    });
  };

  return (
    <VSCodeButton title="Refresh" appearance="primary" style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
      <img src="./webviews/src/edit-history/assets/refresh.svg" />
    </VSCodeButton>
  );
}
