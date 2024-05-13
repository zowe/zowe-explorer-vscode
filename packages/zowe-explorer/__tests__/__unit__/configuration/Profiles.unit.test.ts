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

import * as vscode from "vscode";
import * as utils from "../../../src/utils/ProfilesUtils";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import * as path from "path";
import {
    createISessionWithoutCredentials,
    createTreeView,
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
import { createProfileManager } from "../../__mocks__/mockCreators/profiles";
import { imperative, Gui, ProfilesCache, ZoweTreeNode, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Constants } from "../../../src/configuration/Constants";
import { Profiles } from "../../../src/configuration/Profiles";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "../../../src/extending/ZoweExplorerExtender";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";
import { JobFSProvider } from "../../../src/trees/job/JobFSProvider";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";
import { createUSSTree } from "../../../src/trees/uss/USSTree";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";
import { createUSSNode, createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { FilterDescriptor } from "../../../src/management/FilterManagement";
import { AuthUtils } from "../../../src/utils/AuthUtils";

jest.mock("../../../src/tools/ZoweLogger");
jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");

async function createGlobalMocks() {
    const newMocks = {
        log: imperative.Logger.getAppLogger(),
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
        testNode: createMockNode("test", Constants.DS_SESSION_CONTEXT),
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
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);
    jest.spyOn(JobFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);
    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);

    newMocks.mockProfilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
    newMocks.withProgress = jest.fn().mockImplementation((_progLocation, _callback) => {
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
    Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
    Object.defineProperty(zosmf.ZosmfSession, "createSessCfgFromArgs", {
        value: newMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
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
    Object.defineProperty(vscode, "ProgressLocation", { value: newMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: newMocks.withProgress, configurable: true });

    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: jest.fn(() => ({ persistence: true })),
            update: jest.fn(),
            keys: jest.fn(),
        },
        configurable: true,
    });

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

    Object.defineProperty(imperative, "Config", {
        value: () => newMocks.mockConfigInstance,
        configurable: true,
    });
    newMocks.mockConfigLoad = Object.defineProperty(imperative.Config, "load", {
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

    Object.defineProperty(utils.ProfilesUtils, "usingTeamConfig", {
        value: jest.fn(() => {
            return true;
        }),
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

        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBeUndefined();
    });

    it("should create instance when there is empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([undefined]);

        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
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

        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBe("fakePath");
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
        expect(spy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile selection has been cancelled.");
        expect(ZoweLogger.debug).toHaveBeenCalledWith("Profile selection has been cancelled.");
        spy.mockClear();
    });

    it("Tests that createZoweSession runs successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const spyConfig = jest.spyOn(Profiles.getInstance(), "openConfigFile");
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("Test"));
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValueOnce(createInstanceOfProfileInfo());
        jest.spyOn(Gui, "showInputBox").mockResolvedValue("test");

        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(spyConfig).toHaveBeenCalled();
        spyConfig.mockClear();
    });

    it("Tests that createZoweSession catches error and log warning", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("Test"));
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(ZoweLogger.warn).toHaveBeenCalledTimes(1);
        expect(ZoweLogger.warn).toHaveBeenCalledWith(Error("test error"));
    });
});

