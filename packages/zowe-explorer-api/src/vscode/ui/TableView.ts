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
import { addedDiff } from "deep-object-diff";

export namespace Table {
    /* The types of supported content for the table and how they are represented in callback functions. */
    export type ContentTypes = string | number | boolean | string[];
    export type RowData = Record<string | number, ContentTypes>;
    export type ColData = RowData;
    export type CellData = ContentTypes;

    /* Defines the supported callbacks and related types. */
    export type CallbackTypes = "row" | "column" | "cell";
    export type Callback = {
        // The type of callback
        typ: CallbackTypes;
        // The callback function itself - called from within the webview container.
        fn:
            | ((data: RowData) => void | PromiseLike<void>)
            | ((data: ColData) => void | PromiseLike<void>)
            | ((data: CellData) => void | PromiseLike<void>);
    };

    /* Conditional callback function - whether an action or option should be rendered. */
    export type Conditional = (data: RowData | CellData) => boolean;

    /* Defines the supported actions and related types. */
    export type ActionKind = "primary" | "secondary" | "icon";
    export type Action = {
        title: string;
        command: string;
        type?: ActionKind;
        // Stringified function will be called from within the webview container
        condition?: string;
        callback: Callback;
    };
    export type ContextMenuOption = Omit<Action, "type"> & { dataType?: CallbackTypes };

    /* Helper types to allow passing function properties to builder/view functions. */
    export type ActionOpts = Omit<Action, "condition"> & { condition?: Conditional };
    export type ContextMenuOpts = Omit<ContextMenuOption, "condition"> & { condition?: Conditional };

    // -- Misc types --
    /* Value formatter callback. Expects the exact display value to be returned. */
    export type ValueFormatter = (data: { value: CellData }) => string;
    export type Positions = "left" | "right";
    export type SortDirections = "asc" | "desc";

    /* The column type definition. All available properties are offered for AG Grid columns. */
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
        weapHeaderText?: boolean;
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
        sort?: SortDirections;
        initialSort?: SortDirections;
        sortIndex?: number | null;
        initialSortIndex?: number;
        sortingOrder?: SortDirections[];
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
    export type ViewOpts = {
        // Actions to apply to the given row or column index
        actions: Record<number | "all", Action[]>;
        // Column headers for the top of the table
        columns: Column[] | null | undefined;
        contextOpts: Record<number | "all", ContextMenuOption[]>;
        // The row data for the table. Each row contains a set of variables corresponding to the data for each column in that row
        rows: RowData[] | null | undefined;
        // The display title for the table
        title?: string;
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
        private data: ViewOpts;
        private onTableDataReceivedEmitter: EventEmitter<Partial<ViewOpts>> = new EventEmitter();
        private onTableDisplayChangedEmitter: EventEmitter<RowData | RowData[]> = new EventEmitter();
        public onTableDisplayChanged: Event<RowData | RowData[]> = this.onTableDisplayChangedEmitter.event;
        public onTableDataReceived: Event<Partial<ViewOpts>> = this.onTableDataReceivedEmitter.event;

        public getUris(): UriPair {
            return this.uris;
        }

        public getHtml(): string {
            return this.htmlContent;
        }

        public constructor(context: ExtensionContext, data?: ViewOpts) {
            super(data.title ?? "Table view", "table-view", context, (message) => this.onMessageReceived(message), true);
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
                await matchingActionable.callback.fn(message.data);
            }
        }

        /**
         * (Sender) message handler for the table view.
         * Used to send data and table layout changes to the table view to be re-rendered.
         *
         * @returns Whether the webview received the update that was sent
         */
        private async updateWebview(): Promise<boolean> {
            const result = await this.panel.webview.postMessage({
                command: "ondatachanged",
                data: this.data,
            });

            if (result) {
                this.onTableDataReceivedEmitter.fire(this.lastUpdated ? addedDiff(this.data, this.lastUpdated) : this.data);
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
            const uuid = randomUUID();
            return `${this.data.title}-${uuid.substring(0, uuid.indexOf("-"))}##${this.context.extension.id}`;
        }

        /**
         * Add one or more actions to the given row.
         *
         * @param index The row index where the action should be displayed
         * @param actions The actions to add to the given row
         *
         * @returns Whether the webview successfully received the new action(s)
         */
        public addAction(index: number, ...actions: ActionOpts[]): Promise<boolean> {
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
        public addContextOption(id: number | string, ...options: ContextMenuOpts[]): Promise<boolean> {
            if (this.data.contextOpts[id]) {
                const existingOpts = this.data.contextOpts[id];
                this.data.contextOpts[id] = [...existingOpts, ...options.map((option) => ({ ...option, condition: option.condition?.toString() }))];
            } else {
                this.data.contextOpts[id] = options.map((option) => ({ ...option, condition: option.condition?.toString() }));
            }
            return this.updateWebview();
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
        public constructor(context: ExtensionContext, data: Table.ViewOpts) {
            super(context, data);
        }

        /**
         * Closes the table view and marks it as disposed.
         */
        public dispose(): void {
            super.dispose();
        }
    }
}
