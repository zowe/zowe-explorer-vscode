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
import { ZoweTreeNode } from "@zowe/zowe-explorer-api";

export namespace IconUtils {
    export enum IconId {
        "document" = "document",
        "documentBinary" = "documentBinary",
        "downloadedDocument" = "downloadedDocument",
        "documentBinaryDownloaded" = "documentBinaryDownloaded",
        "pattern" = "pattern",
        "session" = "session",
        "sessionInactive" = "sessionInactive",
        "sessionActive" = "sessionActive",
        "sessionActiveOpen" = "sessionActiveOpen",
        "sessionOpen" = "sessionOpen",
        "sessionFavourite" = "sessionFavourite",
        "sessionFavouriteOpen" = "sessionFavouriteOpen",
        "filterFolder" = "filterFolder",
        "filterFolderOpen" = "filterFolderOpen",
        "folder" = "folder",
        "folderOpen" = "folderOpen",
        "migrated" = "migrated",
        "fileError" = "fileError",
        "vsam" = "vsam",
        "home" = "home",
    }

    export enum IconHierarchyType {
        "base" = "base",
        "derived" = "derived",
    }

    export type TreeNode = vscode.TreeItem | ZoweTreeNode;

    export interface IIconItem {
        id: IconId;
        type: IconHierarchyType;
        path: { light: string; dark: string };
        check: (node: TreeNode) => boolean;
    }
}
