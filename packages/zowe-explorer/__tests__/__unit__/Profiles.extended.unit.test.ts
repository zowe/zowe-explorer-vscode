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
    createTeamConfigMock,
    createUnsecureTeamConfigMock,
    createMockNode,
} from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createProfileManager, newTestSchemas } from "../../__mocks__/mockCreators/profiles";
import * as vscode from "vscode";
import * as utils from "../../src/utils/ProfilesUtils";
import * as globals from "../../src/globals";
import * as zowe from "@zowe/cli";
import { Gui, IProfileValidation, ProfilesCache, ZoweTreeNode, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../src/Profiles";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { ZoweExplorerApiRegister } from "../../../zowe-explorer/src/ZoweExplorerApiRegister";
import { createUSSNode, createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createIJobObject, createJobsTree } from "../../__mocks__/mockCreators/jobs";
import * as path from "path";
import { SettingsConfig } from "../../src/utils/SettingsConfig";
import { ZoweLogger } from "../../src/utils/LoggerUtils";
import { TreeProviders } from "../../src/shared/TreeProviders";
import { ProfileManagement } from "../../src/utils/ProfileManagement";

jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");

function createGlobalMocks() {
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
        testTeamConfigProfile: createTeamConfigMock(),
        testUnsecureTeamConfigProfile: createUnsecureTeamConfigMock(),
        testUSSTree: null,
        testNode: createMockNode("test", globals.DS_SESSION_CONTEXT),
        testSession: createISession(),
        mockCliProfileManager: createProfileManager(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        mockUrlInfo: {
            valid: true,
            protocol: "https",
            host: "fake.com",
            port: 143,
        },
        mockProfileInstance: null,
        mockConfigInstance: createConfigInstance(),
        mockConfigLoad: null,
    };

    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        }),
        configurable: true,
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
    Object.defineProperty(zowe.ZosmfSession, "createSessCfgFromArgs", {
        value: newMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: newMocks.mockGetConfiguration,
        configurable: true,
    });
    Object.defineProperty(vscode, "ConfigurationTarget", {
        value: newMocks.mockConfigurationTarget,
        configurable: true,
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    newMocks.mockProfileInstance = new Profiles(newMocks.log);
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
    Object.defineProperty(newMocks.mockProfileInstance, "loginWithRegularProfile", {
        value: jest.fn(() => {
            return true;
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

    newMocks.testUSSTree = createUSSTree(undefined, [createUSSNode(newMocks.testSession, newMocks.testProfile)], createTreeView());

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
        expect(profilesInstance.cwd).toBeUndefined();
    });

    it("should create instance when there is empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([undefined]);

        const { Profiles: testProfiles } = require("../../src/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBeUndefined();
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
        expect(profilesInstance.cwd).toBe("fakePath");
    });

    it("Tests that createInstance catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Profiles.prototype, "refresh").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.createInstance(globalMocks.log)).resolves.not.toThrow();
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - Function createNewConnection for v1 Profiles", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testSchemas: newTestSchemas(),
            inputBox: createInputBox("input"),
        };
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);

        return newMocks;
    }

    beforeEach(() => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);
    });

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        const globalMocks = createGlobalMocks();

        await Profiles.getInstance().createNewConnection("");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileType is missing", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globalMocks.mockProfileInstance, "getProfileType").mockImplementation(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, undefined);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        globalMocks.mockCreateInputBox.mockResolvedValue(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at username", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at password", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.name);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if user escapes create at rejectUnauthorized", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(utils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValue(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection("fake", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection throws an exception and shows a config error", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testError = new Error("saveProfile error");

        const mockSaveProfile = jest.spyOn(ProfilesCache.prototype as any, "saveProfile").mockImplementationOnce(async (_values, _name, _type) => {
            throw testError;
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
        expect(errorHandlingSpy).toHaveBeenCalledWith(testError, "fake");
        expect(mockShowZoweConfigError).toHaveBeenCalledWith("saveProfile error");
    });

    it("Tests that createNewConnection returns 'fake' if the port is undefined and portInfo() returns correct port", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        jest.spyOn(utils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(utils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(utils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");
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

    it("Tests that createNewConnection enters default case when boolean is present in schema and returns undefined", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);
        jest.spyOn(globalMocks.mockProfileInstance, "boolInfo").mockReturnValueOnce(undefined);
        jest.spyOn(Gui, "showMessage").mockImplementationOnce(async () => {
            return "";
        });

        blockMocks.testSchemas["encoding"] = {
            type: "boolean",
            optionDefinition: {
                name: "someBoolean",
                aliases: ["sb"],
                description: "test for some boolean value",
                type: "boolean",
                defaultValue: undefined,
            },
        };

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe(undefined);
    });

    it("Tests that createNewConnection enters default case when string is present in schema and returns 'fake'", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(utils.ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");
        jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValueOnce(blockMocks.testSchemas);
        jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValueOnce(globalMocks.mockUrlInfo);
        jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValueOnce(globalMocks.testProfile.profile.user);
        jest.spyOn(globalMocks.mockProfileInstance, "passwordInfo").mockReturnValueOnce(globalMocks.testProfile.profile.password);
        jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValueOnce(false);
        jest.spyOn(globalMocks.mockProfileInstance, "boolInfo").mockReturnValueOnce(undefined);
        jest.spyOn(Gui, "showInputBox").mockImplementationOnce(async () => {
            return "test";
        });

        blockMocks.testSchemas["encoding"] = {
            type: "string",
            optionDefinition: {
                name: "someString",
                aliases: ["ss"],
                description: "test for some string value",
                type: "string",
                defaultValue: undefined,
            },
        };

        await expect(Profiles.getInstance().createNewConnection("fake", "zosmf")).resolves.toBe("fake");
    });
});

describe("Profiles Unit Tests - Function createZoweSession", () => {
    function createBlockMocks(globalMocks) {
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const spy = jest.spyOn(Gui, "createQuickPick");
        const spyDebug = jest.spyOn(ZoweLogger, "debug");
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSession(blockMocks.testDatasetTree);
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile selection has been cancelled.");
        expect(spyDebug).toBeCalledWith("Profile selection has been cancelled.");
        spy.mockClear();
        spyDebug.mockClear();
    });

    it("Tests that createZoweSession runs successfully", async () => {
        const globalMocks = createGlobalMocks();
        const spyInfo = jest.spyOn(ZoweLogger, "info");
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new utils.FilterDescriptor("Test1"));
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new utils.FilterDescriptor("Test2"));
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getAllProfiles: jest.fn().mockReturnValue([]),
            usingTeamConfig: false,
        } as any);
        jest.spyOn(Gui, "showInputBox").mockResolvedValue("test");
        jest.spyOn(Profiles.getInstance(), "createNewConnection").mockResolvedValue("Test");
        const refreshSpy = jest.spyOn(Profiles.getInstance(), "refresh").mockImplementation();
        jest.spyOn(ProfileManagement, "handleChangeForAllTrees").mockResolvedValue(true);
        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({
            ds: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testUSSTree.mSessionNodes], refresh: jest.fn() } as any,
            uss: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testUSSTree.mSessionNodes], refresh: jest.fn() } as any,
            job: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testUSSTree.mSessionNodes], refresh: jest.fn() } as any,
        });
        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(refreshSpy).toBeCalledTimes(1);
        expect(spyInfo).toBeCalledWith("New profile created, test.");
        refreshSpy.mockClear();
        spyInfo.mockClear();
        jest.spyOn(Gui, "resolveQuickPick").mockReset();
    });

    it("Tests that createZoweSession runs successfully and uses the chosenProfile", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "test" });
        const spyInfo = jest.spyOn(ZoweLogger, "info");
        jest.spyOn(ProfileManagement, "handleChangeForAllTrees").mockResolvedValue(true);
        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(spyInfo).toBeCalledWith("The profile test has been added to the zowe.uss.history tree.");
        spyInfo.mockClear();
    });

    it("Tests that createZoweSession catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new utils.FilterDescriptor("Test"));
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - Function editZoweConfigFile", () => {
    it("Tests that editZoweConfigFile presents correct message when escaping selection of quickpick", async () => {
        const globalMocks = createGlobalMocks();

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().editZoweConfigFile();
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Global is selected", async () => {
        const globalMocks = createGlobalMocks();

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
        const globalMocks = createGlobalMocks();
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
        const globalMocks = createGlobalMocks();

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
        const globalMocks = createGlobalMocks();
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
    function createBlockMocks(globalMocks) {
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);
        expect(spy).toBeCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });
    it("Tests that createZoweSchema will open correct config file when cancelling creation in location with existing config file", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        Object.defineProperty(globals, "ISTHEIA", { value: true, configurable: true });
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
        const expectedValue =
            process.platform === "win32"
                ? "file:\\globalPath\\.zowe\\zowe.config.json"
                : "file:/globalPath/.zowe/zowe.config.json".split(path.sep).join(path.posix.sep);

        await expect(Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree)).resolves.toBe(expectedValue);
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
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema)).toEqual(expectedValue);
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
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema)).toEqual(expectedValue);
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
        await expect(privateProfile.optionsValue("rejectUnauthorized", mockSchema, "inputTest")).toEqual(expectedValue);
    });
});

