import type { Table } from "../TableView";

export interface ProviderRegistry {
    registerRowAction: (action: Table.Action) => void;
    registerContextMenuItem: (item: Table.ContextMenuOption) => void;
}

export class TableProviderRegistry implements ProviderRegistry {
    private rowActions: Table.Action[] = [];
    private contextMenuItems: Table.ContextMenuOption[] = [];

    public registerRowAction(action: Table.Action): void {
        this.rowActions.push(action);
    }

    public registerContextMenuItem(item: Table.ContextMenuOption): void {
        this.contextMenuItems.push(item);
    }

    public getRowActions(): Table.Action[] {
        return this.rowActions;
    }

    public getContextMenuItems(): Table.ContextMenuOption[] {
        return this.contextMenuItems;
    }
}
