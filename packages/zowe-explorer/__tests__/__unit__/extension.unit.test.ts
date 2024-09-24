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
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as extension from "../../src/extension";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { imperative, Gui, Validation, ProfilesCache, FileManagement } from "@zowe/zowe-explorer-api";
import { createGetConfigMock, createInstanceOfProfileInfo, createIProfile, createTreeView } from "../__mocks__/mockCreators/shared";
import { Constants } from "../../src/configuration/Constants";
import { Profiles } from "../../src/configuration/Profiles";
import { SettingsConfig } from "../../src/configuration/SettingsConfig";
import { ZoweExplorerExtender } from "../../src/extending/ZoweExplorerExtender";
import { ZoweLocalStorage } from "../../src/tools/ZoweLocalStorage";
import { ZoweSaveQueue } from "../../src/tools/ZoweSaveQueue";
import { DatasetTree } from "../../src/trees/dataset/DatasetTree";
import { ZoweDatasetNode } from "../../src/trees/dataset/ZoweDatasetNode";
import { USSTree } from "../../src/trees/uss/USSTree";
import { ProfilesUtils } from "../../src/utils/ProfilesUtils";
import { JobTree } from "../../src/trees/job/JobTree";

jest.mock("../../src/utils/LoggerUtils");
jest.mock("../../src/tools/ZoweLogger");
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
        mockUri: jest.fn(),
        mockGetProfileName: jest.fn(),
        mockCliHome: jest.fn().mockReturnValue(path.join(os.homedir(), ".zowe")),
        mockIcInstance: jest.fn(),
        mockImperativeConfig: jest.fn(),
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
                getZoweDir: jest.fn(),
            };
        }),
        mockUpdateCredMgrSetting: jest.fn(),
        mockWriteOverridesFile: jest.fn(),
        mockProfCacheProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
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
        testSession: new imperative.Session({
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
            validProfile: Validation.ValidationType.VALID,
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
            "zowe.all.config.init",
            "zowe.ds.addSession",
            "zowe.ds.refreshAll",
            "zowe.ds.refreshNode",
            "zowe.ds.refreshDataset",
            "zowe.ds.pattern",
            "zowe.ds.createDataset",
            "zowe.ds.createMember",
            "zowe.ds.deleteDataset",
            "zowe.ds.allocateLike",
            "zowe.ds.uploadDialog",
            "zowe.ds.deleteMember",
            "zowe.ds.editDataSet",
            "zowe.ds.editMember",
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
            "zowe.ds.sortBy",
            "zowe.ds.filterBy",
            "zowe.ds.copyName",
            "zowe.uss.addSession",
            "zowe.uss.refreshAll",
            "zowe.uss.refreshUSS",
            "zowe.uss.refreshUSSInTree",
            "zowe.uss.refreshDirectory",
            "zowe.uss.fullPath",
            "zowe.uss.createFile",
            "zowe.uss.createFolder",
            "zowe.uss.deleteNode",
            "zowe.uss.renameNode",
            "zowe.uss.uploadDialog",
            "zowe.uss.uploadDialogBinary",
            "zowe.uss.copyPath",
            "zowe.uss.editFile",
            "zowe.uss.editAttributes",
            "zowe.uss.pasteUssFile",
            "zowe.uss.copyUssFile",
            "zowe.uss.copyRelativePath",
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
            "zowe.jobs.downloadSpool",
            "zowe.jobs.downloadSpoolBinary",
            "zowe.jobs.getJobJcl",
            "zowe.jobs.setJobSpool",
            "zowe.jobs.search",
            "zowe.jobs.startPolling",
            "zowe.jobs.stopPolling",
            "zowe.jobs.cancelJob",
            "zowe.jobs.sortBy",
            "zowe.jobs.filterJobs",
            "zowe.jobs.copyName",
            "zowe.jobs.tableView",
            "zowe.updateSecureCredentials",
            "zowe.manualPoll",
            "zowe.editHistory",
            "zowe.promptCredentials",
            "zowe.profileManagement",
            "zowe.diff.useLocalContent",
            "zowe.diff.useRemoteContent",
            "zowe.certificateWizard",
            "zowe.openRecentMember",
            "zowe.searchInAllLoadedItems",
            "zowe.disableValidation",
            "zowe.enableValidation",
            "zowe.ssoLogin",
            "zowe.ssoLogout",
            "zowe.deleteProfile",
            "zowe.editSession",
            "zowe.removeSession",
            "zowe.saveSearch",
            "zowe.addFavorite",
            "zowe.removeFavorite",
            "zowe.removeFavProfile",
            "zowe.openWithEncoding",
            "zowe.issueTsoCmd",
            "zowe.issueUnixCmd",
            "zowe.issueMvsCmd",
            "zowe.selectForCompare",
            "zowe.compareWithSelected",
            "zowe.compareWithSelectedReadOnly",
            "zowe.compareFileStarted",
            "zowe.placeholderCommand",
        ],
    };

    Object.defineProperty(fs, "mkdirSync", { value: globalMocks.mockMkdirSync, configurable: true });
    Object.defineProperty(imperative, "CliProfileManager", {
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

    jest.spyOn(vscode.workspace, "getConfiguration").mockImplementationOnce(globalMocks.mockGetConfiguration);
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {
        value: globalMocks.mockOnDidChangeConfiguration,
        configurable: true,
    });
    Object.defineProperty(ProfilesUtils, "mockUpdateCredentialManagerSetting", {
        value: globalMocks.mockUpdateCredMgrSetting,
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
    Object.defineProperty(zosmf, "ZosmfSession", { value: globalMocks.mockZosmfSession, configurable: true });
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
    Object.defineProperty(zosfiles, "Utilities", { value: globalMocks.mockUtilities, configurable: true });
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", {
        value: globalMocks.mockRegisterTextDocumentContentProvider,
        configurable: true,
    });
    Object.defineProperty(vscode.Disposable, "from", { value: globalMocks.mockFrom, configurable: true });
    Object.defineProperty(ZoweDatasetNode, "getProfileName", {
        value: globalMocks.mockGetProfileName,
        configurable: true,
    });
    Object.defineProperty(imperative, "ImperativeConfig", {
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
    Object.defineProperty(imperative, "ProfileInfo", {
        get: globalMocks.mockImperativeProfileInfo,
        configurable: true,
    });

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

    Object.defineProperty(ZoweLocalStorage, "initializeZoweLocalStorage", {
        value: jest.fn(),
        configurable: true,
    });
    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
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

describe("Extension Unit Tests", () => {
    const allCommands: Array<{ cmd: string; fun: () => void; toMock: () => void }> = [];
    let globalMocks;
    beforeAll(async () => {
        globalMocks = await createGlobalMocks();
        jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from(JSON.stringify({ overrides: { credentialManager: "@zowe/cli" } }), "utf-8"));
        Object.defineProperty(imperative, "ProfileInfo", {
            get: globalMocks.mockImperativeProfileInfo,
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

        // Checking if commands are registered properly
        expect(globalMocks.mockRegisterCommand.mock.calls.length).toBe(Constants.COMMAND_COUNT);

        globalMocks.mockRegisterCommand.mock.calls.forEach((call, i) => {
            expect(call[0]).toStrictEqual(globalMocks.expectedCommands[i]);
            expect(call[1]).toBeInstanceOf(Function);
            allCommands.push({ cmd: call[0], fun: call[1], toMock: jest.fn() });
        });
    });

    it("Testing that activate correctly executes", () => {
        expect(allCommands.map((c) => c.cmd)).toEqual(globalMocks.expectedCommands);
    });

    it("Tests that activate() fails when trying to load with an invalid config", async () => {
        // Mock the FileManagement.getZoweDir to avoid calling the static method: ProfileInfo.getZoweDir()
        jest.spyOn(FileManagement, "getZoweDir").mockImplementation();

        Object.defineProperty(imperative, "ProfileInfo", {
            value: jest.fn().mockImplementation(() => {
                throw new Error("Error in ProfileInfo to break activate function");
            }),
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
        expect(ZoweExplorerExtender.showZoweConfigError).toHaveBeenCalled();
    });
    it("should deactivate the extension", async () => {
        const spyAwaitAllSaves = jest.spyOn(ZoweSaveQueue, "all");
        await extension.deactivate();
        expect(spyAwaitAllSaves).toHaveBeenCalled();
        // Test that upload operations complete before cleaning temp dir
        expect(Constants.ACTIVATED).toBe(false);
    });
    it("Testing that activate correctly executes", () => {
        expect(allCommands.map((c) => c.cmd)).toEqual(globalMocks.expectedCommands);
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
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            persistence: true,
            get: () => {
                return [];
            },
            update: jest.fn(),
            inspect: (_configuration: string) => {
                return {
                    workspaceValue: undefined,
                    globalValue: undefined,
                };
            },
        });
        await removeSessionTest("zowe.removeSession", Constants.DS_SESSION_CONTEXT, DatasetTree);
    });

    it("zowe.uss.removeSession", async () => {
        await removeSessionTest("zowe.removeSession", Constants.USS_SESSION_CONTEXT, USSTree);
    });

    it("zowe.jobs.removeSession", async () => {
        await removeSessionTest("zowe.removeSession", Constants.JOBS_SESSION_CONTEXT, JobTree);
    });
});
