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
import { JSXInternal } from "preact/src/jsx";

export type ContextMenuState = {
    open: boolean;
    callback: (event: any) => void;
    component: JSXInternal.Element | null;
};

export const wrapFn = (s: string) => `{ return ${s} };`;

type AgGridThemes = "ag-theme-quartz" | "ag-theme-balham" | "ag-theme-material" | "ag-theme-alpine";
export type TableViewProps = {
    actionsCellRenderer?: (params: any) => JSXInternal.Element;
    baseTheme?: AgGridThemes | string;
    data?: Table.ViewOpts;
};

// Define props for the AG Grid table here
export const tableProps = (contextMenu: ContextMenuState, tableData: Table.ViewOpts, vscodeApi: any): Partial<AgGridReactProps> => ({
    // domLayout: "autoHeight",
    enableCellTextSelection: true,
    ensureDomOrder: true,
    rowData: tableData.rows,
    columnDefs: tableData.columns?.map((col) => ({
        ...col,
        comparator: col.comparator ? new Function(wrapFn(col.comparator)).call(null) : undefined,
        colSpan: col.colSpan ? new Function(wrapFn(col.colSpan)).call(null) : undefined,
        rowSpan: col.rowSpan ? new Function(wrapFn(col.rowSpan)).call(null) : undefined,
        valueFormatter: col.valueFormatter ? new Function(wrapFn(col.valueFormatter)).call(null) : undefined,
    })),
    onCellContextMenu: contextMenu.callback,
    onCellValueChanged: tableData.columns?.some((col) => col.editable)
        ? (event) => {
              vscodeApi.postMessage({
                  command: "ontableedit",
                  data: {
                      rowIndex: event.rowIndex,
                      field: event.colDef.field,
                      value: event.value,
                      oldValue: event.oldValue,
                  },
              });
          }
        : undefined,
    onFilterChanged: (event) => {
        const rows: Table.RowData[] = [];
        event.api.forEachNodeAfterFilterAndSort((row, _i) => rows.push(row.data));
        vscodeApi.postMessage({ command: "ondisplaychanged", data: rows });
    },
    onSortChanged: (event) => {
        const rows: Table.RowData[] = [];
        event.api.forEachNodeAfterFilterAndSort((row, _i) => rows.push(row.data));
        vscodeApi.postMessage({ command: "ondisplaychanged", data: rows });
    },
    ...(tableData.options ?? {}),
});