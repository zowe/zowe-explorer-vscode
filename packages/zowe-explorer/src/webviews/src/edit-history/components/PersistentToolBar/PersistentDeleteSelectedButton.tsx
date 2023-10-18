import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import * as nls from "vscode-nls";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { useDataPanelContext } from "../PersistentUtils";

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export default function PersistentDeleteSelectedButton(): JSXInternal.Element {
  const deleteSelectedText = localize("PersistentDeleteSelectedButton.deleteSelected", "Delete Selected");
  const { selection, type, selectedItems } = useDataPanelContext();

  const handleClick = async () => {
    const hasSelectedItems = Object.keys(selectedItems.val).find((item) => selectedItems.val[item] === true);
    if (!hasSelectedItems) {
      PersistentVSCodeAPI.getVSCodeAPI().postMessage({
        command: "show-error",
        attrs: {
          errorMsg: localize("PersistentDeleteSelectedButton.handleClick.error", "Select an item before deleting"),
        },
      });
      return;
    }

    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "remove-item",
      attrs: {
        selectedItems: selectedItems.val,
        selection: selection[type],
        type,
      },
    });

    const newSelectedItems: { [key: string]: boolean } = { ...selectedItems.val };
    Object.keys(newSelectedItems).forEach((item) => {
      newSelectedItems[item] = false;
    });
    selectedItems.setVal(newSelectedItems);
  };

  const renderDeleteSelectedButton = () => {
    return selection[type] === "search" || selection[type] === "fileHistory" ? (
      <VSCodeButton
        title={deleteSelectedText}
        appearance="secondary"
        style={{ maxWidth: "20vw", marginRight: "15px" }}
        onClick={async () => await handleClick()}
      >
        Delete
      </VSCodeButton>
    ) : null;
  };

  return <>{renderDeleteSelectedButton()}</>;
}
