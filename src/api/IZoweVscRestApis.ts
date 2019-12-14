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

import * as zowe from "@brightside/core";
import * as imperative from "@brightside/imperative";

/**
 * This namespace provides interfaces for all the external APIs provided by this VS Code Extension.
 * Other VS Code Extension can implement these and use the IApiRegister interface to register themselves.
 */
export namespace ZoweVscApi {
    /**
     * Common interface shared between all API interfaces offered by this extension.
     */
    export interface ICommon {

        /** The profile associated with a specific instance of an API.  */
        profile?: imperative.IProfileLoaded;

        /**
         * Return the type name of the CLI profile supported by this api.
         */
        getProfileTypeName(): string;

        /**
         * Create a session for the specific profile type
         * @param profile {imperative.IProfileLoaded} profile reference
         * @returns {imperative.Session} a Zowe CLI Session reference
         */
        getSession(profile?: imperative.IProfileLoaded): imperative.Session;
    }

    /**
     * API for providing a USS Rest handler to the extension.
     * @export
     * @interface IUss
     */
    export interface IUss extends ICommon {
        /**
         * Return the directory elements for a given USS path.
         *
         * @param {string} path
         * @returns {IZosFilesResponse}
         *     A response structure that contains a boolean success property
         *     as well as the list of results in apiResponse.items with
         *     minimal properties name, mode.
         */
        fileList(
            path: string
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Check th USS chtag.
         *
         * @param {imperative.Session} session
         * @param {string} USSFileName
         * @returns {Promise<boolean>}
         */
        isFileTagBinOrAscii(
            USSFileName: string
        ): Promise<boolean>;

        /**
         * Retrieve the contents of a USS file.
         * @param {string} ussFileName
         * @param {zowe.IDownloadOptions} options
         */
        getContents(
            ussFileName: string,
            options: zowe.IDownloadOptions
        ): Promise<zowe.IZosFilesResponse> ;

        /**
         * Uploads the files at the given path. Use for Save.
         *
         * @param {string} inputFile
         * @param {string} ussname
         * @param {boolean} [binary]
         * @param {string} [localEncoding]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        putContents(
            inputFile: string,
            ussname: string,
            binary?: boolean,
            localEncoding?: string,
            etag?: string,
            returnEtag?: boolean
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Create a new directory or file in the specified path.
         *
         * @param {string} ussPath
         * @param {string} type
         * @param {string} [mode]
         * @returns {Promise<string>}
         */
        create(
            ussPath: string,
            type: string,
            mode?: string
        ): Promise<string>;

        /**
         * Deletes the USS file at the given path.
         *
         * @param {string} fileName
         * @param {boolean} [recursive]
         * @returns {Promise<zowe.IZosFilesResponse>}
         * @memberof IUss
         */
        delete(
            fileName: string,
            recursive?: boolean
        ): Promise<zowe.IZosFilesResponse>;

        rename(
            oldFilePath: string,
            newFilePath: string
        ): Promise<zowe.IZosFilesResponse>;
    }

    // TODO
    export interface IMvs extends ICommon {
        dataSet(
            filter: string
        ): Promise<zowe.IZosFilesResponse>;
        allMembers(
            dataSetName: string
        ): Promise<zowe.IZosFilesResponse>;
    }

    export interface IApiRegister {

        /**
         * Register a new implementation of the USS Api.
         *
         * @param {IUss} ussApi
         * @memberof IZoweVscApiRegister
         */
        registerUssApi(ussApi: IUss): void;

        /**
         * Lookup of an API for USS for a given profile.
         * @private
         * @param {string} profileType
         * @returns
         * @memberof ZoweVscApiRegister
         */
        getUssApi(profile: imperative.IProfileLoaded): IUss;
    }
}
