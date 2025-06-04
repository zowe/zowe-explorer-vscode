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
    if (hasChildren) {
      onToggleNode(nodeId);
    }
    console.log("[iconClickHandler]", JSON.stringify(props.data));
    const nowExpanded = !isExpanded;
    const newData = { ...data, _tree: { ...data._tree, isExpanded: nowExpanded } };
    props.node.setData(newData);
    const rowsToAdd = data.children;
    console.trace("new rows to add:", JSON.stringify(rowsToAdd));
    if (isExpanded) {
      props.api.applyTransaction({
        add: rowsToAdd,
        addIndex: props.node.rowIndex! + 1,
      });
    } else {
      props.api.applyTransaction({
        remove: rowsToAdd,
      });
    }
    props.api.refreshCells();
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
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ ...indentationStyle, display: "flex", alignItems: "center" }}>{icon}</span>
        {value}
      </div>

      {/* {hasChildren && isExpanded ? (
        <span style={{ marginLeft: "10px" }}>
          {data.children?.map((childNode: any) => (
            <TreeCellRenderer {...props} key={childNode.id} data={childNode} value={childNode.name} onToggleNode={onToggleNode} />
          ))}
        </span>
      ) : null} */}
    </>
  );
};
