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
import { messageHandler } from "../MessageHandler";

export type ContextMenuState = {
    open: boolean;
    callback: (event: any) => void;
    component: JSXInternal.Element | null;
};

export const wrapFn = (s: string) => `{ return ${s} };`;

type AgGridThemes = "ag-theme-quartz" | "ag-theme-balham" | "ag-theme-material" | "ag-theme-alpine";
export type TableViewProps = {
    actionsCellRenderer?: (params: any) => JSXInternal.Element;
    baseTheme?: AgGridThemes;
    data?: Table.ViewOpts;
};

// Define props for the AG Grid table here
export const tableProps = (
    contextMenu: ContextMenuState,
    setSelectionCount: React.Dispatch<number>,
    tableData: Table.ViewOpts
): Partial<AgGridReactProps> => ({
    enableCellTextSelection: true,
    ensureDomOrder: true,
    rowData: tableData.rows,
    columnDefs: tableData.columns?.map((col) => ({
        sortable: true,
        sortingOrder: ["asc", "desc", null],
        ...col,
        comparator: col.comparator ? new Function(wrapFn(col.comparator))() : undefined,
        colSpan: col.colSpan ? new Function(wrapFn(col.colSpan))() : undefined,
        rowSpan: col.rowSpan ? new Function(wrapFn(col.rowSpan))() : undefined,
        valueFormatter: col.valueFormatter ? new Function(wrapFn(col.valueFormatter))() : undefined,
    })),
    onCellContextMenu: contextMenu.callback,
    onCellValueChanged: tableData.columns?.some((col) => col.editable)
        ? (event) => {
              messageHandler.send("ontableedit", {
                  rowIndex: event.rowIndex,
                  field: event.colDef.field,
                  value: event.value,
                  oldValue: event.oldValue,
              });
          }
        : undefined,
    onFilterChanged: (event) => {
        const rows: Table.RowData[] = [];
        event.api.forEachNodeAfterFilterAndSort((row, _i) => rows.push(row.data));
        messageHandler.send("ondisplaychanged", rows);
    },
    onSelectionChanged: (event) => {
        setSelectionCount(event.api.getSelectedRows().length);
    },
    onSortChanged: (event) => {
        const rows: Table.RowData[] = [];
        event.api.forEachNodeAfterFilterAndSort((row, _i) => rows.push(row.data));
        messageHandler.send("ondisplaychanged", rows);
    },
    ...(tableData.options ?? {}),
    postSortRows: tableData.options?.customTreeMode
        ? (params) => {
              const rowNodes = params.nodes;
              const api = params.api;

              // Get the current sort model from the grid
              const sortModel = api.getColumnState().filter((col) => col.sort != null);

              // Build a map of parent->children for easier lookups
              const parentChildrenMap = new Map<string, any[]>();
              const childNodes: any[] = [];
              const parentNodes: any[] = [];

              // Separate parent and child nodes
              for (const node of rowNodes) {
                  const parentId = node.data._tree?.parentId;
                  if (parentId) {
                      childNodes.push(node);
                      if (!parentChildrenMap.has(parentId)) {
                          parentChildrenMap.set(parentId, []);
                      }
                      parentChildrenMap.get(parentId)!.push(node);
                  } else {
                      parentNodes.push(node);
                  }
              }

              // Create a sorting function based on the current sort model
              const applyTableSort = (nodes: any[]) => {
                  if (!sortModel || sortModel.length === 0) {
                      // No sorting applied, maintain original order or sort by node name as fallback
                      return nodes.sort((a, b) => {
                          const aName = a.data.dsname || a.data.name || "";
                          const bName = b.data.dsname || b.data.name || "";
                          return aName.localeCompare(bName);
                      });
                  }

                  return nodes.sort((a, b) => {
                      // Sort the sortModel by sortIndex to handle multi-column sorting properly
                      const sortedColumns = sortModel.filter((col) => col.sort != null).sort((x, y) => (x.sortIndex || 0) - (y.sortIndex || 0));

                      for (const sortDef of sortedColumns) {
                          const { colId, sort: direction } = sortDef;
                          const aValue = a.data[colId];
                          const bValue = b.data[colId];

                          let comparison = 0;

                          // Handle different data types for comparison
                          if (aValue == null && bValue == null) {
                              comparison = 0;
                          } else if (aValue == null) {
                              comparison = -1;
                          } else if (bValue == null) {
                              comparison = 1;
                          } else if (typeof aValue === "string" && typeof bValue === "string") {
                              comparison = aValue.localeCompare(bValue);
                          } else if (typeof aValue === "number" && typeof bValue === "number") {
                              comparison = aValue - bValue;
                          } else if (aValue instanceof Date && bValue instanceof Date) {
                              comparison = aValue.getTime() - bValue.getTime();
                          } else {
                              // Convert to strings for comparison
                              comparison = String(aValue).localeCompare(String(bValue));
                          }

                          if (comparison !== 0) {
                              return direction === "desc" ? -comparison : comparison;
                          }
                      }

                      // Fallback to name-based sorting for stable sort order
                      const aName = a.data.dsname || a.data.name || "";
                      const bName = b.data.dsname || b.data.name || "";
                      return aName.localeCompare(bName);
                  });
              };

              // Clear the original array and rebuild it maintaining tree structure
              rowNodes.length = 0;

              // Parents are already sorted correctly by AG Grid - we just need to maintain their order
              // and sort children within each parent group using the same criteria
              for (const parentNode of parentNodes) {
                  rowNodes.push(parentNode);
                  const parentId = parentNode.data._tree?.id;
                  if (parentId && parentChildrenMap.has(parentId)) {
                      const children = parentChildrenMap.get(parentId)!;
                      // Apply the same sorting logic to children that was applied to parents
                      const sortedChildren = applyTableSort(children);
                      rowNodes.push(...sortedChildren);
                  }
              }
          }
        : undefined,
});
