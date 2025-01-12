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
import * as crypto from "crypto";
import * as tmp from "tmp";

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { BufferBuilder, Gui, imperative, MainframeInteraction, MessageSeverity } from "@zowe/zowe-explorer-api";
import { CoreUtils, DataSetUtils } from "@zowe/zos-ftp-for-zowe-cli";
import { AbstractFtpApi } from "./ZoweExplorerAbstractFtpApi";
import * as globals from "./globals";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";
// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class FtpMvsApi extends AbstractFtpApi implements MainframeInteraction.IMvs {
    public async dataSet(filter: string, _options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const session = this.getSession(this.profile);
        try {
            if (!session.mvsListConnection?.isConnected()) {
                session.mvsListConnection = await this.ftpClient(this.checkedProfile());
            }
            if (session.mvsListConnection.isConnected()) {
                const response = await DataSetUtils.listDataSets(session.mvsListConnection, filter);
                if (response) {
                    result.success = true;
                    result.apiResponse.items = response.map((element) => ({
                        dsname: element.name,
                        dsorg: element.dsOrg,
                        volume: element.volume,
                        recfm: element.recordFormat,
                        blksz: element.blockSize,
                        lrecl: element.recordLength,
                        migr: element.isMigrated ? "YES" : "NO",
                    }));
                }
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        }
    }

    public async allMembers(dataSetName: string, _options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                const response = await DataSetUtils.listMembers(connection, dataSetName);
                if (response) {
                    result.success = true;
                    // Ideally we could just do `result.apiResponse.items = response;`
                    result.apiResponse.items = response.map((element) => ({
                        member: element.name,
                        changed: element.changed,
                        created: element.created,
                        size: element.size,
                        version: element.version,
                        // id: element.id, // Removed in zos-node-accessor v2
                    }));
                }
            }
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async getContents(dataSetName: string, options: zosfiles.IDownloadSingleOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const transferOptions = {
            encoding: options.encoding,
            localFile: options.file,
            transferType: CoreUtils.getBinaryTransferModeOrDefault(options.binary),
        };
        const fileOrStreamSpecified = options.file != null || options.stream != null;
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (!connection || !fileOrStreamSpecified) {
                globals.LOGGER.logImperativeMessage(result.commandResponse, MessageSeverity.ERROR);
                throw new Error(result.commandResponse);
            }
            if (options.file) {
                transferOptions.localFile = options.file;
                imperative.IO.createDirsSyncFromFilePath(transferOptions.localFile);
                await DataSetUtils.downloadDataSet(connection, dataSetName, transferOptions);
                result.apiResponse.etag = await this.hashFile(transferOptions.localFile);
            } else if (options.stream) {
                const buffer = await DataSetUtils.downloadDataSet(connection, dataSetName, transferOptions);
                result.apiResponse.etag = this.hashBuffer(buffer);
                options.stream.write(buffer);
                options.stream.end();
            }
            result.success = true;
            result.commandResponse = "";
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async uploadFromBuffer(buffer: Buffer, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = await this.putContents(buffer, dataSetName, options);
        return result;
    }

    public async putContents(input: string | Buffer, dataSetName: string, options: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const openParens = dataSetName.indexOf("(");
        const dataSetNameWithoutMember = openParens > 0 ? dataSetName.substring(0, openParens) : dataSetName;
        const dsAtrribute = await this.dataSet(dataSetNameWithoutMember);
        const result = this.getDefaultResponse();
        const profile = this.checkedProfile();

        const dsorg = dsAtrribute.apiResponse.items[0]?.dsorg;
        const isPds = dsorg === "PO" || dsorg === "PO-E";

        /**
         * Determine the data set name for uploading.
         *
         * For PDS: When the input is a file path and the provided data set name doesn't include the member name,
         * we'll need to generate a member name.
         */
        const uploadName =
            isPds && openParens == -1 && typeof input === "string"
                ? `${dataSetName}(${zosfiles.ZosFilesUtils.generateMemberName(input)})`
                : dataSetName;

        const inputIsBuffer = input instanceof Buffer;

        // Save-Save with FTP requires loading the file first
        // (moved this block above connection request so only one connection is active at a time)
        if (options.returnEtag && options.etag) {
            const contentsTag = await this.getContentsTag(uploadName, inputIsBuffer);
            if (contentsTag && contentsTag !== options.etag) {
                throw Error("Rest API failure with HTTP(S) status 412: Save conflict");
            }
        }
        let connection;
        try {
            connection = await this.ftpClient(profile);
            if (!connection) {
                globals.LOGGER.logImperativeMessage(result.commandResponse, MessageSeverity.ERROR);
                throw new Error(result.commandResponse);
            }
            const lrecl: number = dsAtrribute.apiResponse.items[0].lrecl;
            const data = inputIsBuffer ? input.toString() : fs.readFileSync(input, { encoding: "utf8" });
            const transferOptions: Record<string, any> = {
                content: inputIsBuffer ? input : undefined,
                encoding: options.encoding,
                localFile: inputIsBuffer ? undefined : input,
                transferType: CoreUtils.getBinaryTransferModeOrDefault(options.binary),
            };
            if (profile.profile.secureFtp && data === "") {
                // substitute single space for empty DS contents when saving (avoids FTPS error)
                transferOptions.content = " ";
                delete transferOptions.localFile;
            }
            const lines = data.split(/\r?\n/);
            const foundIndex = lines.findIndex((line) => line.length > lrecl);
            if (foundIndex !== -1) {
                const message1 = `zftp Warning: At least one line, like line ${foundIndex + 1},
                is longer than dataset LRECL, ${lrecl}.`;
                const message2 = "The exceeding part will be truncated.";
                const message3 = "Do you want to continue?";
                const warningMessage = `${message1} ${message2}\n${message3}`;
                const select = await Gui.warningMessage(warningMessage, {
                    items: ["Yes", "No"],
                });
                if (select === "No") {
                    result.commandResponse = "";
                    return result;
                }
            }
            await DataSetUtils.uploadDataSet(connection, uploadName, transferOptions);
            result.success = true;
            if (options.returnEtag) {
                // release this connection instance because a new one will be made with getContentsTag
                this.releaseConnection(connection);
                connection = null;
                const etag = await this.getContentsTag(uploadName, inputIsBuffer);
                result.apiResponse = {
                    etag,
                };
            }
            result.commandResponse = "Data set uploaded successfully.";
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public async createDataSet(
        dataSetType: zosfiles.CreateDataSetTypeEnum,
        dataSetName: string,
        options?: Partial<zosfiles.ICreateDataSetOptions>
    ): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const dcbList = [];
        if (options?.alcunit) {
            dcbList.push(`ALCUNIT=${options.alcunit}`);
        }
        if (options?.blksize) {
            dcbList.push(`BLKSIZE=${options.blksize}`);
        }
        if (options?.dirblk) {
            dcbList.push(`DIRECTORY=${options.dirblk}`);
        }
        if (options?.dsorg) {
            dcbList.push(`DSORG=${options.dsorg}`);
        }
        if (options?.lrecl) {
            dcbList.push(`LRECL=${options.lrecl}`);
        }
        if (options?.primary) {
            dcbList.push(`PRIMARY=${options.primary}`);
        }
        if (options?.recfm) {
            dcbList.push(`RECFM=${options.recfm}`);
        }
        if (options?.secondary) {
            dcbList.push(`SECONDARY=${options.secondary}`);
        }
        const allocateOptions = {
            dcb: dcbList.join(" "),
        };
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await DataSetUtils.allocateDataSet(connection, dataSetName, allocateOptions);
                result.success = true;
                result.commandResponse = "Data set created successfully.";
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

    public async createDataSetMember(dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const profile = this.checkedProfile();
        const transferOptions = {
            transferType: CoreUtils.getBinaryTransferModeOrDefault(options.binary),
            // we have to provide a single space for content over FTPS, or it will fail to upload
            content: profile.profile.secureFtp ? " " : "",
            encoding: options.encoding,
        };
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(profile);
            if (!connection) {
                throw new Error(result.commandResponse);
            }

            await DataSetUtils.uploadDataSet(connection, dataSetName, transferOptions);
            result.success = true;
            result.commandResponse = "Member created successfully.";
            return result;
        } catch (err) {
            throw new ZoweFtpExtensionError(err.message);
        } finally {
            this.releaseConnection(connection);
        }
    }

    public allocateLikeDataSet(_dataSetName: string, _likeDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Allocate like dataset is not supported in ftp extension.");
    }

    public copyDataSetMember(
        { dsn: _fromDataSetName, member: _fromMemberName }: zosfiles.IDataSet,
        { dsn: _toDataSetName, member: _toMemberName }: zosfiles.IDataSet,
        _options?: { replace?: boolean }
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Copy dataset member is not supported in ftp extension.");
    }

    public copyDataSet(_fromDataSetName: string, _toDataSetName: string, _enq?: string, _replace?: boolean): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Copy dataset is not supported in ftp extension.");
    }

    public copyDataSetCrossLpar(
        toDataSetName: string,
        toMemberName: string,
        options: zosfiles.ICrossLparCopyDatasetOptions,
        sourceprofile: imperative.IProfileLoaded
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Copy dataset cross lpar is not supported in ftp extension.");
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await DataSetUtils.renameDataSet(connection, currentDataSetName, newDataSetName);
                result.success = true;
                result.commandResponse = "Rename completed successfully.";
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

    public async renameDataSetMember(dataSetName: string, currentMemberName: string, newMemberName: string): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const currentName = dataSetName + "(" + currentMemberName + ")";
        const newName = dataSetName + "(" + newMemberName + ")";
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await DataSetUtils.renameDataSet(connection, currentName, newName);
                result.success = true;
                result.commandResponse = "Rename completed successfully.";
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

    public hMigrateDataSet(_dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Migrate dataset is not supported in ftp extension.");
    }

    public hRecallDataSet(_dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new ZoweFtpExtensionError("Recall dataset is not supported in ftp extension.");
    }
    public async deleteDataSet(dataSetName: string, _options?: zosfiles.IDeleteDatasetOptions): Promise<zosfiles.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        let connection;
        try {
            connection = await this.ftpClient(this.checkedProfile());
            if (connection) {
                await DataSetUtils.deleteDataSet(connection, dataSetName);
                result.success = true;
                result.commandResponse = "Delete completed successfully.";
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

    private async getContentsTag(dataSetName: string, buffer?: boolean): Promise<string> {
        if (buffer) {
            const builder = new BufferBuilder();
            const loadResult = await this.getContents(dataSetName, { binary: false, stream: builder });
            return loadResult.apiResponse.etag as string;
        }

        const tmpFileName = tmp.tmpNameSync();
        const options: zosfiles.IDownloadOptions = {
            binary: false,
            file: tmpFileName,
        };
        const loadResult = await this.getContents(dataSetName, options);
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
            const hash = crypto.createHash("sha256");
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
