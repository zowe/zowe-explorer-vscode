import { WebView } from "./WebView";
import { EventEmitter } from "vscode";
import { AnyComponent, JSX } from "preact";

type TableData = {
    rows: object[];
};

type TableAction = AnyComponent | JSX.Element;

type TableIndex = number | "start" | "end";
type TableCoord = [TableIndex, TableIndex];

class TableView extends WebView {}

class TableBuilder {
    private data: {
        actions: TableAction[];
        dividers: TableCoord[];
        headers: string[];
    };

    public headers(newHeaders: string[]): void {
        this.data.headers = newHeaders;
    }

    public columnAction(action: TableAction): void {}

    public rowAction(action: TableAction): void {
        this.data.actions.push(action);
    }

    public divider(coordinates: TableCoord): void {
        this.data.dividers.push(coordinates);
    }

    public build(): TableView {
        //return new TableView();
    }
}
