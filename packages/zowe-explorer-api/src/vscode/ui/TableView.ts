/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { UriPair, WebView } from "./WebView";
import { Event, EventEmitter, ExtensionContext, env } from "vscode";
import { randomUUID } from "crypto";
import { diff } from "deep-object-diff";
import { TableMediator } from "./utils/TableMediator";
import type { IZoweTreeNode } from "../../tree";
import type * as imperative from "@zowe/imperative";
import * as vscode from "vscode";
import * as fs from "fs";
import { Logger } from "@zowe/imperative";
import type { IDataSetSource } from "../../dataset";
import { Gui } from "../../globals/Gui";
export namespace Table {
    /* Tree node structure for hierarchical data */
    export type TreeNodeData = {
        id?: string;
        parentId?: string;
        depth?: number;
        hasChildren?: boolean;
        isExpanded?: boolean;
    };

    /* The types of supported content for the table and how they are represented in callback functions. */
    export type ContentTypes = string | number | boolean | string[] | RowData[] | TreeNodeData | undefined;
    export type RowData = Record<string | number, ContentTypes> & {
        children?: RowData[];
        _tree?: TreeNodeData;
    };
    export type ColData = RowData;

    export type RowInfo = {
        index?: number;
        row: RowData;
    };

    /* Defines the supported callbacks and related types. */
    export type CallbackTypes = "single-row" | "multi-row" | "column" | "cell" | "no-selection";
    export type SingleRowCallback = {
        /** The type of callback */
        typ: "single-row";
        /** The callback function itself - called from within the webview container. */
        fn: (view: Table.View, row: RowInfo) => void | PromiseLike<void>;
    };
    export type MultiRowCallback = {
        /** The type of callback */
        typ: "multi-row";
        /** The callback function itself - called from within the webview container. */
        fn: (view: Table.View, rows: Record<number, RowData>) => void | PromiseLike<void>;
    };
    export type CellCallback = {
        /** The type of callback */
        typ: "cell";
        /** The callback function itself - called from within the webview container. */
        fn: (view: Table.View, cell: ContentTypes) => void | PromiseLike<void>;
    };
    export type ColumnCallback = {
        /** The type of callback */
        typ: "column";
        /** The callback function itself - called from within the webview container. */
        fn: (view: Table.View, col: ColData) => void | PromiseLike<void>;
    };
    export type NoSelectionCallback = {
        /** The type of callback */
        typ: "no-selection";
        /** The callback function itself - called from within the webview container. */
        fn: (view: Table.View) => void | PromiseLike<void>;
    };

    export type Callback = SingleRowCallback | MultiRowCallback | CellCallback | NoSelectionCallback;

    /** Conditional callback function - whether an action or option should be rendered. */
    export type Conditional = ((data: RowData[] | RowData | ContentTypes) => boolean | Promise<boolean>) | string;

    // Defines the supported actions and related types.
    export type ActionKind = "primary" | "secondary" | "icon";

    /** Dynamic title function - returns the title based on the selected data. */
    export type DynamicTitle = ((data: RowData[] | RowData | ContentTypes) => string | Promise<string>) | string;

    export type Action = {
        title: DynamicTitle;
        command: string;
        /** A function that's invoked with row data. It should return `true` if the action can be used on the given row(s). */
        condition?: Conditional;
        /** A function that's invoked with row data. It should return `true` if the action must be hidden from the UI. */
        hideCondition?: Conditional;
        type?: ActionKind;
        callback: Callback;
    };
    export type ContextMenuOption = Omit<Action, "type"> & { dataType?: CallbackTypes };

    // Helper types to allow passing function properties to builder/view functions.

    /** @deprecated Use `Action` type instead. */
    export type ActionOpts = Action;
    /** @deprecated Use `ContextMenuOption` type instead. */
    export type ContextMenuOpts = ContextMenuOption;

    // Context namespace for table extensibility
    export namespace Context {
        /**
         * Table identifiers for built-in Zowe Explorer tables
         */
        export enum Identifiers {
            DATA_SETS = "data-sets",
            DATA_SET_MEMBERS = "data-set-members",
            JOBS = "jobs",
            SEARCH_RESULTS = "search-results",
        }

        /**
         * Base interface for table context information passed to action providers
         */
        export interface IBaseData {
            /** The type of table being displayed */
            tableId: string;
            /** Additional properties specific to the table implementation */
            [key: string]: any;
        }

