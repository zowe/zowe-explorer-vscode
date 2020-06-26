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

jest.mock("Session");
jest.mock("@zowe/cli");
jest.mock("@zowe/imperative");
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Session, Logger, IProfileLoaded } from "@zowe/imperative";
import * as profileLoader from "../../src/Profiles";
import * as utils from "../../src/utils";
import { labelRefresh } from "../../src/shared/utils";
import * as globals from "../../src/globals";
import { Job } from "../../src/job/ZoweJobNode";
import { ZosJobsProvider, createJobsTree } from "../../src/job/ZosJobsProvider";

describe("Zos Jobs Unit Tests", () => {

    const GetJobs = jest.fn();
    const getConfiguration = jest.fn();
    const showErrorMessage = jest.fn();
    const createTreeView = jest.fn();
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: Owner:stonecc Prefix:*{server}",
            "[test]: USER1(JOB30148){job}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });
    createTreeView.mockReturnValue("testTreeView");

    const enums = jest.fn().mockImplementation(() => {
        return {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3
        };
    });

    const profilesForValidation = {status: "active", name: "fake"};

    beforeAll(() => {
        Object.defineProperty(zowe, "GetJobs", { value: GetJobs });
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe("ZosJobsProvider/ZoweJobNode Unit Test", () => {
        const log = new Logger(undefined);
        const ZosmfSession = jest.fn();
        const createBasicZosmfSession = jest.fn();

        const getJobsByOwnerAndPrefix = jest.fn();
        const getJob = jest.fn();

        const ProgressLocation = jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        });

        const withProgress = jest.fn().mockImplementation((progLocation, callback) => {
            return callback();
        });

        Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
        Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
        Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
        Object.defineProperty(zowe, "ZosmfSession", { value: ZosmfSession });
        Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession });
        Object.defineProperty(GetJobs, "getJobsByOwnerAndPrefix", { value: getJobsByOwnerAndPrefix });
        Object.defineProperty(GetJobs, "getJob", { value: getJob });

        const session = new Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });

        const sessionwocred = new Session({
            user: "",
            password: "",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });

        const profileLoad: IProfileLoaded = {
            name: "fake",
            profile: {
                host: "fake",
                port: 999,
                user: "fake",
                password: "fake",
                rejectUnauthorize: false
            },
            type: "zosmf",
            failNotFound: true,
            message: "fake"
        };

        const profileOne: IProfileLoaded = { name: "profile1", profile: {}, type: "zosmf", message: "", failNotFound: false };
        Object.defineProperty(profileLoader, "loadNamedProfile", {
            value: jest.fn((name: string) => {
                return profileOne;
            })
        });
        Object.defineProperty(profileLoader, "loadAllProfiles", {
            value: jest.fn(() => {
                return [profileOne, { name: "profile2" }];
            })
        });
        Object.defineProperty(profileLoader, "loadDefaultProfile", {
            value: jest.fn(() => {
                return profileOne;
            })
        });

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

        const iJobComplete: zowe.IJob = {
            "jobid": "JOB1235",
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
            "retcode": "0",
            "status": "ACTIVE",
            "subsystem": "SYS",
            "type": "JOB",
            "url": "fake/url"
        };

            // Filter prompt
        const showInformationMessage = jest.fn();
        const showInputBox = jest.fn();
        const showQuickPick = jest.fn();
        const createQuickPick = jest.fn();
        const filters = jest.fn();
        const getFilters = jest.fn();
        const DeleteJobs = jest.fn();
        const deleteJob = jest.fn();
        Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
        Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
        Object.defineProperty(vscode.window, "createQuickPick", {value: createQuickPick});
        Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
        Object.defineProperty(filters, "getFilters", { value: getFilters });
        Object.defineProperty(zowe, "DeleteJobs", {value: DeleteJobs});
        Object.defineProperty(DeleteJobs, "deleteJob", {value: deleteJob});

        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileOne);
        const mockLoadNamedProfile = jest.fn();
        const mockLoadDefaultProfile = jest.fn();

        beforeEach(() => {
            mockLoadNamedProfile.mockReturnValue(
                {name:"fake", type:"zosmf", profile: {name:"fake", type:"zosmf", profile:{name:"fake", type:"zosmf"}}});
            mockLoadDefaultProfile.mockReturnValue(
                {name:"firstProfileName", type:"zosmf", profile:
                    {name:"firstProfileName", type:"zosmf", profile:{name:"firstProfileName", type:"zosmf"}}});
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstProfileName", type:"zosmf"}, {name: "fake", type:"zosmf"}],
                        getDefaultProfile: mockLoadDefaultProfile,
                        loadNamedProfile: mockLoadNamedProfile,
                        validProfile: profileLoader.ValidProfileEnum.VALID,
                        checkCurrentProfile: jest.fn(() => {
                            return profilesForValidation;
                        }),
                        validateProfiles: jest.fn(),
                        promptCredentials: jest.fn(()=> {
                            return ["fakeUser","","fakeEncoding"];
                        }),
                    };
                })
            });
            withProgress.mockImplementation((progLocation, callback) => {
                return callback();
            });
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should add the session to the tree", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const sessions = testJobsProvider.mSessionNodes.length;
            await testJobsProvider.addSession("fake");
            expect(testJobsProvider.mSessionNodes[sessions]).toBeDefined();
            expect(testJobsProvider.mSessionNodes[sessions].label).toEqual("fake");
            expect(testJobsProvider.mSessionNodes[sessions].tooltip).toEqual("fake - owner: fake prefix: *");
        });

        it("should add another session to the tree", async () => {
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const sessions = testJobsProvider.mSessionNodes.length;
            await testJobsProvider.addSession("fake");
            expect(testJobsProvider.mSessionNodes[sessions]).toBeDefined();
            expect(testJobsProvider.mSessionNodes[sessions].label).toEqual("fake");
            expect(testJobsProvider.mSessionNodes[sessions].tooltip).toEqual("fake - owner:  prefix: *");
        });

        it("tests that the TreeView is created successfully", async () => {
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
        });

        it("tests that the user is informed when a job is deleted", async () => {
            showInformationMessage.mockReset();
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            await testJobsProvider.delete(jobNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toEqual(
                `Job ${jobNode.job.jobname}(${jobNode.job.jobid}) deleted`
            );
        });

        it("should delete the session", async () => {
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            testJobsProvider.deleteSession(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes.length).toBe(1);
        });

        it("should get the jobs of the session", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            await testJobsProvider.addSession("fake");
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            expect(jobs.length).toBe(2);
            expect(jobs[0].job.jobid).toEqual(iJob.jobid);
            expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
            expect(jobs[1].job.jobid).toEqual(iJobComplete.jobid);
            expect(jobs[1].tooltip).toEqual("TESTJOB(JOB1235) - 0");
        });

        it("should get the jobs of the session on id", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            getJob.mockReturnValue(iJob);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            await testJobsProvider.addSession("fake");
            testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
            testJobsProvider.mSessionNodes[1].dirty = true;
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            expect(jobs.length).toBe(1);
            expect(jobs[0].job.jobid).toEqual(iJob.jobid);
            expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
        });

        it("should set the owner to the session userid", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.owner = "";
            expect(job.owner).toEqual("fake");
            job.owner = "new";
            expect(job.owner).toEqual("new");
        });

        it("should set the prefix to the default and specific value", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.prefix = "";
            expect(job.prefix).toEqual("*");
            job.prefix = "zowe*";
            expect(job.prefix).toEqual("zowe*");
            // reset
            labelRefresh(job);
            job.children = [];
            job.dirty = true;
        });

        it("should set the search jobid to a specific value", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.searchId = "JOB12345";
            expect(job.searchId).toEqual("JOB12345");
            // reset
            labelRefresh(job);
            job.children = [];
            job.dirty = true;
        });

        it("Testing that expand tree is executed successfully", async () => {
            const refresh = jest.fn();
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            Object.defineProperty(testJobsProvider, "refresh", {value: refresh});
            refresh.mockReset();
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], true);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], false);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], true);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");

            const job = new Job("JOB1283", vscode.TreeItemCollapsibleState.Collapsed, testJobsProvider.mSessionNodes[0],
                testJobsProvider.mSessionNodes[1].getSession(), iJob, profileOne);
            job.contextValue = "job";
            await testJobsProvider.flipState(job, true);
            expect(JSON.stringify(job.iconPath)).toContain("folder-open.svg");
            await testJobsProvider.flipState(job, false);
            expect(JSON.stringify(job.iconPath)).toContain("folder-closed.svg");
            await testJobsProvider.flipState(job, true);
            expect(JSON.stringify(job.iconPath)).toContain("folder-open.svg");
        });

        it("Testing that prompt credentials work", async () => {
            const refresh = jest.fn();
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("[fake]: Owner:fakeUser Prefix:*", vscode.TreeItemCollapsibleState.Expanded,
                jobNode, sessionwocred, iJob, jobNode.getProfile());
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            Object.defineProperty(testJobsProvider, "refresh", {value: refresh});
            refresh.mockReset();
            jest.spyOn(testJobsProvider, "flipState");
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            await testJobsProvider.flipState(newjobNode, true);
            expect(testJobsProvider.flipState).toHaveBeenCalled();

            const job = new Job("JOB1283", vscode.TreeItemCollapsibleState.Collapsed, testJobsProvider.mSessionNodes[0],
                sessionwocred, iJob, profileOne);
            job.contextValue = "job";
            await testJobsProvider.flipState(job, true);
            expect(JSON.stringify(job.iconPath)).toContain("folder-open.svg");
        });

        it("Testing that prompt credentials will have an error", async () => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        getDefaultProfile: () => ({name: "firstName"}),
                        promptCredentials: undefined,
                        checkCurrentProfile: jest.fn(() => {
                            return profilesForValidation;
                        }),
                        validateProfiles: jest.fn(),
                    };
                })
            });
            const refresh = jest.fn();
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("[fake]: Owner:fakeUser Prefix:*", vscode.TreeItemCollapsibleState.Expanded,
                jobNode, sessionwocred, iJob, jobNode.getProfile());
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            Object.defineProperty(testJobsProvider, "refresh", {value: refresh});
            refresh.mockReset();
            jest.spyOn(testJobsProvider, "flipState");
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            await testJobsProvider.flipState(newjobNode, true);
            expect(testJobsProvider.flipState).toHaveBeenCalled();

            newjobNode.label = "Favorites";
            await testJobsProvider.flipState(newjobNode, true);
            expect(testJobsProvider.flipState).toHaveBeenCalled();
        });

        /*************************************************************************************************************
         * Jobs Filter prompts
         *************************************************************************************************************/
        it("Testing that prompt credentials is called when searchPrompt is triggered", async () => {
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const qpItem: vscode.QuickPickItem = testJobsProvider.createOwner;
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            createQuickPick.mockReturnValue({
                placeholder: "Select a filter",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [testJobsProvider.createOwner, testJobsProvider.createId],
                value: "",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });
            showInformationMessage.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("");
            await testJobsProvider.searchPrompt(newjobNode);
            expect(newjobNode.contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(newjobNode.owner).toEqual("MYHLQ");
            expect(newjobNode.prefix).toEqual("*");
            expect(newjobNode.searchId).toEqual("");
        });

        /*************************************************************************************************************
         * Jobs Filter prompts
         *************************************************************************************************************/
        it("Testing that prompt credentials is called when searchPrompt is triggered but undefined returned", async () => {
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const qpItem: vscode.QuickPickItem = testJobsProvider.createOwner;
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            createQuickPick.mockReturnValue({
                placeholder: "Select a filter",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [testJobsProvider.createOwner, testJobsProvider.createId],
                value: "",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });
            showInformationMessage.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce(undefined);
            await testJobsProvider.searchPrompt(newjobNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");
        });

        it("Testing that prompt credentials is called when searchPrompt is triggered for fav", async () => {
            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("[fake]: Owner:fakeUser Prefix:*", vscode.TreeItemCollapsibleState.Expanded,
                jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            newjobNode.getSession().ISession.user = "";
            newjobNode.getSession().ISession.password = "";
            newjobNode.getSession().ISession.base64EncodedAuth = "fakeEncoding";
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const qpItem: vscode.QuickPickItem = testJobsProvider.createOwner;
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
            const spyMe = new ZosJobsProvider();
            Object.defineProperty(spyMe, "searchPrompt", {
                value: jest.fn(() => {
                    return {
                        tempNode: newjobNode,
                        mSessionNodes: {Session: {user: "", password: "", base64EncodedAuth: ""}}
                    };
                })
            });
            createQuickPick.mockReturnValue({
                placeholder: "Select a filter",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [testJobsProvider.createOwner, testJobsProvider.createId],
                value: "",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });
            showInformationMessage.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("");
            await testJobsProvider.searchPrompt(newjobNode);
            expect(profileLoader.Profiles.getInstance().validProfile).toBe(profileLoader.ValidProfileEnum.VALID);
        });

        it("Testing the jobs prompt credentials error", async () => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        getDefaultProfile: () => ({name: "firstName"}),
                        validProfile: profileLoader.ValidProfileEnum.INVALID,
                        checkCurrentProfile: jest.fn(() => {
                            return profilesForValidation;
                        }),
                        validateProfiles: jest.fn(),
                    };
                })
            });

            createBasicZosmfSession.mockReturnValue(sessionwocred);
            const newjobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded,
                jobNode, sessionwocred, iJob, jobNode.getProfile());
            newjobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            await testJobsProvider.searchPrompt(newjobNode);
            expect(profileLoader.Profiles.getInstance().validProfile).toBe(profileLoader.ValidProfileEnum.INVALID);
        });

        it("Testing that user filter prompts are executed successfully theia specific route", async () => {
            let theia = true;
            Object.defineProperty(globals, "ISTHEIA", { get: () => theia });

            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            let qpItem: vscode.QuickPickItem = testJobsProvider.createOwner;
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            showInformationMessage.mockReset();
            showQuickPick.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQY");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce(""); // need the jobId in this case
            // Assert choosing the new filter option followed by an owner
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQY");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by a prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("MYHLQX");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by an owner and prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQX");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            qpItem = testJobsProvider.createId;
            showInputBox.mockReset();
            showQuickPick.mockReset();
            // showInputBox.mockReturnValueOnce("");
            // showInputBox.mockReturnValueOnce("");
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("STO12345");
            // Assert choosing the new filter option followed by a Job id
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("STO12345");

            // Assert edge condition user cancels the input path box
            showInformationMessage.mockReset();
            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce(undefined);
            showQuickPick.mockReturnValueOnce(qpItem);
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");

            showQuickPick.mockReset();
            qpItem = new utils.FilterItem("Owner:MEHLQ Prefix:*");
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("MEHLQ");
            showInputBox.mockReturnValueOnce("*");
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MEHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");

            // Assert edge condition user cancels the quick pick
            showInformationMessage.mockReset();
            showQuickPick.mockReset();
            showQuickPick.mockReturnValueOnce(undefined);
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No selection made.");

            theia = false;

            // Executing from favorites
            const favoriteSearch = new Job("[fake]: Owner:stonecc Prefix:*",
            vscode.TreeItemCollapsibleState.None, testJobsProvider.mFavoriteSession, session,
                null, profileOne);
            favoriteSearch.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const checkSession = jest.spyOn(testJobsProvider, "addSession");
            expect(checkSession).not.toHaveBeenCalled();
            await testJobsProvider.searchPrompt(favoriteSearch);
            expect(checkSession).toHaveBeenCalledTimes(1);
            expect(checkSession).toHaveBeenLastCalledWith("fake");
        });

        it("Testing that user filter prompts are executed successfully VSCode specific route", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            let qpItem: vscode.QuickPickItem = testJobsProvider.createOwner;
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            createQuickPick.mockReturnValue({
                placeholder: "Select a filter",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [testJobsProvider.createOwner, testJobsProvider.createId],
                value: "",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });
            showInformationMessage.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce(""); // need the jobId in this case
            // Assert choosing the new filter option followed by an owner
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by a prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by an owner and prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            qpItem = testJobsProvider.createId;
            showInputBox.mockReturnValueOnce("STO12345");
            // Assert choosing the new filter option followed by a Job id
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("STO12345");

            // Assert edge condition user cancels the input path box
            showInformationMessage.mockReset();
            showInputBox.mockReturnValueOnce(undefined);
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");

            qpItem = new utils.FilterItem("Owner:MEHLQ2 Prefix:*");
            showInputBox.mockReturnValueOnce("MEHLQ2");
            showInputBox.mockReturnValueOnce("*");
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MEHLQ2");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");

            // Assert edge condition user cancels the quick pick
            showInformationMessage.mockReset();
            qpItem = undefined;
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
        });

        /*************************************************************************************************************
         * Specific interpret tests
         *************************************************************************************************************/
        it("Testing the interpret routine", async () => {
            const testJobsProvider = new ZosJobsProvider();
            expect(testJobsProvider.interpretFreeform("STC01234")).toEqual("JobId:STC01234");
            expect(testJobsProvider.interpretFreeform("job STC01234")).toEqual("JobId:STC01234");
            expect(testJobsProvider.interpretFreeform("STC01234 JOB")).toEqual("JobId:STC01234");
            expect(testJobsProvider.interpretFreeform("JOB12345")).toEqual("JobId:JOB12345");
            expect(testJobsProvider.interpretFreeform("JOB0123456")).toEqual("JobId:JOB01234");
            expect(testJobsProvider.interpretFreeform("JOB012345N")).toEqual("JobId:JOB01234");
            // We interpret this as an owner prefix as the value is invalid as a job
            expect(testJobsProvider.interpretFreeform("JOB0X25N")).toEqual("Owner:JOB0X25N");

            expect(testJobsProvider.interpretFreeform("MYHLQ*")).toEqual("Owner:MYHLQ*");

            expect(testJobsProvider.interpretFreeform("Owner: MYHLQ pRefix: STYYY*")).toEqual("Owner:MYHLQ Prefix:STYYY*");
            expect(testJobsProvider.interpretFreeform("jobid: JOB0X25N")).toEqual("JobId:JOB0X25N"); // Although invalid Job ID the user is explicit
            expect(testJobsProvider.interpretFreeform("MYHLQ")).toEqual("Owner:MYHLQ");
            // Although invalid Job ID the user is explicit
            expect(testJobsProvider.interpretFreeform("MYHLQ* myJobname")).toEqual("Owner:MYHLQ* Prefix:myJobname");
            expect(testJobsProvider.interpretFreeform("MYHLQ* myJob")).toEqual("Owner:MYHLQ* Prefix:myJob");
            expect(testJobsProvider.interpretFreeform("MYHLQ* myJob*")).toEqual("Owner:MYHLQ* Prefix:myJob*");
            expect(testJobsProvider.interpretFreeform("* * STC01234")).toEqual("JobId:STC01234");
        });

        /*************************************************************************************************************
         * Testing that add search and Favorite sorting works
         *************************************************************************************************************/
        it("Testing that add Search Favorite works properly", async () => {
            getConfiguration.mockReset();
            getConfiguration.mockReturnValue({
                get: (setting: string) => [
                    "[test]: Owner:stonecc Prefix:*{server}",
                    "[test]: USER1(JOB30148){job}",
                ],
                update: jest.fn(()=>{
                    return {};
                })
            });
            const testTree = await createJobsTree(Logger.getAppLogger());
            testTree.mFavorites = [];
            const job = new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1],
                testTree.mSessionNodes[1].getSession(), iJob, profileOne);

            // Check adding job
            await testTree.addFavorite(job);
            expect(testTree.mFavorites.length).toEqual(1);

            testTree.mSessionNodes[1].owner = "myHLQ";
            testTree.mSessionNodes[1].prefix = "*";
            await testTree.saveSearch(testTree.mSessionNodes[1]);
            // tslint:disable-next-line: no-magic-numbers
            expect(testTree.mFavorites.length).toEqual(2);

            testTree.mSessionNodes[1].owner = "*";
            testTree.mSessionNodes[1].prefix = "aH*";
            await testTree.saveSearch(testTree.mSessionNodes[1]);
            // tslint:disable-next-line: no-magic-numbers
            expect(testTree.mFavorites.length).toEqual(3);

            testTree.mSessionNodes[1].owner = "*";
            testTree.mSessionNodes[1].prefix = "*";
            testTree.mSessionNodes[1].searchId = "JOB1234";
            await testTree.saveSearch(testTree.mSessionNodes[1]);
            // tslint:disable-next-line: no-magic-numbers
            expect(testTree.mFavorites.length).toEqual(4);
            expect(testTree.mFavorites[0].label).toEqual("[firstProfileName]: JobId:JOB1234");
            expect(testTree.mFavorites[1].label).toEqual("[firstProfileName]: Owner:* Prefix:aH*");
            expect(testTree.mFavorites[2].label).toEqual("[firstProfileName]: Owner:myHLQ Prefix:*");
            // tslint:disable-next-line: no-magic-numbers
            expect(testTree.mFavorites[3].label).toEqual("[firstProfileName]: MYHLQ(JOB1283)");

            testTree.removeFavorite(testTree.mFavorites[0]);
            testTree.removeFavorite(testTree.mFavorites[0]);
            testTree.removeFavorite(testTree.mFavorites[0]);
            testTree.removeFavorite(testTree.mFavorites[0]);
            expect(testTree.mFavorites).toEqual([]);
        });

        it("Tests the children are the spool files", async () => {
            const iJobFile: zowe.IJobFile = {
                "byte-count": 128,
                "job-correlator": "",
                "record-count": 1,
                "records-url": "fake/records",
                "class": "A",
                "ddname": "STDOUT",
                "id": 101,
                "jobid": "101",
                "jobname": "TESTJOB",
                "lrecl": 80,
                "procstep": "",
                "recfm": "FB",
                "stepname": "STEP",
                "subsystem": ""
            };
            const jobNodeSpool = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileOne);
            jobNodeSpool.contextValue = "job";
            const getSpoolFiles = jest.fn();
            Object.defineProperty(zowe, "GetJobs", { value: GetJobs });
            Object.defineProperty(GetJobs, "getSpoolFiles", { value: getSpoolFiles });
            getSpoolFiles.mockReturnValue([iJobFile]);
            jobNodeSpool.dirty = true;
            const spoolFiles = await jobNodeSpool.getChildren();
            expect(spoolFiles.length).toBe(1);
            expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
            expect(spoolFiles[0].owner).toEqual("fake");
        });

        /*************************************************************************************************************
         * Test the editSession command
         *************************************************************************************************************/
        it("Test the editSession command ", async () => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        loadNamedProfile: mockLoadNamedProfile,
                        getDefaultProfile: jest.fn(),
                        editSession: jest.fn(() => {
                            return profileLoad;
                        }),
                        checkCurrentProfile: jest.fn(() => {
                            return profilesForValidation;
                        }),
                        validateProfiles: jest.fn(),
                    };
                })
            });
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const checkSession = jest.spyOn(testJobsProvider, "editSession");
            jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            testJobsProvider.editSession(jobNode);
            expect(checkSession).toHaveBeenCalled();
        });

        it("Test the editSession command with inactive profile ", async () => {
            Object.defineProperty(profileLoader.Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        loadNamedProfile: mockLoadNamedProfile,
                        getDefaultProfile: jest.fn(),
                        editSession: jest.fn(() => {
                            return profileLoad;
                        }),
                        checkCurrentProfile: jest.fn(() => {
                            return {status: "inactive", name: profileOne.name};
                        }),
                        profilesForValidation: [{status: "inactive", name:profileOne.name}],
                        validateProfiles: jest.fn(),
                    };
                })
            });
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            const checkSession = jest.spyOn(testJobsProvider, "editSession");
            jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            testJobsProvider.editSession(jobNode);
            expect(checkSession).toHaveBeenCalled();
        });
    });

    describe("ZosJobsProvider onDidConfiguration", () => {
        /*************************************************************************************************************
         * Testing the onDidConfiguration
         *************************************************************************************************************/
        const testJobsProvider = new ZosJobsProvider();

        it("Testing the onDidConfiguration", async () => {
            const mockAffects = jest.fn();
            const Event = jest.fn().mockImplementation(() => {
                return {
                    affectsConfiguration: mockAffects
                };
            });
            const e = new Event();
            mockAffects.mockReturnValue(true);
            getConfiguration.mockReset();
            getConfiguration.mockReturnValue({
                get: (setting: string) => [
                    "[test]: /u/aDir{directory}",
                    "[test]: /u/myFile.txt{textFile}",
                ],
                update: jest.fn(()=>{
                    return {};
                })
            });
            await testJobsProvider.onDidChangeConfiguration(e);
            expect(getConfiguration).toHaveBeenCalled();
            expect(getConfiguration).toHaveBeenCalledTimes(2);
        });
    });
});

