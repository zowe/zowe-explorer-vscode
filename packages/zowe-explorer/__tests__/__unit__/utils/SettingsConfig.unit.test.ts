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
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

beforeEach(() => {
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
});

afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
});

describe("SettingsConfig Unit Tests - function isConfigSettingSetByUser", () => {
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

describe("SettingsConfig Unit Tests - function promptReload", () => {
    it("should trigger a reload when prompted", async () => {
        const privateSettingsConfig = SettingsConfig as any;
        jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Reload Window");
        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        await expect(privateSettingsConfig.promptReload()).resolves.toEqual(undefined);
        expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
    });
});

describe("SettingsConfig Unit Tests - function standardizeGlobalSettings", () => {
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
        ]);
        await expect(privateSettingsConfig.standardizeGlobalSettings()).resolves.toEqual(undefined);
    });
});

describe("SettingsConfig Unit Tests - function standardizeWorkspaceSettings", () => {
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

describe("SettingsConfig Unit Tests - function standardizeSettings", () => {
    beforeEach(() => {
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: ["test"],
            configurable: true,
        });
        jest.spyOn(SettingsConfig as any, "currentVersionNumber", "get").mockReturnValueOnce("v2");
        jest.spyOn(SettingsConfig as any, "zoweOldConfigurations", "get").mockReturnValue(["zowe.settings.test"]);
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            update: jest.fn(),
        } as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should standardize workspace settings if not migrated and workspace is open", async () => {
        jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
            inspect: () => ({
                globalValue: "v2",
                workspaceValue: "v1",
            }),
        });
        const setDirectValueSpy = jest.spyOn(SettingsConfig as any, "setDirectValue").mockImplementation();
        const standardizeWorkspaceSettingsSpy = jest.spyOn(SettingsConfig as any, "standardizeWorkspaceSettings").mockImplementation();
        await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
        expect(setDirectValueSpy).toHaveBeenCalledTimes(1);
        expect(standardizeWorkspaceSettingsSpy).toHaveBeenCalledTimes(1);
    });

    it("should standardize global settings if not migrated", async () => {
        jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
            inspect: () => ({
                globalValue: "v1",
                workspaceValue: "v2",
            }),
        });
        const setDirectValueSpy = jest.spyOn(SettingsConfig as any, "setDirectValue").mockImplementation();
        const standardizeGlobalSettingsSpy = jest.spyOn(SettingsConfig as any, "standardizeGlobalSettings").mockImplementation();
        await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
        expect(setDirectValueSpy).toHaveBeenCalledTimes(1);
        expect(standardizeGlobalSettingsSpy).toHaveBeenCalledTimes(1);
    });

    it("should not update settings if global is migrated and workspace is undefined", async () => {
        jest.spyOn(SettingsConfig as any, "configurations", "get").mockReturnValue({
            inspect: () => ({
                globalValue: "v2",
                workspaceValue: undefined,
            }),
        });
        const setDirectValueSpy = jest.spyOn(SettingsConfig as any, "setDirectValue").mockImplementation();
        await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
        expect(setDirectValueSpy).toHaveBeenCalledTimes(0);
    });
});

describe("SettingsConfig Unit Tests - function currentVersionNumber", () => {
    beforeAll(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it("should remove the minor and patch version from the version number", () => {
        jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce({
            packageJSON: {
                version: "3.2.1",
            },
        } as any);

        expect((SettingsConfig as any).currentVersionNumber).toBe(3);
    });

    it("should parse the version as-is if it doesn't respect semver", () => {
        jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce({
            packageJSON: {
                version: "2",
            },
        } as any);

        expect((SettingsConfig as any).currentVersionNumber).toBe(2);
    });
});
