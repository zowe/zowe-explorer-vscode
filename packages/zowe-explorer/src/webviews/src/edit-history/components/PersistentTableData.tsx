import { VSCodeDataGridCell, VSCodeDataGridRow } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentVSCodeAPI from "./PersistentVSCodeAPI";

export default function PersistentTableData({
  type,
  persistentProp,
  selection,
}: {
  type: string;
  persistentProp: string[];
  selection: { selection: string };
}): JSXInternal.Element {
  const handleClick = (item: number) => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "remove-item",
      attrs: {
        name: persistentProp[item],
        type,
        selection: selection.selection,
      },
    });
  };

  const data =
    persistentProp && persistentProp.length ? (
      persistentProp.map((item, i) => {
        return (
          <VSCodeDataGridRow>
            <VSCodeDataGridCell grid-column="1">{item}</VSCodeDataGridCell>
            <VSCodeDataGridCell grid-column="2" onClick={() => handleClick(i)} style={{ maxWidth: "5vw", textAlign: "center" }}>
              <img src="./webviews/src/edit-history/assets/trash.svg" />
            </VSCodeDataGridCell>
          </VSCodeDataGridRow>
        );
      })
    ) : (
      <VSCodeDataGridRow>
        <VSCodeDataGridCell grid-column="1">No records found</VSCodeDataGridCell>
        <VSCodeDataGridCell grid-column="2" style={{ maxWidth: "5vw", textAlign: "center" }}></VSCodeDataGridCell>
      </VSCodeDataGridRow>
    );

  return <>{data}</>;
}
