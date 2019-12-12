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

import * as fs from "fs";
import * as zowe from "@brightside/core";  // import the ftp plugin REST API instead
import * as imperative from "@brightside/imperative";

import { ZoweVscApi } from "./IZoweVscRestApis";
// tslint:disable: no-submodule-imports
import { IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli/lib/api/doc/IZosFTPProfile";
import { FTPConfig } from "@zowe/zos-ftp-for-zowe-cli/lib/api/FTPConfig";
import { StreamUtils } from "@zowe/zos-ftp-for-zowe-cli/lib/api/StreamUtils";

export class ZoweVscFtpUssRestApi implements ZoweVscApi.IUss {

    public getProfileTypeName(): string {
        return "zftp";
    }

    public createSession(profile: imperative.IProfile): imperative.Session {
        // TODO: need to deal with ftpProfile.secureFtp
        if (profile) {
            const ftpProfile = profile as IZosFTPProfile;
            return new imperative.Session({
                hostname: ftpProfile.host,
                port: ftpProfile.port,
                user: ftpProfile.user,
                password: ftpProfile.password,
                rejectUnauthorized: ftpProfile.rejectUnauthorized,
            });
        }
        return undefined;
    }

    public async fileList(session: imperative.Session, path: string): Promise<zowe.IZosFilesResponse> {
        const connection = await this.ftpClient(session.ISession);
        const response: any[] = await connection.listDataset(path);

        const result: zowe.IZosFilesResponse = {
            success: false,
            commandResponse: "",
            apiResponse: { items: [] }
        };
        if (response) {
            result.success = true;
            result.apiResponse.items = response.map(
                (element) => ({
                    name: element.name,
                    size: element.size,
                    mtime: element.lastModified,
                    mode: element.permissions
                })
            );
        }
        return result;

    }

    public async isFileTagBinOrAscii(session: imperative.Session, USSFileName: string): Promise<boolean> {
        return false; // TODO: needs to be implemented in FTP CLI Plugin or here
    }

    public async getContents(session: imperative.Session, ussFileName: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        const transferType = options.binary ? "binary" : "ascii";
        const targetFile = options.file;
        const connection = await this.ftpClient(session.ISession);

        const contentStreamPromise = connection.getDataset(ussFileName, transferType, true);
        const writable = fs.createWriteStream(targetFile);
        await StreamUtils.streamToStream(1, contentStreamPromise, writable);

        const result: zowe.IZosFilesResponse = {
            success: true,
            commandResponse: "",
            apiResponse: { items: [] }
        };
        return result;
    }

    public async putContents(session: imperative.Session, inputFile: string, ussname: string,
                             binary?: boolean, localEncoding?: string): Promise<zowe.IZosFilesResponse> {
        return zowe.Upload.fileToUSSFile(session, inputFile, ussname, binary, localEncoding);
    }

    public async create(session: imperative.Session, ussPath: string, type: string, mode?: string): Promise<string> {
        return undefined;
    }

    public async delete(session: imperative.Session, fileName: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        return zowe.Delete.ussFile(session, fileName, recursive);
    }

    public async rename(session: imperative.Session, oldFilePath: string, newFilePath: string): Promise<zowe.IZosFilesResponse> {
        const result = await zowe.Utilities.renameUSSFile(session, oldFilePath, newFilePath);
        return {
            success: true,
            commandResponse: null,
            apiResponse: result
        };
    }

    private async ftpClient(session: imperative.ISession): Promise<any> {
        return FTPConfig.connectFromArguments({
            host: session.hostname,
            user: session.user,
            password: session.password,
            port: session.port,
            secureFtp: false
        });
    }
}
