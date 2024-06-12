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

import { Table } from "../TableView";

/**
 * Mediator class for managing and accessing shared tables in Zowe Explorer.
 * Developers can expose their tables to allow external extenders to contribute to them.
 * This class serves to satisfy three main use cases:
 *
 * @remarks
 *
 * ## Adding a table
 *
 * Tables are added to the mediator based on their unique ID using {@link TableMediator.addTable}. The ID is in the following format:
 *
 * `<TableName>-<8digit-Unique-Id>##<ExtensionId>`
 *
 * This avoids indirect naming conflicts by making the table identifier specific to the contributing extension.
 * The table ID can be accessed directly from a {@link Table.View} instance using the {@link Table.View.getId} function.
 *
 * ## Accessing a table
 *
 * Tables are only accessible by their unique IDs using {@link TableMediator.getTable}. Extenders must communicate a table ID
 * to another extender to facilitate table changes between extensions. This facilitates explicit access requests
 * by ensuring that two or more extenders are coordinating changes to the same table.
 *
 * The map containing the tables is not publicly exposed and is defined as a
 * [private class property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties)
 * to avoid exposing any tables to extenders who do not have explicit access.
 *
 * ## Removing a table
 *
 * Tables can only be removed by the extender that has contributed them using {@link TableMediator.deleteTable}.
 * This establishes a read-only relationship between the mediator and extenders that have not contributed the table they are trying to access.
 *
 * **Note** that this does not prevent an extender with access to the ID from disposing the table once they've received access to the instance.
 */

export class TableMediator {
    private static instance: TableMediator;
    #tables: Map<string, Table.View>;

    private constructor() {}

    /**
     * Access the singleton instance.
     *
     * @returns the global {@link TableMediator} instance
     */
    public static getInstance(): TableMediator {
        if (!this.instance) {
            this.instance = new TableMediator();
        }

        return this.instance;
    }

    /**
     * Adds a table to the mediator to enable sharing between extensions.
     *
     * @param table The {@link Table.View} instance to add to the mediator
     */
    public addTable(table: Table.View): void {
        this.#tables.set(table.getId(), table);
    }

    /**
     * Accesses a table in the mediator based on its unique ID.
     *
     * @param id The unique identifier for the desired table
     *
     * @returns
     * * {@link Table.View} instance if the table exists
     * * `undefined` if the instance was deleted or does not exist
     */
    public getTable(id: string): Table.View | undefined {
        return this.#tables.get(id);
    }

    /**
     * Removes a table from the mediator.
     * Note that the
     *
     * @param id The unique ID of the table to delete
     * @returns `true` if the table was deleted; `false` otherwise
     */
    public removeTable(id: string): boolean {
        if (this.#tables.has(id)) {
            return false;
        }

        return this.#tables.delete(id);
    }
}
