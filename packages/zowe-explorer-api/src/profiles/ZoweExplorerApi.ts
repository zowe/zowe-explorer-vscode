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
import * as vscode from "vscode";
import { EventTypes, ProfilesCache } from "./ProfilesCache";
import { FileAttributes } from "../utils/files";

/**
 * This namespace provides interfaces for all the external APIs provided by this VS Code Extension.
 * Other VS Code Extension can implement these and use the IApiRegister interface to register themselves.
 */
export namespace ZoweExplorerApi {
    /**
     * Common interface shared between all API interfaces offered by this extension.
     * @export
     */
    export interface ICommon {
        /** The profile associated with a specific instance of an API.  */
        profile?: zowe.imperative.IProfileLoaded;

        /**
         * Return the type name of the CLI profile supported by this api.
         *
         * @returns {string} the type name as defined by a CLI plugin that implements the profile.
         */
        getProfileTypeName(): string;

        /**
         * Create a session for the specific profile type.
         *
         * @param {zowe.imperative.IProfileLoaded} profile
         *      optional profile reference,
         *      will use the profile the API was retrieved with by default
         * @returns {zowe.imperative.Session} a Zowe CLI Session
         */
        getSession(profile?: zowe.imperative.IProfileLoaded): zowe.imperative.Session;

        /**
         * Create a session for the specific profile type.
         *
         * @param {zowe.imperative.IProfileLoaded} profile
         *      will use the profile the API was retrieved with by default
         * @returns {IZosmfInfoResponse} z/OSMF Check Status response
         */
        getStatus?(profile: zowe.imperative.IProfileLoaded, profileType?): Promise<string>;

        /**
         * Create a session for a set command arguments. The session will be created independent
         * of a specific profile using a specific API implementation that was created with a
         * referece profile.
         *
         * @param {zowe.imperative.ICommandArguments} cmdArgs a Zowe CLI ICommandArguments instance
         * @returns {zowe.imperative.Session} a Zowe CLI Session
         */
        getSessionFromCommandArgument?(cmdArgs: zowe.imperative.ICommandArguments): zowe.imperative.Session;

        /**
         * Perform login to obtain a token from the authentication service
         *
         * @param {zowe.imperative.Session} session a Zowe CLI Session
         * @returns {string} the token value
         */
        login?(session: zowe.imperative.Session): Promise<string>;

        /**
         * Perform logout from the authentication service
         *
         * @param {zowe.imperative.Session} session a Zowe CLI Session
         */
        logout?(session: zowe.imperative.Session);

        /**
         * Return the type name of the token supported by this api.
         *
         * @returns {string} the token type name as defined by a CLI plugin that implements the profile.
         */
        getTokenTypeName?(): string;
    }

    /**
     * API for providing a USS API handler to the extension.
     * @export
     */
    export interface IUss extends ICommon {
        /**
         * Return the directory elements for a given USS path.
         *
         * @param {string} ussFilePath
         * @returns {IZosFilesResponse}
         *     A response structure that contains a boolean success property
         *     as well as the list of results in apiResponse.items with
         *     minimal properties name, mode.
         */
        fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Check th USS chtag to see if a file requires conversion.
         *
         * @param {string} ussFilePath
         * @returns {Promise<boolean>}
         */
        isFileTagBinOrAscii(ussFilePath: string): Promise<boolean>;
        /**
         * Copy operation for USS files or directories.
         *
         * @param {string} outputPath the output/destination path for the file/directory
         * @param {object} options Other options for the API endpoint
         * @returns {Promise<Buffer>}
         */
        copy?(outputPath: string, options?: Omit<object, "request">): Promise<Buffer>;

