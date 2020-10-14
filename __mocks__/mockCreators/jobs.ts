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

import { Job } from "../../src/job/ZoweJobNode";
import * as vscode from "vscode";
import * as globals from "../../src/globals";
import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";
import { removeNodeFromArray } from "./shared";

export function createIJobObject(): zowe.IJob {
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

export function createIJobFile(): zowe.IJobFile {
    return {
        "byte-count": 128,
        "job-correlator": "correlator",
        "record-count": 1,
        "records-url": "fake/records",
        "class": "A",
        "ddname": "STDOUT",
        "id": 101,
        "jobid": "JOB1234",
        "jobname": "TESTJOB",
        "lrecl": 80,
        "procstep": "",
        "recfm": "FB",
        "stepname": "STEP",
        "subsystem": "SYS"
    };
}

export function createJobsTree(session: imperative.Session, iJob: zowe.IJob, profile: imperative.IProfileLoaded, treeView: any): any {
    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profile);
    jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;

    const testJobsTree = {
        mSessionNodes: [],
        mFavorites: [],
        getChildren: jest.fn(),
        addSession: jest.fn(),
        refresh: jest.fn(),
        getTreeView: jest.fn(),
        deleteSession: jest.fn(),
        addFavorite: jest.fn(),
        removeFavorite: jest.fn(),
        treeView,
        getTreeType: jest.fn().mockImplementation(() => globals.PersistenceSchemaEnum.Job),
        checkCurrentProfile: jest.fn(),
        refreshElement: jest.fn(),
        getProfiles: jest.fn(),
        getProfileName: jest.fn(),
        getSession: jest.fn()
    };
    testJobsTree.mSessionNodes = [];
    testJobsTree.mSessionNodes.push(jobNode);
    testJobsTree.addFavorite.mockImplementation((newFavorite) => {
        testJobsTree.mFavorites.push(newFavorite);
    });
    testJobsTree.deleteSession.mockImplementation((badSession) => removeNodeFromArray(badSession, testJobsTree.mSessionNodes));
    testJobsTree.removeFavorite.mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testJobsTree.mFavorites));

    return testJobsTree;
}

export function createJobSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const jobSessionNode = new Job("sestest", vscode.TreeItemCollapsibleState.Collapsed,
    null, session, null, profile);
    jobSessionNode.contextValue = globals.JOBS_SESSION_CONTEXT;

    return jobSessionNode;
}

export function createJobFavoritesNode() {
    const jobFavoritesNode = new Job("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, null);
    jobFavoritesNode.contextValue = globals.FAVORITE_CONTEXT;

    return jobFavoritesNode;
}

// Because the JobDetail class in ZosJobsProvider.ts is not exported:
export class MockJobDetail implements zowe.IJob {
    public jobid: string;
    public jobname: string;
    public subsystem: string;
    public owner: string;
    public status: string;
    public type: string;
    public class: string;
    public retcode: string;
    public url: string;
    public "files-url": string;
    public "job-correlator": string;
    public phase: number;
    public "phase-name": string;
    public "reason-not-running"?: string;

    constructor(combined: string) {
        this.jobname = combined.substring(0, combined.indexOf("("));
        this.jobid = combined.substring(combined.indexOf("(") + 1, combined.indexOf(")"));
    }
}
