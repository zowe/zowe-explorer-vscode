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
    private data: Table.ViewOpts;
    private forWebviewView = false;

    public constructor(context: ExtensionContext) {
        this.reset();
        this.context = context;
    }

    public isView(): this {
        this.forWebviewView = true;
        return this;
    }

    /**
     * Set optional properties for the table view.
     * @param opts The options for the table
     * @returns The same {@link TableBuilder} instance with the options added
     */
    public options(opts: Table.GridProperties): this {
        this.data = { ...this.data, options: this.data.options ? { ...this.data.options, ...opts } : opts };
        return this;
    }

    /**
     * Set the title for the next table.
     * @param name The name of the table
     * @returns The same {@link TableBuilder} instance with the title added
     */
    public title(name: string): this {
        this.data.title = name;
        return this;
    }

    /**
     * Set the rows for the next table.
     * @param rows The rows of content to use for the table
     * @returns The same {@link TableBuilder} instance with the rows added
     */
    public rows(...rows: Table.RowData[]): this {
        this.data.rows = rows;
        return this;
    }

    /**
     * Adds rows to the table. Does not replace existing rows.
     * @param rows The rows of content to add to the table
     * @returns The same {@link TableBuilder} instance with the new rows added
     */
    public addRows(rows: Table.RowData[]): this {
        this.data.rows = [...this.data.rows, ...rows];
        return this;
    }

    /**
     * Set the columns for the next table.
     * @param columns The columns to use for the table
     * @returns The same {@link TableBuilder} instance with the columns added
     */
    public columns(...columns: Table.ColumnOpts[]): this {
        this.data.columns = this.convertColumnOpts(columns);
        return this;
    }

    private convertColumnOpts(columns: Table.ColumnOpts[]): Table.Column[] {
        return columns.map((col) => ({
            ...col,
            comparator: col.comparator?.toString(),
            colSpan: col.colSpan?.toString(),
            rowSpan: col.rowSpan?.toString(),
            valueFormatter: col.valueFormatter?.toString(),
        }));
    }

    /**
     * Adds columns to the table. Does not replace existing columns.
     * @param columns The column definitions to add to the table
     * @returns The same {@link TableBuilder} instance with the new column definitions added
     */
    public addColumns(columns: Table.ColumnOpts[]): this {
        this.data.columns = [...this.data.columns, ...this.convertColumnOpts(columns)];
        return this;
    }

    /**
     * Add context options for the next table.
     * @param actions the record of indices to {@link Table.Action} arrays to use for the table
     * @returns The same {@link TableBuilder} instance with the row actions added
     */
    public contextOptions(opts: Record<number | "all", Table.ContextMenuOpts[]>): this {
        for (const [key, optsForKey] of Object.entries(opts)) {
            for (const opt of optsForKey) {
                this.addContextOption(key as number | "all", opt);
            }
        }
        return this;
    }

    /**
     * Add a context menu option to the table.
     * @param index The row index to add an option to (or "all" for all rows)
     * @returns The same {@link TableBuilder} instance with the context menu option added
     */
    public addContextOption(index: number | "all", option: Table.ContextMenuOpts): this {
        if (this.data.contextOpts[index]) {
            const opts = this.data.contextOpts[index];
            this.data.contextOpts[index] = [...opts, { ...option, condition: option.condition?.toString() }];
        } else {
            this.data.contextOpts[index] = [{ ...option, condition: option.condition?.toString() }];
        }
        return this;
    }

    /**
     * Add row actions for the next table.
     * @param actions the record of indices to {@link Table.Action} arrays to use for the table
     * @returns The same {@link TableBuilder} instance with the row actions added
     */
    public rowActions(actions: Record<number | "all", Table.ActionOpts[]>): this {
        for (const key of Object.keys(actions)) {
            this.addRowAction(key as number | "all", actions[key]);
        }
        return this;
    }

    /**
     * Add a row action to the next table.
     * @param index The column index to add an action to
     * @returns The same {@link TableBuilder} instance with the row action added
     */
    public addRowAction(index: number | "all", action: Table.ActionOpts): this {
        if (this.data.actions[index]) {
            const actionList = this.data.actions[index];
            this.data.actions[index] = [...actionList, { ...action, condition: action.condition?.toString() }];
        } else {
            this.data.actions[index] = [{ ...action, condition: action.condition?.toString() }];
        }
        return this;
    }

    /**
     * Builds the table with the given data.
     * @returns A new {@link Table.Instance} with the given data/options
     */
    public build(): Table.Instance {
        // Construct column definitions if rows were provided, but no columns are specified at time of build
        if (this.data.columns.length === 0 && this.data.rows.length > 0) {
            this.data.columns = Object.keys(this.data.rows[0]).map((k) => ({ field: k }));
        }

        return new Table.Instance(this.context, this.forWebviewView, this.data);
    }

    /**
     * Builds the table with the given data and shares it with the TableMediator singleton.
     * @returns A new, **shared** {@link Table.Instance} with the given data/options
     */
    public buildAndShare(): Table.Instance {
        const table = this.build();
        TableMediator.getInstance().addTable(table);
        return table;
    }

    /**
     * Resets all data configured in the builder from previously-created table views.
     */
    public reset(): void {
        this.data = {
            actions: {
                all: [],
            },
            contextOpts: {
                all: [],
            },
            columns: [],
            rows: [],
            title: "",
        };
    }
}
