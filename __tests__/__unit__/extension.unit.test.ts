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
import { Profiles, ValidProfileEnum } from "../../src/Profiles";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";

const expectedCommands = [
    "zowe.addSession",
    "zowe.addFavorite",
    "zowe.refreshAll",
    "zowe.refreshNode",
    "zowe.pattern",
    "zowe.ZoweNode.openPS",
    "zowe.createDataset",
    "zowe.createMember",
    "zowe.deleteDataset",
    "zowe.deletePDS",
    "zowe.uploadDialog",
    "zowe.deleteMember",
    "zowe.editMember",
    "zowe.removeSession",
    "zowe.removeFavorite",
    "zowe.saveSearch",
    "zowe.removeSavedSearch",
    "zowe.submitJcl",
    "zowe.submitMember",
    "zowe.showDSAttributes",
    "zowe.renameDataSet",
    "zowe.copyDataSet",
    "zowe.pasteDataSet",
    "zowe.renameDataSetMember",
    "zowe.hMigrateDataSet",
    "zowe.uss.addFavorite",
    "zowe.uss.removeFavorite",
    "zowe.uss.addSession",
    "zowe.uss.refreshAll",
    "zowe.uss.refreshUSS",
    "zowe.uss.refreshUSSInTree",
    "zowe.uss.fullPath",
    "zowe.uss.ZoweUSSNode.open",
    "zowe.uss.removeSession",
    "zowe.uss.createFile",
    "zowe.uss.createFolder",
    "zowe.uss.deleteNode",
    "zowe.uss.binary",
    "zowe.uss.text",
    "zowe.uss.renameNode",
    "zowe.uss.uploadDialog",
    "zowe.uss.createNode",
    "zowe.uss.copyPath",
    "zowe.uss.editFile",
    "zowe.uss.saveSearch",
    "zowe.uss.removeSavedSearch",
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
    "zowe.issueTsoCmd",
    "zowe.issueMvsCmd",
    "zowe.jobs.addFavorite",
    "zowe.jobs.removeFavorite",
    "zowe.jobs.saveSearch",
    "zowe.jobs.removeSearchFavorite",
    "zowe.openRecentMember",
    "zowe.searchInAllLoadedItems"
];

jest.mock("vscode");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("util");
jest.mock("isbinaryfile");

