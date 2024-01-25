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

import { DirEntry, EntryMetadata, FileEntry } from "../types";
import { imperative } from "@zowe/cli";
import { FileType } from "vscode";

export class DsEntry extends FileEntry {
    public name: string;
    public metadata: DsEntryMetadata;
    public type: FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public data: Uint8Array;
    public etag?: string;

    public constructor(name: string) {
        super(name);
    }
}

export class MemberEntry extends DsEntry {}

export class PdsEntry extends DirEntry {
    public entries: Map<string, MemberEntry>;

    public constructor(name: string) {
        super(name);
        this.entries = new Map();
    }
}

export class DsEntryMetadata implements EntryMetadata {
    public profile: imperative.IProfileLoaded;
    public path: string;

    public constructor(metadata: EntryMetadata) {
        this.profile = metadata.profile;
        this.path = metadata.path;
    }

    public get dsname(): string {
        const segments = this.path.split("/");
        return segments[1] ? `${segments[0]}(${segments[1]})` : segments[0];
    }
}
