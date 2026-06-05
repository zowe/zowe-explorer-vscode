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

import { describe, afterEach, expect, it, vi } from "vitest";
import { SshJesApi } from "../../src/api/SshJesApi";
import { IGetJobsParms } from "@zowe/zos-jobs-for-zowe-sdk";
import { B64String } from "@zowe/zowex-for-zowe-sdk";

describe("SshJesApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getJobsByParameters", () => {
        it("should list jobs", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const listJobsSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { listJobs: listJobsSpy } });
            listJobsSpy.mockResolvedValue({
                items: [
                    {
                        id: "fj1",
                        name: "fakejob1",
                        status: "INPUT",
                        retcode: "------",
                    },
                    {
                        id: "fj2",
                        name: "fakejob2",
                        status: "OUTPUT",
                        retcode: "0",
                    },
                ],
            });

            const jobParams: IGetJobsParms = { owner: "fakeowner", prefix: "fakepref" };
            const response = await jesApi.getJobsByParameters(jobParams);

            expect(listJobsSpy).toHaveBeenCalledTimes(1);
            expect(listJobsSpy).toHaveBeenCalledWith({ owner: "FAKEOWNER", prefix: "fakepref" });
            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(response).toEqual([
                {
                    jobid: "fj1",
                    jobname: "fakejob1",
                    status: "INPUT",
                    retcode: "INPUT",
                },
                {
                    jobid: "fj2",
                    jobname: "fakejob2",
                    status: "OUTPUT",
                    retcode: "0",
                },
            ]);
        });
    });

    describe("getJob", () => {
        it("should get a job 1", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const getStatusSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { getStatus: getStatusSpy } });
            getStatusSpy.mockResolvedValue({
                id: "fj1",
                name: "fakejob1",
                status: "INPUT",
                retcode: "------",
            });

            const response = await jesApi.getJob("fakejob1");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(getStatusSpy).toHaveBeenCalledTimes(1);
            expect(getStatusSpy).toHaveBeenCalledWith({ jobId: "FAKEJOB1" });
            expect(response).toEqual({
                jobid: "fj1",
                jobname: "fakejob1",
                status: "INPUT",
                retcode: "INPUT",
            });
        });

        it("should get a job 2", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const getStatusSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { getStatus: getStatusSpy } });
            getStatusSpy.mockResolvedValue({
                id: "fj1",
                name: "fakejob1",
                status: "OUTPUT",
                retcode: "0",
            });

            const response = await jesApi.getJob("fakejob1");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(getStatusSpy).toHaveBeenCalledTimes(1);
            expect(getStatusSpy).toHaveBeenCalledWith({ jobId: "FAKEJOB1" });
            expect(response).toEqual({
                jobid: "fj1",
                jobname: "fakejob1",
                status: "OUTPUT",
                retcode: "0",
            });
        });
    });

    describe("getSpoolFiles", () => {
        it("should get the spool files", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const listSpoolsSpy = vi.fn();
            const mockSpoolFile = { jobid: "fakeid", jobname: "fakejob", recfm: "FB" };

            clientSpy.mockResolvedValue({ jobs: { listSpools: listSpoolsSpy } });
            listSpoolsSpy.mockResolvedValue({ items: [mockSpoolFile] });

            const response = await jesApi.getSpoolFiles("fakejob", "fakeid");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(listSpoolsSpy).toHaveBeenCalledTimes(1);
            expect(listSpoolsSpy).toHaveBeenCalledWith({ jobId: "FAKEID" });
            expect(response).toEqual([mockSpoolFile]);
        });
    });

    describe("downloadSpoolContent", () => {
        it("should throw a not yet implemented error", () => {
            const jesApi = new SshJesApi();
            let error: Error;
            try {
                jesApi.downloadSpoolContent({});
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.message).toEqual("Not yet implemented");
        });
    });

    describe("getSpoolContentById", () => {
        it("should get spool content by id 1", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const readSpoolSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { readSpool: readSpoolSpy } });
            readSpoolSpy.mockResolvedValue({ data: B64String.encode("fakedata") });

            const response = await jesApi.getSpoolContentById("fakejob", "fakeid", 1);

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(readSpoolSpy).toHaveBeenCalledTimes(1);
            expect(readSpoolSpy).toHaveBeenCalledWith({ spoolId: 1, jobId: "FAKEID", encoding: undefined });
            expect(response).toEqual("fakedata");
        });

        it("should get spool content by id 2", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const readSpoolSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { readSpool: readSpoolSpy } });
            readSpoolSpy.mockResolvedValue({ data: B64String.encode("fakedata") });

            const response = await jesApi.getSpoolContentById("fakejob", "fakeid", 1, "1047");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(readSpoolSpy).toHaveBeenCalledTimes(1);
            expect(readSpoolSpy).toHaveBeenCalledWith({ spoolId: 1, jobId: "FAKEID", encoding: "1047" });
            expect(response).toEqual("fakedata");
        });
    });

    describe("getJclForJob", () => {
        it("should get the job JCL", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const getJclSpy = vi.fn();
            const jobData = { jobid: "fakejob" };

            clientSpy.mockResolvedValue({ jobs: { getJcl: getJclSpy } });
            getJclSpy.mockResolvedValue({ data: "fakedata" });

            const response = await jesApi.getJclForJob(jobData);

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(getJclSpy).toHaveBeenCalledTimes(1);
            expect(getJclSpy).toHaveBeenCalledWith({ jobId: "FAKEJOB" });
            expect(response).toEqual("fakedata");
        });
    });

    describe("cancelJob", () => {
        it("should cancel the job", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const cancelJobSpy = vi.fn();
            const jobData = { jobid: "fakejob" };

            clientSpy.mockResolvedValue({ jobs: { cancelJob: cancelJobSpy } });
            cancelJobSpy.mockResolvedValue({ success: true });

            const response = await jesApi.cancelJob(jobData);

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(cancelJobSpy).toHaveBeenCalledTimes(1);
            expect(cancelJobSpy).toHaveBeenCalledWith({ jobId: "FAKEJOB" });
            expect(response).toEqual(true);
        });
    });

    describe("submitJcl", () => {
        it("should submit the JCL", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const submitJclSpy = vi.fn();
            const jobData = { jobId: "fakeid", jobName: "fakejob" };
            const jcl = "fakeJcl";

            clientSpy.mockResolvedValue({ jobs: { submitJcl: submitJclSpy } });
            submitJclSpy.mockResolvedValue(jobData);

            const response = await jesApi.submitJcl(jcl);

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(submitJclSpy).toHaveBeenCalledTimes(1);
            expect(submitJclSpy).toHaveBeenCalledWith({ jcl: B64String.encode("fakeJcl") });
            expect(response).toEqual({ jobid: "fakeid", jobname: "fakejob" });
        });
    });

    describe("submitJob", () => {
        it("should submit a job", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const submitJobSpy = vi.fn();
            const jobData = { jobId: "fakeid", jobName: "fakejob" };

            clientSpy.mockResolvedValue({ jobs: { submitJob: submitJobSpy } });
            submitJobSpy.mockResolvedValue(jobData);

            const response = await jesApi.submitJob("FAKE.DATA.SET");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(submitJobSpy).toHaveBeenCalledTimes(1);
            expect(submitJobSpy).toHaveBeenCalledWith({ dsname: "FAKE.DATA.SET" });
            expect(response).toEqual({ jobid: "fakeid", jobname: "fakejob" });
        });
    });

    describe("deleteJob", () => {
        it("should delete the job", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const deleteJobSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { deleteJob: deleteJobSpy } });
            deleteJobSpy.mockResolvedValue({ success: true });

            const response = await jesApi.deleteJob("fakejob", "fakeid");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(deleteJobSpy).toHaveBeenCalledTimes(1);
            expect(deleteJobSpy).toHaveBeenCalledWith({ jobId: "fakeid" });
            expect(response).toEqual(undefined);
        });
        it("should fail to delete the job", async () => {
            const jesApi = new SshJesApi();
            const clientSpy = vi.spyOn(SshJesApi.prototype, "client", "get");
            const deleteJobSpy = vi.fn();

            clientSpy.mockResolvedValue({ jobs: { deleteJob: deleteJobSpy } });
            deleteJobSpy.mockResolvedValue({ success: false });

            let response: any;
            let error: Error;

            try {
                response = await jesApi.deleteJob("fakejob", "fakeid");
            } catch (err) {
                error = err;
            }

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(deleteJobSpy).toHaveBeenCalledTimes(1);
            expect(deleteJobSpy).toHaveBeenCalledWith({ jobId: "fakeid" });
            expect(response).toEqual(undefined);
            expect(error).toBeDefined();
            expect(error.message).toEqual("Failed to delete job fakeid");
        });
    });
});
