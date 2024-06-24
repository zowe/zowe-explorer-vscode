import type { Table } from "@zowe/zowe-explorer-api";
import { useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import { ColDef } from "ag-grid-community";

const vscodeApi = acquireVsCodeApi();

type MousePt = { x: number; y: number };
export type ContextMenuState = {
  open: boolean;
  callback: Function;
  component: JSX.Element | null;
};

export type ContextMenuProps = {
  selectedRows: Table.RowContent[] | null | undefined;
  clickedRow: Table.RowContent;
  options: Table.ContextMenuOption[];
  colDef: ColDef;
  close: () => void;
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

  return {
    open,
    callback: () => {},
    component: open ? <ContextMenu menuItems={contextMenu.options} /> : null,
  };
};

export const ContextMenu = ({ menuItems }: { menuItems?: Table.ContextMenuOption[] }) => {
  return menuItems?.length == 0 ? null : (
    <div style={{ color: "var(--vscode-menu-background)", border: "1px solid var(--vscode-menu-border)" }}>
      <ul>
        {menuItems!.map((item, i) => (
          <li onClick={(_e) => vscodeApi.postMessage({ command: item.command })} style={{ borderBottom: "var(--vscode-menu-border)" }}>
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
};