describe("Extension Unit Tests", () => {
    const mockLoadNamedProfile = jest.fn();
    const mkdirSync = jest.fn();
    const moveSync = jest.fn();
    const getAllProfileNames = jest.fn();
    const mockReveal = jest.fn();
    const createTreeView = jest.fn();
    const registerCommand = jest.fn();
    const onDidSaveTextDocument = jest.fn();
    const onDidChangeSelection = jest.fn();
    const onDidChangeVisibility = jest.fn();
    const onDidCollapseElement = jest.fn();
    const onDidExpandElement = jest.fn();
    const existsSync = jest.fn();
    const createReadStream = jest.fn();
    const readdirSync = jest.fn();
    const unlinkSync = jest.fn();
    const rmdirSync = jest.fn();
    const readFileSync = jest.fn();
    const showErrorMessage = jest.fn();
    const showWarningMessage = jest.fn();
    const ZosmfSession = jest.fn();
    const createBasicZosmfSession = jest.fn();
    const Utilities = jest.fn();
    const showInformationMessage = jest.fn();
    const getConfiguration = jest.fn();
    const onDidChangeConfiguration = jest.fn();
    const isFile = jest.fn();
    const load = jest.fn();
    const registerTextDocumentContentProvider = jest.fn();
    const from = jest.fn();
    const Uri = jest.fn();
    const getProfileName = jest.fn();
    const cliHome = jest.fn().mockReturnValue(path.join(os.homedir(), ".zowe"));
    const icInstance = jest.fn();
    const ImperativeConfig = jest.fn();
    const initialize = jest.fn();
    const getImperativeConfig = jest.fn().mockReturnValue({profiles: []});
    const CliProfileManager = jest.fn().mockImplementation(() => ({ getAllProfileNames, load }));
    const TreeView = jest.fn().mockImplementation(() => {
        return {
            reveal: mockReveal,
            onDidExpandElement,
            onDidCollapseElement,
            selection: [],
            onDidChangeSelection,
            visible: true,
            onDidChangeVisibility
        };
    });
    const enums = jest.fn().mockImplementation(() => {
        return {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3
        };
    });

    Object.defineProperty(fs, "mkdirSync", {value: mkdirSync});
    Object.defineProperty(imperative, "CliProfileManager", {value: CliProfileManager});
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    Object.defineProperty(vscode, "Uri", {value: Uri});
    Object.defineProperty(vscode.commands, "registerCommand", {value: registerCommand});
    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", {value: onDidSaveTextDocument});
    Object.defineProperty(vscode.window, "onDidCollapseElement", {value: onDidCollapseElement});
    Object.defineProperty(vscode.window, "onDidExpandElement", {value: onDidExpandElement});
    Object.defineProperty(vscode.workspace, "getConfiguration", {value: getConfiguration});
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {value: onDidChangeConfiguration});
    Object.defineProperty(fs, "readdirSync", {value: readdirSync});
    Object.defineProperty(fs, "createReadStream", {value: createReadStream});
    Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
    Object.defineProperty(fs, "existsSync", {value: existsSync});
    Object.defineProperty(fs, "unlinkSync", {value: unlinkSync});
    Object.defineProperty(fs, "rmdirSync", {value: rmdirSync});
    Object.defineProperty(fs, "readFileSync", {value: readFileSync});
    Object.defineProperty(fsextra, "moveSync", {value: moveSync});
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "showWarningMessage", {value: showWarningMessage});
    Object.defineProperty(zowe, "ZosmfSession", {value: ZosmfSession});
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {value: createBasicZosmfSession});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(zowe, "Utilities", {value: Utilities});
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", { value: registerTextDocumentContentProvider});
    Object.defineProperty(vscode.Disposable, "from", {value: from});
    Object.defineProperty(ZoweDatasetNode, "getProfileName", { value: getProfileName });
    Object.defineProperty(CliProfileManager, "initialize", { value: initialize });
    Object.defineProperty(zowe, "getImperativeConfig", { value: getImperativeConfig });
    Object.defineProperty(imperative, "ImperativeConfig", { value: ImperativeConfig });
    Object.defineProperty(ImperativeConfig, "instance", { value: icInstance });
    Object.defineProperty(icInstance, "cliHome", { get: cliHome });
    Object.defineProperty(Profiles, "createInstance", {
        value: jest.fn(() => profileOps)
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => profileOps)
    });

    const session = new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
    const profileOne: imperative.IProfileLoaded = {
        name: "sestest",
        profile: {
            user: undefined,
            password: undefined
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
    const profileOps = {
        allProfiles: [{name: "firstName"}, {name: "secondName"}],
        defaultProfile: {name: "firstName"},
        getDefaultProfile: mockLoadNamedProfile,
        loadNamedProfile: mockLoadNamedProfile,
        validProfile: ValidProfileEnum.VALID,
        checkCurrentProfile: jest.fn(),
        usesSecurity: jest.fn().mockReturnValue(true)
    };
    // tslint:disable-next-line: no-object-literal-type-assertion
    const extensionMock = jest.fn(() => ({
        subscriptions: [],
        extensionPath: path.join(__dirname, "..")
    } as vscode.ExtensionContext));
    const mock = new extensionMock();
    const appName = vscode.env.appName;

    beforeEach(() => {
        Object.defineProperty(vscode.env, "appName", { value: appName });
        mockLoadNamedProfile.mockReturnValue(profileOne);
        createBasicZosmfSession.mockReturnValue(session);
        createTreeView.mockReturnValue(new TreeView());
        readFileSync.mockReturnValue("");
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        Object.defineProperty(vscode.env, "appName", { value: appName });
    });

    it("Testing that activate correctly executes", async () => {
        // tslint:disable-next-line: no-object-literal-type-assertion
        readFileSync.mockReturnValueOnce('{ "overrides": { "CredentialManager": "Managed by ANO" }}');
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile.txt", "secondFile.txt", "firstDir"]);
        readdirSync.mockReturnValueOnce(["thirdFile.txt"]);
        readdirSync.mockReturnValue([]);
        isFile.mockReturnValueOnce(true);
        isFile.mockReturnValueOnce(false);
        getConfiguration.mockReturnValue({
            persistence: true,
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ],
            // tslint:disable-next-line: no-empty
            update: jest.fn(()=>{ {} })
        });

        await extension.activate(mock);

        // Check that deactivate() is called successfully
        // tslint:disable-next-line: no-magic-numbers
        expect(existsSync.mock.calls.length).toBe(4);
        expect(existsSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        expect(readdirSync.mock.calls.length).toBe(1);
        expect(readdirSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        expect(unlinkSync.mock.calls.length).toBe(2);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(globals.ZOWETEMPFOLDER + "/firstFile.txt"));
        expect(unlinkSync.mock.calls[1][0]).toBe(path.join(globals.ZOWETEMPFOLDER + "/secondFile.txt"));
        expect(rmdirSync.mock.calls.length).toBe(1);
        expect(rmdirSync.mock.calls[0][0]).toBe(globals.ZOWETEMPFOLDER);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);

        // Check that tree providers are initialized successfully
        // tslint:disable-next-line: no-magic-numbers
        expect(createTreeView.mock.calls.length).toBe(3);
        expect(createTreeView.mock.calls[0][0]).toBe("zowe.explorer");
        expect(createTreeView.mock.calls[1][0]).toBe("zowe.uss.explorer");

        // Check that CLI Profile Manager is initialized successfully
        expect(initialize.mock.calls.length).toBe(1);
        expect(initialize.mock.calls[0][0]).toStrictEqual({
            configuration: [],
            profileRootDirectory: path.join(cliHome(), "profiles")
        });

        // Checking if commands are registered properly
        expect(registerCommand.mock.calls.length).toBe(globals.COMMAND_COUNT);
        registerCommand.mock.calls.forEach((call, i ) => {
            expect(registerCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        registerCommand.mock.calls.forEach((call) => { actualCommands.push(call[0]); });
        expect(actualCommands).toEqual(expectedCommands);
    });

    it("Tests that activate correctly executes if no configuration is set", async () => {
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        // tslint:disable-next-line: no-empty
        rmdirSync.mockImplementationOnce(() => {});
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [ "", ],
            // tslint:disable-next-line: no-empty
            update: jest.fn(()=>{ {} })
        });

        await extension.activate(mock);
        expect(existsSync.mock.calls.length).toBe(2);
        expect(readdirSync.mock.calls.length).toBe(0);
    });

    it("Tests that activate() works correctly for Theia", async () => {
        Object.defineProperty(vscode.env, "appName", { value: "Eclipse Theia" });
        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile", "secondFile"]);
        unlinkSync.mockImplementationOnce(() => { return; });
        unlinkSync.mockImplementationOnce(() => { return; });
        unlinkSync.mockImplementationOnce(() => { throw (Error("testError")); });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => "theia",
            // tslint:disable-next-line: no-empty
            update: jest.fn(()=>{ {} })
        });

        await extension.activate(mock);
        expect(globals.ISTHEIA).toEqual(true);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        expect(registerCommand.mock.calls.length).toBe(globals.COMMAND_COUNT);
        registerCommand.mock.calls.forEach((call, i ) => {
            expect(registerCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        registerCommand.mock.calls.forEach((call) => { actualCommands.push(call[0]); });
        expect(actualCommands).toEqual(expectedCommands);
    });
});
