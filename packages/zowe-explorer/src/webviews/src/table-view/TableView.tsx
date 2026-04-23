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
import { messageHandler } from "../MessageHandler";
import { Messenger } from "../Messenger";

import { provideGlobalGridOptions } from "ag-grid-community";

// Mark all grids as using legacy themes
provideGlobalGridOptions({
  theme: "legacy",
});

import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

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
    const hasChildren = node._tree?.hasChildren;
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
    //delete processedNode.children;

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
  const gridRef = useRef<AgGridReact>();
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  // Holds either a MutationObserver (new) or a NodeJS.Timeout (legacy fallback)
  const tooltipCleanupRef = useRef<MutationObserver | NodeJS.Timeout | null>(null);

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
  });

  // Capture the current state in a ref
  const tableDataRef = useRef(tableData);
  const originalHierarchicalDataRef = useRef(originalHierarchicalData);

  useEffect(() => {
    tableDataRef.current = tableData;
    originalHierarchicalDataRef.current = originalHierarchicalData;
  }, [tableData, originalHierarchicalData]);

  // Updated handleToggleNode to use captured state
  const handleToggleNode = (nodeIdToToggle: string | undefined) => {
    if (!nodeIdToToggle || !originalHierarchicalDataRef.current || !tableDataRef.current?.options?.customTreeMode) {
      return;
    }
    
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

    const newOriginalData = toggleNodeState(originalHierarchicalDataRef.current!);
    setOriginalHierarchicalData(newOriginalData);

    // Update the grid's row data to reflect the new expanded state
    if (gridRef.current?.api) {
      // Find the row node based on the ID in the tree.
      // TODO: this could potentially be optimized by caching the IDs and using getRowNode.
      let targetNode: any = null;
      gridRef.current.api.forEachNode((node: any) => {
        if (node.data._tree?.id === nodeIdToToggle) {
          targetNode = node;
        }
      });

      if (targetNode) {
        const updatedData = { ...targetNode.data, _tree: { ...targetNode.data._tree, isExpanded: !targetNode.data._tree.isExpanded } };
        targetNode.setData(updatedData);
        // Refresh only the specific cell to avoid full grid refresh
        gridRef.current.api.refreshCells({
          rowNodes: [targetNode],
          force: true,
        });
      }
    }
  };

  useEffect(() => {
    // Apply the dark version of the AG Grid theme if the user is using a dark or high-contrast theme in VS Code.
    const userTheme = getVsCodeTheme();
    if (userTheme !== "vscode-light") {
      setTheme("ag-theme-quartz-dark");
    }

    // Disable the event listener for the context menu in the active iframe to prevent VS Code from showing its right-click menu.
    window.addEventListener("contextmenu", (e) => e.preventDefault(), true);

    // Set up MessageHandler listeners for handling data changes being sent to the webview.
    const getLocalizationContents = async () => {
      try {
        // Request localization data
        const localizationData = await messageHandler.request<Record<string, string>>("GET_LOCALIZATION");
        if (localizationData) {
          setLocalizationContents(localizationData);
          l10n.config({
            contents: localizationData,
          });
        }
      } catch (error) {
        messageHandler.send("error", "Failed to get localization data: " + error);
      }
    };

    const handleDataChanged = (newData: Table.ViewOpts) => {
      let displayRows = newData.rows;
      if (newData.options?.customTreeMode && newData.options?.customTreeColumnField) {
        treeNodeIdCounter = 0; // Reset counter for each new dataset
        // Store original data and set initial expansion states for _tree.isExpanded on original data
        const initializeExpansion = (nodes: Table.RowData[], depth: number = 0, expansionDepthTarget: number): Table.RowData[] => {
          return nodes.map((node) => {
            const nodeId = node._tree?.id || generateTreeNodeId(); // Assign ID if not present
            const hasChildren = node._tree?.hasChildren;
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
                onToggleNode: (nodeIdToToggle: string) => handleToggleNode(nodeIdToToggle),
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
        const columns = [...(newColumns ?? []), actionsColumn(newData, actionsCellRenderer)];
        setVisibleColumns(columns.filter((c) => !c.initialHide).map((c) => c.headerName ?? c.field));
        setTableData({ ...newData, rows: displayRows, columns });
      } else {
        setVisibleColumns(newColumns?.filter((c) => !c.initialHide).map((c) => c.headerName ?? c.field) ?? []);
        setTableData({ ...newData, rows: displayRows, columns: newColumns });
      }
    };

    // Set up listener for tree children loaded
    const handleTreeChildrenLoaded = (data: { parentNodeId: string; children: Table.RowData[] }) => {
      const { parentNodeId, children } = data;
      if (gridRef.current?.api && children?.length > 0) {
        // Find the parent node in the grid
        let parentRowIndex = -1;
        let parentDepth = 0;
        gridRef.current.api.forEachNode((node: any) => {
          if (node.data._tree?.id === parentNodeId) {
            parentRowIndex = node.rowIndex!;
            parentDepth = node.data._tree?.depth ?? 0;
          }
        });

        if (parentRowIndex !== -1) {
          // Process children into tree structure
          const processedChildren = children.map((child: Table.RowData) => ({
            ...child,
            _tree: {
              ...child._tree,
              parentId: parentNodeId,
              depth: parentDepth + 1,
            },
          }));

          // Add children using applyTransaction
          gridRef.current.api.applyTransaction({
            add: processedChildren,
            addIndex: parentRowIndex + 1,
          });
        }
      }
    };

    // Handle requests from the extension that need responses
    const handleExtensionRequest = (command: string, requestId: string, payload?: any) => {
      let responsePayload: any = null;
      let error: string | null = null;

      try {
        switch (command) {
          case "get-page-size":
            responsePayload = gridRef.current?.api.paginationGetPageSize() ?? 1000;
            break;
          case "set-page-size":
            if (gridRef.current?.api) {
              gridRef.current.api.setGridOption("paginationPageSize", payload);
              responsePayload = true;
            } else {
              error = "Grid API not available";
              responsePayload = false;
            }
            break;
          case "get-page":
            responsePayload = gridRef.current?.api.paginationGetCurrentPage() ?? 0;
            break;
          case "set-page":
            if (gridRef.current?.api) {
              gridRef.current.api.paginationGoToPage(payload);
              responsePayload = true;
            } else {
              error = "Grid API not available";
              responsePayload = false;
            }
            break;
          case "get-grid-state":
            responsePayload = gridRef.current?.api.getState();
            break;
          case "set-grid-state":
            if (gridRef.current?.api) {
              gridRef.current.api.setState(payload);
              responsePayload = true;
            } else {
              error = "Grid API not available";
              responsePayload = false;
            }
            break;
          case "get-selected-rows":
            if (gridRef.current?.api) {
              responsePayload = gridRef.current.api.getSelectedRows();
            } else {
              error = "Grid API not available";
            }
            break;

          case "get-filtered-rows":
            if (gridRef.current?.api) {
              const filteredRows: Table.RowData[] = [];
              gridRef.current.api.forEachNodeAfterFilterAndSort((row: any) => filteredRows.push(row.data));
              responsePayload = filteredRows;
            } else {
              error = "Grid API not available";
            }
            break;

          case "get-all-rows":
            responsePayload = tableDataRef.current?.rows || [];
            break;

          case "get-visible-columns":
            responsePayload = visibleColumns;
            break;

          case "get-column-state":
            if (gridRef.current?.api) {
              responsePayload = gridRef.current.api.getColumnState();
            } else {
              error = "Grid API not available";
            }
            break;

          case "get-selection-count":
            responsePayload = selectionCount;
            break;

          case "get-grid-info":
            responsePayload = {
              totalRows: tableDataRef.current?.rows?.length || 0,
              visibleRows: gridRef.current?.api
                ? (() => {
                    let count = 0;
                    gridRef.current.api.forEachNodeAfterFilterAndSort(() => count++);
                    return count;
                  })()
                : 0,
              selectedRows: selectionCount,
              visibleColumns: visibleColumns.length,
              totalColumns: tableDataRef.current?.columns?.length || 0,
            };
            break;

          case "get-row-by-index":
            if (payload?.index !== undefined && tableDataRef.current?.rows) {
              const row = tableDataRef.current.rows[payload.index];
              responsePayload = row || null;
            } else {
              error = "Row index not provided or invalid";
            }
            break;

          case "export-data":
            if (gridRef.current?.api) {
              const format = payload?.format || "csv";
              if (format === "csv") {
                responsePayload = gridRef.current.api.getDataAsCsv();
              } else {
                error = `Unsupported export format: ${format}`;
              }
            } else {
              error = "Grid API not available";
            }
            break;

          case "pin-rows":
            if (gridRef.current?.api && payload?.rows) {
              try {
                // Get current pinned rows
                const currentPinnedRows = gridRef.current.api.getGridOption("pinnedTopRowData") || [];

                // Convert payload rows object to array and filter out any existing pinned rows
                const newRowsToPin = Object.values(payload.rows) as Table.RowData[];
                const existingPinnedIds = new Set(currentPinnedRows.map((row: any) => JSON.stringify(row)));
                const filteredNewRows = newRowsToPin.filter((row) => !existingPinnedIds.has(JSON.stringify(row)));

                // Combine existing pinned rows with new ones
                const updatedPinnedRows = [...currentPinnedRows, ...filteredNewRows];

                // Set the updated pinned rows
                gridRef.current.api.setGridOption("pinnedTopRowData", updatedPinnedRows);
                responsePayload = true;
              } catch (err) {
                error = `Failed to pin rows: ${err instanceof Error ? err.message : String(err)}`;
                responsePayload = false;
              }
            } else {
              error = "Grid API not available or no rows provided";
              responsePayload = false;
            }
            break;

          case "unpin-rows":
            if (gridRef.current?.api && payload?.rows) {
              try {
                // Get current pinned rows
                const currentPinnedRows = gridRef.current.api.getGridOption("pinnedTopRowData") || [];

                // Convert payload rows object to array for comparison
                const rowsToUnpin = Object.values(payload.rows) as Table.RowData[];
                const unpinIds = new Set(rowsToUnpin.map((row) => JSON.stringify(row)));

                // Filter out rows that should be unpinned
                const remainingPinnedRows = currentPinnedRows.filter((row: any) => !unpinIds.has(JSON.stringify(row)));

                // Set the updated pinned rows
                gridRef.current.api.setGridOption("pinnedTopRowData", remainingPinnedRows);
                responsePayload = true;
              } catch (err) {
                error = `Failed to unpin rows: ${err instanceof Error ? err.message : String(err)}`;
                responsePayload = false;
              }
            } else {
              error = "Grid API not available or no rows provided";
              responsePayload = false;
            }
            break;

          case "get-pinned-rows":
            if (gridRef.current?.api) {
              responsePayload = gridRef.current.api.getGridOption("pinnedTopRowData") || [];
            } else {
              error = "Grid API not available";
            }
            break;

          case "set-pinned-rows":
            if (gridRef.current?.api && payload?.rows !== undefined) {
              try {
                // Set the pinned rows to the provided array (could be empty to clear all)
                gridRef.current.api.setGridOption("pinnedTopRowData", payload.rows);
                responsePayload = true;
              } catch (err) {
                error = `Failed to set pinned rows: ${err instanceof Error ? err.message : String(err)}`;
                responsePayload = false;
              }
            } else {
              error = "Grid API not available or no rows provided";
              responsePayload = false;
            }
            break;

          default:
            error = `Unknown command: ${command}`;
            break;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      // Send response back to extension
      if (error) {
        messageHandler.send("error", error);
      } else {
        Messenger.sendWithReqId(`${command}-response`, requestId, responsePayload);
      }
    };

    window.addEventListener("message", (event: any): void => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!("data" in event)) {
        return;
      }

      const response = event.data;
      switch (response.command) {
        // Handle extension layer requests/events
        case "ondatachanged":
          handleDataChanged(response.data);
          break;
        case "treeChildrenLoaded":
          handleTreeChildrenLoaded(response.data);
          break;
        case "check-condition-for-action":
        case "check-hide-condition-for-action":
        case "get-dynamic-title-for-action":
        case "GET_LOCALIZATION":
          // Commands handled at extension layer by MessageHandler.request
          break;
        default:
          if (response.requestId && response.command) {
            handleExtensionRequest(response.command, response.requestId, response.payload);
          }
          break;
      }
    });

    messageHandler.send("ready");
    getLocalizationContents();
  }, [localization]);

  // Cleanup tooltip observer and custom tooltip element on component unmount
  useEffect(() => {
    return () => {
      if (tooltipCleanupRef.current) {
        if (tooltipCleanupRef.current instanceof MutationObserver) {
          tooltipCleanupRef.current.disconnect();
        } else {
          clearInterval(tooltipCleanupRef.current as NodeJS.Timeout);
        }
        tooltipCleanupRef.current = null;
      }
      document.getElementById("header-icon-tooltip")?.remove();
    };
  }, []);

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

  const onGridReady = () => {
    messageHandler.send("api-ready");

    // ---------------------------------------------------------------
    // Tooltip setup for AG Grid header filter and sort icons
    // Uses WeakMap for correct listener cleanup + MutationObserver
    // to react to sort state changes and column DOM mutations instead
    // of a polling interval.
    // ---------------------------------------------------------------

    // Create a shared floating tooltip element
    let tooltipEl = document.getElementById("header-icon-tooltip");
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = "header-icon-tooltip";
      tooltipEl.style.cssText = `
        position: fixed;
        background-color: var(--vscode-editorHoverWidget-background, #252526);
        border: 1px solid var(--vscode-editorHoverWidget-border, #3e3e42);
        color: var(--vscode-editorHoverWidget-foreground, #cccccc);
        padding: 0.5em 0.75em;
        border-radius: 3px;
        font-size: 0.9em;
        z-index: 10001;
        display: none;
        pointer-events: none;
        white-space: normal;
        word-wrap: break-word;
        max-width: 250px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.4;
      `;
      document.body.appendChild(tooltipEl);
      console.log("Tooltip element created and appended to body");
    }
    const tooltip = tooltipEl;

    // WeakMap stores the actual function references keyed by element so
    // removeEventListener receives the exact same reference that was added.
    // Using dataset (as before) coerces functions to strings and silently
    // fails on removal, causing listener leaks every interval tick.
    const listenerMap = new WeakMap<HTMLElement, { enter: (e: MouseEvent) => void; leave: () => void }>();

    const attachTooltip = (el: HTMLElement, text: string) => {
      // Remove previous listeners if this element was already processed
      const prev = listenerMap.get(el);
      if (prev) {
        el.removeEventListener("mouseenter", prev.enter);
        el.removeEventListener("mouseleave", prev.leave);
      }

      const enter = (e: MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        tooltip.textContent = text;
        tooltip.style.display = "block";

        // Center horizontally on the element
        const tooltipWidth = 250;
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        // Ensure tooltip doesn't go off-screen
        if (left < 0) left = 5;
        if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 5;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        console.log(`Tooltip showing: "${text}" at (${left}, ${rect.bottom + 8})`);
      };

      const leave = () => {
        tooltip.style.display = "none";
        console.log("Tooltip hidden");
      };

      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
      listenerMap.set(el, { enter, leave });
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";
    };

    const applyTooltips = () => {
      console.log("[Tooltip] applyTooltips called, tooltip element visible:", tooltip.style.display !== "none");

      // Filter icons - all .ag-header-icon elements with ag-header-cell-filter-button class
      const filterIcons = document.querySelectorAll<HTMLElement>(".ag-header-icon.ag-header-cell-filter-button");
      console.log(`[Tooltip] Found ${filterIcons.length} filter icons`);
      filterIcons.forEach((icon, idx) => {
        attachTooltip(icon, l10n.t("Filter"));
        console.log(`[Tooltip] Attached "Filter" tooltip to filter icon ${idx}`);
      });

      // Sort tooltips - Debug and find all possible sort-related elements
      console.log("[Tooltip] Debugging sort icon detection...");
      
      // Log all .ag-header-icon elements to see what's available
      const allHeaderIcons = document.querySelectorAll(".ag-header-icon");
      console.log(`[Tooltip] Total .ag-header-icon elements found: ${allHeaderIcons.length}`);
      allHeaderIcons.forEach((icon, idx) => {
        console.log(`[Tooltip] Header icon ${idx} classes:`, icon.className);
      });

      // Try multiple possible sort icon selectors
      const sortIconSelectors = [
        ".ag-header-icon.ag-sort-ascending-icon",
        ".ag-header-icon.ag-sort-descending-icon",
        ".ag-header-icon.ag-sort-none-icon",
        ".ag-icon.ag-icon-asc",
        ".ag-icon.ag-icon-desc",
        ".ag-icon.ag-icon-none",
        ".ag-sort-indicator-icon",
        ".ag-header-cell-sortable .ag-header-icon:not(.ag-header-cell-filter-button)"
      ];

      let sortIcons: NodeListOf<HTMLElement> | null = null;
      let usedSelector = "";

      for (const selector of sortIconSelectors) {
        const icons = document.querySelectorAll<HTMLElement>(selector);
        if (icons.length > 0) {
          sortIcons = icons;
          usedSelector = selector;
          console.log(`[Tooltip] Found ${icons.length} sort icons using selector: ${selector}`);
          break;
        }
      }

      if (sortIcons && sortIcons.length > 0) {
        sortIcons.forEach((icon, idx) => {
          // Determine sort state from the icon's class or parent cell
          const parentCell = icon.closest(".ag-header-cell");
          const ariaSort = parentCell?.getAttribute("aria-sort");
          let tooltip_text = l10n.t("Sort");
          
          if (ariaSort === "ascending" || icon.classList.contains("ag-sort-ascending-icon") || icon.classList.contains("ag-icon-asc")) {
            tooltip_text = l10n.t("Sorted Ascending");
          } else if (ariaSort === "descending" || icon.classList.contains("ag-sort-descending-icon") || icon.classList.contains("ag-icon-desc")) {
            tooltip_text = l10n.t("Sorted Descending");
          }
          
          attachTooltip(icon, tooltip_text);
          console.log(`[Tooltip] Attached "${tooltip_text}" tooltip to sort icon ${idx} (selector: ${usedSelector})`);
        });
      } else {
        // Fallback: Look for sortable headers and attach to the entire header area
        const headerCells = document.querySelectorAll<HTMLElement>(".ag-header-cell[col-id]:not([col-id='actions'])");
        console.log(`[Tooltip] No sort icons found, checking ${headerCells.length} sortable column headers`);
        
        headerCells.forEach((cell, idx) => {
          // Check if this column is sortable (has sortable in class or is not explicitly non-sortable)
          if (!cell.classList.contains("ag-header-cell-not-sortable")) {
            const ariaSort = cell.getAttribute("aria-sort");
            let tooltip_text = l10n.t("Sort");
            
            if (ariaSort === "ascending") {
              tooltip_text = l10n.t("Sorted Ascending");
            } else if (ariaSort === "descending") {
              tooltip_text = l10n.t("Sorted Descending");
            }
            
            // Attach to the header cell itself as a fallback
            attachTooltip(cell, tooltip_text);
            console.log(`[Tooltip] Attached "${tooltip_text}" tooltip to sortable header cell ${idx} (fallback)`);
          }
        });
      }

      // Action bar button tooltips - add tooltips to action buttons in the top bar
      console.log("[Tooltip] Adding tooltips to action bar buttons...");
      
      // Find action buttons by their appearance and content
      const actionButtons = document.querySelectorAll<HTMLElement>('vscode-button[appearance="primary"], vscode-button[appearance="secondary"]');
      console.log(`[Tooltip] Found ${actionButtons.length} action buttons`);
      
      actionButtons.forEach((button, idx) => {
        const buttonText = button.textContent?.trim();
        if (buttonText && buttonText !== "") {
          // Use the button text as the tooltip, but make it more descriptive
          let tooltipText = buttonText;
          
          // Add more descriptive tooltips based on common button text
          if (buttonText.toLowerCase().includes("open")) {
            tooltipText = l10n.t("Open selected items");
          } else if (buttonText.toLowerCase().includes("back")) {
            tooltipText = l10n.t("Go back");
          } else if (buttonText.toLowerCase().includes("pin")) {
            tooltipText = l10n.t("Pin selected rows");
          } else if (buttonText.toLowerCase().includes("unpin")) {
            tooltipText = l10n.t("Unpin selected rows");
          }
          
          attachTooltip(button, tooltipText);
          console.log(`[Tooltip] Attached "${tooltipText}" tooltip to action button ${idx}: "${buttonText}"`);
        }
      });

      // Settings button (gear icon) tooltip
      const settingsButtons = document.querySelectorAll<HTMLElement>('.codicon-gear');
      console.log(`[Tooltip] Found ${settingsButtons.length} settings buttons`);
      
      settingsButtons.forEach((button, idx) => {
        // The gear icon is inside a button, so find the parent button element
        const parentButton = button.closest('vscode-button');
        if (parentButton && parentButton instanceof HTMLElement) {
          attachTooltip(parentButton, l10n.t("Column settings"));
          console.log(`[Tooltip] Attached "Column settings" tooltip to settings button ${idx}`);
        }
      });
    };

    const headerRoot = document.querySelector(".ag-header");
    if (headerRoot) {
      console.log("[Tooltip] Setting up MutationObserver on header");

      // Disconnect any previous observer stored in the ref
      if (tooltipCleanupRef.current instanceof MutationObserver) {
        tooltipCleanupRef.current.disconnect();
        console.log("[Tooltip] Disconnected previous observer");
      }

      const observer = new MutationObserver((mutations) => {
        console.log(`[Tooltip] MutationObserver fired with ${mutations.length} mutations`);
        applyTooltips();
      });

      observer.observe(headerRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      tooltipCleanupRef.current = observer;
      console.log("[Tooltip] MutationObserver set up successfully");
    } else {
      console.log("[Tooltip] WARNING: .ag-header element not found!");
    }

    // Initial application — slight delay lets AG Grid finish rendering icons
    console.log("[Tooltip] Scheduling initial applyTooltips call");
    setTimeout(() => {
      console.log("[Tooltip] Running initial applyTooltips");

      // Debug: log the header structure
      const header = document.querySelector(".ag-header");
      console.log("[Tooltip] Header element:", header);
      console.log("[Tooltip] Header HTML (first 500 chars):", header?.innerHTML.substring(0, 500));

      // Debug: check for various icon types
      console.log("[Tooltip] All .ag-header-icon elements:", document.querySelectorAll(".ag-header-icon").length);
      console.log(
        "[Tooltip] .ag-header-icon.ag-header-cell-filter-button:",
        document.querySelectorAll(".ag-header-icon.ag-header-cell-filter-button").length
      );
      console.log("[Tooltip] .ag-header-cell-menu-button:", document.querySelectorAll(".ag-header-cell-menu-button").length);
      console.log("[Tooltip] [aria-sort]:", document.querySelectorAll("[aria-sort]").length);

      applyTooltips();
    }, 100);
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
      />
      {tableData ? (
        <AgGridReact
          {...tableProps(contextMenu, setSelectionCount, tableData)}
          ref={gridRef}
          getLocaleText={getLocaleText}
          onGridReady={onGridReady}
        />
      ) : null}
    </div>
  );
};
