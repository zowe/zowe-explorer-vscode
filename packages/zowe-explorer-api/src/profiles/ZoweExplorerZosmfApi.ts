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

import { Login, Logout } from "@zowe/core-for-zowe-sdk";
import * as imperative from "@zowe/imperative";
import * as zosconsole from "@zowe/zos-console-for-zowe-sdk";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import * as zostso from "@zowe/zos-tso-for-zowe-sdk";
import * as zosuss from "@zowe/zos-uss-for-zowe-sdk";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { MainframeInteraction } from "../extend/MainframeInteraction";
import { FileManagement } from "../utils";
import { Types } from "../Types";
import { ProfilesCache } from "../profiles/ProfilesCache";

/**
 * Implementations of Zowe Explorer API for z/OSMF profiles
 */
export namespace ZoweExplorerZosmf {
    /**
     * An implementation of the Zowe Explorer API Common interface for zOSMF.
     */
    class CommonApi implements MainframeInteraction.ICommon {
        public static getProfileTypeName(): string {
            return zosmf.ZosmfProfile.type;
        }

        private session: imperative.Session;
        public constructor(public profile?: imperative.IProfileLoaded) {}

        public getProfileTypeName(): string {
            return CommonApi.getProfileTypeName();
        }

        public getSessionFromCommandArgument(cmdArgs: imperative.ICommandArguments): imperative.Session {
            const sessCfg = zosmf.ZosmfSession.createSessCfgFromArgs(cmdArgs);
            imperative.ConnectionPropsForSessCfg.resolveSessCfgProps(sessCfg, cmdArgs);
            const sessionToUse = new imperative.Session(sessCfg);
            return ProfilesCache.getProfileSessionWithVscProxy(sessionToUse);
        }

        public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
            if (!this.session) {
                try {
                    this.session = this._getSession(profile || this.profile);
                } catch (error) {
                    // todo: initialize and use logging
                    imperative.Logger.getAppLogger().error(error as string);
                }
            }
            return ProfilesCache.getProfileSessionWithVscProxy(this.session);
        }

