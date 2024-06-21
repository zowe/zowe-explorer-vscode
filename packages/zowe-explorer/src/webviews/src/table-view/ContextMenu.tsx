import type { Table } from "@zowe/zowe-explorer-api";

const vscodeApi = acquireVsCodeApi();

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
