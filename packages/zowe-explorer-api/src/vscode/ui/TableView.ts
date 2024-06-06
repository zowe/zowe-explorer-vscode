import { WebView } from "./WebView";
import { EventEmitter, ExtensionContext } from "vscode";
import { AnyComponent, JSX } from "preact";
import { randomUUID } from "crypto";

export namespace Table {
    export type Action = AnyComponent | JSX.Element;
    export type Index = number | "start" | "end";
    export type Coord = [Index, Index];

    export type RowData = Record<string | number, string | number | boolean | string[] | Action | Action[]>;
    export type Data = {
        actions: Action[];
        dividers: Coord[];
        headers: string[];
        rows: RowData[];
        title?: string;
    };

    export class View extends WebView {
        private data: Data;
        private onTableDataReceived: EventEmitter<RowData | RowData[]>;
        private onTableDisplayChange: EventEmitter<RowData | RowData[]>;

        public constructor(context: ExtensionContext, data: Data) {
            super(data.title, "table-view", context);
            this.data = data;
        }

        public getId(): string {
            return `${this.data.title ?? randomUUID()}##${this.context.extension.id}`;
        }

        public dispose(): void {
            super.dispose();
        }
    }
}
