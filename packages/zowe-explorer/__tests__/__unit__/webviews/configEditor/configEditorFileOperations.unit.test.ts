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

import { ConfigEditorFileOperations } from "../../../../src/utils/ConfigEditorFileOperations";

const vscode = require("vscode");
const fs = require("fs");

// Mock all external dependencies
jest.mock("vscode", () => ({
    workspace: {
        openTextDocument: jest.fn(),
    },
    window: {
        showTextDocument: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
    },
    Uri: {
        file: jest.fn(),
    },
    Position: jest.fn(),
    Selection: jest.fn(),
    Range: jest.fn(),
    TextEditorRevealType: {
        InCenter: "inCenter",
    },
}));

jest.mock("path", () => ({
    join: jest.fn().mockImplementation((...args) => args.join("/")),
    dirname: jest.fn().mockImplementation((p) => p.split("/").slice(0, -1).join("/")),
    basename: jest.fn().mockImplementation((p) => p.split("/").pop() || ""),
}));

jest.mock("fs", () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
}));

jest.mock("@zowe/imperative", () => ({
    Config: {
        load: jest.fn(),
    },
    ConfigBuilder: {
        build: jest.fn(),
    },
    ConfigSchema: {
        buildSchema: jest.fn(),
    },
}));

jest.mock("@zowe/zowe-explorer-api", () => ({
    ZoweVsCodeExtension: {
        workspaceRoot: {
            uri: {
                fsPath: "/mock/workspace",
            },
        },
        openConfigFile: jest.fn(),
        getConfigLayers: jest.fn(),
    },
    FileManagement: {
        getZoweDir: jest.fn().mockReturnValue("/mock/zowe"),
        getFullPath: jest.fn().mockImplementation((p: string) => p),
    },
}));

jest.mock("@zowe/core-for-zowe-sdk", () => ({
    ProfileConstants: {
        BaseProfile: "base",
    },
}));

