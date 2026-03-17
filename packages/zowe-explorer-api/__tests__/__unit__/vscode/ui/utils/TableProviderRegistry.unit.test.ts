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
import { Table, TableActionProvider, TableProviderRegistry } from "../../../../../src";

describe("TableProviderRegistry", () => {
    let registry: TableProviderRegistry;
    let mockProvider: TableActionProvider;
    let mockProvider2: TableActionProvider;
    let mockContext: Table.Context.IBaseData;
    let mockLogger: { error: jest.Mock };

    beforeAll(() => {
        jest.spyOn(Logger, "getImperativeLogger").mockReturnValue({
            error: jest.fn(),
        } as any);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        // Reset the singleton instance before each test
        (TableProviderRegistry as any).instance = undefined;
        registry = TableProviderRegistry.getInstance();

        // Create mock providers
        mockProvider = {
            provideActions: jest.fn(),
            provideContextMenuItems: jest.fn(),
        };

        mockProvider2 = {
            provideActions: jest.fn(),
            provideContextMenuItems: jest.fn(),
        };

        // Create mock context
        mockContext = {
            tableId: "test-table",
            additionalProperty: "test-value",
        };

        // Setup logger mock
        mockLogger = { error: jest.fn() };
        (Logger.getImperativeLogger as jest.Mock).mockReturnValue(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("singleton pattern", () => {
        it("should return the same instance when called multiple times", () => {
            const instance1 = TableProviderRegistry.getInstance();
            const instance2 = TableProviderRegistry.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBe(registry);
        });

        it("should create a new instance if none exists", () => {
            (TableProviderRegistry as any).instance = undefined;
            const instance = TableProviderRegistry.getInstance();

            expect(instance).toBeInstanceOf(TableProviderRegistry);
            expect(instance).toBe(TableProviderRegistry.getInstance());
        });
    });

    describe("registerProvider", () => {
        it("should register a provider for a table ID", () => {
            expect(() => {
                registry.registerProvider("test-table", mockProvider);
            }).not.toThrow();

            const tableIds = registry.getRegisteredTableIds();
            expect(tableIds).toContain("test-table");
        });

        it("should register multiple providers for the same table ID", () => {
            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);

            const tableIds = registry.getRegisteredTableIds();
            expect(tableIds).toContain("test-table");
            expect(tableIds).toHaveLength(1);
        });

        it("should not register the same provider twice for the same table ID", () => {
            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider);

            // Should still only have one instance
            const providers = (registry as any).providers.get("test-table");
            expect(providers).toHaveLength(1);
        });

        it("should throw an error if table ID is empty", () => {
            expect(() => {
                registry.registerProvider("", mockProvider);
            }).toThrow("Table ID cannot be empty");
        });

        it("should throw an error if provider is null", () => {
            expect(() => {
                registry.registerProvider("test-table", null as any);
            }).toThrow("Provider cannot be null or undefined");
        });

        it("should throw an error if provider is undefined", () => {
            expect(() => {
                registry.registerProvider("test-table", undefined as any);
            }).toThrow("Provider cannot be null or undefined");
        });
    });

    describe("unregisterProvider", () => {
        beforeEach(() => {
            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);
        });

        it("should unregister a specific provider from a table ID", () => {
            registry.unregisterProvider("test-table", mockProvider);

            const providers = (registry as any).providers.get("test-table");
            expect(providers).toHaveLength(1);
            expect(providers).toContain(mockProvider2);
            expect(providers).not.toContain(mockProvider);
        });

        it("should remove table ID from registry when no providers remain", () => {
            registry.unregisterProvider("test-table", mockProvider);
            registry.unregisterProvider("test-table", mockProvider2);

            const tableIds = registry.getRegisteredTableIds();
            expect(tableIds).not.toContain("test-table");
            expect(tableIds).toHaveLength(0);
        });

        it("should do nothing if provider is not registered", () => {
            const unregisteredProvider = { provideActions: jest.fn() };

            expect(() => {
                registry.unregisterProvider("test-table", unregisteredProvider);
            }).not.toThrow();

            const providers = (registry as any).providers.get("test-table");
            expect(providers).toHaveLength(2);
        });

        it("should do nothing if table ID does not exist", () => {
            expect(() => {
                registry.unregisterProvider("non-existent-table", mockProvider);
            }).not.toThrow();
        });
    });

    describe("getActions", () => {
        const mockActions: Table.Action[] = [
            {
                title: "Test Action",
                command: "test-command",
                callback: {
                    typ: "no-selection",
                    fn: jest.fn(),
                },
            },
        ];

        const mockActions2: Table.Action[] = [
            {
                title: "Test Action 2",
                command: "test-command-2",
                callback: {
                    typ: "single-row",
                    fn: jest.fn(),
                },
            },
        ];

        it("should return actions from a registered provider", async () => {
            (mockProvider.provideActions as jest.Mock).mockResolvedValue(mockActions);
            registry.registerProvider("test-table", mockProvider);

            const actions = await registry.getActions(mockContext);

            expect(actions).toEqual(mockActions);
            expect(mockProvider.provideActions).toHaveBeenCalledWith(mockContext);
        });

        it("should return actions from multiple providers", async () => {
            (mockProvider.provideActions as jest.Mock).mockResolvedValue(mockActions);
            (mockProvider2.provideActions as jest.Mock).mockResolvedValue(mockActions2);

            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);

            const actions = await registry.getActions(mockContext);

            expect(actions).toEqual([...mockActions, ...mockActions2]);
            expect(mockProvider.provideActions).toHaveBeenCalledWith(mockContext);
            expect(mockProvider2.provideActions).toHaveBeenCalledWith(mockContext);
        });

        it("should return empty array if no providers are registered", async () => {
            const actions = await registry.getActions(mockContext);

            expect(actions).toEqual([]);
        });

        it("should handle provider errors gracefully", async () => {
            const error = new Error("Provider error");
            (mockProvider.provideActions as jest.Mock).mockRejectedValue(error);
            (mockProvider2.provideActions as jest.Mock).mockResolvedValue(mockActions2);

            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);

            const actions = await registry.getActions(mockContext);

            expect(actions).toEqual(mockActions2);
            expect(mockLogger.error).toHaveBeenCalledWith("Error getting actions from provider for table test-table:", error);
        });

        it("should handle synchronous provider responses", async () => {
            (mockProvider.provideActions as jest.Mock).mockReturnValue(mockActions);
            registry.registerProvider("test-table", mockProvider);

            const actions = await registry.getActions(mockContext);

            expect(actions).toEqual(mockActions);
        });
    });

    describe("getContextMenuItems", () => {
        const mockContextItems: Table.ContextMenuOption[] = [
            {
                title: "Test Context Item",
                command: "test-context-command",
                callback: {
                    typ: "cell",
                    fn: jest.fn(),
                },
            },
        ];

        const mockContextItems2: Table.ContextMenuOption[] = [
            {
                title: "Test Context Item 2",
                command: "test-context-command-2",
                callback: {
                    typ: "multi-row",
                    fn: jest.fn(),
                },
            },
        ];

        it("should return context menu items from a registered provider", async () => {
            (mockProvider.provideContextMenuItems as jest.Mock).mockResolvedValue(mockContextItems);
            registry.registerProvider("test-table", mockProvider);

            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual(mockContextItems);
            expect(mockProvider.provideContextMenuItems).toHaveBeenCalledWith(mockContext);
        });

        it("should return context menu items from multiple providers", async () => {
            (mockProvider.provideContextMenuItems as jest.Mock).mockResolvedValue(mockContextItems);
            (mockProvider2.provideContextMenuItems as jest.Mock).mockResolvedValue(mockContextItems2);

            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);

            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual([...mockContextItems, ...mockContextItems2]);
            expect(mockProvider.provideContextMenuItems).toHaveBeenCalledWith(mockContext);
            expect(mockProvider2.provideContextMenuItems).toHaveBeenCalledWith(mockContext);
        });

        it("should return empty array if no providers are registered", async () => {
            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual([]);
        });

        it("should handle providers without provideContextMenuItems method", async () => {
            const providerWithoutContextMenu = { provideActions: jest.fn() };
            registry.registerProvider("test-table", providerWithoutContextMenu);

            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual([]);
        });

        it("should handle provider errors gracefully", async () => {
            const error = new Error("Context menu provider error");
            (mockProvider.provideContextMenuItems as jest.Mock).mockRejectedValue(error);
            (mockProvider2.provideContextMenuItems as jest.Mock).mockResolvedValue(mockContextItems2);

            registry.registerProvider("test-table", mockProvider);
            registry.registerProvider("test-table", mockProvider2);

            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual(mockContextItems2);
            expect(mockLogger.error).toHaveBeenCalledWith("Error getting context menu items from provider for table test-table:", error);
        });

        it("should handle synchronous provider responses", async () => {
            (mockProvider.provideContextMenuItems as jest.Mock).mockReturnValue(mockContextItems);
            registry.registerProvider("test-table", mockProvider);

            const items = await registry.getContextMenuItems(mockContext);

            expect(items).toEqual(mockContextItems);
        });
    });

    describe("getRegisteredTableIds", () => {
        it("should return an empty array when no providers are registered", () => {
            const tableIds = registry.getRegisteredTableIds();

            expect(tableIds).toEqual([]);
        });

        it("should return all registered table IDs", () => {
            registry.registerProvider("table1", mockProvider);
            registry.registerProvider("table2", mockProvider2);

            const tableIds = registry.getRegisteredTableIds();

            expect(tableIds).toHaveLength(2);
            expect(tableIds).toContain("table1");
            expect(tableIds).toContain("table2");
        });

        it("should not return duplicate table IDs", () => {
            registry.registerProvider("table1", mockProvider);
            registry.registerProvider("table1", mockProvider2);

            const tableIds = registry.getRegisteredTableIds();

            expect(tableIds).toHaveLength(1);
            expect(tableIds).toContain("table1");
        });

        it("should update when providers are unregistered", () => {
            registry.registerProvider("table1", mockProvider);
            registry.registerProvider("table2", mockProvider2);

            let tableIds = registry.getRegisteredTableIds();
            expect(tableIds).toHaveLength(2);

            registry.unregisterProvider("table1", mockProvider);
            tableIds = registry.getRegisteredTableIds();

            expect(tableIds).toHaveLength(1);
            expect(tableIds).toContain("table2");
            expect(tableIds).not.toContain("table1");
        });
    });

    describe("integration scenarios", () => {
        it("should work with real-world scenario of multiple providers for dataset table", async () => {
            const datasetContext: Table.Context.IBaseData = {
                tableId: "data-sets",
                profileName: "test-profile",
            };

            const downloadProvider = {
                provideActions: jest.fn().mockResolvedValue([
                    {
                        title: "Download",
                        command: "download-dataset",
                        callback: { typ: "single-row", fn: jest.fn() },
                    },
                ]),
                provideContextMenuItems: jest.fn().mockResolvedValue([
                    {
                        title: "Download",
                        command: "download-dataset",
                        callback: { typ: "single-row", fn: jest.fn() },
                    },
                ]),
            };

            const deleteProvider = {
                provideActions: jest.fn().mockResolvedValue([
                    {
                        title: "Delete",
                        command: "delete-dataset",
                        callback: { typ: "multi-row", fn: jest.fn() },
                    },
                ]),
                provideContextMenuItems: jest.fn().mockResolvedValue([
                    {
                        title: "Delete",
                        command: "delete-dataset",
                        callback: { typ: "multi-row", fn: jest.fn() },
                    },
                ]),
            };

            registry.registerProvider("data-sets", downloadProvider);
            registry.registerProvider("data-sets", deleteProvider);

            const actions = await registry.getActions(datasetContext);
            const contextItems = await registry.getContextMenuItems(datasetContext);

            expect(actions).toHaveLength(2);
            expect(contextItems).toHaveLength(2);
            expect(actions.map((a) => a.command)).toContain("download-dataset");
            expect(actions.map((a) => a.command)).toContain("delete-dataset");
        });
    });
});
