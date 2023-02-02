/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import {
    createISessionWithoutCredentials,
    createTreeView,
    createInputBox,
    createValidIProfile,
    createISession,
    createInstanceOfProfileInfo,
    createQuickPickItem,
    createQuickPickInstance,
    createConfigInstance,
    createConfigLoad,
} from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createProfileManager, newTestSchemas } from "../../__mocks__/mockCreators/profiles";
import * as vscode from "vscode";
import * as utils from "../../src/utils/ProfilesUtils";
import * as globals from "../../src/globals";
import * as zowe from "@zowe/cli";
import { Gui, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../src/Profiles";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { ZoweExplorerApiRegister } from "../../../zowe-explorer/src/ZoweExplorerApiRegister";

// jest.mock("vscode");
jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");

async function createGlobalMocks() {
    const newMocks = {
        log: zowe.imperative.Logger.getAppLogger(),
        mockShowInputBox: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockCreateQuickPick: createQuickPickInstance(),
        mockShowQuickPick: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockCreateInputBox: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        mockError: jest.fn(),
        mockConfigurationTarget: jest.fn(),
        mockCreateSessCfgFromArgs: jest.fn(),
        testProfile: createValidIProfile(),
        testSession: createISession(),
        mockCliProfileManager: createProfileManager(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        withProgress: null,
        mockCallback: null,
        mockUrlInfo: {
            valid: true,
            protocol: "https",
            host: "fake.com",
            port: 143,
        },
        mockProfileInstance: null,
        mockProfilesCache: null,
        mockConfigInstance: createConfigInstance(),
        mockConfigLoad: null,
    };

    newMocks.mockProfilesCache = new ProfilesCache(zowe.imperative.Logger.getAppLogger());
    newMocks.withProgress = jest.fn().mockImplementation((progLocation, callback) => {
        return newMocks.mockCallback;
    });

    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: newMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: newMocks.mockShowErrorMessage,
        configurable: true,
    });
    Object.defineProperty(Gui, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });

    Object.defineProperty(Gui, "createQuickPick", {
        value: jest.fn(() => {
            return newMocks.mockCreateQuickPick;
        }),
        configurable: true,
    });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
    Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
    Object.defineProperty(zowe.ZosmfSession, "createSessCfgFromArgs", {
        value: newMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: newMocks.mockGetConfiguration,
        configurable: true,
    });
    Object.defineProperty(vscode, "ConfigurationTarget", {
        value: newMocks.mockConfigurationTarget,
        configurable: true,
    });
    Object.defineProperty(vscode, "ProgressLocation", { value: newMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: newMocks.withProgress, configurable: true });

    newMocks.mockProfileInstance = new Profiles(newMocks.log);
    Object.defineProperty(Profiles, "CreateInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(newMocks.mockProfileInstance, "allProfiles", {
        value: [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }],
        configurable: true,
    });
    Object.defineProperty(newMocks.mockProfileInstance, "getProfileInfo", {
        value: jest.fn(() => {
            return createInstanceOfProfileInfo();
        }),
        configurable: true,
    });

    Object.defineProperty(zowe.imperative, "Config", {
        value: () => newMocks.mockConfigInstance,
        configurable: true,
    });
    newMocks.mockConfigLoad = Object.defineProperty(zowe.imperative.Config, "load", {
        value: jest.fn(() => {
            return createConfigLoad();
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "openTextDocument", {
        value: () => {},
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showTextDocument", {
        value: () => {},
        configurable: true,
    });

    return newMocks;
}

afterEach(() => {
    jest.clearAllMocks();
});

describe("Profiles Unit Test - Function createInstance", () => {
    const mockWorkspaceFolders = jest.fn();

    beforeAll(() => {
        // We need to create a persistent "vscode" mock that will apply for the
        // deferred requires in this test suite.
        const originalVscodeMock = jest.requireMock("vscode");
        jest.doMock("vscode", () => {
            Object.defineProperty(originalVscodeMock.workspace, "workspaceFolders", {
                get: mockWorkspaceFolders,
                configurable: true,
            });
            return originalVscodeMock;
        });
    });

    beforeEach(() => {
        // Reset module cache and re-require the Profiles API in each test
        // below. This ensures that the tests cover static properties defined
        // at import time in the zowe-explorer-api package.
        jest.resetModules();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should create instance when there is no workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue(undefined);
        const { Profiles: testProfiles } = require("../../src/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect((profilesInstance as any).cwd).toBeUndefined();
    });

    it("should create instance when there is empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([undefined]);
        const { Profiles: testProfiles } = require("../../src/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect((profilesInstance as any).cwd).toBeUndefined();
    });

    it("should create instance when there is non-empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([
            {
                uri: { fsPath: "fakePath" },
            },
        ]);
        const { Profiles: testProfiles } = require("../../src/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect((profilesInstance as any).cwd).toBe("fakePath");
    });
});

describe("Profiles Unit Tests - Function createNewConnection for v1 Profiles", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testSchemas: newTestSchemas(),
            inputBox: createInputBox("input"),
        };
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);

        return newMocks;
    }

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        const globalMocks = await createGlobalMocks();

        await Profiles.getInstance().createNewConnection("");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile name was not supplied. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileType is missing", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(globalMocks.mockProfileInstance, "getProfileType").mockImplementation(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, undefined);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No profile type was chosen. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        globalMocks.mockCreateInputBox.mockResolvedValue(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OS URL. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at username", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at password", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.name);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at rejectUnauthorized", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection("fake", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection throws an exception and shows a config error", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const mockSaveProfile = jest.spyOn(ProfilesCache.prototype as any, "saveProfile").mockImplementationOnce(async (values, name, type) => {
            throw new Error("saveProfile error");
        });
        const mockShowZoweConfigError = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockImplementation();

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await Profiles.getInstance().createNewConnection("fake", "zosmf");
        expect(mockSaveProfile).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage).not.toHaveBeenCalled();
        expect(errorHandlingSpy).toHaveBeenCalledWith("saveProfile error");
        expect(mockShowZoweConfigError).toHaveBeenCalledWith("saveProfile error");
    });

    it("Tests that createNewConnection returns 'fake' if the port is undefined and portInfo() returns correct port", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const customURLInfo = {
            valid: true,
            protocol: "https",
            host: "fake.com",
            port: undefined,
        };
        const port = 443;

        blockMocks.testSchemas.port.optionDefinition.defaultValue = undefined;

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(customURLInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "portInfo").mockReturnValueOnce(port);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe("fake");
    });

    it("Tests that createNewConnection returns undefined if the port is undefined and portInfo() returns NaN", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const customURLInfo = {
            valid: true,
            protocol: "https",
            host: "fake.com",
            port: undefined,
        };
        const port = "InvalidPort";

        blockMocks.testSchemas.port.optionDefinition.defaultValue = undefined;

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(customURLInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "portInfo").mockReturnValueOnce(port);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe(undefined);
    });

    it("Tests that createNewConnection enters default case when encoding is present in schema and value is the number 0", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);

        blockMocks.testSchemas["encoding"] = {
            type: "number",
            optionDefinition: {
                name: "encoding",
                aliases: ["ec"],
                description: "The encoding for download and upload of z/OS data set and USS files.",
                type: "string",
            },
        };

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe("fake");
    });

    it("Tests that createNewConnection enters default case when encoding is present in schema and value is NaN", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);

        blockMocks.testSchemas["encoding"] = {
            type: "number",
            optionDefinition: {
                name: "encoding",
                aliases: ["ec"],
                description: "The encoding for download and upload of z/OS data set and USS files.",
                type: "string",
                defaultValue: 3,
            },
        };

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe("fake");
    });
});

