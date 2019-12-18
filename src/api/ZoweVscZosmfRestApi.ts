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

import { ZoweVscApi } from "./IZoweVscRestApis";

// tslint:disable: max-classes-per-file

class ZoweVscZosmfCommon implements ZoweVscApi.ICommon {
    private session: imperative.Session;
    constructor(public profile?: imperative.IProfileLoaded) {
    }

    public getProfileTypeName(): string {
        return "zosmf";
    }

    public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
        if (!this.session) {
            this.session = zowe.ZosmfSession.createBasicZosmfSession((profile||this.profile).profile);
        }
        return this.session;
    }
}
export class ZoweVscZosmfUssRestApi extends ZoweVscZosmfCommon implements ZoweVscApi.IUss {

    public async fileList(path: string): Promise<zowe.IZosFilesResponse> {
        return zowe.List.fileList(this.getSession(), path);
    }

    public async isFileTagBinOrAscii(USSFileName: string): Promise<boolean> {
        return zowe.Utilities.isFileTagBinOrAscii(this.getSession(), USSFileName);
    }

    public async getContents(ussFileName: string, options: zowe.IDownloadOptions
    ): Promise<zowe.IZosFilesResponse> {
        return zowe.Download.ussFile(this.getSession(), ussFileName, options);
    }

    public async putContents(inputFile: string, ussname: string,
                             binary?: boolean, localEncoding?: string,
                             etag?: string, returnEtag?: boolean): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.fileToUSSFile(this.getSession(), inputFile, ussname, binary, localEncoding, etag, returnEtag);
    }
    public async create(ussPath: string, type: string, mode?: string): Promise<string> {
        return zowe.Create.uss(this.getSession(), ussPath, type);
    }

    public async delete(fileName: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        return zowe.Delete.ussFile(this.getSession(), fileName, recursive);
    }

    public async rename(oldFilePath: string, newFilePath: string): Promise<zowe.IZosFilesResponse> {
        const result = await zowe.Utilities.renameUSSFile(this.getSession(), oldFilePath, newFilePath);
        return {
            success: true,
            commandResponse: null,
            apiResponse: result
        };
    }
}

export class ZoweVscZosmfMvsRestApi extends ZoweVscZosmfCommon implements ZoweVscApi.IMvs {

    public async dataSet(filter: string): Promise<zowe.IZosFilesResponse>{
        return undefined;
    }

    public async allMembers(dataSetName: string): Promise<zowe.IZosFilesResponse> {
        return undefined;
    }
}
