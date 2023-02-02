import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";

describe("Profiles Unit Tests - function promptReload", () => {
    it("should trigger a reload when prompted", async () => {
        const privateSettingsConfig = SettingsConfig as any;
        jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Reload Window");
        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        await expect(privateSettingsConfig.promptReload()).resolves.toEqual(undefined);
        expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
    });
});

describe("Profiles Unit Tests - function standardizeGlobalSettings", () => {
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

describe("Profiles Unit Tests - function standardizeWorkspaceSettings", () => {
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
