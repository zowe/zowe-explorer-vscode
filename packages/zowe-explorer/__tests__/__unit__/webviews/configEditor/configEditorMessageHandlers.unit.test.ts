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

import { ConfigEditorMessageHandlers } from "../../../../src/utils/ConfigEditorMessageHandlers";

// Mock vscode module
jest.mock("vscode", () => ({
    window: {
        showTextDocument: jest.fn(),
        showErrorMessage: jest.fn(),
        showOpenDialog: jest.fn(),
    },
    commands: {
        executeCommand: jest.fn(),
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path })),
    },
}));

// Mock Zowe dependencies
jest.mock("@zowe/imperative", () => ({
    ProfileInfo: jest.fn(),
    ProfileCredentials: {
        defaultCredMgrWithKeytar: jest.fn(),
    },
}));

jest.mock("@zowe/zowe-explorer-api", () => ({
    ProfilesCache: {
        requireKeyring: jest.fn(),
    },
    ZoweVsCodeExtension: {
        workspaceRoot: {
            uri: {
                fsPath: "/workspace/path",
            },
        },
    },
}));

jest.mock("../../../../src/tools/ZoweLocalStorage", () => ({
    LocalStorageAccess: {
        getValue: jest.fn(),
        setValue: jest.fn(),
    },
}));

jest.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: jest.fn(),
    },
}));

jest.mock("../../../../src/configuration/Definitions", () => ({
    Definitions: {
        LocalStorageKey: {
            TEST_KEY: "test_key",
        },
    },
}));

const vscode = require("vscode");
const { ProfileInfo, ProfileCredentials } = require("@zowe/imperative");
const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");
const { LocalStorageAccess } = require("../../../../src/tools/ZoweLocalStorage");
const { Profiles } = require("../../../../src/configuration/Profiles");

