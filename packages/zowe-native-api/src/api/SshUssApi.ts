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
import type * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { imperative, type MainframeInteraction, type Types } from "@zowe/zowe-explorer-api";
import { B64String, type uss } from "zowex-sdk";
import { SshCommonApi } from "./SshCommonApi";

export class SshUssApi extends SshCommonApi implements MainframeInteraction.IUss {
    public async fileList(ussFilePath: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (await this.client).uss.listFiles({
            fspath: ussFilePath,
            all: true,
            long: true,
        });
        return this.buildZosFilesResponse({
            items: response.items,
            returnedRows: response.returnedRows,
        });
    }

    public async isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        const tag = await this.getTag(ussFilePath);
        return tag === "binary" || tag === "ISO8859-1";
    }

    public async getContents(
        ussFilePath: string,
        options: zosfiles.IDownloadSingleOptions,
    ): Promise<zosfiles.IZosFilesResponse> {
        let writeStream = options.stream;
        if (options.file != null) {
            imperative.IO.createDirsSyncFromFilePath(options.file);
            writeStream = createWriteStream(options.file);
        }
        if (writeStream == null) {
            throw new Error("Failed to get contents: No stream or file path provided");
        }
        const response = await (await this.client).uss.readFile({
            fspath: ussFilePath,
            encoding: options.binary ? "binary" : options.encoding,
            // Pass stream if file is provided, otherwise use buffer to read into memory
            stream: options.file ? () => writeStream : undefined,
        });
        if (options.stream != null) {
            options.stream.write(B64String.decode(response.data));
            options.stream.end();
        }
        return this.buildZosFilesResponse({ etag: response.etag });
    }

    public async uploadFromBuffer(
        buffer: Buffer,
        filePath: string,
        options?: zosfiles.IUploadOptions,
    ): Promise<zosfiles.IZosFilesResponse> {
        let response: uss.WriteFileResponse;
        try {
            response = await (await this.client).uss.writeFile({
                fspath: filePath,
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

    public async putContent(
        inputFilePath: string,
        ussFilePath: string,
        options?: zosfiles.IUploadOptions,
    ): Promise<zosfiles.IZosFilesResponse> {
        const response = await (await this.client).uss.writeFile({
            fspath: ussFilePath,
            encoding: options?.encoding,
            stream: () => createReadStream(inputFilePath),
            etag: options?.etag,
        });
        return this.buildZosFilesResponse({ etag: response.etag });
    }

    public async uploadDirectory(
        _inputDirectoryPath: string,
        _ussDirectoryPath: string,
        _options: zosfiles.IUploadOptions,
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Not yet implemented");
    }

    public async copy(
        outputPath: string,
        options: Omit<object, "request"> & {
            from?: string;
            recursive?: boolean;
            overwrite?: boolean;
            followSymlinks?: boolean;
            preserveAttributes?: boolean;
        },
    ): Promise<Buffer> {
        const sourcePath = options?.from;
        const recursive = options?.recursive ?? false;
        const force = options?.overwrite ?? false;
        const followSymlinks = options?.followSymlinks ?? false;
        const preserveAttributes = options?.preserveAttributes ?? false;

        if (null == sourcePath) {
            throw new Error("Error: unix copy 'source' cannot be undefined");
        }
        const response = await (await this.client).uss.copyUss({
            srcFsPath: sourcePath,
            dstFsPath: outputPath,
            recursive: recursive,
            followSymlinks: followSymlinks,
            preserveAttributes: preserveAttributes,
            force: force,
        });

        return Buffer.from(JSON.stringify(this.buildZosFilesResponse(response, response.success)));
    }

    public async create(ussPath: string, type: string, mode?: string | undefined): Promise<zosfiles.IZosFilesResponse> {
        const response = await (await this.client).uss.createFile({
            fspath: ussPath,
            isDir: type === "directory",
            permissions: mode,
        });
        return this.buildZosFilesResponse(response, response.success);
    }

    public async delete(ussPath: string, recursive?: boolean | undefined): Promise<zosfiles.IZosFilesResponse> {
        const response = await (await this.client).uss.deleteFile({
            fspath: ussPath,
            recursive: recursive,
        });
        return this.buildZosFilesResponse(response, response.success);
    }

    public async move(oldPath: string, newPath: string): Promise<void> {
        await (await this.client).uss.moveFile({
            source: oldPath,
            target: newPath,
        });
    }

    public async rename(currentUssPath: string, newUssPath: string): Promise<zosfiles.IZosFilesResponse> {
        const response = await (await this.client).uss.moveFile({
            source: currentUssPath,
            target: newUssPath,
        });
        return this.buildZosFilesResponse(response, response.success);
    }

    public async getTag(ussPath: string): Promise<string> {
        const response = await (await this.client).uss.listFiles({
            fspath: ussPath,
            all: true,
            long: true,
        });
        return response.items[0].filetag ?? "untagged";
    }

    public async updateAttributes(
        ussPath: string,
        attributes: Partial<Types.FileAttributes>,
    ): Promise<zosfiles.IZosFilesResponse> {
        const ussItem = await this.fileList(ussPath);
        if (!ussItem.success || ussItem.apiResponse?.items.length !== 1) {
            throw new Error("File no longer exists");
        }
        const isDir = ussItem.apiResponse.items[0].mode.startsWith("d");
        let success = false;
        if (attributes.tag) {
            const response = await (await this.client).uss.chtagFile({
                fspath: ussPath,
                tag: attributes.tag,
                recursive: isDir,
            });
            success &&= response.success;
        }

        if (attributes.uid || attributes.owner) {
            const group = (attributes.gid ?? attributes.group)?.toString();
            const response = await (await this.client).uss.chownFile({
                fspath: ussPath,
                owner: `${attributes.uid?.toString() ?? attributes.owner!}${group ? `:${group}` : ""}`,
                recursive: isDir,
            });
            success &&= response.success;
        }

        if (attributes.perms) {
            const response = await (await this.client).uss.chmodFile({
                fspath: ussPath,
                mode: attributes.perms,
                recursive: isDir,
            });
            success &&= response.success;
        }

        return this.buildZosFilesResponse(undefined, success);
    }

    // biome-ignore lint/suspicious/noExplicitAny: The apiResponse has no strong type
    private buildZosFilesResponse(apiResponse: any, success = true): zosfiles.IZosFilesResponse {
        return { apiResponse, commandResponse: "", success };
    }
}
