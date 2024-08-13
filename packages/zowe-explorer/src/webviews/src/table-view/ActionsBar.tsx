import { Dispatch, Ref } from "preact/hooks";
import type { Table } from "@zowe/zowe-explorer-api";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { GridApi } from "ag-grid-community";
import { wrapFn } from "./types";
import { Menu, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";

export const ActionsBar = ({
  actions,
  gridRef,
  itemCount,
  selectionCount,
  title,
  columns,
  visibleColumns,
  setVisibleColumns,
  vscodeApi,
}: {
  actions: Table.Action[];
  gridRef: Ref<any>;
  itemCount: number;
  selectionCount: number;
  title: string;
  columns: string[];
  visibleColumns: string[];
  setVisibleColumns: Dispatch<string[]>;
  vscodeApi: any;
}) => {
  const columnDropdownItems = (visibleColumns: string[]) =>
    columns
      .filter((col) => col !== "actions")
      .map((col) => (
        <MenuItem
          type="checkbox"
          checked={visibleColumns.includes(col)}
          onClick={(_e: any) => {
            const gridApi = gridRef.current.api as GridApi;
            const colVisibility = !visibleColumns.includes(col);
            gridApi.setColumnsVisible(
              [gridApi.getColumns()?.find((c) => c.getColDef().field === col || c.getColDef().headerName === col)!],
              colVisibility
            );
            setVisibleColumns(colVisibility ? [...visibleColumns, col] : visibleColumns.filter((c) => c !== col));
          }}
        >
          {col}
        </MenuItem>
      ));

  return (
    <div
      style={{
        height: "3em",
        display: "flex",
        alignItems: "center",
        border: "1px solid var(--vscode-editorWidget-border)",
        borderTopLeftRadius: "var(--ag-wrapper-border-radius)",
        borderTopRightRadius: "var(--ag-wrapper-border-radius)",
        justifyContent: "space-between",
        backgroundColor: "var(--vscode-keybindingTable-headerBackground)",
        color: "var(--vscode-foreground) !important",
        padding: "0 0.25em",
        marginBottom: "-1px",
      }}
    >
      <h3 style={{ marginLeft: "0.25em" }}>
        {title} ({itemCount})
      </h3>
      <span style={{ display: "flex", alignItems: "center", marginBottom: "0.25em" }}>
        <p style={{ fontSize: "0.9em", paddingTop: "2px", marginRight: "0.75em" }}>
          {selectionCount === 0 ? "No" : selectionCount} item{selectionCount > 1 || selectionCount === 0 ? "s" : ""} selected
        </p>
        {actions
          .filter((action) => (itemCount > 1 ? action.callback.typ === "multi-row" : action.callback.typ.endsWith("row")))
          .filter((item) => {
            if (item.condition == null || gridRef.current?.api == null) {
              return true;
            }

            const selectedRows = gridRef.current.api.getSelectedRows();
            // Wrap function to properly handle named parameters
            const cond = new Function(wrapFn(item.condition));
            // Invoke the wrapped function once to get the built function, then invoke it again with the parameters
            return cond()(item.callback.typ === "multi-row" ? selectedRows : selectedRows[0]);
          })
          .map((action, i) => (
            <VSCodeButton
              key={`${action.command}-action-bar-${i}`}
              appearance={action.type}
              style={{ fontWeight: "bold", marginTop: "3px", marginRight: "0.25em" }}
              onClick={(_event: any) => {
                const selectedRows = (gridRef.current.api as GridApi).getSelectedNodes();
                if (selectedRows.length === 0) {
                  return;
                }

                vscodeApi.postMessage({
                  command: action.command,
                  data: {
                    row: action.callback.typ === "single-row" ? selectedRows[0].data : undefined,
                    rows:
                      action.callback.typ === "multi-row"
                        ? selectedRows.reduce((all, row) => ({ ...all, [row.rowIndex!]: row.data }), {})
                        : undefined,
                  },
                });
              }}
            >
              {action.title}
            </VSCodeButton>
          ))}
        &nbsp;|&nbsp;
        <div style={{ marginTop: "2px", marginLeft: "0.25em", marginRight: "0.25em" }}>
          <Menu menuButton={<VSCodeButton appearance="primary">Columns</VSCodeButton>}>{columnDropdownItems(visibleColumns)}</Menu>
        </div>
      </span>
    </div>
  );
};
