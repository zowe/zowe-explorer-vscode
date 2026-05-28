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
import { Mock, vi } from "vitest";
import * as vscode from "vscode";
import * as fs from "fs";
import { Config, ConfigBuilder, ConfigSchema } from "@zowe/imperative";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";

// Mock all external dependencies
vi.mock("vscode", () => ({
    workspace: {
        openTextDocument: vi.fn(),
    },
    window: {
        showTextDocument: vi.fn(),
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
    },
    Uri: {
        file: vi.fn(),
    },
    Position: vi.fn(),
    Selection: vi.fn(),
    Range: vi.fn(),
    TextEditorRevealType: {
        InCenter: "inCenter",
    },
}));

vi.mock("path", () => ({
    join: vi.fn().mockImplementation((...args) => args.join("/")),
    dirname: vi.fn().mockImplementation((p) => p.split("/").slice(0, -1).join("/")),
    basename: vi.fn().mockImplementation((p) => p.split("/").pop() || ""),
}));

vi.mock("fs", () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

vi.mock("@zowe/imperative", () => ({
    Config: {
        load: vi.fn(),
    },
    ConfigBuilder: {
        build: vi.fn(),
    },
    ConfigSchema: {
        buildSchema: vi.fn(),
    },
}));

vi.mock("@zowe/zowe-explorer-api", () => ({
    ZoweVsCodeExtension: {
        workspaceRoot: {
            uri: {
                fsPath: "/mock/workspace",
            },
        },
        openConfigFile: vi.fn(),
        getConfigLayers: vi.fn(),
    },
    FileManagement: {
        getZoweDir: vi.fn().mockReturnValue("/mock/zowe"),
        getFullPath: vi.fn().mockImplementation((p: string) => p),
    },
}));

vi.mock("@zowe/core-for-zowe-sdk", () => ({
    ProfileConstants: {
        BaseProfile: "base",
    },
}));

describe("ConfigEditorFileOperations", () => {
    let fileOperations: ConfigEditorFileOperations;
    let mockGetLocalConfigs: Mock;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        mockGetLocalConfigs = vi.fn().mockResolvedValue({ configs: [], parseErrors: [] });
        fileOperations = new ConfigEditorFileOperations(mockGetLocalConfigs);

        vscode.workspace.openTextDocument.mockResolvedValue({
            getText: vi.fn().mockReturnValue('{"profiles": {"test": {"type": "zosmf"}}}'),
        });

        vscode.window.showTextDocument.mockResolvedValue({
            selection: {},
            revealRange: vi.fn(),
        });

        vscode.Uri.file.mockImplementation((path: string) => ({ fsPath: path }));

        fs.existsSync.mockReturnValue(true);
        fs.mkdirSync.mockImplementation(() => {});
    });

    describe("createNewConfig", () => {
        beforeEach(() => {
            Config.load.mockResolvedValue({
                api: {
                    layers: {
                        activate: vi.fn(),
                        merge: vi.fn(),
                    },
                },
                save: vi.fn(),
                setSchema: vi.fn(),
                userConfigName: "zowe.config.user.json",
                configName: "zowe.config.json",
            });

            ConfigBuilder.build.mockResolvedValue({});

            ConfigSchema.buildSchema.mockReturnValue({});

            ZoweVsCodeExtension.getConfigLayers.mockResolvedValue([]);

            // Mock profilesCache
            (ZoweVsCodeExtension as any).profilesCache = {
                getCoreProfileTypes: vi.fn().mockReturnValue([]),
                getConfigArray: vi.fn().mockReturnValue([]),
            };
        });

        it("should create configuration successfully for all types", async () => {
            const configTypes = ["global-team", "global-user", "project-team", "project-user"];

            for (const configType of configTypes) {
                vi.clearAllMocks();

                const message = { configType };
                fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
                ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);

                const result = await fileOperations.createNewConfig(message);

                expect(result).toEqual({ configs: [], parseErrors: [] });
                // Just check that the message starts with "Configuration file created:" without checking the exact path
                // since different config types use different root paths (global vs project)
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("Configuration file created:"));
            }
        });

        it("should handle missing workspace root for project configurations", async () => {
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
            const message = { configType: "global-team" };
            fs.existsSync.mockReturnValue(true);

            // Test Error object
            Config.load.mockRejectedValue(new Error("Config load failed"));
            let result = await fileOperations.createNewConfig(message);
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error creating new configuration: Config load failed");

            // Test non-Error object
            Config.load.mockRejectedValue("String error");
            result = await fileOperations.createNewConfig(message);
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error creating new configuration: String error");
        });

        it("should handle file not being created on disk", async () => {
            const message = { configType: "global-team" };
            fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
            ZoweVsCodeExtension.openConfigFile.mockResolvedValue(undefined);

            const result = await fileOperations.createNewConfig(message);

            expect(result).toEqual({ configs: [], parseErrors: [] });
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("Failed to create configuration file at:"));
        });
    });

    describe("checkExistingConfig", () => {
        it("should handle all existing config scenarios", async () => {
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
