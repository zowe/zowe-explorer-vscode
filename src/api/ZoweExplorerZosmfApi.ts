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
import { Session, IProfileLoaded, ITaskWithStatus, ICommandArguments, ISession, ConnectionPropsForSessCfg } from "@zowe/imperative";
import { ZoweExplorerApi } from "./ZoweExplorerApi";
import * as nls from "vscode-nls";
// import { getValidSession } from "../profiles/utils";
import { errorHandling } from "../utils";
import { DefaultProfileManager } from "../profiles/DefaultProfileManager";
import { collectProfileDetails } from "../profiles/utils";

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

    public async getSession(profile?: IProfileLoaded): Promise<Session> {
        if (!this.session) {
            this.session = await this.getValidSession((profile||this.profile), (profile||this.profile).name, false);
        }
        return this.session;
    }

    public async getValidSession(serviceProfile: IProfileLoaded,
                                 profileName: string,
                                 prompt?: boolean): Promise<Session | null> {

        // Retrieve baseProfile
        const baseProfile = DefaultProfileManager.getInstance().getDefaultProfile("base");

        // If user exists in serviceProfile, use serviceProfile to login because it has precedence over baseProfile
        // If no user & no baseProfile, use serviceProfile as default
        // If no user & no token, use serviceProfile as default
        if (serviceProfile.profile.user || !baseProfile || (!serviceProfile.profile.user && !serviceProfile.profile.basePath)) {
            if (prompt) {
                // Select for prompting only fields which are not defined
                const schemaArray = [];
                if (!serviceProfile.profile.user && (!baseProfile || (baseProfile && !baseProfile.profile.user))) {
                    if (!serviceProfile.profile.basePath) {
                        schemaArray.push("user");
                    }
                }
                if (!serviceProfile.profile.password && (!baseProfile || (baseProfile && !baseProfile.profile.password))) {
                    schemaArray.push("password");
                }
                if (!serviceProfile.profile.host && (!baseProfile || (baseProfile && !baseProfile.profile.host))) {
                    schemaArray.push("hostname");
                    if (!serviceProfile.profile.port && (!baseProfile || (baseProfile && !baseProfile.profile.port))) { schemaArray.push("port"); }
                }

                try {
                    const newDetails = await collectProfileDetails(schemaArray, null, null);
                    for (const detail of schemaArray) {
                        if (detail === "hostname") { serviceProfile.profile.host = newDetails[detail]; }
                        else { serviceProfile.profile[detail] = newDetails[detail]; }
                        }
                } catch (error) {
// tslint:disable:no-magic-numbers
// if (error.mDetails && error.mDetails.errorCode === 401) {
//     if (globals.ISTHEIA) {
//         vscode.window.showErrorMessage(error.message);
//         this.getValidSession(serviceProfile, serviceProfile.name, true);
//     } else {
//         vscode.window.showErrorMessage(error.message, "Check Credentials").then(async (selection) => {
//             if (selection) {
//                 delete serviceProfile.profile.user;
//                 delete serviceProfile.profile.password;
//                 await this.getValidSession(serviceProfile, serviceProfile.name, true);
//             }
//         });
//     }
// } else { throw error; }
                await errorHandling(error);
            }
        }
            const cmdArgs: ICommandArguments = {
                $0: "zowe",
                _: [""],
                host: serviceProfile.profile.host ? serviceProfile.profile.host :
                (baseProfile ? baseProfile.profile.host : undefined),
                port: serviceProfile.profile.port ? serviceProfile.profile.port :
                (baseProfile ? baseProfile.profile.port : 0),
                basePath: serviceProfile.profile.basePath ? serviceProfile.profile.basePath :
                (baseProfile ? baseProfile.profile.basePath : undefined),
                rejectUnauthorized: serviceProfile.profile.rejectUnauthorized !== null ?
                serviceProfile.profile.rejectUnauthorized :
                (baseProfile ? baseProfile.profile.rejectUnauthorized : true),
                user: serviceProfile.profile.user ? serviceProfile.profile.user :
                (baseProfile ? baseProfile.profile.user : undefined),
                password: serviceProfile.profile.password ? serviceProfile.profile.password :
                (baseProfile ? baseProfile.profile.password : undefined),
                tokenType: "apimlAuthenticationToken",
                tokenValue: (baseProfile && !serviceProfile.profile.password) ? baseProfile.profile.tokenValue : undefined
            };
            return zowe.ZosmfSession.createBasicZosmfSessionFromArguments(cmdArgs);
        } else if (baseProfile) {
            // baseProfile exists, so APIML login is possible
            const sessCfg = {
            rejectUnauthorized: (serviceProfile.profile.rejectUnauthorized != null ? serviceProfile.profile.rejectUnauthorized :
            baseProfile.profile.rejectUnauthorized),
            basePath: serviceProfile.profile.basePath,
            hostname: serviceProfile.profile.host ? serviceProfile.profile.host : baseProfile.profile.host,
            port: serviceProfile.profile.port ? serviceProfile.profile.port : baseProfile.profile.port,
        };

            const cmdArgs: ICommandArguments = {
            $0: "zowe",
            _: [""],
            tokenType: "apimlAuthenticationToken",
            tokenValue: baseProfile.profile.tokenValue
        };

            try {
            let connectableSessCfg: ISession;
            if (prompt) {
                connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg,
                cmdArgs,
            {
            requestToken: false,
            doPrompting: prompt,
            getValuesBack: collectProfileDetails
            });
        } else {
        connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg,
        cmdArgs,
        { requestToken: false, doPrompting: false });
    }

            return new Session(connectableSessCfg);
        } catch (error) {
// tslint:disable:no-magic-numbers
// if (error.mDetails && error.mDetails.errorCode === 401) {
//     if (globals.ISTHEIA) {
//         vscode.window.showErrorMessage(error.message);
//         this.getValidSession(serviceProfile, serviceProfile.name, true);
//     } else {
//         vscode.window.showErrorMessage(error.message, "Check Credentials").then(async (selection) => {
//             if (selection) {
//                 delete serviceProfile.profile.user;
//                 delete serviceProfile.profile.password;
//                 await this.getValidSession(serviceProfile, serviceProfile.name, true);
//             }
//         });
//     }
// } else { throw error; }
        await errorHandling(error);
        }
    } else {
    // Neither baseProfile nor serviceProfile exists. It is impossible to login with the currently-provided information.
    throw new Error(localize("getValidSession.loginImpossible",
    "Profile {0} is invalid. Please check your login details and try again.", profileName));
    }
}

    public async getStatus(validateProfile?: IProfileLoaded, profileType?: string, prompt?: boolean): Promise<string> {
        // This API call is specific for z/OSMF profiles
        if (profileType === "zosmf") {
            try {
                const validateSession = await this.getValidSession(validateProfile, validateProfile.name, prompt);
                let sessionStatus;
                if (validateSession) { sessionStatus = await zowe.CheckStatus.getZosmfInfo(validateSession); }

                if (sessionStatus) {
                    // Store the valid connection details in the profile
                    Object.keys(validateProfile.profile).forEach((profileKey) => {
                        Object.keys(validateSession.ISession).forEach((sessionKey) => {
                            if (profileKey === sessionKey && !validateProfile.profile[profileKey]) {
                                validateProfile.profile[profileKey] = validateSession.ISession[sessionKey];
                            }
                            if (profileKey === "host" && sessionKey === "hostname" && !validateProfile.profile[profileKey]) {
                                validateProfile.profile[profileKey] = validateSession.ISession[sessionKey];
                            }
                        });
                    });
                    return "active";
                } else {
                    return "inactive";
                }
            } catch (err) {
                throw new Error(err);
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
        return zowe.List.fileList(await this.getSession(), ussFilePath);
    }

    public async isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        return zowe.Utilities.isFileTagBinOrAscii(await this.getSession(), ussFilePath);
    }

    public async getContents(inputFilePath: string, options: zowe.IDownloadOptions
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.ussFile(await this.getSession(), inputFilePath, options);
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
        return zowe.Upload.fileToUssFile(await this.getSession(), inputFilePath, ussFilePath, options);
    }

    public async uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        options?: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.dirToUSSDirRecursive(await this.getSession(), inputDirectoryPath, ussDirectoryPath, options
        );
    }

    public async create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.uss(await this.getSession(), ussPath, type);
    }

    public async delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        // handle zosmf api issue with file paths
        const fixedName = ussPath.startsWith("/") ?  ussPath.substring(1) :  ussPath;
        return zowe.Delete.ussFile(await this.getSession(), fixedName, recursive);
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        const result = await zowe.Utilities.renameUSSFile(await this.getSession(), currentUssPath, newUssPath);
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
        return zowe.List.dataSet(await this.getSession(), filter, options);
    }

    public async allMembers(dataSetName: string, options?: zowe.IListOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.List.allMembers(await this.getSession(), dataSetName, options);
    }

    public async getContents(dataSetName: string, options?: zowe.IDownloadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.dataSet(await this.getSession(), dataSetName, options);
    }

    public async putContents(inputFilePath: string, dataSetName: string, options?: zowe.IUploadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.pathToDataSet(await this.getSession(), inputFilePath, dataSetName, options);
    }

    public async createDataSet(dataSetType: zowe.CreateDataSetTypeEnum, dataSetName: string, options?: Partial<zowe.ICreateDataSetOptions>
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSet(await (this.getSession()), dataSetType, dataSetName, options);
    }

    public async createDataSetMember(dataSetName: string, options?: zowe.IUploadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.bufferToDataSet(await this.getSession(), Buffer.from(""), dataSetName, options);
    }

    public async allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Create.dataSetLike(await this.getSession(), dataSetName, likeDataSetName);
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
        return zowe.Copy.dataSet(await this.getSession(),
            { dataSetName: toDataSetName, memberName: toMemberName },
            newOptions
        );
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSet(await this.getSession(), currentDataSetName, newDataSetName);
    }

    public async renameDataSetMember(dataSetName: string, oldMemberName: string, newMemberName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSetMember(await this.getSession(), dataSetName, oldMemberName, newMemberName);
    }

    public async hMigrateDataSet(dataSetName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.HMigrate.dataSet(await this.getSession(), dataSetName);
    }

    public async hRecallDataSet(dataSetName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.HRecall.dataSet(await this.getSession(), dataSetName);
    }

    public async deleteDataSet(dataSetName: string, options?: zowe.IDeleteDatasetOptions
        ): Promise<zowe.IZosFilesResponse> {
            return zowe.Delete.dataSet(await this.getSession(), dataSetName);
    }
}

