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
import { Event, EventEmitter, ExtensionContext } from "vscode";
import { AnyComponent, JSX } from "preact";
import { randomUUID } from "crypto";

export namespace Table {
    export type Action = AnyComponent | JSX.Element;
    export type Axes = "row" | "column";

    export type RowContent = Record<string | number, string | number | boolean | string[] | Action | Action[]>;
    export type Dividers = {
        rows: number[];
        columns: number[];
    };
    export type Data = {
        // Actions to apply to the given row or column index
        actions: {
            column: Map<number, Action[]>;
            row: Map<number, Action[]>;
        };
        // Dividers to place within the table at a specific row or column index
        dividers: {
            column: number[];
            row: number[];
        };
        // Column headers for the top of the table
        columns: { field: string }[] | null;
        // The row data for the table. Each row contains a set of variables corresponding to the data for each column in that row
        rows: RowContent[] | null;
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
        private data: Data;
        private onTableDataReceived: Event<RowContent | RowContent[]>;
        private onTableDisplayChanged: EventEmitter<RowContent | RowContent[]>;

        public getUris(): UriPair {
            return this.uris;
        }

        public getHtml(): string {
            return this.htmlContent;
        }

        public constructor(context: ExtensionContext, data?: Data) {
            super(data.title ?? "Table view", "table-view", context);
            this.panel.webview.onDidReceiveMessage((message) => this.onMessageReceived(message));
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
                case "ondisplaychanged":
                    this.onTableDisplayChanged.fire(message.data);
                    break;
                case "ready":
                    await this.updateWebview();
                    break;
            }
        }

        /**
         * (Sender) message handler for the table view.
         * Used to send data and table layout changes to the table view to be re-rendered.
         *
         * @returns Whether the webview received the update that was sent
         */
        private async updateWebview(): Promise<boolean> {
            return this.panel.webview.postMessage({
                command: "ondatachanged",
                data: this.data,
            });
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
         * Add one or more actions to the given row or column index.
         *
         * @param axis The axis to add an action to (either "row" or "column")
         * @param index The index where the action should be displayed
         * @param actions The actions to add to the given row/column index
         *
         * @returns Whether the webview successfully received the new action(s)
         */
        public addAction(axis: Axes, index: number, ...actions: Action[]): Promise<boolean> {
            const actionMap = axis === "row" ? this.data.actions.row : this.data.actions.column;
            if (actionMap.has(index)) {
                const existingActions = actionMap.get(index)!;
                actionMap.set(index, [...existingActions, ...actions]);
            } else {
                actionMap.set(index, actions);
            }
            return this.updateWebview();
        }

        /**
         * Add rows of content to the table view.
         * @param rows The rows of data to add to the table
         * @returns Whether the webview successfully received the new content
         */
        public async addContent(...rows: RowContent[]): Promise<boolean> {
            this.data.rows.push(...rows);
            return this.updateWebview();
        }

        /**
         * Adds a divider to the given row and column
         *
         * @param axis The axis to add the divider to
         * @param index The index on the axis where the divider should be added
         * @returns Whether the webview successfully received the new divider
         */
        public async addDivider(axis: Axes, index: number): Promise<boolean> {
            (axis === "row" ? this.data.dividers.row : this.data.dividers.column).push(index);
            return this.updateWebview();
        }

        /**
         * Adds headers to the end of the existing header list in the table view.
         *
         * @param headers The headers to add to the existing header list
         * @returns Whether the webview successfully received the list of headers
         */
        public async addColumns(...columns: string[]): Promise<boolean> {
            this.data.columns.push(...columns.map((column) => ({ field: column })));
            return this.updateWebview();
        }

        /**
         * Sets the content for the table; replaces any pre-existing content.
         *
         * @param rows The rows of data to apply to the table
         * @returns Whether the webview successfully received the new content
         */
        public async setContent(rows: RowContent[]): Promise<boolean> {
            this.data.rows = rows;
            return this.updateWebview();
        }

        /**
         * Sets the dividers for the table; replaces any pre-existing dividers.
         *
         * @param rows The row dividers to use for the table
         * @param columns The column dividers to use for the table
         * @returns Whether the webview successfully received the new dividers
         */
        public async setDividers(dividers: Pick<Dividers, "rows"> | Pick<Dividers, "columns">): Promise<boolean> {
            if ("rows" in dividers) {
                this.data.dividers.row = dividers.rows;
            }
            if ("columns" in dividers) {
                this.data.dividers.column = dividers.columns;
            }

            return this.updateWebview();
        }

        /**
         * Sets the headers for the table.
         *
         * @param headers The new headers to use for the table
         * @returns Whether the webview successfully received the new headers
         */
        public async setColumns(columns: string[]): Promise<boolean> {
            this.data.columns = columns.map((column) => ({ field: column }));
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
        public constructor(context: ExtensionContext, data: Table.Data) {
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
