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
  const [currentTab, setCurrentTab] = useState("");

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if ("tab" in event.data) {
        setCurrentTab(event.data.tab);
      }
    });
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <h1>Manage Persistent Properties</h1>
      <VSCodePanels activeid={currentTab}>
        <VSCodePanelTab id="ds-panel-tab">
          <h2>Data Sets</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="uss-panel-tab">
          <h2>Unix System Services (USS)</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="jobs-panel-tab">
          <h2>Jobs</h2>
        </VSCodePanelTab>
        <DsPanel />
        <USSPanel />
        <JobsPanel />
      </VSCodePanels>
    </div>
  );
}

function UtilitiesBar({ type }: { type: string }): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <DropdownPersistentOptions />
      <AddNewHistoryItemButton type={type} />
      <RefreshButton type={type} />
      <ClearAllButton type={type} />
    </div>
  );
}

function DropdownPersistentOptions(): JSXInternal.Element {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }}>
        <VSCodeOption>DS Templates</VSCodeOption>
        <VSCodeOption>Favorites</VSCodeOption>
        <VSCodeOption>File History</VSCodeOption>
        <VSCodeOption>Search History</VSCodeOption>
        <VSCodeOption>Sessions</VSCodeOption>
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

function TableData({ type }: { type: string }): JSXInternal.Element {
  const [persistentProperty, setPersistentProperty] = useState([]);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (type in event.data) {
        setPersistentProperty(event.data[type]["search"]);
      }
    });
  }, []);

  const handleClick = (item: number) => {
    vscodeApi.postMessage({
      command: "remove-item",
      attrs: {
        name: persistentProperty[item],
        type,
      },
    });
  };

  const data = persistentProperty.map((item, i) => {
    return (
      <VSCodeDataGridRow>
        <VSCodeDataGridCell grid-column="1">{item}</VSCodeDataGridCell>
        <VSCodeDataGridCell grid-column="2" onClick={() => handleClick(i)} style={{ maxWidth: "5vw", textAlign: "center" }}>
          <img src="./webviews/src/edit-history/assets/trash.svg" />
        </VSCodeDataGridCell>
      </VSCodeDataGridRow>
    );
  });

  return <>{data}</>;
}

function DsPanel(): JSXInternal.Element {
  const type = "ds";
  return (
    <VSCodePanelView id="ds-panel-view" style={{ flexDirection: "column" }}>
      <UtilitiesBar type={type} />
      <VSCodeDataGrid>
        <DataGridHeaders />
        <TableData type={type}></TableData>
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}

function USSPanel(): JSXInternal.Element {
  const type = "uss";

  return (
    <VSCodePanelView id="uss-panel-view" style={{ flexDirection: "column" }}>
      <UtilitiesBar type={type} />
      <VSCodeDataGrid>
        <DataGridHeaders />
        <TableData type={type}></TableData>
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}

function JobsPanel(): JSXInternal.Element {
  const type = "jobs";

  return (
    <VSCodePanelView id="jobs-panel-view" style={{ flexDirection: "column" }}>
      <UtilitiesBar type={type} />
      <VSCodeDataGrid>
        <DataGridHeaders />
        <TableData type={type}></TableData>
      </VSCodeDataGrid>
    </VSCodePanelView>
  );
}