/**
 * An implementation of the Zowe Explorer JES API interface for zOSMF.
 */
export class ZosmfJesApi extends ZosmfApiCommon implements ZoweExplorerApi.IJes {

    public async getJobsByOwnerAndPrefix(owner: string, prefix: string): Promise<zowe.IJob[]> {
        return zowe.GetJobs.getJobsByOwnerAndPrefix(await this.getSession(), owner, prefix);
    }

    public async getJob(jobid: string): Promise<zowe.IJob> {
        return zowe.GetJobs.getJob(await this.getSession(), jobid);
    }

    public async getSpoolFiles(jobname: string, jobid: string): Promise<zowe.IJobFile[]> {
        return zowe.GetJobs.getSpoolFiles(await this.getSession(), jobname, jobid);
    }

    public async downloadSpoolContent(parms: zowe.IDownloadAllSpoolContentParms): Promise<void> {
        return zowe.DownloadJobs.downloadAllSpoolContentCommon(await this.getSession(), parms);
    }

    public async getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string> {
        return zowe.GetJobs.getSpoolContentById(await this.getSession(), jobname, jobid, spoolId);
    }

    public async getJclForJob(job: zowe.IJob): Promise<string> {
        return zowe.GetJobs.getJclForJob(await this.getSession(), job);
    }

    public async submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<zowe.IJob> {
        return zowe.SubmitJobs.submitJcl(await this.getSession(), jcl, internalReaderRecfm, internalReaderLrecl);
    }

    public async submitJob(jobDataSet: string): Promise<zowe.IJob> {
        return zowe.SubmitJobs.submitJob(await this.getSession(), jobDataSet);
    }

    public async deleteJob(jobname: string, jobid: string): Promise<void> {
        return zowe.DeleteJobs.deleteJob(await this.getSession(), jobname, jobid);
    }
}