describe("ConfigEditorMessageHandlers", () => {
    let messageHandlers: ConfigEditorMessageHandlers;
    let mockGetLocalConfigs: jest.Mock;
    let mockAreSecureValuesAllowed: jest.Mock;
    let mockPanel: { webview: { postMessage: jest.Mock } };

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetLocalConfigs = jest.fn().mockResolvedValue([
            { name: "config1", path: "/path/to/config1.json" },
            { name: "config2", path: "/path/to/config2.json" },
        ]);

        mockAreSecureValuesAllowed = jest.fn().mockResolvedValue(true);

        mockPanel = {
            webview: {
                postMessage: jest.fn().mockResolvedValue(true),
            },
        };

        messageHandlers = new ConfigEditorMessageHandlers(mockGetLocalConfigs, mockAreSecureValuesAllowed, mockPanel);

        // Setup default mocks
        const mockProfileInfo = {
            readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
        };
        (ProfileInfo as any).mockImplementation(() => mockProfileInfo);
        (ProfileCredentials.defaultCredMgrWithKeytar as any).mockReturnValue("mockCredMgr");
        (Profiles.getInstance as any).mockReturnValue({
            overrideWithEnv: "mockOverride",
        });
    });

    describe("handleGetProfiles", () => {
        it("should get profiles and post configurations message", async () => {
            await messageHandlers.handleGetProfiles();

            expect(ProfileInfo).toHaveBeenCalledWith("zowe", {
                overrideWithEnv: "mockOverride",
                credMgrOverride: "mockCredMgr",
            });
            expect(mockGetLocalConfigs).toHaveBeenCalled();
            expect(mockAreSecureValuesAllowed).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [
                    { name: "config1", path: "/path/to/config1.json" },
                    { name: "config2", path: "/path/to/config2.json" },
                ],
                secureValuesAllowed: true,
            });
        });
    });

    describe("handleOpenConfigFile", () => {
        it("should open config file", async () => {
            const message = { filePath: "/path/to/config.json" };

            await messageHandlers.handleOpenConfigFile(message);

            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    fsPath: "/path/to/config.json",
                })
            );
        });

        it("should handle file open error", async () => {
            vscode.window.showTextDocument.mockImplementation(() => {
                throw new Error("File not found");
            });
            const message = { filePath: "/path/to/nonexistent.json" };

            await messageHandlers.handleOpenConfigFile(message);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error opening file: /path/to/nonexistent.json:");
        });
    });

    describe("handleRevealInFinder", () => {
        it("should execute reveal in finder command", async () => {
            await messageHandlers.handleRevealInFinder({ filePath: "testPath" });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                "revealFileInOS",
                expect.objectContaining({
                    fsPath: "testPath",
                })
            );
        });

        it("should handle reveal in finder error", async () => {
            vscode.commands.executeCommand.mockImplementation(() => {
                throw new Error("Reveal error");
            });

            await messageHandlers.handleRevealInFinder({ filePath: "testPath" });

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error revealing file in explorer: testPath");
        });
    });

    describe("handleOpenSchemaFile", () => {
        it("should open schema file", async () => {
            await messageHandlers.handleOpenSchemaFile({ filePath: "testPath" });

            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    fsPath: "testPath",
                })
            );
        });
    });

    describe("handleGetEnvInformation", () => {
        it("should get environment information", async () => {
            await messageHandlers.handleGetEnvInformation();

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "ENV_INFORMATION",
                hasWorkspace: true,
            });
        });
    });

    describe("handleInitialSelection", () => {
        it("should handle initial selection", async () => {
            const mockSetInitialSelection = jest.fn();
            const mockMessage = { profileName: "testProfile", configPath: "testPath", profileType: "zosmf" };

            messageHandlers.handleInitialSelection(mockMessage, mockSetInitialSelection);

            expect(mockSetInitialSelection).toHaveBeenCalledWith({
                profileName: "testProfile",
                configPath: "testPath",
                profileType: "zosmf",
            });
        });
    });

    describe("handleConfigurationsReady", () => {
        it("should handle configurations ready with initial selection", async () => {
            const mockSetInitialSelection = jest.fn();
            const initialSelection = { profileName: "testProfile", configPath: "testPath", profileType: "zosmf" };

            await messageHandlers.handleConfigurationsReady(initialSelection, mockSetInitialSelection);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "INITIAL_SELECTION",
                profileName: "testProfile",
                configPath: "testPath",
                profileType: "zosmf",
            });
            expect(mockSetInitialSelection).toHaveBeenCalledWith(undefined);
        });

        it("should handle configurations ready without initial selection", async () => {
            const mockSetInitialSelection = jest.fn();

            await messageHandlers.handleConfigurationsReady(undefined, mockSetInitialSelection);

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
            expect(mockSetInitialSelection).not.toHaveBeenCalled();
        });
    });

    describe("handleSelectFile", () => {
        it("should show open dialog and post selection", async () => {
            const mockUri = { fsPath: "/selected/file.json" };
            vscode.window.showOpenDialog.mockResolvedValue([mockUri]);
            const message = { propertyIndex: 0, isNewProperty: true, source: "test" };

            await messageHandlers.handleSelectFile(message);

            expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
                canSelectMany: false,
                openLabel: "Select File",
                filters: {
                    "All Files": ["*"],
                },
            });
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "FILE_SELECTED",
                filePath: "/selected/file.json",
                propertyIndex: 0,
                isNewProperty: true,
                source: "test",
            });
        });

        it("should handle no file selected", async () => {
            vscode.window.showOpenDialog.mockResolvedValue(undefined);
            const message = { propertyIndex: 0, isNewProperty: true, source: "test" };

            await messageHandlers.handleSelectFile(message);

            expect(vscode.window.showOpenDialog).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe("handleGetLocalStorageValue", () => {
        it("should get local storage value", async () => {
            const mockValue = "testValue";
            LocalStorageAccess.getValue.mockReturnValue(mockValue);
            const message = { key: "testKey" };

            await messageHandlers.handleGetLocalStorageValue(message);

            expect(LocalStorageAccess.getValue).toHaveBeenCalledWith("testKey");
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "LOCAL_STORAGE_VALUE",
                key: "testKey",
                value: mockValue,
            });
        });

        it("should handle local storage error", async () => {
            LocalStorageAccess.getValue.mockImplementation(() => {
                throw new Error("Storage error");
            });
            const message = { key: "testKey" };

            await messageHandlers.handleGetLocalStorageValue(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "LOCAL_STORAGE_ERROR",
                key: "testKey",
                error: "Storage error",
            });
        });
    });

    describe("handleSetLocalStorageValue", () => {
        it("should set local storage value", async () => {
            const message = { key: "testKey", value: "testValue" };

            await messageHandlers.handleSetLocalStorageValue(message);

            expect(LocalStorageAccess.setValue).toHaveBeenCalledWith("testKey", "testValue");
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "LOCAL_STORAGE_SET_SUCCESS",
                key: "testKey",
                value: "testValue",
            });
        });

        it("should handle local storage set error", async () => {
            LocalStorageAccess.setValue.mockImplementation(() => {
                throw new Error("Set error");
            });
            const message = { key: "testKey", value: "testValue" };

            await messageHandlers.handleSetLocalStorageValue(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "LOCAL_STORAGE_ERROR",
                key: "testKey",
                error: "Set error",
            });
        });
    });

    describe("handleOpenVscodeSettings", () => {
        it("should open VS Code settings", async () => {
            const message = { searchText: "zowe" };

            await messageHandlers.handleOpenVscodeSettings(message);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.openSettings", "zowe");
        });

        it("should open VS Code settings without search text", async () => {
            const message = {};

            await messageHandlers.handleOpenVscodeSettings(message);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.openSettings", "");
        });

        it("should handle VS Code settings error", async () => {
            vscode.commands.executeCommand.mockImplementation(() => {
                throw new Error("Settings error");
            });
            const message = { searchText: "zowe" };

            await messageHandlers.handleOpenVscodeSettings(message);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error opening VS Code settings: Settings error");
        });
    });

    describe("handleGetEnvVars", () => {
        it("should get environment variables", async () => {
            const originalEnv = process.env;
            process.env = {
                ...originalEnv,
                TEST_VAR: "testValue",
                ANOTHER_VAR: "anotherValue",
                ZOWE_VAR: "zoweValue",
            };
            const message = { query: "test" };

            await messageHandlers.handleGetEnvVars(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "ENV_VARS_RESPONSE",
                envVars: expect.arrayContaining(["TEST_VAR"]),
            });

            process.env = originalEnv;
        });

        it("should get all environment variables when no query", async () => {
            const originalEnv = process.env;
            process.env = {
                ...originalEnv,
                TEST_VAR: "testValue",
                ANOTHER_VAR: "anotherValue",
            };
            const message = { query: "" };

            await messageHandlers.handleGetEnvVars(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "ENV_VARS_RESPONSE",
                envVars: expect.any(Array),
            });

            process.env = originalEnv;
        });

        it("should handle environment variables error", async () => {
            const originalEnv = process.env;
            process.env = null as any;
            const message = { query: "test" };

            await messageHandlers.handleGetEnvVars(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                command: "ENV_VARS_ERROR",
                error: expect.any(String),
            });

            process.env = originalEnv;
        });
    });
});
