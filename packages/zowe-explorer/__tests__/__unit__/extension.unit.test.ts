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
import * as path from "path";
import * as zowe from "@zowe/cli";
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as extension from "../../src/extension";
import * as globals from "../../src/globals";
import * as tempFolderUtils from "../../src/utils/TempFolder";
import { Gui, ValidProfileEnum, ProfilesCache } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../src/Profiles";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { createGetConfigMock, createInstanceOfProfileInfo, createIProfile, createTreeView } from "../../__mocks__/mockCreators/shared";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import { getSelectedNodeList } from "../../src/shared/utils";
import { SettingsConfig } from "../../src/utils/SettingsConfig";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { DatasetTree } from "../../src/dataset/DatasetTree";
import { USSTree } from "../../src/uss/USSTree";
import { ZoweLogger } from "../../src/utils/LoggerUtils";
import { ZoweSaveQueue } from "../../src/abstract/ZoweSaveQueue";
import { ProfilesUtils } from "../../src/utils/ProfilesUtils";

jest.mock("vscode");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("util");
jest.mock("isbinaryfile");

async function createGlobalMocks() {
    const mockReadProfilesFromDisk = jest.fn().mockReturnValue(Promise.resolve());
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockMkdirSync: jest.fn(),
        mockMoveSync: jest.fn(),
        mockGetAllProfileNames: jest.fn(),
        mockReveal: jest.fn(),
        mockCreateTreeView: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        mockExecuteCommand: jest.fn(),
        mockRegisterCommand: jest.fn(),
        mockRegisterWebviewViewProvider: jest.fn(),
        mockOnDidCloseTextDocument: jest.fn(),
        mockOnDidSaveTextDocument: jest.fn(),
        mockOnDidChangeSelection: jest.fn(),
        mockOnDidChangeConfiguration: jest.fn(),
        mockOnDidChangeVisibility: jest.fn(),
        mockOnDidCollapseElement: jest.fn(),
        mockOnDidExpandElement: jest.fn(),
        mockExistsSync: jest.fn(),
        mockCreateReadStream: jest.fn(),
        mockReaddirSync: jest.fn(),
        mockUnlinkSync: jest.fn(),
        mockRmdirSync: jest.fn(),
        mockReadFileSync: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockShowWarningMessage: jest.fn(),
        mockZosmfSession: jest.fn(),
        mockCreateSessCfgFromArgs: jest.fn(),
        mockUtilities: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockSetStatusBarMessage: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockIsFile: jest.fn(),
        mockLoad: jest.fn(),
        mockRegisterTextDocumentContentProvider: jest.fn(),
        mockFrom: jest.fn(),
        mockGetProfileName: jest.fn(),
        mockCliHome: jest.fn().mockReturnValue(path.join(os.homedir(), ".zowe")),
        mockIcInstance: jest.fn(),
        mockImperativeConfig: jest.fn(),
        mockInitialize: jest.fn(),
        mockGetImperativeConfig: jest.fn().mockReturnValue({ profiles: [] }),
        mockCliProfileManager: jest.fn().mockImplementation(() => {
            return { GetAllProfileNames: globalMocks.mockGetAllProfileNames, Load: globalMocks.mockLoad };
        }),
        mockReadProfilesFromDisk: mockReadProfilesFromDisk,
        mockImperativeProfileInfo: jest.fn().mockImplementation(() => {
            return {
                mAppName: "",
                mCredentials: {},
                mUSingTeamConfig: true,
                readProfilesFromDisk: mockReadProfilesFromDisk,
            };
        }),
        mockSetGlobalSecurityValue: jest.fn(),
        mockWriteOverridesFile: jest.fn(),
        mockProfCacheProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(zowe.imperative.Logger.getAppLogger()),
        testTreeView: null,
        enums: jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3,
            };
        }),
        UIKindEnums: jest.fn().mockImplementation(() => {
            return {
                Desktop: 1,
                Web: 2,
            };
        }),
        testSession: new zowe.imperative.Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        }),
        testProfile: createIProfile(),
        testProfileOps: {
            allProfiles: [{ name: "firstName" }, { name: "secondName" }],
            defaultProfile: { name: "firstName" },
            getDefaultProfile: null,
            getBaseProfile: jest.fn(),
            loadNamedProfile: null,
            validProfile: ValidProfileEnum.VALID,
            checkCurrentProfile: jest.fn(),
            usesSecurity: jest.fn().mockReturnValue(true),
            getProfileSetting: jest.fn(),
            disableValidation: jest.fn(),
            enableValidation: jest.fn(),
            disableValidationContext: jest.fn(),
            enableValidationContext: jest.fn(),
            validationArraySetup: jest.fn(),
            fetchAllProfiles: jest.fn().mockResolvedValue([]),
            fetchAllProfilesByType: jest.fn().mockResolvedValue([]),
            getProfileInfo: () => createInstanceOfProfileInfo(),
        },
        mockExtension: null,
        appName: vscode.env.appName,
        uriScheme: vscode.env.uriScheme,
        expectedCommands: [
            "zowe.updateSecureCredentials",
            "zowe.extRefresh",
            "zowe.all.config.init",
            "zowe.ds.addSession",
            "zowe.ds.addFavorite",
            "zowe.ds.refreshAll",
            "zowe.ds.refreshNode",
            "zowe.ds.refreshDataset",
            "zowe.ds.pattern",
            "zowe.ds.editSession",
            "zowe.ds.ZoweNode.openPS",
            "zowe.ds.createDataset",
            "zowe.ds.createMember",
            "zowe.ds.deleteDataset",
            "zowe.ds.allocateLike",
            "zowe.ds.uploadDialog",
            "zowe.ds.deleteMember",
            "zowe.ds.editDataSet",
            "zowe.ds.editMember",
            "zowe.ds.removeSession",
            "zowe.ds.removeFavorite",
            "zowe.ds.saveSearch",
            "zowe.ds.removeSavedSearch",
            "zowe.ds.removeFavProfile",
            "zowe.ds.submitJcl",
            "zowe.ds.submitMember",
            "zowe.ds.showAttributes",
            "zowe.ds.renameDataSet",
            "zowe.ds.copyDataSets",
            "zowe.ds.pasteDataSets",
            "zowe.ds.renameDataSetMember",
            "zowe.ds.hMigrateDataSet",
            "zowe.ds.hRecallDataSet",
            "zowe.ds.showFileErrorDetails",
            "zowe.ds.disableValidation",
            "zowe.ds.enableValidation",
            "zowe.ds.ssoLogin",
            "zowe.ds.ssoLogout",
            "zowe.ds.sortBy",
            "zowe.ds.filterBy",
            "zowe.ds.openWithEncoding",
            "zowe.ds.copyName",
            "zowe.uss.addFavorite",
            "zowe.uss.removeFavorite",
            "zowe.uss.addSession",
            "zowe.uss.refreshAll",
            "zowe.uss.refreshUSS",
            "zowe.uss.refreshUSSInTree",
            "zowe.uss.refreshDirectory",
            "zowe.uss.fullPath",
            "zowe.uss.editSession",
            "zowe.uss.ZoweUSSNode.open",
            "zowe.uss.removeSession",
            "zowe.uss.createFile",
            "zowe.uss.createFolder",
            "zowe.uss.deleteNode",
            "zowe.uss.binary",
            "zowe.uss.text",
            "zowe.uss.renameNode",
            "zowe.uss.uploadDialog",
            "zowe.uss.uploadDialogBinary",
            "zowe.uss.copyPath",
            "zowe.uss.editFile",
            "zowe.uss.editAttributes",
            "zowe.uss.saveSearch",
            "zowe.uss.removeSavedSearch",
            "zowe.uss.removeFavProfile",
            "zowe.uss.disableValidation",
            "zowe.uss.enableValidation",
            "zowe.uss.ssoLogin",
            "zowe.uss.ssoLogout",
            "zowe.uss.pasteUssFile",
            "zowe.uss.copyUssFile",
            "zowe.uss.openWithEncoding",
            "zowe.uss.copyRelativePath",
            "zowe.jobs.zosJobsOpenspool",
            "zowe.jobs.deleteJob",
            "zowe.jobs.runModifyCommand",
            "zowe.jobs.runStopCommand",
            "zowe.jobs.refreshJobsServer",
            "zowe.jobs.refreshAllJobs",
            "zowe.jobs.refreshJob",
            "zowe.jobs.refreshSpool",
            "zowe.jobs.downloadSingleSpool",
            "zowe.jobs.downloadSingleSpoolBinary",
            "zowe.jobs.addJobsSession",
            "zowe.jobs.setOwner",
            "zowe.jobs.setPrefix",
            "zowe.jobs.removeSession",
            "zowe.jobs.downloadSpool",
            "zowe.jobs.downloadSpoolBinary",
            "zowe.jobs.getJobJcl",
            "zowe.jobs.setJobSpool",
            "zowe.jobs.search",
            "zowe.jobs.editSession",
            "zowe.jobs.addFavorite",
            "zowe.jobs.removeFavorite",
            "zowe.jobs.saveSearch",
            "zowe.jobs.removeSearchFavorite",
            "zowe.jobs.removeFavProfile",
            "zowe.jobs.disableValidation",
            "zowe.jobs.enableValidation",
            "zowe.jobs.ssoLogin",
            "zowe.jobs.ssoLogout",
            "zowe.jobs.startPolling",
            "zowe.jobs.stopPolling",
            "zowe.jobs.cancelJob",
            "zowe.jobs.sortBy",
            "zowe.jobs.filterJobs",
            "zowe.jobs.copyName",
            "zowe.manualPoll",
            "zowe.editHistory",
            "zowe.promptCredentials",
            "zowe.profileManagement",
            "zowe.certificateWizard",
            "zowe.openRecentMember",
            "zowe.searchInAllLoadedItems",
            "zowe.ds.deleteProfile",
            "zowe.cmd.deleteProfile",
            "zowe.uss.deleteProfile",
            "zowe.jobs.deleteProfile",
            "zowe.issueTsoCmd",
            "zowe.issueMvsCmd",
            "zowe.placeholderCommand",
        ],
    };

    Object.defineProperty(fs, "mkdirSync", { value: globalMocks.mockMkdirSync, configurable: true });
    Object.defineProperty(zowe.imperative, "CliProfileManager", {
        value: globalMocks.mockCliProfileManager,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: globalMocks.mockCreateTreeView,
        configurable: true,
    });
    Object.defineProperty(vscode.commands, "registerCommand", {
        value: globalMocks.mockRegisterCommand,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "registerWebviewViewProvider", {
        value: globalMocks.mockRegisterWebviewViewProvider,
        configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
        value: globalMocks.mockExecuteCommand,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", {
        value: globalMocks.mockOnDidSaveTextDocument,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "onDidCollapseElement", {
        value: globalMocks.mockOnDidCollapseElement,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "onDidExpandElement", {
        value: globalMocks.mockOnDidExpandElement,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.mockGetConfiguration,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
        value: globalMocks.mockOnDidChangeConfiguration,
        configurable: true,
    });
    Object.defineProperty(globals, "setGlobalSecurityValue", {
        value: globalMocks.mockSetGlobalSecurityValue,
        configurable: true,
    });
    Object.defineProperty(fs, "readdirSync", { value: globalMocks.mockReaddirSync, configurable: true });
    Object.defineProperty(fs, "createReadStream", { value: globalMocks.mockCreateReadStream, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(fs, "existsSync", { value: globalMocks.mockExistsSync, configurable: true });
    Object.defineProperty(fs, "unlinkSync", { value: globalMocks.mockUnlinkSync, configurable: true });
    Object.defineProperty(fs, "rmdirSync", { value: globalMocks.mockRmdirSync, configurable: true });
    Object.defineProperty(fs, "readFileSync", { value: globalMocks.mockReadFileSync, configurable: true });
    Object.defineProperty(fsextra, "moveSync", { value: globalMocks.mockMoveSync, configurable: true });
    Object.defineProperty(Gui, "errorMessage", {
        value: globalMocks.mockShowErrorMessage,
        configurable: true,
    });
    Object.defineProperty(Gui, "warningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.mockZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.mockZosmfSession, "createSessCfgFromArgs", {
        value: globalMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "setStatusBarMessage", {
        value: globalMocks.mockSetStatusBarMessage,
        configurable: true,
    });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.mockUtilities, configurable: true });
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", {
        value: globalMocks.mockRegisterTextDocumentContentProvider,
        configurable: true,
    });
    Object.defineProperty(vscode.Disposable, "from", { value: globalMocks.mockFrom, configurable: true });
    Object.defineProperty(ZoweDatasetNode, "getProfileName", {
        value: globalMocks.mockGetProfileName,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockCliProfileManager, "initialize", {
        value: globalMocks.mockInitialize,
        configurable: true,
    });
    Object.defineProperty(zowe, "getImperativeConfig", {
        value: globalMocks.mockGetImperativeConfig,
        configurable: true,
    });
    Object.defineProperty(zowe.imperative, "ImperativeConfig", {
        value: globalMocks.mockImperativeConfig,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockImperativeConfig, "instance", {
        value: globalMocks.mockIcInstance,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockIcInstance, "cliHome", { get: globalMocks.mockCliHome });
    Object.defineProperty(vscode.env, "appName", { value: globalMocks.appName, configurable: true });
    Object.defineProperty(vscode, "UIKind", { value: globalMocks.UIKindEnums, configurable: true });
    Object.defineProperty(vscode, "uriScheme", { value: globalMocks.uriScheme, configurable: true });
    Object.defineProperty(Profiles, "createInstance", {
        value: jest.fn(() => globalMocks.testProfileOps),
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.testProfileOps),
    });
    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.automaticProfileValidation": true,
        }),
    });
    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfCacheProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(ZoweExplorerExtender, "showZoweConfigError", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.imperative, "ProfileInfo", {
        value: globalMocks.mockImperativeProfileInfo,
        configurable: true,
    });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });

    jest.spyOn(vscode.workspace, "onDidCloseTextDocument").mockImplementation(globalMocks.onDidCloseTextDocument);

    // Create a mocked extension context
    const mockExtensionCreator = jest.fn(
        () =>
            ({
                subscriptions: [],
                extensionPath: path.join(__dirname, ".."),
                extension: {
                    packageJSON: {
                        packageInfo: "Zowe Explorer",
                        version: "2.x.x",
                    },
                },
            } as unknown as vscode.ExtensionContext)
    );
    globalMocks.mockExtension = new mockExtensionCreator();

    Object.defineProperty(ZoweLogger, "initializeZoweLogger", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockCreateSessCfgFromArgs.mockReturnValue(globalMocks.testSession.ISession);
    globalMocks.mockCreateTreeView.mockReturnValue(createTreeView());
    globalMocks.mockReadFileSync.mockReturnValue("");
    globalMocks.testProfileOps.getDefaultProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.testProfileOps.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.testTreeView = jest.fn().mockImplementation(() => {
        return {
            reveal: globalMocks.mockReveal,
            onDidExpandElement: globalMocks.mockOnDidExpandElement,
            onDidCollapseElement: globalMocks.mockOnDidCollapseElement,
            selection: [],
            onDidChangeSelection: globalMocks.mockOnDidChangeSelection,
            visible: true,
            onDidChangeVisibility: globalMocks.mockOnDidChangeVisibility,
        };
    });

    return globalMocks;
}

