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

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

import { FtpJesApi } from "../../../src/ZoweExplorerFtpJesApi";
import { DataSetUtils, JobUtils } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import { imperative } from "@zowe/zowe-explorer-api";
import * as globals from "../../../src/globals";
import { ZoweFtpExtensionError } from "../../../src/ZoweFtpExtensionError";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
jest.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
jest.mock("../../../src/extension.ts");

const JesApi = new FtpJesApi();

describe("FtpJesApi", () => {
    beforeAll(() => {
        JesApi.checkedProfile = jest.fn().mockReturnValue({ message: "success", type: "zftp", failNotFound: false });
        JesApi.ftpClient = jest.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        JesApi.releaseConnection = jest.fn();
        globals.SESSION_MAP.get = jest.fn().mockReturnValue({ jesListConnection: { connected: true } });
        globals.LOGGER.getExtensionName = jest.fn().mockReturnValue("Zowe Explorer FTP Extension");
    });

    it("should list jobs by owner and prefix.", async () => {
        const response = [
            { jobId: "123", jobName: "JOB1" },
            { jobId: "234", jobName: "JOB2" },
        ];
        JobUtils.listJobs = jest.fn().mockReturnValue(response);
        const mockParams = {
            owner: "IBMUSER",
            prefix: "*",
        };
        const result = await JesApi.getJobsByParameters(mockParams);

        expect(result[0].jobname).toContain("JOB1");
        expect(JobUtils.listJobs).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalledTimes(0);
    });

    it("should get job by jobid.", async () => {
        const jobStatus = { jobId: "123", jobName: "JOB1" };
        JobUtils.findJobByID = jest.fn().mockReturnValue(jobStatus);
        const mockParams = {
            jobid: "123",
        };
        const result = await JesApi.getJob(mockParams.jobid);

        expect(result.jobname).toContain("JOB1");
        expect(JobUtils.findJobByID).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should get spoolfiles.", async () => {
        const response = { jobId: "123", jobName: "JOB1", spoolFiles: [{ id: 1 }] };
        JobUtils.findJobByID = jest.fn().mockReturnValue(response);
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
        };
        const result = await JesApi.getSpoolFiles(mockParams.jobname, mockParams.jobid);

        expect(result[0].id).toEqual(1);
        expect(JobUtils.findJobByID).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should download spool content.", async () => {
        const jobDetails = { jobId: "123", jobName: "JOB1", spoolFiles: [{ id: 1 }, { id: 2 }] };
        JobUtils.findJobByID = jest.fn().mockReturnValue(jobDetails);
        JobUtils.getSpoolFiles = jest.fn().mockReturnValue(jobDetails.spoolFiles);
        imperative.IO.writeFile = jest.fn();
        const mockParams = {
            parms: { jobname: "JOB1", jobid: "123", outDir: "/a/b/c" },
        };

        await JesApi.downloadSpoolContent(mockParams.parms);
        expect(JobUtils.findJobByID).toHaveBeenCalledTimes(1);
        expect(JobUtils.getSpoolFiles).toHaveBeenCalledTimes(1);
        expect(imperative.IO.writeFile).toHaveBeenCalledTimes(2);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should throw an error when downloading spool content if no spool files are available.", async () => {
        const jobDetails = { jobid: "123", jobname: "JOB1" };
        JobUtils.findJobByID = jest.fn().mockReturnValue(jobDetails);

        expect(JesApi.downloadSpoolContent).rejects.toThrow();
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

        expect((response._readableState.buffer.head?.data ?? response._readableState.buffer).toString()).toContain("Hello world");
        expect(JobUtils.getSpoolFileContent).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
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
        expect(JobUtils.submitJob).toHaveBeenCalledTimes(1);
        expect(DataSetUtils.downloadDataSet).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should delete job.", async () => {
        JobUtils.deleteJob = jest.fn();
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
        };
        await JesApi.deleteJob(mockParams.jobname, mockParams.jobid);
        expect(JobUtils.deleteJob).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should throw error when list jobs by owner and prefix failed.", async () => {
        jest.spyOn(JobUtils, "listJobs").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("List jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getJobsByParameters({});
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get job failed.", async () => {
        jest.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Get jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getJob("123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get spool files failed.", async () => {
        jest.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Get jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getSpoolFiles("JOB", "123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when download spool contents failed.", async () => {
        jest.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Get jobs failed.");
            })
        );
        const mockParams = {
            parms: { jobname: "JOB1", jobid: "123", outDir: "/a/b/c" },
        };
        await expect(async () => {
            await JesApi.downloadSpoolContent(mockParams.parms);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get spool contents by id failed.", async () => {
        jest.spyOn(JobUtils, "getSpoolFileContent").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Get spool file content failed.");
            })
        );
        await expect(async () => {
            await JesApi.getSpoolContentById("JOB", "123", 1);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when submit job failed", async () => {
        jest.spyOn(JobUtils, "submitJob").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Submit job failed.");
            })
        );
        await expect(async () => {
            await JesApi.submitJob("IBMUSER.DS");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when delete job failed", async () => {
        jest.spyOn(JobUtils, "deleteJob").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Delete job failed.");
            })
        );
        await expect(async () => {
            await JesApi.deleteJob("JOB", "123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });
});
