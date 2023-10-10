import { VSCodeDataGridRow, VSCodeDataGridCell } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";

export default function PersistentDataGridHeaders({ selection }: { selection: { selection: string } }): JSXInternal.Element {
  const renderDeleteHeader = () => {
    return selection.selection === "search" || selection.selection === "fileHistory" ? (
      <VSCodeDataGridCell cell-type="columnheader" grid-column="2" style={{ maxWidth: "20vw", textAlign: "center" }}>
        Delete
      </VSCodeDataGridCell>
    ) : null;
  };

  return (
    <VSCodeDataGridRow row-type="header">
      <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
        Item
      </VSCodeDataGridCell>
      {renderDeleteHeader()}
    </VSCodeDataGridRow>
  );
}
