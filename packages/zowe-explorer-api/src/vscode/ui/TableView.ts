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
import { randomUUID } from "crypto";
import * as vscode from "vscode";

export namespace Table {
    export type Action = { title: string; command: string; type?: "primary" | "secondary" | "icon" };
    export type ContextMenuOption = Omit<Action, "type">;
    export type Axes = "row" | "column";

    export type RowContent = Record<string | number, string | number | boolean | string[]>;
    export type Column = { field: string; filter?: boolean };
    export type Data = {
        // Actions to apply to the given row or column index
        actions: Record<number | "all", Action[]>;
        // Column headers for the top of the table
        columns: Column[] | null | undefined;
        contextOpts: Record<number | string | "all", ContextMenuOption[]>;
        // The row data for the table. Each row contains a set of variables corresponding to the data for each column in that row
        rows: RowContent[] | null | undefined;
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
                case "ondisplaychanged":
                    this.onTableDisplayChanged.fire(message.data);
                    break;
                case "ready":
                    await this.updateWebview();
                    break;
                case "copy":
                    await vscode.env.clipboard.writeText(JSON.stringify(message.data));
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
         * Add one or more actions to the given row.
         *
         * @param index The row index where the action should be displayed
         * @param actions The actions to add to the given row
         *
         * @returns Whether the webview successfully received the new action(s)
         */
        public addAction(index: number, ...actions: Action[]): Promise<boolean> {
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
         * @param actions The actions to add to the given row
         * @returns Whether the webview successfully received the new context menu option(s)
         */
        public addContextOption(id: number | string, ...options: ContextMenuOption[]): Promise<boolean> {
            if (this.data.contextOpts[id]) {
                const existingOpts = this.data.contextOpts[id];
                this.data.contextOpts[id] = [...existingOpts, ...options];
            } else {
                this.data.contextOpts[id] = options;
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
         * Adds headers to the end of the existing header list in the table view.
         *
         * @param headers The headers to add to the existing header list
         * @returns Whether the webview successfully received the list of headers
         */
        public async addColumns(...columns: Column[]): Promise<boolean> {
            this.data.columns.push(...columns);
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
         * Sets the headers for the table.
         *
         * @param headers The new headers to use for the table
         * @returns Whether the webview successfully received the new headers
         */
        public async setColumns(columns: Column[]): Promise<boolean> {
            this.data.columns = columns;
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
