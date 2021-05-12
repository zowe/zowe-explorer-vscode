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

import * as vscode from "vscode";
import * as path from "path";
import * as zowe from "@zowe/cli";
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as imperative from "@zowe/imperative";
import * as extension from "../../src/extension";
import * as globals from "../../src/globals";
import { ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../src/Profiles";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { createIProfile, createTreeView } from "../../__mocks__/mockCreators/shared";
import { PersistentFilters } from "../../src/PersistentFilters";

jest.mock("vscode");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("util");
jest.mock("isbinaryfile");

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockMkdirSync: jest.fn(),
        mockMoveSync: jest.fn(),
        mockGetAllProfileNames: jest.fn(),
        mockReveal: jest.fn(),
        mockCreateTreeView: jest.fn(),
        mockRegisterCommand: jest.fn(),
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
        mockCreateBasicZosmfSession: jest.fn(),
        mockUtilities: jest.fn(),
        mockShowInformationMessage: jest.fn(),
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
        mockInitialize: jest.fn(),
        mockGetImperativeConfig: jest.fn().mockReturnValue({ profiles: [] }),
        mockCliProfileManager: jest.fn().mockImplementation(() => {
            return { GetAllProfileNames: globalMocks.mockGetAllProfileNames, Load: globalMocks.mockLoad };
        }),
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
        },
        mockExtension: null,
        appName: vscode.env.appName,
        expectedCommands: [
            "zowe.addSession",
            "zowe.addFavorite",
            "zowe.refreshAll",
            "zowe.refreshNode",
            "zowe.pattern",
            "zowe.editSession",
            "zowe.ZoweNode.openPS",
            "zowe.createDataset",
            "zowe.all.profilelink",
            "zowe.createMember",
            "zowe.deleteDataset",
            "zowe.allocateLike",
            "zowe.uploadDialog",
            "zowe.deleteMember",
            "zowe.editDataSet",
            "zowe.editMember",
            "zowe.removeSession",
            "zowe.removeFavorite",
            "zowe.saveSearch",
            "zowe.removeSavedSearch",
            "zowe.removeFavProfile",
            "zowe.submitJcl",
            "zowe.submitMember",
            "zowe.showDSAttributes",
            "zowe.renameDataSet",
            "zowe.copyMember",
            "zowe.copyDataSet",
            "zowe.pasteMember",
            "zowe.renameDataSetMember",
            "zowe.hMigrateDataSet",
            "zowe.hRecallDataSet",
            "zowe.disableValidation",
            "zowe.enableValidation",
            "zowe.ssoLogin",
            "zowe.ssoLogout",
            "zowe.uss.addFavorite",
            "zowe.uss.removeFavorite",
            "zowe.uss.addSession",
            "zowe.uss.refreshAll",
            "zowe.uss.refreshUSS",
            "zowe.uss.refreshUSSInTree",
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
            "zowe.uss.copyPath",
            "zowe.uss.editFile",
            "zowe.uss.saveSearch",
            "zowe.uss.removeSavedSearch",
            "zowe.uss.removeFavProfile",
            "zowe.uss.disableValidation",
            "zowe.uss.enableValidation",
            "zowe.uss.ssoLogin",
            "zowe.uss.ssoLogout",
            "zowe.zosJobsOpenspool",
            "zowe.deleteJob",
            "zowe.runModifyCommand",
            "zowe.runStopCommand",
            "zowe.refreshJobsServer",
            "zowe.refreshAllJobs",
            "zowe.addJobsSession",
            "zowe.setOwner",
            "zowe.setPrefix",
            "zowe.removeJobsSession",
            "zowe.downloadSpool",
            "zowe.getJobJcl",
            "zowe.setJobSpool",
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
            "zowe.openRecentMember",
            "zowe.searchInAllLoadedItems",
            "zowe.deleteProfile",
            "zowe.cmd.deleteProfile",
            "zowe.uss.deleteProfile",
            "zowe.jobs.deleteProfile",
            "zowe.issueTsoCmd",
            "zowe.issueMvsCmd",
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
    Object.defineProperty(vscode, "Uri", { value: globalMocks.mockUri, configurable: true });
    Object.defineProperty(vscode.commands, "registerCommand", {
        value: globalMocks.mockRegisterCommand,
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
    Object.defineProperty(fs, "readdirSync", { value: globalMocks.mockReaddirSync, configurable: true });
    Object.defineProperty(fs, "createReadStream", { value: globalMocks.mockCreateReadStream, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(fs, "existsSync", { value: globalMocks.mockExistsSync, configurable: true });
    Object.defineProperty(fs, "unlinkSync", { value: globalMocks.mockUnlinkSync, configurable: true });
    Object.defineProperty(fs, "rmdirSync", { value: globalMocks.mockRmdirSync, configurable: true });
    Object.defineProperty(fs, "readFileSync", { value: globalMocks.mockReadFileSync, configurable: true });
    Object.defineProperty(fsextra, "moveSync", { value: globalMocks.mockMoveSync, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: globalMocks.mockShowErrorMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.mockZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.mockZosmfSession, "createBasicZosmfSession", {
        value: globalMocks.mockCreateBasicZosmfSession,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.mockShowInformationMessage,
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
    Object.defineProperty(Profiles, "createInstance", {
        value: jest.fn(() => globalMocks.testProfileOps),
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.testProfileOps),
    });
    Object.defineProperty(PersistentFilters, "getDirectValue", {
        value: jest.fn(() => {
            return {
                "Zowe-Automatic-Validation": true,
            };
        }),
    });

    // Create a mocked extension context
    // tslint:disable-next-line: no-object-literal-type-assertion
    const mockExtensionCreator = jest.fn(
        () =>
            ({
                subscriptions: [],
                extensionPath: path.join(__dirname, ".."),
            } as vscode.ExtensionContext)
    );
    globalMocks.mockExtension = new mockExtensionCreator();

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockCreateBasicZosmfSession.mockReturnValue(globalMocks.testSession);
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
    it("Testing that activate correctly executes", async () => {
        const globalMocks = await createGlobalMocks();

        // tslint:disable-next-line: no-object-literal-type-assertion
        globalMocks.mockReadFileSync.mockReturnValueOnce('{ "overrides": { "CredentialManager": "Managed by ANO" }}');
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockExistsSync.mockReturnValueOnce(false);
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockReaddirSync.mockReturnValueOnce(["firstFile.txt", "secondFile.txt", "firstDir"]);
        globalMocks.mockReaddirSync.mockReturnValueOnce(["thirdFile.txt"]);
        globalMocks.mockReaddirSync.mockReturnValue([]);
        globalMocks.mockIsFile.mockReturnValueOnce(true);
        globalMocks.mockIsFile.mockReturnValueOnce(false);
        globalMocks.mockGetConfiguration.mockReturnValue({
            persistence: true,
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ],
            // tslint:disable-next-line: no-empty
            update: jest.fn(() => {
                {
                }
            }),
        });

        await extension.activate(globalMocks.mockExtension);

        // Check that deactivate() is called successfully
        // tslint:disable-next-line: no-magic-numbers
        expect(globalMocks.mockExistsSync.mock.calls.length).toBe(4);
        expect(globalMocks.mockExistsSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        expect(globalMocks.mockReaddirSync.mock.calls.length).toBe(1);
        expect(globalMocks.mockReaddirSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        expect(globalMocks.mockUnlinkSync.mock.calls.length).toBe(2);
        expect(globalMocks.mockUnlinkSync.mock.calls[0][0]).toBe(path.join(globals.ZOWETEMPFOLDER + "/firstFile.txt"));
        expect(globalMocks.mockUnlinkSync.mock.calls[1][0]).toBe(path.join(globals.ZOWETEMPFOLDER + "/secondFile.txt"));
        expect(globalMocks.mockRmdirSync.mock.calls.length).toBe(1);
        expect(globalMocks.mockRmdirSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        // tslint:disable-next-line: no-magic-numbers
        expect(globalMocks.mockMkdirSync.mock.calls.length).toBe(4);

        // Check that tree providers are initialized successfully
        // tslint:disable-next-line: no-magic-numbers
        expect(globalMocks.mockCreateTreeView.mock.calls.length).toBe(3);
        expect(globalMocks.mockCreateTreeView.mock.calls[0][0]).toBe("zowe.explorer");
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
            expect(globalMocks.mockRegisterCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        globalMocks.mockRegisterCommand.mock.calls.forEach((call) => {
            actualCommands.push(call[0]);
        });
        expect(actualCommands).toEqual(globalMocks.expectedCommands);
    });

    it("Tests that activate correctly executes if no configuration is set", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.mockExistsSync.mockReturnValueOnce(false);
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        // tslint:disable-next-line: no-empty
        globalMocks.mockRmdirSync.mockImplementationOnce(() => {});
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: (setting: string) => [""],
            // tslint:disable-next-line: no-empty
            update: jest.fn(() => {
                {
                }
            }),
        });

        await extension.activate(globalMocks.mockExtension);

        expect(globalMocks.mockExistsSync.mock.calls.length).toBe(2);
        expect(globalMocks.mockReaddirSync.mock.calls.length).toBe(0);
    });

    it("Tests that activate() works correctly for Theia", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(vscode.env, "appName", { value: "Eclipse Theia" });
        Object.defineProperty(vscode.env, "uiKind", { value: vscode.UIKind.Web });
        globalMocks.mockExistsSync.mockReset();
        globalMocks.mockReaddirSync.mockReset();
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockExistsSync.mockReturnValueOnce(true);
        globalMocks.mockReaddirSync.mockReturnValueOnce(["firstFile", "secondFile"]);
        globalMocks.mockUnlinkSync.mockImplementationOnce(() => {
            return;
        });
        globalMocks.mockUnlinkSync.mockImplementationOnce(() => {
            return;
        });
        globalMocks.mockUnlinkSync.mockImplementationOnce(() => {
            throw Error("testError");
        });
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: (setting: string) => "theia",
            // tslint:disable-next-line: no-empty
            update: jest.fn(() => {
                {
                }
            }),
        });

        await extension.activate(globalMocks.mockExtension);

        expect(globals.ISTHEIA).toEqual(true);
        // tslint:disable-next-line: no-magic-numbers
        expect(globalMocks.mockMkdirSync.mock.calls.length).toBe(4);
        expect(globalMocks.mockRegisterCommand.mock.calls.length).toBe(globals.COMMAND_COUNT);
        globalMocks.mockRegisterCommand.mock.calls.forEach((call, i) => {
            expect(globalMocks.mockRegisterCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        globalMocks.mockRegisterCommand.mock.calls.forEach((call) => {
            actualCommands.push(call[0]);
        });
        expect(actualCommands).toEqual(globalMocks.expectedCommands);
    });
});
