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

jest.mock("vscode");
jest.mock("Session");
jest.mock("@brightside/core");
jest.mock("@brightside/imperative");
import * as vscode from "vscode";
import * as brightside from "@brightside/core";
import { Session, Logger } from "@brightside/imperative";
import * as extension from "../../src/extension";
import * as profileLoader from "../../src/ProfileLoader";
import { Job } from "../../src/ZoweJobNode";
import { ZosJobsProvider, HistoryItem } from "../../src/ZosJobsProvider";

describe.only("Zos Jobs Unit Tests", () => {

    const GetJobs = jest.fn();
    const getConfiguration = jest.fn();
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    getConfiguration.mockReturnValue({
        persistence: true,
        get: (setting: string) => [
            "[test]: Owner:stonecc Prefix:*{server}",
            "[test]: USER1(JOB30148){job}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });

    beforeAll(() => {
        Object.defineProperty(brightside, "GetJobs", { value: GetJobs });
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe("ZosJobsProvider Unit Test", () => {
        const log = new Logger(undefined);
        const ZosmfSession = jest.fn();
        const createBasicZosmfSession = jest.fn();

        const getJobsByOwnerAndPrefix = jest.fn();
        const getJob = jest.fn();

        Object.defineProperty(brightside, "ZosmfSession", { value: ZosmfSession });
        Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession });
        Object.defineProperty(GetJobs, "getJobsByOwnerAndPrefix", { value: getJobsByOwnerAndPrefix });
        Object.defineProperty(GetJobs, "getJob", { value: getJob });

        const testJobsProvider = new ZosJobsProvider();

        const session = new Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });

        Object.defineProperty(profileLoader, "loadNamedProfile", {
            value: jest.fn((name: string) => {
                return { name };
            })
        });
        Object.defineProperty(profileLoader, "loadAllProfiles", {
            value: jest.fn(() => {
                return [{ name: "profile1" }, { name: "profile2" }];
            })
        });
        Object.defineProperty(profileLoader, "loadDefaultProfile", {
            value: jest.fn(() => {
                return { name: "defaultprofile" };
            })
        });

        const iJob: brightside.IJob = {
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

        const iJobComplete: brightside.IJob = {
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
        const filters = jest.fn();
        const getFilters = jest.fn();
        const DeleteJobs = jest.fn();
        const deleteJob = jest.fn();
        Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
        Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
        Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
        Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
        Object.defineProperty(filters, "getFilters", { value: getFilters });
        Object.defineProperty(brightside, "DeleteJobs", {value: DeleteJobs});
        Object.defineProperty(DeleteJobs, "deleteJob", {value: deleteJob});

        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob);

        it("should add the session to the tree", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            await testJobsProvider.addSession(log, "fake");
            expect(testJobsProvider.mSessionNodes[1]).toBeDefined();
            expect(testJobsProvider.mSessionNodes[1].label).toEqual("fake");
            expect(testJobsProvider.mSessionNodes[1].tooltip).toEqual("fake - owner: fake prefix: *");
        });

        it("tests that the user is informed when a job is deleted", async () => {
            showInformationMessage.mockReset();
            await testJobsProvider.deleteJob(jobNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toEqual(
                `Job ${jobNode.job.jobname}(${jobNode.job.jobid}) deleted`
            );
        });

        it("should delete the session", async () => {
            testJobsProvider.deleteSession(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes.length).toBe(1);
        });

        it("should get the jobs of the session", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            await testJobsProvider.addSession(log, "fake");
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
            await testJobsProvider.addSession(log, "fake");
            testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
            testJobsProvider.mSessionNodes[1].dirty = true;
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            expect(jobs.length).toBe(1);
            expect(jobs[0].job.jobid).toEqual(iJob.jobid);
            expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
        });

        it("should set the owner to the session userid", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.owner = "";
            expect(job.owner).toEqual("fake");
            job.owner = "new";
            expect(job.owner).toEqual("new");
        });

        it("should set the prefix to the default and specific value", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.prefix = "";
            expect(job.prefix).toEqual("*");
            job.prefix = "zowe*";
            expect(job.prefix).toEqual("zowe*");
            job.reset();
        });

        it("should set the search jobid to a specific value", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const jobs = await testJobsProvider.mSessionNodes[1].getChildren();
            const job = jobs[0];
            job.searchId = "JOB12345";
            expect(job.searchId).toEqual("JOB12345");
            job.reset();
        });

        it("Testing that expand tree is executed successfully", async () => {
            const refresh = jest.fn();
            Object.defineProperty(testJobsProvider, "refresh", {value: refresh});
            refresh.mockReset();
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], true);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], false);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-closed.svg");
            await testJobsProvider.flipState(testJobsProvider.mSessionNodes[1], true);
            expect(JSON.stringify(testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");

            const job = new Job("JOB1283", vscode.TreeItemCollapsibleState.Collapsed, testJobsProvider.mSessionNodes[0],
                testJobsProvider.mSessionNodes[1].session, iJob);
            job.contextValue = "job";
            await testJobsProvider.flipState(job, true);
            expect(JSON.stringify(job.iconPath)).toContain("folder-open.svg");
            await testJobsProvider.flipState(job, false);
            expect(JSON.stringify(job.iconPath)).toContain("folder-closed.svg");
            await testJobsProvider.flipState(job, true);
            expect(JSON.stringify(job.iconPath)).toContain("folder-open.svg");

            job.contextValue = "jobber";
            await testJobsProvider.flipState(job, true);
            expect(job.iconPath).not.toBeDefined();
        });

        /*************************************************************************************************************
         * Jobs Filter prompts
         *************************************************************************************************************/
        it("Testing that user filter prompts are executed successfully", async () => {
            const defaultDialogText: string = ZosJobsProvider.defaultDialogText;
            let qpItem: HistoryItem = new HistoryItem(defaultDialogText, "");
            testJobsProvider.initializeJobsTree(Logger.getAppLogger());
            showInformationMessage.mockReset();
            showQuickPick.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("");
            showInputBox.mockReturnValueOnce("");
            // Assert choosing the new filter specification followed by an owner
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(extension.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("*");
            showInputBox.mockReturnValueOnce("STO*");
            showInputBox.mockReturnValueOnce("");
            // Assert choosing the new filter specification followed by a prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(extension.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("STO*");
            showInputBox.mockReturnValueOnce("");
            // Assert choosing the new filter specification followed by an owner and prefix
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(extension.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("");

            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce("MYHLQ");
            showInputBox.mockReturnValueOnce("STO*");
            showInputBox.mockReturnValueOnce("STO12345");
            // Assert choosing the new filter specification followed by a Job id
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(testJobsProvider.mSessionNodes[1].contextValue).toEqual(extension.JOBS_SESSION_CONTEXT);
            expect(testJobsProvider.mSessionNodes[1].owner).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
            expect(testJobsProvider.mSessionNodes[1].searchId).toEqual("STO12345");

            // Assert edge condition user cancels the input path box
            showInformationMessage.mockReset();
            showQuickPick.mockReturnValueOnce(qpItem);
            showInputBox.mockReturnValueOnce(undefined);
            await testJobsProvider.searchPrompt(testJobsProvider.mSessionNodes[1]);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No valid value for owner or wild card *. Search Cancelled");

            showQuickPick.mockReset();
            qpItem = new HistoryItem("Owner:MEHLQ Prefix:*", "");
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

            // // Executing from favorites
            // const favoriteSearch = new Job("[aProfile]: HLQ.PROD1.STUFF",
            // vscode.TreeItemCollapsibleState.None, testJobsProvider.mFavoriteSession, null);
            // favoriteSearch.contextValue = extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX;
            // const checkSession = jest.spyOn(testJobsProvider, "addSession");
            // expect(checkSession).not.toHaveBeenCalled();
            // await testJobsProvider.searchPrompt(favoriteSearch);
            // expect(checkSession).toHaveBeenCalledTimes(1);
            // expect(checkSession).toHaveBeenLastCalledWith(Logger.getAppLogger(), "aProfile");
        });
    });


    describe("JobSpool Unit Test", () => {
        const getSpoolFiles = jest.fn();

        Object.defineProperty(brightside, "GetJobs", { value: GetJobs });
        Object.defineProperty(GetJobs, "getSpoolFiles", { value: getSpoolFiles });

        const session = new Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            protocol: "https",
            type: "basic",
        });

        const iJob: brightside.IJob = {
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

        const iJobFile: brightside.IJobFile = {
            "byte-count": 128,
            "job-correlator": "",
            "record-count": 1,
            "records-url": "fake/records",
            "class": "A",
            "ddname": "STDOUT",
            "id": 100,
            "jobid": "100",
            "jobname": "TESTJOB",
            "lrecl": 80,
            "procstep": "",
            "recfm": "FB",
            "stepname": "STEP",
            "subsystem": ""
        };

        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob);
        jobNode.contextValue = "job";

        it("Tests the children are the spool files", async () => {
            getSpoolFiles.mockReturnValue([iJobFile]);
            jobNode.dirty = true;
            const spoolFiles = await jobNode.getChildren();
            expect(spoolFiles.length).toBe(1);
            expect(spoolFiles[0].label).toEqual("STEP:STDOUT(100)");
            expect(spoolFiles[0].owner).toEqual("fake");
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

            const enums = jest.fn().mockImplementation(() => {
                return {
                    Global: 1,
                    Workspace: 2,
                    WorkspaceFolder: 3
                };
            });
            Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
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

