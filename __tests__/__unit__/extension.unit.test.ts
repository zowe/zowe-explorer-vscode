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
import * as treeMock from "../../src/DatasetTree";
import * as treeUSSMock from "../../src/USSTree";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";
import { ZoweDatasetNode } from "../../src/ZoweDatasetNode";
import * as imperative from "@zowe/imperative";
import * as extension from "../../src/extension";
import * as path from "path";
import * as zowe from "@zowe/cli";
import * as os from "os";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as profileLoader from "../../src/Profiles";
import * as ussNodeActions from "../../src/uss/ussNodeActions";
import { Job } from "../../src/ZoweJobNode";
import * as utils from "../../src/utils";
import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";

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

    const iJob: zowe.IJob = {
        "jobid": "JOB1234",
        "jobname": "TESTJOB",
        "files-url": "fake/files",
        "job-correlator": "correlator",
        "phase-name": "PHASE",
        "reason-not-running": "",
        "step-data": [{
            "proc-step-name": "",
            "program-name": "",
            "step-name": "",
            "step-number": 1,
            "active": "",
            "smfid": ""

        }],
        "class": "A",
        "owner": "USER",
        "phase": 0,
        "retcode": "",
        "status": "ACTIVE",
        "subsystem": "SYS",
        "type": "JOB",
        "url": "fake/url"
    };

    const iJobFile: zowe.IJobFile = {
        "byte-count": 128,
        "job-correlator": "",
        "record-count": 1,
        "records-url": "fake/records",
        "class": "A",
        "ddname": "STDOUT",
        "id": 100,
        "jobid": "100",
        "jobname": "TESTJOB",
        "lrecl": 80,
        "procstep": "",
        "recfm": "FB",
        "stepname": "",
        "subsystem": ""
    };

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
        usesSecurity: jest.fn().mockReturnValue(true)
    };
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return profileOps;
        })
    });
    Object.defineProperty(profileLoader.Profiles, "getInstance", {
        value: jest.fn(() => {
            return profileOps;
        })
    });

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

    const sessNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileOne);
    sessNode.contextValue = extension.DS_SESSION_CONTEXT;
    sessNode.pattern = "test hlq";

    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name, "123");
    ussNode.contextValue = extension.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";

    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileOne);

    const mkdirSync = jest.fn();
    const moveSync = jest.fn();
    const getAllProfileNames = jest.fn();
    const mockReveal = jest.fn();
    const createWebviewPanel = jest.fn();
    const createTreeView = jest.fn();
    const pathMock = jest.fn();
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
    const showInputBox = jest.fn();
    const showOpenDialog = jest.fn();
    const showQuickBox = jest.fn();
    const ZosmfSession = jest.fn();
    const createBasicZosmfSession = jest.fn();
    const Upload = jest.fn();
    const Delete = jest.fn();
    const bufferToDataSet = jest.fn();
    const pathToDataSet = jest.fn();
    const delDataset = jest.fn();
    const Create = jest.fn();
    const dataSetCreate = jest.fn();
    const Download = jest.fn();
    const Utilities = jest.fn();
    const isFileTagBinOrAscii = jest.fn();
    const dataSet = jest.fn();
    const ussFile = jest.fn();
    const List = jest.fn();
    const Get = jest.fn();
    const dataSetGet = jest.fn();
    const fileToUSSFile = jest.fn();
    const dataSetList = jest.fn();
    const fileList = jest.fn();
    const allMembers = jest.fn();
    const openTextDocument = jest.fn();
    const showTextDocument = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const createQuickPick = jest.fn();
    const mockAddZoweSession = jest.fn();
    const mockAddHistory = jest.fn();
    const mockGetHistory = jest.fn();
    const mockRefresh = jest.fn();
    const mockRefreshElement = jest.fn();
    const mockUSSRefresh = jest.fn();
    const mockUSSRefreshElement = jest.fn();
    const mockGetChildren = jest.fn();
    const mockGetUSSChildren = jest.fn();
    const mockRemoveFavorite = jest.fn();
    const getConfiguration = jest.fn();
    const onDidChangeConfiguration = jest.fn();
    const executeCommand = jest.fn();
    const activeTextEditor = jest.fn();
    const document = jest.fn();
    const getText = jest.fn();
    const save = jest.fn();
    const isFile = jest.fn();
    const load = jest.fn();
    const GetJobs = jest.fn();
    const getTreeView = jest.fn();
    const getSpoolContentById = jest.fn();
    const getJclForJob = jest.fn();
    const DownloadJobs = jest.fn();
    const downloadAllSpoolContentCommon = jest.fn();
    const SubmitJobs = jest.fn();
    const submitJcl = jest.fn();
    const submitJob = jest.fn();
    const IssueCommand = jest.fn();
    const issueSimple = jest.fn();
    const registerTextDocumentContentProvider = jest.fn();
    const from = jest.fn();
    const Uri = jest.fn();
    const parse = jest.fn();
    const withProgress = jest.fn();
    const downloadDataset = jest.fn();
    const downloadUSSFile = jest.fn();
    const mockInitialize = jest.fn();
    const mockInitializeUSS = jest.fn();
    const ussPattern = jest.fn();
    const mockPattern = jest.fn();
    const Rename = jest.fn();
    const renameDataSet = jest.fn();
    const renameDataSetMember = jest.fn();
    const mockRenameFavorite = jest.fn();
    const mockUpdateFavorites = jest.fn();
    const mockRenameNode = jest.fn();
    const Copy = jest.fn();
    const copyDataSet = jest.fn();
    const findFavoritedNode = jest.fn();
    const findNonFavoritedNode = jest.fn();
    const concatChildNodes = jest.fn();
    const getProfileName = jest.fn();
    const HMigrate = jest.fn();
    const hMigrateDataSet = jest.fn();
    let mockClipboardData: string;
    const fileResponse: zowe.IZosFilesResponse = {
        success: true,
        commandResponse: null,
        apiResponse: {
            etag: "123"
        }
    };
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
    const DatasetTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            mFavorites: [],
            treeView: new TreeView(),
            addSession: mockAddZoweSession,
            addHistory: mockAddHistory,
            getHistory: mockGetHistory,
            refresh: mockRefresh,
            refreshElement: mockRefreshElement,
            getChildren: mockGetChildren,
            getTreeView,
            removeFavorite: mockRemoveFavorite,
            enterPattern: mockPattern,
            initializeFavorites: mockInitialize,
            renameFavorite: mockRenameFavorite,
            updateFavorites: mockUpdateFavorites,
            renameNode: mockRenameNode,
            findFavoritedNode,
            findNonFavoritedNode,
            getProfileName: jest.fn()
        };
    });
    const USSTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            addSession: mockAddZoweSession,
            refresh: mockUSSRefresh,
            addHistory: mockAddHistory,
            getHistory: mockGetHistory,
            getTreeView,
            treeView: new TreeView(),
            refreshElement: mockUSSRefreshElement,
            getChildren: mockGetUSSChildren,
            initializeUSSFavorites: mockInitializeUSS,
            ussFilterPrompt: ussPattern,
        };
    });
    const JobsTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            getChildren: jest.fn(),
            addSession: jest.fn(),
            refresh: jest.fn(),
            getTreeView,
            treeView: new TreeView(),
            refreshElement: jest.fn(),
            getProfileName: jest.fn()
        };
    });

    enum CreateDataSetTypeEnum {
        DATA_SET_BINARY = 0,
        DATA_SET_C = 1,
        DATA_SET_CLASSIC = 2,
        DATA_SET_PARTITIONED = 3,
        DATA_SET_SEQUENTIAL = 4,
    }

    const testTree = DatasetTree();
    testTree.mSessionNodes = [];
    testTree.mSessionNodes.push(sessNode);
    Object.defineProperty(testTree, "onDidExpandElement", {value: jest.fn()});
    Object.defineProperty(testTree, "onDidCollapseElement", {value: jest.fn()});
    Object.defineProperty(vscode.window, "createQuickPick", {value: createQuickPick});

    const testUSSTree = USSTree();
    testUSSTree.mSessionNodes = [];
    testUSSTree.mSessionNodes.push(ussNode);

    const testJobsTree = JobsTree();
    testJobsTree.mSessionNodes = [];
    testJobsTree.mSessionNodes.push(jobNode);

    mockLoadNamedProfile = jest.fn();
    Object.defineProperty(utils, "concatChildNodes", {value: concatChildNodes});
    Object.defineProperty(fs, "mkdirSync", {value: mkdirSync});
    Object.defineProperty(imperative, "CliProfileManager", {value: CliProfileManager});
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    Object.defineProperty(vscode.window, "createWebviewPanel", {value: createWebviewPanel});
    Object.defineProperty(vscode, "Uri", {value: Uri});
    Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
    Object.defineProperty(vscode.commands, "registerCommand", {value: registerCommand});
    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", {value: onDidSaveTextDocument});
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
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(vscode.window, "showQuickBox", {value: showQuickBox});
    Object.defineProperty(vscode.window, "activeTextEditor", {value: activeTextEditor});
    Object.defineProperty(activeTextEditor, "document", {value: document});
    Object.defineProperty(document, "save", {value: save});
    Object.defineProperty(document, "getText", {value: getText});
    Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});
    Object.defineProperty(zowe, "ZosmfSession", {value: ZosmfSession});
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {value: createBasicZosmfSession});
    Object.defineProperty(zowe, "Upload", {value: Upload});
    Object.defineProperty(Upload, "bufferToDataSet", {value: bufferToDataSet});
    Object.defineProperty(Upload, "pathToDataSet", {value: pathToDataSet});
    Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
    Object.defineProperty(zowe, "Create", {value: Create});
    Object.defineProperty(Create, "dataSet", {value: dataSetCreate});
    Object.defineProperty(zowe, "Get", {value: Get});
    Object.defineProperty(Get, "dataSet", {value: dataSetGet});
    Object.defineProperty(zowe, "List", {value: List});
    Object.defineProperty(List, "dataSet", {value: dataSetList});
    Object.defineProperty(List, "fileList", {value: fileList});
    Object.defineProperty(List, "allMembers", {value: allMembers});
    Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "showTextDocument", {value: showTextDocument});
    Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
    Object.defineProperty(zowe, "Download", {value: Download});
    Object.defineProperty(Download, "dataSet", {value: dataSet});
    Object.defineProperty(treeMock, "DatasetTree", {value: DatasetTree});
    Object.defineProperty(treeUSSMock, "USSTree", {value: USSTree});
    Object.defineProperty(zowe, "Delete", {value: Delete});
    Object.defineProperty(Delete, "dataSet", {value: delDataset});
    Object.defineProperty(zowe, "CreateDataSetTypeEnum", {value: CreateDataSetTypeEnum});
    Object.defineProperty(zowe, "Utilities", {value: Utilities});
    Object.defineProperty(Download, "ussFile", {value: ussFile});
    Object.defineProperty(Utilities, "isFileTagBinOrAscii", {value: isFileTagBinOrAscii});
    Object.defineProperty(zowe, "GetJobs", {value: GetJobs});
    Object.defineProperty(GetJobs, "getSpoolContentById", {value: getSpoolContentById});
    Object.defineProperty(GetJobs, "getJclForJob", {value: getJclForJob});
    Object.defineProperty(zowe, "DownloadJobs", {value: DownloadJobs});
    Object.defineProperty(DownloadJobs, "downloadAllSpoolContentCommon", {value: downloadAllSpoolContentCommon});
    Object.defineProperty(zowe, "SubmitJobs", {value: SubmitJobs});
    Object.defineProperty(SubmitJobs, "submitJcl", {value: submitJcl});
    Object.defineProperty(SubmitJobs, "submitJob", {value: submitJob});
    Object.defineProperty(zowe, "IssueCommand", {value: IssueCommand});
    Object.defineProperty(IssueCommand, "issueSimple", {value: issueSimple});
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", { value: registerTextDocumentContentProvider});
    Object.defineProperty(vscode.Disposable, "from", {value: from});
    Object.defineProperty(vscode.Uri, "parse", {value: parse});
    Object.defineProperty(zowe, "Rename", {value: Rename});
    Object.defineProperty(Rename, "dataSet", { value: renameDataSet });
    Object.defineProperty(zowe, "Copy", {value: Copy});
    Object.defineProperty(Copy, "dataSet", { value: copyDataSet });
    Object.defineProperty(zowe, "HMigrate", { value: HMigrate });
    Object.defineProperty(HMigrate, "dataSet", { value: hMigrateDataSet });
    Object.defineProperty(vscode.env, "clipboard", { value: clipboard });
    Object.defineProperty(Rename, "dataSetMember", { value: renameDataSetMember });
    Object.defineProperty(ZoweDatasetNode, "getProfileName", { value: getProfileName });
    Object.defineProperty(CliProfileManager, "initialize", { value: initialize });
    Object.defineProperty(zowe, "getImperativeConfig", { value: getImperativeConfig });
    Object.defineProperty(imperative, "ImperativeConfig", { value: ImperativeConfig });
    Object.defineProperty(ImperativeConfig, "instance", { value: icInstance });
    Object.defineProperty(icInstance, "cliHome", { get: cliHome });

    beforeEach(() => {
        mockLoadNamedProfile.mockReturnValue(profileOne);
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
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => "vscode",
            update: jest.fn(()=>{
                return {};
            })
        });

        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: () => "",
            update: jest.fn(()=>{
                return {};
            })
        });

        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValueOnce({
            persistence: true,
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValue({
            persistence: true,
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
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
        sampleFavorites[0].contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        sampleFavorites[1].contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        sampleFavorites[2].contextValue = extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX;
        sampleFavorites[1].command = {
            command: "zowe.ZoweNode.openPS",
            title: "",
            arguments: [sampleFavorites[1]]
        };
        sampleFavorites[0].iconPath = utils.applyIcons(sampleFavorites[0]);
        sampleFavorites[1].iconPath = utils.applyIcons(sampleFavorites[1]);
        sampleFavorites[2].iconPath = utils.applyIcons(sampleFavorites[2]);
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
        expect(registerCommand.mock.calls.length).toBe(66);
        registerCommand.mock.calls.forEach((call, i ) => {
            expect(registerCommand.mock.calls[i][1]).toBeInstanceOf(Function);
        });
        const actualCommands = [];
        registerCommand.mock.calls.forEach((call) => {
            actualCommands.push(call[0]);
        });
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
            "zowe.jobs.removeSearchFavorite"
        ];
        expect(actualCommands).toEqual(expectedCommands);
        expect(onDidSaveTextDocument.mock.calls.length).toBe(1);
        // tslint:disable-next-line: no-magic-numbers
        expect(existsSync.mock.calls.length).toBe(4);
        expect(existsSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(readdirSync.mock.calls.length).toBe(1);
        expect(readdirSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(unlinkSync.mock.calls.length).toBe(2);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.ZOWETEMPFOLDER + "/firstFile.txt"));
        expect(unlinkSync.mock.calls[1][0]).toBe(path.join(extension.ZOWETEMPFOLDER + "/secondFile.txt"));
        expect(rmdirSync.mock.calls.length).toBe(1);
        expect(rmdirSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(initialize.mock.calls.length).toBe(1);
        expect(initialize.mock.calls[0][0]).toStrictEqual({
            configuration: [],
            profileRootDirectory: path.join(cliHome(), "profiles")
        });

        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(false);
        // tslint:disable-next-line: no-empty
        rmdirSync.mockImplementationOnce(() => {
        });
        readFileSync.mockReturnValue("");
        // .get("Zowe-Temp-Folder-Location")["folderPath"];
        getConfiguration.mockReturnValueOnce({
            get: () => "",
            update: jest.fn(()=>{
                return {};
            })
        });
        // getConfiguration("Zowe-Environment").get("framework");
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => undefined,
            update: jest.fn(()=>{
                return {};
            })
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });

        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);

        await extension.activate(mock);

        expect(existsSync.mock.calls.length).toBe(2);
        expect(readdirSync.mock.calls.length).toBe(0);

        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile", "secondFile"]);
        getConfiguration.mockReturnValueOnce({
            get: () => {
                return [""];
            },
            update: jest.fn(()=>{
                return {};
            })
        });
        unlinkSync.mockImplementationOnce(() => {
            return;
        });
        unlinkSync.mockImplementationOnce(() => {
            return;
        });
        unlinkSync.mockImplementationOnce(() => {
            throw (Error("testError"));
        });
        // getConfiguration("Zowe-Environment").get("framework");
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => "theia",
            update: jest.fn(()=>{
                return {};
            })
        });
        await extension.activate(mock);
    });

    it("should not change the existing context menus", async () => {
        const packageJsonContent = require("../../package.json");
        expect(packageJsonContent.contributes.menus["view/item/context"]).toMatchSnapshot();
    });

    it("Testing that createMember correctly executes", async () => {
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);

        showInputBox.mockResolvedValue("testMember");

        await extension.createMember(parent, testTree);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls[0][0]).toEqual({placeHolder: "Name of Member"});
        expect(bufferToDataSet.mock.calls.length).toBe(1);
        expect(bufferToDataSet.mock.calls[0][0]).toBe(session);
        expect(bufferToDataSet.mock.calls[0][1]).toEqual(Buffer.from(""));
        expect(bufferToDataSet.mock.calls[0][2]).toBe(parent.label + "(testMember)");

        bufferToDataSet.mockRejectedValueOnce(Error("test"));
        showErrorMessage.mockReset();
        try {
            await extension.createMember(parent, testTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Unable to create member: test");

        bufferToDataSet.mockReset();


        showInputBox.mockResolvedValue("");

        await extension.createMember(parent, testTree);

        expect(bufferToDataSet.mock.calls.length).toBe(0);

        parent.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.createMember(parent, testTree);
    });

    it("Testing that refreshPS correctly executes with and without error", async () => {
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        dataSet.mockReset();
        showTextDocument.mockReset();

        dataSet.mockReturnValueOnce(fileResponse);
        await extension.refreshPS(node);

        expect(dataSet.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls[0][0]).toBe(node.getSession());
        expect(dataSet.mock.calls[0][1]).toBe(node.label);
        expect(dataSet.mock.calls[0][2]).toEqual({
            file: path.join(extension.DS_DIR, node.getSessionNode().label, node.label),
            returnEtag: true
        });
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, node.label ));
        expect(showTextDocument.mock.calls.length).toBe(2);
        expect(executeCommand.mock.calls.length).toBe(1);


        showInformationMessage.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: false});
        executeCommand.mockReset();

        await extension.refreshPS(node);

        expect(executeCommand.mock.calls.length).toBe(0);

        dataSet.mockRejectedValueOnce(Error("not found"));
        showInformationMessage.mockReset();

        await extension.refreshPS(node);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.label + " was probably deleted.");

        showErrorMessage.mockReset();
        dataSet.mockReset();
        dataSet.mockRejectedValueOnce(Error(""));

        await extension.refreshPS(child);

        expect(dataSet.mock.calls[0][1]).toBe(child.getParent().getLabel() + "(" + child.label + ")");
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("");

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        dataSet.mockReset();
        showTextDocument.mockReset();
        dataSet.mockReturnValueOnce(fileResponse);

        node.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.refreshPS(node);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();
        dataSet.mockReturnValueOnce(fileResponse);

        parent.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.refreshPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();
        dataSet.mockReturnValueOnce(fileResponse);

        parent.contextValue = extension.FAVORITE_CONTEXT;
        await extension.refreshPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        showErrorMessage.mockReset();
        dataSet.mockReset();
        openTextDocument.mockReset();

    });

    it("Call Change File type", async () => {
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, null);
        const response: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "132"
            }
        };
        ussFile.mockResolvedValueOnce(response);
        const res = extension.changeFileType(node, false, testUSSTree);
        expect(res).not.toBeUndefined();
    });

    it("Test Get Profile", async () => {
        const ProfNode = new ZoweDatasetNode("[sestest1,sestest2]", vscode.TreeItemCollapsibleState.Expanded, null, session);
        await extension.getProfile(ProfNode);
        expect(ProfNode).not.toBeUndefined();
    });

    describe("Add Session Unit Test", () => {
        const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

        beforeEach(() => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [profileOne, {name: "secondName"}],
                        defaultProfile: profileOne,
                        createNewConnection: jest.fn(()=>{
                            return {newprofile: "fake"};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("Testing that addSession will cancel if there is no profile name", async () => {
            const entered = undefined;

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that addSession with supplied profile name", async () => {
            const entered = undefined;
            const addSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession with existing profile", async () => {
            const entered = "";
            const addSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();
        });

        it("Testing that addSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession with undefined profile", async () => {
            const entered = "";
            const addSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });


        it("Testing that addSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession if listProfile is invalid", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });
    });

    it("Testing that createFile is executed successfully", async () => {
        const sessNode2 = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileOne);
        sessNode2.contextValue = extension.DS_SESSION_CONTEXT;
        sessNode2.pattern = "test hlq";
        const childNode = new ZoweDatasetNode("NODE", vscode.TreeItemCollapsibleState.None, sessNode2, null, undefined, undefined, profileOne);
        sessNode2.children.push(childNode);

        const uploadResponse: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "success",
            apiResponse: {
                items: [{name: "NODE", dsname: "NODE"}]
            }
        };

        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        allMembers.mockReset();
        dataSetList.mockReset();
        mockGetHistory.mockReset();

        getConfiguration.mockReturnValue("FakeConfig");
        createTreeView.mockReturnValue(new TreeView());
        showInputBox.mockReturnValue("node");
        allMembers.mockReturnValue(uploadResponse);
        dataSetList.mockReturnValue(uploadResponse);
        mockGetHistory.mockReturnValue([]);
        testTree.getTreeView.mockReturnValue(new TreeView());

        showQuickPick.mockResolvedValueOnce("Data Set Binary");
        await extension.createFile(sessNode2, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set C");
        await extension.createFile(sessNode2, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Classic");
        await extension.createFile(sessNode2, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Partitioned");
        await extension.createFile(sessNode2, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode2, testTree);

        // tslint:disable-next-line: no-magic-numbers
        expect(showQuickPick.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls.length).toBe(5);
        expect(getConfiguration.mock.calls[0][0]).toBe("Zowe-Default-Datasets-Binary");
        expect(getConfiguration.mock.calls[1][0]).toBe("Zowe-Default-Datasets-C");
        expect(getConfiguration.mock.calls[2][0]).toBe("Zowe-Default-Datasets-Classic");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[3][0]).toBe("Zowe-Default-Datasets-PDS");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[4][0]).toBe("Zowe-Default-Datasets-PS");
        // tslint:disable-next-line: no-magic-numbers
        expect(showInputBox.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(dataSetCreate.mock.calls.length).toBe(5);
        expect(dataSetCreate.mock.calls[0][0]).toEqual(session);

        showInformationMessage.mockReset();
        showErrorMessage.mockReset();

        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode2, testTree);

        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        dataSetCreate.mockRejectedValueOnce(Error("Generic Error"));
        try {
            await extension.createFile(sessNode2, testTree);
        } catch (err) {
            // do nothing
        }
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Error encountered when creating data set! Generic Error");

        showQuickPick.mockReset();
        showErrorMessage.mockReset();

        showQuickPick.mockReturnValueOnce(undefined);
        try {
            await extension.createFile(sessNode, testTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(0);

        mockGetHistory.mockReset();
        testTree.treeView.reveal.mockReset();

        // Testing the addition of new node to tree view
        mockGetHistory.mockReturnValueOnce(["NODE1"]);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode2, testTree);
        expect(testTree.addHistory).toHaveBeenCalledWith("NODE1,NODE.*");
        expect(testTree.treeView.reveal.mock.calls.length).toBe(1);

        testTree.addHistory.mockReset();

        mockGetHistory.mockReturnValueOnce(["NODE"]);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode2, testTree);
        expect(testTree.addHistory.mock.calls.length).toBe(0);

        mockGetHistory.mockReturnValueOnce([null]);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode2, testTree);
        expect(testTree.addHistory).toHaveBeenCalledWith("NODE");

        allMembers.mockReset();
        dataSetList.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
    });

    it("tests the createFile for prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [profileOne, {name: "secondName"}],
                    defaultProfile: profileOne,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };

            })
        });
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });
        const uploadResponse: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "success",
            apiResponse: {
                items: []
            }
        };

        createBasicZosmfSession.mockReturnValue(sessionwocred);
        const newsessNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded,
                                                null, sessionwocred, undefined, undefined, profileOne);
        newsessNode.contextValue = extension.DS_SESSION_CONTEXT;

        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        dataSetList.mockReset();
        mockGetHistory.mockReset();
        allMembers.mockReset();

        getConfiguration.mockReturnValue("FakeConfig");
        createTreeView.mockReturnValue(new TreeView());
        showInputBox.mockReturnValue("FakeName");
        mockGetHistory.mockReturnValue(["mockHistory"]);
        dataSetList.mockReturnValue(uploadResponse);
        allMembers.mockReturnValue(uploadResponse);
        testTree.getTreeView.mockReturnValue(new TreeView());

        showQuickPick.mockResolvedValueOnce("Data Set Binary");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set C");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Classic");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Partitioned");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(newsessNode, testTree);

        // tslint:disable-next-line: no-magic-numbers
        expect(showQuickPick.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls.length).toBe(5);
        expect(getConfiguration.mock.calls[0][0]).toBe("Zowe-Default-Datasets-Binary");
        expect(getConfiguration.mock.calls[1][0]).toBe("Zowe-Default-Datasets-C");
        expect(getConfiguration.mock.calls[2][0]).toBe("Zowe-Default-Datasets-Classic");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[3][0]).toBe("Zowe-Default-Datasets-PDS");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[4][0]).toBe("Zowe-Default-Datasets-PS");
        // tslint:disable-next-line: no-magic-numbers
        expect(showInputBox.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(dataSetCreate.mock.calls.length).toBe(5);

        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        dataSetList.mockReset();
        mockGetHistory.mockReset();
        allMembers.mockReset();
    });

    it("tests the createFile for prompt credentials, favorite route", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [profileOne, {name: "secondName"}],
                    defaultProfile: profileOne,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });
        const uploadResponse: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "success",
            apiResponse: {
                items: []
            }
        };

        createBasicZosmfSession.mockReturnValue(sessionwocred);
        const newsessNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded,
                                                null, sessionwocred, undefined, undefined, profileOne);
        newsessNode.contextValue = extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX;

        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        testTree.getChildren.mockReset();
        allMembers.mockReset();
        dataSet.mockReset();
        mockGetHistory.mockReset();

        getConfiguration.mockReturnValue("FakeConfig");
        showInputBox.mockReturnValue("FakeName");
        createTreeView.mockReturnValue(new TreeView());
        testTree.getChildren.mockReturnValue([new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, sessNode,
                                                                  null, undefined, undefined, profileOne), sessNode]);
        allMembers.mockReturnValue(uploadResponse);
        dataSet.mockReturnValue(uploadResponse);
        mockGetHistory.mockReturnValue(["mockHistory1"]);
        testTree.getTreeView.mockReturnValue(new TreeView());

        showQuickPick.mockResolvedValueOnce("Data Set Binary");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set C");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Classic");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Partitioned");
        await extension.createFile(newsessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(newsessNode, testTree);

        // tslint:disable-next-line: no-magic-numbers
        expect(showQuickPick.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls.length).toBe(5);
        expect(getConfiguration.mock.calls[0][0]).toBe("Zowe-Default-Datasets-Binary");
        expect(getConfiguration.mock.calls[1][0]).toBe("Zowe-Default-Datasets-C");
        expect(getConfiguration.mock.calls[2][0]).toBe("Zowe-Default-Datasets-Classic");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[3][0]).toBe("Zowe-Default-Datasets-PDS");
        // tslint:disable-next-line: no-magic-numbers
        expect(getConfiguration.mock.calls[4][0]).toBe("Zowe-Default-Datasets-PS");
        // tslint:disable-next-line: no-magic-numbers
        expect(showInputBox.mock.calls.length).toBe(5);
        // tslint:disable-next-line: no-magic-numbers
        expect(dataSetCreate.mock.calls.length).toBe(5);

        getConfiguration.mockReset();
        showInputBox.mockReset();
        testTree.getChildren.mockReset();
        allMembers.mockReset();
        dataSet.mockReset();
        mockGetHistory.mockReset();
    });

    it("tests the createFile for prompt credentials error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [profileOne, {name: "secondName"}],
                    defaultProfile: profileOne,
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        const uploadResponse: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "success",
            apiResponse: {
                items: []
            }
        };
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });
        const createFile = jest.spyOn(extension, "createFile");
        createBasicZosmfSession.mockReturnValue(sessionwocred);
        const newsessNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded,
                                                null, sessionwocred, undefined, undefined, profileOne);
        newsessNode.contextValue = extension.DS_SESSION_CONTEXT;
        newsessNode.pattern = "sestest";

        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        mockGetHistory.mockReset();
        allMembers.mockReset();
        dataSetList.mockReset();

        getConfiguration.mockReturnValueOnce("FakeConfig");
        showInputBox.mockReturnValueOnce("sestest");
        mockGetHistory.mockReturnValueOnce(["mockHistory"]);
        allMembers.mockReturnValueOnce(uploadResponse);
        dataSetList.mockReturnValue(uploadResponse);
        testTree.getTreeView.mockReturnValue(new TreeView());

        showQuickPick.mockResolvedValueOnce("Data Set Binary");
        await extension.createFile(newsessNode, testTree);
        expect(extension.createFile).toHaveBeenCalled();

        dataSetList.mockReset();
    });

    it("Testing that deleteDataset is executed successfully", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        const deleteSpy = jest.spyOn(mvsApi, "deleteDataSet");

        let node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null, undefined, undefined, profileOne);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, undefined, undefined, profileOne);
        let child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null, undefined, undefined, profileOne);
        const parentAsFavorite = new ZoweDatasetNode("[sestest]: parent", vscode.TreeItemCollapsibleState.Collapsed,
                                                     sessNode, null, undefined, undefined, profileOne);
        parentAsFavorite.contextValue = extension.PDS_FAV_CONTEXT;
        testTree.mFavorites.push(parentAsFavorite);

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        findFavoritedNode.mockReturnValue(parentAsFavorite);
        await extension.deleteDataset(node, testTree);
        expect(deleteSpy.mock.calls.length).toBe(1);
        expect(deleteSpy.mock.calls[0][0]).toBe(node.label);
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, node.label ));
        expect(unlinkSync.mock.calls.length).toBe(1);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, node.label ));

        unlinkSync.mockReset();
        deleteSpy.mockReset();
        existsSync.mockReturnValueOnce(false);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);

        expect(unlinkSync.mock.calls.length).toBe(0);
        expect(deleteSpy.mock.calls[0][0]).toBe(child.getParent().getLabel() + "(" + child.label + ")");

        deleteSpy.mockReset();
        deleteSpy.mockRejectedValueOnce(Error("not found"));
        showQuickPick.mockResolvedValueOnce("Yes");

        await expect(extension.deleteDataset(node, testTree)).rejects.toEqual(Error("not found"));

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.label + " was probably already deleted.");

        deleteSpy.mockReset();
        showErrorMessage.mockReset();
        deleteSpy.mockRejectedValueOnce(Error(""));
        showQuickPick.mockResolvedValueOnce("Yes");

        await expect(extension.deleteDataset(node, testTree)).rejects.toEqual(Error(""));

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("");

        showQuickPick.mockResolvedValueOnce("No");

        await extension.deleteDataset(child, testTree);

        existsSync.mockReturnValueOnce(true);
        node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null, undefined, undefined, profileOne);
        node.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.deleteDataset(node, testTree);

        existsSync.mockReturnValueOnce(true);
        node.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, node, null, undefined, undefined, profileOne);
        await extension.deleteDataset(child, testTree);
        expect(mockRefreshElement).toHaveBeenCalledWith(parent);
        expect(mockRefreshElement).toHaveBeenCalledWith(parentAsFavorite);
    });

    it("Testing that deleteDataset is executed successfully for favorite", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        const deleteSpy = jest.spyOn(mvsApi, "deleteDataSet");
        mockRemoveFavorite.mockReset();

        const node = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const child = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = extension.FAVORITE_CONTEXT;
        const nodeAsFavorite = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.None, sessNode, null);
        nodeAsFavorite.contextValue = extension.FAVORITE_CONTEXT;
        sessNode.children.push(node, nodeAsFavorite, child);
        testTree.mFavorites.push(nodeAsFavorite);

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        findNonFavoritedNode.mockReturnValue(node);

        await extension.deleteDataset(child, testTree);

        expect(deleteSpy.mock.calls.length).toBe(1);
        expect(deleteSpy.mock.calls[0][0]).toBe("HLQ.TEST.DELETE.NODE");
        expect(mockRemoveFavorite.mock.calls.length).toBe(1);
        expect(mockRemoveFavorite.mock.calls[0][0].label).toBe( "[sestest]: HLQ.TEST.DELETE.NODE" );
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            nodeAsFavorite.getSessionNode().label, "HLQ.TEST.DELETE.NODE" ));
        expect(unlinkSync.mock.calls.length).toBe(1);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            nodeAsFavorite.getSessionNode().label, "HLQ.TEST.DELETE.NODE" ));
        expect(findNonFavoritedNode).toBeCalledWith(nodeAsFavorite);

        sessNode.children = [];
    });

    it("Testing that deleteDataset is executed successfully for pdsf", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        const deleteSpy = jest.spyOn(mvsApi, "deleteDataSet");
        mockRemoveFavorite.mockReset();

        const node = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PDS", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const child = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PDS(MEMBER)", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);

        expect(deleteSpy.mock.calls.length).toBe(1);
        expect(deleteSpy.mock.calls[0][0]).toBe("HLQ.TEST.DELETE.PDS([sestest]: HLQ.TEST.DELETE.PDS(MEMBER))");
        expect(mockRemoveFavorite.mock.calls.length).toBe(1);
        expect(mockRemoveFavorite.mock.calls[0][0].label).toBe( "[sestest]: HLQ.TEST.DELETE.PDS(MEMBER)" );
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, "HLQ.TEST.DELETE.PDS([sestest]: HLQ.TEST.DELETE.PDS(MEMBER))" ));
        expect(unlinkSync.mock.calls.length).toBe(1);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, "HLQ.TEST.DELETE.PDS([sestest]: HLQ.TEST.DELETE.PDS(MEMBER))" ));
    });

    it("Testing that deleteDataset fails if junk passed", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        delDataset.mockReset();
        mockRemoveFavorite.mockReset();
        showErrorMessage.mockReset();

        const node = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = "junk";

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await expect(extension.deleteDataset(child, testTree)).rejects.toEqual(Error("deleteDataSet() called from invalid node."));
    });

    it("Testing that enterPattern is executed successfully", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();

        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node.pattern = "TEST";
        node.contextValue = extension.DS_SESSION_CONTEXT;

        showInputBox.mockReturnValueOnce("test");
        await extension.enterPattern(node, testTree);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls[0][0]).toEqual({
            prompt: "Search data sets by entering patterns: use a comma to separate multiple patterns",
            value: node.pattern
        });
        expect(showInformationMessage.mock.calls.length).toBe(0);

        showInputBox.mockReturnValueOnce("");
        showInputBox.mockReset();
        showInformationMessage.mockReset();
        await extension.enterPattern(node, testTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("You must enter a pattern.");
    });

    it("Testing that enterPattern is executed successfully for search favorite", async () => {
        mockAddZoweSession.mockReset();
        const favoriteSample = new ZoweDatasetNode("[sestest]: HLQ.TEST", vscode.TreeItemCollapsibleState.None, undefined, null);

        await extension.enterPattern(favoriteSample, testTree);

        expect(mockAddZoweSession.mock.calls.length).toBe(1);
        expect(mockAddZoweSession.mock.calls[0][0]).toEqual("sestest");
    });

    it("Testing that saveFile is executed successfully", async () => {
        const testDoc: vscode.TextDocument = {
            fileName: path.join(extension.DS_DIR, "/sestest/HLQ.TEST.AFILE"),
            uri: null,
            isUntitled: null,
            languageId: null,
            version: null,
            isDirty: null,
            isClosed: null,
            save: null,
            eol: null,
            lineCount: null,
            lineAt: null,
            offsetAt: null,
            positionAt: null,
            getText: null,
            getWordRangeAtPosition: null,
            validateRange: null,
            validatePosition: null
        };
        const testDoc0: vscode.TextDocument = {
            fileName: path.join(extension.DS_DIR, "HLQ.TEST.AFILE"),
            uri: null,
            isUntitled: null,
            languageId: null,
            version: null,
            isDirty: null,
            isClosed: null,
            save: null,
            eol: null,
            lineCount: null,
            lineAt: null,
            offsetAt: null,
            positionAt: null,
            getText: null,
            getWordRangeAtPosition: null,
            validateRange: null,
            validatePosition: null
        };

        const testResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                items: []
            }
        };

        // If session node is not defined, it should take the session from Profile
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });
        // testing if no session is defined (can happen while saving from favorites)
        const nodeWitoutSession = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None,
                                                        null, null, undefined, undefined, profileOne);
        testTree.getChildren.mockReturnValueOnce([nodeWitoutSession]);
        concatChildNodes.mockReturnValueOnce([nodeWitoutSession]);
        const getSessionSpy = jest.spyOn(mvsApi, "getSession").mockReturnValueOnce(sessionwocred);
        await extension.saveFile(testDoc0, testTree);
        // tslint:disable-next-line: no-magic-numbers
        expect(getSessionSpy.mock.calls.length).toBe(3);
        expect(getSessionSpy.mock.results[0].value).toEqual(sessionwocred);

        // testing if no documentSession is found (no session + no profile)
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    loadNamedProfile: () => undefined
                };
            })
        });
        createBasicZosmfSession.mockReset();
        testTree.getChildren.mockReset();
        showErrorMessage.mockReset();
        testTree.getChildren.mockReturnValueOnce([nodeWitoutSession]);
        await extension.saveFile(testDoc0, testTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Couldn't locate session when saving data set!");

        testTree.getChildren.mockReset();
        createBasicZosmfSession.mockReset();
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [profileOne, {name: "secondName"}],
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        testTree.getChildren.mockReturnValueOnce([new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None,
            sessNode, null, undefined, undefined, profileOne), sessNode]);
        showErrorMessage.mockReset();
        const dataSetSpy = jest.spyOn(mvsApi, "dataSet").mockImplementationOnce(
            async () => testResponse as zowe.IZosFilesResponse);
        await extension.saveFile(testDoc, testTree);
        expect(dataSetSpy.mock.calls.length).toBe(1);
        expect(dataSetSpy.mock.calls[0][0]).toBe("HLQ.TEST.AFILE");
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Data set failed to save. Data set may have been deleted on mainframe.");

        const node = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None, sessNode, null, undefined, undefined, profileOne);
        sessNode.children.push(node);
        testResponse.apiResponse.items = [{dsname: "HLQ.TEST.AFILE"}, {dsname: "HLQ.TEST.AFILE(mem)"}];
        dataSetList.mockReset();
        pathToDataSet.mockReset();
        showErrorMessage.mockReset();
        concatChildNodes.mockReset();
        const mockSetEtag = jest.spyOn(node, "setEtag").mockImplementation(() => null);
        mockSetEtag.mockReset();
        const uploadResponse: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "success",
            apiResponse: [{
                etag: "123"
            }]
        };
        concatChildNodes.mockReturnValueOnce([sessNode.children[0]]);
        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        dataSetList.mockResolvedValueOnce(testResponse);
        withProgress.mockResolvedValueOnce(uploadResponse);
        testResponse.success = true;
        pathToDataSet.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc, testTree);

        expect(concatChildNodes.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("success");
        expect(mockSetEtag).toHaveBeenCalledTimes(1);
        expect(mockSetEtag).toHaveBeenCalledWith("123");

        concatChildNodes.mockReturnValueOnce([sessNode.children[0]]);
        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        testResponse.success = false;
        testResponse.commandResponse = "Save failed";
        pathToDataSet.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc, testTree);

        const testDoc2: vscode.TextDocument = {
            fileName: path.normalize("/sestest/HLQ.TEST.AFILE"),
            uri: null,
            isUntitled: null,
            languageId: null,
            version: null,
            isDirty: null,
            isClosed: null,
            save: null,
            eol: null,
            lineCount: null,
            lineAt: null,
            offsetAt: null,
            positionAt: null,
            getText: null,
            getWordRangeAtPosition: null,
            validateRange: null,
            validatePosition: null
        };

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockReset();

        await extension.saveFile(testDoc2, testTree);

        expect(dataSetList.mock.calls.length).toBe(0);

        const testDoc3: vscode.TextDocument = {
            fileName: path.join(extension.DS_DIR, "/sestest/HLQ.TEST.AFILE(mem)"),
            uri: null,
            isUntitled: null,
            languageId: null,
            version: null,
            isDirty: null,
            isClosed: null,
            save: null,
            eol: null,
            lineCount: null,
            lineAt: null,
            offsetAt: null,
            positionAt: null,
            getText: null,
            getWordRangeAtPosition: null,
            validateRange: null,
            validatePosition: null
        };

        dataSetList.mockReset();
        showErrorMessage.mockReset();

        sessNode.children.push(new ZoweDatasetNode(
            "HLQ.TEST.AFILE(mem)", vscode.TreeItemCollapsibleState.None, sessNode, null, undefined, undefined, profileOne));
        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        testResponse.success = true;
        concatChildNodes.mockReset();
        concatChildNodes.mockReturnValueOnce(sessNode.children);

        await extension.saveFile(testDoc3, testTree);
        expect(concatChildNodes.mock.calls.length).toBe(1);

        testTree.getChildren.mockReturnValueOnce([new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null,
            undefined, undefined, profileOne), sessNode]);
        dataSetList.mockReset();
        showErrorMessage.mockReset();

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        concatChildNodes.mockReset();
        concatChildNodes.mockReturnValueOnce(sessNode.children);
        testResponse.success = false;
        testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";
        withProgress.mockResolvedValueOnce(testResponse);
        dataSet.mockReset();
        const downloadResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: ""
            }
        };
        dataSet.mockResolvedValue(downloadResponse);

        await extension.saveFile(testDoc, testTree);
        expect(showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
        expect(concatChildNodes.mock.calls.length).toBe(1);
    });

    it("Testing that refreshAll is executed successfully", async () => {
        extension.refreshAll(testTree);
    });

    it("Testing that openPS is executed successfully", async () => {
        dataSet.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        withProgress.mockReset();

        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        existsSync.mockReturnValue(null);

        withProgress.mockReturnValue(fileResponse);
        openTextDocument.mockResolvedValueOnce("test doc");

        await extension.openPS(node, true);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label.trim(), node.label));
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening data set..."
            }, expect.any(Function)
        );
        withProgress(downloadDataset);
        expect(withProgress).toBeCalledWith(downloadDataset);
        // expect(dataSet.mock.calls.length).toBe(1);
        // expect(dataSet.mock.calls[0][0]).toBe(session);
        // expect(dataSet.mock.calls[0][1]).toBe(node.label);
        // expect(dataSet.mock.calls[0][2]).toEqual({file: extension.getDocumentFilePath(node.label, node)});
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getDocumentFilePath(node.label, node));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test doc");

        openTextDocument.mockResolvedValueOnce("test doc");
        const node2 = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);

        await extension.openPS(node2, true);

        dataSet.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();

        existsSync.mockReturnValue("exists");
        showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await extension.openPS(child, true);
        } catch (err) {
            // do nothing
        }

        expect(dataSet.mock.calls.length).toBe(0);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getDocumentFilePath(parent.label + "(" + child.label + ")", node));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("testError");

        const child2 = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, node2, null);
        try {
            await extension.openPS(child2, true);
        } catch (err) {
            // do nothing
        }

        openTextDocument.mockReset();
        showTextDocument.mockReset();
        parent.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.openPS(child, true);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);

        showTextDocument.mockReset();
        openTextDocument.mockReset();

        parent.contextValue = extension.FAVORITE_CONTEXT;
        await extension.openPS(child, true);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);

        showErrorMessage.mockReset();
    });

    it("Testing that that openPS credentials prompt is executed successfully", async () => {
        showQuickPick.mockReset();
        showInputBox.mockReset();
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweDatasetNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred);
        dsNode.contextValue = extension.DS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");

        await extension.openPS(dsNode, true, testTree);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("Testing that that openPS credentials prompt works with favorites", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweDatasetNode("[test]: TEST.JCL", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred);
        dsNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");

        await extension.openPS(dsNode, true, testTree);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("Testing that that openPS credentials prompt ends in error", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweDatasetNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred);
        dsNode.contextValue = extension.DS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        await extension.openPS(dsNode, true, testTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        showQuickPick.mockReset();
        showInputBox.mockReset();
        showInformationMessage.mockReset();
        showErrorMessage.mockReset();
    });

    it("Testing that that openPS credentials with favorites ends in error", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweDatasetNode("[test]: TEST.JCL", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred);
        dsNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return [undefined, undefined, undefined];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");
        const spyopenPS = jest.spyOn(extension, "openPS");
        await extension.openPS(dsNode, true, testTree);
        expect(extension.openPS).toHaveBeenCalled();

    });

    describe("refresh USS checking", () => {
        const isDirtyInEditor = jest.fn();
        const openedDocumentInstance = jest.fn();

        const setMocksForNode = (node: ZoweUSSNode) => {
            Object.defineProperty(node, "isDirtyInEditor", {
                get: isDirtyInEditor
            });
            Object.defineProperty(node, "openedDocumentInstance", {
                get: openedDocumentInstance
            });

            node.contextValue = extension.USS_SESSION_CONTEXT;
            node.fullPath = "/u/myuser";
        };
        const resetMocks = () => {
            showErrorMessage.mockReset();
            showTextDocument.mockReset();
            ussFile.mockReset();
            executeCommand.mockReset();
            isDirtyInEditor.mockReset();
            openedDocumentInstance.mockReset();
        };

        it("refreshUSS works correctly for dirty file state, when user didn't cancel file save", async () => {
            const node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");

            resetMocks();
            setMocksForNode(node);

            const response: zowe.IZosFilesResponse = {
                success: true,
                commandResponse: null,
                apiResponse: {
                    etag: "132"
                }
            };
            ussFile.mockResolvedValue(response);
            isDirtyInEditor.mockReturnValueOnce(true);
            isDirtyInEditor.mockReturnValueOnce(false);
            await node.refreshUSS();

            expect(ussFile.mock.calls.length).toBe(1);
            expect(showTextDocument.mock.calls.length).toBe(2);
            expect(executeCommand.mock.calls.length).toBe(1);
            expect(node.downloaded).toBe(true);
        });
        it("refreshUSS works correctly for dirty file state, when user cancelled file save", async () => {
            const node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");

            resetMocks();
            setMocksForNode(node);

            const response: zowe.IZosFilesResponse = {
                success: true,
                commandResponse: null,
                apiResponse: {
                    etag: "132"
                }
            };
            ussFile.mockResolvedValueOnce(response);
            isDirtyInEditor.mockReturnValueOnce(true);
            isDirtyInEditor.mockReturnValueOnce(true);
            await node.refreshUSS();

            expect(ussFile.mock.calls.length).toBe(0);
            expect(showTextDocument.mock.calls.length).toBe(1);
            expect(executeCommand.mock.calls.length).toBe(1);
            expect(node.downloaded).toBe(false);
        });
        it("refreshUSS works correctly for not dirty file state", async () => {
            const node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");

            resetMocks();
            setMocksForNode(node);

            const response: zowe.IZosFilesResponse = {
                success: true,
                commandResponse: null,
                apiResponse: {
                    etag: "132"
                }
            };
            ussFile.mockResolvedValueOnce(response);
            isDirtyInEditor.mockReturnValueOnce(false);
            isDirtyInEditor.mockReturnValueOnce(false);
            await node.refreshUSS();

            expect(ussFile.mock.calls.length).toBe(1);
            expect(showTextDocument.mock.calls.length).toBe(0);
            expect(executeCommand.mock.calls.length).toBe(0);
            expect(node.downloaded).toBe(true);
        });
        it("refreshUSS works correctly with exception thrown in process", async () => {
            const node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");

            resetMocks();
            setMocksForNode(node);

            ussFile.mockRejectedValueOnce(Error(""));
            isDirtyInEditor.mockReturnValueOnce(true);
            isDirtyInEditor.mockReturnValueOnce(false);
            await node.refreshUSS();

            expect(ussFile.mock.calls.length).toBe(1);
            expect(showTextDocument.mock.calls.length).toBe(1);
            expect(executeCommand.mock.calls.length).toBe(1);
            expect(node.downloaded).toBe(false);
        });
    });

    describe("Add USS Session Unit Test", () => {
        const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

        beforeEach(() => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {newprofile: "fake"};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("Testing that addZoweSession will cancel if there is no profile name", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            const entered = undefined;
            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that addZoweSession with supplied profile name", async () => {
            const entered = undefined;
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addZoweSession with existing profile", async () => {
            const entered = "";
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();
        });

        it("Testing that addZoweSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addZoweSession with undefined profile", async () => {
            const entered = "";
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });


        it("Testing that addZoweSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addZoweSession if listProfile is invalid", async () => {
            const entered = "fake";
            const addZoweSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testUSSTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });
    });

    it("Testing that refreshAllUSS is executed successfully", async () => {
        const spy = jest.fn(testTree.refresh);
        ussNodeActions.refreshAllUSS(testTree);
        expect(testTree.refresh).toHaveBeenCalled();
    });

    // TODO Node tests
    it("Testing that open is executed successfully", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        withProgress.mockReset();

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/", false, profileOne.name);
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/", false, profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent", false, profileOne.name);

        const isBinSpy = jest.spyOn(ussApi, "isFileTagBinOrAscii");
        existsSync.mockReturnValue(null);
        openTextDocument.mockResolvedValueOnce("test.doc");

        ussFile.mockReturnValueOnce(fileResponse);
        withProgress.mockReturnValue(fileResponse);

        await node.openUSS(false, true, testUSSTree);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.USS_DIR, "/" + extension.getUSSProfile(node) + "/", node.fullPath));
        expect(isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(isFileTagBinOrAscii.mock.calls[0][0]).toBe(session);
        expect(isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );
        withProgress(downloadUSSFile);
        expect(withProgress).toBeCalledWith(downloadUSSFile);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");

        openTextDocument.mockResolvedValueOnce("test.doc");
        const node2 = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.None, ussNode, null, null);

        await node2.openUSS(false, true, testUSSTree);

        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();

        existsSync.mockReturnValue("exists");
        showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, testUSSTree);
        } catch (err) {
            // do nothing
        }

        expect(ussFile.mock.calls.length).toBe(0);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("testError");

        const child2 = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, node2, null, null);
        try {
            await child2.openUSS(false, true, testUSSTree);
        } catch (err) {
            // do nothing
        }

        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();
        showErrorMessage.mockReset();

        const badparent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, null);
        badparent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badparent, null, null);
        try {
            await brat.openUSS(false, true, testUSSTree);
// tslint:disable-next-line: no-empty
        } catch (err) {
        }
        expect(ussFile.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(2);
        expect(showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node.");
    });

    // TODO Node tests
    it("Tests that openUSS executes successfully with favored files", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();

        ussFile.mockReturnValueOnce(fileResponse);

        openTextDocument.mockResolvedValueOnce("test.doc");

        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name);
        favoriteSession.contextValue = extension.FAVORITE_CONTEXT;

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None, favoriteSession, null, "/", false, profileOne.name);
        favoriteFile.contextValue = extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX;
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
            false, profileOne.name);
        favoriteParent.contextValue = extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX;
        // Set up child of favoriteDir - make sure we can open the child of a favored directory
        const child = new ZoweUSSNode("favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, profileOne.name);
        child.contextValue = extension.DS_TEXT_FILE_CONTEXT;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, testUSSTree);
        expect(showTextDocument.mock.calls.length).toBe(1);
        showTextDocument.mockReset();
        ussFile.mockReturnValueOnce(fileResponse);
        await child.openUSS(false, true, testUSSTree);
        expect(showTextDocument.mock.calls.length).toBe(1);
        showTextDocument.mockReset();
    });

    // TODO Node tests
    it("Testing that open is executed successfully when chtag says binary", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        withProgress.mockReset();

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/", false, ussNode.getProfileName());
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/");
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent");

        isFileTagBinOrAscii.mockReturnValue(true);
        existsSync.mockReturnValue(null);
        openTextDocument.mockResolvedValueOnce("test.doc");

        withProgress.mockReturnValue(fileResponse);

        await node.openUSS(false, true, testUSSTree);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );
        withProgress(downloadUSSFile);
        expect(withProgress).toBeCalledWith(downloadUSSFile);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

        // TODO Node tests
    it("Testing that that openUSS credentials prompt is executed successfully", async () => {
        showQuickPick.mockReset();
        showInputBox.mockReset();
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });

        ussFile.mockReturnValueOnce(fileResponse);
        const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, sessionwocred, null);
        dsNode.contextValue = extension.USS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");

        await dsNode.openUSS(false, true, testUSSTree);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("Testing that that openUSS credentials prompt works with favorites", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, sessionwocred, null);
        dsNode.contextValue = extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");

        ussFile.mockReturnValueOnce(fileResponse);

        await dsNode.openUSS(false, true, testUSSTree);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("Testing that that openUSS credentials prompt with favorites ends in error", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, sessionwocred, null);
        dsNode.contextValue = extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return [undefined, undefined, undefined];
                    }),
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");
        const spyopenUSS = jest.spyOn(dsNode, "openUSS");
        await dsNode.openUSS(false, true, testUSSTree);
        expect(dsNode.openUSS).toHaveBeenCalled();
    });

    it("Testing that that openUSS credentials prompt ends in error", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, sessionwocred, null);
        dsNode.contextValue = extension.USS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        await dsNode.openUSS(false, true, testUSSTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        showQuickPick.mockReset();
        showInputBox.mockReset();
        showInformationMessage.mockReset();
        showErrorMessage.mockReset();
    });


    it("Testing that saveUSSFile is executed successfully", async () => {
        withProgress.mockReset();

        const testDoc: vscode.TextDocument = {
            fileName: path.join(extension.USS_DIR, "usstest", "/u/myuser/testFile"),
            uri: null,
            isUntitled: null,
            languageId: null,
            version: null,
            isDirty: null,
            isClosed: null,
            save: null,
            eol: null,
            lineCount: null,
            lineAt: null,
            offsetAt: null,
            positionAt: null,
            getText: null,
            getWordRangeAtPosition: null,
            validateRange: null,
            validatePosition: null
        };

        const testResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                items: []
            }
        };

        fileList.mockResolvedValueOnce(testResponse);
        ussNode.mProfileName = "usstest";
        ussNode.dirty = true;
        const node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        ussNode.children.push(node);
        testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, ussNode, null, "/"), sessNode]);
        testResponse.apiResponse.items = [{name: "testFile", mode: "-rwxrwx"}];
        fileToUSSFile.mockReset();
        showErrorMessage.mockReset();
        concatChildNodes.mockReset();
        const mockGetEtag = jest.spyOn(node, "getEtag").mockImplementation(() => "123");
        testResponse.success = true;
        fileToUSSFile.mockResolvedValue(testResponse);
        withProgress.mockReturnValueOnce(testResponse);
        concatChildNodes.mockReturnValueOnce([ussNode.children[0]]);
        await extension.saveUSSFile(testDoc, testUSSTree);

        expect(concatChildNodes.mock.calls.length).toBe(1);
        expect(mockGetEtag).toBeCalledTimes(1);
        expect(mockGetEtag).toReturnWith("123");

        concatChildNodes.mockReset();
        concatChildNodes.mockReturnValueOnce([ussNode.children[0]]);
        testResponse.success = false;
        testResponse.commandResponse = "Save failed";
        fileToUSSFile.mockResolvedValueOnce(testResponse);
        withProgress.mockReturnValueOnce(testResponse);

        await extension.saveUSSFile(testDoc, testUSSTree);

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Save failed");

        concatChildNodes.mockReset();
        concatChildNodes.mockReturnValueOnce([ussNode.children[0]]);
        showErrorMessage.mockReset();
        withProgress.mockRejectedValueOnce(Error("Test Error"));

        await extension.saveUSSFile(testDoc, testUSSTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Test Error");

        concatChildNodes.mockReset();
        concatChildNodes.mockReturnValueOnce([ussNode.children[0]]);
        showWarningMessage.mockReset();
        testResponse.success = false;
        testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";
        testDoc.getText = jest.fn();
        ussFile.mockReset();
        withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        const downloadResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: ""
            }
        };
        ussFile.mockResolvedValueOnce(downloadResponse);
        try {
            await extension.saveUSSFile(testDoc, testUSSTree);
        } catch (e) {
            // this is OK. We are interested in the next expect (showWarninMessage) to fullfil
            expect(e.message).toBe("vscode.Position is not a constructor");
        }
        expect(showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
    });

    describe("Add Jobs Session Unit Test", () => {
        const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

        beforeEach(() => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {newprofile: "fake"};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("tests the refresh Jobs Server for prompt credentials", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            const addJobsSession = jest.spyOn(extension, "refreshJobsServer");
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        promptCredentials: jest.fn(()=> {
                            return ["fake", "fake", "fake"];
                        }),
                    };
                })
            });
            const sessionwocred = new imperative.Session({
                user: "",
                password: "",
                hostname: "fake",
                protocol: "https",
                type: "basic",
            });
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = "server";
            newjobNode.contextValue = "server";
            await extension.refreshJobsServer(newjobNode, testJobsTree);
            expect(extension.refreshJobsServer).toHaveBeenCalled();
        });

        it("tests the refresh Jobs Server for prompt credentials, favorites route", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            const addJobsSession = jest.spyOn(extension, "refreshJobsServer");
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        promptCredentials: jest.fn(()=> {
                            return ["fake", "fake", "fake"];
                        }),
                    };
                })
            });
            const sessionwocred = new imperative.Session({
                user: "",
                password: "",
                hostname: "fake",
                protocol: "https",
                type: "basic",
            });
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
            await extension.refreshJobsServer(newjobNode, testJobsTree);
            expect(extension.refreshJobsServer).toHaveBeenCalled();
        });

        it("tests the refresh Jobs Server for prompt credentials with favorites that ends in error", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            const addJobsSession = jest.spyOn(extension, "refreshJobsServer");
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        promptCredentials: jest.fn(()=> {
                            return [undefined, undefined, undefined];
                        }),
                    };
                })
            });
            const sessionwocred = new imperative.Session({
                user: "",
                password: "",
                hostname: "fake",
                protocol: "https",
                type: "basic",
            });
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
            const spyopenPS = jest.spyOn(extension, "refreshJobsServer");
            await extension.refreshJobsServer(newjobNode, testJobsTree);
            expect(extension.refreshJobsServer).toHaveBeenCalled();
        });

        it("tests the refresh Jobs Server", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            const addJobsSession = jest.spyOn(extension, "refreshJobsServer");
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        promptCredentials: jest.fn(()=> {
                            return ["fake", "fake", "fake"];
                        }),
                    };
                })
            });

            createBasicZosmfSession.mockReturnValue(session);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, session, iJob, jobNode.getProfile());
            newjobNode.contextValue = "server";
            newjobNode.contextValue = "server";
            await extension.refreshJobsServer(newjobNode, testJobsTree);
            expect(extension.refreshJobsServer).toHaveBeenCalled();
        });

        it("tests the refresh Jobs Server with invalid prompt credentials", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            const addJobsSession = jest.spyOn(extension, "refreshJobsServer");
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                    };
                })
            });

            const sessionwocred = new imperative.Session({
                user: "",
                password: "",
                hostname: "fake",
                protocol: "https",
                type: "basic",
            });
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = "server";
            newjobNode.contextValue = "server";
            await extension.refreshJobsServer(newjobNode, testJobsTree);
            expect(extension.refreshJobsServer).toHaveBeenCalled();
        });

        it("Testing that addJobsSession will cancel if there is no profile name", async () => {
            const entered = undefined;

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testJobsTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that addJobsSession with supplied profile name", async () => {
            const entered = undefined;
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession with existing profile", async () => {
            const entered = "";
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();
        });

        it("Testing that addJobsSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession with undefined profile", async () => {
            const entered = "";
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });


        it("Testing that addJobsSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession if listProfile is invalid", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "addZoweSession");

            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.addZoweSession(testJobsTree);
            expect(extension.addZoweSession).toHaveBeenCalled();

        });
    });

    it("tests that the prefix is set correctly on the job", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();

        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, session, null, null);

        showInputBox.mockReturnValueOnce("*");
        await extension.setPrefix(node, testJobsTree);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls[0][0]).toEqual({
            prompt: "Prefix"
        });
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests that the owner is set correctly on the job", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();

        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, session, iJob, profileOne);

        showInputBox.mockReturnValueOnce("OWNER");
        await extension.setOwner(node, testJobsTree);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls[0][0]).toEqual({
            prompt: "Owner",
        });
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests that the spool content is opened in a new document", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        await extension.getSpoolContent("sessionName", iJobFile);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("tests that the spool content is not opened in a new document", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                };
            })
        });
        showErrorMessage.mockReset();
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        await extension.getSpoolContent(undefined, undefined);
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests that the spool content credentials prompt is executed successfully", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        createBasicZosmfSession.mockReturnValue(sessionwocred);
        const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
        newjobNode.contextValue = extension.JOBS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                };
            })
        });

        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");

        await extension.getSpoolContent(newjobNode.label, iJobFile);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("tests that the spool content credentials prompt ends in error", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        const sessionwocred = new imperative.Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        createBasicZosmfSession.mockReturnValue(sessionwocred);
        const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
        newjobNode.contextValue = extension.JOBS_SESSION_CONTEXT;
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });

        await extension.getSpoolContent(newjobNode.label, iJobFile);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        showErrorMessage.mockReset();
    });

    it("tests that a stop command is issued", async () => {
        showInformationMessage.mockReset();
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
        await extension.stopCommand(jobNode);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });

    it("tests that a stop command is not issued", async () => {
        showInformationMessage.mockReset();
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
        await extension.stopCommand(undefined);
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests that a modify command is issued", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();
        showInputBox.mockReturnValue("modify");
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
        await extension.modifyCommand(jobNode);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });

    it("tests that a modify command is not issued", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();
        showInputBox.mockReturnValue("modify");
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
        await extension.modifyCommand(undefined);
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests that the spool is downloaded", async () => {
        const fileUri = {fsPath: "/tmp/foo"};
        showOpenDialog.mockReturnValue([fileUri]);
        const downloadFileSpy = jest.spyOn(jesApi, "downloadSpoolContent");
        await extension.downloadSpool(jobNode);
        expect(showOpenDialog).toBeCalled();
        expect(downloadFileSpy).toBeCalled();
        expect(downloadFileSpy.mock.calls[0][0]).toEqual(
            {
                jobid: jobNode.job.jobid,
                jobname: jobNode.job.jobname,
                outDir: fileUri.fsPath
            }
        );
    });

    it("tests that the spool is not downloaded", async () => {
        const fileUri = {fsPath: "/tmp/foo"};
        showOpenDialog.mockReturnValue([fileUri]);
        await extension.downloadSpool(undefined);
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests that the jcl is downloaded", async () => {
        getJclForJob.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        await extension.downloadJcl(jobNode);
        expect(getJclForJob).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(showTextDocument).toBeCalled();
    });

    it("tests that the jcl is not downloaded", async () => {
        getJclForJob.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        await extension.downloadJcl(undefined);
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests that the jcl is submitted", async () => {
        showInformationMessage.mockReset();
        createBasicZosmfSession.mockReturnValue(session);
        submitJcl.mockReturnValue(iJob);
        testTree.getChildren.mockReturnValueOnce([new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null), sessNode]);
        await extension.submitJcl(testTree);
        expect(submitJcl).toBeCalled();
        expect(showInformationMessage).toBeCalled();
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Job submitted [JOB1234](command:zowe.setJobSpool?%5Bnull%2C%22JOB1234%22%5D)");
    });

    it("tests that a pds member is submitted", async () => {
        showErrorMessage.mockReset();
        const rootNode = new ZoweDatasetNode("sessionRoot", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        const file = new ZoweDatasetNode("file", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        file.contextValue = "file";
        const subNode = new ZoweDatasetNode(extension.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        const member = new ZoweDatasetNode(extension.DS_MEMBER_CONTEXT, vscode.TreeItemCollapsibleState.None, subNode, null);
        const favorite = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        favorite.contextValue = extension.FAVORITE_CONTEXT;
        const favoriteSubNode = new ZoweDatasetNode("[test]: TEST.JCL", vscode.TreeItemCollapsibleState.Collapsed, favorite, null);
        favoriteSubNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        const favoritemember = new ZoweDatasetNode(extension.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, favoriteSubNode, null);
        favoritemember.contextValue = extension.DS_MEMBER_CONTEXT;
        const gibberish = new ZoweDatasetNode("gibberish", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        gibberish.contextValue = "gibberish";
        const gibberishSubNode = new ZoweDatasetNode("gibberishmember", vscode.TreeItemCollapsibleState.Collapsed, gibberish, null);
        submitJob.mockReturnValue(iJob);

        // pds member
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        await extension.submitMember(member);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("pds(member)");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sessionRoot%22%2C%22JOB1234%22%5D)");

        // file node
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        await extension.submitMember(file);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("file");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sessionRoot%22%2C%22JOB1234%22%5D)");

        // favorite member
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        favoriteSubNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.submitMember(favoritemember);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("TEST.JCL(pds)");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)");

        // favorite
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        favoriteSubNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.submitMember(favoriteSubNode);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("TEST.JCL");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)");

        // gibberish
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        try {
            await extension.submitMember(gibberishSubNode);
        } catch (e) {
            expect(e.message).toEqual("submitMember() called from invalid node.");
        }
        expect(showInformationMessage).not.toBeCalled();
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("submitMember() called from invalid node.");
    });

    it("Tests that temp folder handles default preference", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();
        // Possibly remove `existsSync` from here and subsequent tests, when implementing "multiple occurrences"
        existsSync.mockReset();
        existsSync.mockReturnValue(true);

        const originalPreferencePath = "";
        const updatedPreferencePath = "/testing";
        const defaultPreference = extension.ZOWETEMPFOLDER;

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(moveSync.mock.calls.length).toBe(1);
        expect(moveSync.mock.calls[0][0]).toBe(defaultPreference);
        expect(moveSync.mock.calls[0][1]).toBe(path.join(path.sep, "testing", "temp"));
    });

    it("Tests that temp folder is moved successfully", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();
        existsSync.mockReset();
        existsSync.mockReturnValue(true);

        const originalPreferencePath = "/test/path";
        const updatedPreferencePath = "/new/test/path";

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(moveSync.mock.calls.length).toBe(1);
        expect(moveSync.mock.calls[0][0]).toBe(path.join(path.sep, "test", "path", "temp"));
        expect(moveSync.mock.calls[0][1]).toBe(path.join(path.sep, "new", "test", "path", "temp"));
    });

    it("Tests that temp folder error thrown 1", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();
        existsSync.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReturnValueOnce(false);

        const originalPreferencePath = "/err/path";
        const updatedPreferencePath = "/err/test/path";
        mkdirSync.mockImplementationOnce(() => {
            throw (Error("testAsError 1"));
        });
        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Error encountered when creating temporary folder! testAsError 1");
    });

    it("Tests that temp folder error thrown 2", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();
        existsSync.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);

        const originalPreferencePath = "/err2/path";
        const updatedPreferencePath = "/err2/test/path";
        moveSync.mockImplementationOnce(() => {
            throw (Error("testAsError 2"));
        });
        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("testAsError 2");
    });

    it("Tests that temp folder does not update on duplicate preference", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();

        const originalPreferencePath = "/test/path";
        const updatedPreferencePath = "/test/path";

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.ZOWETEMPFOLDER);
        expect(moveSync.mock.calls.length).toBe(0);
    });

    // To Do: When supporting "multiple instances", possibly remove this test
    it("Tests that moving temp folder does not show error, if already moved by another Instance", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();

        existsSync.mockReset();
        // Needs to mock once for each path
        existsSync.mockReturnValue(true);
        existsSync.mockReturnValue(true);
        existsSync.mockReturnValue(false);

        const originalPreferencePath = "/invalid/path";
        const updatedPreferencePath = "/test/path";

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(4);
        expect(moveSync.mock.calls.length).toBe(0);

    });

    it("Testing that the add Suffix for datasets works", async () => {
        extension.defineGlobals("/test/path/");
        let node = new ZoweDatasetNode("AUSER.TEST.JCL(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl"));
        node = new ZoweDatasetNode("AUSER.TEST.ASM(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm"));
        node = new ZoweDatasetNode("AUSER.COBOL.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl"));
        node = new ZoweDatasetNode("AUSER.PROD.PLI(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli"));
        node = new ZoweDatasetNode("AUSER.PROD.PLX(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli"));
        node = new ZoweDatasetNode("AUSER.PROD.SH(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh"));
        node = new ZoweDatasetNode("AUSER.REXX.EXEC(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx"));
        node = new ZoweDatasetNode("AUSER.TEST.XML(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml"));

        node = new ZoweDatasetNode("AUSER.TEST.XML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml"));
        node = new ZoweDatasetNode("AUSER.TEST.TXML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML"));
        node = new ZoweDatasetNode("AUSER.XML.TGML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml"));
        node = new ZoweDatasetNode("AUSER.XML.ASM", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm"));
        node = new ZoweDatasetNode("AUSER", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER"));
        node = new ZoweDatasetNode("AUSER.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml"));
        node = new ZoweDatasetNode("XML.AUSER.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)"));
        node = new ZoweDatasetNode("AUSER.COBOL.PL1.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml"));
        node = new ZoweDatasetNode("AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm"));
        node = new ZoweDatasetNode("AUSER.TEST.COPYBOOK", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy"));
        node = new ZoweDatasetNode("AUSER.TEST.PLINC", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc"));
        node = new ZoweDatasetNode("AUSER.TEST.SPFLOG1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toEqual(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log"));
    });

    it("Tests the showDSAttributes function", async () => {
        dataSetList.mockReset();
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const testResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{
                    blksz:"6160",
                    catnm:"ICFCAT.MV3B.CATALOGA",
                    cdate:"2019/05/08",
                    dev:"3390",
                    dsname:"AUSER.A1557332.A996850.TEST1",
                    dsntp:extension.DS_PDS_CONTEXT,
                    dsorg:"PO",
                    edate:"***None***",
                    extx:"1",
                    lrecl:"80",
                    migr:"NO",
                    mvol:"N",
                    ovf:"NO",
                    rdate:"2019/07/17",
                    recfm:"FB",
                    sizex:"15",
                    spacu:"CYLINDERS",
                    used:"6",
                    vol:"3BP001",
                    vols:"3BP001"}]
            }
        };
        const emptyResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                items: []
            }
        };
        createWebviewPanel.mockReturnValue({
            webview: {
                html: ""
            }
        });
        dataSetList.mockReturnValueOnce(testResponse);
        await extension.showDSAttributes(node, testTree);
        expect(dataSetList.mock.calls.length).toBe(1);
        expect(dataSetList.mock.calls[0][0]).toBe(node.getSession());
        expect(dataSetList.mock.calls[0][1]).toBe(node.label);
        expect(dataSetList.mock.calls[0][2]).toEqual({attributes: true } );

        // mock a partitioned data set favorite
        dataSetList.mockReset();
        dataSetList.mockReturnValueOnce(testResponse);
        const node1 = new ZoweDatasetNode("[session]: AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node1.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
        await extension.showDSAttributes(node1, testTree);
        expect(dataSetList.mock.calls.length).toBe(1);

        // mock a classic data set favorite
        dataSetList.mockReset();
        dataSetList.mockReturnValueOnce(testResponse);
        const node2 = new ZoweDatasetNode("[session]: AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node2.contextValue = extension.DS_DS_CONTEXT + extension.FAV_SUFFIX;
        await extension.showDSAttributes(node2, testTree);
        expect(dataSetList.mock.calls.length).toBe(1);

        // mock a response and no attributes
        showErrorMessage.mockReset();
        dataSetList.mockReset();
        dataSetList.mockReturnValueOnce(emptyResponse);
        await expect(extension.showDSAttributes(node1, testTree)).rejects.toEqual(
            Error("No matching data set names found for query: AUSER.A1557332.A996850.TEST1"));
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual(
            "Unable to list attributes: No matching data set names found for query: AUSER.A1557332.A996850.TEST1");
    });

    describe("Renaming Data Sets", () => {
        it("Should rename the node", async () => {
            showInputBox.mockReset();
            renameDataSet.mockReset();

            const child = new ZoweDatasetNode("HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);

            showInputBox.mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
            await extension.renameDataSet(child, testTree);

            expect(renameDataSet.mock.calls.length).toBe(1);
            expect(renameDataSet).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
        });
        it("Should rename a favorited node", async () => {
            showInputBox.mockReset();
            renameDataSet.mockReset();

            const child = new ZoweDatasetNode("[sessNode]: HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            child.contextValue = "ds_fav";
            showInputBox.mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
            await extension.renameDataSet(child, testTree);

            expect(renameDataSet.mock.calls.length).toBe(1);
            expect(renameDataSet).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
        });
        it("Should throw an error if zowe.Rename.dataSet throws", async () => {
            let error;
            const defaultError = new Error("Default error message");

            showInputBox.mockReset();
            renameDataSet.mockReset();
            renameDataSet.mockImplementation(() => { throw defaultError; });

            const child = new ZoweDatasetNode("[sessNode]: HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            child.contextValue = "ds_fav";
            showInputBox.mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
            try {
                await extension.renameDataSet(child, testTree);
            } catch (err) {
                error = err;
            }

            expect(renameDataSet.mock.calls.length).toBe(1);
            expect(renameDataSet).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
            expect(error).toBe(defaultError);
        });
        it("Should rename the member", async () => {
            showInputBox.mockReset();
            renameDataSet.mockReset();

            const parent = new ZoweDatasetNode("HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            const child = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parent, null);

            showInputBox.mockResolvedValueOnce("mem2");
            await extension.renameDataSetMember(child, testTree);

            expect(renameDataSetMember.mock.calls.length).toBe(1);
            expect(renameDataSetMember).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "mem1", "mem2");
        });
        it("Should rename a favorited member", async () => {
            showInputBox.mockReset();
            renameDataSet.mockReset();

            const parent = new ZoweDatasetNode("[sesstest]: HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            const child = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parent, null);

            parent.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
            child.contextValue = extension.DS_MEMBER_CONTEXT;

            showInputBox.mockResolvedValueOnce("mem2");
            await extension.renameDataSetMember(child, testTree);

            expect(renameDataSetMember.mock.calls.length).toBe(1);
            expect(renameDataSetMember).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "mem1", "mem2");
        });
        it("Should throw an error if zowe.Rename.dataSetMember throws", async () => {
            let error;
            const defaultError = new Error("Default error message");

            showInputBox.mockReset();
            renameDataSetMember.mockReset();
            renameDataSetMember.mockImplementation(() => { throw defaultError; });

            const parent = new ZoweDatasetNode("HLQ.TEST.RENAME.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            const child = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parent, null);

            child.contextValue = extension.DS_MEMBER_CONTEXT;

            showInputBox.mockResolvedValueOnce("mem2");
            try {
                await extension.renameDataSetMember(child, testTree);
            } catch (err) {
                error = err;
            }

            expect(renameDataSetMember.mock.calls.length).toBe(1);
            expect(renameDataSetMember).toHaveBeenLastCalledWith(child.getSession(), "HLQ.TEST.RENAME.NODE", "mem1", "mem2");
            expect(error).toBe(defaultError);
        });
    });
    describe("Copying Data Sets", () => {
        it("Should copy the label of a node to the clipboard", async () => {
            renameDataSet.mockReset();

            const node = new ZoweDatasetNode("HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            node.contextValue = extension.DS_SESSION_CONTEXT;

            await extension.copyDataSet(node);
            expect(clipboard.readText()).toBe(JSON.stringify({ profileName: "sestest", dataSetName: "HLQ.TEST.DELETE.NODE" }));
        });
        it("Should copy the label of a favourited node to the clipboard", async () => {
            renameDataSet.mockReset();

            const node = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            node.contextValue = "ds_fav";

            await extension.copyDataSet(node);
            expect(clipboard.readText()).toBe(JSON.stringify({ profileName: "sestest", dataSetName: "HLQ.TEST.DELETE.NODE" }));
        });
        it("Should copy the label of a member to the clipboard", async () => {
            renameDataSet.mockReset();

            const parent = new ZoweDatasetNode("HLQ.TEST.PARENT.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
            parent.contextValue = extension.DS_PDS_CONTEXT;
            child.contextValue = extension.DS_MEMBER_CONTEXT;
            await extension.copyDataSet(child);
            expect(clipboard.readText()).toBe(JSON.stringify({ profileName: "sestest", dataSetName: "HLQ.TEST.PARENT.NODE", memberName: "child" }));
        });
        it("Should copy the label of a favourited member to the clipboard", async () => {
            renameDataSet.mockReset();

            const parent = new ZoweDatasetNode("[sestest]: HLQ.TEST.PARENT.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
            parent.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
            child.contextValue = extension.DS_MEMBER_CONTEXT;
            await extension.copyDataSet(child);
            expect(clipboard.readText()).toBe(JSON.stringify({ profileName: "sestest", dataSetName: "HLQ.TEST.PARENT.NODE", memberName: "child" }));
        });
    });
    describe("Pasting Data Sets", () => {
        it("Should call zowe.Copy.dataSet when pasting to sequential data set", async () => {
            const copySpy = jest.spyOn(mvsApi, "copyDataSetMember");
            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode,
                                             null, undefined, undefined, profileOne);
            node.contextValue = extension.DS_SESSION_CONTEXT;

            clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: profileOne.name }));
            await extension.pasteDataSet(node, testTree);

            expect(copySpy.mock.calls.length).toBe(1);
            expect(copySpy).toHaveBeenLastCalledWith(
                { dataSetName: "HLQ.TEST.BEFORE.NODE" },
                { dataSetName: "HLQ.TEST.TO.NODE" },
            );
        });
        it("Should throw an error if invalid clipboard data is supplied when pasting to sequential data set", async () => {
            let error;
            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode,
                                            null, undefined, undefined, profileOne);
            node.contextValue = extension.DS_SESSION_CONTEXT;
            clipboard.writeText("INVALID");
            try {
                await extension.pasteDataSet(node, testTree);
            } catch(err) {
                error = err;
            }

            expect(error).toBeTruthy();
            expect(error.message).toContain("Invalid clipboard. Copy from data set first");
            expect(copyDataSet.mock.calls.length).toBe(0);
        });
        it("Should not call zowe.Copy.dataSet when pasting to partitioned data set with no member name", async () => {
            dataSetGet.mockImplementation(() => {
                throw Error("Member not found");
            });
            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode,
                                             null, undefined, undefined, profileOne);
            node.contextValue = extension.DS_PDS_CONTEXT;

            clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));
            await extension.pasteDataSet(node, testTree);

            expect(copyDataSet.mock.calls.length).toBe(0);
        });
        it("Should call zowe.Copy.dataSet when pasting to partitioned data set", async () => {
            jest.spyOn(mvsApi, "getContents").mockImplementation(() => {
                throw Error("Member not found");
            });
            const spy2 = jest.spyOn(mvsApi, "copyDataSetMember");

            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None,
                                             sessNode, null, undefined, undefined, profileOne);
            node.contextValue = extension.DS_PDS_CONTEXT;
            showInputBox.mockResolvedValueOnce("mem1");

            clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));
            await extension.pasteDataSet(node, testTree);

            expect(spy2.mock.calls.length).toBe(1);
            expect(findFavoritedNode).toHaveBeenLastCalledWith(
                node,
            );
            expect(spy2).toHaveBeenLastCalledWith(
                { dataSetName: "HLQ.TEST.BEFORE.NODE" },
                { dataSetName: "HLQ.TEST.TO.NODE", memberName: "mem1" },
            );
        });
        it("Should throw an error when pasting to a member that already exists", async () => {
            const testResponse: zowe.IZosFilesResponse = {
                success: true,
                commandResponse: "",
                apiResponse: {
                    items: []
                }
            };
            let error;
            jest.spyOn(mvsApi, "getContents").mockImplementationOnce(async () => testResponse);
            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            node.contextValue = extension.DS_PDS_CONTEXT;
            showInputBox.mockResolvedValueOnce("mem1");

            clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));

            try {
                await extension.pasteDataSet(node, testTree);
            } catch(err) {
                error = err;
            }

            expect(error).toBeTruthy();
            expect(error.message).toBe("HLQ.TEST.TO.NODE(mem1) already exists. You cannot replace a member");
            expect(copyDataSet.mock.calls.length).toBe(0);
        });
        it("Should call zowe.Copy.dataSet when pasting to a favorited partitioned data set", async () => {
            jest.spyOn(mvsApi, "getContents").mockImplementation(() => {
                throw Error("Member not found");
            });
            const copySpy = jest.spyOn(mvsApi, "copyDataSetMember");

            dataSetGet.mockImplementation(() => {
                throw Error("Member not found");
            });
            const favoritedNode = new ZoweDatasetNode("[sestest]: HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null,
                undefined, undefined, profileOne);
            favoritedNode.contextValue = extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX;
            const nonFavoritedNode = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null,
                undefined, undefined, profileOne);
            findNonFavoritedNode.mockImplementation(() => nonFavoritedNode);

            showInputBox.mockResolvedValueOnce("mem1");
            clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));
            await extension.pasteDataSet(favoritedNode, testTree);

            expect(copySpy.mock.calls.length).toBe(1);
            expect(findNonFavoritedNode).toHaveBeenLastCalledWith(
                favoritedNode,
            );
            expect(mockRefreshElement).toHaveBeenLastCalledWith(
                nonFavoritedNode,
            );
            expect(copySpy).toHaveBeenLastCalledWith(
                { dataSetName: "HLQ.TEST.BEFORE.NODE" },
                { dataSetName: "HLQ.TEST.TO.NODE", memberName: "mem1" },
            );
        });
    });
    describe("Migrate Data Sets", () => {
        it("should call HMigrate.hMigrateDataSet on a sequential data set", async () => {
            const migrateSpy = jest.spyOn(mvsApi, "hMigrateDataSet");
            const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
            node.contextValue = extension.DS_DS_CONTEXT;

            await extension.hMigrateDataSet(node);

            expect(migrateSpy.mock.calls.length).toBe(1);
            expect(showInformationMessage).toHaveBeenCalled();
            expect(migrateSpy).toHaveBeenLastCalledWith("HLQ.TEST.TO.NODE");
        });
    });
});