        /**
         * Context information for data set-related tables
         */
        export interface DataSet extends IBaseData {
            /** The current table type (data sets or members) */
            tableType: "dataSets" | "members" | null;
            /** The data source being used by the table */
            dataSource: IDataSetSource;
            /** Profile information if available */
            profile?: imperative.IProfileLoaded;
            /** Profile name if available */
            profileName?: string;
            /** Tree node if the table is derived from a tree node */
            treeNode?: IZoweTreeNode;
        }

        /**
         * Context information for job-related tables
         */
        export interface Job extends IBaseData {
            /** Profile information if available */
            profile?: imperative.IProfileLoaded;
            /** Profile name if available */
            profileName?: string;
            /** Tree node if the table is derived from a tree node */
            treeNode?: IZoweTreeNode;
        }

        /**
         * Context information for search result tables
         */
        export interface Search extends IBaseData {
            /** The search query that generated these results */
            searchQuery?: string;
            /** The type of search performed */
            searchType?: "data-set" | "member";
            /** Profile information if available */
            profile?: imperative.IProfileLoaded;
            /** Profile name if available */
            profileName?: string;
        }

        // Type Guard Functions

        /**
         * Type guard to check if context is a Dataset context
         */
        export function isDataSet(context: IBaseData | undefined): context is DataSet {
            return context != null && "tableType" in context && "dataSource" in context;
        }

        /**
         * Type guard to check if context is a Job context
         */
        export function isJob(context: IBaseData | undefined): context is Job {
            return context != null && context.tableId === Identifiers.JOBS;
        }

        /**
         * Type guard to check if context is a Search context
         */
        export function isSearch(context: IBaseData | undefined): context is Search {
            return context != null && context.tableId === Identifiers.SEARCH_RESULTS && "searchQuery" in context;
        }

        // Helper Functions

        /**
         * Utility function to safely get dataset context with type checking
         */
        export function getDataset(context: IBaseData | undefined): DataSet | undefined {
            return isDataSet(context) ? context : undefined;
        }

        /**
         * Utility function to safely get job context with type checking
         */
        export function getJob(context: IBaseData | undefined): Job | undefined {
            return isJob(context) ? context : undefined;
        }

        /**
         * Utility function to safely get search context with type checking
         */
        export function getSearch(context: IBaseData | undefined): Search | undefined {
            return isSearch(context) ? context : undefined;
        }
    }

    // -- Misc types --

    /** Value formatter callback. Expects the exact display value to be returned. */
    export type ValueFormatter = (data: { value: ContentTypes }) => string;
    export type Positions = "left" | "right";

    /**
     * Returns a date comparison function for sorting date columns.
     * @returns A function that compares two date values
     */
    export function getDateComparator(): (valueA: any, valueB: any, nodeA: any, nodeB: any, isDescending: boolean) => number {
        return (valueA: any, valueB: any, nodeA: any, nodeB: any, isDescending: boolean): number => {
            if (valueA == null && valueB == null) return 0;
            if (valueA == null) return isDescending ? -1 : 1;
            if (valueB == null) return isDescending ? 1 : -1;

            const dateA = new Date(valueA);
            const dateB = new Date(valueB);

            // Handle invalid dates
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;

            return dateA.getTime() - dateB.getTime();
        };
    }

    /** The column type definition. All available properties are offered for AG Grid columns. */
    export type Column = {
        field: string;
        type?: string | string[];
        cellDataType?: boolean | string;
        valueFormatter?: string;
        checkboxSelection?: boolean;
        icons?: { [key: string]: string };
        suppressNavigable?: boolean;
        context?: any;

        // Locking and edit variables
        hide?: boolean;
        initialHide?: boolean;
        lockVisible?: boolean;
        lockPosition?: boolean | Positions;
        suppressMovable?: boolean;
        editable?: boolean;
        singleClickEdit?: boolean;

        filter?: boolean;
        floatingFilter?: boolean;

        // Headers

        // "field" variable will be used as header name if not provided
        headerName?: string;
        headerTooltip?: string;
        headerClass?: string | string[];
        wrapHeaderText?: boolean;
        autoHeaderHeight?: boolean;
        headerCheckboxSelection?: boolean;

        // Pinning
        pinned?: boolean | Positions | null;
        initialPinned?: boolean | Positions;
        lockPinned?: boolean;

        // Row dragging
        rowDrag?: boolean;
        dndSource?: boolean;

        // Sorting
        sortable?: boolean;
        sort?: "asc" | "desc";
        initialSort?: "asc" | "desc";
        sortIndex?: number | null;
        initialSortIndex?: number;
        sortingOrder?: ("asc" | "desc")[];
        comparator?: string;
        unSortIcon?: boolean;
        useDateComparison?: boolean;

        // Column/row spanning
        colSpan?: string;
        rowSpan?: string;

        // Sizing
        width?: number;
        initialWidth?: number;
        minWidth?: number;
        maxWidth?: number;
        flex?: number;
        initialFlex?: number;
        resizable?: boolean;
        suppressSizeToFit?: boolean;
        suppressAutoSize?: boolean;
    };
    export type ColumnOpts = Omit<Column, "comparator" | "colSpan" | "rowSpan" | "valueFormatter"> & {
        comparator?: (valueA: any, valueB: any, nodeA: any, nodeB: any, isDescending: boolean) => number;
        colSpan?: (params: any) => number;
        rowSpan?: (params: any) => number;
        valueFormatter?: ValueFormatter;
        useDateComparison?: boolean;
    };

