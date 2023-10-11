import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentAddNewHistoryItemButton({
  type,
  selection,
}: {
  type: string;
  selection: { [type: string]: string };
}): JSXInternal.Element {
  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "add-item",
      attrs: {
        type,
      },
    });
  };

  const renderAddItemButton = () => {
    return selection[type] === "search" && type !== "jobs" ? (
      <VSCodeButton title="Add new history item" appearance="secondary" style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
        <img src="./webviews/src/edit-history/assets/plus.svg" style={{ height: "16px", width: "16px" }} />
      </VSCodeButton>
    ) : null;
  };

  return <>{renderAddItemButton()}</>;
}
