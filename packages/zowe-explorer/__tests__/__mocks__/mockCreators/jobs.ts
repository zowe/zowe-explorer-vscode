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
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import { imperative, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweJobNode } from "../../../src/trees/job/ZoweJobNode";
import { Constants } from "../../../src/configuration/Constants";
import { removeNodeFromArray } from "./shared";
import { JobTree } from "../../../src/trees/job/JobTree";
import { ZowePersistentFilters } from "../../../src/tools/ZowePersistentFilters";

export function createIJobObject() {
    return {
        jobid: "JOB1234",
        jobname: "TESTJOB",
        "files-url": "fake/files",
        "job-correlator": "correlator",
        "phase-name": "PHASE",
        "reason-not-running": "",
        "step-data": [
            {
                "proc-step-name": "",
                "program-name": "",
                "step-name": "",
                "step-number": 1,
                active: "",
                smfid: "",
            },
        ],
        class: "A",
        owner: "USER",
        phase: 0,
        retcode: "",
        status: "ACTIVE",
        subsystem: "SYS",
        type: "JOB",
        url: "fake/url",
        "exec-member": "sampleMember",
        "exec-ended": "2024-03-07T00:04:27:980z",
        "exec-started": "2024-03-06T00:04:27:100z",
        "exec-submitted": "2024-03-07T00:04:07:000z",
    };
}

export function createIJobFile(): zosjobs.IJobFile {
    return {
        "byte-count": 128,
        "job-correlator": "correlator",
        "record-count": 1,
        "records-url": "fake/records",
        class: "A",
        ddname: "STDOUT",
        id: 101,
        jobid: "JOB1234",
        jobname: "TESTJOB",
        lrecl: 80,
        procstep: "",
        recfm: "FB",
        stepname: "STEP",
        subsystem: "SYS",
    };
}

export function createJobsTree(session: imperative.Session, iJob: zosjobs.IJob, profile: imperative.IProfileLoaded, treeView: any): any {
    const jobNode = new ZoweJobNode({
        label: "jobtest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session,
        profile,
        job: iJob,
    });
    jobNode.contextValue = Constants.JOBS_SESSION_CONTEXT;

    vi.spyOn(ZowePersistentFilters.prototype as any, "initialize").mockReturnValueOnce(undefined);
    const testJobsTree = new JobTree();
    Object.assign(testJobsTree, {
        mSessionNodes: [],
        mFavorites: [],
        getChildren: vi.fn(),
        addSession: vi.fn(),
        refresh: vi.fn(),
        getTreeView: vi.fn().mockImplementation(() => {
            return {
                reveal: vi.fn(),
                onDidExpandElement: vi.fn(),
                onDidCollapseElement: vi.fn(),
                selection: [],
                onDidChangeSelection: vi.fn(),
                visible: true,
                onDidChangeVisibility: vi.fn(),
                dispose: vi.fn(),
            };
        }),
        getSessions: vi.fn().mockReturnValue([]),
        getFavorites: vi.fn(),
        getSearchHistory: vi.fn(),
        removeSearchHistory: vi.fn(),
        resetSearchHistory: vi.fn(),
        resetFileHistory: vi.fn(),
        deleteSession: vi.fn().mockImplementation((badSession) => removeNodeFromArray(badSession, testJobsTree.mSessionNodes)),
        addFavorite: vi.fn().mockImplementation((newFavorite) => {
            testJobsTree.mFavorites.push(newFavorite);
        }),
        removeFavorite: vi.fn().mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testJobsTree.mFavorites)),
        removeFavProfile: vi.fn().mockImplementation((badFavProfileName) => {
            const badFavProfileNode = testJobsTree.mFavorites.find((treeNode) => treeNode.label === badFavProfileName);
            removeNodeFromArray(badFavProfileNode, testJobsTree.mFavorites);
        }),
        treeView,
        getTreeType: vi.fn().mockImplementation(() => PersistenceSchemaEnum.Job),
        checkCurrentProfile: vi.fn(),
        refreshElement: vi.fn(),
        getProfiles: vi.fn(),
        getProfileName: vi.fn(),
        getSession: vi.fn(),
        delete: vi.fn(),
        setItem: vi.fn(),
    });
    testJobsTree.mSessionNodes = [];
    testJobsTree.mSessionNodes.push(jobNode);

    return testJobsTree;
}

export function createJobSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const jobSessionNode = new ZoweJobNode({
        label: "sestest",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        session,
        profile,
    });
    jobSessionNode.contextValue = Constants.JOBS_SESSION_CONTEXT;

    return jobSessionNode;
}

export function createJobNode(session: any, profile: imperative.IProfileLoaded) {
    const jobNode = new ZoweJobNode({
        label: "sampleJob",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        parentNode: session.getSessionNode(),
        profile,
        job: createIJobObject(),
    });
    jobNode.contextValue = Constants.JOBS_JOB_CONTEXT;

    return jobNode;
}

export function createJobInfoNode(session: any, profile: imperative.IProfileLoaded) {
    const jobNode = new ZoweJobNode({
        label: "Generic node for displaying information",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        parentNode: session.getSessionNode(),
        profile,
        contextOverride: Constants.INFORMATION_CONTEXT,
    });
    return jobNode;
}

export function createJobFavoritesNode() {
    const jobFavoritesNode = new ZoweJobNode({
        label: "Favorites",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
    jobFavoritesNode.contextValue = Constants.FAVORITE_CONTEXT;

    return jobFavoritesNode;
}

// Because the JobDetail class in ZosJobsProvider.ts is not exported:
export class MockJobDetail implements zosjobs.IJob {
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
