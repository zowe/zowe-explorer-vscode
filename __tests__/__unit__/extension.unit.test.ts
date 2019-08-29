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
import { ZoweNode } from "../../src/ZoweNode";
import * as brtimperative from "@brightside/imperative";
import * as extension from "../../src/extension";
import * as path from "path";
import * as brightside from "@brightside/core";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as profileLoader from "../../src/ProfileLoader";
import * as ussNodeActions from "../../src/uss/ussNodeActions";
import { Job } from "../../src/zosjobs";
import * as utils from "../../src/utils";

jest.mock("vscode");
jest.mock("Session");
jest.mock("@brightside/core");
jest.mock("@brightside/imperative");
jest.mock("fs");
jest.mock("fs-extra");
jest.mock("DatasetTree");
jest.mock("USSTree");

describe("Extension Unit Tests", () => {
    // Globals
    const session = new brtimperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });

    const iJob: brightside.IJob = {
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

    const iJobFile: brightside.IJobFile = {
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

    const outputChannel: vscode.OutputChannel = {
        append: jest.fn(),
        name: "fakeChannel",
        appendLine: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
    };

    const sessNode = new ZoweNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session);
    sessNode.contextValue = "session";
    sessNode.pattern = "test hlq";

    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
    ussNode.contextValue = "uss_session";
    ussNode.fullPath = "/u/myuser";

    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob);

    const mkdirSync = jest.fn();
    const moveSync = jest.fn();
    const getAllProfileNames = jest.fn();
    const createTreeView = jest.fn();
    const createWebviewPanel = jest.fn();
    const pathMock = jest.fn();
    const registerCommand = jest.fn();
    const onDidSaveTextDocument = jest.fn();
    const onDidCollapseElement = jest.fn();
    const onDidExpandElement = jest.fn();
    const existsSync = jest.fn();
    const createReadStream = jest.fn();
    const readdirSync = jest.fn();
    const unlinkSync = jest.fn();
    const rmdirSync = jest.fn();
    const readFileSync = jest.fn();
    const showErrorMessage = jest.fn();
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
    const fileToUSSFile = jest.fn();
    const dataSetList = jest.fn();
    const fileList = jest.fn();
    const openTextDocument = jest.fn();
    const showTextDocument = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const mockAddSession = jest.fn();
    const mockAddUSSSession = jest.fn();
    const mockAddHistory = jest.fn();
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
    const DeleteJobs = jest.fn();
    const deleteJob = jest.fn();
    const GetJobs = jest.fn();
    const getSpoolContentById = jest.fn();
    const getJclForJob = jest.fn();
    const DownloadJobs = jest.fn();
    const downloadAllSpoolContentCommon = jest.fn();
    const SubmitJobs = jest.fn();
    const submitJcl = jest.fn();
    const submitJob = jest.fn();
    const IssueCommand = jest.fn();
    const issueSimple = jest.fn();
    const createOutputChannel = jest.fn();
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
    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15
        };
    });
    const CliProfileManager = jest.fn().mockImplementation(() => {
        return {getAllProfileNames, load};
    });
    const DatasetTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            mFavorites: [],
            addSession: mockAddSession,
            addHistory: mockAddHistory,
            refresh: mockRefresh,
            refreshElement: mockRefreshElement,
            getChildren: mockGetChildren,
            removeFavorite: mockRemoveFavorite,
            enterPattern: mockPattern,
            initializeFavorites: mockInitialize
        };
    });
    const USSTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            addSession: mockAddUSSSession,
            refresh: mockUSSRefresh,
            addHistory: mockAddHistory,
            refreshElement: mockUSSRefreshElement,
            getChildren: mockGetUSSChildren,
            initializeUSSFavorites: mockInitializeUSS,
            ussFilterPrompt: ussPattern
        };
    });
    const JobsTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            getChildren: jest.fn(),
            addSession: jest.fn(),
            refresh: jest.fn(),
            refreshElement: jest.fn()
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

    const testUSSTree = USSTree();
    testUSSTree.mSessionNodes = [];
    testUSSTree.mSessionNodes.push(ussNode);

    const testJobsTree = JobsTree();
    testJobsTree.mSessionNodes = [];
    testJobsTree.mSessionNodes.push(jobNode);

    Object.defineProperty(profileLoader, "loadNamedProfile", {value: jest.fn()});
    Object.defineProperty(profileLoader, "loadAllProfiles", {
        value: jest.fn(() => {
            return [{name: "firstName"}, {name: "secondName"}];
        })
    });
    Object.defineProperty(profileLoader, "loadDefaultProfile", {value: jest.fn()});

    Object.defineProperty(fs, "mkdirSync", {value: mkdirSync});
    Object.defineProperty(brtimperative, "CliProfileManager", {value: CliProfileManager});
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
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(vscode.window, "showQuickBox", {value: showQuickBox});
    Object.defineProperty(vscode.window, "activeTextEditor", {value: activeTextEditor});
    Object.defineProperty(activeTextEditor, "document", {value: document});
    Object.defineProperty(document, "save", {value: save});
    Object.defineProperty(document, "getText", {value: getText});
    Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});
    Object.defineProperty(brightside, "ZosmfSession", {value: ZosmfSession});
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {value: createBasicZosmfSession});
    Object.defineProperty(brightside, "Upload", {value: Upload});
    Object.defineProperty(Upload, "bufferToDataSet", {value: bufferToDataSet});
    Object.defineProperty(Upload, "pathToDataSet", {value: pathToDataSet});
    Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
    Object.defineProperty(brightside, "Create", {value: Create});
    Object.defineProperty(Create, "dataSet", {value: dataSetCreate});
    Object.defineProperty(brightside, "List", {value: List});
    Object.defineProperty(List, "dataSet", {value: dataSetList});
    Object.defineProperty(List, "fileList", {value: fileList});
    Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "showTextDocument", {value: showTextDocument});
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
    Object.defineProperty(vscode.window, "createOutputChannel", {value: createOutputChannel});
    Object.defineProperty(brightside, "Download", {value: Download});
    Object.defineProperty(Download, "dataSet", {value: dataSet});
    Object.defineProperty(treeMock, "DatasetTree", {value: DatasetTree});
    Object.defineProperty(treeUSSMock, "USSTree", {value: USSTree});
    Object.defineProperty(brightside, "Delete", {value: Delete});
    Object.defineProperty(Delete, "dataSet", {value: delDataset});
    Object.defineProperty(brightside, "CreateDataSetTypeEnum", {value: CreateDataSetTypeEnum});
    Object.defineProperty(brightside, "Utilities", {value: Utilities});
    Object.defineProperty(Download, "ussFile", {value: ussFile});
    Object.defineProperty(Utilities, "isFileTagBinOrAscii", {value: isFileTagBinOrAscii});
    Object.defineProperty(brightside, "DeleteJobs", {value: DeleteJobs});
    Object.defineProperty(DeleteJobs, "deleteJob", {value: deleteJob});
    Object.defineProperty(brightside, "GetJobs", {value: GetJobs});
    Object.defineProperty(GetJobs, "getSpoolContentById", {value: getSpoolContentById});
    Object.defineProperty(GetJobs, "getJclForJob", {value: getJclForJob});
    Object.defineProperty(brightside, "DownloadJobs", {value: DownloadJobs});
    Object.defineProperty(DownloadJobs, "downloadAllSpoolContentCommon", {value: downloadAllSpoolContentCommon});
    Object.defineProperty(brightside, "SubmitJobs", {value: SubmitJobs});
    Object.defineProperty(SubmitJobs, "submitJcl", {value: submitJcl});
    Object.defineProperty(SubmitJobs, "submitJob", {value: submitJob});
    Object.defineProperty(brightside, "IssueCommand", {value: IssueCommand});
    Object.defineProperty(IssueCommand, "issueSimple", {value: issueSimple});
    Object.defineProperty(vscode.workspace, "registerTextDocumentContentProvider", { value: registerTextDocumentContentProvider});
    Object.defineProperty(vscode.Disposable, "from", {value: from});
    Object.defineProperty(vscode.Uri, "parse", {value: parse});

    it("Testing that activate correctly executes", async () => {
        createTreeView.mockReturnValue(testTree);

        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(false);
        readdirSync.mockReturnValueOnce(["firstFile.txt", "secondFile.txt", "firstDir"]);
        isFile.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["thirdFile.txt"]);
        readdirSync.mockReturnValue([]);
        isFile.mockReturnValueOnce(false);
        (profileLoader.loadNamedProfile as any).mockImplementation(() => {
            return {
                profile: "SampleProfile"
            };
        });
        (profileLoader.loadDefaultProfile as any).mockImplementation(() => {
            return {
                profile: "SampleProfile"
            };
        });
        createBasicZosmfSession.mockReturnValue(session);
        getConfiguration.mockReturnValueOnce({
            get: () => "folderpath"
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => "vscode"
        });

        getConfiguration.mockReturnValueOnce({
            get: () => ""
        });

        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ]
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ]
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ]
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser{directory}",
                "[test]: /u/myUser/file.txt{file}",
                "[test]: /u{session}",
            ]
        });