function createBlockMocks(globalMocks: any) {
    const blockMocks = {
        rootNode: new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
        }),
        testNode: null,
    };
    blockMocks.testNode = new ZoweUSSNode({
        label: globals.DS_PDS_CONTEXT,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        parentNode: blockMocks.rootNode,
    });

    blockMocks.rootNode.contextValue = globals.USS_SESSION_CONTEXT;
    return blockMocks;
}

describe("Extension Unit Tests", () => {
    const allCommands: Array<{ cmd: string; fun: () => void; toMock: () => void }> = [];
    let globalMocks;
    beforeAll(async () => {
        globalMocks = await createGlobalMocks();
        jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from(JSON.stringify({ overrides: { credentialManager: "@zowe/cli" } }), "utf-8"));
        Object.defineProperty(zowe.imperative, "ProfileInfo", {
            value: globalMocks.mockImperativeProfileInfo,
            configurable: true,
        });
        globalMocks.mockReadFileSync.mockReturnValueOnce('{ "overrides": { "CredentialManager": "Managed by ANO" }}');
        globalMocks.mockExistsSync.mockReturnValueOnce(false);
        globalMocks.mockGetConfiguration.mockReturnValue({
            persistence: true,
            get: (_setting: string) => "",
            update: jest.fn(),
            inspect: (_configuration: string) => {
                return {
                    workspaceValue: undefined,
                    globalValue: undefined,
                };
            },
        });

        await extension.activate(globalMocks.mockExtension);

        // Check that tree providers are initialized successfully
        expect(globalMocks.mockCreateTreeView.mock.calls.length).toBe(3);
        expect(globalMocks.mockCreateTreeView.mock.calls[0][0]).toBe("zowe.ds.explorer");
        expect(globalMocks.mockCreateTreeView.mock.calls[1][0]).toBe("zowe.uss.explorer");

        // Check that CLI Profile Manager is initialized successfully
        expect(globalMocks.mockInitialize.mock.calls.length).toBe(1);
        expect(globalMocks.mockInitialize.mock.calls[0][0]).toStrictEqual({
            configuration: [],
            profileRootDirectory: path.join(globalMocks.mockCliHome(), "profiles"),
        });

        // Checking if commands are registered properly
        expect(globalMocks.mockRegisterCommand.mock.calls.length).toBe(globals.COMMAND_COUNT);

        globalMocks.mockRegisterCommand.mock.calls.forEach((call, i) => {
            expect(call[0]).toStrictEqual(globalMocks.expectedCommands[i]);
            expect(call[1]).toBeInstanceOf(Function);
            allCommands.push({ cmd: call[0], fun: call[1], toMock: jest.fn() });
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("Testing that activate correctly executes", async () => {
        expect(allCommands.map((c) => c.cmd)).toEqual(globalMocks.expectedCommands);
    });

    it("should deactivate the extension", async () => {
        const spyAwaitAllSaves = jest.spyOn(ZoweSaveQueue, "all");
        const spyCleanTempDir = jest.spyOn(tempFolderUtils, "cleanTempDir");
        spyCleanTempDir.mockImplementation(jest.fn());
        Object.defineProperty(ZoweLogger, "disposeZoweLogger", {
            value: jest.fn(),
            configurable: true,
        });
        await extension.deactivate();
        expect(spyAwaitAllSaves).toHaveBeenCalled();
        expect(spyCleanTempDir).toHaveBeenCalled();
        // Test that upload operations complete before cleaning temp dir
        expect(spyAwaitAllSaves.mock.invocationCallOrder[0]).toBeLessThan(spyCleanTempDir.mock.invocationCallOrder[0]);
        expect(globals.ACTIVATED).toBe(false);
    });

    async function removeSessionTest(command: string, contextValue: string, providerObject: any) {
        const testNode: any = {
            contextValue: contextValue,
            getProfile: jest.fn(),
            getParent: jest.fn().mockReturnValue({ getLabel: jest.fn() }),
            label: "TestNode",
            getLabel: jest.fn(() => "TestNode"),
        };

        const deleteSessionSpy = jest.spyOn(providerObject.prototype, "deleteSession");
        const commandFunction = allCommands.find((cmd) => command === cmd.cmd);
        await (commandFunction as any).fun(testNode, [testNode], true);
        expect(deleteSessionSpy).toHaveBeenCalled();
    }

    it("zowe.ds.removeSession", async () => {
        await removeSessionTest("zowe.ds.removeSession", globals.DS_SESSION_CONTEXT, DatasetTree);
    });

    it("zowe.uss.removeSession", async () => {
        await removeSessionTest("zowe.uss.removeSession", globals.USS_SESSION_CONTEXT, USSTree);
    });
});

describe("Extension Unit Tests - THEIA", () => {
    it("Tests that activate() works correctly for Theia", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(ProfilesUtils, "getCredentialManagerOverride").mockReturnValueOnce("@zowe/cli");

        Object.defineProperty(vscode.env, "appName", { value: "Eclipse Theia" });
        Object.defineProperty(vscode.env, "uriScheme", { value: "theia" });
        Object.defineProperty(vscode.env, "uiKind", { value: vscode.UIKind.Web });
        globalMocks.mockExistsSync.mockReset();
        globalMocks.mockReaddirSync.mockReset();
        globalMocks.mockExistsSync.mockReturnValueOnce(false);
        globalMocks.mockGetConfiguration.mockReturnValue({
            persistence: true,
            get: (_setting: string) => "",
            update: jest.fn(),
            inspect: (_configuration: string) => {
                return {
                    workspaceValue: undefined,
                    globalValue: undefined,
                };
            },
        });

        await extension.activate(globalMocks.mockExtension);

        expect(globals.ISTHEIA).toEqual(true);
        expect(globalMocks.mockMkdirSync.mock.calls.length).toBe(6);
        expect(globalMocks.mockRegisterCommand.mock.calls.length).toBe(globals.COMMAND_COUNT);
        globalMocks.mockRegisterCommand.mock.calls.forEach((call, i) => {
            expect(call[0]).toStrictEqual(globalMocks.expectedCommands[i]);
            expect(call[1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        globalMocks.mockRegisterCommand.mock.calls.forEach((call) => {
            actualCommands.push(call[0]);
        });
        expect(actualCommands).toEqual(globalMocks.expectedCommands);
    });

    it("Tests getSelectedNodeList executes successfully with multiple selection", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const nodeList = [blockMocks.rootNode, blockMocks.testNode];
        const res = getSelectedNodeList(blockMocks.testNode, nodeList);
        expect(res).toEqual(nodeList);
    });

    it("Tests getSelectedNodeList executes successfully when no multiple selection", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const res = getSelectedNodeList(blockMocks.testNode, undefined);
        expect(res[0]).toEqual(blockMocks.testNode);
    });
});
