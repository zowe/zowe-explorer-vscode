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
import * as utils from "../../src/utils";
import * as path from "path";
import * as zowe from "@zowe/cli";
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as imperative from "@zowe/imperative";
import * as extension from "../../src/extension";
import * as globals from "../../src/globals";
import * as sharedUtils from "../../src/shared/utils";
import { Profiles, ValidProfileEnum } from "../../src/Profiles";
import * as treeMock from "../../src/__mocks__/DatasetTree";
import * as treeUSSMock from "../../src/__mocks__/USSTree";
import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";
import { getIconByNode } from "../../src/generators/icons";
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
jest.mock("Session");
jest.mock("@zowe/cli");
jest.mock("@zowe/imperative");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("util");
jest.mock("isbinaryfile");
jest.mock("DatasetTree");
jest.mock("USSTree");

describe("Extension Unit Tests", () => {
    // Globals
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
    let mockLoadNamedProfile = jest.fn();
    mockLoadNamedProfile.mockReturnValue(profileOne);
    const profileOps = {
        allProfiles: [{name: "firstName"}, {name: "secondName"}],
        defaultProfile: {name: "firstName"},
        getDefaultProfile: mockLoadNamedProfile,
        loadNamedProfile: mockLoadNamedProfile,
        validProfile: ValidProfileEnum.VALID,
        checkCurrentProfile: jest.fn(),
        usesSecurity: jest.fn().mockReturnValue(true)
    };
    Object.defineProperty(Profiles, "createInstance", {
        value: jest.fn(() => {
            return profileOps;
        })
    });
    // Object.defineProperty(Profiles, "getInstance", {
    //     value: jest.fn(() => {
    //         return profileOps;
    //     })
    // });

    const mvsApi = ZoweExplorerApiRegister.getMvsApi(profileOne);
    const getMvsApiMock = jest.fn();
    getMvsApiMock.mockReturnValue(mvsApi);
    ZoweExplorerApiRegister.getMvsApi = getMvsApiMock.bind(ZoweExplorerApiRegister);

    const ussApi = ZoweExplorerApiRegister.getUssApi(profileOne);
    const getUssApiMock = jest.fn();
    getUssApiMock.mockReturnValue(ussApi);
    ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);

    const jesApi = ZoweExplorerApiRegister.getJesApi(profileOne);
    const getJesApiMock = jest.fn();
    getJesApiMock.mockReturnValue(jesApi);
    ZoweExplorerApiRegister.getJesApi = getJesApiMock.bind(ZoweExplorerApiRegister);

    const mkdirSync = jest.fn();
    const moveSync = jest.fn();
    const getAllProfileNames = jest.fn();
    const mockReveal = jest.fn();
    const createWebviewPanel = jest.fn();
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
    // const showInputBox = jest.fn();
    const showOpenDialog = jest.fn();
    // const showQuickBox = jest.fn();
    const ZosmfSession = jest.fn();
    const createBasicZosmfSession = jest.fn();
    // const Upload = jest.fn();
    // const Delete = jest.fn();
    // const bufferToDataSet = jest.fn();
    // const pathToDataSet = jest.fn();
    // const delDataset = jest.fn();
    // const Create = jest.fn();
    // const dataSetCreate = jest.fn();
    // const Download = jest.fn();
    const Utilities = jest.fn();
    // const isFileTagBinOrAscii = jest.fn();
    // const dataSet = jest.fn();
    // const ussFile = jest.fn();
    // const List = jest.fn();
    // const Get = jest.fn();
    // const dataSetGet = jest.fn();
    // const fileToUSSFile = jest.fn();
    // const dataSetList = jest.fn();
    // const fileList = jest.fn();
    // const allMembers = jest.fn();
    // const openTextDocument = jest.fn();
    const showTextDocument = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const getConfiguration = jest.fn();
    const onDidChangeConfiguration = jest.fn();
    const executeCommand = jest.fn();
    // const activeTextEditor = jest.fn();
    // const document = jest.fn();
    // const getText = jest.fn();
    // const save = jest.fn();
    const isFile = jest.fn();
    const load = jest.fn();
    // const GetJobs = jest.fn();
    // const getSpoolContentById = jest.fn();
    // const getJclForJob = jest.fn();
    // const DownloadJobs = jest.fn();
    // const downloadAllSpoolContentCommon = jest.fn();
    // const SubmitJobs = jest.fn();
    // const submitJcl = jest.fn();
    // const submitJob = jest.fn();
    // const IssueCommand = jest.fn();
    // const issueSimple = jest.fn();
    const registerTextDocumentContentProvider = jest.fn();
    const from = jest.fn();
    const Uri = jest.fn();
    // const parse = jest.fn();
    const withProgress = jest.fn();
    // const Rename = jest.fn();
    // const renameDataSet = jest.fn();
    // const renameDataSetMember = jest.fn();
    // const Copy = jest.fn();
    // const copyDataSet = jest.fn();
    // const concatChildNodes = jest.fn();
    const getProfileName = jest.fn();
    // const HMigrate = jest.fn();
    // const hMigrateDataSet = jest.fn();
    // const closeOpenedTextFile = jest.fn();
    let mockClipboardData: string;
    const cliHome = jest.fn().mockReturnValue(path.join(os.homedir(), ".zowe"));
    const icInstance = jest.fn();
    const ImperativeConfig = jest.fn();
    const clipboard = {
        writeText: jest.fn().mockImplementation((value) => mockClipboardData = value),
        readText: jest.fn().mockImplementation(() => mockClipboardData),
    };
    const initialize = jest.fn();
    const getImperativeConfig = jest.fn().mockReturnValue({profiles: []});

    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15
        };
    });
    const CliProfileManager = jest.fn().mockImplementation(() => {
        return { getAllProfileNames, load };
    });
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

    mockLoadNamedProfile = jest.fn();
    // Object.defineProperty(sharedUtils, "concatChildNodes", {value: concatChildNodes});
    Object.defineProperty(fs, "mkdirSync", {value: mkdirSync});
    Object.defineProperty(imperative, "CliProfileManager", {value: CliProfileManager});
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    Object.defineProperty(vscode.window, "createWebviewPanel", {value: createWebviewPanel});
    Object.defineProperty(vscode, "Uri", {value: Uri});
    Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
    Object.defineProperty(vscode.commands, "registerCommand", {value: registerCommand});
    // Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", {value: onDidSaveTextDocument});
    Object.defineProperty(vscode.window, "onDidCollapseElement", {value: onDidCollapseElement});
    Object.defineProperty(vscode.window, "onDidExpandElement", {value: onDidExpandElement});
    Object.defineProperty(vscode.workspace, "getConfiguration", {value: getConfiguration});
    Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", {value: onDidChangeConfiguration});
    Object.defineProperty(fs, "readdirSync", {value: readdirSync});
    Object.defineProperty(fs, "createReadStream", {value: createReadStream});
    Object.defineProperty(fs, "existsSync", {value: existsSync});
    Object.defineProperty(fs, "unlinkSync", {value: unlinkSync});
    Object.defineProperty(fs, "rmdirSync", {value: rmdirSync});
    Object.defineProperty(fs, "readFileSync", {value: readFileSync});
    Object.defineProperty(fsextra, "moveSync", {value: moveSync});
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "showWarningMessage", {value: showWarningMessage});
    // Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    // Object.defineProperty(vscode.window, "showQuickBox", {value: showQuickBox});
    // Object.defineProperty(vscode.window, "activeTextEditor", {value: activeTextEditor});
    // Object.defineProperty(activeTextEditor, "document", {value: document});
    // Object.defineProperty(document, "save", {value: save});
    // Object.defineProperty(document, "getText", {value: getText});
    Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});
    Object.defineProperty(zowe, "ZosmfSession", {value: ZosmfSession});
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {value: createBasicZosmfSession});
    // Object.defineProperty(zowe, "Upload", {value: Upload});
    // Object.defineProperty(Upload, "bufferToDataSet", {value: bufferToDataSet});
    // Object.defineProperty(Upload, "pathToDataSet", {value: pathToDataSet});
    // Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
    // Object.defineProperty(zowe, "Create", {value: Create});
    // Object.defineProperty(Create, "dataSet", {value: dataSetCreate});
    // Object.defineProperty(zowe, "Get", {value: Get});
    // Object.defineProperty(Get, "dataSet", {value: dataSetGet});
    // Object.defineProperty(zowe, "List", {value: List});
    // Object.defineProperty(List, "dataSet", {value: dataSetList});
    // Object.defineProperty(List, "fileList", {value: fileList});
    // Object.defineProperty(List, "allMembers", {value: allMembers});
    // Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "showTextDocument", {value: showTextDocument});
    Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
    // Object.defineProperty(zowe, "Download", {value: Download});
    // Object.defineProperty(Download, "dataSet", {value: dataSet});
    // Object.defineProperty(zowe, "Delete", {value: Delete});
    // Object.defineProperty(Delete, "dataSet", {value: delDataset});
    Object.defineProperty(zowe, "Utilities", {value: Utilities});
    // Object.defineProperty(Download, "ussFile", {value: ussFile});
    // Object.defineProperty(Utilities, "isFileTagBinOrAscii", {value: isFileTagBinOrAscii});
    // Object.defineProperty(zowe, "GetJobs", {value: GetJobs});
    // Object.defineProperty(GetJobs, "getSpoolContentById", {value: getSpoolContentById});
    // Object.defineProperty(GetJobs, "getJclForJob", {value: getJclForJob});
    // Object.defineProperty(zowe, "DownloadJobs", {value: DownloadJobs});
    // Object.defineProperty(DownloadJobs, "downloadAllSpoolContentCommon", {value: downloadAllSpoolContentCommon});
    // Object.defineProperty(zowe, "SubmitJobs", {value: SubmitJobs});
    // Object.defineProperty(SubmitJobs, "submitJcl", {value: submitJcl});
    // Object.defineProperty(SubmitJobs, "submitJob", {value: submitJob});
    // Object.defineProperty(zowe, "IssueCommand", {value: IssueCommand});
    // Object.defineProperty(IssueCommand, "issueSimple", {value: issueSimple});
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", { value: registerTextDocumentContentProvider});
    Object.defineProperty(vscode.Disposable, "from", {value: from});
    // Object.defineProperty(vscode.Uri, "parse", {value: parse});
    // Object.defineProperty(zowe, "Rename", {value: Rename});
    // Object.defineProperty(Rename, "dataSet", { value: renameDataSet });
    // Object.defineProperty(zowe, "Copy", {value: Copy});
    // Object.defineProperty(Copy, "dataSet", { value: copyDataSet });
    // Object.defineProperty(zowe, "HMigrate", { value: HMigrate });
    // Object.defineProperty(HMigrate, "dataSet", { value: hMigrateDataSet });
    // Object.defineProperty(vscode.env, "clipboard", { value: clipboard });
    // Object.defineProperty(Rename, "dataSetMember", { value: renameDataSetMember });
    Object.defineProperty(ZoweDatasetNode, "getProfileName", { value: getProfileName });
    Object.defineProperty(CliProfileManager, "initialize", { value: initialize });
    Object.defineProperty(zowe, "getImperativeConfig", { value: getImperativeConfig });
    Object.defineProperty(imperative, "ImperativeConfig", { value: ImperativeConfig });
    Object.defineProperty(ImperativeConfig, "instance", { value: icInstance });
    Object.defineProperty(icInstance, "cliHome", { get: cliHome });
    // Object.defineProperty(utils, "closeOpenedTextFile", {value: closeOpenedTextFile});

    beforeEach(() => {
        mockLoadNamedProfile.mockReturnValue(profileOne);
        // Object.defineProperty(Profiles, "getInstance", {
        //     value: jest.fn(() => {
        //         return {
        //             allProfiles: [{name: "firstName"}, {name: "secondName"}],
        //             defaultProfile: {name: "firstName"},
        //             validProfile: ValidProfileEnum.VALID,
        //             getDefaultProfile: mockLoadNamedProfile,
        //             loadNamedProfile: mockLoadNamedProfile,
        //             promptCredentials: jest.fn(),
        //             usesSecurity: true,
        //             getProfiles: jest.fn(),
        //             checkCurrentProfile: jest.fn(),
        //             refresh: jest.fn(),
        //         };
        //     })
        // });

        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Testing that activate correctly executes", async () => {
        createTreeView.mockReturnValue(new TreeView());
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile.txt", "secondFile.txt", "firstDir"]);
        isFile.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["thirdFile.txt"]);
        readdirSync.mockReturnValue([]);
        isFile.mockReturnValueOnce(false);
        createBasicZosmfSession.mockReturnValue(session);
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: () => "folderpath",
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => "vscode",
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: () => "",
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValue({
            persistence: true,
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ],
            update: jest.fn(()=>{ return {}; })
        });
        const enums = jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3
            };
        });
        Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
        // tslint:disable-next-line: no-object-literal-type-assertion
        const extensionMock = jest.fn(() => ({
            subscriptions: [],
            extensionPath: path.join(__dirname, "..")
        } as vscode.ExtensionContext));
        const mock = new extensionMock();
        readFileSync.mockReturnValueOnce('{ "overrides": { "CredentialManager": "Managed by ANO" }}');

        await extension.activate(mock);

        const sampleFavorites = [
            new ZoweDatasetNode("[test]: brtvs99.public.test", vscode.TreeItemCollapsibleState.Collapsed,
                undefined, undefined, undefined, undefined, profileOne),
            new ZoweDatasetNode("[test]: brtvs99.test", vscode.TreeItemCollapsibleState.None,
                undefined, undefined, undefined, undefined, profileOne),
            new ZoweDatasetNode("[test]: brtvs99.test.search", vscode.TreeItemCollapsibleState.None,
                undefined, null, undefined, undefined, profileOne)
        ];
        sampleFavorites[0].contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        sampleFavorites[1].contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        sampleFavorites[2].contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        sampleFavorites[1].command = {
            command: "zowe.ZoweNode.openPS",
            title: "",
            arguments: [sampleFavorites[1]]
        };
        let targetIcon = getIconByNode(sampleFavorites[0]);
        if (targetIcon) { sampleFavorites[0].iconPath = targetIcon.path; }
        targetIcon = getIconByNode(sampleFavorites[1]);
        if (targetIcon) { sampleFavorites[1].iconPath = targetIcon.path; }
        targetIcon = getIconByNode(sampleFavorites[2]);
        if (targetIcon) { sampleFavorites[2].iconPath = targetIcon.path; }
        sampleFavorites[2].command = {command: "zowe.pattern", title: "", arguments: [sampleFavorites[2]]};
        sampleFavorites[2].iconPath = {
            dark: path.join(__dirname, "..", "..", "..", "resources", "dark", "pattern.svg"),
            light: path.join(__dirname, "..", "..", "..", "resources", "light", "pattern.svg")
        };
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        // tslint:disable-next-line: no-magic-numbers
        expect(createTreeView.mock.calls.length).toBe(3);
        expect(createTreeView.mock.calls[0][0]).toBe("zowe.explorer");
        expect(createTreeView.mock.calls[1][0]).toBe("zowe.uss.explorer");
        // tslint:disable-next-line: no-magic-numbers
        expect(registerCommand.mock.calls.length).toBe(68);
        registerCommand.mock.calls.forEach((call, i ) => {
            expect(registerCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        registerCommand.mock.calls.forEach((call) => { actualCommands.push(call[0]); });
        expect(actualCommands).toEqual(expectedCommands);
        expect(onDidSaveTextDocument.mock.calls.length).toBe(1);
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
        expect(initialize.mock.calls.length).toBe(1);
        expect(initialize.mock.calls[0][0]).toStrictEqual({
            configuration: [],
            profileRootDirectory: path.join(cliHome(), "profiles")
        });

        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(false);
        // tslint:disable-next-line: no-empty
        rmdirSync.mockImplementationOnce(() => {});
        readFileSync.mockReturnValue("");
        getConfiguration.mockReturnValueOnce({
            get: () => "",
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => undefined,
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{ return {}; })
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [ "", ],
            update: jest.fn(()=>{ return {}; })
        });
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);

        await extension.activate(mock);
        expect(existsSync.mock.calls.length).toBe(2);
        expect(readdirSync.mock.calls.length).toBe(0);

        // Testing that activate() works correctly for Theia
        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile", "secondFile"]);
        getConfiguration.mockReturnValueOnce({
            get: () => { return [""]; },
            update: jest.fn(()=>{ return {}; })
        });
        unlinkSync.mockImplementationOnce(() => { return; });
        unlinkSync.mockImplementationOnce(() => { return; });
        unlinkSync.mockImplementationOnce(() => { throw (Error("testError")); });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => "theia",
            update: jest.fn(()=>{ return {}; })
        });
        await extension.activate(mock);
    });
});
