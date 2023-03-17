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
import { Gui, IZoweJobTreeNode, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { Job, Spool } from "../../../src/job/ZoweJobNode";
import {
    createISession,
    createIProfile,
    createTreeView,
    createISessionWithoutCredentials,
    createTextDocument,
    createInstanceOfProfile,
} from "../../../__mocks__/mockCreators/shared";
import { createIJobFile, createIJobObject, createJobFavoritesNode, createJobSessionNode, createJobsTree } from "../../../__mocks__/mockCreators/jobs";
import { createJesApi, bindJesApi } from "../../../__mocks__/mockCreators/api";
import * as jobActions from "../../../src/job/actions";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as dsActions from "../../../src/dataset/actions";
import * as globals from "../../../src/globals";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { Profiles } from "../../../src/Profiles";
import * as SpoolProvider from "../../../src/SpoolProvider";
import * as refreshActions from "../../../src/shared/refresh";
import { JobSubmitDialogOpts, JOB_SUBMIT_DIALOG_OPTS } from "../../../src/shared/utils";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";

const activeTextEditorDocument = jest.fn();

function createGlobalMocks() {
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: jest.fn().mockImplementation(() => new Map([["zowe.jobs.confirmSubmission", false]])),
        configurable: true,
    });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "warningMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "IssueCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.IssueCommand, "issueSimple", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.GetJobs, "getJclForJob", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn(), configurable: true });
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
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "Uri", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.Uri, "parse", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.Uri.parse, "with", { value: jest.fn(), configurable: true });
    const executeCommand = jest.fn();
    Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand, configurable: true });
    Object.defineProperty(SpoolProvider, "toUniqueJobFileUri", { value: jest.fn(), configurable: true });
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Jobs Actions Unit Tests - Function setPrefix", () => {
    function createBlockMocks() {
        const session = createISession();
        const treeView = createTreeView();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            testJobsTree: createJobsTree(session, iJob, imperativeProfile, treeView),
        };
    }

    it("Checking that the prefix is set correctly on the job", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, null, null);

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
    function createBlockMocks() {
        const session = createISession();
        const treeView = createTreeView();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            testJobsTree: createJobsTree(session, iJob, imperativeProfile, treeView),
        };
    }

    it("Checking that the owner is set correctly on the job", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

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
    function createBlockMocks() {
        const session = createISession();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    it("Checking that stop command of Job Node is executed properly", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.stopCommand(node);
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual("Command response: fake response");
    });
    it("Checking failed attempt to issue stop command for Job Node.", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, undefined, blockMocks.imperativeProfile);
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.stopCommand(node);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function modifyCommand", () => {
    function createBlockMocks() {
        const session = createISession();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    it("Checking modification of Job Node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.modifyCommand(node);
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual("Command response: fake response");
    });
    it("Checking failed attempt to modify Job Node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, undefined, blockMocks.imperativeProfile);
        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response",
        });
        await jobActions.modifyCommand(node);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadSpool", () => {
    function createBlockMocks() {
        const session = createISession();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();
        const jesApi = createJesApi(imperativeProfile);
        bindJesApi(jesApi);

        return {
            session,
            iJob,
            imperativeProfile,
            jesApi,
        };
    }

    it("Checking download of Job Spool", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const jobs: Job[] = [];
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        jobs.push(node);
        mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        const downloadFileSpy = jest.spyOn(blockMocks.jesApi, "downloadSpoolContent");

        await jobActions.downloadSpool(jobs);
        expect(mocked(vscode.window.showOpenDialog)).toBeCalled();
        expect(downloadFileSpy).toBeCalled();
        expect(downloadFileSpy.mock.calls[0][0]).toEqual({
            jobid: node.job.jobid,
            jobname: node.job.jobname,
            outDir: fileUri.fsPath,
        });
    });
    it("Checking failed attempt to download Job Spool", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: "",
        };
        mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        await jobActions.downloadSpool(undefined);
        expect(mocked(Gui.errorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadJcl", () => {
    function createBlockMocks() {
        const session = createISession();
        const iJob = createIJobObject();
        const imperativeProfile = createIProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    it("Checking download of Job JCL", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);
        await jobActions.downloadJcl(node);
        expect(mocked(zowe.GetJobs.getJclForJob)).toBeCalled();
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalled();
    });
    it("Checking failed attempt to download Job JCL", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        await jobActions.downloadJcl(undefined);
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
        bindJesApi(jesApi);

        Object.defineProperty(profileInstance, "loadNamedProfile", {
            value: jest.fn(),
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
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree);

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
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(Gui.showMessage)).toBeCalled();
        expect(mocked(Gui.showMessage).mock.calls.length).toBe(1);
        expect(mocked(Gui.showMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.jobs.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)"
        );
    });

    it("Checking failed attempt to submit of active text editor content as JCL", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValue(blockMocks.session.ISession);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(null); // Here we imitate the case when no profile was selected
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null),
            blockMocks.datasetSessionNode,
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitJcl(blockMocks.testDatasetTree);

        expect(submitJclSpy).not.toBeCalled();
        expect(mocked(globals.LOG.error)).toBeCalled();
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
        const subNode = new ZoweDatasetNode("dataset", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        subNode.contextValue = globals.DS_PDS_CONTEXT;
        const member = new ZoweDatasetNode("member", vscode.TreeItemCollapsibleState.None, subNode, null);
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
        const subNode = new ZoweDatasetNode("dataset", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        subNode.contextValue = globals.DS_PDS_CONTEXT;
        const member = new ZoweDatasetNode("member", vscode.TreeItemCollapsibleState.None, subNode, null);
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
        const dataset = new ZoweDatasetNode("dataset", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
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
        const favProfileNode = new ZoweDatasetNode("test", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favoriteSubNode = new ZoweDatasetNode("TEST.JCL", vscode.TreeItemCollapsibleState.Collapsed, favProfileNode, null);
        favoriteSubNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const favoriteMember = new ZoweDatasetNode(globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, favoriteSubNode, null);
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
        const favProfileNode = new ZoweDatasetNode("test", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favoriteDataset = new ZoweDatasetNode("TEST.JCL", vscode.TreeItemCollapsibleState.Collapsed, favProfileNode, null);
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
        const corruptedNode = new ZoweDatasetNode("gibberish", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        corruptedNode.contextValue = "gibberish";
        const corruptedSubNode = new ZoweDatasetNode("gibberishmember", vscode.TreeItemCollapsibleState.Collapsed, corruptedNode, null);
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        try {
            await dsActions.submitMember(corruptedSubNode);
        } catch (e) {
            expect(e.message).toEqual("submitMember() called from invalid node.");
        }
        expect(submitJobSpy).not.toBeCalled();
        expect(mocked(Gui.showMessage)).not.toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toEqual("submitMember() called from invalid node.");
    });

    it("has proper Submit Job output for all confirmation dialog options", async () => {
        createGlobalMocks();

        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const dataset = new ZoweDatasetNode("TESTUSER.DATASET", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        dataset.contextValue = globals.DS_DS_CONTEXT;

        for (let o = 0; o < JOB_SUBMIT_DIALOG_OPTS.length; o++) {
            const option = JOB_SUBMIT_DIALOG_OPTS[o];
            Object.defineProperty(vscode.workspace, "getConfiguration", {
                value: jest.fn().mockImplementation(() => new Map([["zowe.jobs.confirmSubmission", option]])),
                configurable: true,
            });

            if (option === JOB_SUBMIT_DIALOG_OPTS[JobSubmitDialogOpts.Disabled]) {
                await dsActions.submitMember(dataset);
                expect(mocked(Gui.warningMessage)).not.toHaveBeenCalled();
            } else if (option === JOB_SUBMIT_DIALOG_OPTS[JobSubmitDialogOpts.OtherUserJobs]) {
                dataset.label = "OTHERUSER.DATASET";
                mocked(Gui.warningMessage).mockResolvedValueOnce({ title: "Submit" });
                await dsActions.submitMember(dataset);
                expect(mocked(Gui.warningMessage)).toBeCalledWith("Are you sure you want to submit the following job?\n\n" + dataset.getLabel(), {
                    items: [{ title: "Submit" }],
                    vsCodeOpts: { modal: true },
                });
            } else if (
                option === JOB_SUBMIT_DIALOG_OPTS[JobSubmitDialogOpts.AllJobs] ||
                option === JOB_SUBMIT_DIALOG_OPTS[JobSubmitDialogOpts.YourJobs]
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
        mocked(Gui.warningMessage).mockReturnValueOnce(undefined);
        await dsActions.submitMember(dataset);
        expect(mocked(Gui.warningMessage)).toBeCalledWith("Are you sure you want to submit the following job?\n\n" + dataset.getLabel(), {
            items: [{ title: "Submit" }],
            vsCodeOpts: { modal: true },
        });
    });
});

describe("Jobs Actions Unit Tests - Function getSpoolContent", () => {
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
        const blockMocks = createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
        mocked(SpoolProvider.toUniqueJobFileUri).mockReturnValueOnce(() => blockMocks.mockUri);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);

        await jobActions.getSpoolContent(session, spoolFile, anyTimestamp);

        expect(mocked(vscode.window.showTextDocument)).toBeCalledWith(blockMocks.mockUri, { preview: false });
    });
    it("should call showTextDocument with encoded uri with unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
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
        mocked(SpoolProvider.toUniqueJobFileUri).mockReturnValueOnce(() => blockMocks.mockUri);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);

        await jobActions.getSpoolContent(session, spoolFile, anyTimestamp);

        expect(mocked(vscode.window.showTextDocument)).toBeCalledWith(blockMocks.mockUri, { preview: false });
    });
    it("should show error message for non existing profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(blockMocks.profileInstance.loadNamedProfile).mockImplementationOnce(() => {
            throw new Error("Test");
        });

        await jobActions.getSpoolContent(session, spoolFile, anyTimestamp);

        expect(mocked(vscode.window.showTextDocument)).not.toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalledWith("Test Error: Test");
    });
    it("should show an error message in case document cannot be shown for some reason", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const session = "sessionName";
        const spoolFile = blockMocks.iJobFile;
        const anyTimestamp = Date.now();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(SpoolProvider.toUniqueJobFileUri).mockReturnValueOnce(() => blockMocks.mockUri);
        mocked(vscode.window.showTextDocument).mockImplementationOnce(() => {
            throw new Error("Test");
        });

        await jobActions.getSpoolContent(session, spoolFile, anyTimestamp);

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Test Error: Test");
    });
    it("should fetch the spool content successfully", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testNode = new Job(
            "undefined:test - testJob",
            vscode.TreeItemCollapsibleState.None,
            createJobFavoritesNode(),
            createISessionWithoutCredentials(),
            null,
            createIProfile()
        );
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValue({
            getSpoolFiles: () => [
                {
                    stepName: undefined,
                    ddname: "test",
                    "record-count": "testJob",
                    procstep: "testJob",
                },
            ],
        } as any);
        jest.spyOn(Spool.prototype, "getProfile").mockReturnValue({
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
    it("should focus on the job in the existing tree view session", async () => {
        // arrange
        const submittedJob = createIJobObject();
        const profile = createIProfile();
        const session = createISessionWithoutCredentials();
        const existingJobSession = createJobSessionNode(session, profile);
        const datasetSessionName = existingJobSession.label as string;
        const jobTree = createTreeView();
        const jobTreeProvider = createJobsTree(session, submittedJob, profile, jobTree);
        jobTreeProvider.mSessionNodes.push(existingJobSession);
        const submittedJobNode = new Job(
            submittedJob.jobid,
            vscode.TreeItemCollapsibleState.Collapsed,
            existingJobSession,
            session,
            submittedJob,
            profile
        );
        const updatedJobs = [submittedJobNode];
        existingJobSession.getChildren = jest.fn();
        mocked(existingJobSession.getChildren).mockReturnValueOnce(Promise.resolve(updatedJobs));
        // act
        await jobActions.focusOnJob(jobTreeProvider, datasetSessionName, submittedJob.jobid);
        // assert
        expect(mocked(jobTreeProvider.addSession)).not.toHaveBeenCalled();
        expect(mocked(jobTreeProvider.refreshElement)).toHaveBeenCalledWith(existingJobSession);
        // comparison between tree views is not working properly
        // const expectedTreeView = jobTree;
        const expectedTreeView = expect.anything();
        expect(mocked(jobTreeProvider.setItem)).toHaveBeenCalledWith(expectedTreeView, submittedJobNode);
    });
    it("should add a new tree view session and focus on the job under it", async () => {
        // arrange
        const submittedJob = createIJobObject();
        const profile = createIProfile();
        const session = createISessionWithoutCredentials();
        const newJobSession = createJobSessionNode(session, profile);
        const datasetSessionName = newJobSession.label as string;
        const jobTree = createTreeView();
        const jobTreeProvider = createJobsTree(session, submittedJob, profile, jobTree);
        mocked(jobTreeProvider.addSession).mockImplementationOnce(() => {
            jobTreeProvider.mSessionNodes.push(newJobSession);
        });
        const submittedJobNode = new Job(
            submittedJob.jobid,
            vscode.TreeItemCollapsibleState.Collapsed,
            newJobSession,
            session,
            submittedJob,
            profile
        );
        const updatedJobs = [submittedJobNode];
        newJobSession.getChildren = jest.fn().mockReturnValueOnce(Promise.resolve(updatedJobs));
        // act
        await jobActions.focusOnJob(jobTreeProvider, datasetSessionName, submittedJob.jobid);
        expect((newJobSession as IZoweJobTreeNode).filtered).toBe(true);
        // assert
        expect(mocked(jobTreeProvider.addSession)).toHaveBeenCalledWith(datasetSessionName);
        expect(mocked(jobTreeProvider.refreshElement)).toHaveBeenCalledWith(newJobSession);
        // comparison between tree views is not working properly
        // const expectedTreeView = jobTree;
        const expectedTreeView = expect.anything();
        expect(mocked(jobTreeProvider.setItem)).toHaveBeenCalledWith(expectedTreeView, submittedJobNode);
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

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const job = new Job(
            "jobtest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            blockMocks.session,
            blockMocks.iJob,
            blockMocks.imperativeProfile
        );
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);

        expect(blockMocks.testJobTree.checkCurrentProfile).toHaveBeenCalledWith(job);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
    });
    it("Checking common execution of function with Unverified", async () => {
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
        const job = new Job(
            "jobtest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            blockMocks.session,
            blockMocks.iJob,
            blockMocks.imperativeProfile
        );
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);

        expect(blockMocks.testJobTree.checkCurrentProfile).toHaveBeenCalledWith(job);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
    });
    it("Checking failed attempt to execute the function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const job = new Job(
            "jobtest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            blockMocks.session,
            blockMocks.iJob,
            blockMocks.imperativeProfile
        );
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);
        blockMocks.testJobTree.checkCurrentProfile.mockImplementationOnce(() => {
            throw Error("test");
        });

        try {
            await jobActions.refreshJobsServer(job, blockMocks.testJobTree);
        } catch (err) {
            expect(err).toEqual(Error("test"));
        }

        expect(blockMocks.testJobTree.refreshElement).not.toHaveBeenCalled();
    });
    it("Checking execution of function with credential prompt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const job = new Job(
            "jobtest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            blockMocks.session,
            blockMocks.iJob,
            blockMocks.imperativeProfile
        );
        job.contextValue = globals.JOBS_SESSION_CONTEXT;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);

        expect(blockMocks.testJobTree.checkCurrentProfile).toHaveBeenCalledWith(job);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
    });
    it("Checking execution of function with credential prompt for favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const job = new Job(
            "jobtest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            blockMocks.session,
            blockMocks.iJob,
            blockMocks.imperativeProfile
        );
        job.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        mocked(zowe.ZosmfSession.createSessCfgFromArgs).mockReturnValueOnce(blockMocks.session.ISession);

        await jobActions.refreshJobsServer(job, blockMocks.testJobTree);

        expect(blockMocks.testJobTree.checkCurrentProfile).toHaveBeenCalledWith(job);
        expect(blockMocks.testJobTree.refreshElement).toHaveBeenCalledWith(job);
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
        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, job, profile);

        await jobActions.deleteCommand(jobsProvider, jobNode);

        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode);
    });

    it("should delete multiple jobs from the jobs provider", async () => {
        mockWarningMsg("Delete");
        spyOnRefreshAll();

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.mSessionNodes.push(job2);
        jobsProvider.delete.mockResolvedValue(Promise.resolve());
        const jobNode1 = new Job("jobtest1", vscode.TreeItemCollapsibleState.Expanded, null, session, job, profile);
        const jobNode2 = new Job("jobtest2", vscode.TreeItemCollapsibleState.Expanded, null, session, job2, profile);
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
        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, job, profile);

        await jobActions.deleteCommand(jobsProvider, jobNode);
        expect(mocked(jobsProvider.delete)).not.toBeCalled();
    });

    it("should not refresh the current job session after an error during job deletion", async () => {
        mockWarningMsg("Delete");

        const jobsProvider = createJobsTree(session, job, profile, createTreeView());
        jobsProvider.delete.mockResolvedValueOnce(Promise.reject(new Error("something went wrong!")));
        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, job, profile);
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
        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, job, profile);
        jobsProvider.getTreeView.mockReturnValueOnce({ ...jobsProvider.getTreeView(), selection: [jobNode] });
        // act
        await jobActions.deleteCommand(jobsProvider, undefined);

        // assert
        expect(mocked(jobsProvider.delete)).toBeCalledWith(jobNode);
    });
});
