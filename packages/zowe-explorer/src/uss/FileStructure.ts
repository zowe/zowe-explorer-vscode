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

import { ZoweLogger } from "../utils/LoggerUtils";

/**
 * File types within the USS tree structure
 */
export enum UssFileType {
    File,
    Directory,
}

export interface UssFileTree {
    // The path of the file on the local file system, if it exists
    localPath?: string;

    // The path of the file/directory as defined in USS
    ussPath: string;

    // optional as the root node (for tree building) might not have a base name
    baseName?: string;

    // whether the file is a binary file
    binary?: boolean;

    // Any files/directory trees within this file tree
    children: UssFileTree[];

    // The session where this node comes from (optional for root)
    sessionName?: string;

    // The type of the file (file or directory)
    type: UssFileType;
}

/**
 * Interprets a file/directory list as a tree structure
 */
export class UssFileUtils {
    /**
     * Whether the file tree is going to be pasted within the same session node.
     *
     * @param fileTree The file tree to paste
     * @param destSessionName The name of the destination session
     * @returns true if the tree will be pasted in the same session, and false if otherwise.
     */
    public static toSameSession(fileTree: UssFileTree, destSessionName: string): boolean {
        ZoweLogger.trace("UssFileUtils.toSameSession called.");
        if (fileTree.sessionName && fileTree.sessionName !== destSessionName) {
            return false;
        }

        return fileTree.children.every((node) => UssFileUtils.toSameSession(node, destSessionName));
    }
}
