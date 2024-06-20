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
        actions: {},
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
     * Add row actions for the next table.
     *
     * @param actions the record of indices to {@link Table.Action} arrays to use for the table
     * @returns The same {@link TableBuilder} instance with the row actions added
     */
    public rowActions(actions: Record<number, Table.Action[]>): TableBuilder {
        this.data.actions = actions;
        return this;
    }

    /**
     * Add a row action to the next table.
     *
     * @param index The column index to add an action to
     * @returns The same {@link TableBuilder} instance with the row action added
     */
    public rowAction(index: number, action: Table.Action): TableBuilder {
        if (this.data.actions[index]) {
            const actions = this.data.actions[index];
            this.data.actions[index] = [...actions, action];
        } else {
            this.data.actions[index] = [action];
        }
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
        this.data.actions = {};
        this.data.columns = [];
        this.data.rows = [];
        this.data.title = "";
    }
}
