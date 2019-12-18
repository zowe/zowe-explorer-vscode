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
import * as crypto from "crypto";
import * as zowe from "@brightside/core";
import * as imperative from "@brightside/imperative";

import { ZoweVscApi } from "./IZoweVscRestApis";
// tslint:disable: no-submodule-imports
import { IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli/lib/api/doc/IZosFTPProfile";
import { FTPConfig } from "@zowe/zos-ftp-for-zowe-cli/lib/api/FTPConfig";
import { StreamUtils } from "@zowe/zos-ftp-for-zowe-cli/lib/api/StreamUtils";
import { CoreUtils } from "@zowe/zos-ftp-for-zowe-cli/lib/api/CoreUtils";

export class ZoweVscFtpUssRestApi implements ZoweVscApi.IUss {

    private session: imperative.Session;
    constructor(public profile?: imperative.IProfileLoaded) {
    }

    public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
        if (!this.session) {
            const ftpProfile = (profile||this.profile).profile;
            this.session = new imperative.Session({
                hostname: ftpProfile.host,
                port: ftpProfile.port,
                user: ftpProfile.user,
                password: ftpProfile.password,
                rejectUnauthorized: ftpProfile.rejectUnauthorized,
            });
        }
        return this.session;
    }

    public getProfileTypeName(): string {
        return "zftp";
    }

    public async fileList(path: string): Promise<zowe.IZosFilesResponse> {
        const connection = await this.ftpClient(this.profile);
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

    public async isFileTagBinOrAscii(USSFileName: string): Promise<boolean> {
        return false; // TODO: needs to be implemented checking file type
    }

    public async getContents(ussFileName: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        const transferType = options.binary ? "binary" : "ascii";
        const targetFile = options.file;
        const result: zowe.IZosFilesResponse = {
            success: false,
            commandResponse: "",
            apiResponse: {}
        };

        // TODO: waiting for merge of bug fix: https://github.com/zowe/zowe-cli-ftp-plugin/issues/23
        const connection = await this.ftpClient(this.profile);
        if (connection) {
            imperative.IO.createDirsSyncFromFilePath(targetFile);
            const contentStreamPromise = connection.getDataset(ussFileName, transferType, true);
            const writable = fs.createWriteStream(targetFile);
            await StreamUtils.streamToStream(1, contentStreamPromise, writable);
            result.success = true;
            result.apiResponse.etag = await this.hashFile(targetFile);
        }
        return result;
    }

    public async putContents(
        inputFile: string, ussname: string, binary?: boolean, localEncoding?: string,
        etag?: string, returnEtag?: boolean): Promise<zowe.IZosFilesResponse> {

        const transferType = binary ? "binary" : "ascii";
        const result: zowe.IZosFilesResponse = {
            success: false,
            commandResponse: "",
            apiResponse: {}
        };

        let content: Buffer = imperative.IO.readFileSync(inputFile, undefined, binary);
        if (!binary) {
            // if we're not in binary mode, we need carriage returns to avoid errors
            content = Buffer.from(CoreUtils.addCarriageReturns(content.toString()));
        }
        const connection = await this.ftpClient(this.profile);
        if (connection) {
            // TODO: get file and check etag
            await connection.uploadDataset(content, ussname, transferType);
            result.success = true;
        }
        return result;
    }

    public async create(ussPath: string, type: string, mode?: string): Promise<string> {
        return undefined;
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

    private async ftpClient(profile: imperative.IProfileLoaded): Promise<any> {
        const ftpProfile = profile.profile as IZosFTPProfile;
        return FTPConfig.connectFromArguments({
            host: ftpProfile.host,
            user: ftpProfile.user,
            password: ftpProfile.password,
            port: ftpProfile.port,
            secureFtp: ftpProfile.secureFtp
        });
    }

    private async hashFile(filename: string): Promise<string> {
        try {
            const hash = crypto.createHash("sha1");
            const input = fs.createReadStream(filename);
            await input.on("readable", () => {
                // Only one element is going to be produced by the
                // hash stream.
                const data = input.read();
                if (data) {
                    hash.update(data);
                } else {
                    return;
                }
            });
            return `${hash.digest("hex")}`;
        }
        catch (err) {
            return "not-available";
        }
    }
}
