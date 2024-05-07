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
import { ConflictData, DirEntry, EntryMetadata, FileEntry } from "./abstract";
import type { Types } from "../..";

export interface UssEntryProps {
    attributes?: Types.FileAttributes;
}

export class UssFile extends FileEntry implements UssEntryProps {
    public name: string;
    public metadata: EntryMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;
    public attributes: Types.FileAttributes;

    public ctime: number;
    public mtime: number;
    public size: number;
    public conflictData?: ConflictData;
    public data?: Uint8Array;
    public etag?: string;
    public permissions?: vscode.FilePermission;

    public constructor(name: string) {
        super(name);
    }
}

export class UssDirectory extends DirEntry implements UssEntryProps {
    public constructor(name?: string) {
        super(name ?? "");
    }
    public attributes: Types.FileAttributes;
}