    export interface SizeColumnsToFitGridStrategy {
        type: "fitGridWidth";
        // Default minimum width for every column (does not override the column minimum width).
        defaultMinWidth?: number;
        // Default maximum width for every column (does not override the column maximum width).
        defaultMaxWidth?: number;
        // Provide to limit specific column widths when sizing.
        columnLimits?: SizeColumnsToFitGridColumnLimits[];
    }

    export interface SizeColumnsToFitGridColumnLimits {
        colId: string;
        // Minimum width for this column (does not override the column minimum width)
        minWidth?: number;
        // Maximum width for this column (does not override the column maximum width)
        maxWidth?: number;
    }

    export interface SizeColumnsToFitProvidedWidthStrategy {
        type: "fitProvidedWidth";
        width: number;
    }

    export interface SizeColumnsToContentStrategy {
        type: "fitCellContents";
        // If true, the header won't be included when calculating the column widths.
        skipHeader?: boolean;
        // If not provided will auto-size all columns. Otherwise will size the specified columns.
        colIds?: string[];
    }

    // AG Grid: Optional properties
    export type GridProperties = {
        /** Allow reordering and pinning columns by dragging columns from the Columns Tool Panel to the grid */
        allowDragFromColumnsToolPanel?: boolean;
        /** Number of pixels to add a column width after the auto-sizing calculation */
        autoSizePadding?: number;
        /**
         * Auto-size the columns when the grid is loaded. Can size to fit the grid width, fit a provided width or fit the cell contents.
         * Read once during initialization.
         */
        autoSizeStrategy?: SizeColumnsToFitGridStrategy | SizeColumnsToFitProvidedWidthStrategy | SizeColumnsToContentStrategy;
        /** Set to 'shift' to have shift-resize as the default resize operation */
        colResizeDefault?: "shift";
        /** Changes the display type of the column menu. 'new' displays the main list of menu items; 'legacy' displays a tabbed menu */
        columnMenu?: "legacy" | "new";
        /** Set this to `true` to enable debugging information from the grid */
        debug?: boolean;
        /** Set this to `true` to allow checkbox selection, no matter what row is visible. */
        selectEverything?: boolean;
        /** Set this to suppress row-click selection, in favor of checkbox selection. */
        suppressRowClickSelection?: boolean;
        /** The height in pixels for the rows containing floating filters. */
        floatingFiltersHeight?: number;
        /** The height in pixels for the rows containing header column groups. */
        groupHeaderHeight?: number;
        /** The height in pixels for the row contianing the column label header. Default provided by the AG Grid theme. */
        headerHeight?: number;
        /** Show/hide the "Loading" overlay */
        loading?: boolean;
        /** Map of key:value pairs for localizing grid text. Read once during initialization. */
        localeText?: { [key: string]: string };
        /** Keeps the order of columns maintained after new Column Definitions are updated. */
        maintainColumnOrder?: boolean;
        /** Whether the table should be split into pages. */
        pagination?: boolean;
        /**
         * Set to `true` so that the number of rows to load per page is automatically adjusted by the grid.
         * If `false`, `paginationPageSize` is used.
         */
        paginationAutoPageSize?: boolean;
        /** How many rows to load per page */
        paginationPageSize?: number;
        /**
         * Set to an array of values to show the page size selector with custom list of possible page sizes.
         * Set to `true` to show the page size selector with the default page sizes `[20, 50, 100]`.
         * Set to `false` to hide the page size selector.
         */
        paginationPageSizeSelector?: number[] | boolean;
        /** If defined, rows are filtered using this text as a Quick Filter. */
        quickFilterText?: string;
        /** Enable selection of rows in table */
        rowSelection?: "single" | "multiple";
        /** Set to `true` to skip the `headerName` when `autoSize` is called by default. Read once during initialization. */
        skipHeaderOnAutoSize?: boolean;
        /**
         * Suppresses auto-sizing columns for columns - when enabled, double-clicking a column's header's edge will not auto-size.
         * Read once during initialization.
         */
        suppressAutoSize?: boolean;
        suppressColumnMoveAnimation?: boolean;
        /** If `true`, when you dreag a column out of the grid, the column is not hidden */
        suppressDragLeaveHidesColumns?: boolean;
        /** If `true`, then dots in field names are not treated as deep references, allowing you to use dots in your field name if preferred. */
        suppressFieldDotNotation?: boolean;
        /**
         * When `true`, the column menu button will always be shown.
         * When `false`, the column menu button will only show when the mouse is over the column header.
         * If `columnMenu = 'legacy'`, this will default to `false` instead of `true`.
         */
        suppressMenuHide?: boolean;
        /** Set to `true` to suppress column moving (fixed position for columns) */
        suppressMovableColumns?: boolean;
        /** Enables custom tree mode support (custom cell renderer). */
        customTreeMode?: boolean;
        /** The 'field' of the column to be used for displaying the tree hierarchy in custom tree mode. */
        customTreeColumnField?: string;
        /** Initial depth of expansion for custom tree mode. 0 for all collapsed (default), -1 for all expanded. */
        customTreeInitialExpansionDepth?: number;
    };

