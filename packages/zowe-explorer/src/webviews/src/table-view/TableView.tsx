// Required CSS for AG Grid
import "ag-grid-community/styles/ag-grid.css";
// AG Grid Quartz Theme (used as base theme)
import "ag-grid-community/styles/ag-theme-quartz.css";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useRef, useState } from "preact/hooks";
import { getVsCodeTheme, isSecureOrigin, useMutableObserver } from "../utils";
import type { Table } from "@zowe/zowe-explorer-api";
import { TableViewProps, tableProps } from "./types";
import { useContextMenu } from "./ContextMenu";
// Custom styling (font family, VS Code color scheme, etc.)
import "./style.css";
import { ActionsBar } from "./ActionsBar";
import { actionsColumn } from "./actionsColumn";
import { CheckboxSelectionCallbackParams, HeaderCheckboxSelectionCallbackParams } from "ag-grid-community";
import { GetLocaleTextParams } from "ag-grid-community";
import * as l10n from "@vscode/l10n";
import { TreeCellRenderer, CustomTreeCellRendererParams } from "./treeCellRenderer";

const vscodeApi = acquireVsCodeApi();

// Helper to generate unique enough IDs for tree nodes
let treeNodeIdCounter = 0;
const generateTreeNodeId = () => `tree_node_${treeNodeIdCounter++}`;

// Processes hierarchical data for custom tree mode
const processTreeData = (
  hierarchicalData: Table.RowData[],
  expansionDepth: number = 0,
  parentId?: string,
  currentDepth: number = 0
): Table.RowData[] => {
  let flatData: Table.RowData[] = [];
  hierarchicalData.forEach((node: Table.RowData) => {
    const nodeId = node._tree?.id || generateTreeNodeId();
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpanded = expansionDepth === -1 || currentDepth < expansionDepth;

    const processedNode: Table.RowData = {
      ...node,
      _tree: {
        id: nodeId,
        parentId: parentId!,
        depth: currentDepth,
        hasChildren: hasChildren,
        isExpanded: hasChildren && isExpanded,
      },
    };
    delete processedNode.children;

    flatData.push(processedNode);

    if (hasChildren && isExpanded && Array.isArray(node.children)) {
      flatData = flatData.concat(processTreeData(node.children, expansionDepth, nodeId, currentDepth + 1));
    }
  });
  return flatData;
};

function isFirstColumn(params: CheckboxSelectionCallbackParams | HeaderCheckboxSelectionCallbackParams) {
  const displayedColumns = params.api.getAllDisplayedColumns();
  const thisIsFirstColumn = displayedColumns[0] === params.column;
  return thisIsFirstColumn;
}

