import { WebView } from "./WebView";
import { Event, EventEmitter, ExtensionContext } from "vscode";
import { AnyComponent, JSX } from "preact";
import { randomUUID } from "crypto";

export namespace Table {
    export type Action = AnyComponent | JSX.Element;
    export type Axes = "row" | "column";

    export type RowContent = Record<string | number, string | number | boolean | string[] | Action | Action[]>;
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
        // Headers for the top of the table
        headers: string[];
        // The row data for the table. Each row contains a set of variables corresponding to the data for each column in that row
        rows: RowContent[];
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

        public constructor(context: ExtensionContext, data: Data) {
            super(data.title, "table-view", context);
            this.data = data;
            this.panel.webview.onDidReceiveMessage((message) => this.onMessageReceived(message));
        }

        /**
         * (Receiver) message handler for the table view.
         * Used to dispatch client-side updates of the table to subscribers when the table's display has changed.
         *
         * @param message The message received from the webview
         */
        private onMessageReceived(message: any): void {
            if (message.command === "ondisplaychanged") {
                this.onTableDisplayChanged.fire(message.data);
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
                const existingActions = actionMap.get(index);
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
         * @param coord The coordinate
         * @returns
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
        public async addHeaders(...headers: string[]): Promise<boolean> {
            this.data.headers.push(...headers);
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
         * @param rows The dividers to use for the table
         * @returns Whether the webview successfully received the new dividers
         */
        public async setDividers(): Promise<boolean> {
            // TODO: implement
            return this.updateWebview();
        }

        /**
         * Sets the headers for the table.
         *
         * @param headers The new headers to use for the table
         * @returns Whether the webview successfully received the new headers
         */
        public async setHeaders(headers: string[]): Promise<boolean> {
            this.data.headers = headers;
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
         * Closes the table view and marks it as disposed.
         */
        public dispose(): void {
            super.dispose();
        }
    }
}
