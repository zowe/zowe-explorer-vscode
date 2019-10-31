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
 * Common interface shared between all API interfaces offered by this extension.
 */
export interface IZoweVscCommonApi {

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
 * @interface ZoweVscUssApi
 */
export interface IZoweVscUssApi extends IZoweVscCommonApi {

    /**
     * Return the directory elements for a given USS path
     *
     * @param {string} path
     * @returns {IZosFilesResponse}
     *     A response structure that contains a boolean success property
     *     as well as the list of results in apiResponse.items with
     *     minimal properties name, mode.
     * @memberof ZoweVscRestApi
     */
    fileList(session: imperative.Session, path: string): Promise<zowe.IZosFilesResponse>;

    /**
     * Create a new directory or file in the specified path
     *
     * @param {imperative.Session} session
     * @param {string} ussPath
     * @param {string} type
     * @param {string} [mode]
     * @returns {Promise<string>}
     * @memberof IZoweVscUssApi
     */
    create(session: imperative.Session, ussPath: string, type: string, mode?: string): Promise<string>;
}

// TODO
export interface IZoweVscMvsApi extends IZoweVscCommonApi {
    dataSet(session: imperative.Session, filter: string): Promise<zowe.IZosFilesResponse>;
    allMembers(session: imperative.Session, dataSetName: string): Promise<zowe.IZosFilesResponse>;
}