describe("Profiles Unit Tests - Function editZoweConfigFile", () => {
    it("Tests that editZoweConfigFile presents correct message when escaping selection of quickpick", async () => {
        const globalMocks = await createGlobalMocks();

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().editZoweConfigFile();
        expect(spy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Global is selected", async () => {
        const globalMocks = await createGlobalMocks();

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        spyQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory" as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalledWith("file://globalPath/.zowe/zowe.config.json");
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
        expect(spyOpenFile).toHaveBeenCalledWith("globalPath");
        spyOpenFile.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Project is selected", async () => {
        const globalMocks = await createGlobalMocks();

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        spyQuickPick.mockResolvedValueOnce("Project: in the current working directory" as any);
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalledWith("file://projectPath/zowe.config.user.json");
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
        expect(spyOpenFile).toHaveBeenCalledWith("projectPath");
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
        Object.defineProperty(imperative.ProfileInfo, "getZoweDir", {
            value: jest.fn().mockReturnValue("file://globalPath/.zowe"),
            configurable: true,
        });
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: () => [{ uri: "file://projectPath/zowe.config.user.json", name: "zowe.config.user.json", index: 0 }],
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
        expect(spy).toHaveBeenCalled();
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

        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyInfoMessage).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalled();

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
        const spyLayers = jest.spyOn(Profiles.getInstance() as any, "checkExistingConfig").mockRejectedValueOnce(new Error("Error Parsing JSON"));
        const spyZoweConfigError = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError");
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Show config");
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyZoweConfigError).toHaveBeenCalled();

        spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyZoweConfigError.mockClear();
    });
    it("Test that createZoweSchema will auto create global if VSC not in project and config doesn't exist", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: () => undefined,
            configurable: true,
        });

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        const privateProf = Profiles.getInstance() as any;
        const spyLayers = jest.spyOn(privateProf, "getConfigLayers");
        spyLayers.mockResolvedValueOnce([
            {
                path: "file://projectPath/zowe.config.user.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ]);
        Object.defineProperty(imperative.Config, "load", {
            value: jest.fn().mockResolvedValue(createConfigLoad()),
            configurable: true,
        });

        Object.defineProperty(SettingsConfig, "getDirectValue", {
            value: jest.fn().mockReturnValue(true),
            configurable: true,
        });
        const spyConfig = jest.spyOn(Profiles.getInstance(), "openConfigFile").mockImplementation();

        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).not.toHaveBeenCalled();
        expect(spyConfig).toHaveBeenCalled();

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
                path: "file://projectPath/zowe.config.user.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ]);

        Object.defineProperty(imperative.Config, "setSchema", {
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
            } as imperative.IProfile,
        } as imperative.IProfileLoaded);
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
                } as imperative.IProfileLoaded,
                {
                    name: "test2",
                    user: "test2",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as imperative.IProfileLoaded,
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
        expect(showMessageSpy).toHaveBeenCalledWith("No profiles available");
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
                } as imperative.IProfileLoaded,
                {
                    name: "test2",
                    user: "test2",
                    password: "123",
                    message: "",
                    type: "",
                    failNotFound: false,
                } as imperative.IProfileLoaded,
            ],
            configurable: true,
        });
        const showMessageSpy = jest.spyOn(Gui, "showMessage");
        jest.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);
        await expect(privateProfile.getDeleteProfile()).resolves.toEqual(undefined);
        expect(showMessageSpy).toHaveBeenCalledWith("Operation Cancelled");
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
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");
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
        expect(errorHandlingSpy).toHaveBeenCalledWith(testError, "test1");
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

describe("Profiles Unit Tests - function deleteProfile", () => {
    it("should delete profile", async () => {
        const globalMocks = await createGlobalMocks();

        const datasetSessionNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, globalMocks.testProfile);
        const ussSessionNode = [createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile)];
        const ussTree = createUSSTree([], ussSessionNode);

        jest.spyOn(datasetTree, "getFileHistory").mockReturnValue(["[SESTEST]: TEST.LIST"]);
        jest.spyOn(ussTree, "getFileHistory").mockReturnValue(["[SESTEST]: /u/test/test.txt"]);

        const testNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        testNode.setProfileToChoice(globalMocks.testProfile);
        testNode.contextValue = "session server";

        // jest.spyOn(Profiles.getInstance() as any, "deletePrompt").mockReturnValue("success");
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

        await expect(Profiles.getInstance().deleteProfile(datasetTree)).resolves.not.toThrow();
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
        Object.defineProperty(Constants, "PROFILES_CACHE", { value: Profiles.getInstance(), configurable: true });
    };

    it("should show as active in status of profile", async () => {
        const globalMocks = await createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "validateProfiles").mockReturnValue({ status: "active", name: "sestest" } as any);
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(["sestest", "12345", "base64Auth"]);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "active" });
    });
    it("should show as unverified in status of profile", async () => {
        const globalMocks = await createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(undefined);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
    });
    it("should show as inactive in status of profile", async () => {
        const globalMocks = await createGlobalMocks();
        setupProfilesCheck(globalMocks);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "inactive" });
    });
    it("should throw an error if using token auth and is logged out or has expired token", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValue(true);
        setupProfilesCheck(globalMocks);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
    });
});

