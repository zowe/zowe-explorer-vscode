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
import {
    type AttributeEntryInfo,
    type AttributeInfo,
    type DataSetAttributesProvider,
    type DsInfo,
    Gui,
    type IAttributesProvider,
    imperative,
    type MainframeInteraction,
} from "@zowe/zowe-explorer-api";
import { B64String, type Dataset, type DatasetAttributes, type ds } from "@zowe/zowex-for-zowe-sdk";
import { SshCommonApi } from "./SshCommonApi";
import type Stream from "node:stream";

class SshAttributesProvider implements IAttributesProvider {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    private readonly extensionName = require("../../package.json").displayName;

    public constructor(public cachedAttrs?: Dataset) {}

    public fetchAttributes(context: DsInfo): AttributeInfo {
        if (context.profile.type !== "ssh") {
            return [];
        }

        const keys = new Map<string, AttributeEntryInfo>();
        const addAttribute = <K extends keyof Dataset>(prop: K, label: string, description?: string): void => {
            const value = this.cachedAttrs?.[prop];
            if (value != null) {
                keys.set(label, {
                    value: typeof value === "boolean" ? (value ? "YES" : "NO") : value.toLocaleString(),
                    description,
                });
            }
        };

        const spacu = this.cachedAttrs?.spacu?.toLocaleLowerCase() ?? "bytes";
        addAttribute("alloc", "Allocated Units", `Allocated units (${spacu})`);
        addAttribute("allocx", "Allocated Extents");
        addAttribute("dataclass", "Data Class");
        addAttribute("encrypted", "Encryption");
        addAttribute("mgmtclass", "Management Class");
        addAttribute("primary", "Primary Space", `Primary space (${spacu})`);
        addAttribute("secondary", "Secondary Space", `Secondary space (${spacu})`);
        addAttribute("storclass", "Storage Class");
        addAttribute("usedx", "Used Extents");
        this.cachedAttrs = undefined;

        return [{ title: this.extensionName, keys }];
    }
}

export class SshMvsApi extends SshCommonApi implements MainframeInteraction.IMvs {
    private attrProvider = new SshAttributesProvider();

    public constructor(
        dsAttrProvider?: DataSetAttributesProvider,
        public profile?: imperative.IProfileLoaded
    ) {
        super(profile);
        dsAttrProvider?.register(this.attrProvider);
    }

    public async dataSet(filter: string, options?: zosfiles.IListOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.listDatasets({
            pattern: filter,
            attributes: options?.attributes,
        });
        // Cache attributes for first data set to work around ZE issue
        // See https://github.com/zowe/zowe-explorer-vscode/issues/3927
        this.attrProvider.cachedAttrs = response.items[0];
        return this.buildZosFilesResponse({
            items: response.items.map((item) => {
                const entry: Record<string, unknown> = { dsname: item.name };
                if (options?.attributes) {
                    entry.blksz = item.blksize;
                    entry.cdate = item.cdate;
                    entry.dev = item.devtype;
                    entry.dsntp = item.dsntype;
                    entry.dsorg = item.dsorg;
                    entry.edate = item.edate;
                    entry.lrecl = item.lrecl;
                    entry.migr = item.migrated ? "YES" : "NO";
                    entry.mvol = item.multivolume ? "YES" : "NO";
                    entry.rdate = item.rdate;
                    entry.recfm = item.recfm;
                    entry.spacu = item.spacu;
                    entry.used = item.usedp != null ? `${item.usedp}%` : undefined;
                    entry.vol = item.volser;
                    entry.vols = item.volsers?.join(" ");
                }
                return entry;
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

        this.attrProvider.cachedAttrs = undefined;

        return this.buildZosFilesResponse({
            items: response.items.map((item) => {
                const entry: Record<string, unknown> = {
                    member: item.name,
                };

                if (options?.attributes) {
                    entry.vers = item.vers;
                    entry.mod = item.mod;
                    entry.c4date = item.c4date;
                    entry.m4date = item.m4date;
                    entry.mtime = item.mtime;
                    entry.cnorc = item.cnorc;
                    entry.inorc = item.inorc;
                    entry.mnorc = item.mnorc;
                    entry.user = item.user;
                    entry.sclm = item.sclm;
                }
                return entry;
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
        let response: ds.CreateDatasetResponse = { success: false };
        try {
            response = await (
                await this.client
            ).ds.createDataset({
                dsname: dataSetName,
                attributes: datasetAttributes,
            });
        } catch (error) {
            if (error instanceof imperative.ImperativeError) {
                Gui.errorMessage(error.additionalDetails);
            }
        }
        return this.buildZosFilesResponse(response, response.success);
    }

    public async createDataSetMember(dataSetName: string, _options?: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        let response: ds.CreateMemberResponse = { success: false };
        try {
            response = await (
                await this.client
            ).ds.createMember({
                dsname: dataSetName,
            });
            if (!response.success) {
                Gui.errorMessage(`Failed to create data set member: ${dataSetName}`);
            }
        } catch (error) {
            Gui.errorMessage(`Failed to create data set member: ${dataSetName}`);
            Gui.errorMessage(`Error: ${(error as Error).message}`);
        }
        return this.buildZosFilesResponse(response, response.success);
    }

    public allocateLikeDataSet(_dataSetName: string, _likeDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Not yet implemented");
    }

    public copyDataSetMember(
        { dsn: _fromDataSetName, member: _fromMemberName }: zosfiles.IDataSet,
        { dsn: _toDataSetName, member: _toMemberName }: zosfiles.IDataSet,
        _options?: { replace?: boolean }
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Not yet implemented");
    }

    public async renameDataSet(currentDataSetName: string, newDataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.renameDataset({
            dsnameBefore: currentDataSetName,
            dsnameAfter: newDataSetName,
        });
        return this.buildZosFilesResponse({
            success: response.success,
        });
    }

    public async renameDataSetMember(dsname: string, memberBefore: string, memberAfter: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.renameMember({
            dsname,
            memberBefore,
            memberAfter,
        });
        return this.buildZosFilesResponse({
            success: response.success,
        });
    }

    public hMigrateDataSet(_dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Not yet implemented");
    }

    public async hRecallDataSet(dataSetName: string): Promise<zosfiles.IZosFilesResponse> {
        let response: ds.RestoreDatasetResponse = { success: false };
        try {
            response = await (
                await this.client
            ).ds.restoreDataset({
                dsname: dataSetName,
            });
            if (!response.success) {
                Gui.errorMessage(`Failed to restore dataset ${dataSetName}`);
            }
        } catch (error) {
            Gui.errorMessage(`Failed to restore dataset ${dataSetName}`);
            Gui.errorMessage(`Error: ${(error as Error).message}`);
        }
        return this.buildZosFilesResponse(response);
    }

    public async deleteDataSet(dataSetName: string, _options?: zosfiles.IDeleteDatasetOptions): Promise<zosfiles.IZosFilesResponse> {
        const response = await (
            await this.client
        ).ds.deleteDataset({
            dsname: dataSetName,
        });
        return this.buildZosFilesResponse({
            success: response.success,
        });
    }

    private buildZosFilesResponse(apiResponse: any, success = true, errorText?: string): zosfiles.IZosFilesResponse {
        return { apiResponse, commandResponse: "", success, errorMessage: errorText };
    }
}
