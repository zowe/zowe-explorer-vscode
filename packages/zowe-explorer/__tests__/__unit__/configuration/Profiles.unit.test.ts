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
import { imperative, Gui, ZoweTreeNode, ZoweVsCodeExtension, IZoweTree, IZoweTreeNode, Validation, FileManagement } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/configuration/Profiles";
import { ZoweExplorerExtender } from "../../../src/extending/ZoweExplorerExtender";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { createUSSNode, createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";
import { JobFSProvider } from "../../../src/trees/job/JobFSProvider";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";
import { Constants } from "../../../src/configuration/Constants";
import { ProfilesUtils } from "../../../src/utils/ProfilesUtils";
import { AuthUtils } from "../../../src/utils/AuthUtils";
import { FilterDescriptor } from "../../../src/management/FilterManagement";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { USSTree } from "../../../src/trees/uss/USSTree";

jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("../../../src/tools/ZoweLogger");

function createGlobalMocks(): { [key: string]: any } {
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
        testUSSTree: null as any as USSTree,
        testNode: createMockNode("test", Constants.DS_SESSION_CONTEXT),
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
        mockProfileInstance: null as any as Profiles,
        mockConfigInstance: createConfigInstance(),
        mockConfigLoad: null as any as typeof imperative.Config,
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);
    jest.spyOn(JobFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);
    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);

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

    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: jest.fn(() => ({ persistence: true })),
            update: jest.fn(),
            keys: jest.fn(),
        },
        configurable: true,
    });

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

    Object.defineProperty(ProfilesUtils, "usingTeamConfig", {
        value: jest.fn(() => {
            return true;
        }),
        configurable: true,
    });

    newMocks.testUSSTree = createUSSTree(undefined as any, [createUSSNode(newMocks.testSession, newMocks.testProfile)], createTreeView());

    return newMocks;
}

afterEach(() => {
    jest.clearAllMocks();
});

describe("Profiles Unit Tests - Function getProfileInfo", () => {
    const zoweDir = jest.requireActual("@zowe/imperative").ConfigUtils.getZoweDir();

    beforeAll(() => {
        // Disable Imperative mock to use real Config API
        jest.dontMock("@zowe/imperative");
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

    it("should load profiles from both home directory and current directory", async () => {
        const { ProfilesCache, ...zeApi } = await import("@zowe/zowe-explorer-api");
        Object.defineProperty(zeApi.imperative.ProfileCredentials.prototype, "isSecured", { get: () => false });
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger(), __dirname);
        const config = (await profilesCache.getProfileInfo()).getTeamConfig();
        expect(config.layers[0].path).toContain(__dirname);
        expect(config.layers[1].path).toContain(__dirname);
        expect(config.layers[2].path).toContain(zoweDir);
        expect(config.layers[3].path).toContain(zoweDir);
        expect(config.layers.map((layer) => layer.exists)).toEqual([true, true, true, true]);
    });

    it("should not load project profiles from same directory as global profiles", async () => {
        const { ProfilesCache, ...zeApi } = await import("@zowe/zowe-explorer-api");
        Object.defineProperty(zeApi.imperative.ProfileCredentials.prototype, "isSecured", { get: () => false });
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger(), zoweDir);
        const config = (await profilesCache.getProfileInfo()).getTeamConfig();
        expect(config.layers[0].path).not.toContain(zoweDir);
        expect(config.layers[1].path).not.toContain(zoweDir);
        expect(config.layers.map((layer) => layer.exists)).toEqual([true, true, true, true]);
    });
});

