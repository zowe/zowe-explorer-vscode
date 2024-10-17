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
import * as vscode from "vscode";
import { FileManagement, Gui, imperative, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { createAltTypeIProfile, createInstanceOfProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { MockedProperty } from "../../__mocks__/mockUtils";
import { Constants } from "../../../src/configuration/Constants";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Profiles } from "../../../src/configuration/Profiles";
import { ZoweExplorerExtender } from "../../../src/extending/ZoweExplorerExtender";
import { FilterItem } from "../../../src/management/FilterManagement";
import { ProfilesConvertStatus, ProfilesUtils } from "../../../src/utils/ProfilesUtils";
import { AuthUtils } from "../../../src/utils/AuthUtils";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { Definitions } from "../../../src/configuration/Definitions";

jest.mock("../../../src/tools/ZoweLogger");
jest.mock("fs");
jest.mock("vscode");
jest.mock("@zowe/imperative");

describe("ProfilesUtils unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    function createBlockMocks(): { [key: string]: any } {
        const newMocks = {
            mockExistsSync: jest.fn().mockReturnValue(true),
            mockReadFileSync: jest.fn(),
            mockWriteFileSync: jest.fn(),
            mockOpenSync: jest.fn().mockReturnValue(process.stdout.fd),
            mockMkdirSync: jest.fn(),
            mockGetDirectValue: jest.fn(),
            mockFileRead: { overrides: { CredentialManager: "@zowe/cli" } },
            zoweDir: path.normalize("__tests__/.zowe/settings/imperative.json"),
            profInstance: createInstanceOfProfile(createValidIProfile()),
        };
        Object.defineProperty(Constants, "PROFILES_CACHE", {
            value: newMocks.profInstance,
            configurable: true,
        });

        Object.defineProperty(fs, "existsSync", { value: newMocks.mockExistsSync, configurable: true });
        Object.defineProperty(fs, "readFileSync", { value: newMocks.mockReadFileSync, configurable: true });
        jest.spyOn(fs, "writeFileSync").mockImplementation(newMocks.mockWriteFileSync);
        Object.defineProperty(fs, "openSync", { value: newMocks.mockOpenSync, configurable: true });
        Object.defineProperty(fs, "mkdirSync", { value: newMocks.mockMkdirSync, configurable: true });
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "infoMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
        Object.defineProperty(SettingsConfig, "getDirectValue", { value: newMocks.mockGetDirectValue, configurable: true });
        Object.defineProperty(ProfilesUtils, "PROFILE_SECURITY", { value: Constants.ZOWE_CLI_SCM, configurable: true });
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
            await AuthUtils.errorHandling(errorDetails, label, moreInfo);
            expect(Gui.errorMessage).toHaveBeenCalledWith(moreInfo + ` Error: ${errorDetails.message}`);
            expect(ZoweLogger.error).toHaveBeenCalledWith(
                `${errorDetails.toString()}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null })
            );
        });

        it("should log error details for object with circular reference", async () => {
            createBlockMocks();
            const errorJson: Record<string, any> = { details: "i haz error" };
            errorJson.details2 = errorJson;
            const errorDetails = new imperative.ImperativeError({
                msg: "Circular reference",
                causeErrors: errorJson,
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            await AuthUtils.errorHandling(errorDetails, label, moreInfo as unknown as string);
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            expect(Gui.errorMessage).toHaveBeenCalledWith((`${moreInfo} ` + errorDetails) as any);
            expect(ZoweLogger.error).toHaveBeenCalledWith(
                `Error: ${errorDetails.message}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null })
            );
        });

        it("should handle error and open config file", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid hostname",
                errorCode: 404 as unknown as string,
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            const spyOpenConfigFile = jest.fn();
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    getProfileInfo: () => ({
                        getTeamConfig: () => ({ exists: true }),
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
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, label, moreInfo);
            expect(spyOpenConfigFile).toHaveBeenCalledTimes(1);
        });

        it("should handle error for invalid credentials and prompt for authentication", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Authentication is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            const showMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation(() => Promise.resolve("Update Credentials"));
            const promptCredsSpy = jest.fn();
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    promptCredentials: promptCredsSpy,
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => ({ type: "zosmf" }),
                    getDefaultProfile: () => ({}),
                    getSecurePropsForProfile: () => [],
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
            expect(promptCredsSpy).toHaveBeenCalledTimes(1);
            showMessageSpy.mockClear();
            promptCredsSpy.mockClear();
        });
        it("should handle token error and proceed to login", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: 401 as unknown as string,
                additionalDetails: "Token is not valid or expired.",
            });
            const label = "test";
            const moreInfo = "Task failed successfully";
            const showErrorSpy = jest.spyOn(Gui, "errorMessage");
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation(() => Promise.resolve("selection"));
            const ssoLoginSpy = jest.fn();
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => ({ type: "zosmf" }),
                    getDefaultProfile: () => ({}),
                    getSecurePropsForProfile: () => ["tokenValue"],
                    ssoLogin: ssoLoginSpy,
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
            expect(ssoLoginSpy).toHaveBeenCalledTimes(1);
            expect(showErrorSpy).not.toHaveBeenCalled();
            showErrorSpy.mockClear();
            showMessageSpy.mockClear();
            ssoLoginSpy.mockClear();
        });
        it("should handle credential error and no selection made for update", async () => {
            const errorDetails = new imperative.ImperativeError({
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
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    promptCredentials: promptCredentialsSpy,
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => ({ type: "zosmf" }),
                    getDefaultProfile: () => ({}),
                    getSecurePropsForProfile: () => [],
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, label, moreInfo);
            expect(showErrorSpy).toHaveBeenCalledTimes(1);
            expect(promptCredentialsSpy).not.toHaveBeenCalled();
            expect(showMsgSpy).toHaveBeenCalledWith("Operation Cancelled");
            showErrorSpy.mockClear();
            showMsgSpy.mockClear();
            promptCredentialsSpy.mockClear();
        });
    });

    describe("readConfigFromDisk", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: [
                {
                    uri: {
                        scheme: "file",
                        fsPath: "./test",
                    },
                },
            ],
            configurable: true,
        });
        it("should readConfigFromDisk and log 'Not Available'", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: () => ({
                    exists: true,
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
            await expect(ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });

        it("should readConfigFromDisk and find with defaults", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: () => ({ exists: true, layers: [] }),
            } as never);
            await expect(ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });

        it("should keep Imperative error details if readConfigFromDisk fails", async () => {
            const impErr = new imperative.ImperativeError({ msg: "Unexpected Imperative error" });
            const mockReadProfilesFromDisk = jest.fn().mockRejectedValue(impErr);
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: () => ({ exists: true }),
            } as never);
            await expect(ProfilesUtils.readConfigFromDisk()).rejects.toBe(impErr);
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            profInfoSpy.mockRestore();
        });

        it("should warn the user when using team config with a missing schema", async () => {
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValueOnce({
                readProfilesFromDisk: jest.fn(),
                hasValidSchema: false,
                getTeamConfig: () => ({
                    exists: true,
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
            const warnMsgSpy = jest.spyOn(Gui, "warningMessage");
            await ProfilesUtils.readConfigFromDisk(true);
            expect(warnMsgSpy).toHaveBeenCalledWith(
                "No valid schema was found for the active team configuration. This may introduce issues with profiles in Zowe Explorer."
            );
            profInfoSpy.mockRestore();
        });
    });

    describe("promptCredentials", () => {
        const prof = {
            getAllProfiles: jest.fn().mockReturnValue([]),
            isSecured: jest.fn().mockReturnValue(true),
            readProfilesFromDisk: jest.fn(),
            getTeamConfig: () => ({ properties: { autoStore: true } }),
        };
        it("calls getProfileInfo", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            const getProfileInfoSpy = jest.spyOn(Profiles.prototype, "getProfileInfo");
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as imperative.IProfileLoaded);
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue("emptyConfig"),
                configurable: true,
            });
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue([]);
            await ProfilesUtils.promptCredentials(null as any);
            expect(getProfileInfoSpy).toHaveBeenCalled();
        });

        it("shows an error message if the profile input is undefined", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as imperative.IProfileLoaded);
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue(""),
                configurable: true,
            });
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue([]);
            await ProfilesUtils.promptCredentials(null as any);
            expect(Gui.showMessage).toHaveBeenCalledWith("Operation Cancelled");
        });

        it("shows an info message if the profile credentials were updated", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as imperative.ProfileInfo);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as imperative.IProfileLoaded);
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue("testConfig"),
                configurable: true,
            });
            Object.defineProperty(Gui, "showMessage", {
                value: jest.fn(),
                configurable: true,
            });
            jest.spyOn(Profiles.prototype, "promptCredentials").mockResolvedValue(["some_user", "some_pass", "c29tZV9iYXNlNjRfc3RyaW5n"]);
            await ProfilesUtils.promptCredentials(null as any);
            expect(Gui.showMessage).toHaveBeenCalledWith("Credentials for testConfig were successfully updated");
        });

        it("shows a message if Update Credentials operation is called when autoStore = false", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            Object.defineProperty(mockProfileInstance, "getProfileInfo", {
                value: jest.fn(() => {
                    return {
                        profileName: "emptyConfig",
                        getTeamConfig: jest.fn().mockReturnValue({
                            exists: true,
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
            await ProfilesUtils.promptCredentials(null as any);
            expect(mockProfileInstance.getProfileInfo).toHaveBeenCalled();
            expect(Gui.showMessage).toHaveBeenCalledWith('"Update Credentials" operation not supported when "autoStore" is false');
        });

        it("fires onProfilesUpdate event if secure credentials are enabled", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            jest.spyOn(ProfilesCache.prototype, "getProfileInfo").mockResolvedValue(prof as unknown as any);
            jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig").mockResolvedValue({
                profile: prof,
            } as unknown as imperative.IProfileLoaded);
            Object.defineProperty(vscode.window, "showInputBox", {
                value: jest.fn().mockResolvedValue("testConfig"),
                configurable: true,
            });
            Object.defineProperty(Gui, "showMessage", {
                value: jest.fn(),
                configurable: true,
            });
            const secureCredsMock = jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const testConfig = {
                name: "testConfig",
                profile: {
                    type: "test-type",
                    user: "user",
                    password: "pass",
                    base64EncodedAuth: "user-pass",
                } as imperative.IProfile,
            } as imperative.IProfileLoaded;
            const updCredsMock = jest.spyOn(Constants.PROFILES_CACHE, "promptCredentials").mockResolvedValueOnce(["test", "test"]);
            await ProfilesUtils.promptCredentials({
                getProfile: () => testConfig,
            } as any);
            expect(updCredsMock).toHaveBeenCalled();
            expect(Gui.showMessage).toHaveBeenCalledWith("Credentials for testConfig were successfully updated");
            secureCredsMock.mockRestore();
        });
    });

    describe("initializeZoweFolder", () => {
        it("should create directories and files that do not exist", async () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockGetDirectValue.mockReturnValue(true);
            blockMocks.mockExistsSync.mockReturnValue(false);
            jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from(JSON.stringify({ overrides: { credentialManager: "@zowe/cli" } }), "utf-8"));
            const createFileSpy = jest.spyOn(ProfilesUtils, "writeOverridesFile");
            await ProfilesUtils.initializeZoweFolder();
            expect(ProfilesUtils.PROFILE_SECURITY).toBe(Constants.ZOWE_CLI_SCM);
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(2);
            expect(createFileSpy).toHaveBeenCalledTimes(1);
        });

        it("should skip creating directories and files that already exist", async () => {
            const blockMocks = createBlockMocks();
            jest.spyOn(ProfilesUtils, "getCredentialManagerOverride").mockReturnValue("@zowe/cli");
            blockMocks.mockGetDirectValue.mockReturnValue("@zowe/cli");
            blockMocks.mockExistsSync.mockReturnValue(true);
            const fileJson = blockMocks.mockFileRead;
            jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from(JSON.stringify({ overrides: { credentialManager: "@zowe/cli" } }), "utf-8"));
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            await ProfilesUtils.initializeZoweFolder();
            expect(ProfilesUtils.PROFILE_SECURITY).toBe("@zowe/cli");
            expect(blockMocks.mockMkdirSync).toHaveBeenCalledTimes(0);
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(0);
        });
    });

    describe("writeOverridesFile", () => {
        it("should have file exist", () => {
            const blockMocks = createBlockMocks();
            blockMocks.mockReadFileSync.mockReturnValueOnce(
                JSON.stringify({ overrides: { CredentialManager: "@zowe/cli", testValue: true } }, null, 2)
            );
            ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(0);
        });

        it("should return and have no change to the existing file if PROFILE_SECURITY matches file", () => {
            const blockMocks = createBlockMocks();
            const fileJson = blockMocks.mockFileRead;
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(0);
        });

        it("should add credential manager overrides object to existing object", () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
            const mergedJson = { ...blockMocks.mockFileRead, ...fileJson };
            const mergedString = JSON.stringify(mergedJson, null, 2);
            ProfilesUtils.writeOverridesFile();
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledTimes(1);
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledWith(blockMocks.zoweDir, mergedString, { encoding: "utf-8", flag: "w" });
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
            ProfilesUtils.writeOverridesFile();
            expect(loggerSpy).toHaveBeenCalledWith("Reading imperative.json failed. Will try to create file.");
            expect(blockMocks.mockWriteFileSync).toHaveBeenCalledWith(blockMocks.zoweDir, content, { encoding: "utf-8", flag: "w" });
            expect(blockMocks.mockWriteFileSync).not.toThrow();
        });

        it("should re-create file if overrides file contains invalid JSON", () => {
            const blockMocks = createBlockMocks();
            const fileJson = {
                test: null,
            };
            blockMocks.mockReadFileSync.mockReturnValueOnce(JSON.stringify(fileJson, null, 2).slice(1));
            const writeFileSpy = jest.spyOn(fs, "writeFileSync");
            expect(ProfilesUtils.writeOverridesFile).not.toThrow();
            expect(writeFileSpy).toHaveBeenCalled();
        });
    });

    describe("initializeZoweProfiles", () => {
        it("should successfully initialize Zowe folder and read config from disk", async () => {
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder");
            jest.spyOn(ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");
            const readConfigFromDiskSpy = jest.spyOn(ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(ZoweLogger.error).not.toHaveBeenCalled();
        });

        it("should handle error thrown on initialize Zowe folder", async () => {
            const testError = new Error("initializeZoweFolder failed");
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder").mockImplementationOnce(() => {
                throw testError;
            });
            const readConfigFromDiskSpy = jest.spyOn(ProfilesUtils, "readConfigFromDisk").mockResolvedValueOnce();
            await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining("initializeZoweFolder failed"));
        });

        it("should handle Imperative error thrown on read config from disk", async () => {
            const testError = new imperative.ImperativeError({ msg: "readConfigFromDisk failed" });
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder").mockReturnValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(expect.stringContaining(testError.message));
        });

        it("should handle JSON parse error thrown on read config from disk", async () => {
            const testError = new Error("readConfigFromDisk failed");
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder").mockReturnValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            const showZoweConfigErrorSpy = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockReturnValueOnce();
            await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(showZoweConfigErrorSpy).toHaveBeenCalledWith(testError.message);
        });
    });

    it("filterItem should get label if the filterItem icon exists", () => {
        const testFilterItem = new FilterItem({
            icon: "test",
        } as any);
        expect(testFilterItem.label).toEqual("test undefined");
    });

    describe("activateCredentialManagerOverride", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should successfully activate the extension passed in for a credential manager override", async () => {
            const activateSpy = jest.fn(() => ({}));
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: {} as imperative.ICredentialManagerConstructor,
                activate: activateSpy,
                isActive: true,
            } as any;

            await expect((ProfilesUtils as any).activateCredentialManagerOverride(credentialManagerExtension)).resolves.toEqual(
                {} as imperative.ICredentialManagerConstructor
            );
            expect(activateSpy).toHaveBeenCalledTimes(1);
        });

        it("should successfully activate the extension passed in but return undefined if no exports are found", async () => {
            const activateSpy = jest.fn(() => undefined);
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: undefined,
                activate: activateSpy,
                isActive: true,
            } as any;

            await expect((ProfilesUtils as any).activateCredentialManagerOverride(credentialManagerExtension)).resolves.toEqual(undefined);
            expect(activateSpy).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if the extension fails to activate", async () => {
            const credentialManagerExtension: vscode.Extension<any> = {
                exports: undefined,
                activate: () => {
                    throw new Error("failed to activate extension");
                },
                isActive: true,
            } as any;

            await expect((ProfilesUtils as any).activateCredentialManagerOverride(credentialManagerExtension)).rejects.toThrow(
                "Custom credential manager failed to activate"
            );
        });
    });

    describe("updateCredentialManagerSetting", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        it("should update the credential manager setting if secure value is true", () => {
            jest.spyOn(SettingsConfig, "isConfigSettingSetByUser").mockReturnValue(false);
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const loggerInfoSpy = jest.spyOn(ZoweLogger, "info");
            const recordCredMgrInConfigSpy = jest.spyOn(imperative.CredentialManagerOverride, "recordCredMgrInConfig");
            ProfilesUtils.updateCredentialManagerSetting();
            expect(ProfilesUtils.PROFILE_SECURITY).toBe(Constants.ZOWE_CLI_SCM);
            expect(loggerInfoSpy).toHaveBeenCalledTimes(1);
            expect(recordCredMgrInConfigSpy).toHaveBeenCalledWith(Constants.ZOWE_CLI_SCM);
        });
    });

    describe("isUsingTokenAuth", () => {
        it("should check the profile in use if using token based auth instead of the base profile", async () => {
            const mocks = createBlockMocks();
            Object.defineProperty(mocks.profInstance, "getDefaultProfile", {
                value: jest.fn().mockReturnValueOnce({} as any),
                configurable: true,
            });
            jest.spyOn(Constants.PROFILES_CACHE, "getLoadedProfConfig").mockResolvedValue({ type: "test" } as any);
            jest.spyOn(Constants.PROFILES_CACHE, "getSecurePropsForProfile").mockResolvedValue([]);
            await expect(AuthUtils.isUsingTokenAuth("test")).resolves.toEqual(false);
        });
    });

    describe("getProfilesInfo", () => {
        let isVSCodeCredentialPluginInstalledSpy: jest.SpyInstance;
        let getDirectValueSpy: jest.SpyInstance;
        let fetchRegisteredPluginsSpy: jest.SpyInstance;
        let getCredentialManagerOverrideSpy: jest.SpyInstance;
        let getCredentialManagerMapSpy: jest.SpyInstance;
        let setupCustomCredentialManagerSpy: jest.SpyInstance;
        let readProfilesFromDiskSpy: jest.SpyInstance;
        let promptAndDisableCredentialManagementSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
            getDirectValueSpy = jest.spyOn(SettingsConfig, "getDirectValue");
            isVSCodeCredentialPluginInstalledSpy = jest.spyOn(ProfilesUtils, "isVSCodeCredentialPluginInstalled");
            fetchRegisteredPluginsSpy = jest.spyOn(ProfilesUtils as any, "fetchRegisteredPlugins");
            getCredentialManagerOverrideSpy = jest.spyOn(ProfilesUtils, "getCredentialManagerOverride");
            getCredentialManagerMapSpy = jest.spyOn(ProfilesUtils, "getCredentialManagerMap");
            setupCustomCredentialManagerSpy = jest.spyOn(ProfilesUtils, "setupCustomCredentialManager");
            readProfilesFromDiskSpy = jest.spyOn(imperative.ProfileInfo.prototype, "readProfilesFromDisk");
            promptAndDisableCredentialManagementSpy = jest.spyOn(ProfilesUtils, "promptAndDisableCredentialManagement");
        });

        it("should retrieve the custom credential manager", async () => {
            getDirectValueSpy.mockReturnValueOnce(true);
            fetchRegisteredPluginsSpy.mockImplementation();
            getCredentialManagerOverrideSpy.mockReturnValue("test");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(true);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce({
                credMgrDisplayName: "test",
                credMgrPluginName: "test",
                credMgrZEName: "test",
            });
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            await expect(ProfilesUtils.getProfileInfo()).resolves.toEqual({});
        });

        it("should retrieve the default credential manager if no custom credential manager is found", async () => {
            getDirectValueSpy.mockReturnValueOnce(false);
            getCredentialManagerOverrideSpy.mockReturnValue("@zowe/cli");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(false);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce(undefined);
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            await expect(ProfilesUtils.getProfileInfo()).resolves.toEqual({});
        });

        it("should retrieve the default credential manager and prompt to disable credential management if environment not supported", async () => {
            const expectedErrMsg =
                // eslint-disable-next-line max-len
                "Failed to load credential manager. This may be related to Zowe Explorer being unable to use the default credential manager in a browser based environment.";
            getDirectValueSpy.mockReturnValueOnce(false);
            getCredentialManagerOverrideSpy.mockReturnValue("@zowe/cli");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(false);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce(undefined);
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            readProfilesFromDiskSpy.mockImplementation(() => {
                const err = new imperative.ProfInfoErr({
                    msg: expectedErrMsg,
                });
                Object.defineProperty(err, "errorCode", {
                    value: imperative.ProfInfoErr.LOAD_CRED_MGR_FAILED,
                    configurable: true,
                });
                throw err;
            });
            await expect(ProfilesUtils.getProfileInfo()).rejects.toThrow(expectedErrMsg);
            expect(promptAndDisableCredentialManagementSpy).toHaveBeenCalledTimes(1);
        });

        it("should ignore  error if it is not an instance of ProfInfoErr", async () => {
            const expectedErrorMsg = "Another error unrelated to credential management";
            getDirectValueSpy.mockReturnValueOnce(false);
            getCredentialManagerOverrideSpy.mockReturnValue("@zowe/cli");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(false);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce(undefined);
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            readProfilesFromDiskSpy.mockImplementation(() => {
                throw new Error(expectedErrorMsg);
            });
            await expect(ProfilesUtils.getProfileInfo()).resolves.not.toThrow();
            expect(promptAndDisableCredentialManagementSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe("isVSCodeCredentialPluginInstalled", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it("should return false if an error is thrown when getting extension from available VS Code extensions", () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            jest.spyOn(imperative.CredentialManagerOverride, "getCredMgrInfoByDisplayName").mockReturnValue({
                credMgrDisplayName: "test",
                credMgrPluginName: "test",
                credMgrZEName: "test",
            });
            jest.spyOn(vscode.extensions, "getExtension").mockImplementation(() => {
                throw new Error("test error");
            });
            expect(ProfilesUtils.isVSCodeCredentialPluginInstalled("test")).toBe(false);
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("getCredentialManagerOverride", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it("should return the custom credential manager override if of type string", () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");

            jest.spyOn(fs, "readFileSync").mockReturnValueOnce(
                Buffer.from(
                    JSON.stringify({
                        overrides: {
                            credentialManager: "My Custom Credential Manager",
                        },
                    })
                )
            );
            Object.defineProperty(imperative.CredentialManagerOverride, "CRED_MGR_SETTING_NAME", {
                value: "credentialManager",
                configurable: true,
            });

            expect(ProfilesUtils.getCredentialManagerOverride()).toBe("My Custom Credential Manager");
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
        });

        it("should return default manager if the override file does not exist", () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const zoweLoggerInfoSpy = jest.spyOn(ZoweLogger, "info");

            jest.spyOn(fs, "readFileSync").mockImplementation(() => {
                throw new Error("test");
            });
            try {
                ProfilesUtils.getCredentialManagerOverride();
            } catch (err) {
                expect(err).toBe("test");
            }

            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
            expect(zoweLoggerInfoSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("setupCustomCredentialManager", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it("should return the profileInfo object with the custom credential manager constructor", async () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const zoweLoggerInfoSpy = jest.spyOn(ZoweLogger, "info");

            jest.spyOn(vscode.extensions, "getExtension").mockImplementation();
            jest.spyOn(ProfilesUtils as any, "activateCredentialManagerOverride").mockResolvedValue(jest.fn());

            await expect(
                ProfilesUtils["setupCustomCredentialManager"]({
                    credMgrDisplayName: "test",
                    credMgrPluginName: "test",
                    credMgrZEName: "test",
                })
            ).resolves.toEqual({} as imperative.ProfileInfo);
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(2);
            expect(zoweLoggerInfoSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("fetchRegisteredPlugins", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it("should not find any registered plugins and simply return", async () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const updateCredentialManagerSettingSpy = jest.spyOn(ProfilesUtils, "updateCredentialManagerSetting");
            const setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue");

            jest.spyOn(imperative.CredentialManagerOverride, "getKnownCredMgrs").mockReturnValue([
                {
                    credMgrDisplayName: "test",
                    credMgrPluginName: "test",
                    credMgrZEName: "test",
                },
            ]);
            jest.spyOn(vscode.extensions, "getExtension").mockImplementation(() => {
                throw new Error("test error");
            });

            await expect(ProfilesUtils["fetchRegisteredPlugins"]()).resolves.not.toThrow();
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
            expect(updateCredentialManagerSettingSpy).toHaveBeenCalledTimes(0);
            expect(setDirectValueSpy).toHaveBeenCalledTimes(0);
        });

        it("suggest changing the override setting after finding a registered custom credential manager and selecting 'yes'", async () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const updateCredentialManagerSettingSpy = jest.spyOn(ProfilesUtils, "updateCredentialManagerSetting");
            const setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue");

            jest.spyOn(imperative.CredentialManagerOverride, "getKnownCredMgrs").mockReturnValue([
                {
                    credMgrDisplayName: "test",
                    credMgrPluginName: "test",
                    credMgrZEName: "test",
                },
            ]);
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValue({
                credMgrDisplayName: "test",
            } as any);
            jest.spyOn(Gui, "infoMessage").mockResolvedValue("Yes");

            await expect(ProfilesUtils["fetchRegisteredPlugins"]()).resolves.not.toThrow();
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(2);
            expect(updateCredentialManagerSettingSpy).toHaveBeenCalledTimes(1);
            expect(setDirectValueSpy).toHaveBeenCalledTimes(1);
        });

        it("suggest changing the override setting and selecting 'no' and should keep the default manager", async () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const updateCredentialManagerSettingSpy = jest.spyOn(ProfilesUtils, "updateCredentialManagerSetting");
            const setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue");

            jest.spyOn(imperative.CredentialManagerOverride, "getKnownCredMgrs").mockReturnValue([
                {
                    credMgrDisplayName: "test",
                    credMgrPluginName: "test",
                    credMgrZEName: "test",
                },
            ]);
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValue({
                credMgrDisplayName: "test",
            } as any);
            jest.spyOn(Gui, "infoMessage").mockResolvedValue("Don't ask again");

            await expect(ProfilesUtils["fetchRegisteredPlugins"]()).resolves.not.toThrow();
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
            expect(updateCredentialManagerSettingSpy).toHaveBeenCalledTimes(0);
            expect(setDirectValueSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("promptAndHandleMissingCredentialManager", () => {
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
            jest.restoreAllMocks();
        });

        it("should prompt to install missing custom credential manager defined in 'imperative.json'", async () => {
            const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace");
            const reloadWindowSpy = jest.spyOn(vscode.commands, "executeCommand");

            jest.spyOn(Gui, "infoMessage").mockResolvedValue("Install");
            Object.defineProperty(vscode.env, "openExternal", {
                value: () => true,
                configurable: true,
            });
            jest.spyOn(Gui, "showMessage").mockResolvedValue("Reload");

            await expect(
                ProfilesUtils["promptAndHandleMissingCredentialManager"]({
                    credMgrDisplayName: "test",
                    credMgrPluginName: "test",
                    credMgrZEName: "test",
                })
            ).resolves.not.toThrow();
            expect(zoweLoggerTraceSpy).toHaveBeenCalledTimes(1);
            expect(reloadWindowSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });
    });

    describe("promptAndDisableCredentialManagement", () => {
        let setDirectValueSpy: jest.SpyInstance;
        let warningMessageSpy: jest.SpyInstance;
        let executeCommandSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.resetModules();
            jest.restoreAllMocks();
            setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue");
            warningMessageSpy = jest.spyOn(Gui, "warningMessage");
            executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        });

        it("should prompt whether to disable credential management, and disable globally if 'Yes, globally' selected", async () => {
            warningMessageSpy.mockResolvedValue("Yes, globally");
            await expect(ProfilesUtils.promptAndDisableCredentialManagement()).resolves.not.toThrow();
            expect(setDirectValueSpy).toHaveBeenCalledWith(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED, false, vscode.ConfigurationTarget.Global);
            expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });

        it("should prompt whether to disable credential management, and disable on workspace if 'Only for this workspace' selected", async () => {
            warningMessageSpy.mockResolvedValue("Only for this workspace");
            await expect(ProfilesUtils.promptAndDisableCredentialManagement()).resolves.not.toThrow();
            expect(setDirectValueSpy).toHaveBeenCalledWith(
                Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED,
                false,
                vscode.ConfigurationTarget.Workspace
            );
            expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });

        it("should prompt whether to disable credential management, and throw error if 'No'", async () => {
            warningMessageSpy.mockResolvedValue("No");
            await expect(ProfilesUtils.promptAndDisableCredentialManagement()).rejects.toThrow(
                // eslint-disable-next-line max-len
                "Failed to load credential manager. This may be related to Zowe Explorer being unable to use the default credential manager in a browser based environment."
            );
        });
    });

    describe("v1ProfileOptions", () => {
        it("should prompt user if v1 profiles detected and Convert Existing Profiles chosen", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue({ configName: "zowe.config.json" }),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Convert Existing Profiles" as any);
            Object.defineProperty(imperative, "ConvertMsgFmt", {
                value: jest.fn().mockReturnValue({
                    REPORT_LINE: 1,
                    ERROR_LINE: 2,
                    PARAGRAPH: 4,
                    INDENT: 8,
                }),
                configurable: true,
            });
            jest.spyOn(ProfilesCache, "convertV1ProfToConfig").mockResolvedValueOnce({
                msgs: [
                    { msgFormat: imperative.ConvertMsgFmt.PARAGRAPH, msgText: "message text for testing." },
                    { msgFormat: imperative.ConvertMsgFmt.INDENT, msgText: "message text for testing." },
                ],
                profilesConverted: { zosmf: ["myzosmf"] },
                profilesFailed: [
                    { name: "zosmf2", type: "zosmf", error: "failed" as any },
                    { name: null, type: "zosmf", error: "failed" as any },
                ],
            } as any);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(Definitions.V1MigrationStatus.JustMigrated);
            jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn().mockReturnValue({}), configurable: true });
            Object.defineProperty(Gui, "showTextDocument", { value: jest.fn(), configurable: true });
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });

            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.toBe(ProfilesConvertStatus.ConvertSelected);
            onlyV1ProfsExistMock[Symbol.dispose]();

            expect(infoMsgSpy).toHaveBeenCalledTimes(2);
            infoMsgSpy.mockRestore();
            profInfoSpy.mockRestore();
        });

        it("should prompt user if v1 profiles detected and return if nothing chosen", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue([]),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);

            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.not.toThrow();
            onlyV1ProfsExistMock[Symbol.dispose]();

            infoMsgSpy.mockRestore();
            profInfoSpy.mockRestore();
        });

        it("should prompt user if v1 profiles detected and Create New is selected", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
            });
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue([]),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New");

            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(Definitions.V1MigrationStatus.JustMigrated);
            jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.toBe(ProfilesConvertStatus.CreateNewSelected);
            onlyV1ProfsExistMock[Symbol.dispose]();

            infoMsgSpy.mockRestore();
            profInfoSpy.mockRestore();
        });
    });

    describe("handleV1MigrationStatus", () => {
        function getBlockMocks() {
            return {
                getValueMock: jest.spyOn(ZoweLocalStorage, "getValue"),
                setValueMock: jest.spyOn(ZoweLocalStorage, "setValue"),
            };
        }

        it("should call executeCommand with zowe.ds.addSession if the migration status is CreateConfigSelected", async () => {
            const blockMocks = getBlockMocks();
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            blockMocks.getValueMock.mockReturnValueOnce(Definitions.V1MigrationStatus.JustMigrated);
            blockMocks.setValueMock.mockImplementation();
            jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                getTeamConfig: jest.fn().mockReturnValue({ exists: false }),
            } as any);
            const onlyV1ProfilesExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", { get: () => true });
            const v1ProfileOptsMock = jest.spyOn(ProfilesUtils as any, "v1ProfileOptions").mockResolvedValue(ProfilesConvertStatus.CreateNewSelected);
            await ProfilesUtils.handleV1MigrationStatus();
            expect(executeCommandMock.mock.lastCall?.[0]).toBe("zowe.ds.addSession");
            expect(v1ProfileOptsMock).toHaveBeenCalled();
            blockMocks.getValueMock.mockRestore();
            blockMocks.setValueMock.mockRestore();
            onlyV1ProfilesExistMock[Symbol.dispose]();
        });

        it("should reload the window once if the user just migrated from v1", async () => {
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValueOnce({
                readProfilesFromDisk: jest.fn(),
                hasValidSchema: false,
                getTeamConfig: () => ({
                    exists: false,
                }),
            } as never);
            const getConfigurationMock = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
            });
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            const getValueMock = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);
            const setValueMock = jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            await ProfilesUtils.handleV1MigrationStatus();
            expect(getConfigurationMock).toHaveBeenCalledWith("Zowe-USS-Persistent");
            expect(getValueMock).toHaveBeenCalledWith(Definitions.LocalStorageKey.V1_MIGRATION_STATUS);
            expect(setValueMock).toHaveBeenCalledWith(Definitions.LocalStorageKey.V1_MIGRATION_STATUS, Definitions.V1MigrationStatus.JustMigrated);
            expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.reloadWindow");
            executeCommandMock.mockRestore();
            getConfigurationMock.mockRestore();
            getValueMock.mockRestore();
            setValueMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();

            profInfoSpy.mockRestore();
        });

        it("should not reload the window during migration if imperative.ProfileInfo.onlyV1ProfilesExist is false", async () => {
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValueOnce({
                readProfilesFromDisk: jest.fn(),
                hasValidSchema: false,
                getTeamConfig: () => ({
                    exists: false,
                }),
            } as never);
            const getConfigurationMock = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
            });
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => false,
            });
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            const getValueMock = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);
            const setValueMock = jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            await ProfilesUtils.handleV1MigrationStatus();
            expect(getConfigurationMock).toHaveBeenCalledWith("Zowe-USS-Persistent");
            expect(getValueMock).toHaveBeenCalledWith(Definitions.LocalStorageKey.V1_MIGRATION_STATUS);
            expect(executeCommandMock).not.toHaveBeenCalledWith("workbench.action.reloadWindow");
            executeCommandMock.mockRestore();
            getConfigurationMock.mockRestore();
            getValueMock.mockRestore();
            setValueMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();

            profInfoSpy.mockRestore();
        });

        it("should call v1ProfileOptions if team config does not exist and only v1 profiles exist", async () => {
            const fakeProfInfo = {
                readProfilesFromDisk: jest.fn(),
                hasValidSchema: false,
                getTeamConfig: () => ({
                    exists: false,
                }),
                onlyV1ProfilesExist: () => true,
            };
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValueOnce(fakeProfInfo as any);
            const getConfigurationMock = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
            });
            const v1ProfileOptionsMock = jest.spyOn(ProfilesUtils as any, "v1ProfileOptions").mockImplementation();
            const getValueMock = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(Definitions.V1MigrationStatus.JustMigrated);
            await ProfilesUtils.handleV1MigrationStatus();
            expect(getConfigurationMock).toHaveBeenCalledWith("Zowe-USS-Persistent");
            expect(getValueMock).toHaveBeenCalledWith(Definitions.LocalStorageKey.V1_MIGRATION_STATUS);
            expect(v1ProfileOptionsMock).toHaveBeenCalled();
            getConfigurationMock.mockRestore();
            getValueMock.mockRestore();
            v1ProfileOptionsMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();

            profInfoSpy.mockRestore();
        });

        it("should show the Create Config prompt when Create New is chosen", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue([]),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
            } as never);
            const msgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New" as any);

            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            const v1ProfOptsMock = jest.spyOn(ProfilesUtils as any, "v1ProfileOptions").mockResolvedValue(ProfilesConvertStatus.CreateNewSelected);
            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.not.toThrow();
            expect(v1ProfOptsMock).toHaveBeenCalled();
            onlyV1ProfsExistMock[Symbol.dispose]();

            msgSpy.mockRestore();
            profInfoSpy.mockRestore();
        });
    });

    describe("promptUserWithNoConfigs", () => {
        it("prompts the user if they don't have any Zowe client configs", async () => {
            const profInfoMock = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                getTeamConfig: () => ({ exists: false }),
            } as any);
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            await ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            profInfoMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();
        });
        it("executes zowe.ds.addSession if the user selects 'Create New' in the prompt", async () => {
            const profInfoMock = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                getTeamConfig: () => ({ exists: false }),
            } as any);
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockResolvedValue("Create New");
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            await ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            expect(executeCommandMock).toHaveBeenCalledWith("zowe.ds.addSession");
            executeCommandMock.mockRestore();
            profInfoMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();
        });
        it("does not prompt the user if they have a Zowe team config", async () => {
            const profInfoMock = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                getTeamConfig: () => ({ exists: true }),
            } as any);
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            await ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).not.toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            profInfoMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();
        });
        it("does not prompt the user if they have v1 profiles", async () => {
            const profInfoMock = jest.spyOn(ProfilesUtils, "getProfileInfo").mockResolvedValue({
                getTeamConfig: () => ({ exists: false }),
            } as any);
            const onlyV1ProfsExistMock = new MockedProperty(imperative.ProfileInfo, "onlyV1ProfilesExist", {
                configurable: true,
                get: () => true,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            await ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).not.toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            profInfoMock.mockRestore();
            onlyV1ProfsExistMock[Symbol.dispose]();
        });
    });

    describe("setupDefaultCredentialManager", () => {
        it("calls readProfilesFromDisk with homeDir and projectDir", async () => {
            const readProfilesFromDiskMock = jest.spyOn(imperative.ProfileInfo.prototype, "readProfilesFromDisk").mockImplementation();
            await ProfilesUtils.setupDefaultCredentialManager();
            expect(readProfilesFromDiskMock).toHaveBeenCalledWith({
                homeDir: FileManagement.getZoweDir(),
                projectDir: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
            });
        });
    });
});
