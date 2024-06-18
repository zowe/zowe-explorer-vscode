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

import { ExtensionContext } from "vscode";
import { Table } from "../TableView";
import { TableMediator } from "./TableMediator";

/**
 * A builder class for quickly instantiating {@link Table.View} instances.
 * Especially useful for building multiple tables with similar layouts or data.
 *
 * @remarks
 *
 * ## Building a table
 *
 * Developers can build a table using the helper methods provided by the builder.
 * Once a table is ready to be built, use the {@link TableBuilder.build} function to create
 * a new {@link Table.View} instance with the given configuration.
 *
 * ## Sharing tables
 *
 * Share a table during the build process by using the {@link TableBuilder.buildAndShare} function.
 * This function will create the {@link Table.View} instance while also adding it to the mediator
 * in Zowe Explorer's extender API. Extenders who would like to contribute to shared tables can do
 * so by accessing the table by its unique ID.
 */
export class TableBuilder {
    private context: ExtensionContext;
    private data: Table.Data = {
        actions: {
            column: new Map(),
            row: new Map(),
        },
        dividers: {
            column: [],
            row: [],
        },
        columns: [],
        rows: [],
        title: "",
    };

    public constructor(context: ExtensionContext) {
        this.context = context;
    }

    /**
     * Set the title for the next table.
     *
     * @param name The name of the table
     * @returns The same {@link TableBuilder} instance with the title added
     */
    public title(name: string): TableBuilder {
        this.data.title = name;
        return this;
    }

    /**
     * Set the rows for the next table.
     *
     * @param rows The rows of content to use for the table
     * @returns The same {@link TableBuilder} instance with the rows added
     */
    public rows(...rows: Table.RowContent[]): TableBuilder {
        this.data.rows = rows;
        return this;
    }

    /**
     * Set the headers for the next table.
     *
     * @param rows The headers to use for the table
     * @returns The same {@link TableBuilder} instance with the headers added
     */
    public columns(newColumns: Table.Column[]): TableBuilder {
        this.data.columns = newColumns;
        return this;
    }

    /**
     * Add an action for the next table.
     *
     * @param actionMap the map of indices to {@link Table.Action} arrays to add to for the table
     * @param index the index of the row or column to add an action to
     */
    private action(actionMap: Map<number, Table.Action[]>, index: number, action: Table.Action): void {
        if (actionMap.has(index)) {
            const actions = actionMap.get(index);
            actionMap.set(index, [...actions, action]);
        } else {
            actionMap.set(index, [action]);
        }
    }

    /**
     * Add column actions for the next table.
     *
     * @param actionMap the map of indices to {@link Table.Action} arrays to use for the table
     * @returns The same {@link TableBuilder} instance with the column actions added
     */
    public columnActions(actionMap: Map<number, Table.Action[]>): TableBuilder {
        this.data.actions.column = actionMap;
        return this;
    }

    /**
     * Add row actions for the next table.
     *
     * @param actionMap the map of indices to {@link Table.Action} arrays to use for the table
     * @returns The same {@link TableBuilder} instance with the row actions added
     */
    public rowActions(actionMap: Map<number, Table.Action[]>): TableBuilder {
        this.data.actions.row = actionMap;
        return this;
    }

    /**
     * Add a column action to the next table.
     *
     * @param index The column index to add an action to
     * @returns The same {@link TableBuilder} instance with the column action added
     */
    public columnAction(index: number, action: Table.Action): TableBuilder {
        this.action(this.data.actions.column, index, action);
        return this;
    }

    /**
     * Add a row action to the next table.
     *
     * @param index The column index to add an action to
     * @returns The same {@link TableBuilder} instance with the row action added
     */
    public rowAction(index: number, action: Table.Action): TableBuilder {
        this.action(this.data.actions.row, index, action);
        return this;
    }

    /**
     * Adds a divider to the table at the specified axis and the given index.
     *
     * @param axis The axis to add a divider to (either "row" or "column")
     * @param index The index where the divider should be added
     * @returns The same {@link TableBuilder} instance with the divider added
     */
    private divider(axis: Table.Axes, index: number): TableBuilder {
        (axis === "row" ? this.data.dividers.row : this.data.dividers.column).push(index);
        return this;
    }

    /**
     * Adds a divider to the table at the given row index.
     *
     * @param index The index where the divider should be added
     * @returns The same {@link TableBuilder} instance with the row divider added
     */
    public rowDivider(index: number): TableBuilder {
        this.divider("row", index);
        return this;
    }

    /**
     * Adds a divider to the table at the given column index.
     *
     * @param index The index where the divider should be added
     * @returns The same {@link TableBuilder} instance with the column divider added
     */
    public columnDivider(index: number): TableBuilder {
        this.divider("column", index);
        return this;
    }

    /**
     * Builds the table with the given data.
     *
     * @returns A new {@link Table.Instance} with the given data/options
     */
    public build(): Table.Instance {
        return new Table.Instance(this.context, this.data);
    }

    /**
     * Builds the table with the given data and shares it with the TableMediator singleton.
     *
     * @returns A new, **shared** {@link Table.Instance} with the given data/options
     */
    public buildAndShare(): Table.Instance {
        const table = new Table.Instance(this.context, this.data);
        TableMediator.getInstance().addTable(table);
        return table;
    }

    /**
     * Resets all data configured in the builder from previously-created table views.
     */
    public reset(): void {
        this.data.actions.row.clear();
        this.data.actions.column.clear();

        this.data.dividers.row = [];
        this.data.dividers.column = [];

        this.data.columns = [];
        this.data.rows = [];
        this.data.title = "";
    }
}
