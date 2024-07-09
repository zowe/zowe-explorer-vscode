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
import * as zowe from "@zowe/cli";
import { Gui, IZoweJobTreeNode, JobSortOpts, SortDirection, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { ZoweJobNode, ZoweSpoolNode } from "../../../src/job/ZoweJobNode";
import {
    createISession,
    createIProfile,
    createTreeView,
    createISessionWithoutCredentials,
    createTextDocument,
    createInstanceOfProfile,
} from "../../../__mocks__/mockCreators/shared";
import {
    createIJobFile,
    createIJobObject,
    createJobFavoritesNode,
    createJobNode,
    createJobSessionNode,
    createJobsTree,
} from "../../../__mocks__/mockCreators/jobs";
import { createJesApi, bindJesApi } from "../../../__mocks__/mockCreators/api";
import * as jobActions from "../../../src/job/actions";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as dsActions from "../../../src/dataset/actions";
import * as globals from "../../../src/globals";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { Profiles } from "../../../src/Profiles";
import * as SpoolProvider from "../../../src/SpoolProvider";
import * as refreshActions from "../../../src/shared/refresh";
import * as sharedUtils from "../../../src/shared/utils";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { SpoolFile } from "../../../src/SpoolProvider";
import { ZosJobsProvider } from "../../../src/job/ZosJobsProvider";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { mocked } from "../../../__mocks__/mockUtils";
import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";
import * as path from "path";

const activeTextEditorDocument = jest.fn();

function createGlobalMocks() {
    const newMocks = {
        session: createISession(),
        treeView: createTreeView(),
        iJob: createIJobObject(),
        imperativeProfile: createIProfile(),
        JobNode1: new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: createISession(),
            profile: createIProfile(),
            job: settingJobObjects(createIJobObject(), "ZOWEUSR1", "JOB045123", "ABEND S222", "2024-03-12T10:50:08.950Z"),
        }),
        JobNode2: new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: createISession(),
            profile: createIProfile(),
            job: settingJobObjects(createIJobObject(), "ZOWEUSR1", "JOB045120", "CC 0000"),
        }),
        JobNode3: new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: createISession(),
            profile: createIProfile(),
            job: settingJobObjects(createIJobObject(), "ZOWEUSR2", "JOB045125", "CC 0000", "2024-03-12T08:30:08.950Z"),
        }),
        mockJobArray: [],
        testJobsTree: null as any,
        jesApi: null as any,
        mockProfileInstance: null,
    };
    newMocks.mockProfileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
    jest.spyOn(Gui, "createTreeView").mockReturnValue({ onDidCollapseElement: jest.fn() } as any);
    newMocks.testJobsTree = createJobsTree(newMocks.session, newMocks.iJob, newMocks.imperativeProfile, newMocks.treeView);
    newMocks.mockJobArray = [newMocks.JobNode1, newMocks.JobNode2, newMocks.JobNode3] as any;
    newMocks.jesApi = createJesApi(newMocks.imperativeProfile);
    bindJesApi(newMocks.jesApi);
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: jest.fn().mockImplementation(() => new Map([["zowe.jobs.confirmSubmission", false]])),
        configurable: true,
    });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "warningMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "infoMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "showOpenDialog", { value: jest.fn(), configurable: true });
    Object.defineProperty(sharedUtils, "getDefaultUri", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "IssueCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.IssueCommand, "issue", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "CancelJobs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.CancelJobs, "cancelJobForJob", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.GetJobs, "getJclForJob", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.GetJobs, "getStatusForJob", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.GetJobs, "getSpoolContentById", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    jest.spyOn(Gui, "showTextDocument");
    jest.spyOn(vscode.window, "showTextDocument");
    Object.defineProperty(zowe, "ZosmfSession", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.ZosmfSession, "createSessCfgFromArgs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "DownloadJobs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.DownloadJobs, "downloadAllSpoolContentCommon", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "activeTextEditor", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window.activeTextEditor, "document", {
        get: activeTextEditorDocument,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn().mockResolvedValue(newMocks.mockProfileInstance), configurable: true });
    const executeCommand = jest.fn();
    Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand, configurable: true });
    Object.defineProperty(SpoolProvider, "encodeJobFile", { value: jest.fn(), configurable: true });
    Object.defineProperty(SpoolProvider, "toUniqueJobFileUri", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(TreeViewUtils, "expandNode", { value: jest.fn(), configurable: true });
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: jest.fn().mockReturnValue([newMocks.imperativeProfile.name]),
        configurable: true,
    });
    function settingJobObjects(job: zowe.IJob, setjobname: string, setjobid: string, setjobreturncode: string, datecompleted?: string): zowe.IJob {
        job.jobname = setjobname;
        job.jobid = setjobid;
        job.retcode = setjobreturncode;
        job["exec-ended"] = datecompleted;
        return job;
    }

    return newMocks;
}

afterEach(() => {
    jest.clearAllMocks();
});

describe("Jobs Actions Unit Tests - Function setPrefix", () => {
    it("Checking that the prefix is set correctly on the job", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({ label: "job", collapsibleState: vscode.TreeItemCollapsibleState.None, session: blockMocks.session });

        const mySpy = mocked(vscode.window.showInputBox).mockResolvedValue("*");
        await jobActions.setPrefix(node, blockMocks.testJobsTree);

        expect(mySpy.mock.calls.length).toBe(1);
        expect(mySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "Prefix",
            })
        );

        mySpy.mockRestore();
    });
});

