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

import { createReadStream, createWriteStream } from "node:fs";
import * as path from "node:path";
import type * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { imperative, Gui, type MainframeInteraction } from "@zowe/zowe-explorer-api";
import { B64String, type Dataset, type DatasetAttributes, type ds } from "@zowe/zowex-for-zowe-sdk";
import { SshCommonApi } from "./SshCommonApi";
import type Stream from "node:stream";
import { SshClientCache } from "../SshClientCache";

export class SshMvsApi extends SshCommonApi implements MainframeInteraction.IMvs {
    private readonly dsAttrMapping: Record<string, string> = {
        blksize: "blksz",
        devtype: "dev",
        dsntype: "dsntp",
        migrated: "migr",
        multivolume: "mvol",
        usedp: "used",
        volser: "vol",
        volsers: "vols",
    };

    public async dataSet(filter: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.listDatasets({
            pattern: filter,
            attributes: options?.attributes,
        });
        const formatAttributeValue = (value: unknown): unknown => {
            if (typeof value === "boolean") {
                return value ? "YES" : "NO"; // e.g. migrated
            } else if (Array.isArray(value)) {
                return value.join(" "); // e.g. volsers
            }
            return value;
        };

        return this.buildZosFilesResponse({
            items: response.items.map((item) => {
                const attrs: Record<string, unknown> = {};
                if (options?.attributes) {
                    for (const [k, v] of Object.entries(item)) {
                        if (k !== "name") {
                            attrs[this.dsAttrMapping[k] ?? k] = formatAttributeValue(v);
                        }
                    }
                }
                return { dsname: item.name, ...attrs };
            }),
            returnedRows: response.returnedRows,
        });
    }

    public async allMembers(dataSetName: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.listDsMembers({
            dsname: dataSetName,
            attributes: options?.attributes,
            pattern: options?.pattern,
        });

        return this.buildZosFilesResponse({
            items: response.items.map((item) => {
                const attrs: Record<string, unknown> = {};
                if (options?.attributes) {
                    for (const [k, v] of Object.entries(item)) {
                        if (k !== "name") {
                            attrs[k] = v;
                        }
                    }
                }
                return { member: item.name, ...attrs };
            }),
            returnedRows: response.returnedRows,
        });
    }

    public async getContents(dataSetName: string, options: zosfiles.IDownloadSingleOptions): Promise<zosfiles.IZosFilesResponse> {
        let writeStream = options.stream;
        if (options.file != null) {
            imperative.IO.createDirsSyncFromFilePath(options.file);
            writeStream = createWriteStream(options.file);
        }
        if (writeStream == null) {
            throw new Error("Failed to get contents: No stream or file path provided");
        }
        const response = await (
            await this.client
        ).ds.readDataset({
            dsname: dataSetName,
            encoding: options.binary ? "binary" : options.encoding,
            // Pass stream if file is provided, otherwise use buffer to read into memory
            stream: options.file ? (): Stream.Writable => writeStream : undefined,
        });
        if (options.stream != null) {
            options.stream.write(B64String.decode(response.data));
            options.stream.end();
        }
        return this.buildZosFilesResponse({ etag: response.etag });
    }

    public async uploadFromBuffer(buffer: Buffer, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        let response: ds.WriteDatasetResponse;
        try {
            response = await (
                await this.client
            ).ds.writeDataset({
                dsname: dataSetName,
                encoding: options?.binary ? "binary" : options?.encoding,
                data: B64String.encode(buffer),
                etag: options?.etag,
            });
        } catch (err) {
            if (err instanceof imperative.ImperativeError && err.additionalDetails.includes("Etag mismatch")) {
                throw new Error("Rest API failure with HTTP(S) status 412");
            }
            throw err;
        }
        return this.buildZosFilesResponse({ etag: response.etag });
    }

    public async putContents(inputFilePath: string, dataSetName: string, options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        // Determine if we need to generate a member name for PDS uploads
        const dsname = await this.resolveDataSetName(inputFilePath, dataSetName);

        const response = await (
            await this.client
        ).ds.writeDataset({
            dsname,
            encoding: options?.encoding,
            stream: () => createReadStream(inputFilePath),
            etag: options?.etag,
        });
        return this.buildZosFilesResponse({ etag: response.etag });
    }