    export type ViewOpts = {
        /** Actions to apply to the given row or column index */
        actions: Record<number | "all", Action[]>;
        /** Column definitions for the top of the table */
        columns: Column[];
        /** Context menu options for rows in the table */
        contextOpts: Record<number | "all", ContextMenuOption[]>;
        /** The row data for the table. Each row contains a set of variables corresponding to the data for each column in that row. */
        rows: RowData[];
        /** The display title for the table */
        title?: string;
        /** AG Grid-specific properties */
        options?: GridProperties;
    };

    export type EditEvent = {
        rowIndex: number;
        field: string;
        value: ContentTypes;
        oldValue?: ContentTypes;
    };

    /**
     * A class that acts as a controller between the extension and the table view. Based off of the {@link WebView} class.
     *
     * @remarks
     * ## Usage
     *
     * To easily configure a table before creating a table view,
     * use the `TableBuilder` class to prepare table data and build an instance.
     */
    export class View extends WebView {
        private lastUpdated: ViewOpts;
        private data: ViewOpts = {
            actions: {
                all: [],
            },
            contextOpts: {
                all: [],
            },
            rows: [],
            columns: [],
            title: "",
        };
        private onDidReceiveMessageEmitter: EventEmitter<object> = new EventEmitter();
        private onTableDataReceivedEmitter: EventEmitter<Partial<ViewOpts>> = new EventEmitter();
        private onTableDisplayChangedEmitter: EventEmitter<RowData | RowData[]> = new EventEmitter();
        private onTableDataEditedEmitter: EventEmitter<EditEvent> = new EventEmitter();
        public onDidReceiveMessage: Event<object> = this.onDidReceiveMessageEmitter.event;
        public onTableDisplayChanged: Event<RowData | RowData[]> = this.onTableDisplayChangedEmitter.event;
        public onTableDataReceived: Event<Partial<ViewOpts>> = this.onTableDataReceivedEmitter.event;
        public onTableDataEdited: Event<EditEvent> = this.onTableDataEditedEmitter.event;
        private pendingRequests: Record<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = {};

        private uuid: string;
        private apiReady: boolean = false;
        private apiReadyResolvers: Array<() => void> = [];

        public getUris(): UriPair {
            return this.uris;
        }

        public getHtml(): string {
            return this.htmlContent;
        }

        public constructor(context: ExtensionContext, isView?: boolean, data?: ViewOpts) {
            super(data?.title ?? "Table view", "table-view", context, {
                onDidReceiveMessage: (message) => this.onMessageReceived(message),
                isView,
                unsafeEval: true,
            });
            if (data) {
                this.data = { ...this.data, ...data };
            }
        }

