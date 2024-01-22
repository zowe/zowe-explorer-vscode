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
import { ProfilesCache } from "../../profiles/ProfilesCache";
import { imperative } from "@zowe/cli";
import { DirEntry, FileEntry } from "../types";

export type UriFsInfo = {
    isRoot: boolean;
    slashAfterProfilePos: number;
    profileName: string;
    profile: imperative.IProfileLoaded;
};

/**
 * Returns the metadata for a given URI in the FileSystem.
 * @param uri The "Zowe-compliant" URI to extract info from
 * @returns a metadata type with info about the URI
 */
export function getInfoForUri(uri: vscode.Uri, profilesCache?: ProfilesCache): UriFsInfo {
    // Paths pointing to the session root will have the format `<scheme>:/{lpar_name}`
    const slashAfterProfilePos = uri.path.indexOf("/", 1);
    const isRoot = slashAfterProfilePos === -1;

    // Determine where to parse profile name based on location of first slash
    const startPathPos = isRoot ? uri.path.length : slashAfterProfilePos;

    // Load profile that matches the parsed name
    // Remove "$conflicts" (if present) to get the profile based on the conflict URI
    const profileName = uri.path.substring(1, startPathPos).replace("$conflicts", "");

    return {
        isRoot,
        slashAfterProfilePos,
        profileName,
        profile: profilesCache?.loadNamedProfile(profileName),
    };
}

export function isDirectoryEntry(entry: any): entry is DirEntry {
    return entry != null && entry["type"] === vscode.FileType.Directory;
}

export function isFileEntry(entry: any): entry is FileEntry {
    return entry != null && entry["type"] === vscode.FileType.File;
}
