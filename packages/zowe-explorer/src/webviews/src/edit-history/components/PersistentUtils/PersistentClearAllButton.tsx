import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentClearAllButton({ type, selection }: { type: string; selection: { selection: string } }): JSXInternal.Element {
  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "clear-all",
      attrs: {
        type,
        selection: selection.selection,
      },
    });
  };

  return (
    <VSCodeButton style={{ maxWidth: "20vw" }} onClick={handleClick}>
      Clear All
    </VSCodeButton>
  );
}
