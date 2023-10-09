import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "./PersistentVSCodeAPI";

export default function PersistentAddNewHistoryItemButton({ type }: { type: string }): JSXInternal.Element {
  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "add-item",
      attrs: {
        type,
      },
    });
  };

  return (
    <VSCodeButton style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
      Add Item
    </VSCodeButton>
  );
}