describe("Profiles Unit Tests - Function createZoweSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            testDatasetSessionNode: null,
            testDatasetTree: null,
            quickPickItem: createQuickPickItem(),
            qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        };
        newMocks.testDatasetSessionNode = createDatasetSessionNode(newMocks.session, globalMocks.mockProfileInstance);
        newMocks.testDatasetTree = createDatasetTree(newMocks.testDatasetSessionNode, newMocks.treeView);

        return newMocks;
    }
    it("Tests that createZoweSession presents correct message when escaping selection of quickpick", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const spy = jest.spyOn(Gui, "createQuickPick");
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSession(blockMocks.testDatasetTree);
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No selection made. Operation cancelled.");
        spy.mockClear();
    });
});

describe("Profiles Unit Tests - Function editZoweConfigFile", () => {
    it("Tests that editZoweConfigFile presents correct message when escaping selection of quickpick", async () => {
        const globalMocks = await createGlobalMocks();

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().editZoweConfigFile();
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Global is selected", async () => {
        const globalMocks = await createGlobalMocks();

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        spyQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory" as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyQuickPick).toBeCalled();
        expect(spyOpenFile).toBeCalledWith("file://globalPath/.zowe/zowe.config.json");
        spyQuickPick.mockClear();
        spyOpenFile.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when only Global config available", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockConfigLoad.load.mockResolvedValueOnce({
            layers: [
                {
                    path: "globalPath",
                    exists: true,
                    properties: undefined,
                    global: true,
                    user: false,
                },
            ],
        } as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyOpenFile).toBeCalledWith("globalPath");
        spyOpenFile.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Project is selected", async () => {
        const globalMocks = await createGlobalMocks();

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        spyQuickPick.mockResolvedValueOnce("Project: in the current working directory" as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyQuickPick).toBeCalled();
        expect(spyOpenFile).toBeCalledWith("file://projectPath/zowe.user.config.json");
        spyQuickPick.mockClear();
        spyOpenFile.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when only Project config available", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockConfigLoad.load.mockResolvedValueOnce({
            layers: [
                {
                    path: "projectPath",
                    exists: true,
                    properties: undefined,
                    global: false,
                    user: true,
                },
            ],
        } as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyOpenFile).toBeCalledWith("projectPath");
        spyOpenFile.mockClear();
    });
});

