import type { GridApi, ICellRendererParams } from "ag-grid-community";
import type { Table } from "@zowe/zowe-explorer-api";

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
    display: "inline-block",
  };

  const iconClickHandler = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent row selection or other cell actions

    if (!hasChildren || !nodeId) {
      return;
    }

    console.log("[iconClickHandler] Toggling node:", nodeId, "Current expanded state:", isExpanded);

    // Get VS Code API to send message for lazy loading
    const vscodeApi = (window as any).acquireVsCodeApi();

    if (!isExpanded) {
      // Expanding - request children from backend (lazy loading)
      vscodeApi.postMessage({
        command: "loadTreeChildren",
        data: {
          nodeId: nodeId,
          parentRow: data,
        },
      });
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
    }

    // Update the expanded state via the parent component
    onToggleNode(nodeId);
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
      <span style={{ ...indentationStyle, display: "flex", alignItems: "center" }}>{icon}</span>
      {value}
    </div>
  );
};
