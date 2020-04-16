import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Job } from "../../../src/job/ZoweJobNode";
import {
    generateImperativeSession,
    generateImperativeProfile,
    generateTreeView, generateImperativeSessionWithoutCredentials, generateTextDocument, generateInstanceOfProfile
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

Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn() });
Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn() });
Object.defineProperty(zowe, "IssueCommand", { value: jest.fn() });
Object.defineProperty(zowe.IssueCommand, "issueSimple", { value: jest.fn() });
Object.defineProperty(vscode.window, "showOpenDialog", { value: jest.fn() });
Object.defineProperty(zowe, "GetJobs", { value: jest.fn() });
Object.defineProperty(zowe.GetJobs, "getJclForJob", { value: jest.fn() });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn() });
Object.defineProperty(zowe, "ZosmfSession", { value: jest.fn() });
Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: jest.fn() });
Object.defineProperty(vscode.window, "activeTextEditor", { value: jest.fn() });
Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn() });
Object.defineProperty(vscode.window.activeTextEditor, "document", { get: activeTextEditorDocument });
Object.defineProperty(globals, "LOG", { value: jest.fn() });
Object.defineProperty(globals.LOG, "debug", { value: jest.fn() });
Object.defineProperty(globals.LOG, "error", { value: jest.fn() });
Object.defineProperty(Profiles, "getInstance", { value: jest.fn() });

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = (fn: any): jest.Mock => fn;

describe("Job state operations", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSession();
        const treeView = generateTreeView();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();

        return {
            session,
            treeView,
            iJob,
            imperativeProfile,
            testJobsTree: generateJobsTree(session, iJob, imperativeProfile, treeView)
        };
    }

    beforeEach(() => {
        // Reset global module mocks
        mocked(vscode.window.showInformationMessage).mockReset();
        mocked(vscode.window.showInputBox).mockReset();
    });

    it("Checking that the prefix is set correctly on the job", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null, environmentalMocks.session, null, null);

        mocked(vscode.window.showInputBox).mockReturnValueOnce("*");
        await jobActions.setPrefix(node, environmentalMocks.testJobsTree);

        expect(mocked(vscode.window.showInputBox).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInputBox).mock.calls[0][0]).toEqual({
            prompt: "Prefix"
        });
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(0);
    });
    it("Checking that the owner is set correctly on the job", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            environmentalMocks.session, environmentalMocks.iJob, environmentalMocks.imperativeProfile);

        mocked(vscode.window.showInputBox).mockReturnValueOnce("OWNER");
        await jobActions.setOwner(node, environmentalMocks.testJobsTree);

        expect(mocked(vscode.window.showInputBox).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInputBox).mock.calls[0][0]).toEqual({
            prompt: "Owner",
        });
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(0);
    });
});

describe("Job Node Stop Command", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    beforeEach(() => {
        // Reset global module mocks
        mocked(vscode.window.showInformationMessage).mockReset();
        mocked(vscode.window.showErrorMessage).mockReset();
        mocked(zowe.IssueCommand.issueSimple).mockReset();
    });

    it("Checking that stop command of Job Node is executed properly", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            environmentalMocks.session, environmentalMocks.iJob, environmentalMocks.imperativeProfile);

        mocked(zowe.IssueCommand.issueSimple).mockReturnValueOnce({ commandResponse: "fake response" });
        await jobActions.stopCommand(node);
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });
    it("Checking failed attempt to issue stop command for Job Node.", async () => {
        mocked(zowe.IssueCommand.issueSimple).mockReturnValueOnce({ commandResponse: "fake response" });
        await jobActions.stopCommand(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Job Node Modify Command", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();

        return {
            session,
            iJob,
            imperativeProfile,
        };
    }

    beforeEach(() => {
        // Reset global module mocks
        mocked(vscode.window.showInformationMessage).mockReset();
        mocked(vscode.window.showErrorMessage).mockReset();
        mocked(vscode.window.showInputBox).mockReset();
        mocked(zowe.IssueCommand.issueSimple).mockReset();
    });

    it("Checking modification of Job Node", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            environmentalMocks.session, environmentalMocks.iJob, environmentalMocks.imperativeProfile);

        mocked(vscode.window.showInputBox).mockReturnValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockReturnValueOnce({ commandResponse: "fake response" });
        await jobActions.modifyCommand(node);
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual(
            "Command response: fake response"
        );
    });
    it("Checking failed attempt to modify Job Node", async () => {
        mocked(vscode.window.showInputBox).mockReturnValue("modify");
        mocked(zowe.IssueCommand.issueSimple).mockReturnValueOnce({ commandResponse: "fake response" });
        await jobActions.modifyCommand(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Job Spool Download Command", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();
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
        // Reset global module mocks
        mocked(vscode.window.showOpenDialog).mockReset();
        mocked(vscode.window.showErrorMessage).mockReset();
    });

    it("Checking download of Job Spool", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            environmentalMocks.session, environmentalMocks.iJob, environmentalMocks.imperativeProfile);
        const fileUri = { fsPath: "/tmp/foo" };
        mocked(vscode.window.showOpenDialog).mockReturnValue([fileUri]);
        const downloadFileSpy = jest.spyOn(environmentalMocks.jesApi, "downloadSpoolContent");

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
        const fileUri = { fsPath: "/tmp/foo" };
        mocked(vscode.window.showOpenDialog).mockReturnValue([fileUri]);
        await jobActions.downloadSpool(undefined);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
    });
});