describe("Profiles Unit Tests - Function createZoweSchema", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            testDatasetSessionNode: null,
            testDatasetTree: null,
            quickPickItem: createQuickPickItem(),
            mockWsFolder: null,
            qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        };
        newMocks.testDatasetSessionNode = createDatasetSessionNode(newMocks.session, globalMocks.mockProfileInstance);
        newMocks.testDatasetTree = createDatasetTree(newMocks.testDatasetSessionNode, newMocks.treeView);
        Object.defineProperty(zowe, "getZoweDir", {
            value: jest.fn().mockReturnValue("file://globalPath/.zowe"),
            configurable: true,
        });
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: () => [{ uri: "file://projectPath/zowe.user.config.json", name: "zowe.user.config.json", index: 0 }],
            configurable: true,
        });

        return newMocks;
    }
    it("Tests that createZoweSchema presents correct message when escaping selection of config location prompt", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });
    it("Tests that createZoweSchema will open correct config file when cancelling creation in location with existing config file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory");
        const spyLayers = jest.spyOn(globalMocks.mockProfileInstance, "getConfigLayers");
        spyLayers.mockResolvedValueOnce(createConfigLoad().layers);
        const spyInfoMessage = jest.spyOn(vscode.window, "showInformationMessage");
        globalMocks.mockShowInformationMessage.mockResolvedValueOnce(undefined);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).toBeCalled();
        expect(spyInfoMessage).toBeCalled();
        expect(spyOpenFile).toBeCalled();

        spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyInfoMessage.mockClear();
        spyOpenFile.mockClear();
    });
    it("Test that createZoweSchema will open config on error if error deals with parsing file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory");
        const spyLayers = jest.spyOn(globalMocks.mockProfileInstance, "getConfigLayers");
        spyLayers.mockRejectedValueOnce(new Error("Error parsing JSON"));
        const spyZoweConfigError = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError");
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).toBeCalled();
        expect(spyZoweConfigError).toBeCalled();

        spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyZoweConfigError.mockClear();
    });
    it("Test that createZoweSchema will auto create global if VSC not in project and config doesn't exist", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: undefined,
            configurable: true,
        });

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        const spyLayers = jest.spyOn(globalMocks.mockProfileInstance, "getConfigLayers");
        spyLayers.mockResolvedValueOnce([
            {
                path: "file://projectPath/zowe.user.config.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ]);

        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).not.toBeCalled();

        spyQuickPick.mockClear();
        spyLayers.mockClear();
    });

    it("Tests that createZoweSchema will return the config file path", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: undefined,
            configurable: true,
        });
        jest.spyOn(globalMocks.mockProfileInstance, "checkExistingConfig").mockReturnValue("zowe");
        jest.spyOn(globalMocks.mockProfileInstance, "getConfigLayers").mockResolvedValueOnce([
            {
                path: "file://projectPath/zowe.user.config.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ]);

        Object.defineProperty(zowe, "getImperativeConfig", {
            value: jest.fn(() => ({
                profiles: [],
                baseProfile: {
                    type: "base",
                    schema: {
                        type: "object",
                        title: "Base profile",
                    },
                } as zowe.imperative.ICommandProfileTypeConfiguration,
            })),
            configurable: true,
        });

        Object.defineProperty(zowe.imperative.Config, "setSchema", {
            value: jest.fn(),
            configurable: true,
        });

        jest.spyOn(globalMocks.mockProfileInstance, "createNonSecureProfile").mockImplementation();

        await expect(Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree)).resolves.toBe("file:/globalPath/.zowe/zowe.config.json");
    });
});