describe("Profiles Unit Test - Function createInstance", () => {
    const mockWorkspaceFolders = jest.fn().mockReturnValue([]);

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
        jest.doMock("@zowe/imperative");
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
        mockWorkspaceFolders.mockClear().mockReturnValue([]);

        /* eslint-disable-next-line @typescript-eslint/no-var-requires */
        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBeUndefined();
    });

    it("should create instance when there is empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([]);

        /* eslint-disable-next-line @typescript-eslint/no-var-requires */
        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBeUndefined();
    });

    it("should create instance when there is non-empty workspace", async () => {
        mockWorkspaceFolders.mockClear().mockReturnValue([
            {
                uri: { fsPath: "fakePath", scheme: "file" },
            },
        ]);

        /* eslint-disable-next-line @typescript-eslint/no-var-requires */
        const { Profiles: testProfiles } = require("../../../src/configuration/Profiles");
        jest.spyOn(testProfiles.prototype, "refresh").mockResolvedValueOnce(undefined);
        const profilesInstance = await testProfiles.createInstance(undefined);
        expect(mockWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(profilesInstance.cwd).toBe("fakePath");
    });

    it("Tests that createInstance catches error and logs it", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(Profiles.prototype, "refresh").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.createInstance(globalMocks.log)).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - Function createZoweSession", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            testDatasetSessionNode: null as any as ZoweDatasetNode,
            testDatasetTree: null as any as IZoweTree<IZoweTreeNode>,
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
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSession(blockMocks.testDatasetTree);
        expect(spy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile selection has been cancelled.");
        expect(ZoweLogger.debug).toHaveBeenCalledWith("Profile selection has been cancelled.");
        spy.mockClear();
    });

    it("Tests that createZoweSession runs successfully", async () => {
        const globalMocks = createGlobalMocks();
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

    it("Tests that createZoweSession catches error and logs it", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(Gui, "createQuickPick").mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            value: "test",
        } as any);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("Test"));
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().createZoweSession(globalMocks.testUSSTree)).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(Error("test error"));
        errorSpy.mockClear();
    });
});

