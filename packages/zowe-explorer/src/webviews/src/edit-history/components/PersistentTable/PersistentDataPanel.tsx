import { useEffect, useState } from "preact/hooks";
import { VSCodePanelView, VSCodeDataGrid } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentToolBar from "../PersistentToolBar/PersistentToolBar";
import PersistentTableData from "./PersistentTableData";
import PersistentDataGridHeaders from "./PersistentDataGridHeaders";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { isSecureOrigin } from "../PersistentUtils";

export default function PersistentDataPanel({ type }: { type: string }): JSXInternal.Element {
  const panelId: { [key: string]: string } = {
    ds: "ds-panel-view",
    uss: "uss-panel-view",
    jobs: "jobs-panel-view",
  };

  const [data, setData] = useState<{ [type: string]: { [property: string]: string[] } }>({ ds: {}, uss: {}, jobs: {} });
  const [selection, setSelection] = useState<{ [type: string]: string }>({ [type]: "search" });
  const [persistentProp, setPersistentProp] = useState<string[]>([]);

  const handleChange = (newSelection: string) => {
    setSelection(() => ({ [type]: newSelection }));
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "update-selection",
      attrs: {
        selection: newSelection,
        type,
      },
    });
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      setData(event.data);

      if ("selection" in event.data) {
        setSelection(() => ({
          [type]: event.data.selection[type],
        }));
      }
    });
  }, []);

  useEffect(() => {
    setPersistentProp(() => data[type][selection[type]]);
  }, [data]);

  useEffect(() => {
    setPersistentProp(() => data[type][selection[type]]);
  }, [selection]);

  return (
    <VSCodePanelView id={panelId[type]} style={{ flexDirection: "column" }}>
      <PersistentToolBar type={type} handleChange={handleChange} selection={selection} />
      <VSCodeDataGrid>
        <PersistentDataGridHeaders selection={selection} type={type} />
        <PersistentTableData type={type} persistentProp={persistentProp} selection={selection} />
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}