        private async evaluateCondition(
            condition: Conditional,
            conditionData: RowData[] | RowData | ContentTypes,
            actionCommand: string,
            defaultValue: boolean
        ): Promise<boolean> {
            try {
                let conditionResult: boolean | Promise<boolean>;

                if (typeof condition === "string") {
                    try {
                        // Reason for no-implied-eval: Need to keep support for string conditions to prevent breaking changes
                        // However, they are not recommended and should be avoided if possible
                        // eslint-disable-next-line @typescript-eslint/no-implied-eval
                        const condFn = new Function("data", `return (${condition})(data);`);
                        conditionResult = condFn(conditionData);
                    } catch (error) {
                        Logger.getImperativeLogger().warn(`Failed to evaluate string condition for action ${actionCommand}:`, error);
                        return defaultValue;
                    }
                } else {
                    conditionResult = condition(conditionData);
                }

                return await Promise.resolve(conditionResult);
            } catch (error) {
                Logger.getImperativeLogger().warn(`Failed to evaluate condition for action ${actionCommand}:`, error);
                return defaultValue;
            }
        }

        private getConditionData(payload: any): RowData[] | RowData | ContentTypes {
            if (payload.row) {
                return payload.row as RowData;
            } else if (payload.rows) {
                return payload.rows as RowData[];
            } else if (payload.cell !== undefined) {
                return payload.cell as ContentTypes;
            }
            return this.data.rows;
        }

        /**
         * (Receiver) message handler for the table view.
         * Used to dispatch client-side updates of the table to subscribers when the table's display has changed.
         *
         * @param message The message received from the webview
         */
        public async onMessageReceived(message: any): Promise<void> {
            if (!("command" in message)) {
                return;
            }

            const { command, requestId, payload } = message;

            // Handle responses to pending requests
            if (requestId && this.pendingRequests[requestId]) {
                const { resolve, reject } = this.pendingRequests[requestId];
                delete this.pendingRequests[requestId];

                if (message.error) {
                    reject(new Error(message.error));
                } else {
                    resolve(payload);
                }
                return;
            }

            switch (command) {
                // "check-condition-for-action" command: Check if the given action ID (command) should be usable.
                case "check-condition-for-action":
                    {
                        const allActions = Object.values(this.data.actions).flat();
                        const allContextOpts = Object.values(this.data.contextOpts).flat();
                        const action = [...allActions, ...allContextOpts].find((act) => act.command === payload.actionId);

                        let result = true;
                        if (action?.condition) {
                            const conditionData = this.getConditionData(payload);
                            result = await this.evaluateCondition(action.condition, conditionData, action.command, false);
                        }

                        (this.panel ?? this.view).webview.postMessage({
                            command: "check-condition-for-action",
                            requestId,
                            payload: result,
                        });
                    }
                    return;
                // "get-dynamic-title-for-action" command: Get the dynamic title for the given action ID (command).
                case "get-dynamic-title-for-action":
                    {
                        const allActions = Object.values(this.data.actions).flat();
                        const allContextOpts = Object.values(this.data.contextOpts).flat();
                        const action = [...allActions, ...allContextOpts].find((act) => act.command === payload.actionId);

                        let result = action?.command || "Action";
                        if (action?.title) {
                            if (typeof action.title === "string") {
                                result = action.title;
                            } else {
                                try {
                                    const conditionData = this.getConditionData(payload);
                                    const titleResult = await Promise.resolve(action.title(conditionData));
                                    result = titleResult;
                                } catch (error) {
                                    Logger.getImperativeLogger().warn(`Failed to evaluate dynamic title for action ${action.command}:`, error);
                                    result = action.command;
                                }
                            }
                        }

                        (this.panel ?? this.view).webview.postMessage({
                            command: "get-dynamic-title-for-action",
                            requestId,
                            payload: result,
                        });
                    }
                    return;
                // "check-hide-condition-for-action" command: Check if the given action ID (command) should be hidden.
                case "check-hide-condition-for-action":
                    {
                        const allActions = Object.values(this.data.actions).flat();
                        const allContextOpts = Object.values(this.data.contextOpts).flat();
                        const action = [...allActions, ...allContextOpts].find((act) => act.command === payload.actionId);

                        // Default: without any hide condition or in the event of an error, it should not hide the action
                        let result = false;
                        if (action?.hideCondition) {
                            const conditionData = this.getConditionData(payload);
                            const shouldHide = await this.evaluateCondition(action.hideCondition, conditionData, action.command, false);
                            result = shouldHide;
                        }

                        (this.panel ?? this.view).webview.postMessage({
                            command: "check-hide-condition-for-action",
                            requestId,
                            payload: result,
                        });
                    }
                    return;
                // "ontableedited" command: The table's contents were updated by the user from within the webview.
                // Fires for editable columns only.
                case "ontableedited":
                    this.onTableDataEditedEmitter.fire(payload);
                    return;
                // "ondisplaychanged" command: The table's layout was updated by the user from within the webview.
                case "ondisplaychanged":
                    this.onTableDisplayChangedEmitter.fire(payload);
                    return;
                // "ready" command: The table view has attached its message listener and is ready to receive data.
                case "ready":
                    await this.updateWebview();
                    return;
                // "api-ready" command: The AG Grid API is ready and can be used.
                case "api-ready":
                    this.apiReady = true;
                    this.apiReadyResolvers.forEach((resolve) => resolve());
                    this.apiReadyResolvers = [];
                    return;
                // "copy" command: Copy the data for the row that was right-clicked.
                case "copy":
                    await env.clipboard.writeText(JSON.stringify(payload.row));
                    return;
                case "copy-cell":
                    await env.clipboard.writeText(payload.cell);
                    return;
                case "GET_LOCALIZATION": {
                    const filePath = vscode.l10n.uri?.fsPath + "";
                    fs.readFile(filePath, "utf8", (err, data) => {
                        if (err) {
                            // File doesn't exist, fallback to English strings
                            // Still need to notify the webview that no localization data was found
                            (this.panel ?? this.view).webview.postMessage({
                                command: "GET_LOCALIZATION",
                                requestId: message.requestId,
                            });
                            return;
                        }

                        (this.panel ?? this.view).webview.postMessage({
                            command: "GET_LOCALIZATION",
                            requestId: message.requestId,
                            payload: data,
                        });
                    });
                    return;
                }
                default:
                    break;
            }

            const row: number = payload.rowIndex ?? 0;
            const matchingActionable = [
                ...(this.data.actions[row] ?? []),
                ...this.data.actions.all,
                ...(this.data.contextOpts[row] ?? []),
                ...this.data.contextOpts.all,
            ].find((action) => action.command === message.command);
            if (matchingActionable != null) {
                switch (matchingActionable.callback.typ) {
                    case "single-row":
                        await matchingActionable.callback.fn(this, { index: payload.rowIndex, row: payload.row });
                        break;
                    case "multi-row":
                        await matchingActionable.callback.fn(this, payload.rows);
                        break;
                    case "cell":
                        await matchingActionable.callback.fn(this, payload.cell);
                        break;
                    case "no-selection":
                        await matchingActionable.callback.fn(this);
                        break;
                    // TODO: Support column callbacks? (if there's enough interest)
                    default:
                        break;
                }
            }
            this.onDidReceiveMessageEmitter.fire(message);
        }

