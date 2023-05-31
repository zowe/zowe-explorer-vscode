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

import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { Gui, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as globals from "../../../src/globals";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Profiles } from "../../../src/Profiles";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { ZoweExplorerExtender } from "../../../src/ZoweExplorerExtender";

jest.mock("../../../src/utils/LoggerUtils");
jest.mock("fs");
jest.mock("vscode");
jest.mock("@zowe/cli");

describe("ProfilesUtils unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    function createBlockMocks() {
        const newMocks = {
            mockExistsSync: jest.fn().mockReturnValue(true),
            mockReadFileSync: jest.fn(),
            mockWriteFileSync: jest.fn(),
            mockOpenSync: jest.fn().mockReturnValue(process.stdout.fd),
            mockMkdirSync: jest.fn(),
            mockGetDirectValue: jest.fn(),
            mockFileRead: { overrides: { CredentialManager: "@zowe/cli" } },
            zoweDir: path.normalize("__tests__/.zowe/settings/imperative.json"),
            fileHandle: process.stdout.fd,
        };
        Object.defineProperty(fs, "existsSync", { value: newMocks.mockExistsSync, configurable: true });
        Object.defineProperty(fs, "readFileSync", { value: newMocks.mockReadFileSync, configurable: true });
        Object.defineProperty(fs, "writeFileSync", { value: newMocks.mockWriteFileSync, configurable: true });
        Object.defineProperty(fs, "openSync", { value: newMocks.mockOpenSync, configurable: true });
        Object.defineProperty(fs, "mkdirSync", { value: newMocks.mockMkdirSync, configurable: true });
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(SettingsConfig, "getDirectValue", { value: newMocks.mockGetDirectValue, configurable: true });
        Object.defineProperty(globals, "PROFILE_SECURITY", { value: globals.ZOWE_CLI_SCM, configurable: true });
        return newMocks;
    }

    describe("errorHandling", () => {
        it("should log error details", async () => {
            createBlockMocks();
            const errorDetails = new Error("i haz error");
            const label = "test";
            const moreInfo = "Task failed successfully";
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(Gui.errorMessage).toBeCalledWith(`${moreInfo} ` + errorDetails);
            expect(ZoweLogger.error).toBeCalledWith(`Error: ${errorDetails.message}\n` + util.inspect({ errorDetails, label, moreInfo }));
        });

        it("should log error details for object with circular reference", async () => {
            createBlockMocks();
            const errorJson: Record<string, any> = { details: "i haz error" };
            errorJson.details2 = errorJson;
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Circular reference",
                causeErrors: errorJson,
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            await profUtils.errorHandling(errorDetails, label, moreInfo as unknown as string);
            expect(Gui.errorMessage).toBeCalledWith(`${moreInfo} ` + errorDetails);
            expect(ZoweLogger.error).toBeCalledWith(
                `Error: ${errorDetails.message}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null })
            );
        });

        it("should handle error and open config file", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid hostname",
                errorCode: 404 as unknown as string,
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            const spyOpenConfigFile = jest.fn();
            Object.defineProperty(Profiles, "getInstance", {
                value: () => ({
                    getProfileInfo: () => ({
                        usingTeamConfig: true,
                        getAllProfiles: () => [
                            {
                                profName: "test",
                                profLoc: {
                                    osLoc: ["test"],
                                },
                            },
                        ],
                    }),
                    openConfigFile: spyOpenConfigFile,
                }),
            });
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(spyOpenConfigFile).toBeCalledTimes(1);
        });

        it("should handle error and prompt for authentication", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Token is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            jest.spyOn(profUtils, "isTheia").mockReturnValue(false);
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockResolvedValue("selection");
            const ssoLoginSpy = jest.fn();
            Object.defineProperty(Profiles, "getInstance", {
                value: () => ({
                    ssoLogin: ssoLoginSpy,
                }),
            });
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showMessageSpy).toBeCalledTimes(1);
            expect(ssoLoginSpy).toBeCalledTimes(1);
        });
    });

    describe("readConfigFromDisk", () => {
        it("should readConfigFromDisk and log 'Not Available'", async () => {
            Object.defineProperty(vscode.workspace, "workspaceFolders", {
                value: [
                    {
                        uri: {
                            fsPath: "./test",
                        },
                    },
                ],
                configurable: true,
            });
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(profUtils.ProfilesUtils, "getProfileInfo").mockReturnValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                usingTeamConfig: true,
                getTeamConfig: () => ({
                    layers: [
                        {
                            path: "test",
                            exists: true,
                            properties: {
                                defaults: "test",
                            },
                        },
                        {
                            path: "test",
                            exists: true,
                            properties: {},
                        },
                    ],
                }),
            } as never);
            await expect(profUtils.ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });

        it("should readConfigFromDisk and find with defaults", async () => {
            Object.defineProperty(vscode.workspace, "workspaceFolders", {
                value: [
                    {
                        uri: {
                            fsPath: "./test",
                        },
                    },
                ],
                configurable: true,
            });
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(profUtils.ProfilesUtils, "getProfileInfo").mockReturnValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                usingTeamConfig: true,
                getTeamConfig: () => [],
            } as never);
            await expect(profUtils.ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });

        it("should keep Imperative error details if readConfigFromDisk fails", async () => {
            Object.defineProperty(vscode.workspace, "workspaceFolders", {
                value: [
                    {
                        uri: {
                            fsPath: "./test",
                        },
                    },
                ],
                configurable: true,
            });
            const impErr = new zowe.imperative.ImperativeError({ msg: "Unexpected Imperative error" });
            const mockReadProfilesFromDisk = jest.fn().mockRejectedValue(impErr);
            const profInfoSpy = jest.spyOn(profUtils.ProfilesUtils, "getProfileInfo").mockReturnValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                usingTeamConfig: true,
                getTeamConfig: () => [],
            } as never);
            await expect(profUtils.ProfilesUtils.readConfigFromDisk()).rejects.toBe(impErr);
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });
    });

    describe("promptCredentials", () => {
        it("calls getProfileInfo", async () => {
            const mockProfileInstance = new Profiles(zowe.imperative.Logger.getAppLogger());
            const getProfileInfoSpy = jest.spyOn(Profiles.prototype, "getProfileInfo");
            const prof = {
                getAllProfiles: jest.fn().mockReturnValue([]),
                isSecured: jest.fn().mockReturnValue(true),
                readProfilesFromDisk: jest.fn(),
            };
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as zowe.imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as zowe.imperative.IProfileLoaded);
            jest.spyOn(Profiles, "getInstance").mockReturnValue(mockProfileInstance);
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue("emptyConfig"),
                configurable: true,
            });
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue([]);
            await profUtils.ProfilesUtils.promptCredentials(null);
            expect(getProfileInfoSpy).toHaveBeenCalled();
        });

        it("shows an error message if the profile input is undefined", async () => {
            const mockProfileInstance = new Profiles(zowe.imperative.Logger.getAppLogger());
            const prof = {
                getAllProfiles: jest.fn().mockReturnValue([]),
                isSecured: jest.fn().mockReturnValue(true),
                readProfilesFromDisk: jest.fn(),
            };
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as zowe.imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as zowe.imperative.IProfileLoaded);
            jest.spyOn(Profiles, "getInstance").mockReturnValue(mockProfileInstance);
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue(""),
                configurable: true,
            });
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue([]);
            await profUtils.ProfilesUtils.promptCredentials(null);
            expect(Gui.showMessage).toHaveBeenCalledWith("Operation Cancelled");
        });

        it("shows an info message if the profile credentials were updated", async () => {
            const mockProfileInstance = new Profiles(zowe.imperative.Logger.getAppLogger());
            const prof = {
                getAllProfiles: jest.fn().mockReturnValue([]),
                isSecured: jest.fn().mockReturnValue(true),
                readProfilesFromDisk: jest.fn(),
            };
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as zowe.imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as zowe.imperative.IProfileLoaded);
            jest.spyOn(Profiles, "getInstance").mockReturnValue(mockProfileInstance);
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue("testConfig"),
                configurable: true,
            });
            Object.defineProperty(Gui, "showMessage", {
                value: jest.fn(),
                configurable: true,
            });
            jest.spyOn(Profiles.prototype, "promptCredentials").mockResolvedValue(["some_user", "some_pass", "c29tZV9iYXNlNjRfc3RyaW5n"]);
            await profUtils.ProfilesUtils.promptCredentials(null);
            expect(Gui.showMessage).toHaveBeenCalledWith("Credentials for testConfig were successfully updated");
        });

        it("shows a message if Update Credentials operation is called when autoStore = false", async () => {
            const mockProfileInstance = new Profiles(zowe.imperative.Logger.getAppLogger());
            Object.defineProperty(Profiles, "getInstance", {
                value: () => mockProfileInstance,
                configurable: true,
            });
            Object.defineProperty(mockProfileInstance, "getProfileInfo", {
                value: jest.fn(() => {
                    return {
                        profileName: "emptyConfig",
                        usingTeamConfig: true,
                        getTeamConfig: jest.fn().mockReturnValueOnce({
                            properties: {
                                autoStore: false,
                            },
                        }),
                    };
                }),
                configurable: true,
            });
            Object.defineProperty(Gui, "showMessage", {
                value: jest.fn(),
                configurable: true,
            });
            await profUtils.ProfilesUtils.promptCredentials(null);
            expect(mockProfileInstance.getProfileInfo).toHaveBeenCalled();
            expect(Gui.showMessage).toHaveBeenCalledWith('"Update Credentials" operation not supported when "autoStore" is false');
        });
    });

    describe("initializeZoweFolder", () => {
        it("should create directories and files that do not exist", async () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockGetDirectValue.mockReturnValue(true);
            blockMocks.mockExistsSync.mockReturnValue(false);
            await profUtils.ProfilesUtils.initializeZoweFolder();
            expect(globals.PROFILE_SECURITY).toBe(globals.ZOWE_CLI_SCM);
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(2);
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(1);
        });

        it("should skip creating directories and files that already exist", async () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockGetDirectValue.mockReturnValue(false);
            blockMocks.mockExistsSync.mockReturnValue(true);
            await profUtils.ProfilesUtils.initializeZoweFolder();
            expect(globals.PROFILE_SECURITY).toBe(false);
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(0);
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(0);
        });
    });

    describe("writeOverridesFile", () => {
        it("should have file exist", async () => {
            const blockMocks = createBlockMocks();
            const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
            const content = JSON.stringify(fileJson, null, 2);
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify({ overrides: { CredentialManager: false, testValue: true } }, null, 2));
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockOpenSync).toBeCalledWith(blockMocks.zoweDir, "r+");
            expect(blockMocks.mockWriteFileSync).toBeCalledWith(blockMocks.fileHandle, content, "utf-8");
        });

        it("should have no change to global variable PROFILE_SECURITY and returns", async () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toBeCalledTimes(0);
        });

        it("should have not exist and create default file", async () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockOpenSync.mockImplementation((filepath: string, mode: string) => {
                if (mode.startsWith("r")) {
                    throw new Error("ENOENT");
                }
                return blockMocks.fileHandle;
            });
            const content = JSON.stringify(blockMocks.mockFileRead, null, 2);
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toBeCalledWith(blockMocks.fileHandle, content, "utf-8");
            expect(blockMocks.mockOpenSync).toBeCalledTimes(2);
            expect(blockMocks.mockReadFileSync).toBeCalledTimes(0);
        });

        it("should throw error if overrides file contains invalid JSON", async () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2).slice(1));
            expect(profUtils.ProfilesUtils.writeOverridesFile).toThrow();
        });
    });

    describe("initializeZoweProfiles", () => {
        it("should successfully initialize Zowe folder and read config from disk", async () => {
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder");
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(ZoweLogger.error).not.toHaveBeenCalled();
        });

        it("should handle error thrown on initialize Zowe folder", async () => {
            const testError = new Error("initializeZoweFolder failed");
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockRejectedValueOnce(testError);
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining(testError.message));
        });

        it("should handle Imperative error thrown on read config from disk", async () => {
            const testError = new zowe.imperative.ImperativeError({ msg: "readConfigFromDisk failed" });
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            await profUtils.ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining(testError.message));
        });

        it("should handle JSON parse error thrown on read config from disk", async () => {
            const testError = new Error("readConfigFromDisk failed");
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            const showZoweConfigErrorSpy = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockReturnValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(showZoweConfigErrorSpy).toHaveBeenCalledWith(testError.message);
        });
    });

    it("filterItem should get label if the filterItem icon exists", () => {
        const testFilterItem = new profUtils.FilterItem({
            icon: "test",
        } as any);
        expect(testFilterItem.label).toEqual("test undefined");
    });
});
