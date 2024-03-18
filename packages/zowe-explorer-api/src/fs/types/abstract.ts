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

import { Duplex } from "stream";
import { IProfileLoaded } from "@zowe/imperative";
import { IDownloadSingleOptions, IUploadOptions, IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
import * as vscode from "vscode";
import { ZosEncoding } from "../../tree";

export enum ZoweScheme {
    DS = "zowe-ds",
    Jobs = "zowe-jobs",
    USS = "zowe-uss",
}

export enum ConflictViewSelection {
    UserDismissed = 0,
    Compare = 1,
    Overwrite = 2,
}

export type DeleteMetadata = {
    entryToDelete: IFileSystemEntry;
    parent: DirEntry;
    parentUri: vscode.Uri;
};

export interface Conflictable {
    getContents: (filePath: string, options: IDownloadSingleOptions) => Promise<IZosFilesResponse>;
    uploadFromBuffer?(buffer: Buffer, filePath: string, options?: IUploadOptions): Promise<string | IZosFilesResponse>;
}

export class BufferBuilder extends Duplex {
    private chunks: Uint8Array[];

    public constructor() {
        super();
        this.chunks = [];
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): void {
        this.chunks.push(chunk);
        callback();
    }

    public _read(_size: number): void {
        const concatBuf = Buffer.concat(this.chunks);
        this.push(concatBuf);
        this.push(null);
    }
}

export const FS_PROVIDER_DELAY = 5;

export type EntryMetadata = {
    profile: IProfileLoaded;
    path: string;
};

export type ConflictData = {
    contents: Uint8Array;
    etag?: string;
    size: number;
};

export interface IFileSystemEntry extends vscode.FileStat {
    name: string;
    metadata: EntryMetadata;
    type: vscode.FileType;
    wasAccessed: boolean;
    data?: Uint8Array;
}

export class FileEntry implements IFileSystemEntry {
    public name: string;
    public metadata: EntryMetadata;
    public type: vscode.FileType;
    public data: Uint8Array;
    public wasAccessed: boolean;
    public ctime: number;
    public mtime: number;
    public size: number;
    public permissions?: vscode.FilePermission;
    /**
     * Remote encoding of the data set
     */
    public encoding?: ZosEncoding;

    // optional types for conflict and file management that some FileSystems will not leverage
    public conflictData?: ConflictData;
    public inDiffView?: boolean;
    public etag?: string;
    public constructor(n: string, readOnly?: boolean) {
        this.name = n;
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.data = new Uint8Array();
        this.wasAccessed = false;
        this.encoding = undefined;
        if (readOnly) {
            this.permissions = vscode.FilePermission.Readonly;
        }
    }
}

export class DirEntry implements IFileSystemEntry {
    public name: string;
    public metadata: EntryMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;
    public ctime: number;
    public mtime: number;
    public size: number;
    public permissions?: vscode.FilePermission;
    public entries: Map<string, DirEntry | FileEntry>;

    public constructor(n: string) {
        this.name = n;
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.entries = new Map();
    }
}

export class FilterEntry extends DirEntry {
    public filter: Record<string, string> = {};

    public constructor(n: string) {
        super(n);
    }
}

export type LocalConflict = {
    fsEntry: FileEntry;
    uri: vscode.Uri;
    content: Uint8Array;
};
