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

import { FilterEntry, FsEntry } from "@zowe/zowe-explorer-api";
import { DsEntry, MemberEntry, PdsEntry } from "./types";
import { FileType } from "vscode";

export function isDsEntry(entry: FsEntry): entry is DsEntry {
    return entry != null && entry.type == FileType.File;
}

export function isFilterEntry(entry: FsEntry): entry is FilterEntry {
    return entry != null && entry instanceof FilterEntry;
}

export function isMemberEntry(entry: FsEntry): entry is MemberEntry {
    return entry != null && entry instanceof MemberEntry;
}

export function isPdsEntry(entry: FsEntry): entry is PdsEntry {
    return entry != null && entry instanceof PdsEntry;
}