describe("Profiles Unit Tests - function boolInfo", () => {
    it("should return true when first option selected", async () => {
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(Gui, "showQuickPick").mockImplementationOnce(() => {
            return Promise.resolve("True" as any);
        });

        await expect(
            privateProfile.boolInfo("rejectUnauthorized", {
                rejectUnauthorized: {
                    optionDefinition: {
                        description: "This is a test",
                    },
                },
            })
        ).resolves.toBe(true);
    });

    it("should return false when second option selected", async () => {
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(Gui, "showQuickPick").mockImplementationOnce(() => {
            return Promise.resolve("False" as any);
        });

        await expect(
            privateProfile.boolInfo("rejectUnauthorized", {
                rejectUnauthorized: {
                    optionDefinition: {
                        description: "This is a test",
                    },
                },
            })
        ).resolves.toBe(false);
    });

    it("should return undefined when none is selected", async () => {
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(Gui, "showQuickPick").mockImplementationOnce(() => {
            return Promise.resolve(undefined as any);
        });

        await expect(
            privateProfile.boolInfo("rejectUnauthorized", {
                rejectUnauthorized: {
                    optionDefinition: {
                        description: "This is a test",
                    },
                },
            })
        ).resolves.toBe(undefined);
    });
});

describe("Profiles Unit Tests - function optionsValue", () => {
    it("should return the value from option selected", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const expectedValue = {
            placeHolder: "This is a test",
            prompt: "This is a test",
        } as vscode.InputBoxOptions;
        const mockSchema = {
            rejectUnauthorized: {
                optionDefinition: {
                    description: "This is a test",
                },
            },
        };
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema)).resolves.toEqual(expectedValue);
    });
    it("should return the value from default value if available", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const expectedValue = {
            prompt: "This is a test",
            value: "This is a default value",
        } as vscode.InputBoxOptions;
        const mockSchema = {
            rejectUnauthorized: {
                optionDefinition: {
                    description: "This is a test",
                    defaultValue: "This is a default value",
                },
            },
        };
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema)).resolves.toEqual(expectedValue);
    });
    it("should return the value from input if passed in", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const expectedValue = {
            prompt: "This is a test",
            value: "inputTest",
        } as vscode.InputBoxOptions;
        const mockSchema = {
            rejectUnauthorized: {
                optionDefinition: {
                    description: "This is a test",
                },
            },
        };
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema, "inputTest")).resolves.toEqual(expectedValue);
    });
});

describe("Profiles Unit Tests - function checkType", () => {
    it("should return a string representing the type: 'string'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = ["string", 1, {}];
        await expect(privateProfile.checkType(mockInput)).resolves.toEqual("string");
    });
    it("should return a string representing the type: 'boolean'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = [false, 1, "boolean"];
        await expect(privateProfile.checkType(mockInput)).resolves.toEqual("boolean");
    });
    it("should return a string representing the type: 'number'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = [false, "number", {}];
        await expect(privateProfile.checkType(mockInput)).resolves.toEqual("number");
    });
    it("should return undefined if no input was passed in", async () => {
        const privateProfile = Profiles.getInstance() as any;
        await expect(privateProfile.checkType()).resolves.toEqual(undefined);
    });
});

describe("Profiles Unit Tests - function getUrl", () => {
    it("should return the parsed url with 'https://' prepended", () => {
        const privateProfile = Profiles.getInstance() as any;
        expect(privateProfile.getUrl("test.com")).toEqual("https://test.com");
    });
    it("should return the same url if 'https://' is already prepended", () => {
        const privateProfile = Profiles.getInstance() as any;
        expect(privateProfile.getUrl("https://test.com")).toEqual("https://test.com");
    });
    it("should return the parsed url with 'https://' if ':' is present but '//' is not", () => {
        const privateProfile = Profiles.getInstance() as any;
        expect(privateProfile.getUrl("localhost:3000")).toEqual("https://localhost:3000");
    });
});

