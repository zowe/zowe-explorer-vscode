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
import { AgGridReact, AgGridReactProps } from "ag-grid-react";
import { useEffect, useState } from "preact/hooks";
import { isSecureOrigin } from "../utils";

export function App() {
  const [rowData, _setRowData] = useState([
    { make: "Tesla", model: "Model Y", price: 64950, electric: true },
    { make: "Ford", model: "F-Series", price: 33850, electric: false },
    { make: "Toyota", model: "Corolla", price: 29600, electric: false },
  ]);

  // Column Definitions: Defines the columns to be displayed.
  const [colDefs, _setColDefs] = useState<Exclude<AgGridReactProps["gridOptions"], undefined>["columnDefs"]>([
    { field: "make" },
    { field: "model" },
    { field: "price" },
    { field: "electric" },
  ]);

  useEffect(() => {
    window.addEventListener("message", (event): void => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
    });
  }, []);

  return (
    // wrapping container with theme & size
    <div
      className="ag-theme-quartz-dark" // applying the grid theme
      style={{ height: 500, "--ag-background-color": "--vscode-editor-background", "--ag-icon-font-family": "agGridQuartz" }} // the grid will fill the size of the parent container
    >
      <AgGridReact rowData={rowData} columnDefs={colDefs} />
    </div>
  );
}