describe("Jobs Actions Unit Tests - Function setOwner", () => {
    it("Checking that the owner is set correctly on the job", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });

        const mySpy = mocked(vscode.window.showInputBox).mockResolvedValue("OWNER");
        await jobActions.setOwner(node, blockMocks.testJobsTree);

        expect(mySpy.mock.calls.length).toBe(1);
        expect(mySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "Owner",
            })
        );

        mySpy.mockRestore();
    });
});

describe("Jobs Actions Unit Tests - Function stopCommand", () => {
    it("Checking that stop command of Job Node is executed properly", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });

        mocked(zowe.IssueCommand.issue).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.stopCommand(node);
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual("Command response: fake response");
    });
    it("Checking failed attempt to issue stop command for Job Node.", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        mocked(zowe.IssueCommand.issue).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.stopCommand(node);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function modifyCommand", () => {
    it("Checking modification of Job Node", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });

        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issue).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.modifyCommand(node);
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual("Command response: fake response");
    });
    it("Checking failed attempt to modify Job Node", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issue).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.modifyCommand(node);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadSpool", () => {
    it("Checking download of Job Spool", async () => {
        const blockMocks = createGlobalMocks();
        const jobs: IZoweJobTreeNode[] = [];
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        jobs.push(node);
        mocked(Gui.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        const downloadFileSpy = jest.spyOn(blockMocks.jesApi, "downloadSpoolContent");

        await jobActions.downloadSpool(jobs);
        expect(mocked(Gui.showOpenDialog)).toBeCalled();
        expect(downloadFileSpy).toBeCalled();
        expect(downloadFileSpy.mock.calls[0][0]).toEqual({
            jobid: node.job.jobid,
            jobname: node.job.jobname,
            outDir: fileUri.fsPath,
        });
    });
    it("Checking failed attempt to download Job Spool", async () => {
        createGlobalMocks();
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        mocked(Gui.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        await jobActions.downloadSpool(undefined as any);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadSingleSpool", () => {
    it("Checking download of Job Spool", async () => {
        const blockMocks = createGlobalMocks();
        const iJobFile = createIJobFile();
        const jobs: IZoweJobTreeNode[] = [];
        const spool: zowe.IJobFile = { ...iJobFile, stepname: "test", ddname: "dd", "record-count": 1 };
        const node = new ZoweSpoolNode({
            label: "test:dd - 1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
            spool,
        });
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        jobs.push(node, node);
        mocked(Gui.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        const downloadFileSpy = jest.spyOn(blockMocks.jesApi, "downloadSingleSpool").mockResolvedValue(undefined);
        const getSpoolFilesSpy = jest.spyOn(SpoolProvider, "getSpoolFiles").mockResolvedValueOnce([spool]).mockResolvedValueOnce([]);

        await jobActions.downloadSingleSpool(jobs, true);
        expect(mocked(Gui.showOpenDialog)).toBeCalled();
        expect(getSpoolFilesSpy).toHaveBeenCalledWith(node);
        expect(downloadFileSpy).toHaveBeenCalledTimes(1);
        expect(downloadFileSpy.mock.calls[0][0]).toEqual({
            jobFile: spool,
            binary: true,
            outDir: fileUri.fsPath,
        });
        expect(mocked(Gui.infoMessage)).toBeCalled();
    });

    it("should fail to download single spool files if the extender has not implemented the operation", async () => {
        const blockMocks = createGlobalMocks();
        const iJobFile = createIJobFile();
        const jobs: IZoweJobTreeNode[] = [];
        const spool: zowe.IJobFile = { ...iJobFile, stepname: "test", ddname: "dd", "record-count": 1 };
        const node = new ZoweSpoolNode({
            label: "test:dd - 1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
            spool,
        });
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        jobs.push(node);
        mocked(Gui.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        blockMocks.jesApi.downloadSingleSpool = undefined;
        const getSpoolFilesSpy = jest.spyOn(SpoolProvider, "getSpoolFiles").mockResolvedValue([spool]);

        await jobActions.downloadSingleSpool(jobs, true);
        expect(getSpoolFilesSpy).not.toHaveBeenCalled();
        expect(mocked(Gui.showOpenDialog)).not.toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain("Download Single Spool operation not implemented by extender");
    });
});

describe("Jobs Actions Unit Tests - Function downloadJcl", () => {
    it("Checking download of Job JCL", async () => {
        const blockMocks = createGlobalMocks();
        const node = new ZoweJobNode({
            label: "job",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });
        await jobActions.downloadJcl(node);
        expect(mocked(zowe.GetJobs.getJclForJob)).toBeCalled();
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(Gui.showTextDocument)).toBeCalled();
    });
    it("Checking failed attempt to download Job JCL", async () => {
        createGlobalMocks();
        await jobActions.downloadJcl(undefined as any);
        expect(mocked(Gui.errorMessage)).toBeCalled();
    });
});

describe("Jobs Actions Unit Tests - Function submitJcl", () => {
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const treeView = createTreeView();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const textDocument = createTextDocument("HLQ.TEST.AFILE(mem)", datasetSessionNode);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const jesApi = createJesApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        const mockLoadNamedProfile = jest.fn();
        bindJesApi(jesApi);
        const errorGuiMsgSpy = jest.spyOn(Gui, "errorMessage");
        const errorLogSpy = jest.spyOn(ZoweLogger, "error");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: mockLoadNamedProfile.mockReturnValueOnce(imperativeProfile),
                    checkCurrentProfile: mockCheckCurrentProfile.mockReturnValueOnce({
                        name: imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            datasetSessionNode,
            testDatasetTree: createDatasetTree(datasetSessionNode, treeView),
            textDocument,
            profileInstance,
            jesApi,
            mockCheckCurrentProfile,
            errorLogSpy,
            errorGuiMsgSpy,
            mockLoadNamedProfile,
        };
    }

    it("Checking submit of active text editor content as JCL", async () => {
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockReturnValueOnce(
            new Promise((resolve) => {
                resolve(blockMocks.datasetSessionNode.label);
            })
        );
        const mockFile = {
            path: "/fake/path/file.txt",
        } as vscode.Uri;
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        const showTextDocumentSpy = jest.spyOn(vscode.window, "showTextDocument");
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree, mockFile);

        expect(showTextDocumentSpy).toBeCalled();
        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
        showTextDocumentSpy.mockClear();
    });
    it("Checking submit of JCL file from VSC explorer tree", async () => {
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockReturnValueOnce(Promise.resolve(blockMocks.datasetSessionNode.label));
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });

    it("Checking submit of active text editor content as JCL with Unverified Profile", async () => {
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockReturnValueOnce(
            new Promise((resolve) => {
                resolve(blockMocks.datasetSessionNode.label);
            })
        );
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking failure of submitting JCL via command palette if not active text editor", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        Object.defineProperty(vscode.window, "activeTextEditor", {
            value: undefined,
            configurable: true,
        });

        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        const errorMsg = "No editor with a document that could be submitted as JCL is currently open.";
        expect(blockMocks.errorLogSpy).toBeCalledWith(errorMsg);
        expect(blockMocks.errorGuiMsgSpy).toBeCalledWith(errorMsg);
    });

    it("Checking cancel option scenario of local JCL submission confirmation dialog", async () => {
        const blockMocks: any = createBlockMocks();
        jest.spyOn(ZoweLogger, "trace").mockImplementation();
        Object.defineProperty(vscode.window, "activeTextEditor", {
            value: { document: { fileName: "test", uri: { fsPath: "fake/profilename/document.txt" } } } as any,
            configurable: true,
        });
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        jest.spyOn(ZoweLogger, "debug").mockImplementation();
        const confirmJobSubmissionSpy = jest.spyOn(dsActions, "confirmJobSubmission");
        confirmJobSubmissionSpy.mockResolvedValue(false);
        await expect(dsActions.submitJcl(blockMocks.testDatasetTree, {} as any)).resolves.toEqual(undefined);
        confirmJobSubmissionSpy.mockRestore();
    });

    it("Checking failed attempt to submit of active text editor content as JCL without profile chosen from quickpick", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["firstName", "secondName"]),
            configurable: true,
        });
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session.ISession);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined); // Here we imitate the case when no profile was selected
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const messageSpy = jest.spyOn(Gui, "infoMessage");
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();

        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(submitJclSpy).not.toBeCalled();
        expect(messageSpy).toBeCalledWith("Operation Cancelled");
    });

    it("Checking API error on submit of active text editor content as JCL", async () => {
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockReturnValueOnce(
            new Promise((resolve) => {
                resolve(blockMocks.datasetSessionNode.label);
            })
        );
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        const testError = new Error("submitJcl failed");
        submitJclSpy.mockRejectedValueOnce(testError);
        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });
    it("If there are no registered profiles", async () => {
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue([]),
            configurable: true,
        });
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const showMessagespy = jest.spyOn(Gui, "showMessage");

        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(showMessagespy).toBeCalledWith("No profiles available");
    });
    it("Getting session name from the path itself", async () => {
        globals.defineGlobals(__dirname);
        createGlobalMocks();
        const blockMocks: any = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const loadNamedProfileSpy = jest.spyOn(blockMocks.profileInstance, "loadNamedProfile");
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode({ label: "node", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: blockMocks.datasetSessionNode }),
            blockMocks.datasetSessionNode,
        ]);
        blockMocks.textDocument.fileName = path.join(globals.USS_DIR, "lpar1_zosmf", "file.txt");
        blockMocks.textDocument.uri = vscode.Uri.file(blockMocks.textDocument.fileName);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree, undefined);

        expect(loadNamedProfileSpy).toBeCalledWith("lpar1_zosmf");
        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function submitMember", () => {
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const jesApi = createJesApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindJesApi(jesApi);

        return {
            session,
            iJob,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            jesApi,
            mockCheckCurrentProfile,
        };
    }

    it("Checking Submit Job for PDS Member content", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const subNode = new ZoweDatasetNode({
            label: "dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        subNode.contextValue = globals.DS_PDS_CONTEXT;
        const member = new ZoweDatasetNode({ label: "member", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: subNode });
        member.contextValue = globals.DS_MEMBER_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(member);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("dataset(member)");
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking Submit Job for PDS Member content with Unverified Profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const subNode = new ZoweDatasetNode({
            label: "dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        subNode.contextValue = globals.DS_PDS_CONTEXT;
        const member = new ZoweDatasetNode({ label: "member", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: subNode });
        member.contextValue = globals.DS_MEMBER_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(member);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("dataset(member)");
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking Submit Job for PS Dataset content", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const dataset = new ZoweDatasetNode({
            label: "dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        dataset.contextValue = globals.DS_DS_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(dataset);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("dataset");
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking Submit Job for Favourite PDS Member content", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favProfileNode = new ZoweDatasetNode({
            label: "test",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favoriteSubNode = new ZoweDatasetNode({
            label: "TEST.JCL",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
        });
        favoriteSubNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const favoriteMember = new ZoweDatasetNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favoriteSubNode,
        });
        favoriteMember.contextValue = globals.DS_MEMBER_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(favoriteMember);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("TEST.JCL(pds)");
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking Submit Job for Favourite PS Dataset content", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favProfileNode = new ZoweDatasetNode({
            label: "test",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favoriteDataset = new ZoweDatasetNode({
            label: "TEST.JCL",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
        });
        favoriteDataset.contextValue = globals.DS_DS_CONTEXT + globals.FAV_SUFFIX;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(favoriteDataset);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("TEST.JCL");
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)"
        );
    });
    it("Checking Submit Job for unsupported Dataset content", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const corruptedNode = new ZoweDatasetNode({
            label: "gibberish",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        corruptedNode.contextValue = "gibberish";
        const corruptedSubNode = new ZoweDatasetNode({
            label: "gibberishmember",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: corruptedNode,
        });
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        try {
            await dsActions.submitMember(corruptedSubNode);
        } catch (e) {
            expect(e.message).toEqual("Cannot submit, item invalid.");
        }
        expect(submitJobSpy).not.toBeCalled();
        expect(mocked(Gui.showMessage)).not.toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toEqual("Cannot submit, item invalid.");
    });

    it("has proper Submit Job output for all confirmation dialog options", async () => {
        createGlobalMocks();

        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const dataset = new ZoweDatasetNode({
            label: "TESTUSER.DATASET",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        dataset.contextValue = globals.DS_DS_CONTEXT;

        for (let o = 0; o < sharedUtils.JOB_SUBMIT_DIALOG_OPTS.length; o++) {
            const option = sharedUtils.JOB_SUBMIT_DIALOG_OPTS[o];
            Object.defineProperty(vscode.workspace, "getConfiguration", {
                value: jest.fn().mockImplementation(() => new Map([["zowe.jobs.confirmSubmission", option]])),
                configurable: true,
            });

            if (option === sharedUtils.JOB_SUBMIT_DIALOG_OPTS[sharedUtils.JobSubmitDialogOpts.Disabled]) {
                await dsActions.submitMember(dataset);
                expect(mocked(Gui.warningMessage)).not.toHaveBeenCalled();
            } else if (option === sharedUtils.JOB_SUBMIT_DIALOG_OPTS[sharedUtils.JobSubmitDialogOpts.OtherUserJobs]) {
                dataset.label = "OTHERUSER.DATASET";
                mocked(Gui.warningMessage).mockResolvedValueOnce({ title: "Submit" });
                await dsActions.submitMember(dataset);
                expect(mocked(Gui.warningMessage)).toBeCalledWith("Are you sure you want to submit the following job?\n\n" + dataset.getLabel(), {
                    items: [{ title: "Submit" }],
                    vsCodeOpts: { modal: true },
                });
            } else if (
                option === sharedUtils.JOB_SUBMIT_DIALOG_OPTS[sharedUtils.JobSubmitDialogOpts.AllJobs] ||
                option === sharedUtils.JOB_SUBMIT_DIALOG_OPTS[sharedUtils.JobSubmitDialogOpts.YourJobs]
            ) {
                dataset.label = "TESTUSER.DATASET";
                mocked(Gui.warningMessage).mockResolvedValueOnce({ title: "Submit" });
                await dsActions.submitMember(dataset);
                expect(mocked(Gui.warningMessage)).toBeCalledWith("Are you sure you want to submit the following job?\n\n" + dataset.getLabel(), {
                    items: [{ title: "Submit" }],
                    vsCodeOpts: { modal: true },
                });
            }
            expect(mocked(Profiles.getInstance)).toHaveBeenCalledTimes(2 * (o + 1));
        }

        // Test for "Cancel" or closing the dialog
        mocked(Gui.warningMessage).mockReturnValueOnce(undefined as any);
        await dsActions.submitMember(dataset);
        expect(mocked(Gui.warningMessage)).toBeCalledWith("Are you sure you want to submit the following job?\n\n" + dataset.getLabel(), {
            items: [{ title: "Submit" }],
            vsCodeOpts: { modal: true },
        });
    });
});

describe("Jobs Actions Unit Tests - Function getSpoolContent", () => {
    async function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const iJob = createIJobObject();
        const iJobFile = createIJobFile();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const testJobTree = createJobsTree(session, iJob, imperativeProfile, treeView);
        const jesApi = createJesApi(imperativeProfile);
        jesApi.getSpoolFiles = jest.fn().mockReturnValue([
            {
                stepName: undefined,
                ddname: "test",
                "record-count": "testJob",
                procstep: "testJob",
            },
        ]);
        const mockCheckCurrentProfile = jest.fn();
        const mockUri: vscode.Uri = {
            scheme: "testScheme",
            authority: "testAuthority",
            path: "testPath",
            query: "testQuery",
            fragment: "testFragment",
            fsPath: "testFsPath",
            with: jest.fn(),
            toJSON: jest.fn(),
        };
        bindJesApi(jesApi);
        await TreeProviders.initializeProviders(null as any, {
            ds: async (ctx) => null as any,
            uss: async (ctx) => null as any,
            job: async (ctx) => testJobTree,
        });

        return {
            session,
            iJob,
            iJobFile,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            jesApi,
            testJobTree,
            mockCheckCurrentProfile,
            mockUri,
        };
    }

    it("should call showTextDocument with encoded uri", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        mocked(SpoolProvider.encodeJobFile).mockReturnValueOnce(blockMocks.mockUri);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);

        await jobActions.getSpoolContent(session, { spool: spoolFile } as any);

        expect(mocked(Gui.showTextDocument)).toBeCalledWith(blockMocks.mockUri, { preview: false });
    });
    it("should call showTextDocument with encoded uri with unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        mocked(SpoolProvider.encodeJobFile).mockReturnValueOnce(blockMocks.mockUri);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);

        await jobActions.getSpoolContent(session, { spool: spoolFile } as any);

        expect(mocked(Gui.showTextDocument)).toBeCalledWith(blockMocks.mockUri, { preview: false });
    });
    it("should show error message for non existing profile", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(blockMocks.profileInstance.loadNamedProfile).mockImplementationOnce(() => {
            throw new Error("Test");
        });

        await jobActions.getSpoolContent(session, { spool: spoolFile } as any);

        expect(mocked(vscode.window.showTextDocument)).not.toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error: Test");
    });
    it("should show an error message in case document cannot be shown for some reason", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(SpoolProvider.encodeJobFile).mockReturnValueOnce(blockMocks.mockUri);
        mocked(vscode.window.showTextDocument).mockImplementationOnce(() => {
            throw new Error("Test");
        });

        await jobActions.getSpoolContent(session, { spool: spoolFile } as any);

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error: Test");
    });
    it("should fetch the spool content successfully", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const testNode = new ZoweJobNode({
            label: "undefined:test - testJob",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: createJobFavoritesNode(),
            session: createISessionWithoutCredentials(),
            profile: createIProfile(),
        });
        jest.spyOn(ZoweSpoolNode.prototype, "getProfile").mockReturnValue({
            name: "test",
        } as any);
        mocked(SpoolProvider.toUniqueJobFileUri).mockReturnValueOnce(() => blockMocks.mockUri);
        mocked(vscode.window.showTextDocument).mockImplementationOnce(() => {
            throw new Error("Test");
        });
        await expect(jobActions.getSpoolContentFromMainframe(testNode)).resolves.not.toThrow();
    });
});

