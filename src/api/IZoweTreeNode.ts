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

import * as vscode from "vscode";
import { Session, IProfileLoaded } from "@zowe/imperative";
import { IJob } from "@zowe/cli";
import { IZoweTree } from "./IZoweTree";

export type IZoweNodeType = IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode;

/**
 * The base interface for Zowe tree nodes that are implemented by vscode.TreeItem.
 *
 * @export
 * @interface IZoweTreeNode
 */
export interface IZoweTreeNode {
    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
     */
    iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
    /**
     * Indicator that the child data may have become stale and requires refreshing.
     */
    dirty: boolean;
    /**
     *  A human-readable string describing this item.
     */
    label?: string;
    /**
     * The tooltip text when you hover over this item.
     */
    tooltip?: string;
    /**
     * Describes the full path of a file
     */
    fullPath?: string;
    /**
     * Children nodes of this node
     */
    children?: IZoweTreeNode[];
    /**
     * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
     */
    collapsibleState?: vscode.TreeItemCollapsibleState;
    /**
     * Context value of the tree item. This can be used to contribute item specific actions in the tree.
     *
     * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
     */
    contextValue?: string;
    /**
     * Retrieves the node label
     */
    getLabel(): string;
    /**
     * Retrieves the nodes parent node
     */
    getParent(): IZoweTreeNode;
    /**
     * Retrieves the nodes children nodes
     */
    getChildren(): Promise<IZoweTreeNode[]>;
    /**
     * Retrieves the profile name in use with this node
     */
    getProfileName(): string;
    /**
     * Retrieves the session node in use with this node
     */
    getSessionNode(): IZoweTreeNode;
    /**
     * Retrieves the session object in use with this node
     */
    getSession(): Session;
    /**
     * Retrieves the profile object in use with this node
     */
    getProfile(): IProfileLoaded;
    /**
     * Set the profile to use for this node to be the one chosen in the parameters
     *
     * @param profileObj The profile you will set the node to use
     */
    setProfileToChoice(profileObj: IProfileLoaded): void;
    /**
     * Set the session to use for this node to be the one chosen in the parameters
     *
     * @param sessionObj The session you will set the node to use
     */
    setSessionToChoice(sessionObj: Session): void;
}

/**
 * Extended interface for Zowe Dataset tree nodes.
 *
 * @export
 * @interface export interface IZoweDatasetTreeNode extends IZoweTreeNode {
 */
export interface IZoweDatasetTreeNode extends IZoweTreeNode {
    /**
     * Search criteria for a Dataset search
     */
    pattern?: string;

    /**
     * Retrieves child nodes of this IZoweDatasetTreeNode
     *
     * @returns {Promise<IZoweDatasetTreeNode[]>}
     */
    getChildren(): Promise<IZoweDatasetTreeNode[]>;
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
}

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
    binaryFiles?: {};
    /**
     * Binary indicator. Default false (text)
     */
    binary?: boolean;
    /**
     * Specific profile name in use with this node
     */
    mProfileName?: string;
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
    // /**
    //  * Opens the text document
    //  * @return vscode.TextDocument
    //  */
    // getOpenedDocumentInstance?(): vscode.TextDocument;
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
     */
    deleteUSSNode?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string);
    /**
     * Process for renaming a USS Node. This could be a Favorite Node
     *
     * @param {USSTree} ussFileProvider
     * @param {string} filePath
     */
    renameUSSNode?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string);
    /**
     * Refreshes node and reopens it.
     * @param hasClosedInstance
     */
    refreshAndReopen?(hasClosedInstance?: boolean);
    /**
     * Adds a search node to the USS favorites list
     *
     * @param {USSTree} ussFileProvider
     */
    saveSearch?(ussFileProvider: IZoweTree<IZoweUSSTreeNode>);
}

/**
 * Extended interface for Zowe Job tree nodes.
 *
 * @export
 * @interface export interface IZoweJobTreeNode extends IZoweTreeNode {
 */
export interface IZoweJobTreeNode extends IZoweTreeNode {
    /**
     * Standard job response document
     * Represents the attributes and status of a z/OS batch job
     * @interface IJob
     */
    job?: IJob;
    /**
     * Search criteria for a Job search
     */
    searchId?: string;
    /**
     * Job Prefix i.e "MYJOB"
     * Attribute of Job query
     */
    prefix?: string;
    /**
     * Job Owner i.e "MYID"
     * Attribute of Job query
     */
    owner?: string;
    /**
     * Retrieves child nodes of this IZoweJobTreeNode
     *
     * @returns {Promise<IZoweJobTreeNode[]>}
     */
    getChildren(): Promise<IZoweJobTreeNode[]>;
}
