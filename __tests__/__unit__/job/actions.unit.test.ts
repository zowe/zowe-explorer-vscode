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
import * as zowe from "@zowe/cli";
import { Job } from "../../../src/job/ZoweJobNode";
import {
    generateISession,
    generateIProfile,
    generateTreeView, generateISessionWithoutCredentials, generateTextDocument, generateInstanceOfProfile
} from "../../../__mocks__/generators/shared";
import { generateIJobObject, generateJobsTree } from "../../../__mocks__/generators/jobs";
import { generateJesApi, bindJesApi } from "../../../__mocks__/generators/api";
import * as jobActions from "../../../src/job/actions";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as dsActions from "../../../src/dataset/actions";
import * as globals from "../../../src/globals";
import { generateDatasetSessionNode, generateDatasetTree } from "../../../__mocks__/generators/datasets";
import { Profiles } from "../../../src/Profiles";

const activeTextEditorDocument = jest.fn();

function createGlobalMocks() {
    Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "IssueCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.IssueCommand, "issueSimple", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.GetJobs, "getJclForJob", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "activeTextEditor", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window.activeTextEditor, "document", {
        get: activeTextEditorDocument,
        configurable: true
    });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Jobs Actions Unit Tests - Function setPrefix", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const treeView = generateTreeView();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            testJobsTree: generateJobsTree(session, iJob, imperativeProfile, treeView)
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking that the prefix is set correctly on the job", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, blockMocks.session, null, null);

        mocked(vscode.window.showInputBox).mockResolvedValueOnce("*");
        await jobActions.setPrefix(node, blockMocks.testJobsTree);

        expect(mocked(vscode.window.showInputBox).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInputBox).mock.calls[0][0]).toEqual({
            prompt: "Prefix"
        });
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(0);
    });
});

describe("Jobs Actions Unit Tests - Function setOwner", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const treeView = generateTreeView();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            testJobsTree: generateJobsTree(session, iJob, imperativeProfile, treeView)
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking that the owner is set correctly on the job", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        mocked(vscode.window.showInputBox).mockResolvedValueOnce("OWNER");
        await jobActions.setOwner(node, blockMocks.testJobsTree);

        expect(mocked(vscode.window.showInputBox).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInputBox).mock.calls[0][0]).toEqual({
            prompt: "Owner",
        });
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(0);
    });
});

describe("Jobs Actions Unit Tests - Function stopCommand", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking that stop command of Job Node is executed properly", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response"
        });
        await jobActions.stopCommand(node);
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });
    it("Checking failed attempt to issue stop command for Job Node.", async () => {
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response"
        });
        await jobActions.stopCommand(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function modifyCommand", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking modification of Job Node", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response"
        });
        await jobActions.modifyCommand(node);
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });
    it("Checking failed attempt to modify Job Node", async () => {
        mocked(vscode.window.showInputBox).mockResolvedValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockResolvedValueOnce({
            success: false,
            zosmfResponse: [],
            commandResponse: "fake response"
        });
        await jobActions.modifyCommand(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadSpool", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();
        const jesApi = generateJesApi(imperativeProfile);
        bindJesApi(jesApi);

        return {
            session,
            iJob,
            imperativeProfile,
            jesApi
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking download of Job Spool", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: ""
        };
        mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        const downloadFileSpy = jest.spyOn(blockMocks.jesApi, "downloadSpoolContent");

        await jobActions.downloadSpool(node);
        expect(mocked(vscode.window.showOpenDialog)).toBeCalled();
        expect(downloadFileSpy).toBeCalled();
        expect(downloadFileSpy.mock.calls[0][0]).toEqual(
            {
                jobid: node.job.jobid,
                jobname: node.job.jobname,
                outDir: fileUri.fsPath
            }
        );
    });
    it("Checking failed attempt to download Job Spool", async () => {
        const fileUri = {
            fsPath: "/tmp/foo",
            scheme: "",
            authority: "",
            fragment: "",
            path: "",
            query: ""
        };
        mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri as vscode.Uri]);
        await jobActions.downloadSpool(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Jobs Actions Unit Tests - Function downloadJcl", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();

        return {
            session,
            iJob,
            imperativeProfile
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking download of Job JCL", async () => {
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);

        await jobActions.downloadJcl(node);
        expect(mocked(zowe.GetJobs.getJclForJob)).toBeCalled();
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalled();
    });
    it("Checking failed attempt to download Job JCL", async () => {
        await jobActions.downloadJcl(undefined);
        expect(mocked(vscode.window.showErrorMessage)).toBeCalled();
    });
});