describe("Profiles Unit Tests - function portInfo", () => {
    it("should return port number if valid port", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const expectedResult = 443;
        jest.spyOn(Gui, "showInputBox").mockReturnValueOnce("443" as any);
        await expect(
            privateProfile.portInfo("port", {
                port: {
                    optionDefinition: {
                        description: "port",
                        value: 443,
                    },
                },
            })
        ).resolves.toEqual(expectedResult);
    });
    it("should return port number and set default value for inputBox if present", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const expectedResult = 443;
        const inputBoxSpy = jest.spyOn(Gui, "showInputBox").mockReturnValueOnce("443" as any);
        await expect(
            privateProfile.portInfo("port", {
                port: {
                    optionDefinition: {
                        description: "port",
                        value: 443,
                        defaultValue: 443,
                    },
                },
            })
        ).resolves.toEqual(expectedResult);
        expect(inputBoxSpy).toHaveBeenCalledWith({
            prompt: "port",
            value: "443",
        });
        inputBoxSpy.mockClear();
    });
});

describe("Profiles Unit Tests - function ruInfo", () => {
    it("should return true and utilize the true prompt first", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const quickPickSpy = jest.spyOn(Gui, "showQuickPick").mockReturnValueOnce("True - Reject connections with self-signed certificates" as any);
        await expect(privateProfile.ruInfo(true)).resolves.toEqual(true);
        expect(quickPickSpy).toHaveBeenCalledWith(
            ["True - Reject connections with self-signed certificates", "False - Accept connections with self-signed certificates"],
            { canPickMany: false, ignoreFocusOut: true, placeHolder: "True - Reject connections with self-signed certificates" }
        );
        quickPickSpy.mockClear();
    });
    it("should return false and utilize the false prompt first", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const quickPickSpy = jest.spyOn(Gui, "showQuickPick").mockReturnValueOnce("False - Accept connections with self-signed certificates" as any);
        await expect(privateProfile.ruInfo(false)).resolves.toEqual(false);
        expect(quickPickSpy).toHaveBeenCalledWith(
            ["False - Accept connections with self-signed certificates", "True - Reject connections with self-signed certificates"],
            { canPickMany: false, ignoreFocusOut: true, placeHolder: "False - Accept connections with self-signed certificates" }
        );
        quickPickSpy.mockClear();
    });
});

describe("Profiles Unit Tests - function urlInfo", () => {
    it("should return the validated and parsed URL", async () => {
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(Gui, "showInputBox").mockReturnValueOnce("https://sample.com" as any);
        await expect(privateProfile.urlInfo("https://sample.com")).resolves.toEqual({ host: "sample.com", port: 0, protocol: null, valid: true });
    });
});

describe("Profiles Unit Tests - function getProfileIcon", () => {
    it("should retrieve the profile icon successfully", () => {
        const privateProfile = Profiles.getInstance() as any;
        expect(
            privateProfile.getProfileIcon([
                {
                    global: "test",
                },
                {
                    user: "test",
                },
            ])
        ).toEqual(["$(home)", "$(folder)"]);
    });
});

describe("Profiles Unit Tests - function promptCredentials", () => {
    it("should return the user credentials", async () => {
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            isSecured: () => false,
        } as any);
        jest.spyOn(ZoweVsCodeExtension, "updateCredentials").mockResolvedValue({
            profile: {
                user: "test",
                password: "12345",
                base64EncodedAuth: "encodedAuth",
            } as zowe.imperative.IProfile,
        } as zowe.imperative.IProfileLoaded);
        jest.spyOn(Profiles.getInstance(), "updateProfilesArrays").mockImplementation();
        await expect(Profiles.getInstance().promptCredentials("secure_config_props")).resolves.toEqual(["test", "12345", "encodedAuth"]);
    });
});

