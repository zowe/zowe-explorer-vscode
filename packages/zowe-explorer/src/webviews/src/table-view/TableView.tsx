// Required CSS for AG Grid
import "ag-grid-community/styles/ag-grid.css";
// AG Grid Quartz Theme (used as base theme)
import "ag-grid-community/styles/ag-theme-quartz.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useState } from "preact/hooks";
import { getVsCodeTheme, isSecureOrigin, useMutableObserver } from "../utils";
import type { Table } from "@zowe/zowe-explorer-api";
import { TableViewProps, tableProps, wrapFn } from "./types";
import { useContextMenu } from "./ContextMenu";
// Custom styling (font family, VS Code color scheme, etc.)
import "./style.css";

const vscodeApi = acquireVsCodeApi();

export const TableView = ({ actionsCellRenderer, baseTheme, data }: TableViewProps) => {
  const [tableData, setTableData] = useState<Table.Data>(
    data ?? {
      actions: {
        all: [],
      },
      contextOpts: {
        all: [],
      },
      columns: null,
      rows: null,
      title: "",
    }
  );
  const [theme, setTheme] = useState<string>(baseTheme ?? "ag-theme-quartz");

  const contextMenu = useContextMenu({
    options: [
      {
        title: "Copy cell",
        command: "copy-cell",
        callback: {
          typ: "cell",
          fn: () => {},
        },
      },
      {
        title: "Copy row",
        command: "copy",
        callback: {
          typ: "row",
          fn: () => {},
        },
      },
      ...(tableData.contextOpts.all ?? []),
    ],
    selectRow: true,
    selectedRows: [],
    clickedRow: undefined as any,
    colDef: undefined as any,
    vscodeApi,
  });

  useEffect(() => {
    // Apply the dark version of the AG Grid theme if the user is using a dark or high-contrast theme in VS Code.
    const userTheme = getVsCodeTheme();
    if (userTheme !== "vscode-light") {
      setTheme("ag-theme-quartz-dark");
    }

    // Disable the event listener for the context menu in the active iframe to prevent VS Code from showing its right-click menu.
    window.addEventListener("contextmenu", (e) => e.preventDefault(), true);

    // Set up event listener to handle data changes being sent to the webview.
    window.addEventListener("message", (event: any): void => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!("data" in event)) {
        return;
      }

      const response = event.data;
      switch (response.command) {
        case "ondatachanged":
          // Update received from a VS Code extender; update table state
          const newData: Table.Data = response.data;
          if (Object.keys(newData.actions).length > 1 || newData.actions.all?.length > 0) {
            // Add an extra column to the end of each row if row actions are present
            const rows = newData.rows?.map((row: Table.RowData) => {
              return { ...row, actions: "" };
            });
            const columns = [
              ...(newData.columns ?? []),
              {
                // Prevent cells from being selectable
                cellStyle: { border: "none", outline: "none" },
                field: "actions",
                sortable: false,
                // Support a custom cell renderer for row actions
                cellRenderer:
                  actionsCellRenderer ??
                  ((params: any) =>
                    // Render any actions for the given row and actions that apply to all rows
                    newData.actions[params.rowIndex] || newData.actions["all"] ? (
                      <span style={{ display: "flex", alignItems: "center", marginTop: "0.5em", userSelect: "none" }}>
                        {[...(newData.actions[params.rowIndex] || []), ...(newData.actions["all"] || [])]
                          .filter((action) => {
                            if (action.condition == null) {
                              return true;
                            }

                            // Wrap function to properly handle named parameters
                            const cond = new Function(wrapFn(action.condition));
                            // Invoke the wrapped function once to get the built function, then invoke it again with the parameters
                            return cond.call(null).call(null, params.data);
                          })
                          .map((action) => (
                            <VSCodeButton
                              appearance={action.type ?? "primary"}
                              onClick={(_e: any) =>
                                vscodeApi.postMessage({
                                  command: action.command,
                                  data: { ...params.data, actions: undefined },
                                  row: newData.rows!.at(params.rowIndex),
                                })
                              }
                              style={{ marginRight: "0.25em" }}
                            >
                              {action.title}
                            </VSCodeButton>
                          ))}
                      </span>
                    ) : null),
              },
            ];
            setTableData({ ...newData, rows, columns });
          } else {
            setTableData(response.data);
          }
          break;
        default:
          break;
      }
    });

    // Once the listener is in place, send a "ready signal" to the TableView instance to handle new data.
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  // Observe attributes of the `body` element to detect VS Code theme changes.
  useMutableObserver(
    document.body,
    (_mutations, _observer) => {
      const themeAttr = getVsCodeTheme();
      setTheme(themeAttr === "vscode-light" ? "ag-theme-quartz" : "ag-theme-quartz-dark");
    },
    { attributes: true }
  );

  return (
    <>
      {tableData.title ? <h1>{tableData.title}</h1> : null}
      <div className={`${theme} ag-theme-vsc ${contextMenu.open ? "ctx-menu-open" : ""}`}>
        {contextMenu.component}
        <AgGridReact {...tableProps(contextMenu, tableData)} />
      </div>
    </>
  );
};
