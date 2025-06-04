import type { ICellRendererParams } from "ag-grid-community";
import type { Table } from "@zowe/zowe-explorer-api";

export interface CustomTreeCellRendererParams extends ICellRendererParams {
  data: Table.RowData; // Make sure data is typed to our RowData with _tree... props
  onToggleNode: (nodeId: string | undefined) => void;
}

export const TreeCellRenderer = (props: ICellRendererParams & CustomTreeCellRendererParams) => {
  const { data, value, onToggleNode } = props;

  const depth: number = typeof data._tree?.depth === "number" ? data._tree.depth : 0;
  const hasChildren = data._tree?.hasChildren || false;
  const isExpanded = data._tree?.isExpanded || false;
  const nodeId: string | undefined = typeof data._tree?.id === "string" ? data._tree.id : undefined;

  const indentationStyle = {
    paddingLeft: `${depth * 20}px`, // 20px per depth level
    display: "inline-block",
  };

  const iconClickHandler = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent row selection or other cell actions
    if (hasChildren) {
      onToggleNode(nodeId);
    }
  };

  const icon = hasChildren ? (
    isExpanded ? (
      <span className="codicon codicon-chevron-down" style={{ cursor: "pointer", marginRight: "5px" }} onClick={iconClickHandler}></span>
    ) : (
      <span className="codicon codicon-chevron-right" style={{ cursor: "pointer", marginRight: "5px" }} onClick={iconClickHandler}></span>
    )
  ) : (
    <span style={{ marginRight: "5px", width: "16px", display: "inline-block" }}></span>
  ); // Placeholder for alignment if no children

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <span style={indentationStyle}>{icon}</span>
      {value}
    </div>
  );
};
