import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Job } from "../../../src/job/ZoweJobNode";
import {
    generateImperativeSession,
    generateImperativeProfile,
    generateTreeView
} from "../../../__mocks__/generators/shared";
import { generateIJobObject, generateJobsTree } from "../../../__mocks__/generators/jobs";
import * as jobActions from "../../../src/job/actions";

Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn() });
Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn() });
Object.defineProperty(zowe, "IssueCommand", { value: jest.fn() });
Object.defineProperty(zowe.IssueCommand, "issueSimple", { value: jest.fn() });

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