describe("Profiles Unit Tests - Function editZoweConfigFile", () => {
    it("Tests that editZoweConfigFile presents correct message when escaping selection of quickpick", async () => {
        const globalMocks = createGlobalMocks();

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().editZoweConfigFile();
        expect(spy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation cancelled");
        spy.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Global is selected", async () => {
        const globalMocks = createGlobalMocks();

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        spyQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory" as any);
        jest.spyOn(FileManagement, "getZoweDir").mockReturnValue("file://globalPath/.zowe");
        const spyOpenFile = jest.spyOn(globalMocks.mockProfileInstance, "openConfigFile");
        await Profiles.getInstance().editZoweConfigFile();
        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalledWith("file://globalPath/.zowe/zowe.config.json");
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
        expect(spyOpenFile).toHaveBeenCalledWith("globalPath");
        spyOpenFile.mockClear();
    });
    it("Tests that editZoweConfigFile opens correct file when Project is selected", async () => {
        const globalMocks = createGlobalMocks();

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
        expect(spyOpenFile).toHaveBeenCalledWith("projectPath");
        spyOpenFile.mockClear();
    });
});

describe("Profiles Unit Tests - Function createZoweSchema", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            testDatasetSessionNode: null as any as ZoweDatasetNode,
            testDatasetTree: null as any as IZoweTree<IZoweTreeNode>,
            quickPickItem: createQuickPickItem(),
            mockWsFolder: null,
            qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        };
        newMocks.testDatasetSessionNode = createDatasetSessionNode(newMocks.session, globalMocks.mockProfileInstance);
        newMocks.testDatasetTree = createDatasetTree(newMocks.testDatasetSessionNode, newMocks.treeView);
        Object.defineProperty(imperative.ConfigUtils, "getZoweDir", {
            value: jest.fn().mockReturnValue("file://globalPath/.zowe"),
            configurable: true,
        });
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: () => [{ uri: { fsPath: "projectPath/zowe.config.user.json", scheme: "file" }, name: "zowe.config.user.json", index: 0 }],
            configurable: true,
        });
        // Removes any loaded config
        imperative.ImperativeConfig.instance.loadedConfig = undefined as any;

        return newMocks;
    }

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that createZoweSchema presents correct message when escaping selection of config location prompt", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const spy = jest.spyOn(Gui, "showQuickPick");
        spy.mockResolvedValueOnce(undefined);
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);
        expect(spy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation cancelled");
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

        expect(spyQuickPick).toHaveBeenCalled();
        expect(spyInfoMessage).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalled();

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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: () => [],
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
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: [],
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

        const spyConfig = jest.spyOn(Profiles.getInstance(), "openConfigFile").mockImplementation();
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);
        expect(spyConfig).toHaveBeenCalledWith(expectedValue);
    });

    it("Test that createZoweSchema will create global configuration", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory");
        const spyLayers = jest.spyOn(Profiles.getInstance() as any, "checkExistingConfig").mockReturnValueOnce("zowe");
        const spyConfigBuilder = jest.spyOn(imperative.ConfigBuilder, "build");
        const spyZoweConfigError = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError");
        const spyGuiErrorMessage = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Show config");
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(undefined);
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).toHaveBeenCalledTimes(1);
        expect(spyZoweConfigError).not.toHaveBeenCalled();
        expect(spyGuiErrorMessage).not.toHaveBeenCalled();
        expect(spyConfigBuilder).toHaveBeenCalledTimes(1);
        expect(spyConfigBuilder.mock.calls[0][1]).toEqual(true); // make sure that global was true

        spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyZoweConfigError.mockClear();
    });

    it("Test that createZoweSchema will create local configuration", async () => {
        const mockWorkspaceFolders = jest.fn();
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            get: mockWorkspaceFolders.mockReturnValue([
                {
                    uri: { fsPath: "fakePath", scheme: "file" },
                },
            ]),
            configurable: true,
        });

        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Project: in the current working directory");
        const spyLayers = jest.spyOn(Profiles.getInstance() as any, "checkExistingConfig").mockReturnValueOnce("zowe");
        const spyConfigBuilder = jest.spyOn(imperative.ConfigBuilder, "build");
        const spyZoweConfigError = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError");
        const spyGuiErrorMessage = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Show config");
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(undefined);
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);

        expect(spyQuickPick).toHaveBeenCalledTimes(1);
        expect(spyZoweConfigError).not.toHaveBeenCalled();
        expect(spyGuiErrorMessage).not.toHaveBeenCalled();
        expect(spyConfigBuilder).toHaveBeenCalledTimes(1);
        expect(spyConfigBuilder.mock.calls[0][1]).toEqual(false); // make sure that global was false

        spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyZoweConfigError.mockClear();
    });

    it("Test that createZoweSchema will include the extender profiles on config creation", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const spyQuickPick = jest.spyOn(Gui, "showQuickPick");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Global: in the Zowe home directory");
        const spyLayers = jest.spyOn(Profiles.getInstance() as any, "checkExistingConfig").mockReturnValueOnce("zowe");
        jest.spyOn(Profiles.getInstance(), "getConfigArray").mockReturnValue([
            {
                type: "extenderprofiletype",
                schema: undefined as any,
            },
        ]);
        const spyConfigBuilder = jest.spyOn(imperative.ConfigBuilder, "build");
        await Profiles.getInstance().createZoweSchema(blockMocks.testDatasetTree);
        const expected = [{ type: "zosmf" }, { type: "tso" }, undefined, { type: "extenderprofiletype", schema: undefined }, undefined];

        expect(spyConfigBuilder.mock.calls[0][0].profiles).toEqual(expected);
        spyQuickPick.mockClear();
        spyLayers.mockClear();
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
            } as imperative.IProfile,
        } as imperative.IProfileLoaded);
        jest.spyOn(Profiles.getInstance(), "updateProfilesArrays").mockImplementation();
        await expect(Profiles.getInstance().promptCredentials("secure_config_props")).resolves.toEqual(["test", "12345"]);
    });

    it("Tests that promptCredentials catches error and logs it", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().promptCredentials(globalMocks.testProfile)).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(Error("test error"));
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
        expect(showMessageSpy).toHaveBeenCalledWith("Operation cancelled");
    });
});