        /**
         * (Sender) message handler for the table view.
         * Used to send data and table layout changes to the table view to be re-rendered.
         *
         * @returns Whether the webview received the update that was sent
         */
        private async updateWebview(): Promise<boolean> {
            // Prepare data to send to the webview, excluding the condition property as it cannot always be serialized/passable
            const webviewData: ViewOpts = {
                ...this.data,
                actions: Object.fromEntries(
                    Object.entries(this.data.actions).map(([key, actions]) => [
                        key,
                        actions.map((action) => ({
                            title: typeof action.title === "string" ? action.title : `__DYNAMIC_TITLE__${action.command}`,
                            command: action.command,
                            type: action.type,
                            callback: action.callback,
                        })),
                    ])
                ) as Record<number | "all", Action[]>,
                contextOpts: Object.fromEntries(
                    Object.entries(this.data.contextOpts).map(([key, options]) => [
                        key,
                        options.map((option) => ({
                            title: typeof option.title === "string" ? option.title : `__DYNAMIC_TITLE__${option.command}`,
                            command: option.command,
                            dataType: option.dataType,
                            callback: option.callback,
                        })),
                    ])
                ) as any,
            };

            const result = await (this.panel ?? this.view).webview.postMessage({
                command: "ondatachanged",
                data: webviewData,
            });

            if (result) {
                this.onTableDataReceivedEmitter.fire(this.lastUpdated ? diff(this.lastUpdated, this.data) : this.data);
                this.lastUpdated = this.data;
            }
            return result;
        }

        /**
         * Access the unique ID for the table view instance.
         *
         * @returns The unique ID for this table view
         */
        public getId(): string {
            this.uuid ??= randomUUID();
            return `${this.data.title}-${this.uuid.substring(0, this.uuid.indexOf("-"))}##${this.context.extension.id}`;
        }

        /**
         * Add one or more actions to the given row.
         *
         * @param index The row index where the action should be displayed
         * @param actions The actions to add to the given row
         *
         * @returns Whether the webview successfully received the new action(s)
         */
        public addAction(index: number | "all", ...actions: Action[]): Promise<boolean> {
            if (this.data.actions[index]) {
                const existingActions = this.data.actions[index];
                this.data.actions[index] = [...existingActions, ...actions];
            } else {
                this.data.actions[index] = actions;
            }
            return this.updateWebview();
        }

