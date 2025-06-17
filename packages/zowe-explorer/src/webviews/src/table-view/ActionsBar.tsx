import { Dispatch, Ref, useEffect, useState } from "preact/hooks";
import type { Table } from "@zowe/zowe-explorer-api";
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { GridApi } from "ag-grid-community";
import { FocusableItem, Menu, MenuGroup, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import * as l10n from "@vscode/l10n";
import { messageHandler } from "../MessageHandler";

interface ActionsProps {
  actions: Table.Action[];
  gridRef: Ref<any>;
  itemCount: number;
  selectionCount: number;
  title: string;
  columns: string[];
  visibleColumns: string[];
  setVisibleColumns: Dispatch<string[]>;
}

export const ActionsBar = (props: ActionsProps) => {
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [actionsEnabled, setActionsEnabled] = useState<boolean[]>(props.actions.map(() => true));

  useEffect(() => {
    const checkActions = async () => {
      const selectedNodes = props.gridRef.current?.api?.getSelectedNodes();
      const selectedRows = selectedNodes?.map((n: any) => n.data) ?? [];
      const newActionsEnabled = await Promise.all(
        props.actions.map(async (action) => {
          const val = action.callback.typ === "multi-row" ? selectedRows : { index: selectedNodes?.[0]?.rowIndex, row: selectedRows?.[0] };

          let shouldEnable = false;
          switch (action.callback.typ) {
            case "single-row":
              shouldEnable = action.noSelectionRequired || (props.selectionCount !== 0 && props.selectionCount === 1);
              break;
            case "multi-row":
              shouldEnable = action.noSelectionRequired || (props.selectionCount !== 0 && props.selectionCount >= 1);
              break;
            case "cell":
              return false;
          }

          shouldEnable &&= await messageHandler.request<boolean>("check-condition-for-action", { actionId: action.command, row: val });
          return shouldEnable;
        })
      );
      setActionsEnabled(newActionsEnabled);
    };

    checkActions();
  }, [props.actions, props.gridRef, props.selectionCount, props.itemCount]);

  const columnDropdownItems = (visibleColumns: string[]) =>
    props.columns
      .filter((col) => col !== "actions" && (searchFilter.length === 0 || col.toLowerCase().includes(searchFilter)))
      .map((col) => (
        <MenuItem
          key={`toggle-vis-${col}`}
          type="checkbox"
          onClick={(e: any) => {
            const gridApi = props.gridRef.current.api as GridApi;
            const colVisibility = !visibleColumns.includes(col);
            gridApi.setColumnsVisible(
              [gridApi.getColumns()?.find((c) => c.getColDef().field === col || c.getColDef().headerName === col)!],
              colVisibility
            );
            props.setVisibleColumns(colVisibility ? [...visibleColumns, col] : visibleColumns.filter((c) => c !== col));
            e.keepOpen = true;
          }}
        >
          {() => (
            <div
              style={{
                display: "flex",
                justifyContent: "space-evenly",
                alignItems: "center",
                height: "1.25rem",
                marginLeft: "-1.25rem",
                overflow: "hidden",
              }}
            >
              <span style={{ paddingRight: visibleColumns.includes(col) ? "1em" : "2.15em", marginTop: "3px" }}>
                {visibleColumns.includes(col) ? <span className="codicon codicon-check"></span> : null}
              </span>
              {col}
            </div>
          )}
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
        {props.title} ({props.itemCount})
      </h3>
      <span style={{ display: "flex", alignItems: "center", marginBottom: "0.25em" }}>
        <p style={{ fontSize: "0.9em", paddingTop: "2px", marginRight: "0.75em" }}>
          {props.selectionCount === 0 ? l10n.t("No") : props.selectionCount}
          &nbsp;{props.selectionCount > 1 || props.selectionCount === 0 ? l10n.t("items") : l10n.t("item")} {l10n.t("selected")}
        </p>
        {props.actions.map((action, i) => {
          return (
            <VSCodeButton
              disabled={!actionsEnabled[i]}
              key={`${action.command}-action-bar-${i}`}
              appearance={action.type}
              style={{ fontWeight: "bold", marginTop: "3px", marginRight: "0.25em" }}
              onClick={(_event: any) => {
                const selectedNodes = (props.gridRef.current.api as GridApi).getSelectedNodes();
                if (selectedNodes.length === 0) {
                  return;
                }

                messageHandler.send(action.command, {
                  row: action.callback.typ === "single-row" ? selectedNodes[0].data : undefined,
                  rows:
                    action.callback.typ === "multi-row" ? selectedNodes.reduce((all, row) => ({ ...all, [row.rowIndex!]: row.data }), {}) : undefined,
                });
              }}
            >
              {action.title}
            </VSCodeButton>
          );
        })}
        <div
          id="colsToggleBtn"
          style={{
            borderLeft: "1px solid var(--ag-border-color)",
            marginTop: "1px",
            marginLeft: "0.25em",
            marginRight: "0.25em",
            paddingLeft: "0.5em",
          }}
        >
          <span id="colsToggleMenu">
            <Menu
              boundingBoxPadding="55 20 40 0"
              menuButton={
                <VSCodeButton appearance="secondary">
                  <span className="codicon codicon-gear"></span>
                </VSCodeButton>
              }
              menuClassName="toggle-cols-menu"
              overflow="auto"
              setDownOverflow
            >
              <FocusableItem style={{ marginBottom: "0.5rem" }}>
                {({ ref }: { ref: any }) => (
                  <VSCodeTextField
                    ref={ref}
                    type="text"
                    placeholder="Search"
                    value={searchFilter}
                    onInput={(e: any) => setSearchFilter((e.target!.value as string).toLowerCase())}
                  >
                    <span slot="start" className="codicon codicon-search"></span>
                  </VSCodeTextField>
                )}
              </FocusableItem>
              <MenuGroup takeOverflow>{columnDropdownItems(props.visibleColumns)}</MenuGroup>
            </Menu>
          </span>
        </div>
      </span>
    </div>
  );
};
