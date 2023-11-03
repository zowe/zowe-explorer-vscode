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
import { IDownloadSingleOptions, IUploadOptions, IZosFilesResponse, imperative } from "@zowe/cli";
import * as vscode from "vscode";

export enum ConflictViewSelection {
    UserDismissed = 0,
    Compare = 1,
    Overwrite = 2,
}

export type DeleteMetadata = {
    entryToDelete: DirEntry | FileEntry;
    parent: DirEntry;
    parentUri: vscode.Uri;
};

export interface Conflictable {
    getContents: (filePath: string, options: IDownloadSingleOptions) => Promise<IZosFilesResponse>;
    uploadBufferAsFile?(buffer: Buffer, filePath: string, options?: IUploadOptions): Promise<string | IZosFilesResponse>;
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
    profile: imperative.IProfileLoaded;
    path: string;
};

export interface FsEntry extends vscode.FileStat {
    name: string;
    metadata: EntryMetadata;
    type: vscode.FileType;
    wasAccessed: boolean;
}

export interface FileEntry extends FsEntry {
    data?: Uint8Array;

    // optional types for conflict and file management that some FileSystems will not leverage
    conflictData?: Uint8Array;
    isConflictFile?: boolean;
    inDiffView?: boolean;
    binary?: boolean;
    etag?: string;
    forceUpload?: boolean;
}

export class DirEntry implements FsEntry {
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

export type LocalConflict = {
    fsEntry: FileEntry;
    uri: vscode.Uri;
    content: Uint8Array;
};
