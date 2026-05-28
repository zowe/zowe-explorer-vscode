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

import { vi, describe, beforeEach, afterEach, it, expect } from "vitest";
import * as vscode from "vscode";
import { TableViewUtils } from "../../../src/utils/TableViewUtils";
import { FeatureFlags } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";

vi.mock("@zowe/zowe-explorer-api");
vi.mock("../../../src/tools/ZoweLogger");

describe("TableViewUtils Unit Tests", () => {
    let mockContext: vscode.ExtensionContext;
    let mockExecuteCommand: any;
    let mockOnDidChangeConfiguration: any;
    let mockDisposable: vscode.Disposable;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock executeCommand
        mockExecuteCommand = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(vscode.commands, "executeCommand", {
            value: mockExecuteCommand,
            configurable: true,
        });

        // Mock disposable
        mockDisposable = { dispose: vi.fn() } as any;

        // Mock onDidChangeConfiguration
        mockOnDidChangeConfiguration = vi.fn().mockReturnValue(mockDisposable);
        Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
            value: mockOnDidChangeConfiguration,
            configurable: true,
        });

        // Mock extension context
        mockContext = {
            subscriptions: [],
        } as any;

        // Mock ZoweLogger
        vi.spyOn(ZoweLogger, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("initialize", () => {
        it("should set initial context value and register configuration listener", async () => {
            // Mock setting value as true
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            await TableViewUtils.initialize(mockContext);

            // Verify initial context was set
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);

            // Verify configuration listener was registered
            expect(mockOnDidChangeConfiguration).toHaveBeenCalledTimes(1);
            expect(mockContext.subscriptions).toHaveLength(1);
            expect(mockContext.subscriptions[0]).toBe(mockDisposable);
        });

        it("should set initial context value to false when setting is false", async () => {
            // Mock setting value as false
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Verify initial context was set to false
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);

            // Verify configuration listener was registered
            expect(mockOnDidChangeConfiguration).toHaveBeenCalledTimes(1);
        });

        it("should set initial context value to false when setting is undefined", async () => {
            // Mock setting value as false (default behavior of isEnabledInSettings)
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Verify initial context was set to false (default behavior)
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });
    });

    describe("updateShowZoweResourcesContext", () => {
        it("should set showZoweResources to true when setting is true", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(FeatureFlags.isEnabledInSettings).toHaveBeenCalledWith("tableView");
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] featureEnablement.tableView: true");
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] showZoweResources (set to): true");
        });

        it("should set showZoweResources to false when setting is false", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(FeatureFlags.isEnabledInSettings).toHaveBeenCalledWith("tableView");
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] featureEnablement.tableView: false");
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] showZoweResources (set to): false");
        });

        it("should set showZoweResources to false when setting is undefined", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });

        it("should log debug messages with correct values", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(ZoweLogger.debug).toHaveBeenCalledTimes(2);
            expect(ZoweLogger.debug).toHaveBeenNthCalledWith(1, "[updateShowZoweResourcesContext] featureEnablement.tableView: true");
            expect(ZoweLogger.debug).toHaveBeenNthCalledWith(2, "[updateShowZoweResourcesContext] showZoweResources (set to): true");
        });
    });

    describe("configuration change listener", () => {
        it("should update context when zowe.featureEnablement.tableView setting changes", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Get the registered listener callback
            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Reset mocks to test the listener in isolation
            mockExecuteCommand.mockClear();
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            // Create a mock configuration change event
            const mockConfigChangeEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(true),
            } as any;

            // Trigger the listener
            await listenerCallback(mockConfigChangeEvent);

            // Verify the listener checked the correct configuration
            expect(mockConfigChangeEvent.affectsConfiguration).toHaveBeenCalledWith("zowe.featureEnablement.tableView");

            // Verify context was updated
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);

            // Verify debug logging
            expect(ZoweLogger.debug).toHaveBeenCalledWith(
                "[ConfigListener] zowe.featureEnablement.tableView changed, updating showZoweResources context..."
            );
        });

        it("should not update context when unrelated setting changes", async () => {
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Get the registered listener callback
            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Reset mocks to test the listener in isolation
            mockExecuteCommand.mockClear();
            vi.mocked(ZoweLogger.debug).mockClear();

            // Create a mock configuration change event for unrelated setting
            const mockConfigChangeEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(false),
            } as any;

            // Trigger the listener
            await listenerCallback(mockConfigChangeEvent);

            // Verify the listener checked the configuration
            expect(mockConfigChangeEvent.affectsConfiguration).toHaveBeenCalledWith("zowe.featureEnablement.tableView");

            // Verify context was NOT updated
            expect(mockExecuteCommand).not.toHaveBeenCalled();

            // Verify no debug logging for update
            expect(ZoweLogger.debug).not.toHaveBeenCalledWith(
                "[ConfigListener] zowe.featureEnablement.tableView changed, updating showZoweResources context..."
            );
        });

        it("should handle configuration changes from false to true", async () => {
            // Start with false
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Change to true
            mockExecuteCommand.mockClear();
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            const mockConfigChangeEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(true),
            } as any;

            await listenerCallback(mockConfigChangeEvent);

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);
        });

        it("should handle configuration changes from true to false", async () => {
            // Start with true
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            await TableViewUtils.initialize(mockContext);

            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Change to false
            mockExecuteCommand.mockClear();
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(false);

            const mockConfigChangeEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(true),
            } as any;

            await listenerCallback(mockConfigChangeEvent);

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });
    });

    describe("edge cases", () => {
        it("should handle executeCommand errors gracefully", async () => {
            const mockError = new Error("Command execution failed");
            mockExecuteCommand.mockRejectedValue(mockError);
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockReturnValue(true);

            // Should not throw
            await expect(TableViewUtils.updateShowZoweResourcesContext()).rejects.toThrow("Command execution failed");
        });

        it("should handle FeatureFlags.isEnabledInSettings errors gracefully", async () => {
            const mockError = new Error("Settings retrieval failed");
            vi.spyOn(FeatureFlags, "isEnabledInSettings").mockImplementation(() => {
                throw mockError;
            });

            // Should throw the error
            await expect(TableViewUtils.updateShowZoweResourcesContext()).rejects.toThrow("Settings retrieval failed");
        });
    });
});
