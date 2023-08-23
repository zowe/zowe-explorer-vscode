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

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as tmp from "tmp";
import * as zowe from "@zowe/cli";
import { IUploadOptions } from "@zowe/zos-files-for-zowe-sdk";

import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { CoreUtils, UssUtils, TRANSFER_TYPE_ASCII, TRANSFER_TYPE_BINARY } from "@zowe/zos-ftp-for-zowe-cli";
import { Buffer } from "buffer";
import { AbstractFtpApi } from "./ZoweExplorerAbstractFtpApi";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";

// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class FtpUssApi extends AbstractFtpApi implements ZoweExplorerApi.IUss {
    public async fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const session = this.getSession(this.profile);
        try {
            if (session.ussListConnection === undefined || session.ussListConnection.connected === false) {
                session.ussListConnection = await this.ftpClient(this.checkedProfile());
            }

            if (session.ussListConnection.connected === true) {
                const response = await UssUtils.listFiles(session.ussListConnection, ussFilePath);
                if (response) {
                    result.success = true;
                    result.apiResponse.items = response.map((element) => ({
                        name: element.name,
                        user: element.owner,
                        group: element.group,
                        size: element.size,
                        mtime: element.lastModified,
                        mode: element.permissions,
                    }));
                }
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await, require-await
    public async isFileTagBinOrAscii(_ussFilePath: string): Promise<boolean> {
        return false; // TODO: needs to be implemented checking file type
    }

    public async getContents(ussFilePath: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const targetFile = options.file;
        const transferOptions = {
            transferType: options.binary ? TRANSFER_TYPE_BINARY : TRANSFER_TYPE_ASCII,
            localFile: targetFile,
            size: 1,
        };
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection && targetFile) {
                zowe.imperative.IO.createDirsSyncFromFilePath(targetFile);
                await UssUtils.downloadFile(connection, ussFilePath, transferOptions);
                result.success = true;
                result.commandResponse = "";
                result.apiResponse.etag = await this.hashFile(targetFile);
            } else {
                throw new Error(result.commandResponse);
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    /**
     * Upload a file (located at the input path) to the destination path.
     * @param inputFilePath The input file path
     * @param ussFilePath The destination file path on USS
     * @param options Any options for the upload
     *
     * @returns A file response containing the results of the operation.
     */
    public putContent(inputFilePath: string, ussFilePath: string, options?: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
        return this.putContents(inputFilePath, ussFilePath, options?.binary, options?.localEncoding, options?.etag, options?.returnEtag);
    }

    /**
     * Upload a file (located at the input path) to the destination path.
     *
     * @deprecated in favor of `putContent`
     * @param inputFilePath The input file path
     * @param ussFilePath The destination file path on USS
     * @param binary Whether the contents are binary
     * @param localEncoding The local encoding for the file
     * @param etag The e-tag associated with the file on the mainframe (optional)
     * @param returnEtag Whether to return the e-tag after uploading the file
     *
     * @returns A file response containing the results of the operation.
     */
    public async putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        const transferOptions = {
            transferType: binary ? TRANSFER_TYPE_BINARY : TRANSFER_TYPE_ASCII,
            localFile: inputFilePath,
        };
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (!connection) {
                throw new Error(result.commandResponse);
            }
            // Save-Save with FTP requires loading the file first
            if (returnEtag && etag) {
                const contentsTag = await this.getContentsTag(ussFilePath);
                if (contentsTag && contentsTag !== etag) {
                    throw new Error("Rest API failure with HTTP(S) status 412 Save conflict.");
                }
            }
            await UssUtils.uploadFile(connection, ussFilePath, transferOptions);

            result.success = true;
            if (returnEtag) {
                const contentsTag = await this.getContentsTag(ussFilePath);
                result.apiResponse.etag = contentsTag;
            }
            result.commandResponse = "File uploaded successfully.";

            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, _options: IUploadOptions): Promise<zowe.IZosFilesResponse> {
        let result = this.getDefaultResponse();
        try {
            // Check if inputDirectory is directory
            if (!zowe.imperative.IO.isDir(inputDirectoryPath)) {
                throw new ZoweFtpExtensionError("The local directory path provided does not exist.");
            }

            // Make directory before copying inner files
            await this.putContent(inputDirectoryPath, ussDirectoryPath);

            // getting list of files from directory
            const files = zowe.ZosFilesUtils.getFileListFromPath(inputDirectoryPath, false);
            // TODO: this solution will not perform very well; rewrite this and putContents methods
            for (const file of files) {
                const relativePath = path.relative(inputDirectoryPath, file).replace(/\\/g, "/");
                const putResult = await this.putContent(file, path.posix.join(ussDirectoryPath, relativePath));
                result = putResult;
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        }
    }

    public async create(ussPath: string, type: string, _mode?: string): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                if (type === "directory") {
                    await UssUtils.makeDirectory(connection, ussPath);
                } else if (type === "File" || type === "file") {
                    const content = Buffer.from(CoreUtils.addCarriageReturns(""));
                    const transferOptions = {
                        transferType: TRANSFER_TYPE_ASCII,
                        content: content,
                    };
                    await UssUtils.uploadFile(connection, ussPath, transferOptions);
                }
                result.success = true;
                result.commandResponse = "Directory or file created.";
            } else {
                throw new Error(result.commandResponse);
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                if (recursive) {
                    await this.deleteDirectory(ussPath, connection);
                } else {
                    await UssUtils.deleteFile(connection, ussPath);
                }
                result.success = true;
                result.commandResponse = "Delete completed.";
            } else {
                throw new Error(result.commandResponse);
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await UssUtils.renameFile(connection, currentUssPath, newUssPath);
                result.success = true;
                result.commandResponse = "Rename completed.";
            } else {
                throw new Error(result.commandResponse);
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    private async deleteDirectory(ussPath: string, connection): Promise<void> {
        const result = this.getDefaultResponse();
        try {
            connection = await this.ftpClient(this.checkedProfile());
            await UssUtils.deleteDirectory(connection, ussPath);
            result.success = true;
            result.commandResponse = "Delete Completed";
        } finally {
            this.releaseConnection(connection);
        }
    }

    private async getContentsTag(ussFilePath: string): Promise<string> {
        const tmpFileName = tmp.tmpNameSync();
        const options: zowe.IDownloadOptions = {
            binary: false,
            file: tmpFileName,
        };
        const loadResult = await this.getContents(ussFilePath, options);
        const etag: string = loadResult.apiResponse.etag;
        return etag;
    }

    private getDefaultResponse(): zowe.IZosFilesResponse {
        return {
            success: false,
            commandResponse: "Could not get a valid FTP connection.",
            apiResponse: {},
        };
    }

    private hashFile(filename: string): Promise<string> {
        return new Promise((resolve) => {
            const hash = crypto.createHash("sha1");
            const input = fs.createReadStream(filename);
            input.on("readable", () => {
                const data = input.read();
                if (data) {
                    hash.update(data as unknown as crypto.BinaryLike);
                } else {
                    resolve(`${hash.digest("hex")}`);
                }
            });
        });
    }
}
