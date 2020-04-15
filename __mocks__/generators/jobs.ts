import { Job } from "../../src/job/ZoweJobNode";
import * as vscode from "vscode";
import * as globals from "../../src/globals";
import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";

export function generateIJobObject(): zowe.IJob {
    return {
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
}

export function generateJobsTree(session: imperative.Session, iJob: zowe.IJob, profile: imperative.IProfileLoaded, treeView: any): any {
    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profile);
    jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;

    const testJobsTree = {
        mSessionNodes: [],
        getChildren: jest.fn(),
        addSession: jest.fn(),
        refresh: jest.fn(),
        getTreeView: jest.fn(),
        treeView,
        checkCurrentProfile: jest.fn(),
        refreshElement: jest.fn(),
        getProfiles: jest.fn(),
        getProfileName: jest.fn(),
        getSession: jest.fn()
    };
    testJobsTree.mSessionNodes = [];
    testJobsTree.mSessionNodes.push(jobNode);

    return testJobsTree;
}