describe("Profiles Unit Tests - function checkType", () => {
    it("should return a string representing the type: 'string'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = ["string", 1, {}];
        await expect(privateProfile.checkType(mockInput)).toEqual("string");
    });
    it("should return a string representing the type: 'boolean'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = [false, 1, "boolean"];
        await expect(privateProfile.checkType(mockInput)).toEqual("boolean");
    });
    it("should return a string representing the type: 'number'", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const mockInput = [false, "number", {}];
        await expect(privateProfile.checkType(mockInput)).toEqual("number");
    });
    it("should return undefined if no input was passed in", async () => {
        const privateProfile = Profiles.getInstance() as any;
        await expect(privateProfile.checkType()).toEqual(undefined);
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
        await expect(privateProfile.urlInfo("https://sample.com")).resolves.toEqual({ host: "sample.com", port: 0, protocol: "https", valid: true });
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
            } as zowe.imperative.IProfile,
        } as zowe.imperative.IProfileLoaded);
        jest.spyOn(Profiles.getInstance(), "updateProfilesArrays").mockImplementation();
        await expect(Profiles.getInstance().promptCredentials("secure_config_props")).resolves.toEqual(["test", "12345"]);
    });

    it("Tests that promptCredentials catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().promptCredentials(globalMocks.testProfile)).resolves.not.toThrow();
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
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
    function createBlockMocks() {
        createGlobalMocks();
        const newMocks = {
            profilesForValidation: [] as IProfileValidation[],
            getStatusSpy: jest.fn(),
        };

        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            get: () => newMocks.profilesForValidation,
            configurable: true,
        });
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValueOnce({
            getStatus: newMocks.getStatusSpy,
        } as never);

        return newMocks;
    }

    it("should return an object with profile validation status if validated profiles exist", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.profilesForValidation.push({
            name: "test1",
            status: "active",
        });
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
        expect(blockMocks.getStatusSpy).not.toHaveBeenCalled();
    });
    it("should return an object with profile validation status of 'active' from session status if validated profiles does not exist", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.getStatusSpy.mockResolvedValue("active");
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
        expect(blockMocks.getStatusSpy).toHaveBeenCalledTimes(1);
    });
    it("should return an object with profile validation status of 'inactive' from session status if validated profiles does not exist", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.getStatusSpy.mockResolvedValue("inactive");
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
        expect(blockMocks.getStatusSpy).toHaveBeenCalledTimes(1);
    });
    it("should handle the error if call to getStatus fails", async () => {
        const blockMocks = createBlockMocks();
        const testError = new Error("failed to validate profile");
        blockMocks.getStatusSpy.mockImplementation(() => {
            throw testError;
        });
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");
        await Profiles.getInstance().validateProfiles({
            name: "test1",
            message: "",
            type: "",
            failNotFound: false,
        });
        expect(errorHandlingSpy).toHaveBeenCalledWith(testError, "test1");
    });
    it("should return an object with profile validation status of 'unverified' from session status if validated profiles doesn't exist", async () => {
        createBlockMocks();
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

describe("Profiles Unit Tests - function deleteProfile", () => {
    it("should delete profile", async () => {
        const globalMocks = createGlobalMocks();

        const datasetSessionNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, globalMocks.testProfile);
        const ussSessionNode = [createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile)];
        const ussTree = createUSSTree([], ussSessionNode);
        const jobsTree = createJobsTree(globalMocks.testSession, createIJobObject(), globalMocks.testProfile, createTreeView());

        jest.spyOn(datasetTree, "getFileHistory").mockReturnValue(["[SESTEST]: TEST.LIST"]);
        jest.spyOn(ussTree, "getFileHistory").mockReturnValue(["[SESTEST]: /u/test/test.txt"]);

        const testNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        testNode.setProfileToChoice(globalMocks.testProfile);
        testNode.contextValue = "session server";

        jest.spyOn(Profiles.getInstance() as any, "deletePrompt").mockReturnValue("success");
        jest.spyOn(SettingsConfig, "setDirectValue").mockImplementation();

        // mock DS call to vs code settings
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            persistence: true,
            favorites: ["test"],
            history: [],
            sessions: ["test", "test1", "test2"],
            fileHistory: ["[TEST]: TEST.LIST"],
            searchHistory: ["TEST.*"],
        });

        // mock USS call to vs code settings
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            persistence: true,
            favorites: ["test"],
            history: [],
            sessions: ["test", "test1", "test2"],
            fileHistory: ["[TEST]: /u/test/test.txt"],
            searchHistory: ["/u/test"],
        });

        // mock Jobs call to vs code settings
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            persistence: true,
            favorites: ["test"],
            history: [],
            sessions: ["test", "test1", "test2"],
            fileHistory: ["TEST"],
            searchHistory: ["Owner:TEST Prefix:*"],
        });

        await expect(Profiles.getInstance().deleteProfile(datasetTree, ussTree, jobsTree, testNode)).resolves.not.toThrow();
    });

    it("Tests that deleteProfile catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        const datasetSessionNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, globalMocks.testProfile);
        const ussSessionNode = [createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile)];
        const ussTree = createUSSTree([], ussSessionNode);
        const jobsTree = createJobsTree(globalMocks.testSession, createIJobObject(), globalMocks.testProfile, createTreeView());

        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Profiles.getInstance(), "getDeleteProfile").mockResolvedValue(globalMocks.testProfile);
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().deleteProfile(datasetTree, ussTree, jobsTree)).resolves.not.toThrow();
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - function checkCurrentProfile", () => {
    const environmentSetup = (globalMocks): void => {
        globalMocks.testProfile.profile.password = null;
        globalMocks.testProfile.profile.tokenType = "";
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [
                {
                    name: "sestest",
                    message: "",
                    type: "",
                    status: "active",
                    failNotFound: false,
                },
            ],
            configurable: true,
        });
        Object.defineProperty(Profiles.getInstance(), "profilesValidationSetting", {
            value: [
                {
                    name: "otherSestest",
                    setting: false,
                },
            ],
            configurable: true,
        });
    };

    const setupProfilesCheck = (globalMocks): void => {
        jest.spyOn(Profiles.getInstance(), "getDefaultProfile").mockReturnValue({ name: "base" } as any);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: {
                    profiles: {
                        sestest: { ...globalMocks.testProfile.profile, secure: [] },
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
        } as any);
        jest.spyOn(Profiles.getInstance(), "getLoadedProfConfig").mockResolvedValue(globalMocks.testProfile);
        jest.spyOn(Profiles.getInstance(), "getSecurePropsForProfile").mockResolvedValue([]);
    };

    it("should show as active in status of profile using basic auth", async () => {
        const globalMocks = createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "validateProfiles").mockResolvedValue({ status: "active", name: "sestest" });
        const promptCredentialsSpy = jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValueOnce(["sestest", "12345"]);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "active" });
        expect(promptCredentialsSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as active in status of profile using token auth", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        const ssoLoginSpy = jest.spyOn(Profiles.getInstance(), "ssoLogin").mockResolvedValueOnce();
        jest.spyOn(Profiles.getInstance(), "loadNamedProfile").mockReturnValueOnce(globalMocks.testProfile);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "active" });
        expect(ssoLoginSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as unverified in status of profile", async () => {
        const globalMocks = createGlobalMocks();
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "validateProfiles").mockResolvedValue({ status: "unverified", name: "sestest" });
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
    });
    it("should show as inactive in status of profile", async () => {
        const globalMocks = createGlobalMocks();
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "validateProfiles").mockResolvedValue({ status: "inactive", name: "sestest" });
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "inactive" });
    });
    it("should show as unverified if using basic auth and has expired password", async () => {
        const globalMocks = createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling").mockImplementation();
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockRejectedValueOnce(new Error("Failed to login"));
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as unverified if using token auth and is logged out or has expired token", async () => {
        const globalMocks = createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling").mockImplementation();
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as unverified if profiles fail to load", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - function editSession", () => {
    it("should successfully return the edited session", async () => {
        const globalMocks = createGlobalMocks();
        const testSchema = newTestSchemas();
        testSchema["encoding"] = {
            type: "string",
            optionDefinition: {
                name: "encoding",
                aliases: ["ec"],
                description: "The encoding for download and upload of z/OS data set and USS files.",
                type: "string",
            },
        };
        testSchema["isTest"] = {
            type: "boolean",
            optionDefinition: {
                name: "isTest",
                aliases: ["it"],
                description: "is this a test",
                type: "boolean",
            },
        };
        testSchema["numberTest"] = {
            type: "number",
            optionDefinition: {
                name: "numberTest",
                aliases: ["nt"],
                description: "number test",
                type: "number",
            },
        };

        // mock user inputs for new session info
        jest.spyOn(Profiles.getInstance(), "loadNamedProfile").mockReturnValue(globalMocks.testProfile);
        jest.spyOn(Profiles.getInstance(), "getSchema").mockReturnValue(testSchema);
        jest.spyOn(Profiles.getInstance() as any, "urlInfo").mockResolvedValue({ host: "newTest", port: undefined } as any);
        jest.spyOn(Profiles.getInstance() as any, "portInfo").mockResolvedValue(4321);
        jest.spyOn(Profiles.getInstance() as any, "userInfo").mockResolvedValue("newUser");
        jest.spyOn(Profiles.getInstance() as any, "passwordInfo").mockResolvedValue("newPass");
        jest.spyOn(Profiles.getInstance() as any, "ruInfo").mockResolvedValue(false);
        jest.spyOn(Profiles.getInstance() as any, "boolInfo").mockResolvedValue(true);
        jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("utf-8");
        jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("4321");
        jest.spyOn(Gui, "showMessage").mockImplementation();

        jest.spyOn(zowe.ZosmfSession, "createSessCfgFromArgs").mockReturnValue({
            host: "newTest",
            port: 4321,
            user: "newUser",
            password: "newPass",
            rejectUnauthorized: false,
            base64EncodedAuth: "base64Auth",
        } as any);

        await expect(Profiles.getInstance().editSession(globalMocks.testProfile, "sestest")).resolves.toEqual({
            name: "sestest",
            host: "newTest",
            port: 4321,
            user: "newUser",
            password: "newPass",
            rejectUnauthorized: false,
            encoding: "utf-8",
            isTest: true,
            numberTest: 4321,
            base64EncodedAuth: "base64Auth",
        });
    });

    it("Tests that editSession catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().editSession(globalMocks.testProfile, globalMocks.testProfile.name)).resolves.not.toThrow();
        expect(errorSpy).toBeCalledTimes(1);
        expect(errorSpy).toBeCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - function getProfileSetting", () => {
    it("should retrive the profile with a status of unverified", async () => {
        const globalMocks = createGlobalMocks();
        Object.defineProperty(Profiles.getInstance(), "profilesValidationSetting", {
            value: [
                {
                    name: "sestest",
                    setting: false,
                },
                {
                    name: "sestest2",
                    setting: false,
                },
            ],
            configurable: true,
        });
        Object.defineProperty(Profiles.getInstance(), "profilesForValidation", {
            value: [
                {
                    name: "sestest",
                    message: "",
                    type: "",
                    status: "active",
                    failNotFound: false,
                },
                {
                    name: "sestest",
                    message: "",
                    type: "",
                    status: "unverified",
                    failNotFound: false,
                },
            ],
            configurable: true,
        });

        await expect(Profiles.getInstance().getProfileSetting(globalMocks.testProfile)).resolves.toEqual({
            name: "sestest",
            status: "unverified",
        });
    });
});

describe("Profiles Unit Tests - function disableValidationContext", () => {
    it("should disable validation context and return updated node", async () => {
        const globalMocks = createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const testNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        // Mimic scenario for toggling validation (branch 1)
        testNode.contextValue = globals.VALIDATE_SUFFIX;
        await Profiles.getInstance().disableValidationContext(testNode);
        expect(testNode.contextValue).toContain(globals.NO_VALIDATE_SUFFIX);

        // Mimic scenario where validation is already disabled, but function was called again (branch 2)
        const prevContext = testNode.contextValue;
        await Profiles.getInstance().disableValidationContext(testNode);
        expect(prevContext).toBe(testNode.contextValue);

        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Profiles Unit Tests - function enableValidationContext", () => {
    it("should enable validation context and return updated node", async () => {
        const globalMocks = createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const testNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );
        // Mimic scenario for toggling validation (branch 1)
        testNode.contextValue = globals.NO_VALIDATE_SUFFIX;
        await Profiles.getInstance().enableValidationContext(testNode);
        expect(testNode.contextValue).toContain(globals.VALIDATE_SUFFIX);

        // Mimic scenario where validation is already enabled, but function was called again (branch 2)
        const prevContext = testNode.contextValue;
        await Profiles.getInstance().enableValidationContext(testNode);
        expect(prevContext).toBe(testNode.contextValue);

        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Profiles Unit Tests - function ssoLogin", () => {
    let testNode;
    let globalMocks;
    beforeEach(async () => {
        globalMocks = createGlobalMocks();
        testNode = new (ZoweTreeNode as any)(
            "fake",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );
        testNode.profile.profile.password = undefined;
        testNode.profile.profile.user = "fake";
        Object.defineProperty(Profiles.getInstance(), "allProfiles", {
            value: [
                {
                    name: "fake",
                },
            ],
            configurable: true,
        });
        Object.defineProperty(utils.ProfilesUtils, "isProfileUsingBasicAuth", { value: jest.fn(), configurable: true });
        jest.spyOn(Gui, "showMessage").mockImplementation();
    });
    it("should perform an SSOLogin successfully while fetching the base profile", async () => {
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => zowe.imperative.SessConstants.TOKEN_TYPE_APIML,
            login: () => "ajshdlfkjshdalfjhas",
        } as never);
        jest.spyOn(Profiles.getInstance() as any, "loginCredentialPrompt").mockReturnValue(["fake", "12345"]);
        jest.spyOn(Profiles.getInstance() as any, "updateBaseProfileFileLogin").mockImplementation();
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
    });
    it("should perform an SSOLogin successfully while fetching from session", async () => {
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "tokenType",
            login: () => "ajshdlfkjshdalfjhas",
            getSession: () => globalMocks.testSession,
        } as never);
        jest.spyOn(Profiles.getInstance() as any, "loginCredentialPrompt").mockReturnValue(["fake", "12345"]);
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
    });
    it("should catch error getting token type and log warning", async () => {
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValueOnce({
            getTokenTypeName: () => {
                throw new Error("test error.");
            },
            login: () => "ajshdlfkjshdalfjhas",
        } as never);
        const warnSpy = jest.spyOn(ZoweLogger, "warn");
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
        expect(warnSpy).toBeCalledWith(Error("test error."));
        warnSpy.mockClear();
    });
    it("should catch error during login and log error", async () => {
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => zowe.imperative.SessConstants.TOKEN_TYPE_APIML,
            login: () => "ajshdlfkjshdalfjhas",
        } as never);
        const loginBaseProfMock = jest.spyOn(ZoweVsCodeExtension, "loginWithBaseProfile").mockRejectedValueOnce(new Error("test error."));
        jest.spyOn(Profiles.getInstance() as any, "loginCredentialPrompt").mockReturnValue(["fake", "12345"]);
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockClear();
        loginBaseProfMock.mockRestore();
    });
});

