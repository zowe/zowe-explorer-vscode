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
        height: "2.25em",
        display: "flex",
        alignItems: "center",
        borderRadius: "3px",
        justifyContent: "space-between",
        backgroundColor: "var(--vscode-notificationsInfoIcon-foreground)",
        color: "var(--vscode-foreground)",
      }}
    >
      <h6>
        {itemCount === 0 ? "No" : itemCount} item{itemCount < 1 ? "" : "s"} selected
      </h6>
      <span>
        {actions
          .filter((action) => (itemCount > 1 ? action.callback.typ === "multi-row" : action.callback.typ.endsWith("row")))
          .map((action) => (
            <VSCodeButton
              type={action.type}
              style={{ maxHeight: "0.5em", fontWeight: "bold" }}
              onClick={(_event: any) => {
                const selectedRows = (gridRef.current.api as GridApi).getSelectedNodes();
                vscodeApi.postMessage({
                  command: action.command,
                  data: {
                    rows: selectedRows.map((row) => ({ [row.rowIndex!]: row.data })),
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