        /**
         * Add one or more context menu options to the given row.
         *
         * @param id The row index or column ID where the action should be displayed
         * @param options The context menu options to add to the given row
         * @returns Whether the webview successfully received the new context menu option(s)
         */
        public addContextOption(id: number | "all", ...options: ContextMenuOption[]): Promise<boolean> {
            if (this.data.contextOpts[id]) {
                const existingOpts = this.data.contextOpts[id];
                this.data.contextOpts[id] = [...existingOpts, ...options];
            } else {
                this.data.contextOpts[id] = options;
            }
            return this.updateWebview();
        }

        /**
         * Get rows of content from the table view.
         * @param rows The rows of data in the table
         * @returns Whether the webview successfully received the new content
         */
        public getContent(): RowData[] {
            return this.data.rows;
        }

        public async getPageSize(): Promise<number> {
            return this.request<number>("get-page-size");
        }

        public async setPageSize(pageSize: number): Promise<boolean> {
            return this.request<boolean>("set-page-size", pageSize);
        }

        public async getGridState(): Promise<any> {
            return this.request<any>("get-grid-state");
        }

        public async setGridState(state: any): Promise<boolean> {
            return this.request<boolean>("set-grid-state", state);
        }

        public async setPage(page: number): Promise<boolean> {
            return this.request<boolean>("set-page", page);
        }

        public async getPage(): Promise<number> {
            return this.request<number>("get-page");
        }

        /**
         * Add rows of content to the table view.
         * @param rows The rows of data to add to the table
         * @returns Whether the webview successfully received the new content
         */
        public async addContent(...rows: RowData[]): Promise<boolean> {
            this.data.rows.push(...rows);
            return this.updateWebview();
        }

        /**
         * Update an existing row in the table view.
         * @param index The AG GRID row index to update within the table
         * @param row The new row content. If `null`, the given row index will be deleted from the list of rows.
         * @returns Whether the webview successfully updated the new row
         */
        public async updateRow(index: number, row: RowData | null): Promise<boolean> {
            if (row == null) {
                this.data.rows.splice(index, 1);
            } else {
                this.data.rows[index] = row;
            }
            return this.updateWebview();
        }

        /**
         * Adds headers to the end of the existing header list in the table view.
         *
         * @param headers The headers to add to the existing header list
         * @returns Whether the webview successfully received the list of headers
         */
        public async addColumns(...columns: ColumnOpts[]): Promise<boolean> {
            this.data.columns.push(
                ...columns.map((col) => ({
                    ...col,
                    comparator: col.useDateComparison ? getDateComparator().toString() : col.comparator?.toString(),
                    colSpan: col.colSpan?.toString(),
                    rowSpan: col.rowSpan?.toString(),
                    valueFormatter: col.valueFormatter?.toString(),
                }))
            );
            return this.updateWebview();
        }

        /**
         * Sets the content for the table; replaces any pre-existing content.
         *
         * @param rows The rows of data to apply to the table
         * @returns Whether the webview successfully received the new content
         */
        public async setContent(rows: RowData[]): Promise<boolean> {
            this.data.rows = rows;
            return this.updateWebview();
        }

        /**
         * Sets the headers for the table.
         *
         * @param headers The new headers to use for the table
         * @returns Whether the webview successfully received the new headers
         */
        public async setColumns(columns: ColumnOpts[]): Promise<boolean> {
            this.data.columns = columns.map((col) => ({
                ...col,
                comparator: col.useDateComparison ? getDateComparator().toString() : col.comparator?.toString(),
                colSpan: col.colSpan?.toString(),
                rowSpan: col.rowSpan?.toString(),
                valueFormatter: col.valueFormatter?.toString(),
            }));
            return this.updateWebview();
        }

        /**
         * Sets the options for the table.
         *
         * @param opts The optional grid properties for the table
         * @returns Whether the webview successfully received the new options
         */
        public setOptions(opts: GridProperties): Promise<boolean> {
            this.data = { ...this.data, options: this.data.options ? { ...this.data.options, ...opts } : opts };
            return this.updateWebview();
        }

        /**
         * Sets the display title for the table view.
         *
         * @param title The new title for the table
         * @returns Whether the webview successfully received the new title
         */
        public async setTitle(title: string): Promise<boolean> {
            this.data.title = title;
            return this.updateWebview();
        }

