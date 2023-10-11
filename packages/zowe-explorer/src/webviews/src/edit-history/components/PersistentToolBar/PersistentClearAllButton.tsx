import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentClearAllButton({ type, selection }: { type: string; selection: { [type: string]: string } }): JSXInternal.Element {
  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "clear-all",
      attrs: {
        type,
        selection: selection[type],
      },
    });
  };

  return (
    <VSCodeButton title="Clear all" appearance="secondary" style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
      <img src="./webviews/src/edit-history/assets/clear-all.svg" />
    </VSCodeButton>
  );
}