export const TableView = ({ actionsCellRenderer, baseTheme, data }: TableViewProps) => {
  const [localization, setLocalizationContents] = useState<{ [key: string]: string }>({});
  const [tableData, setTableData] = useState<Table.ViewOpts | undefined>(data);
  const [originalHierarchicalData, setOriginalHierarchicalData] = useState<Table.RowData[] | undefined>(undefined);
  const [theme, setTheme] = useState<string>(baseTheme ?? "ag-theme-quartz");
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const gridRef = useRef<any>();
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

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
          typ: "single-row",
          fn: () => {},
        },
      },
      ...(tableData?.contextOpts?.all ?? []),
    ],
    selectRow: true,
    selectedRows: [],
    clickedRow: undefined as any,
    colDef: undefined as any,
    vscodeApi,
  });

  const handleToggleNode = (nodeIdToToggle: string | undefined) => {
    if (!nodeIdToToggle || !originalHierarchicalData || !tableData?.options?.customTreeMode) return;

    // Recursive function to find and toggle the node in the original hierarchical data
    const toggleNodeState = (nodes: Table.RowData[]): Table.RowData[] => {
      return nodes.map((node) => {
        if (node._tree?.id === nodeIdToToggle) {
          return { ...node, _tree: { ...node._tree, isExpanded: !node._tree.isExpanded } };
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          return { ...node, children: toggleNodeState(node.children) };
        }
        return node;
      });
    };

    const newOriginalData = toggleNodeState(originalHierarchicalData);
    setOriginalHierarchicalData(newOriginalData);

    // Re-flatten the data with the new expansion state
    const newDisplayRows = processTreeData(newOriginalData, tableData.options.customTreeInitialExpansionDepth ?? 0);
    setTableData((prevData) => (prevData ? { ...prevData, rows: newDisplayRows } : undefined));
  };

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

      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        setLocalizationContents(contents);
        l10n.config({
          contents: contents,
        });
      }

      const response = event.data;
      if (response.command === "ondatachanged") {
        const newData: Table.ViewOpts = response.data;

        let displayRows = newData.rows;
        if (newData.options?.customTreeMode && newData.options?.customTreeColumnField) {
          treeNodeIdCounter = 0; // Reset counter for each new dataset
          // Store original data and set initial expansion states for _tree.isExpanded on original data
          const initializeExpansion = (nodes: Table.RowData[], depth: number = 0, expansionDepthTarget: number): Table.RowData[] => {
            return nodes.map((node) => {
              const nodeId = node._tree?.id || generateTreeNodeId(); // Assign ID if not present
              const hasChildren = Array.isArray(node.children) && node.children.length > 0;
              const isExpanded = expansionDepthTarget === -1 || depth < expansionDepthTarget;
              let processedChildren = node.children;
              if (hasChildren && Array.isArray(node.children)) {
                processedChildren = initializeExpansion(node.children, depth + 1, expansionDepthTarget);
              }
              return {
                ...node,
                _tree: {
                  id: nodeId,
                  parentId: node._tree?.parentId,
                  depth: depth,
                  hasChildren: hasChildren,
                  isExpanded: hasChildren && isExpanded,
                },
                children: processedChildren,
              };
            });
          };
          const initialExpansionDepth = newData.options.customTreeInitialExpansionDepth ?? 0;
          const preparedHierarchicalData = initializeExpansion(newData.rows || [], 0, initialExpansionDepth);
          setOriginalHierarchicalData(preparedHierarchicalData);
          displayRows = processTreeData(preparedHierarchicalData, initialExpansionDepth);
        } else {
          setOriginalHierarchicalData(undefined); // Clear if not in tree mode
        }

        let newColumns = newData.columns;
        if (newData.options?.customTreeMode && newData.options?.customTreeColumnField) {
          const treeColumnField = newData.options.customTreeColumnField;
          newColumns = newData.columns?.map((col) => {
            if (col.field === treeColumnField) {
              return {
                ...col,
                cellRenderer: TreeCellRenderer,
                cellRendererParams: {
                  onToggleNode: handleToggleNode,
                } as CustomTreeCellRendererParams,
              };
            }
            return col;
          });
        }

        if (newData.options?.selectEverything) {
          (newData.options as any).defaultColDef = {
            headerCheckboxSelection: isFirstColumn,
            checkboxSelection: isFirstColumn,
          };
        }
        if (Object.keys(newData.actions).length > 1 || newData.actions.all?.length > 0) {
          // Add an extra column to the end of each row if row actions are present
          const columns = [...(newColumns ?? []), actionsColumn(newData, actionsCellRenderer, vscodeApi)];
          setVisibleColumns(columns.filter((c) => !c.initialHide).map((c) => c.headerName ?? c.field));
          setTableData({ ...newData, rows: displayRows, columns });
        } else {
          setVisibleColumns(newColumns?.filter((c) => !c.initialHide).map((c) => c.headerName ?? c.field) ?? []);
          setTableData({ ...newData, rows: displayRows, columns: newColumns });
        }
      }
    });

    // Once the listener is in place, send a "ready signal" to the TableView instance to handle new data.
    vscodeApi.postMessage({ command: "ready" });
    vscodeApi.postMessage({ command: "GET_LOCALIZATION" });
  }, [localization]);

  const localizationMap = [
    { key: "Page Size:", localized: l10n.t("Page Size:") },
    { key: "Page", localized: l10n.t("Page") },
  ];

  // Observe attributes of the `body` element to detect VS Code theme changes.
  useMutableObserver(
    document.body,
    (_mutations, _observer) => {
      const themeAttr = getVsCodeTheme();
      setTheme(themeAttr === "vscode-light" ? "ag-theme-quartz" : "ag-theme-quartz-dark");
    },
    { attributes: true }
  );

  let getLocaleText = (params: GetLocaleTextParams<any, any>): string => {
    switch (params.key) {
      case "thousandSeparator":
        return ".";
      case "decimalSeparator":
        return ",";
      default:
        if (params.defaultValue) {
          const localizedObj = localizationMap.find((item) => item.key === params.defaultValue);
          const localizedVal = localizedObj ? localizedObj.localized : params.defaultValue;
          return localizedVal;
        }
        return "";
    }
  };

  return (
    <div className={`table-view ${theme} ag-theme-vsc ${contextMenu.open ? "ctx-menu-open" : ""}`}>
      {contextMenu.component}
      <ActionsBar
        actions={tableData?.actions.all ?? []}
        columns={tableData?.columns?.map((c) => c.headerName ?? c.field) ?? []}
        gridRef={gridRef}
        itemCount={tableData?.rows?.length ?? 0}
        title={tableData?.title ?? ""}
        selectionCount={selectionCount}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        vscodeApi={vscodeApi}
      />
      {tableData ? (
        <AgGridReact {...tableProps(contextMenu, setSelectionCount, tableData, vscodeApi)} ref={gridRef} getLocaleText={getLocaleText} />
      ) : null}
    </div>
  );
};
