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
import * as path from "path";
import * as crypto from "crypto";
import * as tmp from "tmp";
import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";

import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli/lib/api/doc/IZosFTPProfile";
import { FTPConfig } from "@zowe/zos-ftp-for-zowe-cli/lib/api/FTPConfig";
import { StreamUtils } from "@zowe/zos-ftp-for-zowe-cli/lib/api/StreamUtils";
import { CoreUtils } from "@zowe/zos-ftp-for-zowe-cli/lib/api/CoreUtils";

// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class FtpUssApi implements ZoweExplorerApi.IUss {
    private session?: imperative.Session;

    public constructor(public profile?: imperative.IProfileLoaded) {}

    public static getProfileTypeName(): string {
        return "zftp";
    }

    public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
        if (!this.session) {
            const ftpProfile = (profile || this.profile)?.profile;
            if (!ftpProfile) {
                throw new Error(
                    "Internal error: ZoweVscFtpUssRestApi instance was not initialized with a valid Zowe profile."
                );
            }
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
        return FtpUssApi.getProfileTypeName();
    }

    public async fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            const response: any[] = await connection.listDataset(ussFilePath);
            if (response) {
                result.success = true;
                result.apiResponse.items = response.map((element) => ({
                    name: element.name,
                    size: element.size,
                    mtime: element.lastModified,
                    mode: element.permissions,
                }));
            }
        }
        return result;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, require-await
    public async isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        return false; // TODO: needs to be implemented checking file type
    }

    public async getContents(
        ussFilePath: string,
        options: zowe.IDownloadOptions
    ): Promise<zowe.IZosFilesResponse> {
        const transferType = options.binary ? "binary" : "ascii";
        const targetFile = options.file;
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection && targetFile) {
            imperative.IO.createDirsSyncFromFilePath(targetFile);
            const contentStreamPromise = connection.getDataset(
                ussFilePath,
                transferType,
                true
            );
            const writable = fs.createWriteStream(targetFile);
            await StreamUtils.streamToStream(1, contentStreamPromise, writable);
            result.success = true;
            result.commandResponse = "";
            result.apiResponse.etag = await this.hashFile(targetFile);
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public async putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        const transferType = binary ? "binary" : "ascii";
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (!connection) {
            throw new Error(result.commandResponse);
        }
        // Save-Save with FTP requires loading the file first
        if (returnEtag && etag) {
            const tmpFileName = tmp.tmpNameSync();
            const options: zowe.IDownloadOptions = {
                binary,
                file: tmpFileName,
            };
            const loadResult = await this.getContents(ussFilePath, options);
            if (
                loadResult &&
                loadResult.success &&
                loadResult.apiResponse &&
                loadResult.apiResponse.etag &&
                loadResult.apiResponse.etag !== etag
            ) {
                // TODO: extension.ts should not check for zosmf errors.
                throw new Error("Rest API failure with HTTP(S) status 412");
            }
        }
        let content: Buffer = imperative.IO.readFileSync(
            inputFilePath,
            undefined,
            binary
        );
        if (!binary) {
            // if we're not in binary mode, we need carriage returns to avoid errors
            content = Buffer.from(CoreUtils.addCarriageReturns(content.toString()));
        }
        await connection.uploadDataset(content, ussFilePath, transferType);
        result.success = true;
        if (returnEtag) {
            result.apiResponse.etag = await this.hashFile(inputFilePath);
        }
        result.commandResponse = "File updated.";

        return result;
    }

    public async uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        let result = this.getDefaultResponse();

        // Check if inputDirectory is directory
        if (!imperative.IO.isDir(inputDirectoryPath)) {
            throw new Error("The local directory path provided does not exist.");
        }
        // getting list of files from directory
        const files = zowe.ZosFilesUtils.getFileListFromPath(
            inputDirectoryPath,
            false
        );
        // TODO: this solution will not perform very well; rewrite this and putContents methods
        for (const file of files) {
            const relativePath = path
                .relative(inputDirectoryPath, file)
                .replace(/\\/g, "/");
            const putResult = await this.putContents(
                file,
                path.posix.join(ussDirectoryPath, relativePath)
            );
            result = putResult;
        }
        return result;
    }

    public async create(
        ussPath: string,
        type: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        mode?: string
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection && connection.client) {
            if (type === "directory") {
                await connection.client.mkdir(ussPath);
            } else if (type === "file") {
                const content = Buffer.from(CoreUtils.addCarriageReturns(""));
                await connection.uploadDataset(content, ussPath, "ascii");
            }
            result.success = true;
            result.commandResponse = "Directory or file created.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public async delete(
        ussPath: string,
        recursive?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            if (recursive) {
                await this.deleteDirectory(ussPath, connection);
            } else {
                await connection.deleteDataset(ussPath);
            }
            result.success = true;
            result.commandResponse = "Delete completed.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public async rename(
        currentUssPath: string,
        newUssPath: string
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            await connection.rename(currentUssPath, newUssPath);
            result.success = true;
            result.commandResponse = "Rename completed.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    private async deleteDirectory(ussPath: string, connection: any): Promise<any> {
        const files = (await connection.listDataset(ussPath)) as any[];
        for (const file of files) {
            const filePath = path.join(ussPath, file.name);
            if (file.isDirectory) {
                await this.deleteDirectory(filePath, connection);
            } else {
                await connection.deleteDataset(filePath);
            }
        }
        await connection.deleteDataset(ussPath);
    }

    private getDefaultResponse(): zowe.IZosFilesResponse {
        return {
            success: false,
            commandResponse: "Could not get a valid FTP connection.",
            apiResponse: {},
        };
    }

    private checkedProfile(): imperative.IProfileLoaded {
        if (!this.profile?.profile) {
            throw new Error(
                "Internal error: ZoweVscFtpUssRestApi instance was not initialized with a valid Zowe profile."
            );
        }
        return this.profile;
    }

    private async ftpClient(profile: imperative.IProfileLoaded): Promise<any> {
        const ftpProfile = profile.profile as IZosFTPProfile;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await FTPConfig.connectFromArguments({
            host: ftpProfile.host,
            user: ftpProfile.user,
            password: ftpProfile.password,
            port: ftpProfile.port,
            secureFtp: ftpProfile.secureFtp,
        });
    }

    private async hashFile(filename: string): Promise<string> {
        return await new Promise((resolve) => {
            const hash = crypto.createHash("sha1");
            const input = fs.createReadStream(filename);
            input.on("readable", () => {
                const data = input.read();
                if (data) {
                    hash.update(data);
                } else {
                    resolve(`${hash.digest("hex")}`);
                }
            });
        });
    }
}
