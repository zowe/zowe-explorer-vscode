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

import { IJob } from "@zowe/cli";
import { FilePermission, FileStat, FileType } from "vscode";

export interface FsEntry extends FileStat {
    name: string;
    type: FileType;
    wasAccessed?: boolean;
}

export class SpoolEntry implements FsEntry {
    public name: string;
    public type: FileType;
    public wasAccessed: boolean;

    public data?: Uint8Array;
    public permissions?: FilePermission;
    public ctime: number;
    public mtime: number;
    public size: number;

    public constructor(name: string) {
        this.type = FileType.File;
        this.name = name;
        this.wasAccessed = false;
    }
}

export class DirEntry implements FsEntry {
    public name: string;
    public type: FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public entries: Map<string, DirEntry | SpoolEntry>;

    public job?: IJob;

    public constructor(name: string) {
        this.type = FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
        this.wasAccessed = false;
    }
}
