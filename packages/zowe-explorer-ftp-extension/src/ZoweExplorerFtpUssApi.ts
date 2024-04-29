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
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";

import { CoreUtils, UssUtils, TransferMode } from "@zowe/zos-ftp-for-zowe-cli";
import { BufferBuilder, imperative, MainframeInteraction, MessageSeverity } from "@zowe/zowe-explorer-api";
import { Buffer } from "buffer";
import { AbstractFtpApi } from "./ZoweExplorerAbstractFtpApi";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";
import { LOGGER } from "./globals";

// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class FtpUssApi extends AbstractFtpApi implements MainframeInteraction.IUss {
    public async fileList(ussFilePath: string): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const session = this.getSession(this.profile);
        try {
            if (!session.ussListConnection?.isConnected()) {
                session.ussListConnection = await this.ftpClient(this.checkedProfile());
            }

            if (session.ussListConnection.isConnected()) {
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

    public async getContents(ussFilePath: string, options: zosfiles.IDownloadSingleOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const transferOptions = {
            transferType: CoreUtils.getBinaryTransferModeOrDefault(options.binary),
            localFile: undefined,
            size: 1,
        };
        const fileOrStreamSpecified = options.file != null || options.stream != null;
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (!connection || !fileOrStreamSpecified) {
                LOGGER.logImperativeMessage(result.commandResponse, MessageSeverity.ERROR);
                throw new Error(result.commandResponse);
            }
            if (options.file) {
                imperative.IO.createDirsSyncFromFilePath(options.file);
                await UssUtils.downloadFile(connection, ussFilePath, transferOptions);
                result.success = true;
                result.commandResponse = "";
                result.apiResponse.etag = await this.hashFile(options.file);
            } else if (options.stream) {
                const buffer = await UssUtils.downloadFile(connection, ussFilePath, transferOptions);
                result.apiResponse.etag = this.hashBuffer(buffer);
                options.stream.write(buffer);
                options.stream.end();
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    /**
     * Uploads a USS file from the given buffer.
     * @param buffer The buffer containing the contents of the USS file
     * @param filePath The path for the USS file
     * @param options Any options for the upload
     *
     * @returns A file response with the results of the upload operation.
     */
    public async uploadFromBuffer(buffer: Buffer, filePath: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = await this.putContent(buffer, filePath, options);
        return result;
    }

    /**
     * Upload a file (located at the input path) to the destination path.
     *
     * @param input The input file path or buffer to upload
     * @param ussFilePath The destination file path on USS
     * @param options Any options for the upload
     *
     * @returns A file response containing the results of the operation.
     */
    public async putContent(input: string | Buffer, ussFilePath: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const inputIsBuffer = input instanceof Buffer;
        const transferOptions = {
            content: inputIsBuffer ? input : undefined,
            localFile: inputIsBuffer ? undefined : input,
            transferType: CoreUtils.getBinaryTransferModeOrDefault(options.binary),
        };
        const result = this.getDefaultResponse();
        // Save-Save with FTP requires loading the file first
        // (moved this block above connection request so only one connection is active at a time)
        if (options?.returnEtag && options.etag) {
            const contentsTag = await this.getContentsTag(ussFilePath, inputIsBuffer);
            if (contentsTag && contentsTag !== options.etag) {
                throw new Error("Rest API failure with HTTP(S) status 412 Save conflict.");
            }
        }
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (!connection) {
                throw new Error(result.commandResponse);
            }
            await UssUtils.uploadFile(connection, ussFilePath, transferOptions);

            result.success = true;
            if (options?.returnEtag) {
                // release this connection instance because a new one will be made with getContentsTag
                this.releaseConnection(connection);
                connection = null;
                const contentsTag = await this.getContentsTag(ussFilePath, inputIsBuffer);
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

    public async uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        _options: zosfiles.IUploadOptions
    ): Promise<zosfiles.IZosFilesResponse> {
        let result = this.getDefaultResponse();
        try {
            // Check if inputDirectory is directory
            if (!imperative.IO.isDir(inputDirectoryPath)) {
                throw new ZoweFtpExtensionError("The local directory path provided does not exist.");
            }

            // Make directory before copying inner files
            await this.putContent(inputDirectoryPath, ussDirectoryPath);

            // getting list of files from directory
            const files = zosfiles.ZosFilesUtils.getFileListFromPath(inputDirectoryPath, false);
            // TODO: this solution will not perform very well; rewrite this and putContent methods
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

    public async create(ussPath: string, type: string, _mode?: string): Promise<zosfiles.IZosFilesResponse> {
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
                        transferType: TransferMode.ASCII,
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

    public async delete(ussPath: string, recursive?: boolean): Promise<zosfiles.IZosFilesResponse> {
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

    public async rename(currentUssPath: string, newUssPath: string): Promise<zosfiles.IZosFilesResponse> {
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
            await UssUtils.deleteDirectory(connection, ussPath);
            result.success = true;
            result.commandResponse = "Delete Completed";
        } finally {
            this.releaseConnection(connection);
        }
    }

    private async getContentsTag(ussFilePath: string, buffer?: boolean): Promise<string> {
        if (buffer) {
            const writable = new BufferBuilder();
            const loadResult = await this.getContents(ussFilePath, { stream: writable });
            return loadResult.apiResponse.etag as string;
        }

        const tmpFileName = tmp.tmpNameSync();
        const options: zosfiles.IDownloadOptions = {
            binary: false,
            file: tmpFileName,
        };
        const loadResult = await this.getContents(ussFilePath, options);
        fs.rmSync(tmpFileName, { force: true });
        return loadResult.apiResponse.etag as string;
    }

    private getDefaultResponse(): zosfiles.IZosFilesResponse {
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