describe("Profiles Unit Tests - function getProfileSetting", () => {
    it("should retrive the profile with a status of unverified", async () => {
        const globalMocks = await createGlobalMocks();
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
        const globalMocks = await createGlobalMocks();
        const testNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );

        // Mimic scenario for toggling validation (branch 1)
        testNode.contextValue = Constants.VALIDATE_SUFFIX;
        await Profiles.getInstance().disableValidationContext(testNode);
        expect(testNode.contextValue).toContain(Constants.NO_VALIDATE_SUFFIX);

        // Mimic scenario where validation is already disabled, but function was called again (branch 2)
        const prevContext = testNode.contextValue;
        await Profiles.getInstance().disableValidationContext(testNode);
        expect(prevContext).toBe(testNode.contextValue);
    });
});

describe("Profiles Unit Tests - function enableValidationContext", () => {
    it("should enable validation context and return updated node", async () => {
        const globalMocks = await createGlobalMocks();
        const testNode = new (ZoweTreeNode as any)(
            "test",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            globalMocks.testSession,
            globalMocks.testProfile
        );
        // Mimic scenario for toggling validation (branch 1)
        testNode.contextValue = Constants.NO_VALIDATE_SUFFIX;
        await Profiles.getInstance().enableValidationContext(testNode);
        expect(testNode.contextValue).toContain(Constants.VALIDATE_SUFFIX);

        // Mimic scenario where validation is already enabled, but function was called again (branch 2)
        const prevContext = testNode.contextValue;
        await Profiles.getInstance().enableValidationContext(testNode);
        expect(prevContext).toBe(testNode.contextValue);
    });
});

describe("Profiles Unit Tests - function ssoLogin", () => {
    let testNode;
    let globalMocks;
    beforeEach(async () => {
        globalMocks = await createGlobalMocks();
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
            getTokenTypeName: () => imperative.SessConstants.TOKEN_TYPE_APIML,
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
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
        expect(ZoweLogger.warn).toHaveBeenCalledWith(Error("test error."));
    });
    it("should catch error during login and log error", async () => {
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValueOnce({
            getTokenTypeName: () => imperative.SessConstants.TOKEN_TYPE_APIML,
            login: () => {
                throw new Error("test error.");
            },
        } as never);
        jest.spyOn(Profiles.getInstance() as any, "loginCredentialPrompt").mockReturnValue(["fake", "12345"]);
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
        expect(ZoweLogger.error).toHaveBeenCalled();
    });
});

describe("Profiles Unit Tests - function ssoLogout", () => {
    let testNode;
    let globalMocks;
    beforeEach(async () => {
        globalMocks = await createGlobalMocks();
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
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockTreeProvider);
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
        expect(getTokenTypeNameMock).toHaveBeenCalledTimes(1);
        expect(logoutMock).toHaveBeenCalledTimes(1);
        expect(updateBaseProfileFileLogoutSpy).toHaveBeenCalledTimes(1);
    });
});

describe("Profiles Unit Tests - function updateBaseProfileFileLogin", () => {
    it("should update the property of mProfileInfo", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const globalMocks = await createGlobalMocks();
        const updatePropertyMock = jest.fn();
        jest.spyOn(privateProfile, "getProfileInfo").mockReturnValue({
            isSecured: () => true,
            updateProperty: updatePropertyMock,
        });
        await expect(privateProfile.updateBaseProfileFileLogin(globalMocks.testProfile, globalMocks.testProfile.profile)).resolves.not.toThrow();
        expect(updatePropertyMock).toHaveBeenCalledTimes(2);
    });
});

describe("Profiles Unit Tests - function updateBaseProfileFileLogout", () => {
    it("should update the property of mProfileInfo", async () => {
        const privateProfile = Profiles.getInstance() as any;
        const globalMocks = await createGlobalMocks();
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
        expect(updateKnownPropertyMock).toHaveBeenCalledTimes(2);
    });
});

