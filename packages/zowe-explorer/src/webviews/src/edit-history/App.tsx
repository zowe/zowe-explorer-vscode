import { useEffect, useState } from "preact/hooks";
import {
  VSCodeProgressRing,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
  VSCodeDataGridRow,
  VSCodeDataGridCell,
  VSCodeDataGrid,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeButton,
} from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";

const vscodeApi = acquireVsCodeApi();

export function App(): JSXInternal.Element {
  return (
    <div>
      <View />
    </div>
  );
}

function View(): JSXInternal.Element {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return loading ? <VSCodeProgressRing>Loading</VSCodeProgressRing> : <Body />;
}

function Body(): JSXInternal.Element {
  const [currentTab, setCurrentTab] = useState<{ [key: string]: string }>({});
  const [data, setData] = useState<{ [type: string]: { [property: string]: string[] } }>({ ds: {}, uss: {}, jobs: {} });
  useEffect(() => {
    window.addEventListener("message", (event) => {
      setData(event.data);
      if ("tab" in event.data) {
        setCurrentTab(() => ({
          tab: event.data.tab,
        }));
      }
    });
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <h1>Manage Persistent Properties</h1>
      <VSCodePanels activeid={currentTab.tab}>
        <VSCodePanelTab id="ds-panel-tab">
          <h2>Data Sets</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="uss-panel-tab">
          <h2>Unix System Services (USS)</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="jobs-panel-tab">
          <h2>Jobs</h2>
        </VSCodePanelTab>
        <PersistentDataPanel data={data} type="ds" />
        <PersistentDataPanel data={data} type="uss" />
        <PersistentDataPanel data={data} type="jobs" />
      </VSCodePanels>
    </div>
  );
}

function UtilitiesBar({ type, handleChange }: { type: string; handleChange: Function }): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <DropdownPersistentOptions handleChange={handleChange} />
      <AddNewHistoryItemButton type={type} />
      <RefreshButton type={type} />
      <ClearAllButton type={type} />
    </div>
  );
}

function DropdownPersistentOptions({ handleChange }: { handleChange: Function }): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }} onChange={(event: any) => handleChange(event.target.value)}>
        <VSCodeOption value="search">Search History</VSCodeOption>
        <VSCodeOption value="dsTemplates">DS Templates</VSCodeOption>
        <VSCodeOption value="favorites">Favorites</VSCodeOption>
        <VSCodeOption value="fileHistory">File History</VSCodeOption>
        <VSCodeOption value="sessions">Sessions</VSCodeOption>
      </VSCodeDropdown>
    </div>
  );
}

function AddNewHistoryItemButton({ type }: { type: string }): JSXInternal.Element {
  const handleClick = () => {
    vscodeApi.postMessage({
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

function RefreshButton({ type }: { type: string }): JSXInternal.Element {
  const handleClick = () => {
    vscodeApi.postMessage({
      command: "refresh",
      attrs: {
        type,
      },
    });
  };

  return (
    <VSCodeButton style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
      Refresh
    </VSCodeButton>
  );
}

function ClearAllButton({ type }: { type: string }): JSXInternal.Element {
  const handleClick = () => {
    vscodeApi.postMessage({
      command: "clear-all",
      attrs: {
        type,
      },
    });
  };

  return (
    <VSCodeButton style={{ maxWidth: "20vw" }} onClick={handleClick}>
      Clear All
    </VSCodeButton>
  );
}

function DataGridHeaders(): JSXInternal.Element {
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

function TableData({
  type,
  persistentProp,
  selection,
}: {
  type: string;
  persistentProp: string[];
  selection: { selection: string };
}): JSXInternal.Element {
  const handleClick = (item: number) => {
    vscodeApi.postMessage({
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

function PersistentDataPanel({ data, type }: { data: { [type: string]: { [property: string]: string[] } }; type: string }): JSXInternal.Element {
  const panelId: { [key: string]: string } = {
    ds: "ds-panel-view",
    uss: "uss-panel-view",
    jobs: "jobs-panel-view",
  };

  const [selection, setSelection] = useState<{ selection: string }>({ selection: "search" });
  const [persistentProp, setPersistentProp] = useState<string[]>([]);

  const handleChange = (newSelection: string) => {
    setSelection(() => ({ selection: newSelection }));
    vscodeApi.postMessage({
      command: "update-selection",
      attrs: {
        selection: newSelection,
      },
    });
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
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
      <UtilitiesBar type={type} handleChange={handleChange} />
      <VSCodeDataGrid>
        <DataGridHeaders />
        <TableData type={type} persistentProp={persistentProp} selection={selection}></TableData>
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}