describe("Profiles Unit Tests - function handleSwitchAuthentication", () => {
    let testNode;
    let globalMocks;
    let modifiedTestNode;

    afterEach(() => {
        jest.resetAllMocks();
    });

    beforeEach(async () => {
        globalMocks = createGlobalMocks();
        testNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        modifiedTestNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );
    });

    it("To switch from Basic to Token-based authentication using Base Profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
            mergeArgsForProfile: jest.fn().mockReturnValue({
                knownArgs: [
                    {
                        argName: "user",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                    {
                        argName: "password",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                ],
            }),
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testToken",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);

        jest.spyOn(ZoweVsCodeExtension, "loginWithBaseProfile").mockResolvedValue(true);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.showMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To check login fail's when trying to switch from Basic to Token-based authentication using Base Profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);

        jest.spyOn(ZoweVsCodeExtension, "loginWithBaseProfile").mockResolvedValue(false);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Basic to Token-based authentication using Regular Profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
            mergeArgsForProfile: jest.fn().mockReturnValue({
                knownArgs: [
                    {
                        argName: "user",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                    {
                        argName: "password",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                ],
            }),
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testToken",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "jwtToken",
        } as never);
        jest.spyOn(Profiles.getInstance() as any, "loginWithRegularProfile").mockResolvedValue(true);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.showMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To check login fail's when trying to switch from Basic to Token-based authentication using Regular Profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "***",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "jwtToken",
        } as never);
        jest.spyOn(Profiles.getInstance() as any, "loginWithRegularProfile").mockResolvedValue(false);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Token-based to Basic authentication when cred values are passed involving base profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                        jsonLoc: "jsonLoc",
                    },
                },
                {
                    profName: "base",
                    profLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
                },
            ],
            mergeArgsForProfile: jest.fn().mockReturnValue({
                knownArgs: [
                    {
                        argName: "user",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                    {
                        argName: "password",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                ],
            }),
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "6789",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(["testUser", "6789"]);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.showMessage).toBeCalled();
        expect(Gui.showMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Token-based to Basic authentication when cred values are passed involving regular profile", async () => {
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
            mergeArgsForProfile: jest.fn().mockReturnValue({
                knownArgs: [
                    {
                        argName: "user",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                    {
                        argName: "password",
                        dataType: "string",
                        argValue: "fake",
                        argLoc: { jsonLoc: "jsonLoc" },
                    },
                ],
            }),
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: "testUser",
            password: "6789",
            tokenType: undefined,
            tokenValue: undefined,
            secure: ["user", "password"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "jwtToken",
        } as never);
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(["testUser", "6789"]);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.showMessage).toBeCalled();
        expect(Gui.showMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To not switch from Token-based to Basic authentication when cred values are not passed", async () => {
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: () => ({
                properties: jest.fn(),
                set: jest.fn(),
                delete: jest.fn(),
                save: jest.fn(),
            }),
            getAllProfiles: () => [
                {
                    profName: "sestest",
                    profLoc: {
                        osLoc: ["test"],
                    },
                },
            ],
        } as any);
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(undefined);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toBeCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To not perform switching the authentication for a profile which does not support token-based authentication", async () => {
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => {
                throw new Error("test error.");
            },
        } as never);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toBeCalled();
    });

    it("To not perform switching the authentication when authentication method is unknown", async () => {
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(utils.ProfilesUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(false);
        jest.spyOn(utils.ProfilesUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toBeCalled();
    });

    it("To not perform switching the authentication when user wants to cancel the authentication switch", async () => {
        testNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        modifiedTestNode.profile.profile = {
            type: "zosmf",
            host: "test",
            port: 1443,
            name: "base",
            rejectUnauthorized: false,
            user: undefined,
            password: undefined,
            tokenType: "testTokenType",
            tokenValue: "12345",
            secure: ["tokenType"],
        };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "No" } as vscode.QuickPickItem);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To not perform switching the authentication when user wants escapes the quick pick of authentication switch", async () => {
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue(undefined);
        jest.spyOn(Gui, "infoMessage").mockImplementation();
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.infoMessage).toBeCalled();
    });
});

