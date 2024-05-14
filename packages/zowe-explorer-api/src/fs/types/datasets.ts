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

export class DsEntry extends FileEntry implements DsEntryProps {
    public metadata: DsEntryMetadata;

    public constructor(name: string) {
        super(name);
    }

    public stats: Types.DatasetStats;
}

export class MemberEntry extends DsEntry {}

export class PdsEntry extends DirEntry implements DsEntryProps {
    public entries: Map<string, MemberEntry>;

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

    public get dsName(): string {
        const segments = this.path.split("/").filter(Boolean);
        return segments[1] ? `${segments[0]}(${segments[1]})` : segments[0];
    }
}