describe("focusing on a job in the tree view", () => {
    function createBlockMocks() {
        const submittedJob = createIJobObject();
        const profile = createIProfile();
        const session = createISessionWithoutCredentials();
        const existingJobSession = createJobSessionNode(session, profile);
        const newJobSession = createJobSessionNode(session, profile);
        const datasetSessionName = existingJobSession.label as string;
        const submittedJobNode = new ZoweJobNode({
            label: submittedJob.jobid,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: existingJobSession,
            session: session,
            profile: profile,
            job: submittedJob,
        });
        const jobTree = createTreeView();
        const jobTreeProvider = createJobsTree(session, submittedJob, profile, jobTree);

        return {
            submittedJob,
            profile,
            session,
            existingJobSession,
            newJobSession,
            datasetSessionName,
            submittedJobNode,
            jobTreeProvider,
        };
    }

    it("should focus on the job in the existing tree view session", async () => {
        // arrange
        const blockMocks = createBlockMocks();
        blockMocks.jobTreeProvider.mSessionNodes.push(blockMocks.existingJobSession);
        const updatedJobs = [blockMocks.submittedJobNode];
        blockMocks.existingJobSession.getChildren = jest.fn();
        mocked(blockMocks.existingJobSession.getChildren).mockReturnValueOnce(Promise.resolve(updatedJobs));
        // act
        await jobActions.focusOnJob(blockMocks.jobTreeProvider, blockMocks.datasetSessionName, blockMocks.submittedJob.jobid);
        // assert
        expect(mocked(blockMocks.jobTreeProvider.addSession)).not.toHaveBeenCalled();
        expect(mocked(blockMocks.jobTreeProvider.refreshElement)).toHaveBeenCalledWith(blockMocks.existingJobSession);
        // comparison between tree views is not working properly
        // const expectedTreeView = jobTree;
    });
    it("should add a new tree view session and focus on the job under it", async () => {
        // arrange
        const blockMocks = createBlockMocks();
        mocked(blockMocks.jobTreeProvider.addSession).mockImplementationOnce(() => {
            blockMocks.jobTreeProvider.mSessionNodes.push(blockMocks.newJobSession);
        });
        const updatedJobs = [blockMocks.submittedJobNode];
        blockMocks.newJobSession.getChildren = jest.fn().mockReturnValueOnce(Promise.resolve(updatedJobs));
        // act
        await jobActions.focusOnJob(blockMocks.jobTreeProvider, blockMocks.datasetSessionName, blockMocks.submittedJob.jobid);
        expect((blockMocks.newJobSession as IZoweJobTreeNode).filtered).toBe(true);
        // assert
        expect(mocked(blockMocks.jobTreeProvider.addSession)).toHaveBeenCalledWith(blockMocks.datasetSessionName);
        expect(mocked(blockMocks.jobTreeProvider.refreshElement)).toHaveBeenCalledWith(blockMocks.newJobSession);
        // comparison between tree views is not working properly
        // const expectedTreeView = jobTree;
    });
    it("should handle error focusing on the job", async () => {
        // arrange
        const blockMocks = createBlockMocks();
        blockMocks.jobTreeProvider.mSessionNodes.push(blockMocks.existingJobSession);
        const testError = new Error("focusOnJob failed");
        jest.spyOn(blockMocks.jobTreeProvider, "refreshElement").mockImplementationOnce(() => {
            throw testError;
        });
        // act
        await jobActions.focusOnJob(blockMocks.jobTreeProvider, blockMocks.datasetSessionName, blockMocks.submittedJob.jobid);
        // assert
        expect(mocked(blockMocks.jobTreeProvider.refreshElement)).toHaveBeenCalledWith(blockMocks.existingJobSession);
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });
    it("should handle error adding a new tree view session", async () => {
        // arrange
        const blockMocks = createBlockMocks();
        const testError = new Error("focusOnJob failed");
        jest.spyOn(blockMocks.jobTreeProvider, "addSession").mockRejectedValueOnce(testError);
        // act
        await jobActions.focusOnJob(blockMocks.jobTreeProvider, blockMocks.datasetSessionName, blockMocks.submittedJob.jobid);
        // assert
        expect(mocked(blockMocks.jobTreeProvider.addSession)).toHaveBeenCalledWith(blockMocks.datasetSessionName);
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });

    it("should handle error on clicking the hyperlink of job submitted", async () => {
        // arrange
        const blockMocks = createBlockMocks();
        blockMocks.existingJobSession.children.push(blockMocks.submittedJobNode);
        blockMocks.jobTreeProvider.mSessionNodes.push(blockMocks.existingJobSession);
        const updatedJobs = [blockMocks.submittedJobNode];
        blockMocks.existingJobSession.getChildren = jest.fn();
        mocked(blockMocks.existingJobSession.getChildren).mockReturnValueOnce(Promise.resolve(updatedJobs));
        // act
        await jobActions.focusOnJob(blockMocks.jobTreeProvider, blockMocks.datasetSessionName, blockMocks.submittedJob.jobid);
        // assert
        expect(mocked(blockMocks.jobTreeProvider.addSession)).not.toHaveBeenCalled();
        expect(mocked(blockMocks.jobTreeProvider.refreshElement)).toHaveBeenCalledWith(blockMocks.existingJobSession);
        expect(TreeViewUtils.expandNode).toHaveBeenCalled();
    });
});

