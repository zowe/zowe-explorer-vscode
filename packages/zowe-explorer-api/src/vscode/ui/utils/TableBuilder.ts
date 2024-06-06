import { ExtensionContext } from "vscode";
import { Table } from "../TableView";
import { TableMediator } from "./TableMediator";

export class TableBuilder {
    private context: ExtensionContext;
    private data: Table.Data;

    public constructor(context: ExtensionContext) {
        this.context = context;
    }

    public rows(...rows: Table.RowData[]): TableBuilder {
        this.data.rows = rows;
        return this;
    }

    public headers(newHeaders: string[]): TableBuilder {
        this.data.headers = newHeaders;
        return this;
    }

    public columnAction(action: Table.Action): TableBuilder {
        return this;
    }

    public rowAction(action: Table.Action): TableBuilder {
        this.data.actions.push(action);
        return this;
    }

    public divider(coordinates: Table.Coord): TableBuilder {
        this.data.dividers.push(coordinates);
        return this;
    }

    public build(): Table.View {
        return new Table.View(this.context, this.data);
    }

    public buildAndShare(): Table.View {
        const table = new Table.View(this.context, this.data);
        TableMediator.getInstance().addTable(table.getId(), table);
        return table;
    }
}