describe("Profiles Unit Tests - function validateProfile", () => {
    function createBlockMocks() {
        createGlobalMocks();
        const newMocks = {
            profilesForValidation: [] as Validation.IValidationProfile[],
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
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");
        const profile = {
            name: "test1",
            message: "",
            type: "",
            failNotFound: false,
        };
        await Profiles.getInstance().validateProfiles(profile);
        expect(errorHandlingSpy).toHaveBeenCalledWith(testError, { profile });
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

    it("Tests that deleteProfile catches error and logs it", async () => {
        const globalMocks = await createGlobalMocks();
        const datasetSessionNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);

        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Profiles.getInstance(), "getDeleteProfile").mockResolvedValue(globalMocks.testProfile);
        jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockImplementation(Profiles.getInstance().getProfileInfo as any);
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");

        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().deleteProfile(datasetSessionNode)).resolves.not.toThrow();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(Error("test error"));
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
        Object.defineProperty(Constants, "PROFILES_CACHE", { value: Profiles.getInstance(), configurable: true });
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
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
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
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockRejectedValueOnce(new Error("Failed to login"));
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as unverified if using token auth and is logged out or has expired token", async () => {
        const globalMocks = createGlobalMocks();
        environmentSetup(globalMocks);
        setupProfilesCheck(globalMocks);
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
    it("should show as unverified if profiles fail to load", async () => {
        const globalMocks = await createGlobalMocks();
        setupProfilesCheck(globalMocks);
        jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockRejectedValueOnce(new Error("test error"));
        jest.spyOn(Profiles.getInstance(), "getSecurePropsForProfile").mockImplementationOnce(Profiles.getInstance().getProfileInfo as any);
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("");
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        await expect(Profiles.getInstance().checkCurrentProfile(globalMocks.testProfile)).resolves.toEqual({ name: "sestest", status: "unverified" });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(Error("test error"));
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
        const globalMocks = createGlobalMocks();
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
    beforeEach(() => {
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
        Object.defineProperty(AuthUtils, "isProfileUsingBasicAuth", { value: jest.fn(), configurable: true });
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
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => imperative.SessConstants.TOKEN_TYPE_APIML,
            login: jest.fn(),
        } as never);
        const loginBaseProfMock = jest.spyOn(ZoweVsCodeExtension, "ssoLogin").mockRejectedValueOnce(new Error("test error."));
        jest.spyOn(Profiles.getInstance() as any, "loginCredentialPrompt").mockReturnValue(["fake", "12345"]);
        await expect(Profiles.getInstance().ssoLogin(testNode, "fake")).resolves.not.toThrow();
        expect(ZoweLogger.error).toHaveBeenCalled();
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
        globalMocks = await createGlobalMocks();
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
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
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

        jest.spyOn(ZoweVsCodeExtension, "ssoLogin").mockResolvedValue(true);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To check login fail's when trying to switch from Basic to Token-based authentication using Base Profile", async () => {
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
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

        jest.spyOn(ZoweVsCodeExtension, "ssoLogin").mockResolvedValue(false);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Basic to Token-based authentication using Regular Profile", async () => {
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
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
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To check login fail's when trying to switch from Basic to Token-based authentication using Regular Profile", async () => {
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
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
        expect(Gui.errorMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Token-based to Basic authentication when cred values are passed involving base profile", async () => {
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
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
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To switch from Token-based to Basic authentication when cred values are passed involving regular profile", async () => {
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
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
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(Gui.showMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.tokenType).toBeUndefined();
        expect(testNode.profile.profile.tokenValue).toBeUndefined();
    });

    it("To not switch from Token-based to Basic authentication when cred values are not passed", async () => {
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
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
        jest.spyOn(Profiles.getInstance(), "promptCredentials").mockResolvedValue(undefined as any);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toHaveBeenCalled();
        expect(testNode.profile.profile.tokenType).toBe(modifiedTestNode.profile.profile.tokenType);
        expect(testNode.profile.profile.tokenValue).toBe(modifiedTestNode.profile.profile.tokenValue);
        expect(testNode.profile.profile.secure.length).toBe(modifiedTestNode.profile.profile.secure.length);
        expect(testNode.profile.profile.secure).toEqual(modifiedTestNode.profile.profile.secure);
        expect(testNode.profile.profile.user).toBeUndefined();
        expect(testNode.profile.profile.password).toBeUndefined();
    });

    it("To not perform switching the authentication for a profile which does not support token-based authentication", async () => {
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(true);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => {
                throw new Error("test error.");
            },
        } as never);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toHaveBeenCalled();
    });

    it("To not perform switching the authentication when authentication method is unknown", async () => {
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue({ label: "Yes" } as vscode.QuickPickItem);
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(AuthUtils, "isProfileUsingBasicAuth").mockReturnValueOnce(false);
        jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
        jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getCommonApi").mockReturnValue({
            getTokenTypeName: () => "apimlAuthenticationToken",
        } as never);
        await Profiles.getInstance().handleSwitchAuthentication(testNode);
        expect(Gui.errorMessage).toHaveBeenCalled();
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
        expect(Gui.infoMessage).toHaveBeenCalled();
    });
});

