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
import { Session } from "@brightside/imperative";

import * as profileLoader from "../src/ProfileLoader";
import { Job, ZosJobsProvider } from "../src/zosjobs";

describe("Zos Jobs Unit Tests", () => {

    const GetJobs = jest.fn();

    beforeAll(() => {
        Object.defineProperty(brightside, "GetJobs", { value: GetJobs });
    });

    describe("ZosJobsProvider Unit Test", () => {
        const ZosmfSession = jest.fn();
        const createBasicZosmfSession = jest.fn();

        const getJobsByOwnerAndPrefix = jest.fn();

        Object.defineProperty(brightside, "ZosmfSession", { value: ZosmfSession });
        Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession });
        Object.defineProperty(GetJobs, "getJobsByOwnerAndPrefix", { value: getJobsByOwnerAndPrefix });

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

        it("should add the session to the tree", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            await testJobsProvider.addSession("fake");
            expect(testJobsProvider.mSessionNodes[0]).toBeDefined();
            expect(testJobsProvider.mSessionNodes[0].mLabel).toEqual("fake");
            expect(testJobsProvider.mSessionNodes[0].tooltip).toEqual("fake - owner: fake prefix: *");
        });

        it("should delete the session", async () => {
            testJobsProvider.deleteSession(testJobsProvider.mSessionNodes[0]);
            expect(testJobsProvider.mSessionNodes.length).toBe(0);
        });

        it("should get the jobs of the session", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            getJobsByOwnerAndPrefix.mockReturnValue([iJob, iJobComplete]);
            await testJobsProvider.addSession("fake");
            const jobs = await testJobsProvider.mSessionNodes[0].getChildren();
            expect(jobs.length).toBe(2);
            expect(jobs[0].job.jobid).toEqual(iJob.jobid);
            expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
            expect(jobs[1].job.jobid).toEqual(iJobComplete.jobid);
            expect(jobs[1].tooltip).toEqual("TESTJOB(JOB1235) - 0");
        });

        it("should set the owner to the session userid", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const jobs = await testJobsProvider.mSessionNodes[0].getChildren();
            const job = jobs[0];
            job.owner = "";
            expect(job.owner).toEqual("fake");
            job.owner = "new";
            expect(job.owner).toEqual("new");
        });

        it("should set the prefix to the default", async () => {
            createBasicZosmfSession.mockReturnValue(session);
            const jobs = await testJobsProvider.mSessionNodes[0].getChildren();
            const job = jobs[0];
            job.prefix = "";
            expect(job.prefix).toEqual("*");
            job.prefix = "zowe*";
            expect(job.prefix).toEqual("zowe*");
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
            "stepname": "",
            "subsystem": ""
        };

        const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob);
        jobNode.contextValue = "job";

        it("Tests the children are the spool files", async () => {
            getSpoolFiles.mockReturnValue([iJobFile]);
            const spoolFiles = await jobNode.getChildren();
            expect(spoolFiles.length).toBe(1);
            expect(spoolFiles[0].mLabel).toEqual("STDOUT(100)");
            expect(spoolFiles[0].owner).toEqual("fake");
        });
    });

});

