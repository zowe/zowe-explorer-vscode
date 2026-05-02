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
import { vi } from "vitest";

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

import { FtpJesApi } from "../../../src/ZoweExplorerFtpJesApi";
import { DataSetUtils, JobUtils } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import { imperative } from "@zowe/zowe-explorer-api";
import * as globals from "../../../src/globals";
import { ZoweFtpExtensionError } from "../../../src/ZoweFtpExtensionError";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
vi.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
vi.mock("../../../src/extension.ts");

describe("FtpJesApi", () => {
    let JesApi: FtpJesApi;
    beforeAll(() => {
        const profile: imperative.IProfileLoaded = { message: "", type: "zftp", failNotFound: false, profile: { host: "example.com", port: 22 } };
        JesApi = new FtpJesApi(profile);
        JesApi.checkedProfile = vi.fn().mockReturnValue({ message: "success", type: "zftp", failNotFound: false });
        JesApi.ftpClient = vi.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        JesApi.releaseConnection = vi.fn();
        globals.SESSION_MAP.get = vi.fn().mockReturnValue({ jesListConnection: { isConnected: () => true } });
        globals.LOGGER.getExtensionName = vi.fn().mockReturnValue("Zowe Explorer FTP Extension");
    });

    it("should list jobs by owner and prefix.", async () => {
        const response = [
            { jobId: "123", jobName: "JOB1" },
            { jobId: "234", jobName: "JOB2" },
        ];
        JobUtils.listJobs = vi.fn().mockReturnValue(response);
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
        JobUtils.findJobByID = vi.fn().mockReturnValue(jobStatus);
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
        JobUtils.findJobByID = vi.fn().mockReturnValue(response);
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
        JobUtils.findJobByID = vi.fn().mockReturnValue(jobDetails);
        JobUtils.getSpoolFiles = vi.fn().mockReturnValue(jobDetails.spoolFiles);
        imperative.IO.createDirsSyncFromFilePath = vi.fn();
        imperative.IO.writeFile = vi.fn();
        const mockParams = {
            parms: { jobname: "JOB1", jobid: "123", outDir: "/a/b/c" },
        };

        await JesApi.downloadSpoolContent(mockParams.parms);
        expect(JobUtils.findJobByID).toHaveBeenCalledTimes(1);
        expect(JobUtils.getSpoolFiles).toHaveBeenCalledTimes(1);
        expect(imperative.IO.createDirsSyncFromFilePath).toHaveBeenCalledTimes(2);
        expect(imperative.IO.writeFile).toHaveBeenCalledTimes(2);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should throw an error when downloading spool content if no spool files are available.", async () => {
        const jobDetails = { jobId: "123", jobName: "JOB1" };
        const mockParams = {
            parms: { jobname: "JOB1", jobid: "123", outDir: "/a/b/c" },
        };
        JobUtils.findJobByID = vi.fn().mockReturnValue(jobDetails);

        await expect(JesApi.downloadSpoolContent(mockParams.parms)).rejects.toThrow();
    });

    it("should get spool content by id.", async () => {
        const response = TestUtils.getSingleLineStream();
        JobUtils.getSpoolFileContent = vi.fn().mockReturnValue(response);
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
        DataSetUtils.downloadDataSet = vi.fn().mockReturnValue(content);
        JobUtils.submitJob = vi.fn().mockReturnValue(response.jobid);
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
        JobUtils.deleteJob = vi.fn();
        const mockParams = {
            jobname: "JOB1",
            jobid: "123",
        };
        await JesApi.deleteJob(mockParams.jobname, mockParams.jobid);
        expect(JobUtils.deleteJob).toHaveBeenCalledTimes(1);
        expect(JesApi.releaseConnection).toHaveBeenCalled();
    });

    it("should throw error when list jobs by owner and prefix failed.", async () => {
        vi.spyOn(JobUtils, "listJobs").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("List jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getJobsByParameters({});
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get job failed.", async () => {
        vi.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("Get jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getJob("123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get spool files failed.", async () => {
        vi.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("Get jobs failed.");
            })
        );
        await expect(async () => {
            await JesApi.getSpoolFiles("JOB", "123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when download spool contents failed.", async () => {
        vi.spyOn(JobUtils, "findJobByID").mockImplementationOnce(
            vi.fn((_val) => {
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
        vi.spyOn(JobUtils, "getSpoolFileContent").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("Get spool file content failed.");
            })
        );
        await expect(async () => {
            await JesApi.getSpoolContentById("JOB", "123", 1);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when submit job failed", async () => {
        vi.spyOn(JobUtils, "submitJob").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("Submit job failed.");
            })
        );
        await expect(async () => {
            await JesApi.submitJob("IBMUSER.DS");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when delete job failed", async () => {
        vi.spyOn(JobUtils, "deleteJob").mockImplementationOnce(
            vi.fn((_val) => {
                throw new Error("Delete job failed.");
            })
        );
        await expect(async () => {
            await JesApi.deleteJob("JOB", "123");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });
});
