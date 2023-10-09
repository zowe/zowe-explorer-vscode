import { VSCodeDataGridRow, VSCodeDataGridCell } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";

export default function PersistentDataGridHeaders(): JSXInternal.Element {
  return (
    <VSCodeDataGridRow row-type="header">
      <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
        Item
      </VSCodeDataGridCell>
      <VSCodeDataGridCell cell-type="columnheader" grid-column="2" style={{ maxWidth: "5vw", textAlign: "center" }}>
        Delete
      </VSCodeDataGridCell>
    </VSCodeDataGridRow>
  );
}
