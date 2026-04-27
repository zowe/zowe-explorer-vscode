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

import * as vscode from "vscode";
import { TableViewUtils } from "../../../src/utils/TableViewUtils";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";

jest.mock("../../../src/configuration/SettingsConfig");
jest.mock("../../../src/tools/ZoweLogger");

describe("TableViewUtils Unit Tests", () => {
    let mockContext: vscode.ExtensionContext;
    let mockExecuteCommand: jest.Mock;
    let mockOnDidChangeConfiguration: jest.Mock;
    let mockDisposable: vscode.Disposable;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock executeCommand
        mockExecuteCommand = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(vscode.commands, "executeCommand", {
            value: mockExecuteCommand,
            configurable: true,
        });

        // Mock disposable
        mockDisposable = { dispose: jest.fn() } as any;

        // Mock onDidChangeConfiguration
        mockOnDidChangeConfiguration = jest.fn().mockReturnValue(mockDisposable);
        Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
            value: mockOnDidChangeConfiguration,
            configurable: true,
        });

        // Mock extension context
        mockContext = {
            subscriptions: [],
        } as any;

        // Mock ZoweLogger
        jest.spyOn(ZoweLogger, "debug").mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("initialize", () => {
        it("should set initial context value and register configuration listener", async () => {
            // Mock setting value as true
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

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
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Verify initial context was set to false
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);

            // Verify configuration listener was registered
            expect(mockOnDidChangeConfiguration).toHaveBeenCalledTimes(1);
        });

        it("should set initial context value to false when setting is undefined", async () => {
            // Mock setting value as undefined (default)
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(undefined);

            await TableViewUtils.initialize(mockContext);

            // Verify initial context was set to false (default behavior)
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });
    });

    describe("updateShowZoweResourcesContext", () => {
        it("should set showZoweResources to true when setting is true", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(SettingsConfig.getDirectValue).toHaveBeenCalledWith("zowe.featureEnablement.tableView", false);
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] featureEnablement.tableView: true");
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] showZoweResources (set to): true");
        });

        it("should set showZoweResources to false when setting is false", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(SettingsConfig.getDirectValue).toHaveBeenCalledWith("zowe.featureEnablement.tableView", false);
            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] featureEnablement.tableView: false");
            expect(ZoweLogger.debug).toHaveBeenCalledWith("[updateShowZoweResourcesContext] showZoweResources (set to): false");
        });

        it("should set showZoweResources to false when setting is undefined", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(undefined);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });

        it("should log debug messages with correct values", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            await TableViewUtils.updateShowZoweResourcesContext();

            expect(ZoweLogger.debug).toHaveBeenCalledTimes(2);
            expect(ZoweLogger.debug).toHaveBeenNthCalledWith(1, "[updateShowZoweResourcesContext] featureEnablement.tableView: true");
            expect(ZoweLogger.debug).toHaveBeenNthCalledWith(2, "[updateShowZoweResourcesContext] showZoweResources (set to): true");
        });
    });

    describe("configuration change listener", () => {
        it("should update context when zowe.featureEnablement.tableView setting changes", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Get the registered listener callback
            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Reset mocks to test the listener in isolation
            mockExecuteCommand.mockClear();
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            // Create a mock configuration change event
            const mockConfigChangeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true),
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
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            // Get the registered listener callback
            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Reset mocks to test the listener in isolation
            mockExecuteCommand.mockClear();
            (ZoweLogger.debug as jest.Mock).mockClear();

            // Create a mock configuration change event for unrelated setting
            const mockConfigChangeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(false),
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
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            await TableViewUtils.initialize(mockContext);

            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Change to true
            mockExecuteCommand.mockClear();
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            const mockConfigChangeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true),
            } as any;

            await listenerCallback(mockConfigChangeEvent);

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);
        });

        it("should handle configuration changes from true to false", async () => {
            // Start with true
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            await TableViewUtils.initialize(mockContext);

            const listenerCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

            // Change to false
            mockExecuteCommand.mockClear();
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            const mockConfigChangeEvent = {
                affectsConfiguration: jest.fn().mockReturnValue(true),
            } as any;

            await listenerCallback(mockConfigChangeEvent);

            expect(mockExecuteCommand).toHaveBeenCalledWith("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
        });
    });

    describe("edge cases", () => {
        it("should handle executeCommand errors gracefully", async () => {
            const mockError = new Error("Command execution failed");
            mockExecuteCommand.mockRejectedValue(mockError);
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

            // Should not throw
            await expect(TableViewUtils.updateShowZoweResourcesContext()).rejects.toThrow("Command execution failed");
        });

        it("should handle SettingsConfig.getDirectValue errors gracefully", async () => {
            const mockError = new Error("Settings retrieval failed");
            jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation(() => {
                throw mockError;
            });

            // Should throw the error
            await expect(TableViewUtils.updateShowZoweResourcesContext()).rejects.toThrow("Settings retrieval failed");
        });
    });
});
