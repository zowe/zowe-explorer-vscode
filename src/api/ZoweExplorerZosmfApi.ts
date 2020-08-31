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
import { SessConstants, ICommandArguments, ConnectionPropsForSessCfg, IProfile, ISession, Session, IProfileLoaded, ITaskWithStatus } from "@zowe/imperative";
import { ZoweExplorerApi } from "./ZoweExplorerApi";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { errorHandling } from "../utils";
import { DefaultProfileManager } from "../profiles/DefaultProfileManager";

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
            this.session = await this.getValidSession((profile||this.profile), (profile||this.profile).name, null, false);
        }
        return this.session;
    }

    public async getStatus(validateProfile?: IProfileLoaded, profileType?: string): Promise<string> {
        // This API call is specific for z/OSMF profiles
        if (profileType === "zosmf") {
            const validateSession = await (this.getValidSession(validateProfile,
                                                                validateProfile.name,
                                                                DefaultProfileManager.getInstance().getDefaultProfile("base").profile,
                                                                false));
            let sessionStatus;
            if (validateSession) { sessionStatus = await zowe.CheckStatus.getZosmfInfo(validateSession); }

            if (sessionStatus) {
                return "active";
            } else {
                return "inactive";
            }
        } else {
            return "unverified";
        }
    }

    public async getValidSession(serviceProfile: IProfileLoaded, profileName: string, baseProfile?: IProfile, prompt?: boolean) {
        // Retrieve baseProfile
        if (!baseProfile) {
            baseProfile = DefaultProfileManager.getInstance().getDefaultProfile("base").profile;
        }

        // If user exists in serviceProfile, use serviceProfile to login because it has precedence over baseProfile
        if (serviceProfile.profile.user) {
            if (prompt) {
                // Select for prompting only fields which are not defined
                const schemaArray = [];
                if (!serviceProfile.profile.password && (baseProfile && !baseProfile.password)) { schemaArray.push("password"); }
                if (!serviceProfile.profile.host && (baseProfile && !baseProfile.host)) {
                    schemaArray.push("host");
                    if (!serviceProfile.profile.port && (baseProfile && !baseProfile.port)) { schemaArray.push("port"); }
                    if (!serviceProfile.profile.basePath) { schemaArray.push("basePath"); }
                }

                try {
                    const newDetails = await this.collectProfileDetails(schemaArray);
                    for (const detail of schemaArray) { serviceProfile.profile[detail] = newDetails[detail]; }
                } catch (error) { await errorHandling(error.message); }
            }
            // if (!serviceProfile.profile.user) { delete serviceProfile.profile.user; }
            if (!serviceProfile.profile.password) { delete serviceProfile.profile.password; }
            try { return zowe.ZosmfSession.createBasicZosmfSession(serviceProfile.profile); }
            catch (error) { throw new Error(error.message); }
        } else if (baseProfile) {
            // baseProfile exists, so APIML login is possible
            const sessCfg = {
                rejectUnauthorized: serviceProfile.profile.rejectUnauthorized ? serviceProfile.profile.rejectUnauthorized :
                                                                                baseProfile.rejectUnauthorized,
                basePath: serviceProfile.profile.basePath,
                hostname: serviceProfile.profile.host ? serviceProfile.profile.host : baseProfile.host,
                port: serviceProfile.profile.port ? serviceProfile.profile.port : baseProfile.port,
            };

            const cmdArgs: ICommandArguments = {
                $0: "zowe",
                _: [""],
                tokenType: SessConstants.TOKEN_TYPE_APIML,
                tokenValue: baseProfile.tokenValue
            };

            try {
                let connectableSessCfg: ISession;
                if (prompt) {
                    connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg, cmdArgs,
                                                                                                    { requestToken: false,
                                                                                                      doPrompting: prompt,
                                                                                                      getValuesBack: this.collectProfileDetails });
                } else {
                    connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg, cmdArgs,
                                                                                                    { requestToken: false, doPrompting: false });
                }

                return new Session(connectableSessCfg);
            } catch (error) {
                await errorHandling(error.message); }
        } else {
            // No baseProfile exists, nor a user in serviceProfile. It is impossible to login with the currently-provided information.
            throw new Error(localize("getValidSession.loginImpossible",
                                     "Profile {0} is invalid. Please check your login details and try again.", profileName));
        }
    }

    public async collectProfileDetails(detailsToGet?: string[]): Promise<any> {
        let newUrl: any;
        let newPort: number;
        let newUser: string;
        let newPass: string;
        let newRU: boolean;
        const schemaValues: any = {};

        const profileType = await this.getProfileTypeName();
        if (!profileType) { throw new Error(localize("collectProfileDetails.profileTypeMissing",
                                                     "No profile type was chosen. Operation Cancelled")); }
        schemaValues.type = profileType;

        // Go through array of schema for input values
        for (const profileDetail of detailsToGet) {
            switch (profileDetail) {
                case "host" :
                    const hostOptions: vscode.InputBoxOptions = {
                        ignoreFocusOut: true,
                        placeHolder: localize("collectProfileDetails.option.prompt.url.placeholder", "Optional: https://url:port"),
                        prompt: localize("collectProfileDetails.option.prompt.url", "Enter a z/OS URL in the format 'https://url:port'."),
                        validateInput: (value) => {
                            const validationResult = {
                                valid: false,
                                protocol: null,
                                host: null,
                                port: null
                            };

                            // Check that the URL is valid
                            try { newUrl = new URL(value); }
                            catch (error) { return localize("collectProfileDetails.invalidzosURL", "Please enter a valid host URL in the format 'https://url:port'."); }

                            if (value === "https://") {
                                // User did not enter a host/port
                                validationResult.host = "";
                                validationResult.port = 0;
                                validationResult.valid = true;
                                newUrl = validationResult;
                            } else {
                                // User would like to store host/port
                                validationResult.port = Number(newUrl.port);
                                validationResult.host = newUrl.hostname;
                                validationResult.valid = true;
                                newUrl = validationResult;
                            }

                            return null;
                        }
                    };

                    newUrl = await vscode.window.showInputBox(hostOptions);
                    if (!newUrl) {
                        throw new Error(localize("collectProfileDetails.zosmfURL", "No valid value for z/OS URL. Operation Cancelled"));
                    } else {
                        newUrl = new URL(newUrl);
                        schemaValues[profileDetail] = (newUrl.host ? newUrl.host : newUrl.host.substring(0, (newUrl.host.indexOf(`:`))));
                        if (newUrl.port !== 0) { schemaValues.port = Number(newUrl.port); }
                    }
                    break;
                case "port" :
                    if (schemaValues[profileDetail] === 0) {
                        const portOptions: vscode.InputBoxOptions = {
                            ignoreFocusOut: true,
                            validateInput: (value) => {
                                if (Number.isNaN(Number(value))) {
                                    return localize("collectProfileDetails.invalidPort", "Please enter a valid port number");
                                } else { return null; }
                            }
                        };

                        let port;
                        const portFromUser = await vscode.window.showInputBox(portOptions);
                        if (Number.isNaN(Number(portFromUser))) {
                            throw new Error(localize("collectProfileDetails.undefined.port",
                                                     "Invalid Port number provided or operation was cancelled"));
                        } else { port = Number(portFromUser); }

                        if (schemaValues.host === "") { port = 0; }

                        schemaValues[profileDetail] = newPort = port;
                        break;
                    }
                    break;
                case "user":
                    const userOptions = {
                        placeHolder: localize("collectProfileDetails.option.prompt.username.placeholder", "Optional: User Name"),
                        prompt: localize("collectProfileDetails.option.prompt.username", "Enter the user name for the connection."),
                        ignoreFocusOut: true,
                        validateInput: (value) => {
                            if (value === undefined || value.trim() === undefined) {
                                return localize("collectProfileDetails.invalidUser", "Please enter a valid username");
                            } else { return null; }
                        }
                    };

                    newUser = await vscode.window.showInputBox(userOptions);
                    if (!newUser) {
                        vscode.window.showInformationMessage(localize("collectProfileDetails.undefined.username", "No username defined."));
                        newUser = null;
                    }
                    schemaValues[profileDetail] = newUser;
                    break;
                case "password" :
                    const passOptions = {
                        placeHolder: localize("collectProfileDetails.option.prompt.password.placeholder", "Optional: Password"),
                        prompt: localize("collectProfileDetails.option.prompt.password", "Enter the password for the connection."),
                        password: true,
                        ignoreFocusOut: true,
                        validateInput: (value) => {
                            if (value === undefined || value.trim() === undefined) {
                                return localize("collectProfileDetails.invalidUser", "Please enter a valid password");
                            } else { return null; }
                        }
                    };

                    newPass = await vscode.window.showInputBox(passOptions);
                    if (!newPass) {
                        vscode.window.showInformationMessage(localize("collectProfileDetails.undefined.password", "No password defined."));
                        newPass = null;
                    }
                    schemaValues[profileDetail] = newPass;
                    break;
                case "rejectUnauthorized" :
                    const quickPickOptions: vscode.QuickPickOptions = {
                        placeHolder: localize("collectProfileDetails.option.prompt.ru.placeholder", "Reject Unauthorized Connections"),
                        ignoreFocusOut: true,
                        canPickMany: false
                    };
                    const ruOptions = ["True - Reject connections with self-signed certificates",
                                    "False - Accept connections with self-signed certificates"];

                    const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);

                    if (chosenRU === ruOptions[0]) { newRU = true; }
                    else if (chosenRU === ruOptions[1]) { newRU = false; }
                    else {
                        throw new Error(localize("collectProfileDetails.rejectUnauthorize", "No certificate option selected. Operation Cancelled"));
                    }

                    schemaValues[profileDetail] = newRU;
                    break;
            }
        }

        return schemaValues;
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
        let a = await this.getSession();
        let response = zowe.List.dataSet(a, filter, options);
        return response;
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
        return zowe.Create.dataSet(await this.getSession(), dataSetType, dataSetName, options);
    }

    public async createDataSetMember(dataSetName: string, options?: zowe.IUploadOptions
        ): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.bufferToDataSet(await this.getSession(), Buffer.from(""), dataSetName, options);
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

    public async renameDataSetMember(currentMemberName: string, newMemberName: string, afterMemberName: string,
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Rename.dataSetMember(await this.getSession(), currentMemberName, newMemberName, afterMemberName);
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