describe("Profiles Unit Tests - function ssoLogout", () => {
    let testNode;
    let globalMocks;
    beforeEach(() => {
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
        const globalMocks = createGlobalMocks();
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
        expect(updateKnownPropertyMock).toHaveBeenCalledTimes(2);
    });
});

describe("Profiles Unit Tests - function createNonSecureProfile", () => {
    it("should create an unsecured profile by removing secure arrays and setting autoStore to false", () => {
        const globalMocks = createGlobalMocks();
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
    it("should setup the validation array", () => {
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

    it("should fail to clear filter if no session nodes are available", () => {
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
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockTreeProvider);
        jest.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockTreeProvider);

        expect(Profiles.getInstance().clearFilterFromAllTrees(testNode));
        expect(flipStateSpy).toHaveBeenCalledTimes(0);
        expect(refreshElementSpy).toHaveBeenCalledTimes(0);
    });

    it("should fail to clear filters if the session node is not listed in the tree", () => {
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

    it("should disable validation for the profile on all trees", () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([globalMocks.testNode]);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().disableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });

    it("should disable validation for the profile on the current tree", () => {
        const globalMocks = createGlobalMocks();
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

    it("should enable validation for the profile on all trees", () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([
            createMockNode("test2", Constants.DS_SESSION_CONTEXT),
            globalMocks.testNode,
        ]);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT);
        expect(Profiles.getInstance().enableValidation(globalMocks.testNode)).toEqual(globalMocks.testNode);
        expect(globalMocks.testNode.contextValue).toEqual(Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX);
    });

    it("should enable validation for the profile on the current tree", () => {
        const globalMocks = createGlobalMocks();
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

describe("Profiles Unit Tests - function basicAuthClearSecureArray", () => {
    it("calls Config APIs when profLoc.jsonLoc is valid, no loginTokenType provided", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: "/user/path/to/zowe.config.json",
                locType: imperative.ProfLocType.TEAM_CONFIG,
            },
        };
        const mergeArgsMock = {
            knownArgs: [
                {
                    argName: "user",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.user",
                    },
                },
                {
                    argName: "password",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.password",
                    },
                },
            ],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().basicAuthClearSecureArray("example_profile");
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[0].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[1].argLoc.jsonLoc);
        expect(teamCfgMock.set).toHaveBeenCalledWith(`${profAttrsMock.profLoc.jsonLoc}.secure`, ["tokenValue"]);
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });
    it("calls Config APIs when profLoc.jsonLoc is valid, loginTokenType provided", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: "/user/path/to/zowe.config.json",
                locType: imperative.ProfLocType.TEAM_CONFIG,
            },
        };
        const mergeArgsMock = {
            knownArgs: [
                {
                    argName: "user",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.user",
                    },
                },
                {
                    argName: "password",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.password",
                    },
                },
            ],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().basicAuthClearSecureArray("example_profile", "apimlAuthenticationToken");
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[0].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[1].argLoc.jsonLoc);
        expect(teamCfgMock.set).toHaveBeenCalledWith(`${profAttrsMock.profLoc.jsonLoc}.secure`, []);
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });

    it("does not call Config.set when profLoc.jsonLoc is invalid", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: undefined,
            },
        };
        const mergeArgsMock = {
            knownArgs: [
                {
                    argName: "user",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.user",
                    },
                },
                {
                    argName: "password",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.password",
                    },
                },
            ],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().basicAuthClearSecureArray("example_profile");
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[0].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[1].argLoc.jsonLoc);
        expect(teamCfgMock.set).not.toHaveBeenCalled();
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });

    it("does not call Config.delete when user and password arg's are missing in mergeArgsForProfile", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: undefined,
            },
        };
        const mergeArgsMock = {
            knownArgs: [],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().basicAuthClearSecureArray("example_profile");
        expect(teamCfgMock.delete).not.toHaveBeenCalled();
        expect(teamCfgMock.set).not.toHaveBeenCalled();
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });
});

