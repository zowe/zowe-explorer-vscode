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
import { ZoweExplorerApi } from "./ZoweExplorerApi";
import { FileAttributes, permStringToOctal } from "../utils/files";

/**
 * An implementation of the Zowe Explorer API Common interface for zOSMF.
 */
class ZosmfApiCommon implements ZoweExplorerApi.ICommon {
    public static getProfileTypeName(): string {
        return zowe.ZosmfProfile.type;
    }

    private session: zowe.imperative.Session;
    public constructor(public profile?: zowe.imperative.IProfileLoaded) {}

    public getProfileTypeName(): string {
        return ZosmfApiCommon.getProfileTypeName();
    }

    public getSessionFromCommandArgument(cmdArgs: zowe.imperative.ICommandArguments): zowe.imperative.Session {
        const sessCfg = zowe.ZosmfSession.createSessCfgFromArgs(cmdArgs);
        zowe.imperative.ConnectionPropsForSessCfg.resolveSessCfgProps(sessCfg, cmdArgs);
        const sessionToUse = new zowe.imperative.Session(sessCfg);
        return sessionToUse;
    }

    public getSession(profile?: zowe.imperative.IProfileLoaded): zowe.imperative.Session {
        if (!this.session) {
            try {
                this.session = this._getSession(profile || this.profile);
            } catch (error) {
                // todo: initialize and use logging
                zowe.imperative.Logger.getAppLogger().error(error as string);
            }
        }
        return this.session;
    }

    private _getSession(serviceProfile: zowe.imperative.IProfileLoaded): zowe.imperative.Session {
        let cmdArgs: zowe.imperative.ICommandArguments = {
            $0: "zowe",
            _: [""],
            host: serviceProfile.profile.host as string,
            port: serviceProfile.profile.port as number,
            basePath: serviceProfile.profile.basePath as string,
            rejectUnauthorized: serviceProfile.profile.rejectUnauthorized as boolean,
        };
        if (!serviceProfile.profile.tokenValue) {
            cmdArgs = {
                ...cmdArgs,
                user: serviceProfile.profile.user as string,
                password: serviceProfile.profile.password as string,
            };
        } else {
            cmdArgs = {
                ...cmdArgs,
                tokenType: serviceProfile.profile.tokenType as string,
                tokenValue: serviceProfile.profile.tokenValue as string,
            };
        }
        return this.getSessionFromCommandArgument(cmdArgs);
    }

    public async getStatus(validateProfile?: zowe.imperative.IProfileLoaded, profileType?: string): Promise<string> {
        // This API call is specific for z/OSMF profiles
        if (profileType === "zosmf") {
            const validateSession = this._getSession(validateProfile);
            const sessionStatus = await zowe.CheckStatus.getZosmfInfo(validateSession);

            if (sessionStatus) {
                return "active";
            } else {
                return "inactive";
            }
        } else {
            return "unverified";
        }
    }

    public getTokenTypeName(): string {
        return zowe.imperative.SessConstants.TOKEN_TYPE_APIML;
    }

    public login(session: zowe.imperative.Session): Promise<string> {
        return zowe.Login.apimlLogin(session);
    }

    public logout(session: zowe.imperative.Session): Promise<void> {
        return zowe.Logout.apimlLogout(session);
    }
}

/**
 * An implementation of the Zowe Explorer USS API interface for zOSMF.
 */