describe("Profiles Unit Tests - function ssoLogout", () => {
    let testNode;
    let globalMocks;
    beforeEach(async () => {
        globalMocks = createGlobalMocks();
        testNode = new (ZoweTreeNode as any)(
            "fake",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        testNode.profile.profile.user = "fake";
        Object.defineProperty(Profiles.getInstance(), "allProfiles", {
            value: [
                {
                    name: "fake",
                },
            ],
            configurable: true,
        });
        jest.spyOn(Gui, "showMessage").mockImplementation();
    });
    it("should logout successfully and refresh zowe explorer", async () => {
        const mockTreeProvider = {
            mSessionNodes: [testNode],
            flipState: jest.fn(),
            refreshElement: jest.fn(),
        } as any;
        jest.spyOn(TreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "job", "get").mockReturnValue(mockTreeProvider);
        const getTokenTypeNameMock = jest.fn();
        const logoutMock = jest.fn();
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockImplementation(() => ({
            logout: logoutMock,
            getSession: jest.fn(),
            getProfileTypeName: jest.fn(),
            getTokenTypeName: getTokenTypeNameMock,
        }));
        const updateBaseProfileFileLogoutSpy = jest.spyOn(Profiles.getInstance() as any, "updateBaseProfileFileLogout").mockImplementation();
        await expect(Profiles.getInstance().ssoLogout(testNode)).resolves.not.toThrow();
        expect(getTokenTypeNameMock).toBeCalledTimes(1);
        expect(logoutMock).toBeCalledTimes(1);
        expect(updateBaseProfileFileLogoutSpy).toBeCalledTimes(1);
    });
});

describe("Profiles Unit Tests - function updateBaseProfileFileLogin", () => {
    it("should update the property of mProfileInfo", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const globalMocks = createGlobalMocks();
        const updatePropertyMock = jest.fn();
        jest.spyOn(privateProfile, "getProfileInfo").mockReturnValue({
            isSecured: () => true,
            updateProperty: updatePropertyMock,
        });
        await expect(privateProfile.updateBaseProfileFileLogin(globalMocks.testProfile, globalMocks.testProfile.profile)).resolves.not.toThrow();
        expect(updatePropertyMock).toBeCalledTimes(2);
    });
});

