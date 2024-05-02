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

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

import { FtpJesApi } from "../../../src/ZoweExplorerFtpJesApi";
import { DataSetUtils, JobUtils } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import { DownloadJobs } from "@zowe/cli";
import * as imperative from "@zowe/imperative";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
jest.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
jest.mock("../../../src/extension.ts");

const JesApi = new FtpJesApi();

describe("FtpJesApi", () => {
    beforeAll(() => {
        JesApi.checkedProfile = jest.fn().mockReturnValue({ message: "success", type: "zftp", failNotFound: false });
        JesApi.ftpClient = jest.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        JesApi.releaseConnection = jest.fn();
    });

    it("should list jobs by owner and prefix.", async () => {
        const response = [
            { jobid: "123", jobname: "JOB1" },
            { jobid: "234", jonname: "JOB2" },
        ];
        JobUtils.listJobs = jest.fn().mockReturnValue(response);
        const mockParams = {
            owner: "IBMUSER",
            prefix: "*",
        };
        const result = await JesApi.getJobsByOwnerAndPrefix(mockParams.owner, mockParams.prefix);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result[0].jobname).toContain("JOB1");
        expect(JobUtils.listJobs).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should get job by jobid.", async () => {
        const jobStatus = { jobid: "123", jobname: "JOB1" };
        JobUtils.findJobByID = jest.fn().mockReturnValue(jobStatus);
        const mockParams = {
            jobid: "123",
        };
        const result = await JesApi.getJob(mockParams.jobid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result.jobname).toContain("JOB1");
        expect(JobUtils.findJobByID).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should get spoolfiles.", async () => {
        const response = { jobid: "123", jobname: "JOB1", spoolFiles: [{ id: "1" }] };
        JobUtils.findJobByID = jest.fn().mockReturnValue(response);
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
        };
        const result = await JesApi.getSpoolFiles(mockParams.jobname, mockParams.jobid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(result[0].id).toContain("1");
        expect(JobUtils.findJobByID).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should download spool content.", async () => {
        const jobDetails = { jobid: "123", jobname: "JOB1", spoolFiles: [{ id: "1" }, { id: "2" }] };
        JobUtils.findJobByID = jest.fn().mockReturnValue(jobDetails);
        JobUtils.getSpoolFiles = jest.fn().mockReturnValue(jobDetails.spoolFiles);
        DownloadJobs.getSpoolDownloadFile = jest.fn().mockReturnValue("/tmp/file1");
        imperative.IO.writeFile = jest.fn();
        const mockParams = {
            parms: { jobname: "JOB1", jobid: "123", outDir: "/a/b/c" },
        };

        await JesApi.downloadSpoolContent(mockParams.parms);
        expect(JobUtils.findJobByID).toBeCalledTimes(1);
        expect(JobUtils.getSpoolFiles).toBeCalledTimes(1);
        expect(DownloadJobs.getSpoolDownloadFile).toBeCalledTimes(2);
        expect(imperative.IO.writeFile).toBeCalledTimes(2);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should get spool content by id.", async () => {
        const response = TestUtils.getSingleLineStream();
        JobUtils.getSpoolFileContent = jest.fn().mockReturnValue(response);
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
            spoolID: 1,
        };
        await JesApi.getSpoolContentById(mockParams.jobname, mockParams.jobid, mockParams.spoolID);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        expect((response._readableState.buffer.head?.data ?? response._readableState.buffer).toString()).toContain(
            "Hello world"
        );
        expect(JobUtils.getSpoolFileContent).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should submit job.", async () => {
        const response = { jobid: "123", jobname: "JOB1" };
        const content = TestUtils.getSingleLineStream();
        DataSetUtils.downloadDataSet = jest.fn().mockReturnValue(content);
        JobUtils.submitJob = jest.fn().mockReturnValue(response.jobid);
        const mockParams = {
            jobDataSet: "IBMUSER.DS2(M1)",
        };
        const result = await JesApi.submitJob(mockParams.jobDataSet);
        expect(result.jobid).toContain("123");
        expect(JobUtils.submitJob).toBeCalledTimes(1);
        expect(DataSetUtils.downloadDataSet).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });

    it("should delete job.", async () => {
        JobUtils.deleteJob = jest.fn();
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
        };
        await JesApi.deleteJob(mockParams.jobname, mockParams.jobid);
        expect(JobUtils.deleteJob).toBeCalledTimes(1);
        expect(JesApi.releaseConnection).toBeCalled();
    });
});
