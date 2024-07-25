import { Ref } from "preact/hooks";
import type { Table } from "@zowe/zowe-explorer-api";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { GridApi } from "ag-grid-community";

export const ActionsBar = ({
  actions,
  gridRef,
  itemCount,
  vscodeApi,
}: {
  actions: Table.Action[];
  gridRef: Ref<any | undefined>;
  itemCount: number;
  vscodeApi: any;
}) => {
  return (
    <div
      style={{
        height: "2.5em",
        display: "flex",
        alignItems: "center",
        borderRadius: "var(--ag-wrapper-border-radius)",
        border: "1px solid var(--vscode-editorWidget-border)",
        justifyContent: "space-between",
        backgroundColor: "var(--vscode-keybindingTable-headerBackground)",
        color: "var(--vscode-foreground) !important",
        padding: "0 0.25em",
        marginBottom: "3px",
      }}
    >
      <h5 style={{ marginLeft: "0.25em" }}>
        {itemCount === 0 ? "No" : itemCount} item{itemCount === 1 ? "" : "s"} selected
      </h5>
      <span style={{ marginBottom: "0.25em" }}>
        {actions
          .filter((action) => (itemCount > 1 ? action.callback.typ === "multi-row" : action.callback.typ.endsWith("row")))
          .map((action) => (
            <VSCodeButton
              type={action.type}
              style={{ height: "1.5em", fontWeight: "bold", marginRight: "0.25em" }}
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
      </span>
    </div>
  );
};
