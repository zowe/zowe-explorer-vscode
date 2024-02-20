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

import * as imperative from "@zowe/imperative";
import * as zosconsole from "@zowe/zos-console-for-zowe-sdk";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import * as zostso from "@zowe/zos-tso-for-zowe-sdk";
import * as zosuss from "@zowe/zos-uss-for-zowe-sdk";
import { Types } from "../Types";

export namespace MainframeInteraction {
    export interface ICommon {
        /** The profile associated with a specific instance of an API.  */
        profile?: imperative.IProfileLoaded;

        /**
         * Return the type name of the CLI profile supported by this api.
         *
         * @returns {string} the type name as defined by a CLI plugin that implements the profile.
         */
        getProfileTypeName(): string;

        /**
         * Create a session for the specific profile type.
         *
         * @param {imperative.IProfileLoaded} profile
         *      optional profile reference,
         *      will use the profile the API was retrieved with by default
         * @returns {imperative.Session} a Zowe CLI Session
         */
        getSession(profile?: imperative.IProfileLoaded): imperative.Session;

        /**
         * Create a session for the specific profile type.
         *
         * @param {imperative.IProfileLoaded} profile
         *      will use the profile the API was retrieved with by default
         * @returns {IZosmfInfoResponse} z/OSMF Check Status response
         */
        getStatus?(profile: imperative.IProfileLoaded, profileType?): Promise<string>;

        /**
         * Create a session for a set command arguments. The session will be created independent
         * of a specific profile using a specific API implementation that was created with a
         * referece profile.
         *
         * @param {imperative.ICommandArguments} cmdArgs a Zowe CLI ICommandArguments instance
         * @returns {imperative.Session} a Zowe CLI Session
         */
        getSessionFromCommandArgument?(cmdArgs: imperative.ICommandArguments): imperative.Session;

        /**
         * Perform login to obtain a token from the authentication service
         *
         * @param {imperative.Session} session a Zowe CLI Session
         * @returns {string} the token value
         */
        login?(session: imperative.Session): Promise<string>;

