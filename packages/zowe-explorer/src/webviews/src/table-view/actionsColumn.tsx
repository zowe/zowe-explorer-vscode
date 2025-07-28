import { TableViewProps } from "./types";
import { Table } from "@zowe/zowe-explorer-api";
import { ActionButton } from "./ActionButton";

export const actionsColumn = (newData: Table.ViewOpts, actionsCellRenderer: TableViewProps["actionsCellRenderer"]) => ({
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
          {[...(newData.actions[params.rowIndex] || []), ...(newData.actions["all"] || [])].map((action, i) => (
            <ActionButton
              key={`${action.command}-row-${params.rowIndex ?? 0}-action-${i}`}
              action={action}
              params={params}
              keyPrefix={`${action.command}-row-${params.rowIndex ?? 0}-action-${i}`}
            />
          ))}
        </span>
      ) : null),
});