// tslint:disable-next-line: no-object-literal-type-assertion
        const extensionMock = jest.fn(() => ({
            subscriptions: [],
            extensionPath: path.join(__dirname, "..")
        } as vscode.ExtensionContext));
        const mock = new extensionMock();

        await extension.activate(mock);

        const sampleFavorites = [
            new ZoweNode("[test]: brtvs99.public.test", vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined),
            new ZoweNode("[test]: brtvs99.test", vscode.TreeItemCollapsibleState.None, undefined, undefined),
            new ZoweNode("[test]: brtvs99.test.search", vscode.TreeItemCollapsibleState.None, undefined, null)
        ];
        sampleFavorites[0].contextValue = "pdsf";
        sampleFavorites[1].contextValue = "dsf";
        sampleFavorites[2].contextValue = "sessionf";
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
        expect(mkdirSync.mock.calls.length).toBe(3);
        // tslint:disable-next-line: no-magic-numbers
        expect(createTreeView.mock.calls.length).toBe(3);
        expect(createTreeView.mock.calls[0][0]).toBe("zowe.explorer");
        expect(createTreeView.mock.calls[1][0]).toBe("zowe.uss.explorer");
        // tslint:disable-next-line: no-magic-numbers
        expect(registerCommand.mock.calls.length).toBe(51);
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
            "zowe.removeSession",
            "zowe.removeFavorite",
            "zowe.safeSave",
            "zowe.saveSearch",
            "zowe.removeSavedSearch",
            "zowe.submitJcl",
            "zowe.submitMember",
            "zowe.showDSAttributes",
            "zowe.uss.addFavorite",
            "zowe.uss.removeFavorite",
            "zowe.uss.addSession",
            "zowe.uss.refreshAll",
            "zowe.uss.refreshUSS",
            "zowe.uss.safeSaveUSS",
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
            "zowe.issueTsoCmd"
        ];
        expect(actualCommands).toEqual(expectedCommands);
        expect(onDidSaveTextDocument.mock.calls.length).toBe(1);
        // tslint:disable-next-line: no-magic-numbers
        expect(existsSync.mock.calls.length).toBe(3);
        expect(existsSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);
        expect(readdirSync.mock.calls.length).toBe(1);
        expect(readdirSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);
        expect(unlinkSync.mock.calls.length).toBe(2);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.BRIGHTTEMPFOLDER + "/firstFile.txt"));
        expect(unlinkSync.mock.calls[1][0]).toBe(path.join(extension.BRIGHTTEMPFOLDER + "/secondFile.txt"));
        expect(rmdirSync.mock.calls.length).toBe(1);
        expect(rmdirSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);

        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(false);
        // tslint:disable-next-line: no-empty
        rmdirSync.mockImplementationOnce(() => {
        });
        readFileSync.mockReturnValue("");
        // .get("Zowe-Temp-Folder-Location")["folderPath"];
        getConfiguration.mockReturnValueOnce({
            get: () => ""
        });
        // getConfiguration("Zowe-Environment").get("framework");
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => undefined
        });
        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "[test]: brtvs99.public.test{pds}",
                "[test]: brtvs99.test{ds}",
                "[test]: brtvs99.fail{fail}",
                "[test]: brtvs99.test.search{session}",
            ]
        });

        getConfiguration.mockReturnValueOnce({
            get: (setting: string) => [
                "",
            ]
        });
        existsSync.mockReturnValueOnce(true);

        await extension.activate(mock);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(readdirSync.mock.calls.length).toBe(0);

        existsSync.mockReset();
        readdirSync.mockReset();
        existsSync.mockReturnValueOnce(true);
        existsSync.mockReturnValueOnce(true);
        readdirSync.mockReturnValueOnce(["firstFile", "secondFile"]);
        getConfiguration.mockReturnValueOnce({
            get: () => {
                return [""];
            }
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
            get: (setting: string) => "theia"
        });
        await extension.activate(mock);
    });

    it("should not change the existing context menus", async () => {
        const packageJsonContent = require("../../package.json");
        expect(packageJsonContent.contributes.menus["view/item/context"]).toMatchSnapshot();
    });

    it("Testing that createMember correctly executes", async () => {
        const parent = new ZoweNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);

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

        parent.contextValue = "pdsf";
        await extension.createMember(parent, testTree);
    });

    it("Testing that refreshPS correctly executes with and without error", async () => {
        const node = new ZoweNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        dataSet.mockReset();
        showTextDocument.mockReset();

        await extension.refreshPS(node);

        expect(dataSet.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls[0][0]).toBe(node.getSession());
        expect(dataSet.mock.calls[0][1]).toBe(node.label);
        expect(dataSet.mock.calls[0][2]).toEqual({
            file: path.join(extension.DS_DIR, node.getSessionNode().label, node.label )
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

        expect(dataSet.mock.calls[0][1]).toBe(child.mParent.label + "(" + child.label + ")");
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("");

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        dataSet.mockReset();
        showTextDocument.mockReset();

        node.contextValue = "dsf";
        await extension.refreshPS(node);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();

        parent.contextValue = "pdsf";
        await extension.refreshPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();

        parent.contextValue = "favorite";
        await extension.refreshPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        showErrorMessage.mockReset();
        dataSet.mockReset();
        openTextDocument.mockReset();
        parent.contextValue = "turnip";
        await extension.safeSave(child);
        expect(openTextDocument.mock.calls.length).toBe(0);
        expect(dataSet.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("safeSave() called from invalid node.");

    });

    it("Testing that addSession is executed successfully", async () => {
        showQuickPick.mockReset();

        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{name: "firstName"}, {name: "secondName"}]);
        await extension.addSession(testTree);

        // expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        // tslint:disable-next-line
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select a Profile to Add to the Data Set Explorer"
        });

        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([]);

        await extension.addSession(testTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles detected");

        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([]);
        await extension.addSession(testTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles detected");

        showErrorMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await extension.addSession(testTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Unable to load all profiles: testError");

    });

    it("Testing that addJobsSession is executed successfully", async () => {
        showQuickPick.mockReset();

        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{ name: "firstName" }, { name: "secondName" }]);
        await extension.addJobsSession(testJobsTree);

        // expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        // tslint:disable-next-line
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select a Profile to Add to the Jobs Explorer"
        });

        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([]);

        await extension.addJobsSession(testJobsTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No more profiles to add");

        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([]);
        await extension.addJobsSession(testJobsTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No more profiles to add");

        showErrorMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await extension.addJobsSession(testJobsTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Unable to load all profiles: testError");

    });

    it("Testing that createFile is executed successfully", async () => {
        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();

        getConfiguration.mockReturnValue("FakeConfig");
        showInputBox.mockReturnValueOnce("FakeName");


        showQuickPick.mockResolvedValueOnce("Data Set Binary");
        await extension.createFile(sessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set C");
        await extension.createFile(sessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Classic");
        await extension.createFile(sessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Partitioned");
        await extension.createFile(sessNode, testTree);
        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        await extension.createFile(sessNode, testTree);

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

        showQuickPick.mockReset();
        getConfiguration.mockReset();
        showInputBox.mockReset();
        dataSetCreate.mockReset();
        showInformationMessage.mockReset();
        showErrorMessage.mockReset();

        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        getConfiguration.mockReturnValue("FakeConfig");
        showInputBox.mockReturnValueOnce("FakeName");
        await extension.createFile(sessNode, testTree);

        showQuickPick.mockResolvedValueOnce("Data Set Sequential");
        getConfiguration.mockReturnValue("FakeConfig");
        showInputBox.mockReturnValueOnce("FakeName");
        dataSetCreate.mockRejectedValueOnce(Error("Generic Error"));
        try {
            await extension.createFile(sessNode, testTree);
        } catch (err) {
            // do nothing
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Generic Error");


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
    });

    it("Testing that deleteDataset is executed successfully", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();

        let node = new ZoweNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        let child = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(node, testTree);
        expect(delDataset.mock.calls.length).toBe(1);
        expect(delDataset.mock.calls[0][0]).toBe(session);
        expect(delDataset.mock.calls[0][1]).toBe(node.label);
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, node.label ));
        expect(unlinkSync.mock.calls.length).toBe(1);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, node.label ));

        unlinkSync.mockReset();
        delDataset.mockReset();
        existsSync.mockReturnValueOnce(false);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);

        expect(unlinkSync.mock.calls.length).toBe(0);
        expect(delDataset.mock.calls[0][1]).toBe(child.mParent.label + "(" + child.label + ")");

        delDataset.mockReset();
        delDataset.mockRejectedValueOnce(Error("not found"));
        showQuickPick.mockResolvedValueOnce("Yes");

        await extension.deleteDataset(node, testTree);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.label + " was probably already deleted.");

        delDataset.mockReset();
        showErrorMessage.mockReset();
        delDataset.mockRejectedValueOnce(Error(""));
        showQuickPick.mockResolvedValueOnce("Yes");

        await extension.deleteDataset(child, testTree);

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual(Error(""));

        showQuickPick.mockResolvedValueOnce("No");

        await extension.deleteDataset(child, testTree);

        existsSync.mockReturnValueOnce(true);
        node = new ZoweNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node.contextValue = "dsf";
        await extension.deleteDataset(node, testTree);

        existsSync.mockReturnValueOnce(true);
        node.contextValue = "pdsf";
        child = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, node, null);
        await extension.deleteDataset(child, testTree);
    });

    it("Testing that deleteDataset is executed successfully for favorite", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        delDataset.mockReset();
        mockRemoveFavorite.mockReset();

        const node = new ZoweNode("[sestest]: HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const child = new ZoweNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = "favorite";

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);

        expect(delDataset.mock.calls.length).toBe(1);
        expect(delDataset.mock.calls[0][0]).toBe(session);
        expect(delDataset.mock.calls[0][1]).toBe("HLQ.TEST.DELETE.NODE");
        expect(mockRemoveFavorite.mock.calls.length).toBe(1);
        expect(mockRemoveFavorite.mock.calls[0][0].label).toBe( "[sestest]: HLQ.TEST.DELETE.NODE" );
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, "HLQ.TEST.DELETE.NODE" ));
        expect(unlinkSync.mock.calls.length).toBe(1);
        expect(unlinkSync.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label, "HLQ.TEST.DELETE.NODE" ));
    });

    it("Testing that deleteDataset is executed successfully for pdsf", async () => {
        existsSync.mockReset();
        unlinkSync.mockReset();
        showQuickPick.mockReset();
        delDataset.mockReset();
        mockRemoveFavorite.mockReset();

        const node = new ZoweNode("[sestest]: HLQ.TEST.DELETE.PDS", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const child = new ZoweNode("[sestest]: HLQ.TEST.DELETE.PDS(MEMBER)", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = "pdsf";

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);

        expect(delDataset.mock.calls.length).toBe(1);
        expect(delDataset.mock.calls[0][0]).toBe(session);
        expect(delDataset.mock.calls[0][1]).toBe("HLQ.TEST.DELETE.PDS([sestest]: HLQ.TEST.DELETE.PDS(MEMBER))");
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

        const node = new ZoweNode("[sestest]: HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweNode("sestest", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, node, null);
        node.contextValue = "junk";

        existsSync.mockReturnValueOnce(true);
        showQuickPick.mockResolvedValueOnce("Yes");
        await extension.deleteDataset(child, testTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0].message).toEqual("deleteDataSet() called from invalid node.");
    });

    it("Testing that enterPattern is executed successfully", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();

        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node.pattern = "TEST";
        node.contextValue = "session";

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
        mockAddSession.mockReset();
        const favoriteSample = new ZoweNode("[sestest]: HLQ.TEST", vscode.TreeItemCollapsibleState.None, undefined, null);

        await extension.enterPattern(favoriteSample, testTree);

        expect(mockAddSession.mock.calls.length).toBe(1);
        expect(mockAddSession.mock.calls[0][1]).toEqual("sestest");
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

        const testResponse = {
            success: true,
            commandResponse: "",
            apiResponse: {
                items: []
            }
        };
        testTree.getChildren.mockReturnValueOnce([new ZoweNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null), sessNode]);
        dataSetList.mockReset();
        showErrorMessage.mockReset();

        dataSetList.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc, testTree);

        expect(dataSetList.mock.calls.length).toBe(1);
        expect(dataSetList.mock.calls[0][0]).toEqual(session);
        expect(dataSetList.mock.calls[0][1]).toBe("HLQ.TEST.AFILE");
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Data set failed to save. Data set may have been deleted on mainframe.");

        testResponse.apiResponse.items = ["Item1"];
        dataSetList.mockReset();
        pathToDataSet.mockReset();
        showErrorMessage.mockReset();

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        testResponse.success = true;
        pathToDataSet.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc, testTree);

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        testResponse.success = false;
        testResponse.commandResponse = "Save failed";
        pathToDataSet.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc, testTree);

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        pathToDataSet.mockRejectedValueOnce(Error("Test Error"));

        await extension.saveFile(testDoc, testTree);
        // tslint:disable-next-line: no-magic-numbers
        expect(dataSetList.mock.calls.length).toBe(3);
        expect(dataSetList.mock.calls[0][0]).toEqual(session);
        expect(dataSetList.mock.calls[0][1]).toBe("HLQ.TEST.AFILE");
        // expect(pathToDataSet.mock.calls.length).toBe(3);
        // expect(pathToDataSet.mock.calls[0][0]).toEqual(session);
        // expect(pathToDataSet.mock.calls[0][1]).toBe(testDoc.fileName);
        // expect(pathToDataSet.mock.calls[0][2]).toBe("testFile");
        // expect(showErrorMessage.mock.calls.length).toBe(3);
        // expect(showErrorMessage.mock.calls[0][0]).toBe("Save failed");
        // expect(showErrorMessage.mock.calls[1][0]).toBe("Test Error");

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
//        pathToDataSet.mockReset();
        showErrorMessage.mockReset();

        testTree.getChildren.mockReturnValueOnce([sessNode]);
        dataSetList.mockResolvedValueOnce(testResponse);
        testResponse.success = true;