describe("Profiles Unit Tests - function updateBaseProfileFileLogout", () => {
    it("should update the property of mProfileInfo", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const globalMocks = createGlobalMocks();
        const updateKnownPropertyMock = jest.fn();
        jest.spyOn(privateProfile, "getProfileInfo").mockReturnValue({
            isSecured: () => true,
            getAllProfiles: () => [
                {
                    profName: "sestest",
                },
            ],
            mergeArgsForProfile: jest.fn(),
            updateKnownProperty: updateKnownPropertyMock,
        });
        await expect(privateProfile.updateBaseProfileFileLogout(globalMocks.testProfile, globalMocks.testProfile.profile)).resolves.not.toThrow();
        expect(updateKnownPropertyMock).toBeCalledTimes(2);
    });
});

describe("Profiles Unit Tests - function createNonSecureProfile", () => {
    it("should create an unsecured profile by removing secure arrays and setting autoStore to false", async () => {
        const globalMocks = createGlobalMocks();
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(false);
        expect(privateProfile.createNonSecureProfile(globalMocks.testTeamConfigProfile)).toEqual(undefined);
        expect(globalMocks.testTeamConfigProfile).toEqual(globalMocks.testUnsecureTeamConfigProfile);
    });
});

describe("Profiles Unit Tests - function updateProfile", () => {
    it("should throw an error when getting the CliManager", async () => {
        const globalMocks = createGlobalMocks();
        const privateProfile = Profiles.getInstance() as any;
        jest.spyOn(Profiles.getInstance(), "getCliProfileManager").mockReturnValue({
            load: () => globalMocks.testProfile,
            update: () => {
                throw new Error("Failed to get CliProfileManager");
            },
        } as any);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        await expect(
            privateProfile.updateProfile(
                {
                    type: undefined,
                    name: "test",
                    profile: globalMocks.testProfile,
                },
                false
            )
        ).resolves.toEqual(undefined);
    });
});

