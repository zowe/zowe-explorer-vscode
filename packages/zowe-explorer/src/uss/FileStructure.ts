/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

/**
 * File types within the USS tree structure
 */
export enum UssFileType {
    File,
    Directory,
}

/**
 * Interprets a file/directory list as a tree structure
 */
export type UssFileTree = {
    // The path of the file/directory as defined in USS
    ussPath: string;

    // optional as the root node (for tree building) might not have a base name
    baseName?: string;

    // Any files/directories within this file tree
    children?: UssFileTree[];

    // The type of the file (file or directoryh)
    type: UssFileType;
};