        /**
         * Request data from the webview and return the response.
         * Similar to the MessageHandler.request method but for table views.
         *
         * @param command The command to send to the webview
         * @param payload Optional payload to send with the request
         * @returns A promise that resolves with the response from the webview
         */
        public request<T>(command: string, payload?: any): Promise<T> {
            const requestId = randomUUID();

            return new Promise((resolve, reject) => {
                this.pendingRequests[requestId] = { resolve, reject };

                const message = {
                    command,
                    requestId,
                    payload,
                };

                (this.panel ?? this.view).webview.postMessage(message).then((success) => {
                    if (!success) {
                        delete this.pendingRequests[requestId];
                        reject(new Error("Failed to send message to webview"));
                    }
                });
            });
        }

        /**
         * Wait for the AG Grid API to be ready.
         * This method resolves when the grid has been initialized and the API is available for use.
         *
         * @returns A promise that resolves when the AG Grid API is ready
         */
        public async waitForAPI(): Promise<void> {
            if (this.apiReady) {
                return Promise.resolve();
            }

            return new Promise<void>((resolve) => {
                this.apiReadyResolvers.push(resolve);
            });
        }

        /**
         * Pin the specified rows to the top of the grid.
         * @param rows The rows to pin to the top
         * @returns Whether the webview successfully pinned the rows
         */
        public async pinRows(rows: RowData[]): Promise<boolean> {
            const config = vscode.workspace.getConfiguration("zowe");
            const maxPinnedRows = config.get<number>("table.maxPinnedRows", 10);
            const hideWarning = config.get<boolean>("table.hidePinnedRowsWarning", false);

            // Get currently pinned rows to check against the limit
            const currentPinnedRows = await this.getPinnedRows();
            const totalAfterPinning = currentPinnedRows.length + rows.length;

            if (!hideWarning && currentPinnedRows.length <= maxPinnedRows && totalAfterPinning > maxPinnedRows) {
                const message = `Pinning many rows can negatively impact the table view user experience.`;
                const dontShowAgain = "Don't show this again";
                Gui.warningMessage(message, { items: [dontShowAgain] }).then(async (result) => {
                    if (result === dontShowAgain) {
                        try {
                            await config.update("table.hidePinnedRowsWarning", true, vscode.ConfigurationTarget.Global);
                        } catch (error) {
                            Logger.getAppLogger().error("Failed to update pinned rows warning setting: %s", error.toString());
                        }
                    }
                });
            }

            const rowsObject = rows.reduce((acc, row, index) => {
                acc[index] = row;
                return acc;
            }, {} as Record<number, RowData>);

            return this.request<boolean>("pin-rows", { rows: rowsObject });
        }

        /**
         * Unpin the specified rows from the top of the grid.
         * @param rows The rows to unpin
         * @returns Whether the webview successfully unpinned the rows
         */
        public async unpinRows(rows: RowData[]): Promise<boolean> {
            const rowsObject = rows.reduce((acc, row, index) => {
                acc[index] = row;
                return acc;
            }, {} as Record<number, RowData>);

            return this.request<boolean>("unpin-rows", { rows: rowsObject });
        }

        /**
         * Get all currently pinned rows from the top of the grid.
         * @returns Array of pinned row data
         */
        public async getPinnedRows(): Promise<RowData[]> {
            return this.request<RowData[]>("get-pinned-rows");
        }

        /**
         * Set the pinned rows to a specific array of rows.
         *
         * This method replaces all currently pinned rows with the provided array.
         * Unlike pinRows() which adds to existing pinned rows, this method completely
         * replaces the pinned row data.
         *
         * @param rows The rows to set as pinned (empty array clears all pinned rows)
         * @returns Whether the webview successfully set the pinned rows
         *
         * @example
         * // Clear all pinned rows
         * await tableView.setPinnedRows([]);
         *
         * // Set specific rows as pinned (replaces any existing pinned rows)
         * await tableView.setPinnedRows([row1, row2, row3]);
         */
        public async setPinnedRows(rows: RowData[]): Promise<boolean> {
            return this.request<boolean>("set-pinned-rows", { rows });
        }
    }

    export class Instance extends View {
        public constructor(context: ExtensionContext, isView: boolean, data: Table.ViewOpts) {
            super(context, isView, data);
        }

        /**
         * Closes the table view and marks it as disposed.
         * Removes the table instance from the mediator if it exists.
         */
        public dispose(): void {
            TableMediator.getInstance().removeTable(this);
            super.dispose();
        }
    }
}