describe("Profiles Unit Tests - function validationArraySetup", () => {
    it("should setup the validation array", async () => {
        const globalMocks = createGlobalMocks();
        Object.defineProperty(Profiles.getInstance(), "profilesValidationSetting", {
            value: [
                {
                    name: globalMocks.testProfile.name,
                    setting: true,
                },
                {
                    name: globalMocks.testProfile.name,
                    setting: false,
                },
            ],
        });
        expect(Profiles.getInstance().validationArraySetup(globalMocks.testProfile, true)).toEqual({
            name: globalMocks.testProfile.name,
            setting: true,
        });
    });
});

describe("Profiles Unit Tests - function loginCredentialPrompt", () => {
    afterEach(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    it("should show a gui message if there is not a newUser", async () => {
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(privateProfile, "userInfo", {
            value: () => null,
        });
        const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
        await expect(privateProfile.loginCredentialPrompt()).resolves.toEqual(undefined);
        expect(showMessageSpy).toBeCalledTimes(1);
    });

    it("should show a gui message if there is not a newUser", async () => {
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(Profiles, "getInstance", {
            value: () => ({
                userInfo: () => "test",
                passwordInfo: () => null,
            }),
        });
        const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
        await expect(privateProfile.loginCredentialPrompt()).resolves.toEqual(undefined);
        expect(showMessageSpy).toBeCalledTimes(1);
    });
});

describe("Profiles Unit Tests - function getSecurePropsForProfile", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    it("should retrieve the secure properties of a profile", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            mergeArgsForProfile: () => ({
                knownArgs: [
                    {
                        argName: "tokenValue",
                        secure: true,
                    } as any,
                ],
                missingArgs: [],
            }),
            getAllProfiles: () => [],
        } as any);
        await expect(Profiles.getInstance().getSecurePropsForProfile(globalMocks.testProfile.name ?? "")).resolves.toEqual(["tokenValue"]);
    });
});