describe("Jobs Actions Unit Tests - Function refreshJobsServer", () => {
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const iJob = createIJobObject();
        const iJobFile = createIJobFile();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const testJobTree = createJobsTree(session, iJob, imperativeProfile, treeView);
        const jesApi = createJesApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindJesApi(jesApi);

        return {
            session,
            iJob,
            iJobFile,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            jesApi,
            testJobTree,
            mockCheckCurrentProfile,
        };
    }

    it("Checking common execution of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const job = new ZoweJobNode({
            label: "jobtest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
    });
    it("Checking common execution of function with Unverified", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const job = new ZoweJobNode({
            label: "jobtest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            job: blockMocks.iJob,
        });
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
    });
});

describe("cancelJob", () => {
    createGlobalMocks();
    const session = createISession();
    const profile = createIProfile();
    const jobSessionNode = createJobSessionNode(session, profile);
    const jobNode = createJobNode(jobSessionNode, profile);
    const jobsProvider = createJobsTree(session, jobNode.job, profile, createTreeView());
    const jesCancelJobMock = jest.fn();

    const mockJesApi = (mockFn?: jest.Mock<any, any>): void => {
        const jesApi = createJesApi(profile);
        jesApi.cancelJob = mockFn;
        bindJesApi(jesApi);
    };

    const restoreJesApi = (): void => {
        const jesApi = createJesApi(profile);
        bindJesApi(jesApi);
    };

    beforeEach(() => {
        mockJesApi(jesCancelJobMock);
    });

    beforeEach(() => {
        restoreJesApi();
    });

    it("returns early if no nodes are specified", async () => {
        await jobActions.cancelJobs(jobsProvider, []);
        expect(Gui.showMessage).not.toHaveBeenCalled();
    });

    it("returns early if all nodes in selection have been cancelled", async () => {
        jobNode.job.retcode = "CANCELED";
        await jobActions.cancelJobs(jobsProvider, [jobNode]);
        expect(Gui.showMessage).toHaveBeenCalledWith("The selected jobs were already cancelled.");
    });

    it("shows a warning message if one or more jobs failed to cancel", async () => {
        jobNode.job.retcode = "ACTIVE";
        jesCancelJobMock.mockResolvedValueOnce(false);
        await jobActions.cancelJobs(jobsProvider, [jobNode]);
        expect(Gui.warningMessage).toHaveBeenCalledWith("One or more jobs failed to cancel: \n\nTESTJOB(JOB1234): The job was not cancelled.", {
            vsCodeOpts: { modal: true },
        });
    });

    it("shows a warning message if one or more APIs do not support cancelJob", async () => {
        // Make cancelJob undefined
        mockJesApi();
        jobNode.job.retcode = "ACTIVE";
        await jobActions.cancelJobs(jobsProvider, [jobNode]);
        expect(Gui.warningMessage).toHaveBeenCalledWith(
            "One or more jobs failed to cancel: " + "\n\nTESTJOB(JOB1234): The cancel function is not implemented in this API.",
            {
                vsCodeOpts: { modal: true },
            }
        );
    });

    it("shows matching error messages for one or more failed jobs", async () => {
        jobNode.job.retcode = "ACTIVE";
        jesCancelJobMock.mockRejectedValueOnce(new Error("Failed to cancel job... something went wrong."));
        await jobActions.cancelJobs(jobsProvider, [jobNode]);
        expect(Gui.warningMessage).toHaveBeenCalledWith(
            "One or more jobs failed to cancel: " + "\n\nTESTJOB(JOB1234): Failed to cancel job... something went wrong.",
            {
                vsCodeOpts: { modal: true },
            }
        );
    });

    it("shows a message confirming the jobs were cancelled", async () => {
        jobNode.job.retcode = "ACTIVE";
        jesCancelJobMock.mockResolvedValueOnce(true);
        const setImmediateSpy = jest.spyOn(global, "setImmediate");
        await jobActions.cancelJobs(jobsProvider, [jobNode]);

        // Check that refreshElement was called through setImmediate
        expect(setImmediateSpy).toHaveBeenCalled();

        expect(Gui.showMessage).toHaveBeenCalledWith("Cancelled selected jobs successfully.");
    });

    it("does not work for job session nodes", async () => {
        await jobActions.cancelJobs(jobsProvider, [jobSessionNode]);
        expect(jesCancelJobMock).not.toHaveBeenCalled();
    });
});

