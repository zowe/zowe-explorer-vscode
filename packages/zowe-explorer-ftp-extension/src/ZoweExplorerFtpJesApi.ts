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

import * as zowe from "@zowe/cli";
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { JobUtils, DataSetUtils, TRANSFER_TYPE_ASCII } from "@zowe/zos-ftp-for-zowe-cli";
import { DownloadJobs, IJobFile } from "@zowe/cli";
import { IJob, IJobStatus, ISpoolFile } from "@zowe/zos-ftp-for-zowe-cli/lib/api/JobInterface";
import { AbstractFtpApi, ConnectionType } from "./ZoweExplorerAbstractFtpApi";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";
// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

interface IJobRefactor extends IJob {
    jobId: string;
    jobName: string;
}

interface ISpoolFileRefactor extends ISpoolFile {
    stepName: string;
    procStep: string;
    ddName: string;
}

export class FtpJesApi extends AbstractFtpApi implements ZoweExplorerApi.IJes {
    public async getJobsByOwnerAndPrefix(owner: string, prefix: string): Promise<zowe.IJob[]> {
        const result = this.getIJobResponse();
        const session = this.getSession(this.profile);
        try {
            if (session.jesListConnection === undefined || session.jesListConnection.connected === false) {
                session.jesListConnection = await this.ftpClient(this.checkedProfile());
            }

            if (session.jesListConnection.connected === true) {
                const options = {
                    owner: owner,
                };
                const response = await JobUtils.listJobs(session.jesListConnection, prefix, options);
                if (response) {
                    const results = response.map((job: IJob) => {
                        return {
                            ...result,
                            /* it’s prepared for the potential change in zftp api, renaming jobid to jobId, jobname to jobName. */
                            jobid: (job as IJobRefactor).jobId || job.jobid,
                            jobname: (job as IJobRefactor).jobName || job.jobname,
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

    public async getJob(jobid: string): Promise<zowe.IJob> {
        const result = this.getIJobResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const jobStatus: IJobStatus = await JobUtils.findJobByID(connection, jobid);
                if (jobStatus) {
                    return {
                        ...result,
                        /* it’s prepared for the potential change in zftp api, renaming jobid to jobId, jobname to jobName. */
                        jobid: (jobStatus as IJobRefactor).jobId || jobStatus.jobid,
                        jobname: (jobStatus as IJobRefactor).jobName || jobStatus.jobname,
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

    public async getSpoolFiles(jobname: string, jobid: string): Promise<zowe.IJobFile[]> {
        const result = this.getIJobFileResponse();
        let connection: unknown;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const response: IJobStatus = await JobUtils.findJobByID(connection, jobid);
                const files = response.spoolFiles;
                if (files) {
                    return files.map((file: ISpoolFile) => {
                        return {
                            /**
                             * prepared for the potential change in zftp api:
                             * renaming stepname to stepName, procstep to procStep, ddname to ddName.
                             **/
                            jobid: jobid,
                            jobname: jobname,
                            "byte-count": file.byteCount,
                            id: file.id,
                            stepname: (file as ISpoolFileRefactor).stepName || file.stepname,
                            procstep: (file as ISpoolFileRefactor).procStep || file.procstep,
                            class: file.class,
                            ddname: (file as ISpoolFileRefactor).ddName || file.ddname,
                        } as unknown as zowe.IJobFile;
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
    public async downloadSpoolContent(parms: zowe.IDownloadAllSpoolContentParms): Promise<void> {
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            /* it's duplicate code with zftp. We may add new job API in the next zftp to cover spool file downloading. */
            if (connection) {
                const jobDetails = await JobUtils.findJobByID(connection, parms.jobid);
                if (jobDetails.spoolFiles == null || jobDetails.spoolFiles.length === 0) {
                    throw new Error("No spool files were available.");
                }
                const fullSpoolFiles = await JobUtils.getSpoolFiles(connection, jobDetails.jobid);
                for (const spoolFileToDownload of fullSpoolFiles) {
                    const mockJobFile: IJobFile = {
                        // mock a job file to get the same format of download directories
                        jobid: jobDetails.jobid,
                        jobname: jobDetails.jobname,
                        recfm: "FB",
                        lrecl: 80,
                        "byte-count": Number(spoolFileToDownload.byteCount),
                        // todo is recfm or lrecl available? FB 80 could be wrong
                        "record-count": 0,
                        "job-correlator": "", // most of these options don't matter for download
                        class: "A",
                        ddname: String(spoolFileToDownload.ddname),
                        id: Number(spoolFileToDownload.id),
                        "records-url": "",
                        subsystem: "JES2",
                        stepname: String(spoolFileToDownload.stepname),
                        procstep: String(
                            spoolFileToDownload.procstep === "N/A" || spoolFileToDownload.procstep == null ? undefined : spoolFileToDownload.procstep
                        ),
                    };
                    const destinationFile = DownloadJobs.getSpoolDownloadFile(mockJobFile, parms.omitJobidDirectory, parms.outDir);
                    zowe.imperative.IO.createDirsSyncFromFilePath(destinationFile);
                    zowe.imperative.IO.writeFile(destinationFile, spoolFileToDownload.contents);
                }
            }
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string> {
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const options = {
                    fileId: spoolId.toString(),
                    jobName: jobname,
                    jobId: jobid,
                    owner: "*",
                };
                const response: Buffer = await JobUtils.getSpoolFileContent(connection, options);
                if (response) {
                    return response.toString();
                }
            }
            return "";
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public getJclForJob(_job: zowe.IJob): Promise<string> {
        throw new ZoweFtpExtensionError("Get jcl is not supported in the FTP extension.");
    }

    public submitJcl(_jcl: string, _internalReaderRecfm?: string, _internalReaderLrecl?: string): Promise<zowe.IJob> {
        throw new ZoweFtpExtensionError("Submit jcl is not supported in the FTP extension.");
    }

    public async submitJob(jobDataSet: string): Promise<zowe.IJob> {
        const result = this.getIJobResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const transferOptions = {
                    transferType: TRANSFER_TYPE_ASCII,
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
    public async deleteJob(jobname: string, jobid: string): Promise<void> {
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await JobUtils.deleteJob(connection, jobid);
            }
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    private getIJobResponse(): zowe.IJob {
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
    private getIJobFileResponse(): zowe.IJobFile {
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