        /**
         * Perform logout from the authentication service
         *
         * @param {imperative.Session} session a Zowe CLI Session
         */
        logout?(session: imperative.Session);

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
        fileList(ussFilePath: string): Promise<zosfiles.IZosFilesResponse>;

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
         * @param {zosfiles.IDownloadOptions} options
         */
        getContents(ussFilePath: string, options: zosfiles.IDownloadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Uploads the file at the given path. Use for Save.
         *
         * @param {string} inputFilePath
         * @param {string} ussFilePath
         * @param {zosfiles.IUploadOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        putContent(inputFilePath: string, ussFilePath: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Updates attributes for a USS directory or file.
         *
         * @param ussPath The USS path of the directory or file to update
         * @param attributes The attributes that should be updated
         */
        updateAttributes?(ussPath: string, attributes: Partial<Types.FileAttributes>): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Uploads directory at the given path.
         *
         * @param {string} inputDirectoryPath
         * @param {string} ussDirectoryPath
         * @param {IUploadOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, options: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Create a new directory or file in the specified path.
         *
         * @param {string} ussPath
         * @param {string} type
         *      Either "file" or "directory".
         * @param {string} [mode]
         *      An optional Unix string representation of the permissions.
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        create(ussPath: string, type: string, mode?: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Deletes the USS directory or file at the given path.
         *
         * @param {string} ussPath
         * @param {boolean} [recursive]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        delete(ussPath: string, recursive?: boolean): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Rename a file or directory.
         *
         * @param {string} currentUssPath
         * @param {string} newUssPath
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        rename(currentUssPath: string, newUssPath: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Get the tag of a USS file
         *
         * @param {string} ussPath
         * @returns {Promise<zosfiles.IZosFilesResponse>}
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
         * @param {zosfiles.IListOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        dataSet(filter: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Get a list of members for a partitioned data set.
         *
         * @param {string} dataSetName
         * @param {zosfiles.IListOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        allMembers(dataSetName: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Get the contents of a data set or member specified by name.
         *
         * @param {string} dataSetName
         * @param {zosfiles.IDownloadOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        getContents(dataSetName: string, options?: zosfiles.IDownloadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Upload the content of a file to a data set or member.
         *
         * @param {string} inputFilePath
         * @param {string} dataSetName
         * @param {zosfiles.IUploadOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        putContents(inputFilePath: string, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Create a new data set with the specified options.
         *
         * @param {zosfiles.CreateDataSetTypeEnum} dataSetType
         * @param {string} dataSetName
         * @param {Partial<zosfiles.ICreateDataSetOptions>} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        createDataSet(
            dataSetType: zosfiles.CreateDataSetTypeEnum,
            dataSetName: string,
            options?: Partial<zosfiles.ICreateDataSetOptions>
        ): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Creates an empty data set member with given name.
         *
         * @param {string} dataSetName
         * @param {zosfiles.IUploadOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        createDataSetMember(dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Allocates a copy of a data set with the specified options.
         *
         * @param {zosfiles.CreateDataSetTypeEnum} dataSetType
         * @param {string} dataSetName
         * @param {Partial<zosfiles.ICreateDataSetOptions>} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Copies a data set member.
         *
         * @param {zosfiles.IDataSet} { dataSetName: fromDataSetName, memberName: fromMemberName }
         * @param {zosfiles.IDataSet} { dataSetName: toDataSetName, memberName: toMemberName }
         * @param {{replace?: boolean}} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        copyDataSetMember(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: Renamed variable is not unused
            { dsn: fromDataSetName, member: fromMemberName }: zosfiles.IDataSet,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: Renamed variable is not unused
            { dsn: toDataSetName, member: toMemberName }: zosfiles.IDataSet,
            options?: { replace?: boolean }
        ): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Renames a data set.
         *
         * @param {string} currentDataSetName
         * @param {string} newDataSetName
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Renames a data set member.
         *
         * @param {string} dataSetName
         * @param {string} currentMemberName
         * @param {string} newMemberName
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        renameDataSetMember(dataSetName: string, currentMemberName: string, newMemberName: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Migrates a data set.
         *
         * @param {string} dataSetName
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        hMigrateDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Recalls a data set.
         *
         * @param {string} dataSetName
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        hRecallDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Deletes a data set or data set member.
         *
         * @param {string} dataSetName
         * @param {zosfiles.IDeleteDatasetOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        deleteDataSet(dataSetName: string, options?: zosfiles.IDeleteDatasetOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Get a list of data sets that match the filter pattern.
         *
         * @param {string} filter
         * @param {zosfiles.IDsmListOptions} [options]
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        dataSetsMatchingPattern?(filter: string[], options?: zosfiles.IDsmListOptions): Promise<zosfiles.IZosFilesResponse>;

        /**
         * Copies a dataSet.
         *
         * @param {string} fromDataSetName
         * @param {string} toDataSetName
         * @param {string?} enq possible values : {SHR, SHRW, EXCLU}
         * @param {boolean?} replace
         * @returns {Promise<zosfiles.IZosFilesResponse>}
         */
        copyDataSet?(fromDataSetName: string, toDataSetName: string, enq?: string, replace?: boolean): Promise<zosfiles.IZosFilesResponse>;
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
         * @returns {Promise<zosjobs.IJob[]>} an array if IJob
         */
        getJobsByParameters?(params: zosjobs.IGetJobsParms): Promise<zosjobs.IJob[]>;

        /**
         * Returns meta-data for one specific job identified by id.
         *
         * @param {string} jobid
         * @returns {Promise<zosjobs.IJob>}
         */
        getJob(jobid: string): Promise<zosjobs.IJob>;

        /**
         * Returns spool file meta-data for a job.
         *
         * @param {string} jobname
         * @param {string} jobid
         * @returns {Promise<zosjobs.IJobFile[]>}
         */
        getSpoolFiles(jobname: string, jobid: string): Promise<zosjobs.IJobFile[]>;

        /**
         * Retrieves content for all spool files as specified in the parms
         * to be store in a file.
         *
         * @param {zosjobs.IDownloadAllSpoolContentParms} parms
         * @returns {Promise<void>}
         */
        downloadSpoolContent(parms: zosjobs.IDownloadAllSpoolContentParms): Promise<void>;

        /**
         * Retrieves a single spool file content as specified in the parms
         * to be store in a file.
         *
         * @param {zosjobs.IDownloadSpoolContentParms} parms
         * @returns {Promise<void>}
         */
        downloadSingleSpool?(parms: zosjobs.IDownloadSpoolContentParms): Promise<void>;

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
         * @param {zosjobs.IJob} job
         * @returns {Promise<string>}
         */
        getJclForJob(job: zosjobs.IJob): Promise<string>;

        /**
         * Submits a job with the JCL provided returning job meta-data.
         *
         * @param {string} jcl string of JCL that you want to be submit
         * @param {string} [internalReaderRecfm] record format of the jcl you want to submit. "F" (fixed) or "V" (variable)
         * @param {string} [internalReaderLrecl] logical record length of the jcl you want to submit
         * @returns {Promise<zosjobs.IJob>} IJob document with details about the submitted job
         */
        submitJcl(jcl: string, internalReaderRecfm?: string, internalReaderLrecl?: string): Promise<zosjobs.IJob>;

        /**
         * Submits a job that is stored in the data set name provided returning job meta-data.
         *
         * @param {string} jobDataSet
         * @returns {Promise<zosjobs.IJob>}
         * @memberof IJes
         */
        submitJob(jobDataSet: string): Promise<zosjobs.IJob>;

        /**
         * Cancels the job provided.
         *
         * @param {zosjobs.IJob} job The job object to cancel
         * @returns {Promise<boolean>} Whether the job was successfully cancelled
         * @memberof IJes
         */
        cancelJob?(job: zosjobs.IJob): Promise<boolean>;

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
         * @returns {Promise<undefined | zosjobs.IJobFeedback>}
         * @memberof IJes
         */
        deleteJobWithInfo?(jobname: string, jobid: string): Promise<undefined | zosjobs.IJobFeedback>;
    }
    /**
     * API for providing a Command API handler to the extension.
     * @export
     */
    export interface ICommand extends ICommon {
        /**
         * Issues a TSO Command and returns a TsoSend API response.
         *
         * @param {string} command
         * @param {zostso.IStartTsoParms} parms
         * @returns {zostso.IIssueResponse}
         * @memberof ICommand
         */
        issueTsoCommandWithParms?(command: string, parms?: zostso.IStartTsoParms): Promise<zostso.IIssueResponse>;

        /**
         * Issues a MVS Command and returns a Console Command API response.
         *
         * @param {string} command
         * @returns {zosconsole.IConsoleResponse}
         * @memberof ICommand
         */
        issueMvsCommand?(command: string): Promise<zosconsole.IConsoleResponse>;

        /**
         * Issues a Unix Command and returns a Console Command API response.
         *
         * @param {string} command
         * @param {string} cwd
         * @param {boolean} flag
         * @returns {string>}
         * @memberof ICommand
         */
        issueUnixCommand?(sshSession: zosuss.SshSession, command: string, cwd: string, flag: boolean): Promise<string>;
        sshProfileRequired?(): boolean;
    }
}