describe("Jobs Actions Unit Tests - Function submitJcl", () => {
    let blockMocks;

    function createBlockMocks() {
        const session = generateISessionWithoutCredentials();
        const treeView = generateTreeView();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const textDocument = generateTextDocument(datasetSessionNode, "HLQ.TEST.AFILE(mem)");
        const profileInstance = generateInstanceOfProfile(imperativeProfile);
        const jesApi = generateJesApi(imperativeProfile);
        bindJesApi(jesApi);

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            datasetSessionNode,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView),
            textDocument,
            profileInstance,
            jesApi
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking submit of active text editor content as JCL", async () => {
        mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(blockMocks.datasetSessionNode.label);
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null),
            blockMocks.datasetSessionNode
        ]);
        activeTextEditorDocument.mockReturnValue(blockMocks.textDocument);
        const submitJclSpy = jest.spyOn(blockMocks.jesApi, "submitJcl");
        submitJclSpy.mockClear();
        submitJclSpy.mockResolvedValueOnce(blockMocks.iJob);
        await dsActions.submitJcl(blockMocks.testDatasetTree);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual("Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)");
    });

    it("Checking failed attempt to submit of active text editor content as JCL", async () => {
        mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReturnValue(blockMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(null); // Here we imitate the case when no profile was selected
        blockMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null),
            blockMocks.datasetSessionNode
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
    let blockMocks;

    function createBlockMocks() {
        const session = generateISessionWithoutCredentials();
        const iJob = generateIJobObject();
        const imperativeProfile = generateIProfile();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const profileInstance = generateInstanceOfProfile(imperativeProfile);
        const jesApi = generateJesApi(imperativeProfile);
        bindJesApi(jesApi);

        return {
            session,
            iJob,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            jesApi
        };
    }

    beforeEach(() => {
        createGlobalMocks();
        blockMocks = createBlockMocks();
    });

    it("Checking Submit Job for PDS Member content", async () => {
        const subNode = new ZoweDatasetNode("dataset", vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode, null);
        subNode.contextValue = globals.DS_PDS_CONTEXT;
        const member = new ZoweDatasetNode("member", vscode.TreeItemCollapsibleState.None, subNode, null);
        member.contextValue = globals.DS_MEMBER_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(member);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("dataset(member)");
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)");
    });
    it("Checking Submit Job for PS Dataset content", async () => {
        const dataset = new ZoweDatasetNode("dataset", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        dataset.contextValue = globals.DS_DS_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(dataset);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("dataset");
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)");
    });
    it("Checking Submit Job for Favourite PDS Member content", async () => {
        const favoriteSession = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode, null);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const favoriteSubNode = new ZoweDatasetNode("[test]: TEST.JCL", vscode.TreeItemCollapsibleState.Collapsed,
            favoriteSession, null);
        favoriteSubNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const favoriteMember = new ZoweDatasetNode(globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed,
            favoriteSubNode, null);
        favoriteMember.contextValue = globals.DS_MEMBER_CONTEXT;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(favoriteMember);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("TEST.JCL(pds)");
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)");
    });
    it("Checking Submit Job for Favourite PS Dataset content", async () => {
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favoriteSession = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode, null);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const favoriteDataset = new ZoweDatasetNode("[test]: TEST.JCL", vscode.TreeItemCollapsibleState.Collapsed,
            favoriteSession, null);
        favoriteDataset.contextValue = globals.DS_DS_CONTEXT + globals.FAV_SUFFIX;
        const submitJobSpy = jest.spyOn(blockMocks.jesApi, "submitJob");
        submitJobSpy.mockClear();
        submitJobSpy.mockResolvedValueOnce(blockMocks.iJob);

        await dsActions.submitMember(favoriteDataset);
        expect(submitJobSpy).toBeCalled();
        expect(submitJobSpy.mock.calls[0][0]).toEqual("TEST.JCL");
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22test%22%2C%22JOB1234%22%5D)");
    });
    it("Checking Submit Job for unsupported Dataset content", async () => {
        const corruptedNode = new ZoweDatasetNode("gibberish", vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode, null);
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
        expect(mocked(vscode.window.showInformationMessage)).not.toBeCalled();
        expect(mocked(vscode.window.showErrorMessage)).toBeCalled();
        expect(mocked(vscode.window.showErrorMessage).mock.calls[0][0]).toEqual("submitMember() called from invalid node.");
    });
});