export class ZosmfUssApi extends ZosmfApiCommon implements ZoweExplorerApi.IUss {
    public fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        return zowe.List.fileList(this.getSession(), ussFilePath);
    }

    public isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        return zowe.Utilities.isFileTagBinOrAscii(this.getSession(), ussFilePath);
    }

    public getContents(inputFilePath: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.ussFile(this.getSession(), inputFilePath, options);
    }

    public copy(outputPath: string, options?: Omit<object, "request">): Promise<Buffer> {
        return zowe.Utilities.putUSSPayload(this.getSession(), outputPath, { ...(options ?? {}), request: "copy" });
    }

    /**
     * API method to wrap to the newer `putContent`.
     * @deprecated
     */
    public putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        return this.putContent(inputFilePath, ussFilePath, {
            binary,
            localEncoding,
            etag,
            returnEtag,
        });
    }

    public putContent(inputFilePath: string, ussFilePath: string, options: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.fileToUssFile(this.getSession(), inputFilePath, ussFilePath, options);
    }

    public async updateAttributes(ussPath: string, attributes: Partial<FileAttributes>): Promise<zowe.IZosFilesResponse> {
        try {
            if (attributes.tag) {
                await zowe.Utilities.putUSSPayload(this.getSession(), ussPath, {
                    request: "chtag",
                    action: "set",
                    type: "text",
                    codeset: attributes.tag !== null ? attributes.tag.toString() : attributes.tag,
                });
            }
            if ((attributes.group || attributes.gid) && (attributes.owner || attributes.uid)) {
                await zowe.Utilities.putUSSPayload(this.getSession(), ussPath, {
                    request: "chown",
                    owner: attributes.uid != null ? attributes.uid.toString() : attributes.owner,
                    group: attributes.gid != null ? attributes.gid.toString() : attributes.group,
                    recursive: true,
                });
            } else if (attributes.owner || attributes.uid) {
                await zowe.Utilities.putUSSPayload(this.getSession(), ussPath, {
                    request: "chown",
                    owner: attributes.uid != null ? attributes.uid.toString() : attributes.owner,
                    recursive: true,
                });
            }
            if (attributes.perms) {
                await zowe.Utilities.putUSSPayload(this.getSession(), ussPath, {
                    request: "chmod",
                    mode: permStringToOctal(attributes.perms).toString(),
                });
            }
        } catch (err) {
            const message = err instanceof Error ? err.toString() : "N/A";
            return {
                success: false,
                commandResponse: message,
                errorMessage: message,
            };
        }

        return {
            success: true,
            commandResponse: "The provided attributes were applied.",
        };
    }

    public uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.dirToUSSDirRecursive(this.getSession(), inputDirectoryPath, ussDirectoryPath, options);
    }

    public create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.uss(this.getSession(), ussPath, type, mode);
    }

    public delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        // handle zosmf api issue with file paths
        const fixedName = ussPath.startsWith("/") ? ussPath.substring(1) : ussPath;
        return zowe.Delete.ussFile(this.getSession(), fixedName, recursive);
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        const result = await zowe.Utilities.renameUSSFile(this.getSession(), currentUssPath, newUssPath);
        return {
            success: true,
            commandResponse: null,
            apiResponse: result,
        };
    }

    public async getTag(ussPath: string): Promise<string> {
        const response = await zowe.Utilities.putUSSPayload(this.getSession(), ussPath, {
            request: "chtag",
            action: "list",
        });
        return JSON.parse(response.toString()).stdout[0].split(" ")[1] as string;
    }
}

/**
 * An implementation of the Zowe Explorer MVS API interface for zOSMF.
 */
export class ZosmfMvsApi extends ZosmfApiCommon implements ZoweExplorerApi.IMvs {
    public dataSet(filter: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.List.dataSet(this.getSession(), filter, options);
    }

    public allMembers(dataSetName: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.List.allMembers(this.getSession(), dataSetName, options);
    }

    public getContents(dataSetName: string, options?: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.dataSet(this.getSession(), dataSetName, options);
    }

    public putContents(inputFilePath: string, dataSetName: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.pathToDataSet(this.getSession(), inputFilePath, dataSetName, options);
    }

    public createDataSet(
        dataSetType: zowe.CreateDataSetTypeEnum,
        dataSetName: string,
        options?: Partial<zowe.ICreateDataSetOptions>
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSet(this.getSession(), dataSetType, dataSetName, options);
    }

    public createDataSetMember(dataSetName: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.bufferToDataSet(this.getSession(), Buffer.from(""), dataSetName, options);
    }

