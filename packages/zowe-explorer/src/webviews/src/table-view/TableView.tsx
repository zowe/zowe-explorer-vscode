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
import { CheckboxSelectionCallbackParams, HeaderCheckboxSelectionCallbackParams } from "ag-grid-community";
import { GetLocaleTextParams } from "ag-grid-community";
import * as l10n from "@vscode/l10n";

const vscodeApi = acquireVsCodeApi();

function isFirstColumn(params: CheckboxSelectionCallbackParams | HeaderCheckboxSelectionCallbackParams) {
  const displayedColumns = params.api.getAllDisplayedColumns();
  const thisIsFirstColumn = displayedColumns[0] === params.column;
  return thisIsFirstColumn;
}

export const TableView = ({ actionsCellRenderer, baseTheme, data }: TableViewProps) => {
  const [localization, setLocalizationContents] = useState<{ [key: string]: string }>({});
  const [tableData, setTableData] = useState<Table.ViewOpts | undefined>(data);
  const [theme, setTheme] = useState<string>(baseTheme ?? "ag-theme-quartz");
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const gridRef = useRef<any>();
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

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

      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        setLocalizationContents(contents);
        l10n.config({
          contents: contents,
        });
      }

      const response = event.data;
      if (response.command === "ondatachanged") {
        // Update received from a VS Code extender; update table state
        const newData: Table.ViewOpts = response.data;
        if (newData.options?.selectEverything) {
          (newData.options as any).defaultColDef = {
            headerCheckboxSelection: isFirstColumn,
            checkboxSelection: isFirstColumn,
          };
        }
        if (Object.keys(newData.actions).length > 1 || newData.actions.all?.length > 0) {
          // Add an extra column to the end of each row if row actions are present
          const rows = newData.rows?.map((row: Table.RowData) => {
            return { ...row, actions: "" };
          });
          const columns = [...(newData.columns ?? []), actionsColumn(newData, actionsCellRenderer, vscodeApi)];
          setVisibleColumns(columns.map((c) => c.headerName ?? c.field));
          setTableData({ ...newData, rows, columns });
        } else {
          setVisibleColumns(newData.columns.map((c) => c.headerName ?? c.field));
          setTableData(newData);
        }
      }
    });

    // Once the listener is in place, send a "ready signal" to the TableView instance to handle new data.
    vscodeApi.postMessage({ command: "ready" });
    vscodeApi.postMessage({ command: "GET_LOCALIZATION" });
  }, [localization]);

  const localizationMap = [
    { key: "Page Size:", localized: l10n.t("Page Size:") },
    { key: "Page", localized: l10n.t("Page") },
  ];

  // Observe attributes of the `body` element to detect VS Code theme changes.
  useMutableObserver(
    document.body,
    (_mutations, _observer) => {
      const themeAttr = getVsCodeTheme();
      setTheme(themeAttr === "vscode-light" ? "ag-theme-quartz" : "ag-theme-quartz-dark");
    },
    { attributes: true }
  );

  let getLocaleText = (params: GetLocaleTextParams<any, any>): string => {
    switch (params.key) {
      case "thousandSeparator":
        return ".";
      case "decimalSeparator":
        return ",";
      default:
        if (params.defaultValue) {
          const localizedObj = localizationMap.find((item) => item.key === params.defaultValue);
          const localizedVal = localizedObj ? localizedObj.localized : params.defaultValue;
          return localizedVal;
        }
        return "";
    }
  };

  return (
    <div className={`table-view ${theme} ag-theme-vsc ${contextMenu.open ? "ctx-menu-open" : ""}`}>
      {contextMenu.component}
      <ActionsBar
        actions={tableData?.actions.all ?? []}
        columns={tableData?.columns?.map((c) => c.headerName ?? c.field) ?? []}
        gridRef={gridRef}
        itemCount={tableData?.rows?.length ?? 0}
        title={tableData?.title ?? ""}
        selectionCount={selectionCount}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        vscodeApi={vscodeApi}
      />
      {tableData ? (
        <AgGridReact {...tableProps(contextMenu, setSelectionCount, tableData, vscodeApi)} ref={gridRef} getLocaleText={getLocaleText} />
      ) : null}
    </div>
  );
};