describe("Profiles Unit Tests - function clearFilterFromAllTrees", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        jest.restoreAllMocks();
    });

    it("should fail to clear filter if no session nodes are available", async () => {
        const globalMocks = createGlobalMocks();
        const testNode = new (ZoweTreeNode as any)(
            "fake",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        const flipStateSpy = jest.fn();
        const refreshElementSpy = jest.fn();

        const mockTreeProvider = {
            mSessionNodes: [],
            flipState: flipStateSpy,
            refreshElement: refreshElementSpy,
        } as any;
        jest.spyOn(TreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "job", "get").mockReturnValue(mockTreeProvider);

        expect(Profiles.getInstance().clearFilterFromAllTrees(testNode));
        expect(flipStateSpy).toBeCalledTimes(0);
        expect(refreshElementSpy).toBeCalledTimes(0);
    });

    it("should fail to clear filters if the session node is not listed in the tree", async () => {
        const globalMocks = createGlobalMocks();
        const testNode = new (ZoweTreeNode as any)(
            "fake",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        const flipStateSpy = jest.fn();
        const refreshElementSpy = jest.fn();
        const getProfileSpy = jest.fn(() => ({ name: "test" }));

        const mockTreeProvider = {
            mSessionNodes: [{ getProfile: getProfileSpy }],
            flipState: flipStateSpy,
            refreshElement: refreshElementSpy,
        } as any;
        jest.spyOn(TreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(TreeProviders, "job", "get").mockReturnValue(mockTreeProvider);

        expect(Profiles.getInstance().clearFilterFromAllTrees(testNode));
        expect(flipStateSpy).toBeCalledTimes(0);
        expect(refreshElementSpy).toBeCalledTimes(0);
        expect(getProfileSpy).toBeCalledTimes(3);
    });
});

describe("Profiles Unit Tests - function disableValidation", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it("should disable validation for the profile on all trees", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(TreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().disableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.VALIDATE_SUFFIX);
    });

    it("should disable validation for the profile on the current tree", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(TreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        const disableValidationContextSpy = jest.spyOn(Profiles.getInstance(), "disableValidationContext");
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().disableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(disableValidationContextSpy).toBeCalledTimes(1);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.VALIDATE_SUFFIX);
    });
});

describe("Profiles Unit Tests - function enableValidation", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it("should enable validation for the profile on all trees", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(TreeProviders, "getSessionForAllTrees").mockReturnValue([
            createMockNode("test2", globals.DS_SESSION_CONTEXT),
            globalMocks.testNode,
        ]);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().enableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.VALIDATE_SUFFIX);
    });

    it("should enable validation for the profile on the current tree", async () => {
        const globalMocks = createGlobalMocks();
        const enableValidationContextSpy = jest.spyOn(Profiles.getInstance(), "enableValidationContext");
        jest.spyOn(TreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().enableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(enableValidationContextSpy).toBeCalledTimes(1);
        expect(globalMocks.testNode.contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.VALIDATE_SUFFIX);
    });
});
