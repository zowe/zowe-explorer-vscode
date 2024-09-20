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

import type { Types } from "../..";
import { DirEntry, EntryMetadata, FileEntry } from "./abstract";
import { IProfileLoaded } from "@zowe/imperative";

interface DsEntryProps {
    stats: Types.DatasetStats;
}

export const DS_EXTENSION_MAP: Map<string, string[]> = new Map([
    [".c", ["C"]],
    [".jcl", ["JCL", "JCLLIB", "CNTL", "PROC", "PROCLIB"]],
    [".cbl", ["COBOL", "CBL", "COB", "SCBL"]],
    [".cpy", ["COPYBOOK", "COPY", "CPY", "COBCOPY"]],
    [".inc", ["INC", "INCLUDE", "PLINC"]],
    [".pli", ["PLI", "PL1", "PLX", "PCX"]],
    [".sh", ["SH", "SHELL"]],
    [".rexx", ["REXX", "REXEC", "EXEC"]],
    [".xml", ["XML"]],
    [".asm", ["ASM", "ASSEMBL"]],
    [".log", ["LOG", "SPFLOG"]],
]);

export class DsEntry extends FileEntry implements DsEntryProps {
    public metadata: DsEntryMetadata;

    public constructor(name: string, public isMember: boolean = false) {
        super(name);
    }

    public stats: Types.DatasetStats;
}

export class PdsEntry extends DirEntry implements DsEntryProps {
    public entries: Map<string, DsEntry>;

    public constructor(name: string) {
        super(name);
        this.entries = new Map();
    }

    public stats: Types.DatasetStats;
}

export class DsEntryMetadata implements EntryMetadata {
    public profile: IProfileLoaded;
    public path: string;

    public constructor(metadata: EntryMetadata) {
        this.profile = metadata.profile;
        this.path = metadata.path;
    }

    /**
     * @returns the data set's file system path without the extension
     */
    public extensionRemovedFromPath(): string {
        for (const ext of DS_EXTENSION_MAP.keys()) {
            if (this.path.endsWith(ext)) {
                return this.path.replace(ext, "");
            }
        }

        return this.path;
    }

    public get dsName(): string {
        const segments = this.extensionRemovedFromPath().split("/").filter(Boolean);
        return segments[1] ? `${segments[0]}(${segments[1]})` : segments[0];
    }
}
