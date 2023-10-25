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

import { imperative } from "@zowe/cli";
import { Duplex } from "stream";
import * as vscode from "vscode";

export const FS_PROVIDER_DELAY = 5;

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

export type FileEntryZMetadata = {
    profile: imperative.IProfileLoaded;
    ussPath: string;
};

export type UssConflict = {
    localEntry: UssFile;
    uri: vscode.Uri;
    content: Uint8Array;
};

export enum UssConflictSelection {
    UserDismissed = 0,
    Compare = 1,
    Overwrite = 2,
}

export interface UssEntry {
    name: string;
    metadata: FileEntryZMetadata;
    type: vscode.FileType;
    wasAccessed: boolean;
}

export class UssFile implements UssEntry, vscode.FileStat {
    public name: string;
    public metadata: FileEntryZMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public binary: boolean;
    public conflictData?: Uint8Array;
    public data?: Uint8Array;
    public etag?: string;
    public isConflictFile: boolean;
    public inDiffView: boolean;

    public constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.binary = false;
        this.wasAccessed = false;
        this.isConflictFile = false;
        this.inDiffView = false;
    }
}

export class UssDirectory implements UssEntry, vscode.FileStat {
    public name: string;
    public metadata: FileEntryZMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public entries: Map<string, UssFile | UssDirectory>;

    public constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
        this.wasAccessed = false;
    }
}
