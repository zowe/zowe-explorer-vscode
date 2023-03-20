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
        jest.spyOn(SettingsConfig as any, "currentVersionNumber", "get").mockReturnValue("vtest");
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
                globalValue: "",
                workspaceValue: "vtest",
            }),
        });
        const standardizeGlobalSettingsSpy = jest.spyOn(SettingsConfig as any, "standardizeGlobalSettings").mockImplementation();
        await expect(SettingsConfig.standardizeSettings()).resolves.not.toThrow();
        expect(standardizeGlobalSettingsSpy).toHaveBeenCalledTimes(1);
    });
});
