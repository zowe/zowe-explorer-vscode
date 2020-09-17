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

import * as zowe from "@zowe/cli";
import { Session, IProfileLoaded, ITaskWithStatus, TaskStage } from "@zowe/imperative";
import { ZoweExplorerApi } from "./ZoweExplorerApi";

import * as nls from "vscode-nls";
// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

// tslint:disable: max-classes-per-file

/**
 * An implementation of the Zowe Explorer API Common interface for zOSMF.
 */
class ZosmfApiCommon implements ZoweExplorerApi.ICommon {
    public static getProfileTypeName(): string {
        return "zosmf";
    }

    private session: Session;
    constructor(public profile?: IProfileLoaded) {
    }

    public getProfileTypeName(): string {
        return ZosmfUssApi.getProfileTypeName();
    }

    public getSession(profile?: IProfileLoaded): Session {
        if (!this.session) {
            this.session = zowe.ZosmfSession.createBasicZosmfSession((profile||this.profile).profile);
        }
        return this.session;
    }

    public async getStatus(validateProfile?: IProfileLoaded, profileType?: string): Promise<string> {
        // This API call is specific for z/OSMF profiles
        if (profileType === "zosmf") {
            const validateSession = await zowe.ZosmfSession.createBasicZosmfSession(validateProfile.profile);
            const sessionStatus= await zowe.CheckStatus.getZosmfInfo(validateSession);

            if (sessionStatus) {
                return "active";
            } else {
                return "inactive";
            }
        } else {
            return "unverified";
        }
    }
}

/**
 * An implementation of the Zowe Explorer USS API interface for zOSMF.
 */
export class ZosmfUssApi extends ZosmfApiCommon implements ZoweExplorerApi.IUss {

    public async fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        return zowe.List.fileList(this.getSession(), ussFilePath);
    }

    public async isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        return zowe.Utilities.isFileTagBinOrAscii(this.getSession(), ussFilePath);
    }

    public async getContents(inputFilePath: string, options: zowe.IDownloadOptions
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.ussFile(this.getSession(), inputFilePath, options);
    }


    /**
     * API method to wrap to the newer `putContent`.
     * @deprecated
     */
    public async putContents(inputFilePath: string, ussFilePath: string,
                             binary?: boolean, localEncoding?: string,
                             etag?: string, returnEtag?: boolean): Promise<zowe.IZosFilesResponse> {
        return this.putContent(inputFilePath, ussFilePath, {
            binary,
            localEncoding,
            etag,
            returnEtag
        });
    }

    public async putContent(inputFilePath: string, ussFilePath: string,
                            options: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        const task: ITaskWithStatus = {
            percentComplete: 0,
            statusMessage: localize("api.zosmfUSSApi.putContents", "Uploading USS file"),
            stageName: 0 // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
        };

        options.task = task;
        return zowe.Upload.fileToUssFile(this.getSession(), inputFilePath, ussFilePath, options);
    }

    public async uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        options?: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.dirToUSSDirRecursive(this.getSession(), inputDirectoryPath, ussDirectoryPath, options
        );
    }

    public async create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.uss(this.getSession(), ussPath, type);
    }

    public async delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        // handle zosmf api issue with file paths
        const fixedName = ussPath.startsWith("/") ?  ussPath.substring(1) :  ussPath;
        return zowe.Delete.ussFile(this.getSession(), fixedName, recursive);
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        const result = await zowe.Utilities.renameUSSFile(this.getSession(), currentUssPath, newUssPath);
        return {
            success: true,
            commandResponse: null,
            apiResponse: result
        };
    }
}

/**
 * An implementation of the Zowe Explorer MVS API interface for zOSMF.
 */
export class ZosmfMvsApi extends ZosmfApiCommon implements ZoweExplorerApi.IMvs {

    public async dataSet(filter: string, options?: zowe.IListOptions
        ): Promise<zowe.IZosFilesResponse>{
        return zowe.List.dataSet(this.getSession(), filter, options);
    }

    public async allMembers(dataSetName: string, options?: zowe.IListOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.List.allMembers(this.getSession(), dataSetName, options);
    }

    public async getContents(dataSetName: string, options?: zowe.IDownloadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.dataSet(this.getSession(), dataSetName, options);
    }

    public async putContents(inputFilePath: string, dataSetName: string, options?: zowe.IUploadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.pathToDataSet(this.getSession(), inputFilePath, dataSetName, options);
    }

    public async createDataSet(dataSetType: zowe.CreateDataSetTypeEnum, dataSetName: string, options?: Partial<zowe.ICreateDataSetOptions>
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSet(this.getSession(), dataSetType, dataSetName, options);
    }

    public async createDataSetMember(dataSetName: string, options?: zowe.IUploadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.bufferToDataSet(this.getSession(), Buffer.from(""), dataSetName, options);
    }

    public async allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSetLike(this.getSession(), dataSetName, likeDataSetName);
    }

    public async copyDataSetMember(
        { dataSetName: fromDataSetName, memberName: fromMemberName }: zowe.IDataSet,
        { dataSetName: toDataSetName, memberName: toMemberName }: zowe.IDataSet,
        options?: zowe.ICopyDatasetOptions
    ): Promise<zowe.IZosFilesResponse> {
        let newOptions: zowe.ICopyDatasetOptions;
        if (options) {
            if (options.fromDataSet) {
                newOptions = options;
            } else {
              newOptions = {...options, ...{fromDataSet: { dataSetName: fromDataSetName, memberName: fromMemberName }}};
            }
          } else {
            // If we decide to match 1:1 the Zowe.Copy.dataSet implementation, we will need to break the interface definition in the ZoweExploreApi
            newOptions = {fromDataSet: { dataSetName: fromDataSetName, memberName: fromMemberName }};
        }
        return zowe.Copy.dataSet(this.getSession(),
            { dataSetName: toDataSetName, memberName: toMemberName },
            newOptions
        );
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSet(this.getSession(), currentDataSetName, newDataSetName);
    }

    public async renameDataSetMember(dataSetName: string, oldMemberName: string, newMemberName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSetMember(this.getSession(), dataSetName, oldMemberName, newMemberName);
    }

    public async hMigrateDataSet(dataSetName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.HMigrate.dataSet(this.getSession(), dataSetName);
    }

    public async hRecallDataSet(dataSetName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.HRecall.dataSet(this.getSession(), dataSetName);
    }

    public async deleteDataSet(dataSetName: string, options?: zowe.IDeleteDatasetOptions
        ): Promise<zowe.IZosFilesResponse> {
            return zowe.Delete.dataSet(this.getSession(), dataSetName);
    }
}

/**
 * An implementation of the Zowe Explorer JES API interface for zOSMF.
 */
export class ZosmfJesApi extends ZosmfApiCommon implements ZoweExplorerApi.IJes {

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

    public deleteJob(jobname: string, jobid: string): Promise<void> {
        return zowe.DeleteJobs.deleteJob(this.getSession(), jobname, jobid);
    }
}
