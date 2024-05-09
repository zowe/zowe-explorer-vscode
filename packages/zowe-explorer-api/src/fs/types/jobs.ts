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

import { IJob, IJobFile } from "@zowe/zos-jobs-for-zowe-sdk";
import { DirEntry, EntryMetadata, FileEntry } from "./abstract";
import { FilePermission, FileType } from "vscode";

export type JobFilter = {
    searchId: string;
    owner: string;
    prefix: string;
    status: string;
};

export class SpoolEntry extends FileEntry {
    public name: string;
    public type: FileType;
    public wasAccessed: boolean;

    public data: Uint8Array;
    public permissions?: FilePermission;
    public ctime: number;
    public mtime: number;
    public size: number;
    public metadata: EntryMetadata;
    public spool?: IJobFile;

    public constructor(name: string) {
        super(name);
    }
}

export class JobEntry extends DirEntry {
    public entries: Map<string, SpoolEntry>;
    public job?: IJob;

    public constructor(name: string) {
        super(name);
    }
}