describe("ConfigEditorFileOperations", () => {
    let fileOperations: ConfigEditorFileOperations;
    let mockGetLocalConfigs: jest.Mock;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        mockGetLocalConfigs = jest.fn().mockResolvedValue([]);
        fileOperations = new ConfigEditorFileOperations(mockGetLocalConfigs);

        vscode.workspace.openTextDocument.mockResolvedValue({
            getText: jest.fn().mockReturnValue('{"profiles": {"test": {"type": "zosmf"}}}'),
        });

        vscode.window.showTextDocument.mockResolvedValue({
            selection: {},
            revealRange: jest.fn(),
        });

        vscode.Uri.file.mockImplementation((path: string) => ({ fsPath: path }));

        fs.existsSync.mockReturnValue(true);
        fs.mkdirSync.mockImplementation(() => {});
    });

    describe("createNewConfig", () => {
        beforeEach(() => {
            const { Config, ConfigBuilder, ConfigSchema } = require("@zowe/imperative");
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            Config.load.mockResolvedValue({
                api: {
                    layers: {
                        activate: jest.fn(),
                        merge: jest.fn(),
                    },
                },
                save: jest.fn(),
                setSchema: jest.fn(),
                userConfigName: "zowe.config.user.json",
                configName: "zowe.config.json",
            });

            ConfigBuilder.build.mockResolvedValue({});

            ConfigSchema.buildSchema.mockReturnValue({});

            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([]);

            // Mock profilesCache
            (ZoweVsCodeExtension as any).profilesCache = {
                getCoreProfileTypes: jest.fn().mockReturnValue([]),
                getConfigArray: jest.fn().mockReturnValue([]),
            };
        });

        it("should create configuration successfully for all types", async () => {
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            const configTypes = ["global-team", "global-user", "project-team", "project-user"];

            for (const configType of configTypes) {
                jest.clearAllMocks();

                const message = { configType };
                fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
                ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);

                const result = await fileOperations.createNewConfig(message);

                expect(result).toEqual([]);
                // Just check that the message starts with "Configuration file created:" without checking the exact path
                // since different config types use different root paths (global vs project)
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("Configuration file created:"));
            }
        });

        it("should handle missing workspace root for project configurations", async () => {
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            // Mock no workspace root
            ZoweVsCodeExtension.workspaceRoot = null;

            const message = {
                configType: "project-team",
            };

            const result = await fileOperations.createNewConfig(message);

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Cannot create project configuration: No workspace is open.");
        });

        it("should handle existing configuration file scenarios", async () => {
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            const message = { configType: "global-team" };
            fs.existsSync.mockReturnValue(true);
            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([{ path: "/mock/zowe/zowe.config.json" }]);

            // Test user confirms overwrite
            vscode.window.showInformationMessage.mockResolvedValue("Create New");
            await fileOperations.createNewConfig(message);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining("A Team Configuration File already exists"),
                { modal: true },
                "Create New"
            );

            // Test user declines overwrite
            vscode.window.showInformationMessage.mockResolvedValue(undefined);
            ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);
            const result = await fileOperations.createNewConfig(message);
            expect(ZoweVsCodeExtension.openConfigFile).toHaveBeenCalledWith("/mock/zowe/zowe.config.json");
            expect(result).toBeUndefined();
        });

        it("should handle configuration creation errors", async () => {
            const { Config } = require("@zowe/imperative");

            const message = { configType: "global-team" };
            fs.existsSync.mockReturnValue(true);

            // Test Error object
            Config.load.mockRejectedValue(new Error("Config load failed"));
            let result = await fileOperations.createNewConfig(message);
            expect(result).toEqual([]);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error creating new configuration: Config load failed");

            // Test non-Error object
            Config.load.mockRejectedValue("String error");
            result = await fileOperations.createNewConfig(message);
            expect(result).toEqual([]);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error creating new configuration: String error");
        });

        it("should handle file not being created on disk", async () => {
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            const message = { configType: "global-team" };
            fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
            ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);

            const result = await fileOperations.createNewConfig(message);

            expect(result).toEqual([]);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("Failed to create configuration file at:"));
        });
    });

    describe("checkExistingConfig", () => {
        it("should handle all existing config scenarios", async () => {
            const { ZoweVsCodeExtension } = require("@zowe/zowe-explorer-api");

            // Test no existing config found
            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([]);
            let result = await (fileOperations as any).checkExistingConfig("/mock/path", false);
            expect(result).toBeNull();

            // Test user confirms overwrite
            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([{ path: "/mock/path/zowe.config.json" }]);
            vscode.window.showInformationMessage.mockResolvedValue("Create New");
            result = await (fileOperations as any).checkExistingConfig("/mock/path", false);
            expect(result).toBe("zowe.config.json");

            // Test user declines overwrite
            vscode.window.showInformationMessage.mockResolvedValue(undefined);
            ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);
            result = await (fileOperations as any).checkExistingConfig("/mock/path", false);
            expect(result).toBe(false);
            expect(ZoweVsCodeExtension.openConfigFile).toHaveBeenCalledWith("/mock/path/zowe.config.json");

            // Test user config files
            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([{ path: "/mock/path/zowe.config.user.json" }]);
            vscode.window.showInformationMessage.mockResolvedValue("Create New");
            result = await (fileOperations as any).checkExistingConfig("/mock/path", true);
            expect(result).toBe("zowe.config.user.json");

            // Test multiple existing layers
            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([
                { path: "/other/path/zowe.config.json" },
                { path: "/mock/path/zowe.config.json" },
                { path: "/another/path/zowe.config.json" },
            ]);
            vscode.window.showInformationMessage.mockResolvedValue("Create New");
            result = await (fileOperations as any).checkExistingConfig("/mock/path", false);
            expect(result).toBe("zowe.config.json");
        });
    });
});