describe("Profiles Unit Tests - function getDeleteProfile", () => {
    it("should return the list of profiles cached excluding the now deleted profile", async () => {
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(Profiles.getInstance(), "allProfiles", {
            value: [
                {
                    name: "test1",
                    user: "test1",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as zowe.imperative.IProfileLoaded,
                {
                    name: "test2",
                    user: "test2",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as zowe.imperative.IProfileLoaded,
            ],
            configurable: true,
        });
        jest.spyOn(Gui, "showQuickPick").mockResolvedValue("test2" as any);
        await expect(privateProfile.getDeleteProfile()).resolves.toEqual({
            name: "test2",
            user: "test2",
            password: "123",
            message: "",
            type: "",
            failNotFound: false,
        });
    });
    it("should show a message saying 'No profiles available'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(Profiles.getInstance(), "allProfiles", {
            value: [],
            configurable: true,
        });
        const showMessageSpy = jest.spyOn(Gui, "showMessage");
        await expect(privateProfile.getDeleteProfile()).resolves.toEqual(undefined);
        expect(showMessageSpy).toBeCalledWith("No profiles available");
    });
    it("should show a message saying 'Operation Cancelled'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(Profiles.getInstance(), "allProfiles", {
            value: [
                {
                    name: "test1",
                    user: "test1",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as zowe.imperative.IProfileLoaded,
                {
                    name: "test2",
                    user: "test2",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as zowe.imperative.IProfileLoaded,
            ],
            configurable: true,
        });
        const showMessageSpy = jest.spyOn(Gui, "showMessage");
        jest.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);
        await expect(privateProfile.getDeleteProfile()).resolves.toEqual(undefined);
        expect(showMessageSpy).toBeCalledWith("Operation Cancelled");
    });
});

describe("Profiles Unit Tests - function validateProfile", () => {
    it("should return an object with profile validation status if validated profiles exist", async () => {
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [
                {
                    name: "test1",
                    message: "",
                    type: "",
                    status: "active",
                    failNotFound: false,
                },
            ],
            configurable: true,
        });
        jest.spyOn(Gui, "withProgress").mockResolvedValue(undefined);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockResolvedValueOnce({
            getStatus: () => "active",
        } as never);
        await expect(
            Profiles.getInstance().validateProfiles({
                name: "test1",
                message: "",
                type: "",
                failNotFound: false,
            })
        ).resolves.toEqual({
            name: "test1",
            status: "active",
        });
    });
    it("should return an object with profile validation status of 'active' from session status if validated profiles does not exist", async () => {
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [],
            configurable: true,
        });
        jest.spyOn(Gui, "withProgress").mockResolvedValue("active");
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockResolvedValueOnce({
            getStatus: () => "active",
        } as never);
        await expect(
            Profiles.getInstance().validateProfiles({
                name: "test1",
                message: "",
                type: "",
                failNotFound: false,
            })
        ).resolves.toEqual({
            name: "test1",
            status: "active",
        });
    });
    it("should return an object with profile validation status of 'inactive' from session status if validated profiles does not exist", async () => {
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [],
            configurable: true,
        });
        jest.spyOn(Gui, "withProgress").mockResolvedValue("inactive");
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockResolvedValueOnce({
            getStatus: () => "inactive",
        } as never);
        await expect(
            Profiles.getInstance().validateProfiles({
                name: "test1",
                message: "",
                type: "",
                failNotFound: false,
            })
        ).resolves.toEqual({
            name: "test1",
            status: "inactive",
        });
    });
    it("should handle the error if call to getStatus fails", async () => {
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [],
            configurable: true,
        });
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");
        const testError = new Error("failed to validate profile");
        jest.spyOn(Gui, "withProgress").mockImplementation(() => {
            throw testError;
        });
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockResolvedValueOnce({
            getStatus: () => "inactive",
        } as never);
        await Profiles.getInstance().validateProfiles({
            name: "test1",
            message: "",
            type: "",
            failNotFound: false,
        });
        expect(errorHandlingSpy).toBeCalledWith(testError, "test1");
    });
    it("should return an object with profile validation status of 'unverified' from session status if validated profiles doesn't exist", async () => {
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [],
            configurable: true,
        });
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockResolvedValueOnce({
            getStatus: undefined,
        } as never);
        await expect(
            Profiles.getInstance().validateProfiles({
                name: "test1",
                message: "",
                type: "",
                failNotFound: false,
            })
        ).resolves.toEqual({
            name: "test1",
            status: "unverified",
        });
    });
});
