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
import { MockInstance } from "vitest";

import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Definitions } from "../../../src/configuration/Definitions";

describe("SettingsConfig Unit Tests", () => {
    beforeEach(() => {
        Object.defineProperty(ZoweLogger, "trace", { value: vi.fn(), configurable: true });
        Object.defineProperty(ZoweLocalStorage, "globalState", {
            value: {
                get: () => ({
                    persistence: true,
                    favorites: [],
                    history: [],
                    sessions: ["zosmf"],
                    searchHistory: [],
                    fileHistory: [],
                    templates: [],
                }),
                update: vi.fn(),
                keys: () => [],
            },
            configurable: true,
        });
    });
    afterEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });
    describe("function migrateToLocalStorage", () => {
        it("should successfully migrate to local storage old VS Code persistent settings", async () => {
            vi.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({ globalValue: "test" }),
            });
            const setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue");
            const promptReloadSpy = vi.spyOn(SettingsConfig as any, "promptReload");
            await (SettingsConfig as any).migrateToLocalStorage();
            expect(setValueSpy).toHaveBeenCalledTimes(8);
            expect(promptReloadSpy).toHaveBeenCalledTimes(1);
        });
        it("should successfully migrate to local storage and update data set templates to new setting", async () => {
            vi.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({ globalValue: "test" }),
            });
            vi.spyOn(SettingsConfig as any, "getDirectValue").mockReturnValue({
                get: () => ({
                    persistence: true,
                    favorites: [],
                    history: [],
                    sessions: ["zosmf"],
                    searchHistory: [],
                    fileHistory: [],
                    templates: [
                        {
                            mockTemplate1: {
                                alcunit: "CYL",
                                blksize: 3130,
                                dirblk: 35,
                                dsorg: "PO",
                                lrecl: 40,
                                primary: 1,
                                recfm: "FB",
                            },
                        },
                    ],
                }),
            });
            const templateSpy = vi.spyOn(SettingsConfig, "setMigratedDsTemplates");
            const setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue");
            const promptReloadSpy = vi.spyOn(SettingsConfig as any, "promptReload");
            await (SettingsConfig as any).migrateToLocalStorage();
            expect(templateSpy).toHaveBeenCalledTimes(1);
            expect(setValueSpy).toHaveBeenCalledTimes(8);
            expect(promptReloadSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("function isConfigSettingSetByUser", () => {
        it("should return false if setting is undefined or empty", () => {
            const falseCases = [undefined, {}];
            for (const retVal of falseCases) {
                vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce({
                    inspect: vi.fn().mockReturnValue(retVal),
                } as any);
                expect(SettingsConfig.isConfigSettingSetByUser("zowe.setting")).toBe(false);
            }
        });

        it("should return true if setting is defined in any scope", () => {
            const trueCases = [
                { globalValue: "a" },
                { workspaceValue: "b" },
                { workspaceFolderValue: "c" },
                { globalLanguageValue: "d" },
                { workspaceLanguageValue: "e" },
                { workspaceFolderLanguageValue: "f" },
            ];
            for (const retVal of trueCases) {
                vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce({
                    inspect: vi.fn().mockReturnValue(retVal),
                } as any);
                expect(SettingsConfig.isConfigSettingSetByUser("zowe.setting")).toBe(true);
            }
        });
    });

    describe("function promptReload", () => {
        it("should trigger a reload when prompted", async () => {
            vi.spyOn(Gui, "showMessage").mockResolvedValueOnce("Reload Window");
            const executeCommandSpy = vi.spyOn(vscode.commands, "executeCommand");
            await expect((SettingsConfig as any).promptReload()).resolves.toEqual(undefined);
            expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });
    });

    describe("function standardizeGlobalSettings", () => {
        it("should standardize the global settings", async () => {
            const privateSettingsConfig = SettingsConfig as any;
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                inspect: () => ({
                    globalValue: "test",
                }),
                update: vi.fn(),
            } as any);

            vi.spyOn(privateSettingsConfig, "zoweOldConfigurations", "get").mockReturnValue([
                "Zowe-DS-Persistent",
                "Zowe-USS-Persistent",
                "Zowe-Jobs-Persistent",
            ]);
            await expect(privateSettingsConfig.standardizeGlobalSettings()).resolves.toEqual(undefined);
        });
    });

    describe("function standardizeWorkspaceSettings", () => {
        it("should standardize workspace settings", async () => {
            const privateSettingsConfig = SettingsConfig as any;
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                inspect: () => ({
                    workspaceValue: "test",
                }),
                update: vi.fn(),
            } as any);

            vi.spyOn(privateSettingsConfig, "zoweOldConfigurations", "get").mockReturnValue([
                "Zowe-DS-Persistent",
                "Zowe-USS-Persistent",
                "Zowe-Jobs-Persistent",
                "Zowe-Automatic-Validation",
            ]);
            await expect(privateSettingsConfig.standardizeWorkspaceSettings()).resolves.toEqual(undefined);
        });
    });

    describe("function standardizeSettings", () => {
        beforeEach(() => {
            Object.defineProperty(vscode.workspace, "workspaceFolders", {
                value: [{ uri: { fsPath: "test", scheme: "file" } }],
                configurable: true,
            });
            vi.spyOn(SettingsConfig as any, "zoweOldConfigurations", "get").mockReturnValue(["zowe.settings.test"]);
        });

        it("should standardize workspace settings if not migrated and workspace is open", async () => {
            vi.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({
                    globalValue: "vtest",
                    workspaceValue: "",
                }),
            });
            const standardizeWorkspaceSettingsSpy = vi.spyOn(SettingsConfig as any, "standardizeWorkspaceSettings").mockImplementation((() => undefined) as any);
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(standardizeWorkspaceSettingsSpy).toHaveBeenCalledTimes(1);
        });

        it("should standardize global settings if not migrated", async () => {
            vi.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({
                    globalValue: "test",
                    workspaceValue: "vtest",
                }),
            });
            vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(true);
            vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(false);
            const standardizeGlobalSettingsSpy = vi.spyOn(SettingsConfig as any, "standardizeGlobalSettings").mockImplementation((() => undefined) as any);
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(standardizeGlobalSettingsSpy).toHaveBeenCalledTimes(1);
        });
        it("should migrate to local storage old persistent VS Code settings if not migrated yet", async () => {
            vi.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({ workspaceValue: "test" }),
            });
            vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(false);
            const migrateToLocalStorageSpy = vi.spyOn(SettingsConfig as any, "migrateToLocalStorage");
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(migrateToLocalStorageSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("function migrateSettingsAtLevel", () => {
        function getBlockMocks() {
            const configurationsMock = vi.spyOn(SettingsConfig as any, "configurations", "get");
            const setDirectValueMock = vi.spyOn(SettingsConfig, "setDirectValue").mockImplementation((() => undefined) as any);
            const setValueMock = vi.spyOn(ZoweLocalStorage, "setValue").mockImplementation((() => undefined) as any);
            vi.spyOn(SettingsConfig, "setMigratedDsTemplates").mockImplementation((() => undefined) as any);

            return {
                configurationsMock,
                setDirectValueMock,
                setValueMock,
            };
        }

        it("migrates workspace-level settings from settings config", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.configurationsMock.mockReturnValue({
                inspect: () => ({
                    globalValue: undefined,
                    workspaceValue: 123,
                }),
            });
            await (SettingsConfig as any).migrateSettingsAtLevel(vscode.ConfigurationTarget.Workspace);
            for (const [_, value, setInWorkspace] of blockMocks.setValueMock.mock.calls) {
                expect(value).toBe(123);
                expect(setInWorkspace).toBe(true);
            }
            for (const [_, value, target] of blockMocks.setDirectValueMock.mock.calls) {
                expect(value).toEqual(undefined);
                expect(target).toBe(vscode.ConfigurationTarget.Workspace);
            }
        });

        it("migrates global-level settings from settings config", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.configurationsMock.mockReturnValue({
                inspect: () => ({
                    globalValue: 123,
                    workspaceValue: undefined,
                }),
            });
            await (SettingsConfig as any).migrateSettingsAtLevel(vscode.ConfigurationTarget.Global);

            for (const [_, value, setInWorkspace] of blockMocks.setValueMock.mock.calls) {
                expect(value).toBe(123);
                expect(setInWorkspace).toBe(false);
            }
            for (const [_, value, target] of blockMocks.setDirectValueMock.mock.calls) {
                expect(value).toEqual(undefined);
                expect(target).toBe(vscode.ConfigurationTarget.Global);
            }
        });
    });

    describe("function migrateShowHiddenFilesDefault", () => {
        let getValueSpy: MockInstance;
        let setValueSpy: MockInstance;
        let getConfigurationSpy: MockInstance;
        let getExtensionSpy: MockInstance;
        let errorMessageSpy: MockInstance;

        beforeEach(() => {
            getValueSpy = vi.spyOn(ZoweLocalStorage, "getValue");
            setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue");
            getConfigurationSpy = vi.spyOn(vscode.workspace, "getConfiguration");
            getExtensionSpy = vi.spyOn(vscode.extensions, "getExtension");
            errorMessageSpy = vi.spyOn(Gui, "errorMessage");
        });

        it("should skip migration if already completed", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.JustMigrated);

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(getValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS);
            expect(getConfigurationSpy).not.toHaveBeenCalled();
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("should not set value if user has explicitly set globalValue", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: true,
                    workspaceValue: undefined,
                }),
                update: vi.fn(),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.inspect).toHaveBeenCalledWith("showHiddenFiles");
            expect(mockConfig.update).not.toHaveBeenCalled();
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should not set value if user has explicitly set workspaceValue", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: false,
                }),
                update: vi.fn(),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.inspect).toHaveBeenCalledWith("showHiddenFiles");
            expect(mockConfig.update).not.toHaveBeenCalled();
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should set default to true for V3 extension when user has not set value", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "3.5.2" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(getExtensionSpy).toHaveBeenCalledWith("Zowe.vscode-extension-for-zowe");
            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", true, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should set default to true for V2 extension when user has not set value", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "2.18.0" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", true, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should set default to true for V1 extension when user has not set value", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "1.28.1" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", true, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should set default to false for V4 extension when user has not set value", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "4.0.0" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", false, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should set default to false for V5 extension when user has not set value", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "5.2.1" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", false, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should mark migration complete even if extension is not found", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn(),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue(undefined);

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).not.toHaveBeenCalled();
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should handle errors gracefully and show error message", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const testError = new Error("Test error");
            getConfigurationSpy.mockImplementation(() => {
                throw testError;
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(errorMessageSpy).toHaveBeenCalledWith("Failed to migrate showHiddenFiles setting: Test error");
        });

        it("should handle non-Error exceptions and show error message", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            getConfigurationSpy.mockImplementation(() => {
                throw "String error";
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(errorMessageSpy).toHaveBeenCalledWith("Failed to migrate showHiddenFiles setting: String error");
        });

        it("should handle version with pre-release suffix correctly", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: undefined,
                    workspaceValue: undefined,
                }),
                update: vi.fn().mockResolvedValue(undefined),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);
            getExtensionSpy.mockReturnValue({
                packageJSON: { version: "4.1.0-SNAPSHOT" },
            });

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).toHaveBeenCalledWith("showHiddenFiles", false, vscode.ConfigurationTarget.Global);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });

        it("should handle edge case where both globalValue and workspaceValue are set", async () => {
            getValueSpy.mockReturnValue(Definitions.V3MigrationStatus.None);
            const mockConfig = {
                inspect: vi.fn().mockReturnValue({
                    globalValue: true,
                    workspaceValue: false,
                }),
                update: vi.fn(),
            };
            getConfigurationSpy.mockReturnValue(mockConfig);

            await (SettingsConfig as any).migrateShowHiddenFilesDefault();

            expect(mockConfig.update).not.toHaveBeenCalled();
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.V3_MIGRATION_STATUS, Definitions.V3MigrationStatus.JustMigrated);
        });
    });
});
