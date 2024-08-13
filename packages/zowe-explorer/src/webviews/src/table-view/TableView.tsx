// Required CSS for AG Grid
import "ag-grid-community/styles/ag-grid.css";
// AG Grid Quartz Theme (used as base theme)
import "ag-grid-community/styles/ag-theme-quartz.css";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useRef, useState } from "preact/hooks";
import { getVsCodeTheme, isSecureOrigin, useMutableObserver } from "../utils";
import type { Table } from "@zowe/zowe-explorer-api";
import { TableViewProps, tableProps } from "./types";
import { useContextMenu } from "./ContextMenu";
// Custom styling (font family, VS Code color scheme, etc.)
import "./style.css";
import { ActionsBar } from "./ActionsBar";
import { actionsColumn } from "./actionsColumn";

const vscodeApi = acquireVsCodeApi();

export const TableView = ({ actionsCellRenderer, baseTheme, data }: TableViewProps) => {
  const [tableData, setTableData] = useState<Table.ViewOpts | undefined>(data);
  const [theme, setTheme] = useState<string>(baseTheme ?? "ag-theme-quartz");
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const gridRef = useRef<any>();

  const contextMenu = useContextMenu({
    options: [
      {
        title: "Copy cell",
        command: "copy-cell",
        callback: {
          typ: "cell",
          fn: () => {},
        },
      },
      {
        title: "Copy row",
        command: "copy",
        callback: {
          typ: "single-row",
          fn: () => {},
        },
      },
      ...(tableData?.contextOpts?.all ?? []),
    ],
    selectRow: true,
    selectedRows: [],
    clickedRow: undefined as any,
    colDef: undefined as any,
    vscodeApi,
  });

  useEffect(() => {
    // Apply the dark version of the AG Grid theme if the user is using a dark or high-contrast theme in VS Code.
    const userTheme = getVsCodeTheme();
    if (userTheme !== "vscode-light") {
      setTheme("ag-theme-quartz-dark");
    }

    // Disable the event listener for the context menu in the active iframe to prevent VS Code from showing its right-click menu.
    window.addEventListener("contextmenu", (e) => e.preventDefault(), true);

    // Set up event listener to handle data changes being sent to the webview.
    window.addEventListener("message", (event: any): void => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!("data" in event)) {
        return;
      }

      const response = event.data;
      if (response.command === "ondatachanged") {
        // Update received from a VS Code extender; update table state
        const newData: Table.ViewOpts = response.data;
        if (Object.keys(newData.actions).length > 1 || newData.actions.all?.length > 0) {
          // Add an extra column to the end of each row if row actions are present
          const rows = newData.rows?.map((row: Table.RowData) => {
            return { ...row, actions: "" };
          });
          const columns = [...(newData.columns ?? []), actionsColumn(newData, actionsCellRenderer, vscodeApi)];
          setTableData({ ...newData, rows, columns });
        } else {
          setTableData(newData);
        }
      }
    });

    // Once the listener is in place, send a "ready signal" to the TableView instance to handle new data.
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  // Observe attributes of the `body` element to detect VS Code theme changes.
  useMutableObserver(
    document.body,
    (_mutations, _observer) => {
      const themeAttr = getVsCodeTheme();
      setTheme(themeAttr === "vscode-light" ? "ag-theme-quartz" : "ag-theme-quartz-dark");
    },
    { attributes: true }
  );

  return (
    <>
      <div className={`${theme} ag-theme-vsc ${contextMenu.open ? "ctx-menu-open" : ""}`}>
        {contextMenu.component}
        <ActionsBar
          actions={tableData?.actions.all ?? []}
          gridRef={gridRef}
          itemCount={tableData?.rows?.length ?? 0}
          title={tableData?.title ?? ""}
          selectionCount={selectionCount}
          vscodeApi={vscodeApi}
        />
        {tableData ? <AgGridReact {...tableProps(contextMenu, setSelectionCount, tableData, vscodeApi)} ref={gridRef} /> : null}
      </div>
    </>
  );
};
