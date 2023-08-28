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
import { IZoweTree } from "./IZoweTree";
import { IZoweTreeNode } from "./IZoweTreeNode";
import { FileAttributes } from "../utils/files";

/**
 * Extended interface for Zowe USS tree nodes.
 *
 * @export
 * @interface export interface IZoweUSSTreeNode extends IZoweTreeNode {
 */
export interface IZoweUSSTreeNode extends IZoweTreeNode {
    /**
     * Retrieves an abridged for of the label
     */
    shortLabel?: string;
    /**
     * List of child nodes downloaded in binary format
     */
    binaryFiles?: Record<string, unknown>;
    /**
     * Binary indicator. Default false (text)
     */
    binary?: boolean;
    /**
     * Specific profile name in use with this node
     */
    mProfileName?: string;
    /**
     * File attributes
     */
    attributes?: FileAttributes;
    /**
     * Event that fires whenever an existing node is updated.
     */
    onUpdateEmitter?: vscode.EventEmitter<IZoweUSSTreeNode>;
    /**
     * Event that fires whenever an existing node is updated.
     */
    onUpdate?: vscode.Event<IZoweUSSTreeNode>;
    /**
     * Retrieves child nodes of this IZoweUSSTreeNode
     *
     * @returns {Promise<IZoweUSSTreeNode[]>}
     */
    getChildren(): Promise<IZoweUSSTreeNode[]>;
    /**
     * Retrieves the etag value for the file
     *
     * @returns {string}
     */
    getEtag?(): string;
    /**
     * Sets the etag value for the file
     *
     * @param {string}
     */
    setEtag?(etag: string);
    /**
     * Renaming a USS Node. This could be a Favorite Node
     *
     * @param {string} newNamePath
     */
    rename?(newNamePath: string);
    /**
     * Specifies the field as binary
     * @param binary true is a binary file otherwise false
     */
    setBinary?(binary: boolean);
    /**
     * Downloads and displays a file in a text editor view
     *
     * @param download Download the file default false
     * @param preview the file, true or false
     * @param ussFileProvider the tree provider
     */
    openUSS?(download: boolean, previewFile: boolean, ussFileProvider: IZoweTree<IZoweUSSTreeNode>);
    /**
     * Returns the local file path for the ZoweUSSNode
     *
     */
    getUSSDocumentFilePath?(): string;
    /**
     * Refreshes the node with current mainframe data
     *
     */
    refreshUSS?();
    /**
     *
     * @param ussFileProvider Deletes the USS tree node
     * @param filePath
     * @param cancelled optional
     */
    deleteUSSNode?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string, cancelled?: boolean);
    /**
     * Process for renaming a USS Node. This could be a Favorite Node
     *
     * @param {USSTree} ussFileProvider
     * @param {string} filePath
     */
    renameUSSNode?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string);
    /**
     * Reopens a file if it was closed (e.g. while it was being renamed).
     * @param hasClosedInstance
     */
    reopen?(hasClosedInstance?: boolean);
    /**
     * Adds a search node to the USS favorites list
     *
     * @param {USSTree} ussFileProvider
     */
    saveSearch?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>);
    /**
     * uploads selected uss node(s) to from clipboard to mainframe
     * @deprecated in favor of `pasteUssTree`
     */
    copyUssFile?();

    /**
     * Uploads a tree of USS file(s)/folder(s) to mainframe
     */
    pasteUssTree?();
}
