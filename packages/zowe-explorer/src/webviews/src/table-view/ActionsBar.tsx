import { Dispatch, Ref, useEffect, useState } from "preact/hooks";
import type { Table } from "@zowe/zowe-explorer-api";
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { GridApi } from "ag-grid-community";
import { FocusableItem, Menu, MenuGroup, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import * as l10n from "@vscode/l10n";
import { evaluateItemsState, sendItemCommand, ActionEvaluationContext, ActionState } from "./ActionUtils";

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
  const [actionStates, setActionStates] = useState<ActionState[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    const checkActionsVisibilityAndState = async () => {
      const selectedNodes = props.gridRef.current?.api?.getSelectedNodes();
      const selectedRows = selectedNodes?.map((n: any) => n.data) ?? [];

      const context: ActionEvaluationContext = {
        selectedNodes,
        selectedRows,
      };

      try {
        const visibleActionStates = await evaluateItemsState(props.actions, context, props.selectionCount);
        setActionStates(visibleActionStates);
      } catch (error) {
        console.warn("Failed to evaluate actions:", error);
        setActionStates([]);
      }
    };

    checkActionsVisibilityAndState();
  }, [props.actions, props.gridRef, props.selectionCount, props.itemCount, refreshTrigger]);

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
        {actionStates.map((actionState, i) => {
          return (
            <VSCodeButton
              disabled={!actionState.isEnabled}
              key={`${actionState.item.command}-action-bar-${i}`}
              appearance={"type" in actionState.item ? actionState.item.type : "secondary"}
              style={{ fontWeight: "bold", marginTop: "3px", marginRight: "0.25em" }}
              onClick={async (_event: any) => {
                const selectedNodes = (props.gridRef.current.api as GridApi).getSelectedNodes();
                const callbackType: string =
                  "callback" in actionState.item && actionState.item.callback ? actionState.item.callback.typ : "single-row";
                if (selectedNodes.length === 0 && callbackType !== "no-selection") {
                  return;
                }

                const context: ActionEvaluationContext = {
                  selectedNodes,
                };
                sendItemCommand(actionState.item, context);

                // For pin/unpin actions, refresh the action states after a short delay
                if (actionState.item.command === "pin-selected-rows") {
                  setTimeout(() => {
                    setRefreshTrigger((prev) => prev + 1);
                  }, 100);
                }
              }}
            >
              {actionState.title}
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
