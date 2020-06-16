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
                        checkCurrentProfile: jest.fn(),
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

        it("tests that the user is informed when a job is deleted", async () => {
            showInformationMessage.mockReset();
            const testJobsProvider = await createJobsTree(Logger.getAppLogger());
            await testJobsProvider.delete(jobNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toEqual(
                `Job ${jobNode.job.jobname}(${jobNode.job.jobid}) deleted`
            );
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
            expect(newjobNode.contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
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
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQY");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by a prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("MYHLQX");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by an owner and prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
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
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
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
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by a prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("STO*");
            // Assert choosing the new filter option followed by an owner and prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            qpItem = testJobsProvider.createId;
            showInputBox.mockReturnValueOnce("STO12345");
            // Assert choosing the new filter option followed by a Job id
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT);
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
    });
});

