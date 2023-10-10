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
import { Gui, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as util from "util";
import * as globals from "../../../src/globals";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Profiles } from "../../../src/Profiles";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { ZoweExplorerExtender } from "../../../src/ZoweExplorerExtender";
import { createValidIProfile } from "../../../__mocks__/mockCreators/shared";

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
        };
        Object.defineProperty(fs, "existsSync", { value: newMocks.mockExistsSync, configurable: true });
        Object.defineProperty(fs, "readFileSync", { value: newMocks.mockReadFileSync, configurable: true });
        Object.defineProperty(fs, "writeFileSync", { value: newMocks.mockWriteFileSync, configurable: true });
        Object.defineProperty(fs, "openSync", { value: newMocks.mockOpenSync, configurable: true });
        Object.defineProperty(fs, "mkdirSync", { value: newMocks.mockMkdirSync, configurable: true });
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(SettingsConfig, "getDirectValue", { value: newMocks.mockGetDirectValue, configurable: true });
        Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals, "PROFILE_SECURITY", { value: globals.ZOWE_CLI_SCM, configurable: true });
        Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
        return newMocks;
    }

    describe("errorHandling", () => {
        const profileInfoMock = () => ({
            getTeamConfig: () => ({
                properties: {
                    profiles: {
                        sestest: createValidIProfile().profile,
                        base: {
                            type: "base",
                            host: "test",
                            port: 1443,
                            rejectUnauthorized: false,
                            name: "base",
                            tokenType: "",
                            secure: [],
                        },
                    },
                },
            }),
        });

        it("should log error details", async () => {
            createBlockMocks();
            const errorDetails = new Error("i haz error");
            const label = "test";
            const moreInfo = "Task failed successfully";
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(Gui.errorMessage).toBeCalledWith(moreInfo + ` Error: ${errorDetails.message}`);
            expect(ZoweLogger.error).toBeCalledWith(
                `${errorDetails.toString()}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null })
            );
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

        it("should handle error for invalid credentials and prompt for authentication", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Authentication is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            jest.spyOn(profUtils, "isTheia").mockReturnValue(false);
            const showMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation(() => Promise.resolve("Update Credentials"));
            const promptCredsSpy = jest.fn();
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                promptCredentials: promptCredsSpy,
                getProfileInfo: profileInfoMock,
                getLoadedProfConfig: () => ({ type: "zosmf" }),
                getDefaultProfile: () => ({}),
                getSecurePropsForProfile: () => [],
            } as any);
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showMessageSpy).toBeCalledTimes(1);
            expect(promptCredsSpy).toBeCalledTimes(1);
            showMessageSpy.mockClear();
            promptCredsSpy.mockClear();
        });
        it("should handle token error and procede to login", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Token is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            jest.spyOn(profUtils, "isTheia").mockReturnValue(false);
            const showErrorSpy = jest.spyOn(Gui, "errorMessage");
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation(() => Promise.resolve("selection"));
            const ssoLoginSpy = jest.fn();
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                getProfileInfo: profileInfoMock,
                getLoadedProfConfig: () => ({ type: "zosmf" }),
                getDefaultProfile: () => ({}),
                getSecurePropsForProfile: () => ["tokenValue"],
                ssoLogin: ssoLoginSpy,
            } as any);
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showMessageSpy).toBeCalledTimes(1);
            expect(ssoLoginSpy).toBeCalledTimes(1);
            expect(showErrorSpy).not.toBeCalled();
            showErrorSpy.mockClear();
            showMessageSpy.mockClear();
            ssoLoginSpy.mockClear();
        });
        it("should handle token error and procede to login - Theia", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: String(401),
                additionalDetails: "Token is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            Object.defineProperty(vscode, "env", {
                value: {
                    appName: "Theia",
                },
                configurable: true,
            });
            const showErrorSpy = jest.spyOn(Gui, "errorMessage").mockImplementation(() => Promise.resolve(undefined));
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            const ssoLoginSpy = jest.fn();
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                getProfileInfo: profileInfoMock,
                getLoadedProfConfig: () => ({ type: "zosmf" }),
                getDefaultProfile: () => ({}),
                getSecurePropsForProfile: () => ["tokenValue"],
                ssoLogin: ssoLoginSpy,
            } as any);
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showErrorSpy).toBeCalledTimes(1);
            expect(ssoLoginSpy).toBeCalledTimes(1);
            expect(showMessageSpy).not.toBeCalled();
            showErrorSpy.mockClear();
            showMessageSpy.mockClear();
            ssoLoginSpy.mockClear();
        });
        it("should handle credential error and no selection made for update", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: String(401),
                additionalDetails: "Authentication failed.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            Object.defineProperty(vscode, "env", {
                value: {
                    appName: "Visual Studio Code",
                },
                configurable: true,
            });
            const showErrorSpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);
            const showMsgSpy = jest.spyOn(Gui, "showMessage");
            const promptCredentialsSpy = jest.fn();
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                promptCredentials: promptCredentialsSpy,
                getProfileInfo: profileInfoMock,
                getLoadedProfConfig: () => ({ type: "zosmf" }),
                getDefaultProfile: () => ({}),
                getSecurePropsForProfile: () => [],
            } as any);
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showErrorSpy).toBeCalledTimes(1);
            expect(promptCredentialsSpy).not.toBeCalled();
            expect(showMsgSpy).toBeCalledWith("Operation Cancelled");
            showErrorSpy.mockClear();
            showMsgSpy.mockClear();
            promptCredentialsSpy.mockClear();
        });
        it("should handle credential error with error message - Theia", async () => {
            const errorDetails = new zowe.imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Authentication failed.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            jest.spyOn(profUtils, "isTheia").mockReturnValue(true);
            const showErrorSpy = jest.spyOn(Gui, "errorMessage");
            const promptCredentialsSpy = jest.fn();
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                promptCredentials: promptCredentialsSpy,
                getProfileInfo: profileInfoMock,
                getLoadedProfConfig: () => ({ type: "zosmf" }),
                getDefaultProfile: () => ({}),
                getSecurePropsForProfile: () => [],
            } as any);
            await profUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showErrorSpy).toBeCalledTimes(1);
            expect(promptCredentialsSpy).not.toBeCalled();
            showErrorSpy.mockClear();
            promptCredentialsSpy.mockClear();
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
            Object.defineProperty(globals.LOG, "debug", {
                value: jest.fn(),
                configurable: true,
            });
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
            Object.defineProperty(globals.LOG, "debug", {
                value: jest.fn(),
                configurable: true,
            });
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
            const createFileSpy = jest.spyOn(profUtils.ProfilesUtils, "writeOverridesFile");
            await profUtils.ProfilesUtils.initializeZoweFolder();
            expect(globals.PROFILE_SECURITY).toBe(globals.ZOWE_CLI_SCM);
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(2);
            expect(createFileSpy).toHaveBeenCalledTimes(1);
        });

        it("should skip creating directories and files that already exist", async () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockGetDirectValue.mockReturnValue("@zowe/cli");
            blockMocks.mockExistsSync.mockReturnValue(true);
            const fileJson = blockMocks.mockFileRead;
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            await profUtils.ProfilesUtils.initializeZoweFolder();
            expect(globals.PROFILE_SECURITY).toBe("@zowe/cli");
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(0);
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(0);
        });
    });

    describe("writeOverridesFile", () => {
        it("should have file exist", () => {
            const blockMocks = createBlockMocks();
            const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
            const content = JSON.stringify(fileJson, null, 2);
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify({ overrides: { CredentialManager: false, testValue: true } }, null, 2));
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toBeCalledWith(blockMocks.zoweDir, content, { encoding: "utf-8", flag: "w" });
        });

        it("should return and have no change to the existing file if PROFILE_SECURITY matches file", () => {
            const blockMocks = createBlockMocks();
            const fileJson = blockMocks.mockFileRead;
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toBeCalledTimes(0);
        });

        it("should add credential manager overrides object to existing object", () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            const mergedJson = { ...blockMocks.mockFileRead, ...fileJson };
            const mergedString = JSON.stringify(mergedJson, null, 2);
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toBeCalledTimes(1);
            expect(blockMocks.mockWriteFileSync).toBeCalledWith(blockMocks.zoweDir, mergedString, { encoding: "utf-8", flag: "w" });
        });

        it("should have not exist and create default file", () => {
            const blockMocks = createBlockMocks();
            Object.defineProperty(fs, "readFileSync", {
                value: jest.fn().mockImplementationOnce(() => {
                    throw new Error("ENOENT");
                }),
                configurable: true,
            });
            const loggerSpy = jest.spyOn(ZoweLogger, "debug");
            const content = JSON.stringify(blockMocks.mockFileRead, null, 2);
            profUtils.ProfilesUtils.writeOverridesFile();
            expect(loggerSpy).toBeCalledWith("Reading imperative.json failed. Will try to create file.");
            expect(blockMocks.mockWriteFileSync).toBeCalledWith(blockMocks.zoweDir, content, { encoding: "utf-8", flag: "w" });
            expect(blockMocks.mockWriteFileSync).not.toThrowError();
        });

        it("should re-create file if overrides file contains invalid JSON", () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2).slice(1));
            const writeFileSpy = jest.spyOn(fs, "writeFileSync");
            expect(profUtils.ProfilesUtils.writeOverridesFile).not.toThrow();
            expect(writeFileSpy).toBeCalled();
        });
    });

    describe("initializeZoweProfiles", () => {
        it("should successfully initialize Zowe folder and read config from disk", async () => {
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder");
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles();
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(ZoweLogger.error).not.toHaveBeenCalled();
        });

        it("should handle error thrown on initialize Zowe folder", async () => {
            const testError = new Error("initializeZoweFolder failed");
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockRejectedValueOnce(testError);
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles();
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining(testError.message));
        });

        it("should handle Imperative error thrown on read config from disk", async () => {
            const testError = new zowe.imperative.ImperativeError({ msg: "readConfigFromDisk failed" });
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            await profUtils.ProfilesUtils.initializeZoweProfiles();
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining(testError.message));
        });

        it("should handle JSON parse error thrown on read config from disk", async () => {
            const testError = new Error("readConfigFromDisk failed");
            const initZoweFolderSpy = jest.spyOn(profUtils.ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            const showZoweConfigErrorSpy = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockReturnValueOnce();
            await profUtils.ProfilesUtils.initializeZoweProfiles();
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

    describe("getCredentialManagerOverride", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should successfully retrieve the credential manager override map", () => {
            const expectedValue = {
                credMgrZEName: "test",
                credMgrPluginName: "test",
            } as zowe.imperative.ICredentialManagerNameMap;
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            jest.spyOn(zowe.imperative.CredentialManagerOverride, "getKnownCredMgrs").mockReturnValueOnce([expectedValue]);
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce({ test: "test" } as any);
            jest.spyOn(zowe.imperative.CredentialManagerOverride, "getCredMgrInfoByDisplayName").mockReturnValueOnce(expectedValue);
            expect(profUtils.ProfilesUtils.getCredentialManagerOverride()).toEqual(expectedValue);
            expect(zoweLoggerTraceSpy).toBeCalledTimes(1);
        });
        it("should return undefined if no credential manager is found", () => {
            const expectedValue = {
                credMgrZEName: "test",
                credMgrPluginName: "test",
            } as zowe.imperative.ICredentialManagerNameMap;
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            jest.spyOn(zowe.imperative.CredentialManagerOverride, "getKnownCredMgrs").mockReturnValueOnce([expectedValue]);
            jest.spyOn(vscode.extensions, "getExtension").mockImplementationOnce(() => {
                throw new Error("failed to get extension");
            });
            jest.spyOn(zowe.imperative.CredentialManagerOverride, "getCredMgrInfoByDisplayName").mockReturnValueOnce(expectedValue);
            expect(profUtils.ProfilesUtils.getCredentialManagerOverride()).toEqual(undefined);
            expect(zoweLoggerTraceSpy).toBeCalledTimes(1);
        });
    });

    describe("activateCredentialManagerOverride", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should successfully activate the extension passed in for a credential manager override", async () => {
            const activateSpy = jest.fn(() => ({}));
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: {} as zowe.imperative.ICredentialManagerConstructor,
                activate: activateSpy,
                isActive: true,
            } as any;

            await expect(profUtils.ProfilesUtils.activateCredentialManagerOverride(credentialManagerExtension)).resolves.toEqual(
                {} as zowe.imperative.ICredentialManagerConstructor
            );
            expect(activateSpy).toBeCalledTimes(1);
        });

        it("should successfully activate the extension passed in but return undefined if no exports are found", async () => {
            const activateSpy = jest.fn(() => undefined);
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: undefined,
                activate: activateSpy,
                isActive: true,
            } as any;

            await expect(profUtils.ProfilesUtils.activateCredentialManagerOverride(credentialManagerExtension)).resolves.toEqual(undefined);
            expect(activateSpy).toBeCalledTimes(1);
        });

        it("should throw an error if the extension fails to activate", async () => {
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: undefined,
                activate: () => {
                    throw new Error("failed to activate extension");
                },
                isActive: true,
            } as any;

            await expect(profUtils.ProfilesUtils.activateCredentialManagerOverride(credentialManagerExtension)).rejects.toThrow(
                "Custom credential manager failed to activate"
            );
        });
    });

    describe("updateCredentialManagerSetting", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should update the credential manager setting if secure value is true", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const setGlobalSecurityValueSpy = jest.spyOn(globals, "setGlobalSecurityValue");
            const recordCredMgrInConfigSpy = jest.spyOn(zowe.imperative.CredentialManagerOverride, "recordCredMgrInConfig");
            await profUtils.ProfilesUtils.updateCredentialManagerSetting("@zowe/cli");
            expect(setGlobalSecurityValueSpy).toBeCalledWith("@zowe/cli");
            expect(recordCredMgrInConfigSpy).toBeCalledWith("@zowe/cli");
        });
    });

    describe("getProfilesInfo", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should retrieve the custom credential manager", async () => {
            jest.spyOn(profUtils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce({
                credMgrDisplayName: "test1",
                credMgrPluginName: "test2",
                credMgrZEName: "test3",
            });
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce({} as any);
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const activateCredenitalManagerOverrideSpy = jest
                .spyOn(profUtils.ProfilesUtils, "activateCredentialManagerOverride")
                .mockResolvedValueOnce({
                    prototype: {},
                } as zowe.imperative.ICredentialManagerConstructor);
            const updateCredentialManagerSettingSpy = jest.spyOn(profUtils.ProfilesUtils, "updateCredentialManagerSetting").mockImplementation();
            jest.spyOn(zowe.imperative, "ProfileInfo").mockReturnValueOnce({} as any);
            await expect(profUtils.ProfilesUtils.getProfileInfo(false)).resolves.toEqual({});
            expect(activateCredenitalManagerOverrideSpy).toBeCalledWith({});
            expect(updateCredentialManagerSettingSpy).toBeCalledWith("test1");
        });

        it("should retrieve the default credential manager if no custom credential manager is found", async () => {
            jest.spyOn(profUtils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce(undefined);
            const defaultCredMgrSpy = jest.spyOn(zowe.imperative.ProfileCredentials, "defaultCredMgrWithKeytar");
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(undefined);
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const updateCredentialManagerSettingSpy = jest.spyOn(profUtils.ProfilesUtils, "updateCredentialManagerSetting").mockImplementation();
            await expect(profUtils.ProfilesUtils.getProfileInfo(true)).resolves.toEqual({});
            expect(updateCredentialManagerSettingSpy).toBeCalledWith(globals.ZOWE_CLI_SCM);
            expect(defaultCredMgrSpy).toHaveBeenCalledWith(ProfilesCache.requireKeyring);
        });
    });

    describe("isUsingTokenAuth", () => {
        it("should check the profile in use if using token based auth instead of the base profile", async () => {
            jest.spyOn(Profiles.getInstance(), "getDefaultProfile").mockReturnValueOnce({} as any);
            jest.spyOn(Profiles.getInstance(), "getLoadedProfConfig").mockResolvedValue({ type: "test" } as any);
            jest.spyOn(Profiles.getInstance(), "getSecurePropsForProfile").mockResolvedValue([]);
            await expect(profUtils.ProfilesUtils.isUsingTokenAuth("test")).resolves.toEqual(false);
        });
    });
});
