import { useEffect, useState } from "preact/hooks";
import { VSCodePanelView, VSCodeDataGrid } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentUtilitiesBar from "../PersistentUtils/PersistentUtilitiesBar";
import PersistentTableData from "./PersistentTableData";
import PersistentDataGridHeaders from "./PersistentDataGridHeaders";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentDataPanel({
  data,
  type,
}: {
  data: { [type: string]: { [property: string]: string[] } };
  type: string;
}): JSXInternal.Element {
  const panelId: { [key: string]: string } = {
    ds: "ds-panel-view",
    uss: "uss-panel-view",
    jobs: "jobs-panel-view",
  };

  const [selection, setSelection] = useState<{ selection: string }>({ selection: "search" });
  const [persistentProp, setPersistentProp] = useState<string[]>([]);

  const handleChange = (newSelection: string) => {
    setSelection(() => ({ selection: newSelection }));
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "update-selection",
      attrs: {
        selection: newSelection,
      },
    });
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const eventUrl = new URL(event.origin);
      const isWebUser =
        (eventUrl.protocol === document.location.protocol && eventUrl.hostname === document.location.hostname) ||
        eventUrl.hostname.endsWith(".github.dev");
      const isLocalVSCodeUser = eventUrl.protocol === "vscode-webview:";

      if (!isWebUser && !isLocalVSCodeUser) {
        return;
      }

      if ("selection" in event.data) {
        setSelection(() => ({
          selection: event.data.selection,
        }));
      }
    });
  }, []);

  useEffect(() => {
    setPersistentProp(() => data[type][selection.selection]);
  }, [data]);

  useEffect(() => {
    setPersistentProp(() => data[type][selection.selection]);
  }, [selection]);

  return (
    <VSCodePanelView id={panelId[type]} style={{ flexDirection: "column" }}>
      <PersistentUtilitiesBar type={type} handleChange={handleChange} selection={selection} />
      <VSCodeDataGrid>
        <PersistentDataGridHeaders />
        <PersistentTableData type={type} persistentProp={persistentProp} selection={selection} />
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}