describe("Profiles Unit Tests - function tokenAuthClearSecureArray", () => {
    it("calls Config APIs when profLoc.jsonLoc is valid, no loginTokenType provided", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: "/user/path/to/zowe.config.json",
                locType: imperative.ProfLocType.TEAM_CONFIG,
            },
        };
        const mergeArgsMock = {
            knownArgs: [
                {
                    argName: "tokenType",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenType",
                    },
                },
                {
                    argName: "tokenValue",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenValue",
                    },
                },
                {
                    argName: "tokenExpiration",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenExpiration",
                    },
                },
            ],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().tokenAuthClearSecureArray("example_profile");
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[0].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[1].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[2].argLoc.jsonLoc);
        expect(teamCfgMock.set).toHaveBeenCalledWith(`${profAttrsMock.profLoc.jsonLoc}.secure`, ["user", "password"]);
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });
    it("calls Config APIs when profLoc.jsonLoc is valid, loginTokenType provided", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: "/user/path/to/zowe.config.json",
                locType: imperative.ProfLocType.TEAM_CONFIG,
            },
        };
        const mergeArgsMock = {
            knownArgs: [
                {
                    argName: "tokenType",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenType",
                    },
                },
                {
                    argName: "tokenValue",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenValue",
                    },
                },
                {
                    argName: "tokenExpiration",
                    argLoc: {
                        jsonLoc: "profiles.example_profile.properties.tokenExpiration",
                    },
                },
            ],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);

        await Profiles.getInstance().tokenAuthClearSecureArray("example_profile", "apimlAuthenticationToken");
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[0].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[1].argLoc.jsonLoc);
        expect(teamCfgMock.delete).toHaveBeenCalledWith(mergeArgsMock.knownArgs[2].argLoc.jsonLoc);
        expect(teamCfgMock.set).toHaveBeenCalledWith(`${profAttrsMock.profLoc.jsonLoc}.secure`, []);
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });
    it("does not call Config.delete when tokenType, tokenValue, tokenExpiration arg's are missing in mergeArgsForProfile", async () => {
        const teamCfgMock = {
            delete: jest.fn(),
            save: jest.fn(),
            set: jest.fn(),
        };
        const profAttrsMock = {
            isDefaultProfile: false,
            profName: "example_profile",
            profType: "zosmf",
            profLoc: {
                jsonLoc: undefined,
            },
        };
        const mergeArgsMock = {
            knownArgs: [],
        };
        const getProfileInfoMock = jest.spyOn(Profiles.getInstance(), "getProfileInfo").mockResolvedValue({
            getTeamConfig: jest.fn().mockReturnValue(teamCfgMock),
            mergeArgsForProfile: jest.fn().mockReturnValue(mergeArgsMock),
        } as any);
        const getProfileFromConfigMock = jest.spyOn(Profiles.getInstance(), "getProfileFromConfig").mockResolvedValue(profAttrsMock);
        await Profiles.getInstance().tokenAuthClearSecureArray("example_profile");
        expect(teamCfgMock.delete).not.toHaveBeenCalled();
        expect(teamCfgMock.set).not.toHaveBeenCalled();
        expect(teamCfgMock.save).toHaveBeenCalled();
        getProfileInfoMock.mockRestore();
        getProfileFromConfigMock.mockRestore();
    });
});

describe("Profiles unit tests - function showProfilesInactiveMsg", () => {
    it("should call ZoweLogger.error to log the error", () => {
        const errorSpy = jest.spyOn(ZoweLogger, "error");
        Profiles.getInstance().showProfileInactiveMsg("profName");
        expect(errorSpy).toHaveBeenCalledWith(
            "Profile profName is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
        );
    });
    it("should call Gui.errorMessage to display the message", () => {
        const errorMsgSpy = jest.spyOn(Gui, "errorMessage");
        Profiles.getInstance().showProfileInactiveMsg("profName");
        expect(errorMsgSpy).toHaveBeenCalledWith(
            "Profile profName is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
        );
    });
});