describe("job deletion command", () => {
    // general mocks
    createGlobalMocks();
    const session = createISession();
    const profile = createIProfile();
    const job = createIJobObject();
    const job2 = createIJobObject();

    const spyOnRefreshAll = () => {
        const refreshAllStub = jest.fn();
        Object.defineProperty(refreshActions, "refreshAll", {
            value: refreshAllStub,
            configurable: true,
        });
        jest.spyOn(refreshActions, "refreshAll");
    };

    const mockWarningMsg = (option: string) => {
        const warningDialogStub = jest.fn();
        Object.defineProperty(Gui, "warningMessage", {
            value: warningDialogStub,
            configurable: true,
        });
        warningDialogStub.mockResolvedValueOnce(option);
    };

    it("should delete a job from the jobs provider", async () => {
        mockWarningMsg("Delete");
        spyOnRefreshAll();

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.delete.mockResolvedValueOnce(Promise.resolve());
        const jobNode = new ZoweJobNode({ label: "jobtest", collapsibleState: vscode.TreeItemCollapsibleState.Expanded, session, profile, job });

        await jobActions.deleteCommand(jobsProvider, jobNode);

        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode);
    });

    it("should delete multiple jobs from the jobs provider", async () => {
        mockWarningMsg("Delete");
        spyOnRefreshAll();

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.mSessionNodes.push(job2);
        jobsProvider.delete.mockResolvedValue(Promise.resolve());
        const jobNode1 = new ZoweJobNode({ label: "jobtest1", collapsibleState: vscode.TreeItemCollapsibleState.Expanded, session, profile, job });
        const jobNode2 = new ZoweJobNode({
            label: "jobtest2",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session,
            profile,
            job: job2,
        });
        const jobs = [jobNode1, jobNode2];
        // act
        await jobActions.deleteCommand(jobsProvider, undefined, jobs);
        // assert
        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode1);
        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode2);
    });

    it("should not delete a job in case user cancelled deletion", async () => {
        mockWarningMsg("Cancel");

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.delete.mockResolvedValueOnce(Promise.resolve());
        const jobNode = new ZoweJobNode({ label: "jobtest", collapsibleState: vscode.TreeItemCollapsibleState.Expanded, session, profile, job });

        await jobActions.deleteCommand(jobsProvider, jobNode);
        expect(mocked(jobsProvider.delete)).not.toBeCalled();
    });

    it("should not refresh the current job session after an error during job deletion", async () => {
        mockWarningMsg("Delete");

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.delete.mockResolvedValueOnce(Promise.reject(new Error("something went wrong!")));
        const jobNode = new ZoweJobNode({ label: "jobtest", collapsibleState: vscode.TreeItemCollapsibleState.Expanded, session, profile, job });
        // act
        await jobActions.deleteCommand(jobsProvider, jobNode);
        // assert
        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode);
    });

    it("should delete a job via quick key from the jobs provider", async () => {
        mockWarningMsg("Delete");
        spyOnRefreshAll();

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.delete.mockResolvedValueOnce(Promise.resolve());
        const jobNode = new ZoweJobNode({ label: "jobtest", collapsibleState: vscode.TreeItemCollapsibleState.Expanded, session, profile, job });
        jobsProvider.getTreeView.mockReturnValueOnce({ ...jobsProvider.getTreeView(), selection: [jobNode] });
        // act
        await jobActions.deleteCommand(jobsProvider, undefined);

        // assert
        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode);
    });
});

