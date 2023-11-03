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

import { IJob, IJobFile } from "@zowe/cli";
import { DirEntry, EntryMetadata, FileEntry } from "@zowe/zowe-explorer-api";
import { FilePermission, FileType } from "vscode";

export class SpoolEntry implements FileEntry {
    public name: string;
    public type: FileType;
    public wasAccessed: boolean;

    public data?: Uint8Array;
    public permissions?: FilePermission;
    public ctime: number;
    public mtime: number;
    public size: number;
    public metadata: EntryMetadata;
    public spool?: IJobFile;

    public constructor(name: string) {
        this.type = FileType.File;
        this.name = name;
        this.wasAccessed = false;
    }
}

export class JobEntry extends DirEntry {
    public entries: Map<string, SpoolEntry>;
    public job?: IJob;

    public constructor(name: string) {
        super(name);
        this.type = FileType.Directory;
        this.name = name;
        this.entries = new Map();
        this.wasAccessed = false;
    }
}
