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

export namespace Table {
    /* The types of supported content for the table and how they are represented in callback functions. */
    export type ContentTypes = string | number | boolean | string[];
    export type RowData = Record<string | number, ContentTypes>;
    export type ColData = RowData;

    export type RowInfo = {
        index?: number;
        row: RowData;
    };

    /* Defines the supported callbacks and related types. */
    export type CallbackTypes = "single-row" | "multi-row" | "column" | "cell";
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

    export type Callback = SingleRowCallback | MultiRowCallback | CellCallback;

    /** Conditional callback function - whether an action or option should be rendered. */
    export type Conditional = (data: RowData[] | RowData | ContentTypes) => boolean;

    // Defines the supported actions and related types.
    export type ActionKind = "primary" | "secondary" | "icon";
    export type Action = {
        title: string;
        command: string;
        type?: ActionKind;
        /** Stringified function will be called from within the webview container. */
        condition?: string;
        callback: Callback;
    };
    export type ContextMenuOption = Omit<Action, "type"> & { dataType?: CallbackTypes };

    // Helper types to allow passing function properties to builder/view functions.
    export type ActionOpts = Omit<Action, "condition"> & { condition?: Conditional };
    export type ContextMenuOpts = Omit<ContextMenuOption, "condition"> & { condition?: Conditional };

    // -- Misc types --
    /** Value formatter callback. Expects the exact display value to be returned. */
    export type ValueFormatter = (data: { value: ContentTypes }) => string;
    export type Positions = "left" | "right";

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
        private onTableDataReceivedEmitter: EventEmitter<Partial<ViewOpts>> = new EventEmitter();
        private onTableDisplayChangedEmitter: EventEmitter<RowData | RowData[]> = new EventEmitter();
        private onTableDataEditedEmitter: EventEmitter<EditEvent> = new EventEmitter();
        public onTableDisplayChanged: Event<RowData | RowData[]> = this.onTableDisplayChangedEmitter.event;
        public onTableDataReceived: Event<Partial<ViewOpts>> = this.onTableDataReceivedEmitter.event;
        public onTableDataEdited: Event<EditEvent> = this.onTableDataEditedEmitter.event;

        private uuid: string;

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
                this.data = data;
            }
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
            switch (message.command) {
                // "ontableedited" command: The table's contents were updated by the user from within the webview.
                // Fires for editable columns only.
                case "ontableedited":
                    this.onTableDataEditedEmitter.fire(message.data);
                    return;
                // "ondisplaychanged" command: The table's layout was updated by the user from within the webview.
                case "ondisplaychanged":
                    this.onTableDisplayChangedEmitter.fire(message.data);
                    return;
                // "ready" command: The table view has attached its message listener and is ready to receive data.
                case "ready":
                    await this.updateWebview();
                    return;
                // "copy" command: Copy the data for the row that was right-clicked.
                case "copy":
                    await env.clipboard.writeText(JSON.stringify(message.data.row));
                    return;
                case "copy-cell":
                    await env.clipboard.writeText(message.data.cell);
                    return;
                default:
                    break;
            }

            const row: number = message.rowIndex ?? 0;
            const matchingActionable = [
                ...(this.data.actions[row] ?? []),
                ...this.data.actions.all,
                ...(this.data.contextOpts[row] ?? []),
                ...this.data.contextOpts.all,
            ].find((action) => action.command === message.command);
            if (matchingActionable != null) {
                switch (matchingActionable.callback.typ) {
                    case "single-row":
                        await matchingActionable.callback.fn(this, { index: message.data.rowIndex, row: message.data.row });
                        break;
                    case "multi-row":
                        await matchingActionable.callback.fn(this, message.data.rows);
                        break;
                    case "cell":
                        await matchingActionable.callback.fn(this, message.data.cell);
                        break;
                    // TODO: Support column callbacks? (if there's enough interest)
                    default:
                        break;
                }
            }
        }

        /**
         * (Sender) message handler for the table view.
         * Used to send data and table layout changes to the table view to be re-rendered.
         *
         * @returns Whether the webview received the update that was sent
         */
        private async updateWebview(): Promise<boolean> {
            const result = await (this.panel ?? this.view).webview.postMessage({
                command: "ondatachanged",
                data: this.data,
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
        public addAction(index: number | "all", ...actions: ActionOpts[]): Promise<boolean> {
            if (this.data.actions[index]) {
                const existingActions = this.data.actions[index];
                this.data.actions[index] = [...existingActions, ...actions.map((action) => ({ ...action, condition: action.condition?.toString() }))];
            } else {
                this.data.actions[index] = actions.map((action) => ({ ...action, condition: action.condition?.toString() }));
            }
            return this.updateWebview();
        }

        /**
         * Add one or more context menu options to the given row.
         *
         * @param id The row index or column ID where the action should be displayed
         * @param actions The actions to add to the given row
         * @returns Whether the webview successfully received the new context menu option(s)
         */
        public addContextOption(id: number | "all", ...options: ContextMenuOpts[]): Promise<boolean> {
            if (this.data.contextOpts[id]) {
                const existingOpts = this.data.contextOpts[id];
                this.data.contextOpts[id] = [...existingOpts, ...options.map((option) => ({ ...option, condition: option.condition?.toString() }))];
            } else {
                this.data.contextOpts[id] = options.map((option) => ({ ...option, condition: option.condition?.toString() }));
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
                    comparator: col.comparator?.toString(),
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
                comparator: col.comparator?.toString(),
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
