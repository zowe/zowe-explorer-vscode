import type { GridApi, ICellRendererParams } from "ag-grid-community";
import type { Table } from "@zowe/zowe-explorer-api";
import { messageHandler } from "../MessageHandler";

export interface CustomTreeCellRendererParams extends ICellRendererParams {
  data: Table.RowData; // Make sure data is typed to our RowData with _tree... props
  onToggleNode: (nodeId: string | undefined) => void;
  gridRef: GridApi;
}

export const TreeCellRenderer = (props: ICellRendererParams & CustomTreeCellRendererParams) => {
  const { data, value, onToggleNode } = props;

  const depth: number = typeof data._tree?.depth === "number" ? data._tree.depth : 0;
  const hasChildren = data._tree?.hasChildren || false;
  const isExpanded = data._tree?.isExpanded || false;
  const nodeId: string | undefined = typeof data._tree?.id === "string" ? data._tree.id : undefined;

  const indentationStyle = {
    paddingLeft: `${depth * 20}px`, // 20px per depth level
    display: "flex",
    alignItems: "center",
  };

  const iconClickHandler = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent row selection or other cell actions

    if (!hasChildren || !nodeId) {
      return;
    }

    // Handle the scenario where the user might have collapsed a node that's still loading children
    if (!isExpanded) {
      // Expanding - check if children are already loaded before requesting
      const existingChildren = [];
      let currentIndex = props.node.rowIndex! + 1;

      // Check if children already exist
      while (currentIndex < props.api.getDisplayedRowCount()) {
        const row = props.api.getDisplayedRowAtIndex(currentIndex);
        if (row && row.data._tree?.parentId === nodeId) {
          existingChildren.push(row.data);
          currentIndex++;
        } else {
          break;
        }
      }

      if (existingChildren.length > 0) {
        // Children already exist, just update expanded state
      } else {
        // No children loaded yet - request from backend (lazy loading)
        messageHandler.send("loadTreeChildren", {
          nodeId: nodeId,
          parentRow: data,
        });
      }
      // Update node to reflect new tree collapsible state
      onToggleNode(nodeId);
    } else {
      // Collapsing - remove children and update state
      const childrenToRemove: any[] = [];
      let currentIndex = props.node.rowIndex! + 1;

      // Find all descendant rows (children, grandchildren, etc.)
      while (currentIndex < props.api.getDisplayedRowCount()) {
        const row = props.api.getDisplayedRowAtIndex(currentIndex);
        if (row && row.data._tree?.parentId && isDescendantOf(row.data._tree.parentId, nodeId, props.api)) {
          childrenToRemove.push(row.data);
          currentIndex++;
        } else {
          break;
        }
      }

      if (childrenToRemove.length > 0) {
        props.api.applyTransaction({
          remove: childrenToRemove,
        });
      }

      // Update the expanded state via the parent component
      onToggleNode(nodeId);
    }
  };

  // Helper function to check if a node is a descendant of another node
  const isDescendantOf = (childParentId: string, ancestorId: string, api: GridApi): boolean => {
    if (childParentId === ancestorId) {
      return true;
    }

    // Find the parent node and check recursively
    api.forEachNode((node) => {
      if (node.data._tree?.id === childParentId) {
        const parentOfParent = node.data._tree?.parentId;
        if (parentOfParent) {
          return isDescendantOf(parentOfParent, ancestorId, api);
        }
      }
    });

    return false;
  };

  const icon = hasChildren ? (
    isExpanded ? (
      <span className="codicon codicon-chevron-down" style={{ cursor: "pointer", marginRight: "5px" }} onClick={iconClickHandler}></span>
    ) : (
      <span className="codicon codicon-chevron-right" style={{ cursor: "pointer", marginRight: "5px" }} onClick={iconClickHandler}></span>
    )
  ) : (
    <span style={{ marginRight: "5px", width: "16px", display: "inline-block" }}></span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <span style={indentationStyle}>{icon}</span>
      {value}
    </div>
  );
};
