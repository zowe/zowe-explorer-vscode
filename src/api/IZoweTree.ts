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
import { IZoweTreeNode } from "./IZoweTreeNode";

/**
 * The base interface for Zowe tree browsers that implement the
 * vscode.TreeDataProvider.
 *
 * @export
 * @interface IZoweTree
 * @extends {vscode.TreeDataProvider<T>}
 * @template T provide a subtype of vscode.TreeItem
 */
export interface IZoweTree<T> extends vscode.TreeDataProvider<T> {
    /**
     * Root session nodes
     */
    mSessionNodes: T[];
    /**
     * Root favorites node
     */
    mFavoriteSession: T;
    /**
     * Array of favorite nodes
     */
    mFavorites: T[];
    /**
     * Adds a session to the container
     * @param sessionName
     * @param type e.g. zosmf
     */
    addSession(sessionName?: string, type?: string): Promise<void>;
    /**
     * Adds a favorite node
     * @param favorite Adds a favorite node
     */
    addFavorite(favorite: IZoweTreeNode);
    /**
     * Removes a favorite node
     * @param favorite Adds a favorite node
     */
    removeFavorite(node: IZoweTreeNode);
    /**
     * Refreshes the tree
     */
    refresh(): void;
    /**
     * Refreshes an element of the tree
     * @param favorite Node to refresh
     */
    refreshElement(node: IZoweTreeNode): void;
    /**
     * Event Emitters used to notify subscribers that the refresh event has fired
     */
    onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent);
    /**
     * Change the state of an expandable node
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    flipState(element: IZoweTreeNode, isOpen: boolean);
    /**
     * Retrieves the VSCode tree view
     *
     * @returns {vscode.TreeView<IZoweTree>}
     */
    getTreeView(): vscode.TreeView<IZoweTreeNode>;
    /**
     * Adds a recently-opened member to the persistent recall array
     *
     * @param {string} criteria the member name to add
     */
    addRecall?(criteria: string);
    /**
     * Returns the array of recently-opened member names
     *
     * @returns {string[]} the array of recently-opened member names
     */
    getRecall?();
    /**
     * Removes a member name from the recently-opened members array
     *
     * @param {string} name the member to remove
     */
    removeRecall?(name: string);
    /**
     * Allows the user to choose a recent member to open
     *
     */
    openRecentMemberPrompt?();
    /**
     * Returns a new dataset filter string, from an old filter and a new string
     *
     * @param {string} newFilter the new filter to add
     * @param {IZoweDatasetTreeNode} node the node with the old filter
     */
    createFilterString?(newFilter: string, node: IZoweTreeNode);
}