describe("Profiles Unit Tests - function createNonSecureProfile", () => {
    it("should create an unsecured profile by removing secure arrays and setting autoStore to false", async () => {
        const globalMocks = await createGlobalMocks();
        const changingConfig = globalMocks.testTeamConfigProfile;
        const privateProfile = Profiles.getInstance() as any;
        Object.defineProperty(SettingsConfig, "getDirectValue", {
            value: jest.fn().mockReturnValue(false),
            configurable: true,
        });
        expect(privateProfile.createNonSecureProfile(changingConfig)).toBeUndefined();
        expect(changingConfig).toEqual(globalMocks.testUnsecureTeamConfigProfile);
    });
});

describe("Profiles Unit Tests - function validationArraySetup", () => {
    it("should setup the validation array", async () => {
        const globalMocks = await createGlobalMocks();
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
        expect(showMessageSpy).toHaveBeenCalledTimes(1);
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
        expect(showMessageSpy).toHaveBeenCalledTimes(1);
    });
});

describe("Profiles Unit Tests - function getSecurePropsForProfile", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    it("should retrieve the secure properties of a profile", async () => {
        const globalMocks = await createGlobalMocks();
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
        const globalMocks = await createGlobalMocks();
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
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockTreeProvider);

        expect(Profiles.getInstance().clearFilterFromAllTrees(testNode));
        expect(flipStateSpy).toHaveBeenCalledTimes(0);
        expect(refreshElementSpy).toHaveBeenCalledTimes(0);
    });

    it("should fail to clear filters if the session node is not listed in the tree", async () => {
        const globalMocks = await createGlobalMocks();
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
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockTreeProvider);

        expect(Profiles.getInstance().clearFilterFromAllTrees(testNode));
        expect(flipStateSpy).toHaveBeenCalledTimes(0);
        expect(refreshElementSpy).toHaveBeenCalledTimes(0);
        expect(getProfileSpy).toHaveBeenCalledTimes(3);
    });
});

describe("Profiles Unit Tests - function disableValidation", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it("should disable validation for the profile on all trees", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().disableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });

    it("should disable validation for the profile on the current tree", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        const disableValidationContextSpy = jest.spyOn(Profiles.getInstance(), "disableValidationContext");
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().disableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(disableValidationContextSpy).toHaveBeenCalledTimes(1);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });
});

describe("Profiles Unit Tests - function enableValidation", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it("should enable validation for the profile on all trees", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([
            createMockNode("test2", Constants.DS_SESSION_CONTEXT),
            globalMocks.testNode,
        ]);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().enableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });

    it("should enable validation for the profile on the current tree", async () => {
        const globalMocks = await createGlobalMocks();
        const enableValidationContextSpy = jest.spyOn(Profiles.getInstance(), "enableValidationContext");
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().enableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(enableValidationContextSpy).toHaveBeenCalledTimes(1);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });
});

describe("Profiles Unit Tests - function promptChangeForAllTrees", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it("should prompt for applying change to all trees", async () => {
        jest.spyOn(SharedTreeProviders, "sessionIsPresentInOtherTrees").mockReturnValue(false);
        const expectedResult = { label: "test", description: "test" } as vscode.QuickPickItem;
        const createQuickPickSpy = jest.spyOn(Gui, "createQuickPick");
        const resolveQuickPickSpy = jest.spyOn(Gui, "resolveQuickPick");
        const showSpy = jest.fn();
        const hideSpy = jest.fn();
        createQuickPickSpy.mockReturnValue({
            placeholder: "",
            items: [],
            activeItems: [],
            show: showSpy,
            hide: hideSpy,
        } as any);
        resolveQuickPickSpy.mockResolvedValue(expectedResult);
        await expect(Profiles["promptChangeForAllTrees"]("test", true)).resolves.toEqual(expectedResult);
        expect(createQuickPickSpy).toHaveBeenCalledTimes(1);
        expect(resolveQuickPickSpy).toHaveBeenCalledTimes(1);
        expect(showSpy).toHaveBeenCalledTimes(1);
        expect(hideSpy).toHaveBeenCalledTimes(1);
    });
});