        private _getSession(serviceProfile: imperative.IProfileLoaded): imperative.Session {
            let cmdArgs: imperative.ICommandArguments = {
                $0: "zowe",
                _: [""],
                host: serviceProfile.profile.host as string,
                port: serviceProfile.profile.port as number,
                protocol: serviceProfile.profile.protocol as string,
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

        public async getStatus(validateProfile?: imperative.IProfileLoaded, profileType?: string): Promise<string> {
            // This API call is specific for z/OSMF profiles
            if (profileType === "zosmf") {
                const validateSession = this._getSession(validateProfile);
                const sessionStatus = await zosmf.CheckStatus.getZosmfInfo(validateSession);

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
            return imperative.SessConstants.TOKEN_TYPE_APIML;
        }

        public login(session: imperative.Session): Promise<string> {
            return Login.apimlLogin(session);
        }

        public logout(session: imperative.Session): Promise<void> {
            return Logout.apimlLogout(session);
        }
    }

    /**
     * An implementation of the Zowe Explorer USS API interface for zOSMF.
     */
    export class UssApi extends CommonApi implements MainframeInteraction.IUss {
        public fileList(ussFilePath: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.List.fileList(this.getSession(), ussFilePath, { responseTimeout: this.profile?.profile?.responseTimeout });
        }

        public isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
            return zosfiles.Utilities.isFileTagBinOrAscii(this.getSession(), ussFilePath);
        }

        public getContents(inputFilePath: string, options: zosfiles.IDownloadSingleOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Download.ussFile(this.getSession(), inputFilePath, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public copy(outputPath: string, options?: Omit<object, "request">): Promise<Buffer> {
            return zosfiles.Utilities.putUSSPayload(this.getSession(), outputPath, { ...options, request: "copy" });
        }

        public async move(oldPath: string, newPath: string): Promise<void> {
            await zosfiles.Utilities.putUSSPayload(this.getSession(), newPath, {
                request: "move",
                from: oldPath,
            });
        }

        public uploadFromBuffer(buffer: Buffer, filePath: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.bufferToUssFile(this.getSession(), filePath, buffer, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public putContent(inputFilePath: string, ussFilePath: string, options: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.fileToUssFile(this.getSession(), inputFilePath, ussFilePath, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public async updateAttributes(ussPath: string, attributes: Partial<Types.FileAttributes>): Promise<zosfiles.IZosFilesResponse> {
            try {
                if (attributes.tag) {
                    await zosfiles.Utilities.putUSSPayload(this.getSession(), ussPath, {
                        request: "chtag",
                        action: "set",
                        type: "text",
                        codeset: attributes.tag !== null ? attributes.tag.toString() : attributes.tag,
                    });
                }
                if ((attributes.group || attributes.gid) && (attributes.owner || attributes.uid)) {
                    await zosfiles.Utilities.putUSSPayload(this.getSession(), ussPath, {
                        request: "chown",
                        owner: attributes.uid != null ? attributes.uid.toString() : attributes.owner,
                        group: attributes.gid != null ? attributes.gid.toString() : attributes.group,
                        recursive: true,
                    });
                } else if (attributes.owner || attributes.uid) {
                    await zosfiles.Utilities.putUSSPayload(this.getSession(), ussPath, {
                        request: "chown",
                        owner: attributes.uid != null ? attributes.uid.toString() : attributes.owner,
                        recursive: true,
                    });
                }
                if (attributes.perms) {
                    await zosfiles.Utilities.putUSSPayload(this.getSession(), ussPath, {
                        request: "chmod",
                        mode: FileManagement.permStringToOctal(attributes.perms).toString(),
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

        public uploadDirectory(
            inputDirectoryPath: string,
            ussDirectoryPath: string,
            options?: zosfiles.IUploadOptions
        ): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.dirToUSSDirRecursive(this.getSession(), inputDirectoryPath, ussDirectoryPath, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public create(ussPath: string, type: string, mode?: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Create.uss(this.getSession(), ussPath, type, mode, { responseTimeout: this.profile?.profile?.responseTimeout });
        }

        public delete(ussPath: string, recursive?: boolean): Promise<zosfiles.IZosFilesResponse> {
            // handle zosmf api issue with file paths
            const fixedName = ussPath.startsWith("/") ? ussPath.substring(1) : ussPath;
            return zosfiles.Delete.ussFile(this.getSession(), fixedName, recursive, { responseTimeout: this.profile?.profile?.responseTimeout });
        }

        public async rename(currentUssPath: string, newUssPath: string): Promise<zosfiles.IZosFilesResponse> {
            const result = await zosfiles.Utilities.renameUSSFile(this.getSession(), currentUssPath, newUssPath);
            return {
                success: true,
                commandResponse: null,
                apiResponse: result,
            };
        }

        public async getTag(ussPath: string): Promise<string> {
            const response = await zosfiles.Utilities.putUSSPayload(this.getSession(), ussPath, {
                request: "chtag",
                action: "list",
            });
            return JSON.parse(response.toString()).stdout[0].split(" ")[1] as string;
        }
    }

    /**
     * An implementation of the Zowe Explorer MVS API interface for zOSMF.
     */
    export class MvsApi extends CommonApi implements MainframeInteraction.IMvs {
        public dataSet(filter: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.List.dataSet(this.getSession(), filter, { responseTimeout: this.profile?.profile?.responseTimeout, ...options });
        }

        public allMembers(dataSetName: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.List.allMembers(this.getSession(), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public getContents(dataSetName: string, options?: zosfiles.IDownloadSingleOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Download.dataSet(this.getSession(), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public uploadFromBuffer(buffer: Buffer, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.bufferToDataSet(this.getSession(), buffer, dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public putContents(inputFilePath: string, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.pathToDataSet(this.getSession(), inputFilePath, dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public createDataSet(
            dataSetType: zosfiles.CreateDataSetTypeEnum,
            dataSetName: string,
            options?: Partial<zosfiles.ICreateDataSetOptions>
        ): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Create.dataSet(this.getSession(), dataSetType, dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public createDataSetMember(dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Upload.bufferToDataSet(this.getSession(), Buffer.from(""), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Create.dataSetLike(this.getSession(), dataSetName, likeDataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
            });
        }

        public copyDataSetMember(
            { dsn: fromDataSetName, member: fromMemberName }: zosfiles.IDataSet,
            { dsn: toDataSetName, member: toMemberName }: zosfiles.IDataSet,
            options?: zosfiles.ICopyDatasetOptions
        ): Promise<zosfiles.IZosFilesResponse> {
            let newOptions: zosfiles.ICopyDatasetOptions;
            if (options) {
                if (options["from-dataset"]) {
                    newOptions = options;
                } else {
                    newOptions = {
                        ...options,
                        "from-dataset": { dsn: fromDataSetName, member: fromMemberName },
                    };
                }
            } else {
                // If we decide to match 1:1 the Zowe.Copy.dataSet implementation,
                // we will need to break the interface definition in the ZoweExplorerApi
                newOptions = { "from-dataset": { dsn: fromDataSetName, member: fromMemberName } };
            }
            return zosfiles.Copy.dataSet(
                this.getSession(),
                { dsn: toDataSetName, member: toMemberName },
                {
                    responseTimeout: this.profile?.profile?.responseTimeout,
                    ...newOptions,
                }
            );
        }

        public renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Rename.dataSet(this.getSession(), currentDataSetName, newDataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
            });
        }

        public renameDataSetMember(dataSetName: string, oldMemberName: string, newMemberName: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Rename.dataSetMember(this.getSession(), dataSetName, oldMemberName, newMemberName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
            });
        }

        public hMigrateDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.HMigrate.dataSet(this.getSession(), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
            });
        }

        public hRecallDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.HRecall.dataSet(this.getSession(), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
            });
        }

        public deleteDataSet(dataSetName: string, options?: zosfiles.IDeleteDatasetOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Delete.dataSet(this.getSession(), dataSetName, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }

        public dataSetsMatchingPattern(filter: string[], options?: zosfiles.IDsmListOptions): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.List.dataSetsMatchingPattern(this.getSession(), filter, {
                responseTimeout: this.profile?.profile?.responseTimeout,
                ...options,
            });
        }
        public copyDataSet(fromDataSetName: string, toDataSetName: string, enq?: string, replace?: boolean): Promise<zosfiles.IZosFilesResponse> {
            return zosfiles.Copy.dataSet(
                this.getSession(),
                { dsn: toDataSetName },
                { "from-dataset": { dsn: fromDataSetName }, enq, replace, responseTimeout: this.profile?.profile?.responseTimeout }
            );
        }
    }

    /**
     * An implementation of the Zowe Explorer JES API interface for zOSMF.
     */
    export class JesApi extends CommonApi implements MainframeInteraction.IJes {
        public getJobsByParameters(params: zosjobs.IGetJobsParms): Promise<zosjobs.IJob[]> {
            return zosjobs.GetJobs.getJobsByParameters(this.getSession(), params);
        }

        public getJob(jobid: string): Promise<zosjobs.IJob> {
            return zosjobs.GetJobs.getJob(this.getSession(), jobid);
        }

        public getSpoolFiles(jobname: string, jobid: string): Promise<zosjobs.IJobFile[]> {
            return zosjobs.GetJobs.getSpoolFiles(this.getSession(), jobname, jobid);
        }

        public downloadSpoolContent(parms: zosjobs.IDownloadAllSpoolContentParms): Promise<void> {
            return zosjobs.DownloadJobs.downloadAllSpoolContentCommon(this.getSession(), parms);
        }

        public downloadSingleSpool(parms: zosjobs.IDownloadSpoolContentParms): Promise<void> {
            return zosjobs.DownloadJobs.downloadSpoolContentCommon(this.getSession(), parms);
        }

        public getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string> {
            return zosjobs.GetJobs.getSpoolContentById(this.getSession(), jobname, jobid, spoolId);
        }

        public getJclForJob(job: zosjobs.IJob): Promise<string> {
            return zosjobs.GetJobs.getJclForJob(this.getSession(), job);
        }

        public submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<zosjobs.IJob> {
            return zosjobs.SubmitJobs.submitJcl(this.getSession(), jcl, internalReaderRecfm, internalReaderLrecl);
        }

        public submitJob(jobDataSet: string): Promise<zosjobs.IJob> {
            return zosjobs.SubmitJobs.submitJob(this.getSession(), jobDataSet);
        }

        public async deleteJob(jobname: string, jobid: string): Promise<void> {
            await zosjobs.DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
        }

        public deleteJobWithInfo(jobname: string, jobid: string): Promise<undefined | zosjobs.IJobFeedback> {
            return zosjobs.DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
        }

        public async cancelJob(job: zosjobs.IJob): Promise<boolean> {
            const session = this.getSession();
            // use 1.0 so that all JES subsystems are supported out-of-the-box
            const jobResult = await zosjobs.CancelJobs.cancelJobForJob(session, job, "2.0");
            return jobResult.status === "0";
        }
    }

    /**
     * An implementation of the Zowe Explorer Command API interface for zOSMF.
     */
    export class CommandApi extends CommonApi implements MainframeInteraction.ICommand {
        public issueTsoCommandWithParms(command: string, parms: zostso.IStartTsoParms): Promise<zostso.IIssueResponse> {
            // eslint-disable-next-line deprecation/deprecation
            return zostso.IssueTso.issueTsoCommand(this.getSession(), parms.account, command, parms);
        }

        public issueMvsCommand(command: string, consoleName?: string): Promise<zosconsole.IConsoleResponse> {
            return zosconsole.IssueCommand.issue(this.getSession(), { command, consoleName, processResponses: true });
        }

        public async issueUnixCommand(command: string, cwd: string, sshSession: zosuss.SshSession): Promise<string> {
            let stdout = "";
            if (cwd) {
                await zosuss.Shell.executeSshCwd(sshSession, command, '"' + cwd + '"', (data: string) => {
                    stdout += data;
                });
            } else {
                await zosuss.Shell.executeSsh(sshSession, command, (data: string) => {
                    stdout += data;
                });
            }
            return stdout;
        }

        public sshProfileRequired?(): boolean {
            return true;
        }
    }
}
