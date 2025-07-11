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
import { AuthHandler, ErrorCorrelator, Gui, imperative, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import {
    createAltTypeIProfile,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createValidIProfile,
} from "../../__mocks__/mockCreators/shared";
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
import { createDatasetSessionNode } from "../../__mocks__/mockCreators/datasets";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";

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
        Object.defineProperty(ProfilesUtils, "checkDefaultCredentialManager", { value: jest.fn(), configurable: true });
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
            const scenario = "Task failed successfully";
            await AuthUtils.errorHandling(errorDetails, { scenario });
            expect(Gui.errorMessage).toHaveBeenCalledWith(errorDetails.message, { items: ["Show log", "Troubleshoot"] });
            expect(ZoweLogger.error).toHaveBeenCalledWith(
                `${errorDetails.toString()}\n` + util.inspect({ errorDetails, ...{ scenario, profile: undefined } }, { depth: null })
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
            const scenario = "Task failed successfully";
            await AuthUtils.errorHandling(errorDetails, { scenario });
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            expect(Gui.errorMessage).toHaveBeenCalledWith(errorDetails.message, { items: ["Show log", "Troubleshoot"] });
            expect(ZoweLogger.error).toHaveBeenCalledWith(
                `Error: ${errorDetails.message}\n` + util.inspect({ errorDetails, ...{ scenario, profile: undefined } }, { depth: null })
            );
        });

        it("should handle error and open config file", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid hostname",
                errorCode: 404 as unknown as string,
            });
            const scenario = "Task failed successfully";
            const openConfigForMissingHostnameMock = jest.spyOn(AuthUtils, "openConfigForMissingHostname");
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
                    openConfigFile: jest.fn(),
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, { scenario });
            expect(openConfigForMissingHostnameMock).toHaveBeenCalled();
        });

        it("should handle bad hostname error", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "protocol should not be included in hostname",
            });
            const scenario = "Task failed successfully";
            const openConfigForMissingHostnameMock = jest.spyOn(AuthUtils, "openConfigForMissingHostname");
            const errorCorrelatorGetInstanceMock = jest.spyOn(ErrorCorrelator, "getInstance");
            await AuthUtils.errorHandling(errorDetails, { scenario });
            expect(openConfigForMissingHostnameMock).not.toHaveBeenCalled();
            expect(errorCorrelatorGetInstanceMock).toHaveBeenCalled();
        });

        it("should handle error for invalid credentials and prompt for authentication - credentials entered", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: Number(401).toString(),
                additionalDetails: "Authentication is not valid or expired.",
            });
            const scenario = "Task failed successfully";
            const showMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation(() => Promise.resolve("Update Credentials"));
            const promptCredsSpy = jest.fn().mockResolvedValueOnce(["someusername", "pw"]);
            const ssoLoginSpy = jest.fn();
            const profile = createIProfile();
            // disable locking mechanism for this test, will be tested in separate test cases

            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    promptCredentials: promptCredsSpy,
                    ssoLogin: ssoLoginSpy,
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => profile,
                    getDefaultProfile: () => ({}),
                    getPropsForProfile: () => ["tokenValue"],
                    loadNamedProfile: () => profile,
                    shouldRemoveTokenFromProfile: () => jest.fn(),
                },
                configurable: true,
            });
            const unlockProfileMock = jest.spyOn(AuthHandler, "unlockProfile").mockImplementation();
            await AuthUtils.errorHandling(errorDetails, { profile, scenario });
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
            expect(promptCredsSpy).toHaveBeenCalledTimes(1);
            expect(ssoLoginSpy).not.toHaveBeenCalled();
            // ensure profile is unlocked after successful credential update
            expect(unlockProfileMock).toHaveBeenCalledWith(profile.name, true);
            showMessageSpy.mockClear();
            promptCredsSpy.mockClear();
            unlockProfileMock.mockRestore();
        });

        it("should handle token error and proceed to login", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: "401",
                additionalDetails: "Token is not valid or expired.",
            });
            const scenario = "Task failed successfully";
            const showErrorSpy = jest.spyOn(Gui, "errorMessage");
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation(() => Promise.resolve("Log in to Authentication Service"));

            // simulate successful SSO login
            const ssoLoginSpy = jest.fn().mockResolvedValueOnce(true);
            const promptCredentialsSpy = jest.fn();
            const profile = createIProfile();
            const unlockProfileMock = jest.spyOn(AuthHandler, "unlockProfile").mockImplementation();
            const setAuthCancelledMock = jest.spyOn(AuthHandler, "setAuthCancelled").mockImplementation();
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => profile,
                    getDefaultProfile: () => ({}),
                    getPropsForProfile: () => ["tokenValue"],
                    loadNamedProfile: () => profile,
                    shouldRemoveTokenFromProfile: () => jest.fn(),
                    ssoLogin: ssoLoginSpy,
                    promptCredentials: promptCredentialsSpy,
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, { profile, scenario });
            // ensure profile is unlocked after successful SSO login
            expect(unlockProfileMock).toHaveBeenCalledWith(profile.name, true);
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
            expect(ssoLoginSpy).toHaveBeenCalledTimes(1);
            expect(showErrorSpy).not.toHaveBeenCalled();
            expect(promptCredentialsSpy).not.toHaveBeenCalled();
            showErrorSpy.mockClear();
            showMessageSpy.mockClear();
            ssoLoginSpy.mockClear();
            setAuthCancelledMock.mockRestore();
        });
        it("should handle credential error - no selection made for update", async () => {
            const errorDetails = new imperative.ImperativeError({
                msg: "Invalid credentials",
                errorCode: "401",
                additionalDetails: "All configured authentication methods failed",
            });
            const moreInfo = "Task failed successfully";
            Object.defineProperty(vscode, "env", {
                value: {
                    appName: "Visual Studio Code",
                },
                configurable: true,
            });
            const showErrorSpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);
            const setAuthCancelledMock = jest.spyOn(AuthHandler, "setAuthCancelled").mockImplementation();
            const showMsgSpy = jest.spyOn(Gui, "showMessage");
            const promptCredentialsSpy = jest.fn();
            const ssoLogin = jest.fn();
            const profile = { type: "zosmf" } as any;
            Object.defineProperty(Constants, "PROFILES_CACHE", {
                value: {
                    promptCredentials: promptCredentialsSpy,
                    ssoLogin,
                    getProfileInfo: profileInfoMock,
                    getLoadedProfConfig: () => profile,
                    getDefaultProfile: () => ({}),
                    getPropsForProfile: () => ["tokenValue"],
                    loadNamedProfile: () => profile,
                    shouldRemoveTokenFromProfile: () => jest.fn(),
                },
                configurable: true,
            });
            await AuthUtils.errorHandling(errorDetails, { profile, scenario: moreInfo });
            expect(showErrorSpy).toHaveBeenCalledTimes(1);
            expect(promptCredentialsSpy).not.toHaveBeenCalled();
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(showMsgSpy).not.toHaveBeenCalledWith("Operation Cancelled");
            showErrorSpy.mockClear();
            showMsgSpy.mockClear();
            promptCredentialsSpy.mockClear();
            setAuthCancelledMock.mockRestore();
        });
    });

    describe("readConfigFromDisk", () => {
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

        it("should readConfigFromDisk and find default profiles", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            jest.spyOn(ProfilesUtils, "setupProfileInfo").mockReturnValueOnce({
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
            const loggerSpy = jest.spyOn(ZoweLogger, "debug");
            await expect(ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            expect(loggerSpy).toHaveBeenLastCalledWith(expect.stringContaining(`Path: test, Found with the following defaults: "test"`));
        });

        it("should readConfigFromDisk and log 'Not Available'", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValueOnce({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: () => ({
                    exists: true,
                    layers: [
                        {
                            path: "test",
                            exists: false,
                            properties: {},
                        },
                    ],
                }),
            } as never);
            const loggerSpy = jest.spyOn(ZoweLogger, "debug");
            await expect(ProfilesUtils.readConfigFromDisk()).resolves.not.toThrow();
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            expect(loggerSpy).toHaveBeenLastCalledWith(expect.stringContaining("Path: test, Not available"));
        });

        it("should keep Imperative error details if readConfigFromDisk fails", async () => {
            const impErr = new imperative.ImperativeError({ msg: "Unexpected Imperative error" });
            const mockReadProfilesFromDisk = jest.fn().mockRejectedValue(impErr);
            jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValueOnce({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: () => ({ exists: true }),
            } as never);
            (ProfilesUtils as any).mProfileInfo = undefined;
            await expect(ProfilesUtils.readConfigFromDisk()).rejects.toBe(impErr);
            expect(mockReadProfilesFromDisk).toHaveBeenCalledTimes(1);
            expect((ProfilesUtils as any).mProfileInfo).toBeUndefined();
        });

        it("should warn the user when using team config with a missing schema", async () => {
            jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValueOnce({
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

        it("calls unlockProfile once credentials are provided", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            const promptCredentialsProfilesMock = jest.spyOn(mockProfileInstance, "promptCredentials").mockResolvedValueOnce(["someusername", "pw"]);
            const updateCachedProfileMock = jest.spyOn(mockProfileInstance, "updateCachedProfile").mockResolvedValueOnce(undefined);
            const profile = createIProfile();
            Object.defineProperty(Constants, "PROFILES_CACHE", { value: mockProfileInstance, configurable: true });
            const unlockProfileSpy = jest.spyOn(AuthHandler, "unlockProfile");
            const mockNode = createDatasetSessionNode(createISession(), profile);
            const mockTreeProvider = {
                mSessionNodes: [mockNode],
                flipState: jest.fn(),
                refreshElement: jest.fn(),
            } as any;
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
            jest.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
            jest.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockTreeProvider);
            await ProfilesUtils.promptCredentials(mockNode);
            expect(promptCredentialsProfilesMock).toHaveBeenCalledTimes(1);
            expect(promptCredentialsProfilesMock).toHaveBeenCalledWith(profile, true);
            expect(unlockProfileSpy).toHaveBeenCalledTimes(1);
            expect(unlockProfileSpy).toHaveBeenCalledWith(profile, true);
            expect(updateCachedProfileMock).toHaveBeenCalledTimes(1);
            expect(updateCachedProfileMock).toHaveBeenCalledWith(profile, mockNode);
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
            expect(Gui.showMessage).toHaveBeenCalledWith("Operation cancelled");
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
            const promptCredentialsMock = jest.spyOn(mockProfileInstance, "promptCredentials").mockResolvedValueOnce(undefined as any);
            const dsNode = createDatasetSessionNode(createISession(), createIProfile());
            await ProfilesUtils.promptCredentials(dsNode);
            expect(Gui.showMessage).not.toHaveBeenCalledWith('"Update Credentials" operation not supported when "autoStore" is false');
            expect(promptCredentialsMock).toHaveBeenCalledTimes(1);
            promptCredentialsMock.mockRestore();
        });

        it("fires onProfilesUpdate event if secure credentials are enabled", async () => {
            const mockProfileInstance = new Profiles(imperative.Logger.getAppLogger());
            (mockProfileInstance as any).allProfiles = [
                {
                    name: "testConfig",
                    type: "test-type",
                    profile: {
                        port: 456,
                        host: "example.host",
                    },
                },
            ];
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
                type: "test-type",
                profile: {
                    user: "user",
                    password: "pass",
                    base64EncodedAuth: "user-pass",
                } as imperative.IProfile,
            } as imperative.IProfileLoaded;
            const updCredsMock = jest.spyOn(Constants.PROFILES_CACHE, "promptCredentials").mockResolvedValueOnce(["test", "test"]);
            await ProfilesUtils.promptCredentials({
                getProfile: () => testConfig,
                setProfileToChoice: jest.fn(),
                getChildren: jest.fn().mockResolvedValue([]),
            } as any);
            expect(updCredsMock).toHaveBeenCalled();
            expect(Gui.showMessage).toHaveBeenCalledWith("Credentials for testConfig were successfully updated");
            secureCredsMock.mockRestore();
        });
    });

    describe("initializeZoweFolder", () => {
        it("should create directories and files that do not exist", async () => {
            const blockMocks = createBlockMocks();
            jest.spyOn(ProfilesUtils, "checkDefaultCredentialManager").mockReturnValue(true);
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
            jest.spyOn(ProfilesUtils, "checkDefaultCredentialManager").mockReturnValue(true);
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
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
            const readConfigFromDiskSpy = jest.spyOn(ProfilesUtils, "readConfigFromDisk").mockRejectedValueOnce(testError);
            await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
            expect(initZoweFolderSpy).toHaveBeenCalledTimes(1);
            expect(readConfigFromDiskSpy).toHaveBeenCalledTimes(1);
            expect(Gui.errorMessage).toHaveBeenCalledWith(testError.message, { items: ["Show log", "Troubleshoot"] });
        });

        it("should handle JSON parse error thrown on read config from disk", async () => {
            const testError = new Error("readConfigFromDisk failed");
            const initZoweFolderSpy = jest.spyOn(ProfilesUtils, "initializeZoweFolder").mockResolvedValueOnce();
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
            jest.spyOn(ProfilesUtils, "checkDefaultCredentialManager").mockReturnValue(true);
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
            jest.spyOn(Constants.PROFILES_CACHE, "getPropsForProfile").mockResolvedValue([]);
            jest.spyOn(Constants.PROFILES_CACHE, "shouldRemoveTokenFromProfile").mockResolvedValue(false as never);
            await expect(AuthUtils.isUsingTokenAuth("test")).resolves.toEqual(false);
        });

        it("should return false when token is marked for removal", async () => {
            const mocks = createBlockMocks();
            jest.spyOn(Constants.PROFILES_CACHE, "shouldRemoveTokenFromProfile").mockResolvedValue(true as never);

            Object.defineProperty(mocks.profInstance, "getDefaultProfile", {
                value: jest.fn().mockReturnValue({
                    name: "baseProfile",
                    type: "base",
                }),
                configurable: true,
            });

            await expect(AuthUtils.isUsingTokenAuth("testProfile")).resolves.toEqual(false);
        });
    });

    describe("setupProfileInfo", () => {
        let isVSCodeCredentialPluginInstalledSpy: jest.SpyInstance;
        let getDirectValueSpy: jest.SpyInstance;
        let fetchRegisteredPluginsSpy: jest.SpyInstance;
        let getCredentialManagerOverrideSpy: jest.SpyInstance;
        let getCredentialManagerMapSpy: jest.SpyInstance;
        let setupCustomCredentialManagerSpy: jest.SpyInstance;
        let profileManagerWillLoadSpy: jest.SpyInstance;
        let disableCredentialManagementSpy: jest.SpyInstance;
        let checkDefaultCredentialManagerSpy: jest.SpyInstance;

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
            profileManagerWillLoadSpy = jest.spyOn(imperative.ProfileInfo.prototype, "profileManagerWillLoad");
            disableCredentialManagementSpy = jest.spyOn(ProfilesUtils, "disableCredentialManagement");
            checkDefaultCredentialManagerSpy = jest.spyOn(ProfilesUtils, "checkDefaultCredentialManager");
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
            await expect(ProfilesUtils.setupProfileInfo()).resolves.toBeInstanceOf(imperative.ProfileInfo);
        });

        it("should retrieve the default credential manager if no custom credential manager is found", async () => {
            getDirectValueSpy.mockReturnValueOnce(false);
            getCredentialManagerOverrideSpy.mockReturnValue("@zowe/cli");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(false);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce(undefined);
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            await expect(ProfilesUtils.setupProfileInfo()).resolves.toBeInstanceOf(imperative.ProfileInfo);
        });

        it("should retrieve the default credential manager and disable credential management if environment not supported", async () => {
            checkDefaultCredentialManagerSpy.mockReturnValue(true);
            getDirectValueSpy.mockReturnValueOnce(false);
            getCredentialManagerOverrideSpy.mockReturnValue("@zowe/cli");
            isVSCodeCredentialPluginInstalledSpy.mockReturnValueOnce(false);
            getDirectValueSpy.mockReturnValueOnce(true);
            getCredentialManagerMapSpy.mockReturnValueOnce(undefined);
            setupCustomCredentialManagerSpy.mockReturnValueOnce({});
            profileManagerWillLoadSpy.mockReturnValueOnce(false);
            await expect(ProfilesUtils.setupProfileInfo()).resolves.toBeInstanceOf(imperative.ProfileInfo);
            expect(disableCredentialManagementSpy).toHaveBeenCalledTimes(1);
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
                            credentialManager: "My Custom credential manager",
                        },
                    })
                )
            );
            Object.defineProperty(imperative.CredentialManagerOverride, "CRED_MGR_SETTING_NAME", {
                value: "credentialManager",
                configurable: true,
            });

            expect(ProfilesUtils.getCredentialManagerOverride()).toBe("My Custom credential manager");
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

        it("should return the credential manager override with the custom credential manager constructor", async () => {
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
            ).resolves.toMatchObject({ service: "test" });
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

    describe("disableCredentialManagement", () => {
        let setDirectValueSpy: jest.SpyInstance;
        let warningMessageSpy: jest.SpyInstance;
        let executeCommandSpy: jest.SpyInstance;
        let getDirectValueSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.resetModules();
            jest.restoreAllMocks();
            setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue");
            warningMessageSpy = jest.spyOn(Gui, "warningMessage");
            executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
            getDirectValueSpy = jest.spyOn(SettingsConfig, "getDirectValue");
        });

        it("should show warning that credential management was disabled", async () => {
            warningMessageSpy.mockResolvedValue("Yes, globally");
            getDirectValueSpy.mockReturnValueOnce(true);
            await expect(ProfilesUtils.disableCredentialManagement()).resolves.not.toThrow();
            expect(setDirectValueSpy).toHaveBeenCalledWith(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED, false, vscode.ConfigurationTarget.Global);
            expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.reloadWindow");
        });
    });

    describe("v1ProfileOptions", () => {
        it("should prompt user if v1 profiles detected and Convert Existing Profiles chosen", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue({ configName: "zowe.config.json" }),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
                onlyV1ProfilesExist: true,
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Convert existing profiles" as any);
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

            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.toBe(ProfilesConvertStatus.ConvertSelected);

            expect(infoMsgSpy).toHaveBeenCalledTimes(2);
            infoMsgSpy.mockRestore();
            profInfoSpy.mockRestore();
        });

        it("should prompt user if v1 profiles detected and return if nothing chosen", async () => {
            const mockReadProfilesFromDisk = jest.fn();
            const profInfoSpy = jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue([]),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
                onlyV1ProfilesExist: true,
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);

            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.not.toThrow();

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
            const profInfoSpy = jest.spyOn(ProfilesUtils, "setupProfileInfo").mockResolvedValue({
                readProfilesFromDisk: mockReadProfilesFromDisk,
                getTeamConfig: jest.fn().mockReturnValue([]),
                getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
                onlyV1ProfilesExist: true,
            } as never);
            const infoMsgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New");

            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(Definitions.V1MigrationStatus.JustMigrated);
            jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.toBe(ProfilesConvertStatus.CreateNewSelected);

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

        it("should return early if profileInfo is nullish", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.getValueMock.mockReturnValueOnce(Definitions.V1MigrationStatus.JustMigrated);
            blockMocks.setValueMock.mockImplementation();
            const v1ProfileOptsMock = jest.spyOn(ProfilesUtils as any, "v1ProfileOptions");
            const profInfoMock = jest.fn();
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            await ProfilesUtils.handleV1MigrationStatus();
            expect(profInfoMock).toHaveBeenCalled();
            expect(v1ProfileOptsMock).not.toHaveBeenCalled();
            blockMocks.getValueMock.mockRestore();
            blockMocks.setValueMock.mockRestore();
        });

        it("should call executeCommand with zowe.ds.addSession if the migration status is CreateConfigSelected", async () => {
            const blockMocks = getBlockMocks();
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            blockMocks.getValueMock.mockReturnValueOnce(Definitions.V1MigrationStatus.JustMigrated);
            blockMocks.setValueMock.mockImplementation();
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                value: {
                    getTeamConfig: jest.fn().mockReturnValue({ exists: false }),
                    onlyV1ProfilesExist: true,
                },
            });
            const v1ProfileOptsMock = jest.spyOn(ProfilesUtils as any, "v1ProfileOptions").mockResolvedValue(ProfilesConvertStatus.CreateNewSelected);
            await ProfilesUtils.handleV1MigrationStatus();
            expect(executeCommandMock.mock.lastCall?.[0]).toBe("zowe.ds.addSession");
            expect(v1ProfileOptsMock).toHaveBeenCalled();
            blockMocks.getValueMock.mockRestore();
            blockMocks.setValueMock.mockRestore();
        });

        it("should reload the window once if the user just migrated from v1", async () => {
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                value: {
                    readProfilesFromDisk: jest.fn(),
                    hasValidSchema: false,
                    getTeamConfig: () => ({
                        exists: false,
                    }),
                    onlyV1ProfilesExist: true,
                },
            });
            const getConfigurationMock = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
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
        });

        it("should not reload the window during migration if imperative.ProfileInfo.onlyV1ProfilesExist is false", async () => {
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                value: {
                    readProfilesFromDisk: jest.fn(),
                    hasValidSchema: false,
                    getTeamConfig: () => ({
                        exists: false,
                    }),
                    onlyV1ProfilesExist: false,
                },
            });
            const getConfigurationMock = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                persistent: true,
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn(),
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
        });

        it("should call v1ProfileOptions if team config does not exist and only v1 profiles exist", async () => {
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                value: {
                    readProfilesFromDisk: jest.fn(),
                    hasValidSchema: false,
                    getTeamConfig: () => ({
                        exists: false,
                    }),
                    onlyV1ProfilesExist: true,
                },
            });
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
        });

        it("should show the Create Config prompt when Create New is chosen", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.setValueMock.mockImplementation();
            const mockReadProfilesFromDisk = jest.fn();
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                value: {
                    readProfilesFromDisk: mockReadProfilesFromDisk,
                    getTeamConfig: jest.fn().mockReturnValue([]),
                    getAllProfiles: jest.fn().mockReturnValue([createValidIProfile(), createAltTypeIProfile()]),
                    onlyV1ProfilesExist: true,
                },
            });
            const msgSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New" as any);

            await expect((ProfilesUtils as any).v1ProfileOptions()).resolves.not.toThrow();
            expect(msgSpy).toHaveBeenCalled();
        });
    });

    describe("promptUserWithNoConfigs", () => {
        it("returns early if user was already prompted in this session", () => {
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", { value: true });
            const profInfoMock = jest.fn();
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            ProfilesUtils.promptUserWithNoConfigs();
            expect(profInfoMock).not.toHaveBeenCalled();
            noConfigDialogShownMock[Symbol.dispose]();
        });
        it("returns early if profileInfo is nullish", () => {
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", { value: false });
            const profInfoMock = jest.fn();
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            ProfilesUtils.promptUserWithNoConfigs();
            expect(profInfoMock).toHaveBeenCalled();
            expect(showMessageSpy).not.toHaveBeenCalled();
            noConfigDialogShownMock[Symbol.dispose]();
        });
        it("prompts the user if they don't have any Zowe client configs", () => {
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", { value: false });
            const profInfoMock = jest.fn().mockReturnValue({
                getTeamConfig: () => ({ exists: false }),
                onlyV1ProfilesExist: false,
            });
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            noConfigDialogShownMock[Symbol.dispose]();
        });
        it("executes zowe.ds.addSession if the user selects 'Create New' in the prompt", async () => {
            const profInfoMock = jest.fn().mockReturnValue({
                getTeamConfig: () => ({ exists: false }),
                onlyV1ProfilesExist: false,
            });
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", {
                configurable: true,
                value: false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockResolvedValue("Create New");
            const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
            ProfilesUtils.promptUserWithNoConfigs();
            expect(await showMessageSpy).toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            expect(executeCommandMock).toHaveBeenCalledWith("zowe.ds.addSession");
            executeCommandMock.mockRestore();
            noConfigDialogShownMock[Symbol.dispose]();
        });
        it("does not prompt the user if they have a Zowe team config", () => {
            const profInfoMock = jest.fn().mockReturnValue({
                getTeamConfig: () => ({ exists: true }),
                onlyV1ProfilesExist: false,
            });
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", {
                configurable: true,
                value: false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).not.toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            noConfigDialogShownMock[Symbol.dispose]();
        });
        it("does not prompt the user if they have v1 profiles", () => {
            const profInfoMock = jest.fn().mockReturnValue({
                getTeamConfig: () => ({ exists: false }),
                onlyV1ProfilesExist: true,
            });
            Object.defineProperty(ProfilesUtils, "mProfileInfo", {
                get: profInfoMock,
            });
            const noConfigDialogShownMock = new MockedProperty(ProfilesUtils, "noConfigDialogShown", {
                configurable: true,
                value: false,
            });
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            ProfilesUtils.promptUserWithNoConfigs();
            expect(showMessageSpy).not.toHaveBeenCalledWith(
                "No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration.",
                { items: ["Create New"] }
            );
            expect(profInfoMock).toHaveBeenCalled();
            noConfigDialogShownMock[Symbol.dispose]();
        });
    });

    describe("setupDefaultCredentialManager", () => {
        it("calls profileManagerWillLoad to load default credential manager", async () => {
            const profileManagerWillLoadSpy = jest.spyOn(imperative.ProfileInfo.prototype, "profileManagerWillLoad");
            await ProfilesUtils.setupDefaultCredentialManager();
            expect(profileManagerWillLoadSpy).toHaveBeenCalled();
        });

        it("prompts user to disable credential manager if default fails to load", async () => {
            const profileManagerWillLoadSpy = jest.spyOn(imperative.ProfileInfo.prototype, "profileManagerWillLoad").mockResolvedValueOnce(false);
            const disableCredMgmtSpy = jest.spyOn(ProfilesUtils, "disableCredentialManagement").mockImplementation();
            await ProfilesUtils.setupDefaultCredentialManager();
            expect(profileManagerWillLoadSpy).toHaveBeenCalled();
            expect(disableCredMgmtSpy).toHaveBeenCalled();
        });
    });

    describe("Profiles unit tests - function resolveTypePromise", () => {
        it("should resolve deferred promise for matching profile type", () => {
            const mockResolve = jest.spyOn(imperative.DeferredPromise.prototype, "resolve").mockReturnValueOnce();
            (ProfilesUtils as any).resolveTypePromise("zftp");
            expect(mockResolve).toHaveBeenCalledTimes(1);
        });
        it("should resolve an existing promise without setting it", () => {
            const mockResolve = jest.fn();
            (ProfilesUtils as any).extenderTypeReady.set("zftp", { resolve: mockResolve });
            (ProfilesUtils as any).resolveTypePromise("zftp");
            expect(mockResolve).toHaveBeenCalledTimes(1);
        });

        it("should resolve each deferred promise of matching profile type", () => {
            const extenderTypeReadySpy = jest.spyOn(ProfilesUtils.extenderTypeReady, "get");
            ProfilesUtils.resolveTypePromise("ssh");
            expect(extenderTypeReadySpy).toHaveBeenCalledTimes(1);
        });
        it("should resolve an existing promise without setting it", () => {
            jest.spyOn(ProfilesUtils.extenderTypeReady, "has").mockReturnValue(true);
            const extenderTypeReadySetSpy = jest.spyOn(ProfilesUtils.extenderTypeReady, "set");
            const mockDeferred: imperative.DeferredPromise<void> = {
                resolve: jest.fn(),
                reject: jest.fn(),
            } as any;

            const extenderTypeReadyGetSpy = jest.spyOn(ProfilesUtils.extenderTypeReady, "get").mockReturnValue(mockDeferred);

            ProfilesUtils.resolveTypePromise("ssh");
            expect(extenderTypeReadySetSpy).toHaveBeenCalledTimes(0);
            expect(extenderTypeReadyGetSpy).toHaveBeenCalledTimes(1);
        });
    });
});
