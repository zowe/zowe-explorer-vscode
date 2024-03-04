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

import { IFileSystemEntry, DsEntry, MemberEntry, PdsEntry } from "../";
import { FileType } from "vscode";

export function isDsEntry(entry: IFileSystemEntry): entry is DsEntry {
    return entry != null && entry.type == FileType.File;
}

export function isMemberEntry(entry: IFileSystemEntry): entry is MemberEntry {
    return entry != null && entry instanceof MemberEntry;
}

export function isPdsEntry(entry: IFileSystemEntry): entry is PdsEntry {
    return entry != null && entry instanceof PdsEntry;
}
