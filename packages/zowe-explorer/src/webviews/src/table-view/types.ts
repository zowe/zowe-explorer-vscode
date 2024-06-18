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

import type { Table } from "@zowe/zowe-explorer-api";
import { AgGridReactProps } from "ag-grid-react";

const tableColors = {
    "--ag-icon-font-family": "agGridQuartz",
    "--ag-row-hover-color": "var(--vscode-list-hoverBackground)",
    "--ag-range-selection-background-color": "var(--vscode-list-activeSelectionBackground)",
    "--ag-range-selection-highlight-color": "var(--vscode-list-activeSelectionForeground)",
    "--ag-background-color": "var(--vscode-editor-background)",
    "--ag-control-panel-background-color": "var(--vscode-editorWidget-background)",
    "--ag-border-color": "var(--vscode-editorWidget-border)",
    "--ag-header-background-color": "var(--vscode-keybindingTable-headerBackground)",
    "--ag-range-selection-border-color": "var(--vscode-tab-activeForeground)",
    "--ag-foreground-color": "var(--vscode-foreground)",
    "--ag-selected-row-background-color": "var(--vscode-notebook-selectedCellBackground)",
};

export const tableStyle = {
    height: 500,
    marginTop: "1em",
    ...tableColors,
};

export const tableProps = (tableData: Table.Data): Partial<AgGridReactProps> => ({
    enableCellTextSelection: true,
    ensureDomOrder: true,
    rowData: tableData.rows,
    columnDefs: tableData.columns,
    pagination: true,
});
