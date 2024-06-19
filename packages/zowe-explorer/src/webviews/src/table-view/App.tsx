/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

// Required CSS for AG Grid
import "ag-grid-community/styles/ag-grid.css";
// AG Grid Quartz Theme (used as base theme)
import "ag-grid-community/styles/ag-theme-quartz.css";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useState } from "preact/hooks";
import { getVsCodeTheme, isSecureOrigin, useMutableObserver } from "../utils";
import type { Table } from "@zowe/zowe-explorer-api";
import { tableProps } from "./types";
// Custom styling (font family, VS Code color scheme, etc.)
import "./style.css";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [tableData, setTableData] = useState<Table.Data>({
    actions: {
      column: new Map(),
      row: new Map(),
    },
    columns: null,
    rows: null,
    title: "",
  });
  const [baseTheme, setBaseTheme] = useState<string>("ag-theme-quartz");

  useEffect(() => {
    // Apply the dark version of the AG Grid theme if the user is using a dark or high-contrast theme in VS Code.
    const userTheme = getVsCodeTheme();
    if (userTheme !== "vscode-light") {
      setBaseTheme("ag-theme-quartz-dark");
    }

    // Set up event listener to handle data changes being sent to the webview.
    window.addEventListener("message", (event: any): void => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!("data" in event)) {
        return;
      }

      const eventInfo = event.data;
      switch (eventInfo.command) {
        case "ondatachanged":
          const tableData: Table.Data = eventInfo.data;
          if (tableData.actions && tableData.actions.row) {
            // Add an extra column to the end of the table
            const rows = tableData.rows?.map((row) => {
              return { ...row, actions: "" };
            });
            const columns = [
              ...(tableData.columns ?? []),
              {
                field: "actions",
                sortable: false,
                cellRenderer: (_params: any) => {
                  return <b>custom cell renderer</b>;
                },
              },
            ];
            setTableData({ ...tableData, rows, columns });
          } else {
            setTableData(eventInfo.data);
          }
          break;
        default:
          break;
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
      setBaseTheme(themeAttr === "vscode-light" ? "ag-theme-quartz" : "ag-theme-quartz-dark");
    },
    { attributes: true }
  );

  return (
    <>
      {tableData.title ? <h1>{tableData.title}</h1> : null}
      <div className={`${baseTheme} ag-theme-vsc`}>
        <AgGridReact {...tableProps(tableData)} />
      </div>
    </>
  );
}
