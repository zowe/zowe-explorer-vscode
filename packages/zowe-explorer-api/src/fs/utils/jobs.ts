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

import { IFileSystemEntry, JobEntry, SpoolEntry } from "../types";
import { FileType } from "vscode";

export function isJobEntry(entry: IFileSystemEntry): entry is JobEntry {
    return entry != null && entry.type == FileType.Directory;
}

export function isSpoolEntry(entry: IFileSystemEntry): entry is SpoolEntry {
    return entry != null && entry["wasAccessed"] !== undefined;
}