//        pathToDataSet.mockResolvedValueOnce(testResponse);

        await extension.saveFile(testDoc3, testTree);

        // expect(pathToDataSet.mock.calls.length).toBe(1);
        // expect(pathToDataSet.mock.calls[0][0]).toEqual(session);
        // expect(pathToDataSet.mock.calls[0][1]).toBe(testDoc3.fileName);
        // expect(pathToDataSet.mock.calls[0][2]).toBe("testFile(mem)");

        testTree.getChildren.mockReturnValueOnce([new ZoweNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null), sessNode]);
        dataSetList.mockReset();
        showErrorMessage.mockReset();

        dataSetList.mockImplementationOnce(() => {
            throw Error("Test Error");
        });

        await extension.saveFile(testDoc, testTree);

        expect(showErrorMessage.mock.calls.length).toBe(2);

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

        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        existsSync.mockReturnValue(null);
        openTextDocument.mockResolvedValueOnce("test doc");

        await extension.openPS(node);

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
        const node2 = new ZoweNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, sessNode, null);

        await extension.openPS(node2);

        dataSet.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();

        existsSync.mockReturnValue("exists");
        showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await extension.openPS(child);
        } catch (err) {
            // do nothing
        }

        expect(dataSet.mock.calls.length).toBe(0);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getDocumentFilePath(parent.label + "(" + child.label + ")", node));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("testError");

        const child2 = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, node2, null);
        try {
            await extension.openPS(child2);
        } catch (err) {
            // do nothing
        }

        openTextDocument.mockReset();
        showTextDocument.mockReset();
        parent.contextValue = "pdsf";
        await extension.openPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);

        showTextDocument.mockReset();
        openTextDocument.mockReset();

        parent.contextValue = "favorite";
        await extension.openPS(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);

        showErrorMessage.mockReset();
    });

    it("Testing that safeSave is executed successfully", async () => {
        dataSet.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showInformationMessage.mockReset();

        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent = new ZoweNode("parent", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const child = new ZoweNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        openTextDocument.mockResolvedValueOnce("test");

        await extension.safeSave(node);

        expect(dataSet.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls[0][0]).toBe(session);
        expect(dataSet.mock.calls[0][1]).toBe(node.label);
        expect(dataSet.mock.calls[0][2]).toEqual({file: extension.getDocumentFilePath(node.label, node)});
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(path.join(extension.DS_DIR,
            node.getSessionNode().label.trim(), node.label ));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test");
        expect(save.mock.calls.length).toBe(1);

        dataSet.mockReset();
        dataSet.mockRejectedValueOnce(Error("not found"));

        await extension.safeSave(node);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.label + " was probably deleted.");

        dataSet.mockReset();
        showErrorMessage.mockReset();
        dataSet.mockRejectedValueOnce(Error(""));

        await extension.safeSave(child);

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("");

        openTextDocument.mockResolvedValueOnce("test");
        openTextDocument.mockResolvedValueOnce("test");

        dataSet.mockReset();
        openTextDocument.mockReset();
        node.contextValue = "dsf";
        await extension.safeSave(node);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();
        parent.contextValue = "pdsf";
        await extension.safeSave(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        dataSet.mockReset();
        openTextDocument.mockReset();
        parent.contextValue = "favorite";
        await extension.safeSave(child);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(dataSet.mock.calls.length).toBe(1);

        showErrorMessage.mockReset();
        dataSet.mockReset();
        openTextDocument.mockReset();
        parent.contextValue = "turnip";
        await extension.safeSave(child);
        expect(openTextDocument.mock.calls.length).toBe(0);
        expect(dataSet.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("safeSave() called from invalid node.");
    });

    it("Testing that safeSaveUSS is executed successfully", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showInformationMessage.mockReset();
        save.mockReset();

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, null);
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, null);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, null);

        openTextDocument.mockResolvedValueOnce("test");

        await extension.safeSaveUSS(node);

        expect(ussFile.mock.calls.length).toBe(1);
        expect(ussFile.mock.calls[0][0]).toBe(node.getSession());
        expect(ussFile.mock.calls[0][1]).toBe(node.fullPath);
        expect(ussFile.mock.calls[0][2]).toEqual({file: extension.getUSSDocumentFilePath(node)});
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(path.join(extension.getUSSDocumentFilePath(node)));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test");
        expect(save.mock.calls.length).toBe(1);

        ussFile.mockReset();
        ussFile.mockRejectedValueOnce(Error("not found"));

        await extension.safeSaveUSS(node);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.fullPath + " was probably deleted.");

        ussFile.mockReset();
        showErrorMessage.mockReset();
        ussFile.mockRejectedValueOnce(Error(""));

        await extension.safeSaveUSS(child);

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("");
    });

    it("Testing that refreshUSS correctly executes with and without error", async () => {
        const node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, node, null, "/");
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/");

        node.contextValue = "uss_session";
        node.fullPath = "/u/myuser";

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        ussFile.mockReset();
        showTextDocument.mockReset();
        executeCommand.mockReset();

        await extension.refreshUSS(node);

        expect(ussFile.mock.calls.length).toBe(1);
        expect(ussFile.mock.calls[0][0]).toBe(node.getSession());
        expect(ussFile.mock.calls[0][1]).toBe(node.fullPath);
        expect(ussFile.mock.calls[0][2]).toEqual({
            file: extension.getUSSDocumentFilePath(node)
        });
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(path.join(extension.getUSSDocumentFilePath(node)));
        expect(showTextDocument.mock.calls.length).toBe(2);
        expect(executeCommand.mock.calls.length).toBe(1);


        showInformationMessage.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: false});
        executeCommand.mockReset();

        await extension.refreshUSS(node);

        expect(executeCommand.mock.calls.length).toBe(0);

        ussFile.mockRejectedValueOnce(Error("not found"));
        showInformationMessage.mockReset();

        await extension.refreshUSS(node);

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Unable to find file: " + node.label + " was probably deleted.");

        showErrorMessage.mockReset();
        ussFile.mockReset();
        ussFile.mockRejectedValueOnce(Error(""));

        await extension.refreshUSS(child);

        expect(ussFile.mock.calls[0][1]).toBe(child.fullPath);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual(Error(""));

        showErrorMessage.mockReset();
        openTextDocument.mockReset();
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        openTextDocument.mockResolvedValueOnce({isDirty: true});
        ussFile.mockReset();
        showTextDocument.mockReset();

        ussFile.mockReset();
        node.contextValue = "file";
        await extension.refreshUSS(node);
        expect(ussFile.mock.calls[0][1]).toEqual("/u/myuser");

        ussFile.mockReset();
        node.contextValue = "directory";
        await extension.refreshUSS(child);
        expect(ussFile.mock.calls[0][1]).toBe("/child");

        ussFile.mockReset();
        parent.contextValue = "directoryf";
        await extension.refreshUSS(child);
        expect(ussFile.mock.calls[0][1]).toBe("/child");

        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();
        showErrorMessage.mockReset();

        const badparent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, null);
        badparent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badparent, null, null);
        try {
            await extension.refreshUSS(brat);
        } catch (err) {
            expect(err.message).toEqual("refreshPS() called from invalid node.");
        }
        expect(ussFile.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("refreshUSS() called from invalid node.");
    });

    it("Testing that addSession is executed correctly for a USS explorer", async () => {
        showQuickPick.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{name: "firstName"}, {name: "secondName"}]);

        await extension.addUSSSession(testUSSTree);

        expect((profileLoader.loadAllProfiles as any).mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName","secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select a Profile to Add to the USS Explorer"
        });

        // no profiles returned
        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([]);

        await extension.addSession(testUSSTree);

        expect((profileLoader.loadAllProfiles as any).mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles detected");

        // only profile is automatically loaded so should say none left to chose
        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{name: "usstest"}]);

        await extension.addSession(testUSSTree);

        expect((profileLoader.loadAllProfiles as any).mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No more profiles to add");

        showErrorMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await extension.addSession(testUSSTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Unable to load all profiles: testError");

    });

    it("Testing that refreshAllUSS is executed successfully", async () => {
        const spy = jest.fn(testTree.refresh);
        ussNodeActions.refreshAllUSS(testTree);
        expect(testTree.refresh).toHaveBeenCalled();
    });

    it("Testing that open is executed successfully", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        withProgress.mockReset();

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/");
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent");

        isFileTagBinOrAscii.mockReturnValue(false);
        existsSync.mockReturnValue(null);
        openTextDocument.mockResolvedValueOnce("test.doc");

        await extension.openUSS(node);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.USS_DIR, "/" + node.getSessionNode().mProfileName + "/", node.fullPath));
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
        // expect(ussFile.mock.calls.length).toBe(1);
        // expect(ussFile.mock.calls[0][0]).toBe(session);
        // expect(ussFile.mock.calls[0][1]).toBe(node.fullPath);
        // expect(ussFile.mock.calls[0][2]).toEqual({file: extension.getUSSDocumentFilePath(node), binary: false});
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getUSSDocumentFilePath(node));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");

        openTextDocument.mockResolvedValueOnce("test.doc");
        const node2 = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.None, ussNode, null, null);

        await extension.openUSS(node2);

        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        existsSync.mockReset();

        existsSync.mockReturnValue("exists");
        showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await extension.openUSS(child);
        } catch (err) {
            // do nothing
        }

        expect(ussFile.mock.calls.length).toBe(0);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getUSSDocumentFilePath(child));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("testError");

        const child2 = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, node2, null, null);
        try {
            await extension.openUSS(child2);
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
            await extension.openUSS(brat);
// tslint:disable-next-line: no-empty
        } catch (err) {
        }
        expect(ussFile.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(2);
        expect(showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node.");
    });

    it("Tests that openUSS executes successfully with favorited files", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();

        openTextDocument.mockResolvedValueOnce("test.doc");

        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null);
        favoriteSession.contextValue = "favorite";

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None, favoriteSession, null, "/");
        favoriteFile.contextValue = "textfilef";
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/");
        favoriteParent.contextValue = "directoryf";
        // Set up child of favoriteDir - make sure we can open the child of a favorited directory
        const child = new ZoweUSSNode("favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir");
        child.contextValue = "textfile";

        // For each node, make sure that code below the log.debug statement is execute
        await extension.openUSS(favoriteFile);
        expect(showTextDocument.mock.calls.length).toBe(1);
        showTextDocument.mockReset();

        await extension.openUSS(child);
        expect(showTextDocument.mock.calls.length).toBe(1);
        showTextDocument.mockReset();
    });

    it("Testing that open is executed successfully when chtag says binary", async () => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        withProgress.mockReset();

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/");
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent");

        isFileTagBinOrAscii.mockReturnValue(true);
        existsSync.mockReturnValue(null);
        openTextDocument.mockResolvedValueOnce("test.doc");

        await extension.openUSS(node);

        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(extension.USS_DIR, "/" + node.getSessionNode().mProfileName + "/", node.fullPath));
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );
        withProgress(downloadUSSFile);
        expect(withProgress).toBeCalledWith(downloadUSSFile);
        // expect(ussFile.mock.calls.length).toBe(1);
        // expect(ussFile.mock.calls[0][0]).toBe(session);
        // expect(ussFile.mock.calls[0][1]).toBe(node.fullPath);
        // expect(ussFile.mock.calls[0][2]).toEqual({file: extension.getUSSDocumentFilePath(node), binary: true});
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(extension.getUSSDocumentFilePath(node));
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Testing that saveUSSFile is executed successfully", async () => {
        const testDoc: vscode.TextDocument = {
            fileName: path.join(extension.USS_DIR, ussNode.label, "testFile"),
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
        testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, ussNode, null, "/"), sessNode]);

        testResponse.apiResponse.items = ["Item1"];
        fileToUSSFile.mockReset();
        showErrorMessage.mockReset();

        testResponse.success = true;
        fileToUSSFile.mockResolvedValueOnce(testResponse);
        withProgress.mockReturnValueOnce(testResponse);

        await extension.saveUSSFile(testDoc, testUSSTree);

        testResponse.success = false;
        testResponse.commandResponse = "Save failed";
        fileToUSSFile.mockResolvedValueOnce(testResponse);
        withProgress.mockReturnValueOnce(testResponse);

        await extension.saveUSSFile(testDoc, testUSSTree);

        fileToUSSFile.mockRejectedValueOnce(Error("Test Error"));
        showErrorMessage.mockReset();
        withProgress.mockRejectedValueOnce(Error("Test Error"));

        await extension.saveUSSFile(testDoc, testUSSTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Test Error");

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

        testUSSTree.getChildren.mockReturnValueOnce([sessNode]);

        await extension.saveUSSFile(testDoc2, testUSSTree);

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

        fileToUSSFile.mockReset();
        showErrorMessage.mockReset();

        testUSSTree.getChildren.mockReturnValueOnce([sessNode]);
        testResponse.success = true;
        fileToUSSFile.mockResolvedValueOnce(testResponse);

        await extension.saveUSSFile(testDoc3, testUSSTree);
    });

    it("tests that the prefix is set correctly on the job", async () => {
        showInformationMessage.mockReset();
        showInputBox.mockReset();

        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, session, null);

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

        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, session, iJob);

        showInputBox.mockReturnValueOnce("OWNER");
        await extension.setOwner(node, testJobsTree);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls[0][0]).toEqual({
            prompt: "Owner",
        });
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests that the user is informed when a job is deleted", async () => {
        showInformationMessage.mockReset();
        await extension.deleteJob(jobNode);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            `Job ${jobNode.job.jobname}(${jobNode.job.jobid}) deleted`
        );
    });

    it("tests that the spool content is opened in a new document", async () => {
        showTextDocument.mockReset();
        openTextDocument.mockReset();
        await extension.getSpoolContent("sessionName", iJobFile);
        expect(showTextDocument.mock.calls.length).toBe(1);
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

    it("tests that the spool is downloaded", async () => {
        const fileUri = {fsPath: "/tmp/foo"};
        showOpenDialog.mockReturnValue([fileUri]);
        await extension.downloadSpool(jobNode);
        expect(showOpenDialog).toBeCalled();
        expect(downloadAllSpoolContentCommon).toBeCalled();
        expect(downloadAllSpoolContentCommon.mock.calls[0][0]).toEqual(jobNode.session);
        expect(downloadAllSpoolContentCommon.mock.calls[0][1]).toEqual(
            {
                jobid: jobNode.job.jobid,
                jobname: jobNode.job.jobname,
                outDir: fileUri.fsPath
            }
        );
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

    it("tests that the jcl is submitted", async () => {
        showInformationMessage.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();
        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{ name: "firstName" }, { name: "secondName" }]);
        createBasicZosmfSession.mockReturnValue(session);
        submitJcl.mockReturnValue(iJob);
        await extension.submitJcl(testTree);
        expect(submitJcl).toBeCalled();
        expect(showInformationMessage).toBeCalled();
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Job submitted [JOB1234](command:zowe.setJobSpool?%5Bnull%2C%22JOB1234%22%5D)");
    });

    it("tests that a pds member is submitted", async () => {
        showErrorMessage.mockReset();
        const rootNode = new ZoweNode("sessionRoot", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        rootNode.contextValue = "session";
        const file = new ZoweNode("file", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        file.contextValue = "file";
        const subNode = new ZoweNode("pds", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        const member = new ZoweNode("member", vscode.TreeItemCollapsibleState.None, subNode, null);
        const favorite = new ZoweNode("favorite", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        const favoriteSubNode = new ZoweNode("memberf", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        const favoritemember = new ZoweNode("pdsf", vscode.TreeItemCollapsibleState.Collapsed, favoriteSubNode, null);
        const gibberish = new ZoweNode("gibberish", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        gibberish.contextValue = "gibberish";
        const gibberishSubNode = new ZoweNode("gibberishmember", vscode.TreeItemCollapsibleState.Collapsed, gibberish, null);
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
        await extension.submitMember(favoritemember);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("memberf(pdsf)");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sessionRoot%22%2C%22JOB1234%22%5D)");


        // favorite
        showInformationMessage.mockReset();
        submitJob.mockReset();
        submitJob.mockReturnValue(iJob);
        await extension.submitMember(favorite);
        expect(submitJob.mock.calls.length).toBe(1);
        expect(submitJob.mock.calls[0][1]).toEqual("favorite");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sessionRoot%22%2C%22JOB1234%22%5D)");

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
        const defaultPreference = extension.BRIGHTTEMPFOLDER;

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(3);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);
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
        expect(mkdirSync.mock.calls.length).toBe(3);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);
        expect(moveSync.mock.calls.length).toBe(1);
        expect(moveSync.mock.calls[0][0]).toBe(path.join(path.sep, "test", "path", "temp"));
        expect(moveSync.mock.calls[0][1]).toBe(path.join(path.sep, "new", "test", "path", "temp"));
    });

    it("Tests that temp folder does not update on duplicate preference", () => {
        mkdirSync.mockReset();
        moveSync.mockReset();

        const originalPreferencePath = "/test/path";
        const updatedPreferencePath = "/test/path";

        extension.moveTempFolder(originalPreferencePath, updatedPreferencePath);
        // tslint:disable-next-line: no-magic-numbers
        expect(mkdirSync.mock.calls.length).toBe(3);
        expect(mkdirSync.mock.calls[0][0]).toBe(extension.BRIGHTTEMPFOLDER);
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
        expect(mkdirSync.mock.calls.length).toBe(3);
        expect(moveSync.mock.calls.length).toBe(0);

    });

    it("Testing that the add Suffix for datasets works", async () => {
        extension.defineGlobals("/test/path/");
        let node = new ZoweNode("AUSER.TEST.JCL(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl"));
        node = new ZoweNode("AUSER.TEST.ASM(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm"));
        node = new ZoweNode("AUSER.COBOL.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl"));
        node = new ZoweNode("AUSER.PROD.PLI(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli"));
        node = new ZoweNode("AUSER.PROD.PLX(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli"));
        node = new ZoweNode("AUSER.PROD.SH(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh"));
        node = new ZoweNode("AUSER.REXX.EXEC(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx"));
        node = new ZoweNode("AUSER.TEST.XML(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml"));

        node = new ZoweNode("AUSER.TEST.XML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml"));
        node = new ZoweNode("AUSER.TEST.TXML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML"));
        node = new ZoweNode("AUSER.XML.TGML", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml"));
        node = new ZoweNode("AUSER.XML.ASM", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm"));
        node = new ZoweNode("AUSER", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER"));
        node = new ZoweNode("AUSER.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml"));
        node = new ZoweNode("XML.AUSER.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)"));
        node = new ZoweNode("AUSER.COBOL.PL1.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml"));
        node = new ZoweNode("AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm"));
        node = new ZoweNode("AUSER.TEST.COPYBOOK", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy"));
        node = new ZoweNode("AUSER.TEST.PLINC", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc"));
        node = new ZoweNode("AUSER.TEST.SPFLOG1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        expect(extension.getDocumentFilePath(node.label, node)).toEqual(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log"));
    });

    it("Tests the showDSAttributes function", async () => {
        dataSetList.mockReset();
        const node = new ZoweNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, sessNode, null);
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
                    dsntp:"PDS",
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

        // mock a favorite
        dataSetList.mockReset();
        dataSetList.mockReturnValueOnce(testResponse);
        const node1 = new ZoweNode("[session]: AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, sessNode, null);
        node1.contextValue = "pdsf";
        await extension.showDSAttributes(node1, testTree);
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

    it("tests the issueTsoCommand function", async () => {
        showQuickPick.mockReset();
        showInputBox.mockReset();
        (profileLoader.loadAllProfiles as any).mockReset();

        (profileLoader.loadAllProfiles as any).mockReturnValueOnce([{name: "firstName"},{name: "secondName"}]);

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/d iplinfo");
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});

        await extension.issueTsoCommand(outputChannel);

        expect((profileLoader.loadAllProfiles as any).mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });
});
