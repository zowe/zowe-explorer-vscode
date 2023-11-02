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

import * as vscode from "vscode";
import { DirEntry, EntryMetadata, FileEntry } from "../../abstract/fs/types";

export class UssFile implements FileEntry, vscode.FileStat {
    public name: string;
    public metadata: EntryMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public binary?: boolean;
    public conflictData?: Uint8Array;
    public data?: Uint8Array;
    public etag?: string;
    public isConflictFile?: boolean;
    public inDiffView?: boolean;
    public forceUpload?: boolean;

    public permissions?: vscode.FilePermission;

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
        this.forceUpload = false;
    }
}

export class UssDirectory extends DirEntry implements vscode.FileStat {
    public constructor(name: string) {
        super(name);
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
        this.wasAccessed = false;
    }
}
