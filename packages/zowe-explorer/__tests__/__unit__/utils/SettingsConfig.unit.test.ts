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

import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/ZoweLogger";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import * as globals from "../../../src/globals";

describe("SettingsConfig Unit Tests", () => {
    beforeEach(() => {
        Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLocalStorage, "storage", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });
    describe("function migrateToLocalStorage", () => {
        it("should successfully migrate to local storage old VS Code persistent settings", async () => {
            jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({ globalValue: "test" }),
            });
            const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
            const promptReloadSpy = jest.spyOn(SettingsConfig as any, "promptReload");
            await (SettingsConfig as any).migrateToLocalStorage();
            expect(setValueSpy).toHaveBeenCalledTimes(6);
            expect(promptReloadSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("function isConfigSettingSetByUser", () => {
        it("should return false if setting is undefined or empty", () => {
            const falseCases = [undefined, {}];
            for (const retVal of falseCases) {
                jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce({
                    inspect: jest.fn().mockReturnValue(retVal),
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
                jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce({
                    inspect: jest.fn().mockReturnValue(retVal),
                } as any);
                expect(SettingsConfig.isConfigSettingSetByUser("zowe.setting")).toBe(true);
            }
        });
    });

    describe("function promptReload", () => {
        it("should trigger a reload when prompted", async () => {
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Reload Window");
            const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
            await expect((SettingsConfig as any).promptReload()).resolves.toEqual(undefined);
            expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });
    });

    describe("function standardizeGlobalSettings", () => {
        it("should standardize the global settings", async () => {
            const privateSettingsConfig = SettingsConfig as any;
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                inspect: () => ({
                    globalValue: "test",
                }),
                update: jest.fn(),
            } as any);

            jest.spyOn(privateSettingsConfig, "zoweOldConfigurations", "get").mockReturnValue([
                "Zowe-DS-Persistent",
                "Zowe-USS-Persistent",
                "Zowe-Jobs-Persistent",
                "Zowe-Temp-Folder-Location",
                globals.configurationDictionary.SETTINGS_TEMP_FOLDER_PATH,
            ]);
            await expect(privateSettingsConfig.standardizeGlobalSettings()).resolves.toEqual(undefined);
        });
    });

    describe("function standardizeWorkspaceSettings", () => {
        it("should standardize workspace settings", async () => {
            const privateSettingsConfig = SettingsConfig as any;
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                inspect: () => ({
                    workspaceValue: "test",
                }),
                update: jest.fn(),
            } as any);

            jest.spyOn(privateSettingsConfig, "zoweOldConfigurations", "get").mockReturnValue([
                "Zowe-DS-Persistent",
                "Zowe-USS-Persistent",
                "Zowe-Jobs-Persistent",
                "Zowe-Temp-Folder-Location",
                "Zowe-Automatic-Validation",
            ]);
            await expect(privateSettingsConfig.standardizeWorkspaceSettings()).resolves.toEqual(undefined);
        });
    });

    describe("function standardizeSettings", () => {
        beforeEach(() => {
            Object.defineProperty(vscode.workspace, "workspaceFolders", {
                value: ["test"],
                configurable: true,
            });
            jest.spyOn(SettingsConfig as any, "zoweOldConfigurations", "get").mockReturnValue(["zowe.settings.test"]);
        });

        it("should standardize workspace settings if not migrated and workspace is open", async () => {
            jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({
                    globalValue: "vtest",
                    workspaceValue: "",
                }),
            });
            const standardizeWorkspaceSettingsSpy = jest.spyOn(SettingsConfig as any, "standardizeWorkspaceSettings").mockImplementation();
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(standardizeWorkspaceSettingsSpy).toHaveBeenCalledTimes(1);
        });

        it("should standardize global settings if not migrated", async () => {
            jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({
                    globalValue: "test",
                    workspaceValue: "vtest",
                }),
            });
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(false);
            const standardizeGlobalSettingsSpy = jest.spyOn(SettingsConfig as any, "standardizeGlobalSettings").mockImplementation();
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(standardizeGlobalSettingsSpy).toHaveBeenCalledTimes(1);
        });
        it("should migrate to local storage old persistent VS Code settings if not migrated yet", async () => {
            jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
                inspect: () => ({ workspaceValue: "test" }),
            });
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValueOnce(false);
            const migrateToLocalStorageSpy = jest.spyOn(SettingsConfig as any, "migrateToLocalStorage");
            await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
            expect(migrateToLocalStorageSpy).toHaveBeenCalledTimes(1);
        });
    });
});