describe("Job JCL Download Command", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSession();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();

        return {
            session,
            iJob,
            imperativeProfile
        };
    }

    beforeEach(() => {
        // Reset global module mocks
        mocked(vscode.window.showOpenDialog).mockReset();
        mocked(vscode.window.showErrorMessage).mockReset();
        mocked(vscode.window.showTextDocument).mockReset();
        mocked(vscode.workspace.openTextDocument).mockReset();
        mocked(zowe.GetJobs.getJclForJob).mockReset();
    });

    it("Checking download of Job JCL", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new Job("job", vscode.TreeItemCollapsibleState.None, null,
            environmentalMocks.session, environmentalMocks.iJob, environmentalMocks.imperativeProfile);

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

describe("Submit JCL from editor", () => {
    function generateEnvironmentalMocks() {
        const session = generateImperativeSessionWithoutCredentials();
        const treeView = generateTreeView();
        const iJob = generateIJobObject();
        const imperativeProfile = generateImperativeProfile();
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
        // Reset global module mocks
        mocked(vscode.window.showInformationMessage).mockReset();
        mocked(vscode.window.showErrorMessage).mockReset();
        mocked(vscode.window.showQuickPick).mockReset();
        mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReset();
        activeTextEditorDocument.mockReset();
        mocked(Profiles.getInstance).mockReset();
        mocked(globals.LOG.error).mockReset();
    });

    it("Checking submit of active text editor content as JCL", async () => {
        const environmentalMocks = generateEnvironmentalMocks();

        mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReturnValue(environmentalMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(environmentalMocks.datasetSessionNode.label);
        environmentalMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null),
            environmentalMocks.datasetSessionNode
        ]);
        activeTextEditorDocument.mockReturnValue(environmentalMocks.textDocument);
        const submitJclSpy = jest.spyOn(environmentalMocks.jesApi, "submitJcl");
        submitJclSpy.mockResolvedValueOnce(environmentalMocks.iJob);
        await dsActions.submitJcl(environmentalMocks.testDatasetTree);

        expect(submitJclSpy).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual("Job submitted [JOB1234](command:zowe.setJobSpool?%5B%22sestest%22%2C%22JOB1234%22%5D)");

        // Reset for spied properties
        submitJclSpy.mockReset();
    });

    it("Checking failed attempt to submit of active text editor content as JCL", async () => {
        const environmentalMocks = generateEnvironmentalMocks();

        mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReturnValue(environmentalMocks.session);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(null); // Here we imitate the case when no profile was selected
        environmentalMocks.testDatasetTree.getChildren.mockResolvedValueOnce([
            new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null),
            environmentalMocks.datasetSessionNode
        ]);
        activeTextEditorDocument.mockReturnValue(environmentalMocks.textDocument);
        const submitJclSpy = jest.spyOn(environmentalMocks.jesApi, "submitJcl");
        submitJclSpy.mockResolvedValueOnce(environmentalMocks.iJob);

        await dsActions.submitJcl(environmentalMocks.testDatasetTree);

        expect(submitJclSpy).not.toBeCalled();
        expect(mocked(globals.LOG.error)).toBeCalled();
    });
});
describe("Job Spool Download Command", () => {
});