    public allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSetLike(this.getSession(), dataSetName, likeDataSetName);
    }

    public copyDataSetMember(
        { dsn: fromDataSetName, member: fromMemberName }: zowe.IDataSet,
        { dsn: toDataSetName, member: toMemberName }: zowe.IDataSet,
        options?: zowe.ICopyDatasetOptions
    ): Promise<zowe.IZosFilesResponse> {
        let newOptions: zowe.ICopyDatasetOptions;
        if (options) {
            if (options["from-dataset"]) {
                newOptions = options;
            } else {
                newOptions = {
                    ...options,
                    ...{ "from-dataset": { dsn: fromDataSetName, member: fromMemberName } },
                };
            }
        } else {
            // If we decide to match 1:1 the Zowe.Copy.dataSet implementation, we will need to break the interface definition in the ZoweExplorerApi
            newOptions = { "from-dataset": { dsn: fromDataSetName, member: fromMemberName } };
        }
        return zowe.Copy.dataSet(this.getSession(), { dsn: toDataSetName, member: toMemberName }, newOptions);
    }

    public renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSet(this.getSession(), currentDataSetName, newDataSetName);
    }

    public renameDataSetMember(dataSetName: string, oldMemberName: string, newMemberName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSetMember(this.getSession(), dataSetName, oldMemberName, newMemberName);
    }

    public hMigrateDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.HMigrate.dataSet(this.getSession(), dataSetName);
    }

    public hRecallDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.HRecall.dataSet(this.getSession(), dataSetName);
    }

    public deleteDataSet(dataSetName: string, options?: zowe.IDeleteDatasetOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.Delete.dataSet(this.getSession(), dataSetName, options);
    }

    public dataSetsMatchingPattern(filter: string[], options?: zowe.IDsmListOptions): Promise<zowe.IZosFilesResponse> {
        return zowe.List.dataSetsMatchingPattern(this.getSession(), filter, options);
    }
    public copyDataSet(fromDataSetName: string, toDataSetName: string, enq?: string, replace?: boolean): Promise<zowe.IZosFilesResponse> {
        return zowe.Copy.dataSet(this.getSession(), { dsn: toDataSetName }, { "from-dataset": { dsn: fromDataSetName }, enq, replace });
    }
}

/**
 * An implementation of the Zowe Explorer JES API interface for zOSMF.
 */
export class ZosmfJesApi extends ZosmfApiCommon implements ZoweExplorerApi.IJes {
    public getJobsByParameters(params: zowe.IGetJobsParms): Promise<zowe.IJob[]> {
        return zowe.GetJobs.getJobsByParameters(this.getSession(), params);
    }

    public getJobsByOwnerAndPrefix(owner: string, prefix: string): Promise<zowe.IJob[]> {
        return zowe.GetJobs.getJobsByOwnerAndPrefix(this.getSession(), owner, prefix);
    }

    public getJob(jobid: string): Promise<zowe.IJob> {
        return zowe.GetJobs.getJob(this.getSession(), jobid);
    }

    public getSpoolFiles(jobname: string, jobid: string): Promise<zowe.IJobFile[]> {
        return zowe.GetJobs.getSpoolFiles(this.getSession(), jobname, jobid);
    }

    public downloadSpoolContent(parms: zowe.IDownloadAllSpoolContentParms): Promise<void> {
        return zowe.DownloadJobs.downloadAllSpoolContentCommon(this.getSession(), parms);
    }

    public downloadSingleSpool(parms: zowe.IDownloadSpoolContentParms): Promise<void> {
        return zowe.DownloadJobs.downloadSpoolContentCommon(this.getSession(), parms);
    }

    public getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string> {
        return zowe.GetJobs.getSpoolContentById(this.getSession(), jobname, jobid, spoolId);
    }

    public getJclForJob(job: zowe.IJob): Promise<string> {
        return zowe.GetJobs.getJclForJob(this.getSession(), job);
    }

    public submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<zowe.IJob> {
        return zowe.SubmitJobs.submitJcl(this.getSession(), jcl, internalReaderRecfm, internalReaderLrecl);
    }

    public submitJob(jobDataSet: string): Promise<zowe.IJob> {
        return zowe.SubmitJobs.submitJob(this.getSession(), jobDataSet);
    }

    public async deleteJob(jobname: string, jobid: string): Promise<void> {
        await zowe.DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
    }

    public deleteJobWithInfo(jobname: string, jobid: string): Promise<undefined | zowe.IJobFeedback> {
        return zowe.DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
    }

    public async cancelJob(job: zowe.IJob): Promise<boolean> {
        const session = this.getSession();
        // use 1.0 so that all JES subsystems are supported out-of-the-box
        const jobResult = await zowe.CancelJobs.cancelJobForJob(session, job, "2.0");
        return jobResult.status === "0";
    }
}

/**
 * An implementation of the Zowe Explorer Command API interface for zOSMF.
 */
export class ZosmfCommandApi extends ZosmfApiCommon implements ZoweExplorerApi.ICommand {
    public issueTsoCommand(command: string, acctNum: string): Promise<zowe.IIssueResponse> {
        return zowe.IssueTso.issueTsoCommand(this.getSession(), acctNum, command);
    }

    public issueTsoCommandWithParms(command: string, parms: zowe.IStartTsoParms): Promise<zowe.IIssueResponse> {
        return zowe.IssueTso.issueTsoCommand(this.getSession(), parms.account, command, parms);
    }

    public issueMvsCommand(command: string): Promise<zowe.IConsoleResponse> {
        return zowe.IssueCommand.issueSimple(this.getSession(), command);
    }
}