describe("Job Actions Unit Tests - Misc. functions", () => {
    createGlobalMocks();
    const session = createISession();
    const profile = createIProfile();
    const job = createIJobObject();
    const jobNode = new ZoweJobNode({ label: "job", collapsibleState: vscode.TreeItemCollapsibleState.None, session, profile, job });

    it("refreshJob works as intended", () => {
        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        const refreshElementSpy = jest.spyOn(jobsProvider, "refreshElement");
        jobActions.refreshJob(jobNode, jobsProvider);
        expect(refreshElementSpy).toHaveBeenCalledWith(jobNode);
    });

    it("spoolFilePollEvent works as intended", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: () => ({
                loadNamedProfile: () => profile,
            }),
            configurable: true,
        });
        const testDoc = {
            fileName: "some_spool_file",
            uri: {
                path: "some_random_path",
                scheme: "zosspool",
                // eslint-disable-next-line max-len
                query: '["some.profile",{"recfm":"UA","records-url":"https://some.url/","stepname":"STEP1","subsystem":"SUB1","job-correlator":"someid","byte-count":1298,"lrecl":133,"jobid":"JOB12345","ddname":"JESMSGLG","id":2,"record-count":19,"class":"A","jobname":"IEFBR14T","procstep":null}]',
            },
        } as unknown as vscode.TextDocument;
        const eventEmitter = {
            fire: jest.fn(),
        };
        // add a fake spool file to SpoolProvider
        SpoolProvider.default.files[testDoc.uri.path] = new SpoolFile(testDoc.uri, eventEmitter as unknown as vscode.EventEmitter<vscode.Uri>);

        const fetchContentSpy = jest.spyOn(SpoolFile.prototype, "fetchContent").mockImplementation();
        const statusMsgSpy = jest.spyOn(Gui, "setStatusBarMessage");
        await jobActions.spoolFilePollEvent(testDoc);
        expect(fetchContentSpy).toHaveBeenCalled();
        expect(statusMsgSpy).toHaveBeenCalledWith(`$(sync~spin) Polling: ${testDoc.fileName}...`);
    });
});
describe("sortJobs function", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it("sort by name if same sort by increasing id", async () => {
        const globalMocks = createGlobalMocks();
        const testtree = new ZosJobsProvider();
        const expected = new ZosJobsProvider();
        testtree.mSessionNodes[0].sort = {
            method: JobSortOpts.Id,
            direction: SortDirection.Ascending,
        };
        testtree.mSessionNodes[0].children = [...[globalMocks.mockJobArray[2], globalMocks.mockJobArray[1], globalMocks.mockJobArray[0]]];
        expected.mSessionNodes[0].children = [...[globalMocks.mockJobArray[1], globalMocks.mockJobArray[0], globalMocks.mockJobArray[2]]];
        jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce({ label: "$(case-sensitive) Job Name" });
        const sortbynamespy = jest.spyOn(ZosJobsProvider.prototype, "sortBy");
        //act
        await jobActions.sortJobs(testtree.mSessionNodes[0], testtree);
        //asert
        expect(sortbynamespy).toBeCalledWith(testtree.mSessionNodes[0]);
        expect(sortbynamespy).toHaveBeenCalled();
        expect(sortbynamespy.mock.calls[0][0].children).toStrictEqual(expected.mSessionNodes[0].children);
    });
    it("sorts by increasing order of id", async () => {
        const globalMocks = createGlobalMocks();
        const testtree = new ZosJobsProvider();
        const expected = new ZosJobsProvider();
        testtree.mSessionNodes[0].sort = {
            method: JobSortOpts.Id,
            direction: SortDirection.Ascending,
        };
        testtree.mSessionNodes[0].children = [...[globalMocks.mockJobArray[2], globalMocks.mockJobArray[1], globalMocks.mockJobArray[0]]];
        expected.mSessionNodes[0].children = [...[globalMocks.mockJobArray[1], globalMocks.mockJobArray[0], globalMocks.mockJobArray[2]]];
        const sortbyidspy = jest.spyOn(ZosJobsProvider.prototype, "sortBy");
        jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce({ label: "$(list-ordered) Job ID (default)" });
        //act
        await jobActions.sortJobs(testtree.mSessionNodes[0], testtree);
        //asert
        expect(sortbyidspy).toBeCalledWith(testtree.mSessionNodes[0]);
        expect(sortbyidspy).toHaveBeenCalled();
        expect(sortbyidspy.mock.calls[0][0].children).toStrictEqual(expected.mSessionNodes[0].children);
    });
    it("sort by retcode if same sort by increasing id", async () => {
        const globalMocks = createGlobalMocks();
        const testtree = new ZosJobsProvider();
        const expected = new ZosJobsProvider();
        testtree.mSessionNodes[0].sort = {
            method: JobSortOpts.Id,
            direction: SortDirection.Ascending,
        };
        testtree.mSessionNodes[0].children = [...[globalMocks.mockJobArray[2], globalMocks.mockJobArray[1], globalMocks.mockJobArray[0]]];
        expected.mSessionNodes[0].children = [...[globalMocks.mockJobArray[0], globalMocks.mockJobArray[1], globalMocks.mockJobArray[2]]];
        const sortbyretcodespy = jest.spyOn(ZosJobsProvider.prototype, "sortBy");
        jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce({ label: "$(symbol-numeric) Return Code" });

        //act
        await jobActions.sortJobs(testtree.mSessionNodes[0], testtree);
        //asert
        expect(sortbyretcodespy).toBeCalledWith(testtree.mSessionNodes[0]);
        expect(sortbyretcodespy).toHaveBeenCalled();
        expect(sortbyretcodespy.mock.calls[0][0].children).toStrictEqual(expected.mSessionNodes[0].children);
    });

    it("sort by date completed", async () => {
        const globalMocks = createGlobalMocks();
        const testtree = new ZosJobsProvider();
        const expected = new ZosJobsProvider();
        testtree.mSessionNodes[0].sort = {
            method: JobSortOpts.DateCompleted,
            direction: SortDirection.Ascending,
        };
        testtree.mSessionNodes[0].children = [...[globalMocks.mockJobArray[0], globalMocks.mockJobArray[1], globalMocks.mockJobArray[2]]];
        expected.mSessionNodes[0].children = [...[globalMocks.mockJobArray[2], globalMocks.mockJobArray[0], globalMocks.mockJobArray[1]]];
        jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce({ label: "$(calendar) Date Completed" });
        const sortbynamespy = jest.spyOn(ZosJobsProvider.prototype, "sortBy");
        //act
        await jobActions.sortJobs(testtree.mSessionNodes[0], testtree);
        //asert
        expect(sortbynamespy).toBeCalledWith(testtree.mSessionNodes[0]);
        expect(sortbynamespy).toHaveBeenCalled();
        expect(sortbynamespy.mock.calls[0][0].children).toStrictEqual(expected.mSessionNodes[0].children);
    });

    it("updates sort options after selecting sort direction; returns user to sort selection", async () => {
        const globalMocks = createGlobalMocks();
        const testtree = new ZosJobsProvider();
        testtree.mSessionNodes[0].sort = {
            method: JobSortOpts.Id,
            direction: SortDirection.Ascending,
        };
        testtree.mSessionNodes[0].children = [globalMocks.mockJobArray[0]];
        const jobsSortBy = jest.spyOn(ZosJobsProvider.prototype, "sortBy");
        const quickPickSpy = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce({ label: "$(fold) Sort Direction" });
        quickPickSpy.mockResolvedValueOnce("Descending" as any);
        await jobActions.sortJobs(testtree.mSessionNodes[0], testtree);
        expect(testtree.mSessionNodes[0].sort.direction).toBe(SortDirection.Descending);
        expect(quickPickSpy).toHaveBeenCalledTimes(3);
        expect(jobsSortBy).not.toHaveBeenCalled();
    });
});
