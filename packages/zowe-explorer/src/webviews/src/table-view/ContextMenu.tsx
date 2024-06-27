import type { Table } from "@zowe/zowe-explorer-api";
import { useCallback, useRef, useState } from "preact/hooks";
import { CellContextMenuEvent, ColDef } from "ag-grid-community";
import { JSXInternal } from "preact/src/jsx";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { wrapFn } from "./types";

type MousePt = { x: number; y: number };
export type ContextMenuState = {
  open: boolean;
  callback: (event: any) => void;
  component: JSXInternal.Element | null;
};

export type ContextMenuProps = {
  selectRow: boolean;
  selectedRows: Table.RowContent[] | null | undefined;
  clickedRow: Table.RowContent;
  options: Table.ContextMenuOption[];
  colDef: ColDef;
  vscodeApi: any;
};

/**
 * React hook that returns a prepared context menu component and its related states.
 *
 * @param contextMenu The props for the context menu component (options)
 * @returns The result of the hook, with the component to render, open state and cell callback
 */
export const useContextMenu = (contextMenu: ContextMenuProps) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MousePt>({ x: 0, y: 0 });

  const clickedColDef = useRef<ColDef>(null!);
  const selectedRows = useRef<any[]>([]);
  const clickedRow = useRef<any>(null);

  const openMenu = useCallback((e: PointerEvent | null | undefined) => {
    if (!e) {
      return;
    }

    setAnchor({ x: e.clientX, y: e.clientY });
    setOpen(true);
  }, []);

  const cellMenu = useCallback(
    (event: CellContextMenuEvent) => {
      const cell = event.api.getFocusedCell();
      if (contextMenu.selectRow && cell) {
        event.api.setFocusedCell(cell.rowIndex, cell.column, cell.rowPinned);
      }

      clickedColDef.current = event.colDef;
      selectedRows.current = event.api.getSelectedRows();
      clickedRow.current = event.data;

      openMenu(event.event as PointerEvent);
      event.event?.stopImmediatePropagation();
    },
    [contextMenu.selectRow, selectedRows]
  );

  return {
    open,
    callback: cellMenu,
    component: open ? (
      <ControlledMenu state={open ? "open" : "closed"} anchorPoint={anchor} direction="right" onClose={() => setOpen(false)}>
        {ContextMenu(clickedRow.current, contextMenu.options, contextMenu.vscodeApi)}
      </ControlledMenu>
    ) : null,
  };
};

export type ContextMenuElemProps = {
  anchor: MousePt;
  menuItems: Table.ContextMenuOption[];
  vscodeApi: any;
};

export const ContextMenu = (clickedRow: any, menuItems: Table.ContextMenuOption[], vscodeApi: any) => {
  return menuItems
    ?.filter((item) => {
      if (item.condition == null) {
        return true;
      }

      // Wrap function to properly handle named parameters
      const cond = new Function(wrapFn(item.condition));
      // Invoke the wrapped function once to get the built function, then invoke it again with the parameters
      return cond.call(null).call(null, clickedRow);
    })
    .map((item, _i) => (
      <MenuItem
        onClick={(_e: any) => vscodeApi.postMessage({ command: item.command, data: { ...clickedRow, actions: undefined } })}
        style={{ borderBottom: "var(--vscode-menu-border)" }}
      >
        {item.title}
      </MenuItem>
    ));
};
