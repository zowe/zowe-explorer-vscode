import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import * as nls from "@vscode/l10n";

export default function PersistentDeleteSelectedButton(): JSXInternal.Element {
  const deleteSelectedText = nls.t("Delete Selected");
  const { selection, type, selectedItems } = useDataPanelContext();

  const handleClick = async () => {
    const hasSelectedItems = Object.keys(selectedItems.val).find((item) => selectedItems.val[item] === true);
    if (!hasSelectedItems) {
      PersistentVSCodeAPI.getVSCodeAPI().postMessage({
        command: "show-error",
        attrs: {
          errorMsg: nls.t("Select an item before deleting"),
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
    const selectionType = ["search", "fileHistory", "encodingHistory"];
    return selectionType.includes(selection[type]) ? (
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
