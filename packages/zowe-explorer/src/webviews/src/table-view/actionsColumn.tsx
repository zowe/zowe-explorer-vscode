import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { TableViewProps, wrapFn } from "./types";
import { Table } from "@zowe/zowe-explorer-api";

export const actionsColumn = (newData: Table.ViewOpts, actionsCellRenderer: TableViewProps["actionsCellRenderer"], vscodeApi: any) => ({
  ...(newData.columns.find((col) => col.field === "actions") ?? {}),
  // Prevent cells from being selectable
  cellStyle: { border: "none", outline: "none" },
  field: "actions",
  minWidth: 360,
  sortable: false,
  suppressSizeToFit: true,
  // Support a custom cell renderer for row actions
  cellRenderer:
    actionsCellRenderer ??
    ((params: any) =>
      // Render any actions for the given row and actions that apply to all rows
      newData.actions[params.rowIndex] || newData.actions["all"] ? (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "0.5em",
            userSelect: "none",
            width: "fit-content",
          }}
        >
          {[...(newData.actions[params.rowIndex] || []), ...(newData.actions["all"] || [])]
            .filter((action) => {
              if (action.condition == null) {
                return true;
              }

              // Wrap function to properly handle named parameters
              const cond = new Function(wrapFn(action.condition));
              // Invoke the wrapped function once to get the built function, then invoke it again with the parameters
              return cond()(params.data);
            })
            .map((action, i) => (
              <VSCodeButton
                key={`${action.command}-row-${params.rowIndex ?? 0}-action-${i}`}
                appearance={action.type}
                onClick={(_e: any) =>
                  vscodeApi.postMessage({
                    command: action.command,
                    data: {
                      rowIndex: params.node.rowIndex,
                      row: { ...params.data, actions: undefined },
                      field: params.colDef.field,
                      cell: params.colDef.valueFormatter
                        ? params.colDef.valueFormatter({
                            value: params.data[params.colDef.field],
                          })
                        : params.data[params.colDef.field],
                    },
                  })
                }
                style={{ marginRight: "0.25em", width: "fit-content" }}
              >
                {action.title}
              </VSCodeButton>
            ))}
        </span>
      ) : null),
});