        /**
         * Retrieve the contents of a USS file.
         *
         * @param {string} ussFilePath
         * @param {zowe.IDownloadOptions} options
         */
        getContents(ussFilePath: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Uploads the file at the given path. Use for Save.
         *
         * @deprecated
         * @param {string} inputFilePath
         * @param {string} ussFilePath
         * @param {boolean} [binary]
         *      Indicates if a conversion should be attempted or treated as binary.
         * @param {string} [localEncoding]
         *      Optional encoding that can be used by an implementation to overwrite defaults
         * @param {string} [etag]
         * @param {boolean} [returnEtag]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        putContents(
            inputFilePath: string,
            ussFilePath: string,
            binary?: boolean,
            localEncoding?: string,
            etag?: string,
            returnEtag?: boolean
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Uploads the file at the given path. Use for Save.
         *
         * @param {string} inputFilePath
         * @param {string} ussFilePath
         * @param {zowe.IUploadOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        putContent?(inputFilePath: string, ussFilePath: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Updates attributes for a USS directory or file.
         *
         * @param ussPath The USS path of the directory or file to update
         * @param attributes The attributes that should be updated
         */
        updateAttributes?(ussPath: string, attributes: Partial<FileAttributes>): Promise<zowe.IZosFilesResponse>;
        /**
         * Uploads directory at the given path.
         *
         * @param {string} inputDirectoryPath
         * @param {string} ussDirectoryPath
         * @param {IUploadOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, options: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Create a new directory or file in the specified path.
         *
         * @param {string} ussPath
         * @param {string} type
         *      Either "file" or "directory".
         * @param {string} [mode]
         *      An optional Unix string representation of the permissions.
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Deletes the USS directory or file at the given path.
         *
         * @param {string} ussPath
         * @param {boolean} [recursive]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse>;

        /**
         * Rename a file or directory.
         *
         * @param {string} currentUssPath
         * @param {string} newUssPath
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Get the tag of a USS file
         *
         * @param {string} currentUssPath
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        getTag?(ussPath: string): Promise<string>;
    }

    /**
     * API for providing am MVS API handler to the extension.
     * @export
     */
    export interface IMvs extends ICommon {
        /**
         * Get a list of data sets that match the filter pattern.
         *
         * @param {string} filter
         * @param {zowe.IListOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        dataSet(filter: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Get a list of members for a partitioned data set.
         *
         * @param {string} dataSetName
         * @param {zowe.IListOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        allMembers(dataSetName: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Get the contents of a data set or member specified by name.
         *
         * @param {string} dataSetName
         * @param {zowe.IDownloadOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        getContents(dataSetName: string, options?: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Upload the content of a file to a data set or member.
         *
         * @param {string} inputFilePath
         * @param {string} dataSetName
         * @param {zowe.IUploadOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        putContents(inputFilePath: string, dataSetName: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Create a new data set with the specified options.
         *
         * @param {zowe.CreateDataSetTypeEnum} dataSetType
         * @param {string} dataSetName
         * @param {Partial<zowe.ICreateDataSetOptions>} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        createDataSet(
            dataSetType: zowe.CreateDataSetTypeEnum,
            dataSetName: string,
            options?: Partial<zowe.ICreateDataSetOptions>
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Creates an empty data set member with given name.
         *
         * @param {string} dataSetName
         * @param {zowe.IUploadOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        createDataSetMember(dataSetName: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Allocates a copy of a data set with the specified options.
         *
         * @param {zowe.CreateDataSetTypeEnum} dataSetType
         * @param {string} dataSetName
         * @param {Partial<zowe.ICreateDataSetOptions>} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Copies a data set member.
         *
         * @param {zowe.IDataSet} { dataSetName: fromDataSetName, memberName: fromMemberName }
         * @param {zowe.IDataSet} { dataSetName: toDataSetName, memberName: toMemberName }
         * @param {{replace?: boolean}} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        copyDataSetMember(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: Renamed variable is not unused
            { dsn: fromDataSetName, member: fromMemberName }: zowe.IDataSet,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: Renamed variable is not unused
            { dsn: toDataSetName, member: toMemberName }: zowe.IDataSet,
            options?: { replace?: boolean }
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Renames a data set.
         *
         * @param {string} currentDataSetName
         * @param {string} newDataSetName
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Renames a data set member.
         *
         * @param {string} dataSetName
         * @param {string} currentMemberName
         * @param {string} newMemberName
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        renameDataSetMember(dataSetName: string, currentMemberName: string, newMemberName: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Migrates a data set.
         *
         * @param {string} dataSetName
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        hMigrateDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Recalls a data set.
         *
         * @param {string} dataSetName
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        hRecallDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse>;

        /**
         * Deletes a data set or data set member.
         *
         * @param {string} dataSetName
         * @param {zowe.IDeleteDatasetOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        deleteDataSet(dataSetName: string, options?: zowe.IDeleteDatasetOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Get a list of data sets that match the filter pattern.
         *
         * @param {string} filter
         * @param {zowe.IDsmListOptions} [options]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        dataSetsMatchingPattern?(filter: string[], options?: zowe.IDsmListOptions): Promise<zowe.IZosFilesResponse>;

        /**
         * Copies a dataSet.
         *
         * @param {string} fromDataSetName
         * @param {string} toDataSetName
         * @param {string?} enq possible values : {SHR, SHRW, EXCLU}
         * @param {boolean?} replace
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        copyDataSet?(fromDataSetName: string, toDataSetName: string, enq?: string, replace?: boolean): Promise<zowe.IZosFilesResponse>;
    }

    /**
     * API for providing am JES API handler to the extension.
     * @export
     */
    export interface IJes extends ICommon {
        /**
         * Returns a list of jobs for any parameters.
         *
         * @param {string} owner
         * @returns {Promise<zowe.IJob[]>} an array if IJob
         */
        getJobsByParameters?(params: zowe.IGetJobsParms): Promise<zowe.IJob[]>;

        /**
         * Returns a list of jobs for a specific user and prefix.
         *
         * @deprecated Use getJobsByParameters
         * @param {string} owner
         * @param {string} prefix
         * @returns {Promise<zowe.IJob[]>} an array if IJob
         */
        getJobsByOwnerAndPrefix(owner: string, prefix: string): Promise<zowe.IJob[]>;

        /**
         * Returns meta-data for one specific job identified by id.
         *
         * @param {string} jobid
         * @returns {Promise<zowe.IJob>}
         */
        getJob(jobid: string): Promise<zowe.IJob>;

        /**
         * Returns spool file meta-data for a job.
         *
         * @param {string} jobname
         * @param {string} jobid
         * @returns {Promise<zowe.IJobFile[]>}
         */
        getSpoolFiles(jobname: string, jobid: string): Promise<zowe.IJobFile[]>;

        /**
         * Retrieves content for all spool files as specified in the parms
         * to be store in a file.
         *
         * @param {zowe.IDownloadAllSpoolContentParms} parms
         * @returns {Promise<void>}
         */
        downloadSpoolContent(parms: zowe.IDownloadAllSpoolContentParms): Promise<void>;

        /**
         * Retrieves a single spool file content as specified in the parms
         * to be store in a file.
         *
         * @param {zowe.IDownloadSpoolContentParms} parms
         * @returns {Promise<void>}
         */
        downloadSingleSpool?(parms: zowe.IDownloadSpoolContentParms): Promise<void>;

        /**
         * Returns spool file content as a string.
         *
         * @param {string} jobname
         * @param {string} jobid
         * @param {number} spoolId
         * @returns {Promise<string>}
         */
        getSpoolContentById(jobname: string, jobid: string, spoolId: number): Promise<string>;

        /**
         * Returns the JCL of a job as a string.
         *
         * @param {zowe.IJob} job
         * @returns {Promise<string>}
         */
        getJclForJob(job: zowe.IJob): Promise<string>;

        /**
         * Submits a job with the JCL provided returning job meta-data.
         *
         * @param {string} jcl string of JCL that you want to be submit
         * @param {string} [internalReaderRecfm] record format of the jcl you want to submit. "F" (fixed) or "V" (variable)
         * @param {string} [internalReaderLrecl] logical record length of the jcl you want to submit
         * @returns {Promise<zowe.IJob>} IJob document with details about the submitted job
         */
        submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<zowe.IJob>;

        /**
         * Submits a job that is stored in the data set name provided returning job meta-data.
         *
         * @param {string} jobDataSet
         * @returns {Promise<zowe.IJob>}
         * @memberof IJes
         */
        submitJob(jobDataSet: string): Promise<zowe.IJob>;

        /**
         * Cancels the job provided.
         *
         * @param {zowe.IJob} job The job object to cancel
         * @returns {Promise<boolean>} Whether the job was successfully cancelled
         * @memberof IJes
         */
        cancelJob?(job: zowe.IJob): Promise<boolean>;

        /**
         * Cancels and purges a job identified by name and id.
         *
         * @param {string} jobname
         * @param {string} jobid
         * @returns {Promise<void>}
         * @memberof IJes
         */
        deleteJob(jobname: string, jobid: string): Promise<void>;

        /**
         * Cancels and purges a job identified by name and id.
         * This version returns information about the status of the job
         *
         * @param {string} jobname
         * @param {string} jobid
         * @returns {Promise<undefined | zowe.IJobFeedback>}
         * @memberof IJes
         */
        deleteJobWithInfo?(jobname: string, jobid: string): Promise<undefined | zowe.IJobFeedback>;
    }
    /**
     * API for providing a Command API handler to the extension.
     * @export
     */
    export interface ICommand extends ICommon {
        /**
         * Issues a TSO Command and returns a TsoSend API response.
         *
         * @deprecated Use issueTsoCommandWithParms
         * @param {string} command
         * @param {string} acctNum
         * @returns {zowe.IIssueResponse>}
         * @memberof ICommand
         */
        issueTsoCommand?(command: string, acctNum?: string): Promise<zowe.IIssueResponse>;

        /**
         * Issues a TSO Command and returns a TsoSend API response.
         *
         * @param {string} command
         * @param {zowe.IStartTsoParms} parms
         * @returns {zowe.IIssueResponse>}
         * @memberof ICommand
         */
        issueTsoCommandWithParms?(command: string, parms?: zowe.IStartTsoParms): Promise<zowe.IIssueResponse>;

        /**
         * Issues a MVS Command and returns a Console Command API response.
         *
         * @param {string} command
         * @returns {zowe.IConsoleResponse>}
         * @memberof ICommand
         */
        issueMvsCommand?(command: string): Promise<zowe.IConsoleResponse>;
    }

    /**
     * This interface can be used by other VS Code Extensions to access an alternative
     * profile types that can be employed in conjunction with the primary profile to provide
     * alternative support.
     *
     */
    export interface IApiExplorerExtender {
        /**
         * Allows extenders access to the profiles loaded into Zowe Explorer.
         * This includes profiles of other extenders. Called reloadProfiles()
         * in case other extensions might have registered themselves before accessing.
         * See the ProfilesCache class for the available accessors. When making changes
         * to the profile in this cache remember that it shared with Zowe Explorer and
         * all other Zowe Explorer extensions
         * @version 1.18 or newer of Zowe Explorer
         * @returns {ProfilesCache}
         */
        getProfilesCache(): ProfilesCache;

        /**
         * After an extenders registered all its API extensions it
         * might want to request that profiles should get reloaded
         * to make them automatically appears in the Explorer drop-
         * down dialogs.
         */
        reloadProfiles(profileType?: string): Promise<void>;

        /**
         * After an extenders registered all its API extensions it
         * might want to check for an existing profile folder with meta-file
         * or to create them automatically if it is non-existant.
         */
        initForZowe(type: string, profileTypeConfigurations?: zowe.imperative.ICommandProfileTypeConfiguration[]): Promise<void>;
    }

    /**
     * This interface can be used by other VS Code Extensions to register themselves
     * with additional API implementations. The other extension would implement one or
     * more interfaces above, for example MyZoweExplorerAppUssApi, and register it with
     * the object returned by this extensions activate() method as shown below.
     *
     * @example
     * // see if Zowe Explorer is installed and retrieve the API Registry\
     * const explorerApi = extensions.getExtension('zowe.vscode-extension-for-zowe');\
     * if (explorerApi && explorerApi.exports) {\
     *   // Cast the returned object to the IApiRegisterClient interface\
     *   const importedApi: ZoweExplorerApi.IApiRegisterClient = explorerApi.exports;\
     *   // create an instance of my API and register it with Zowe Explorer\
     *   importedApi.registerUssApi(new MyZoweExplorerAppUssApi());\
     *   window.showInformationMessage(\
     *     'Zowe Explorer was augmented for MyApp support. Please, refresh your explorer views.');\
     *   } else {\
     *   window.showInformationMessage(\
     *     'Zowe VS Extension was not found: either not installe or older version.');\
     * }
     *
     * @export
     */
    export interface IApiRegisterClient {
        /**
         * Register a new implementation of the USS Api.
         * See example in Interface docs.
         *
         * @param {IUss} ussApi
         */
        registerUssApi(ussApi: IUss): void;

        /**
         * Lookup of an API for USS for a given profile.
         * @param {zowe.imperative.IProfileLoaded} profile
         * @returns the registered API instance for the given profile
         */
        getUssApi(profile: zowe.imperative.IProfileLoaded): IUss;

        /**
         * Register a new implementation of the MVS Api.
         * See example in Interface docs.
         *
         * @param {IMvs} mvsApi
         */
        registerMvsApi(mvsApi: IMvs): void;

        /**
         * Lookup of an API for MVS for a given profile.
         * @param {string} profile
         * @returns the registered API instance
         */
        getMvsApi(profile: zowe.imperative.IProfileLoaded): IMvs;

        /**
         * Register a new implementation of the JES Api.
         * See example in Interface docs.
         *
         * @param {IJes} jesApi
         */
        registerJesApi(jesApi: IJes): void;

        /**
         * Lookup of an API for JES for a given profile.
         * @param {string} profile
         * @returns the registered API instance
         */
        getJesApi(profile: zowe.imperative.IProfileLoaded): IJes;

        /**
         * Register a new implementation of the Command Api.
         * See example in Interface docs.
         *
         * @param {ICommand} commandApi
         */
        registerCommandApi(CommandApi: ICommand): void;

        /**
         * Lookup of an API for Issuing a Command for a given profile.
         * @param {string} profile
         * @returns the registered API instance
         */
        getCommandApi(profile: zowe.imperative.IProfileLoaded): ICommand;

        /**
         * Lookup of an API for the generic extender API.
         * @returns the registered API instance
         */
        getExplorerExtenderApi(): IApiExplorerExtender;

        /**
         * Get an array of all the registered APIs identified by the CLI profile type names,
         * such as ["zosmf", "zftp"].
         * @returns {string[]}
         */
        registeredApiTypes(): string[];

        /**
         * Define events that fire whenever an existing team config profile is updated.
         */
        onProfilesUpdate?: vscode.Event<EventTypes>;
    }
}
