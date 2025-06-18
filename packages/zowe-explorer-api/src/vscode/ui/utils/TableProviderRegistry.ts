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

import { Logger } from "@zowe/imperative";
import type { Table } from "../TableView";

/**
 * Interface for table action providers that extenders can implement
 * to contribute actions and context menu items to tables
 */
export interface TableActionProvider {
    /**
     * Provide actions for a table based on its context
     * @param context The table context information
     * @returns Array of actions to add to the table
     */
    provideActions(context: Table.Context.IBaseData): Table.Action[] | Promise<Table.Action[]>;

    /**
     * Provide context menu items for a table based on its context
     * @param context The table context information
     * @returns Array of context menu items to add to the table
     */
    provideContextMenuItems?(context: Table.Context.IBaseData): Table.ContextMenuOption[] | Promise<Table.ContextMenuOption[]>;
}

/**
 * Registry for managing table action providers and table identifiers
 * Provides extensibility for table views by allowing extenders to register providers
 * that can contribute actions and context menu items
 */
export class TableProviderRegistry {
    private static instance: TableProviderRegistry;
    private providers: Map<string, TableActionProvider[]> = new Map();

    private constructor() {}

    /**
     * Get the singleton instance of the registry
     */
    public static getInstance(): TableProviderRegistry {
        if (!TableProviderRegistry.instance) {
            TableProviderRegistry.instance = new TableProviderRegistry();
        }
        return TableProviderRegistry.instance;
    }

    /**
     * Register a table action provider for a specific table ID
     * @param tableId The table identifier to register the provider for
     * @param provider The action provider implementation
     */
    public registerProvider(tableId: string, provider: TableActionProvider): void {
        if (!tableId) {
            throw new Error("Table ID cannot be empty");
        }
        if (!provider) {
            throw new Error("Provider cannot be null or undefined");
        }

        if (!this.providers.has(tableId)) {
            this.providers.set(tableId, []);
        }

        const existingProviders = this.providers.get(tableId)!;
        if (!existingProviders.includes(provider)) {
            existingProviders.push(provider);
        }
    }

    /**
     * Unregister a table action provider for a specific table ID
     * @param tableId The table identifier to unregister the provider from
     * @param provider The action provider to remove
     */
    public unregisterProvider(tableId: string, provider: TableActionProvider): void {
        const providers = this.providers.get(tableId);
        if (providers) {
            const index = providers.indexOf(provider);
            if (index > -1) {
                providers.splice(index, 1);
            }
            if (providers.length === 0) {
                this.providers.delete(tableId);
            }
        }
    }

    /**
     * Get all actions from registered providers for a table
     * @param context The table context information
     * @returns Array of actions from all providers
     */
    public async getActions(context: Table.Context.IBaseData): Promise<Table.Action[]> {
        const actions: Table.Action[] = [];
        const providers = this.providers.get(context.tableId);

        if (providers) {
            for (const provider of providers) {
                try {
                    const providerActions = await provider.provideActions(context);
                    actions.push(...providerActions);
                } catch (error) {
                    Logger.getImperativeLogger().error(`Error getting actions from provider for table ${context.tableId}:`, error);
                }
            }
        }

        return actions;
    }

    /**
     * Get all context menu items from registered providers for a table
     * @param context The table context information
     * @returns Array of context menu items from all providers
     */
    public async getContextMenuItems(context: Table.Context.IBaseData): Promise<Table.ContextMenuOption[]> {
        const items: Table.ContextMenuOption[] = [];
        const providers = this.providers.get(context.tableId);

        if (providers) {
            for (const provider of providers) {
                try {
                    if (provider.provideContextMenuItems) {
                        const providerItems = await provider.provideContextMenuItems(context);
                        items.push(...providerItems);
                    }
                } catch (error) {
                    Logger.getImperativeLogger().error(`Error getting context menu items from provider for table ${context.tableId}:`, error);
                }
            }
        }

        return items;
    }

    /**
     * Get all registered table IDs
     * @returns Array of table IDs that have registered providers
     */
    public getRegisteredTableIds(): string[] {
        return Array.from(this.providers.keys());
    }
}
