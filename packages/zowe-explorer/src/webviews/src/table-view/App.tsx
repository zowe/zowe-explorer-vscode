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

import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme
import { AgGridReact } from "ag-grid-react";
import { useEffect, useState } from "preact/hooks";
import { isSecureOrigin } from "../utils";
import type { Table } from "@zowe/zowe-explorer-api";
import { tableProps, tableStyle } from "./types";

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

  useEffect(() => {
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
  }, []);

  return (
    <>
      {tableData.title ? <h1>{tableData.title}</h1> : null}
      <div className="ag-theme-quartz-dark" style={tableStyle}>
        <AgGridReact {...tableProps(tableData)} />
      </div>
    </>
  );
}
