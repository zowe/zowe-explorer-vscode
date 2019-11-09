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
        /**
         * Return the type name of the CLI profile supported by this api.
         */
        getProfileTypeName(): string;

        /**
         * Create a session for the specific profile type
         * @param profile {imperative.IProfile} profile reference
         * @returns {imperative.Session} a Zowe CLI Session reference
         */
        createSession(profile: imperative.IProfile): imperative.Session;
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
            session: imperative.Session,
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
            session: imperative.Session,
            USSFileName: string
        ): Promise<boolean>;

        /**
         * Retrieve the contents of a USS file.
         * @param {imperative.Session} session
         * @param {string} ussFileName
         * @param {zowe.IDownloadOptions} options
         */
        getContents(
            session: imperative.Session,
            ussFileName: string,
            options: zowe.IDownloadOptions
        ): Promise<zowe.IZosFilesResponse> ;

        /**
         * Uploads the files at the given path. Use for Save.
         *
         * @param {imperative.Session} session
         * @param {string} inputFile
         * @param {string} ussname
         * @param {boolean} [binary]
         * @param {string} [localEncoding]
         * @returns {Promise<zowe.IZosFilesResponse>}
         */
        putContents(
            session: imperative.Session,
            inputFile: string,
            ussname: string,
            binary?: boolean,
            localEncoding?: string
        ): Promise<zowe.IZosFilesResponse>;

        /**
         * Create a new directory or file in the specified path.
         *
         * @param {imperative.Session} session
         * @param {string} ussPath
         * @param {string} type
         * @param {string} [mode]
         * @returns {Promise<string>}
         */
        create(
            session: imperative.Session,
            ussPath: string,
            type: string,
            mode?: string
        ): Promise<string>;

        /**
         * Deletes the USS file at the given path.
         *
         * @param {imperative.Session} session
         * @param {string} fileName
         * @param {boolean} [recursive]
         * @returns {Promise<zowe.IZosFilesResponse>}
         * @memberof IUss
         */
        delete(
            session: imperative.Session,
            fileName: string,
            recursive?: boolean): Promise<zowe.IZosFilesResponse>;
    }

    // TODO
    export interface IMvs extends ICommon {
        dataSet(
            session: imperative.Session,
            filter: string
        ): Promise<zowe.IZosFilesResponse>;
        allMembers(
            session: imperative.Session,
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