    /**
     * Resolves the full data set name, including member name if uploading to a PDS.
     * When uploading a file to a PDS without specifying a member name, the member name
     * is generated from the input file path (similar to z/OSMF's pathToDataSet behavior).
     *
     * @param inputFilePath - The local file path being uploaded
     * @param dataSetName - The target data set name (may or may not include member)
     * @returns The resolved data set name with member if applicable
     */
    private async resolveDataSetName(inputFilePath: string, dataSetName: string): Promise<string> {
        const openParens = dataSetName.indexOf("(");

        // If member name is already specified, use it as-is
        if (openParens > 0) {
            return dataSetName;
        }

        // Check if the target is a PDS by fetching data set attributes
        const dsInfo = await (
            await this.client
        ).ds.listDatasets({
            pattern: dataSetName,
            attributes: true,
        });

        const dsorg = dsInfo.items[0]?.dsorg;
        const isPds = dsorg?.startsWith("PO");

        if (isPds) {
            // Generate member name from the input file path
            const memberName = this.generateMemberName(inputFilePath);
            return `${dataSetName}(${memberName})`;
        }

        return dataSetName;
    }

    /**
     * Generates a valid z/OS member name from a file path.
     * Member names must be 1-8 characters, start with a letter or national character,
     * and contain only letters, numbers, or national characters (@, #, $).
     *
     * @param filePath - The file path to generate a member name from
     * @returns A valid z/OS member name
     */
    private generateMemberName(filePath: string): string {
        // Get the base filename without extension
        const baseName = path.basename(filePath, path.extname(filePath));

        // Convert to uppercase and remove invalid characters
        let memberName = baseName.toUpperCase().replace(/[^A-Z0-9@#$]/g, "");

        memberName = memberName.replace(/^\d+/, "");

        // Truncate to 8 characters max
        // eslint-disable-next-line no-magic-numbers
        memberName = memberName.substring(0, 8);

        // If empty, use a default
        if (memberName.length === 0) {
            memberName = "MEMBER";
        }

        return memberName;
    }

    public async createDataSet(
        _dataSetType: zosfiles.CreateDataSetTypeEnum,
        dataSetName: string,
        options?: Partial<zosfiles.ICreateDataSetOptions>
    ): Promise<zosfiles.IZosFilesResponse> {
        const datasetAttributes: DatasetAttributes = {
            dsname: dataSetName,
            primary: 1,
            lrecl: 80,
            ...(options || {}),
        };

        const response = await (
            await this.client
        ).ds.createDataset({
            dsname: dataSetName,
            attributes: datasetAttributes,
        });
        return this.buildZosFilesResponse(response);
    }

    public async createDataSetMember(dataSetName: string, _options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.createMember({
            dsname: dataSetName,
            overwrite: true, // Overwrite detection already handled on client side
        });
        return this.buildZosFilesResponse(response);
    }

    public async allocateLikeDataSet(dataSetName: string, likeDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        const listResponse = await (
            await this.client
        ).ds.listDatasets({
            pattern: likeDataSetName,
            maxItems: 1,
            attributes: true,
        });

        if (listResponse.items.length === 0) {
            return this.buildZosFilesResponse({ success: false }, false, `Source data set "${likeDataSetName}" not found`);
        }

        const sourceDs: Dataset = listResponse.items[0];

        const attributes: DatasetAttributes = {
            dsname: dataSetName,
            recfm: sourceDs.recfm,
            lrecl: sourceDs.lrecl ?? 80,
            blksize: sourceDs.blksize,
            dsorg: sourceDs.dsorg,
            dsntype: sourceDs.dsntype,
            vol: sourceDs.volser,
            alcunit: sourceDs.spacu?.toUpperCase().startsWith("CYL") ? "CYLINDERS" : "TRACKS",
            primary: sourceDs.alloc || 1,
            secondary: 1,
        };

        if (["PDS", "PDSE", "LIBRARY"].includes(sourceDs.dsntype ?? "")) {
            attributes.dirblk = 25;
        }

        try {
            const response = await (
                await this.client
            ).ds.createDataset({
                dsname: dataSetName,
                attributes: attributes,
            });

            if (response.success) {
                Gui.setStatusBarMessage(`Successfully allocated dataset "${dataSetName}" like "${likeDataSetName}"`);
            }

            return this.buildZosFilesResponse(response, response.success);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            Gui.errorMessage(`Failed to allocate dataset: ${errorMsg}`);
            return this.buildZosFilesResponse({ success: false }, false, errorMsg);
        }
    }

    public async copyDataSet(fromDataSetName: string, toDataSetName: string, _enq?: string, replace?: boolean): Promise<zosfiles.IZosFilesResponse> {
        try {
            const response = await (
                await this.client
            ).ds.copyDatasetOrMember({
                source: fromDataSetName,
                target: toDataSetName,
                replace: replace ?? false,
                overwrite: false,
            });

            if (!response.success) {
                const errorMsg = `Failed to copy ${fromDataSetName} to ${toDataSetName}.`;
                Gui.errorMessage(errorMsg);
                return this.buildZosFilesResponse(response, false, errorMsg);
            }
            return this.buildZosFilesResponse(response, true);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return this.buildZosFilesResponse({ success: false }, false, errorMsg);
        }
    }

    public async copyDataSetCrossLpar(
        toDataSetName: string,
        toMemberName: string,
        options: zosfiles.ICrossLparCopyDatasetOptions,
        sourceProfile: imperative.IProfileLoaded
    ): Promise<zosfiles.IZosFilesResponse> {
        const fromDataset = options["from-dataset"];

        if (!fromDataset?.dsn?.trim()) {
            const errorMessage = "fromDataSetName must be defined and non-blank";
            Gui.errorMessage(errorMessage);
            return this.buildZosFilesResponse({ success: false }, false, errorMessage);
        }
        if (!toDataSetName?.trim()) {
            const errorMessage = "toDataSetName must be defined and non-blank";
            Gui.errorMessage(errorMessage);
            return this.buildZosFilesResponse({ success: false }, false, errorMessage);
        }

        try {
            const sourceDsn = fromDataset.dsn;
            const sourceMember = fromDataset.member;
            const targetDsn = toDataSetName;
            const targetMember = toMemberName || undefined;
            let overwriteTarget = options.replace;
            let targetFound = false;
            let targetMemberFound = false;

            const sourceClient = await SshClientCache.inst.connect(sourceProfile);
            const targetClient = await this.client;

            // Verify source dataset exists
            const sourceList = await sourceClient.ds.listDatasets({
                pattern: sourceDsn,
                attributes: true,
                maxItems: 1,
            });
            const sourceItem = sourceList.items.find((item) => item.name.toUpperCase() === sourceDsn.toUpperCase());
            if (sourceItem == null) {
                const errorMessage = `Data set copy aborted. The source data set was not found.`;
                Gui.errorMessage(errorMessage);
                return this.buildZosFilesResponse({ success: false }, false, errorMessage);
            }

            // Abort if source is a PDS and no member was specified
            if (sourceItem.dsorg?.startsWith("PO") && sourceMember == null) {
                const errorMessage = `Copying from a PDS to PDS is not supported across LPARs.`;
                Gui.errorMessage(errorMessage);
                return this.buildZosFilesResponse({ success: false }, false, errorMessage);
            }

            // Download in binary to preserve exact mainframe bytes without conversion
            let fromDsname = sourceDsn;
            if (sourceMember != null) {
                fromDsname = `${sourceDsn}(${sourceMember})`;
            }
            const readResponse = await sourceClient.ds.readDataset({ dsname: fromDsname, encoding: "binary" });

            // Check whether the target dataset exists
            const targetList = await targetClient.ds.listDatasets({
                pattern: targetDsn,
                attributes: true,
                maxItems: 1,
            });
            const targetItem = targetList.items.find((item) => item.name.toUpperCase() === targetDsn.toUpperCase());
            if (targetItem != null) {
                targetFound = true;

                // Abort if target is a PDS and no member name was given
                if (targetItem.dsorg?.startsWith("PO") && targetMember == null) {
                    const errorMessage = `Data set copy aborted. Copying to a PDS without a member name is not supported when copying across LPARs.`;
                    Gui.errorMessage(errorMessage);
                    return this.buildZosFilesResponse({ success: false }, false, errorMessage);
                }
            }

            // When a member is specified and the target PDS exists, check whether the member already exists
            if (targetMember != null && targetFound) {
                const memberList = await targetClient.ds.listDsMembers({ dsname: targetDsn, pattern: targetMember });
                targetMemberFound = memberList.items.some((item) => item.name.toUpperCase() === targetMember.toUpperCase());
            }

            if (!targetFound) {
                // Create the target dataset modelled on the source attributes
                const createAttributes: DatasetAttributes = {
                    dsname: targetDsn,
                    recfm: sourceItem.recfm,
                    lrecl: sourceItem.lrecl ?? 80,
                    blksize: sourceItem.blksize,
                    dsorg: sourceItem.dsorg,
                    dsntype: sourceItem.dsntype,
                    vol: sourceItem.volser,
                    alcunit: sourceItem.spacu?.toUpperCase().startsWith("CYL") ? "CYLINDERS" : "TRACKS",
                    primary: sourceItem.alloc ?? 1,
                    secondary: 1,
                };

                // Copying a PDS to a sequential target: strip PDS organisation
                if (createAttributes.dsorg?.startsWith("PO") && targetMember == null) {
                    createAttributes.dsorg = "PS";
                }
                // Copying a sequential source into a PDS member: promote the new dataset to PDS
                else if (targetMember != null && !createAttributes.dsorg?.startsWith("PO")) {
                    createAttributes.dsorg = "PO";
                }

                await targetClient.ds.createDataset({ dsname: targetDsn, attributes: createAttributes });
            } else {
                // Target dataset exists — ask whether to overwrite if no explicit flag was provided
                if (overwriteTarget == null) {
                    if (targetMember == null) {
                        if (options.promptFn != null) {
                            overwriteTarget = await options.promptFn(targetDsn);
                        }
                    } else if (targetMemberFound) {
                        if (options.promptFn != null) {
                            overwriteTarget = await options.promptFn(`${targetDsn}(${targetMember})`);
                        }
                    }
                }
            }

            // Upload only when the target did not exist, the member slot is free, or overwrite was confirmed
            if (overwriteTarget || !targetFound || (targetMember != null && !targetMemberFound)) {
                let toDsname = targetDsn;
                if (targetMember != null) {
                    toDsname = `${targetDsn}(${targetMember})`;
                }
                const writeResponse = await targetClient.ds.writeDataset({
                    dsname: toDsname,
                    data: readResponse.data,
                    encoding: "binary",
                });
                return this.buildZosFilesResponse(writeResponse, true);
            }

            const errorMessage = `Data set copy aborted. The existing target data set was not overwritten.`;
            Gui.errorMessage(errorMessage);
            return this.buildZosFilesResponse({ success: false }, false, errorMessage);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            Gui.errorMessage(`Error during copy operation: ${errorMsg}`);
            return this.buildZosFilesResponse({ success: false }, false, errorMsg);
        }
    }

    public async copyDataSetMember(
        { dsn: fromDataSetName, member: fromMemberName }: zosfiles.IDataSet,
        { dsn: toDataSetName, member: toMemberName }: zosfiles.IDataSet,
        options?: { replace?: boolean; overwrite?: boolean }
    ): Promise<zosfiles.IZosFilesResponse> {
        const source = fromMemberName ? `${fromDataSetName}(${fromMemberName})` : fromDataSetName;
        const target = toMemberName ? `${toDataSetName}(${toMemberName})` : toDataSetName;

        try {
            const response = await (
                await this.client
            ).ds.copyDatasetOrMember({
                source,
                target,
                replace: options?.replace ?? false,
                overwrite: options?.overwrite ?? false,
            });

            if (!response.success) {
                const errorMsg = `Failed to copy ${source} to ${target}.`;
                Gui.errorMessage(errorMsg);
                return this.buildZosFilesResponse(response, false, errorMsg);
            }
            return this.buildZosFilesResponse(response, true);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            Gui.errorMessage(`Error during copy operation: ${errorMsg}`);
            return this.buildZosFilesResponse({ success: false }, false, errorMsg);
        }
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.renameDataset({
            dsnameBefore: currentDataSetName,
            dsnameAfter: newDataSetName,
        });
        return this.buildZosFilesResponse(response);
    }

    public async renameDataSetMember(dsname: string, memberBefore: string, memberAfter: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.renameMember({
            dsname,
            memberBefore,
            memberAfter,
        });
        return this.buildZosFilesResponse(response);
    }

    public hMigrateDataSet(_dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Not yet implemented");
    }

    public async hRecallDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.restoreDataset({
            dsname: dataSetName,
        });
        return this.buildZosFilesResponse(response);
    }

    public async deleteDataSet(dataSetName: string, _options?: zosfiles.IDeleteDatasetOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.deleteDataset({
            dsname: dataSetName,
        });
        return this.buildZosFilesResponse(response);
    }

    private buildZosFilesResponse(apiResponse: any, success = true, errorText?: string): zosfiles.IZosFilesResponse {
        return { apiResponse, commandResponse: "", success: apiResponse?.success ?? success, errorMessage: errorText };
    }
}
