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

import * as zosJobs from "@zowe/zos-jobs-for-zowe-sdk";
import { MainframeInteraction } from "@zowe/zowe-explorer-api";
import { JobUtils, DataSetUtils, TransferMode, IJob, IJobStatus, ISpoolFile, IGetSpoolFileOption } from "@zowe/zos-ftp-for-zowe-cli";
import { AbstractFtpApi, ConnectionType } from "./ZoweExplorerAbstractFtpApi";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";

// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class FtpJesApi extends AbstractFtpApi implements MainframeInteraction.IJes {
    public async getJobsByParameters(params: zosJobs.IGetJobsParms): Promise<zosJobs.IJob[]> {
        const result = this.getIJobResponse();
        const session = this.getSession(this.profile);
        try {
            if (session.jesListConnection === undefined || session.jesListConnection.connected === false) {
                session.jesListConnection = await this.ftpClient(this.checkedProfile());
            }

            if (session.jesListConnection.connected === true) {
                const options = {
                    owner: params.owner,
                    status: params.status,
                };
                const response = await JobUtils.listJobs(session.jesListConnection, params.prefix, options);
                if (response) {
                    const results = response.map((job: IJob) => {
                        return {
                            ...result,
                            jobid: job.jobId,
                            jobname: job.jobName,
                            owner: job.owner,
                            class: job.class,
                            status: job.status,
                        };
                    });
                    return results;
                }
            }
            return [result];
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        }
    }

    public async getJob(jobId: string): Promise<zosJobs.IJob> {
        const result = this.getIJobResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const jobStatus: IJobStatus = await JobUtils.findJobByID(connection, jobId);
                if (jobStatus) {
                    return {
                        ...result,
                        jobid: jobStatus.jobId,
                        jobname: jobStatus.jobName,
                        owner: jobStatus.owner,
                        class: jobStatus.class,
                        status: jobStatus.status,
                    };
                }
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async getSpoolFiles(jobName: string, jobId: string): Promise<zosJobs.IJobFile[]> {
        const result = this.getIJobFileResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const response: IJobStatus = await JobUtils.findJobByID(connection, jobId);
                const files = response.spoolFiles;
                if (files) {
                    return files.map((file: ISpoolFile) => {
                        return {
                            jobid: jobId,
                            jobname: jobName,
                            "byte-count": file.byteCount,
                            id: file.id,
                            stepname: file.stepName,
                            procstep: file.procStep,
                            class: file.class,
                            ddname: file.ddName,
                        } as unknown as zosJobs.IJobFile;
                    });
                }
            }
            return [result];
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection as ConnectionType);
        }
    }
    public async downloadSpoolContent(parms: zosJobs.IDownloadAllSpoolContentParms): Promise<void> {
        if (parms.binary) {
            throw new Error("Unable to download spool content in binary format");
        }
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await JobUtils.downloadSpoolContent(connection, {
                    ...parms,
                    jobId: parms.jobid,
                });
            }
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async getSpoolContentById(jobName: string, jobId: string, spoolId: number): Promise<string> {
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            let response: string;
            if (connection) {
                const options: IGetSpoolFileOption = {
                    fileId: spoolId,
                    // jobName: jobName, // Removed in zos-node-accessor 2.0
                    jobId: jobId,
                    owner: "*",
                };
                response = await JobUtils.getSpoolFileContent(connection, options);
            }
            return response ?? "";
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public getJclForJob(_job: zosJobs.IJob): Promise<string> {
        throw new ZoweFtpExtensionError("Get jcl is not supported in the FTP extension.");
    }

    public submitJcl(_jcl: string, _internalReaderRecfm?: string, _internalReaderLrecl?: string): Promise<zosJobs.IJob> {
        throw new ZoweFtpExtensionError("Submit jcl is not supported in the FTP extension.");
    }

    public async submitJob(jobDataSet: string): Promise<zosJobs.IJob> {
        const result = this.getIJobResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const transferOptions = {
                    transferType: TransferMode.ASCII,
                };
                const content = await DataSetUtils.downloadDataSet(connection, jobDataSet, transferOptions);
                const jcl = content.toString();
                const jobId: string = await JobUtils.submitJob(connection, jcl);
                if (jobId) {
                    result.jobid = jobId;
                }
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }
    public async deleteJob(jobName: string, jobId: string): Promise<void> {
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await JobUtils.deleteJob(connection, jobId);
            }
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    private getIJobResponse(): zosJobs.IJob {
        return {
            jobid: "",
            jobname: "",
            subsystem: "",
            owner: "",
            status: "",
            type: "",
            class: "",
            retcode: "",
            "step-data": [],
            url: "",
            "files-url": "",
            "job-correlator": "",
            phase: 0,
            "phase-name": "",
            "reason-not-running": "",
        };
    }
    private getIJobFileResponse(): zosJobs.IJobFile {
        return {
            jobid: "",
            jobname: "",
            recfm: "",
            "byte-count": 0,
            "record-count": 0,
            "job-correlator": "",
            class: "",
            id: 0,
            ddname: "",
            "records-url": "",
            lrecl: 0,
            subsystem: "",
            stepname: "",
            procstep: "",
        };
    }
}
