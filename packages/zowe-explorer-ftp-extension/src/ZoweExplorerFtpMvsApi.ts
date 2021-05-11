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
import * as tmp from "tmp";
import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";
import * as path from "path";

import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { DataSetUtils, TRANSFER_TYPE_ASCII, TRANSFER_TYPE_BINARY } from "@zowe/zos-ftp-for-zowe-cli";
import { AbstractFtpApi } from "./ZoweExplorerAbstractFtpApi";
// The Zowe FTP CLI plugin is written and uses mostly JavaScript, so relax the rules here.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class FtpMvsApi extends AbstractFtpApi implements ZoweExplorerApi.IMvs {
    public async dataSet(filter: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            const response: any[] = await DataSetUtils.listDataSets(connection, filter);
            if (response) {
                result.success = true;
                result.apiResponse.items = response.map((element) => ({
                    dsname: element.dsname,
                    dsorg: element.dsorg,
                    volume: element.volume,
                    recfm: element.recfm,
                    blksz: element.blksz,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    migr: element.volume && element.volume.toUpperCase() === "MIGRATED" ? "YES" : "NO",
                }));
            }
        }
        return result;
    }

    public async allMembers(dataSetName: string, options?: zowe.IListOptions): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            const response: any[] = await DataSetUtils.listMembers(connection, dataSetName);
            if (response) {
                result.success = true;
                result.apiResponse.items = response.map((element) => ({
                    member: element.name,
                    changed: element.changed,
                    created: element.created,
                    id: element.id,
                }));
            }
        }
        return result;
    }

    public async getContents(dataSetName: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        const connection = await this.ftpClient(this.checkedProfile());
        const result = this.getDefaultResponse();
        const targetFile = options.file;
        const transferOptions = {
            transferType: options.binary ? TRANSFER_TYPE_BINARY : TRANSFER_TYPE_ASCII,
            localFile: targetFile,
        };
        if (connection && targetFile) {
            imperative.IO.createDirsSyncFromFilePath(targetFile);
            await DataSetUtils.downloadDataSet(connection, dataSetName, transferOptions);
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
        dataSetName: string,
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        const transferOptions = {
            transferType: options.binary ? TRANSFER_TYPE_BINARY : TRANSFER_TYPE_ASCII,
            localFile: inputFilePath,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const file = path.basename(inputFilePath).replace(/[^a-z0-9]+/gi, "");
        const member = file.substr(0, 8);
        let targetDataset;
        const dsAtrribute = await this.dataSet(dataSetName);
        const dsorg = dsAtrribute.apiResponse.items[0].dsorg;
        if (dsorg === "PS" || dataSetName.substr(dataSetName.length - 1) == ")") {
            targetDataset = dataSetName;
        } else {
            targetDataset = dataSetName + "(" + member + ")";
        }
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (!connection) {
            throw new Error(result.commandResponse);
        }
        // Save-Save with FTP requires loading the file first
        if (options.returnEtag && options.etag) {
            const contentsTag = await this.getContentsTag(dataSetName);
            if (contentsTag && contentsTag !== options.etag) {
                // TODO: extension.ts should not check for zosmf errors.
                throw new Error("Save conflict. Please pull the latest content from mainfram first.");
            }
        }
        await DataSetUtils.uploadDataSet(connection, targetDataset, transferOptions);
        result.success = true;
        if (options.returnEtag) {
            const contentsTag = await this.getContentsTag(dataSetName);
            result.apiResponse = [
                {
                    etag: contentsTag,
                },
            ];
        }
        result.commandResponse = "Data set uploaded successfully.";
        return result;
    }

    public async createDataSet(
        dataSetType: zowe.CreateDataSetTypeEnum,
        dataSetName: string,
        options?: Partial<zowe.ICreateDataSetOptions>
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        /* eslint-disable @typescript-eslint/restrict-plus-operands */
        const dcbList = [];
        if (options?.alcunit) {
            dcbList.push("ALCUNIT=" + options.alcunit);
        }
        if (options?.blksize) {
            dcbList.push("BLKSIZE=" + options.blksize);
        }
        if (options?.dirblk) {
            dcbList.push("DIRECTORY=" + options.dirblk);
        }
        if (options?.dsorg) {
            dcbList.push("DSORG=" + options.dsorg);
        }
        if (options?.lrecl) {
            dcbList.push("LRECL=" + options.lrecl);
        }
        if (options?.primary) {
            dcbList.push("PRIMARY=" + options.primary);
        }
        if (options?.recfm) {
            dcbList.push("RECFM=" + options.recfm);
        }
        if (options?.secondary) {
            dcbList.push("SECONDARY=" + options.secondary);
        }
        const dcb = dcbList.join(" ");
        const allocateOptions = {
            dcb: dcb,
        };
        if (connection) {
            await DataSetUtils.allocateDataSet(connection, dataSetName, allocateOptions);
            result.success = true;
            result.commandResponse = "Data set created successfully.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public async createDataSetMember(
        dataSetName: string,
        options?: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        const transferOptions = {
            transferType: options ? TRANSFER_TYPE_BINARY : TRANSFER_TYPE_ASCII,
            content: "",
        };
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (!connection) {
            throw new Error(result.commandResponse);
        }

        await DataSetUtils.uploadDataSet(connection, dataSetName, transferOptions);
        result.success = true;
        result.commandResponse = "Member created successfully.";
        return result;
    }

    public allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Allocate like dataset is not supported in ftp extension.");
    }

    public copyDataSetMember(
        { dataSetName: fromDataSetName, memberName: fromMemberName }: zowe.IDataSet,
        { dataSetName: toDataSetName, memberName: toMemberName }: zowe.IDataSet,
        options?: { replace?: boolean }
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Copy dataset is not supported in ftp extension.");
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            await DataSetUtils.renameDataSet(connection, currentDataSetName, newDataSetName);
            result.success = true;
            result.commandResponse = "Rename completed successfully.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public async renameDataSetMember(
        dataSetName: string,
        currentMemberName: string,
        newMemberName: string
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        const currentName = dataSetName + "(" + currentMemberName + ")";
        const newName = dataSetName + "(" + newMemberName + ")";
        if (connection) {
            await DataSetUtils.renameDataSet(connection, currentName, newName);
            result.success = true;
            result.commandResponse = "Rename completed successfully.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    public hMigrateDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Migrate dataset is not supported in ftp extension.");
    }

    public hRecallDataSet(dataSetName: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Recall dataset is not supported in ftp extension.");
    }
    public async deleteDataSet(
        dataSetName: string,
        options?: zowe.IDeleteDatasetOptions
    ): Promise<zowe.IZosFilesResponse> {
        const result = this.getDefaultResponse();
        const connection = await this.ftpClient(this.checkedProfile());
        if (connection) {
            await DataSetUtils.deleteDataSet(connection, dataSetName);
            result.success = true;
            result.commandResponse = "Delete completed successfully.";
        } else {
            throw new Error(result.commandResponse);
        }
        return result;
    }

    private async getContentsTag(dataSetName: string): Promise<string> {
        const tmpFileName = tmp.tmpNameSync();
        const options: zowe.IDownloadOptions = {
            binary: false,
            file: tmpFileName,
        };
        const loadResult = await this.getContents(dataSetName, options);
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
