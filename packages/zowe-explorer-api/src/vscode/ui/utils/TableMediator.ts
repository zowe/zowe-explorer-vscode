import { Table } from "../TableView";

export class TableMediator {
    private static instance: TableMediator;
    private tables: Map<string, Table.View>;
    private constructor() {}

    public static getInstance(): TableMediator {
        if (!this.instance) {
            this.instance = new TableMediator();
        }

        return this.instance;
    }

    public addTable(id: string, table: Table.View): void {
        this.tables.set(id, table);
    }

    public getTable(id: string): Table.View | undefined {
        return this.tables.get(id);
    }

    public deleteTable(id: string): boolean {
        if (this.tables.has(id)) {
            return false;
        }

        const table = this.tables.get(id);
        table.dispose();
        return this.tables.delete(id);
    }
}
