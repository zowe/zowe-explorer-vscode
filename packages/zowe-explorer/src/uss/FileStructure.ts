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

import * as path from "path";
import * as globals from "../globals";
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
 * Type guard that validates an untrusted value (ie parsed from the clipboard)
 * has the shape of a `UssFileTree` node before it is used anywhere else.
 * path value is always recomputed locally, never taken from the input
 */
export function isValidUssFileTree(node: unknown): node is UssFileTree {
    if (typeof node !== "object" || node === null) {
        return false;
    }
    const tree = node as Record<string, unknown>;
    if (typeof tree.ussPath !== "string") {
        return false;
    }
    if (tree.type !== UssFileType.File && tree.type !== UssFileType.Directory) {
        return false;
    }
    if (tree.baseName != null && typeof tree.baseName !== "string") {
        return false;
    }
    if (tree.sessionName != null && typeof tree.sessionName !== "string") {
        return false;
    }
    if (tree.binary != null && typeof tree.binary !== "boolean") {
        return false;
    }
    if (tree.children != null && (!Array.isArray(tree.children) || !tree.children.every((child) => isValidUssFileTree(child)))) {
        return false;
    }
    return true;
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

    /**
     * Recomputes the local file system path for a USS path that is about to be
     * pasted, ignoring any `localPath` supplied by the clipboard
     * contents. The resulting path is guaranteed to live inside `globals.USS_DIR`.
     *
     * @param profileName The name of the profile that owns the paste destination
     * @param ussPath The remote USS path taken from the (untrusted) file tree node
     * @returns An absolute local path underneath `globals.USS_DIR`
     * @throws if `ussPath` is not a safe, containable path
     */
    public static resolveLocalPath(profileName: string, ussPath: string): string {
        ZoweLogger.trace("UssFileUtils.resolveLocalPath called.");
        const invalidPathMsg = "Cannot paste: missing or invalid USS path";
        if (typeof ussPath !== "string" || ussPath.length === 0) {
            throw new Error(`${invalidPathMsg}.`);
        }

        // Treat the USS path as relative to the local USS directory: strip any
        // leading slashes and reject drive letters/UNC roots/".." segments so it
        // can never be interpreted as an OS-absolute path or escape via traversal.
        const segments = ussPath.split(/[/\\]+/).filter((segment) => segment.length > 0 && segment !== ".");
        const isUnsafeSegment = (segment: string): boolean => segment === ".." || /^[a-zA-Z]:$/.test(segment);
        if (segments.some(isUnsafeSegment)) {
            throw new Error(`${invalidPathMsg} "${ussPath}".`);
        }

        const ussDir = path.resolve(globals.USS_DIR);
        const localPath = path.resolve(ussDir, profileName ?? "", ...segments);
        if (localPath !== ussDir && !localPath.startsWith(ussDir + path.sep)) {
            throw new Error(`${invalidPathMsg} "${ussPath}".`);
        }

        return localPath;
    }
}
