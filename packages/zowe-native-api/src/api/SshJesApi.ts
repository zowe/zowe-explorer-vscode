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

import type * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import type { MainframeInteraction } from "@zowe/zowe-explorer-api";
import { B64String } from "zowex-sdk";
import { SshCommonApi } from "./SshCommonApi";

export class SshJesApi extends SshCommonApi implements MainframeInteraction.IJes {
    public async getJobsByParameters(params: zosjobs.IGetJobsParms): Promise<zosjobs.IJob[]> {
        const response = await (await this.client).jobs.listJobs({
            owner: params.owner?.toUpperCase(),
            prefix: params.prefix,
        });
        return response.items.map(
            (item): Partial<zosjobs.IJob> => ({
                jobid: item.id,
                jobname: item.name,
                status: item.status,
                retcode: item.retcode === "------" ? item.status : item.retcode,
            }),
        ) as zosjobs.IJob[];
    }

    public async getJob(jobid: string): Promise<zosjobs.IJob> {
        const response = await (await this.client).jobs.getStatus({
            jobId: jobid.toUpperCase(),
        });
        return {
            jobid: response.id,
            jobname: response.name,
            status: response.status,
            retcode: response.retcode === "------" ? response.status : response.retcode,
        } as zosjobs.IJob;
    }

    public async getSpoolFiles(_jobname: string, jobid: string): Promise<zosjobs.IJobFile[]> {
        const response = await (await this.client).jobs.listSpools({
            jobId: jobid.toUpperCase(),
        });
        return response.items as unknown as zosjobs.IJobFile[];
    }

    public async downloadSpoolContent(_parms: zosjobs.IDownloadAllSpoolContentParms): Promise<void> {
        throw new Error("Not yet implemented");
    }

    public async getSpoolContentById(_jobname: string, jobid: string, spoolId: number): Promise<string> {
        const response = await (await this.client).jobs.readSpool({
            spoolId,
            jobId: jobid.toUpperCase(),
        });
        return B64String.decode(response.data);
    }

    public async getJclForJob(job: zosjobs.IJob): Promise<string> {
        const response = await (await this.client).jobs.getJcl({
            jobId: job.jobid.toUpperCase(),
        });
        return response.data;
    }

    public async cancelJob(job: zosjobs.IJob): Promise<boolean> {
        const response = await (await this.client).jobs.cancelJob({
            jobId: job.jobid.toUpperCase(),
        });
        return response.success;
    }

    public async submitJcl(
        jcl: string,
        _internalReaderRecfm?: string,
        _internalReaderLrecl?: string,
    ): Promise<zosjobs.IJob> {
        const response = await (await this.client).jobs.submitJcl({
            jcl: B64String.encode(jcl),
        });
        return { jobid: response.jobId, jobname: response.jobName } as zosjobs.IJob;
    }

    public async submitJob(jobDataSet: string): Promise<zosjobs.IJob> {
        const response = await (await this.client).jobs.submitJob({
            dsname: jobDataSet,
        });
        return { jobid: response.jobId, jobname: response.jobName } as zosjobs.IJob;
    }

    public async deleteJob(_jobname: string, jobid: string): Promise<void> {
        const response = await (await this.client).jobs.deleteJob({
            jobId: jobid,
        });
        if (!response.success) {
            throw new Error(`Failed to delete job ${jobid}`);
        }
    }
}
