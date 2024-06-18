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
import { isSecureOrigin } from "../utils";
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
    const userTheme = document.body.getAttribute("data-vscode-theme-kind");
    if (userTheme === "vscode-dark") {
      setBaseTheme("ag-theme-quartz-dark");
    }
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
          setTableData(eventInfo.data);
          break;
        default:
          break;
      }
    });
    vscodeApi.postMessage({ command: "ready" });

    const mutationObserver = new MutationObserver((_mutations, _observer) => {
      const themeAttr = document.body.getAttribute("data-vscode-theme-kind");
      setBaseTheme(themeAttr === "vscode-dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz");
    });
    mutationObserver.observe(document.body, { attributes: true });
  }, []);

  return (
    <>
      {tableData.title ? <h1>{tableData.title}</h1> : null}
      <div className={`${baseTheme} ag-theme-vsc`}>
        <AgGridReact {...tableProps(tableData)} />
      </div>
    </>
  );
}
