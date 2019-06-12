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
import { ZosSpoolProvider } from "../src/zosspool"
import { Session } from "@brightside/imperative"
import { Job } from "../src/zosjobs";

describe("ZosSpoolProvider Unit Tets", () => {
    const GetJobs = jest.fn();
    const getSpoolFiles = jest.fn();

    Object.defineProperty(brightside, "GetJobs", {value: GetJobs});
    Object.defineProperty(GetJobs, "getSpoolFiles", {value: getSpoolFiles});

    const testSpoolProvider = new ZosSpoolProvider();

    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });

    const iJob: brightside.IJob = {
        jobid: "JOB1234",
        jobname: "TESTJOB",
        "files-url": "fake/files",
        "job-correlator": "correlator",
        "phase-name": "PHASE",
        "reason-not-running": "",
        "step-data": [{
            "proc-step-name": "",
            "program-name": "",
            "step-name": "",
            "step-number": 1,
            active: "",
            smfid: ""

        }],
        class: "A",
        owner: "USER",
        phase: 0,
        retcode: "",
        status: "ACTIVE",
        subsystem: "SYS",
        type: "JOB",
        url: "fake/url"
    }

    const iJobFile: brightside.IJobFile = {
        "byte-count": 128,
        "job-correlator": "",
        "record-count": 1,
        "records-url": "fake/records",
        class: "A",
        ddname: "STDOUT",
        id: 100,
        jobid: "100",
        jobname: "TESTJOB",
        lrecl: 80,
        procstep: "",
        recfm: "FB",
        stepname: "",
        subsystem: ""
    }

    const jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, session, iJob);

    it("Tests setting the job", async () => {
        testSpoolProvider.setJob(jobNode);
        expect(testSpoolProvider.mSessionNode).toBeDefined();
        expect(testSpoolProvider.mSessionNode.job).toEqual(jobNode);
    })

    it("Tests the children are the spool files", async () => {
        testSpoolProvider.setJob(jobNode);
        getSpoolFiles.mockReturnValue([iJobFile]);
        let spoolFiles = await testSpoolProvider.mSessionNode.getChildren()
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].mLabel).toEqual("STDOUT(100)");
    })
})