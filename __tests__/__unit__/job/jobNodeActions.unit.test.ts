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

jest.mock("@zowe/imperative");
jest.mock("@zowe/cli");
import * as vscode from "vscode";
import { Job } from "../../../src/ZoweJobNode";
import * as brtimperative from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import * as jobNodeActions from "../../../src/job/jobNodeActions";
import * as extension from "../../../src/extension";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils";

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

const showInputBox = jest.fn();
const showErrorMessage = jest.fn();
const showInformationMessage = jest.fn();
const showQuickPick = jest.fn();
const getConfiguration = jest.fn();
const existsSync = jest.fn();
const createBasicZosmfSession = jest.fn();
const refreshAllJobs = jest.fn();
const mockRefresh = jest.fn();
const mockRefreshElement  = jest.fn();
const mockGetChildren = jest.fn();
const mockGetProfileName = jest.fn();
const mockGetSession = jest.fn();
const mockGetProfiles = jest.fn();
const mockAddSession = jest.fn();

const profileOne: brtimperative.IProfileLoaded = {
    name: "profile1",
    profile: {},
    type: "zosmf",
    message: "",
    failNotFound: false
};

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

function getJobNode() {
    const mParent = new Job("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileOne);
    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, iJob, profileOne);
    jobNode.contextValue = extension.JOBS_SESSION_CONTEXT;
    return jobNode;
}

function getFavoriteJobNode() {
    const mParent = new Job("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileOne);
    const jobNodeF = new Job("[profile]:sesstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, iJob, profileOne);
    mParent.contextValue = extension.FAVORITE_CONTEXT;
    jobNodeF.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
    return jobNodeF;
}

function getJobTree() {
    const jobNode1 = getJobNode();
    const jobNodeFav = getFavoriteJobNode();
    const JobsTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            getChildren: mockGetChildren,
            addSession: mockAddSession,
            refresh: mockRefresh,
            refreshAllJobs: mockRefresh,
            refreshElement: mockRefreshElement,
            getProfiles: mockGetProfiles,
            getProfileName: mockGetProfileName,
            getSession: mockGetSession
        };
    });
    const testJobTree1 = JobsTree();
    testJobTree1.mSessionNodes = [];
    testJobTree1.mSessionNodes.push(jobNode1);
    return testJobTree1;
}

const session = new brtimperative.Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

describe("jobNodeActions", () => {

    const mockLoadNamedProfile = jest.fn();
    mockLoadNamedProfile.mockReturnValue(profileOne);
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                loadNamedProfile: mockLoadNamedProfile
            };
        })
    });
    const jobNode = getJobNode();
    const jobFavNode = getFavoriteJobNode();
    const testJobTree = getJobTree();

    Object.defineProperty(jobNodeActions, "RefreshAll", { value: refreshAllJobs });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession});

    beforeEach(() => {
        showErrorMessage.mockReset();
        testJobTree.refresh.mockReset();
        testJobTree.refreshAllJobs.mockReset();
        testJobTree.refreshElement.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        existsSync.mockReturnValue(true);
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe("refreshAll", () => {
        it("Testing that refreshAllJobs is executed successfully", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        getDefaultProfile: mockLoadNamedProfile,
                        loadNamedProfile: mockLoadNamedProfile,
                        usesSecurity: true,
                        getProfiles: jest.fn(() => {
                            return [{name: profileOne.name, profile: profileOne}, {name: profileOne.name, profile: profileOne}];
                        }),
                        refresh: jest.fn(),
                    };
                })
            });
            const spy = jest.spyOn(jobNodeActions, "refreshAllJobs");
            jobNodeActions.refreshAllJobs(testJobTree);
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
