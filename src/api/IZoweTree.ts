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
import { IZoweNodeType, IZoweDatasetTreeNode, IZoweUSSTreeNode } from "./IZoweTreeNode";
import { PersistenceSchemaEnum } from "../globals";

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
    mSessionNodes: IZoweNodeType[];
    /**
     * Root favorites node
     */
    mFavoriteSession: IZoweNodeType;
    /**
     * Array of favorite nodes
     * @deprecated should not be visible outside of class
     */
    mFavorites: IZoweNodeType[];

    /**
     * Adds a session to the container
     * @param sessionName
     * @param type e.g. zosmf
     */
    addSession(sessionName?: string, type?: string): Promise<void>;
    /**
     * Edit a session to the container
     * @param node This parameter identifies the node that needs to be called
     */
    editSession(node: IZoweNodeType): Promise<void>;

    /**
     * Add a new session to the container
     * @param zoweFileProvider The tree to which the profile should be added
     */
    createZoweSession(zoweFileProvider: IZoweTree<IZoweNodeType>): Promise<void>;


    /**
     * Adds a favorite node
     * @param favorite Adds a favorite node
     */
    checkCurrentProfile(node: IZoweNodeType);
    /**
     * Adds a favorite node
     * @param favorite Adds a favorite node
     */
    addFavorite(favorite: IZoweNodeType);
    /**
     * Removes a favorite node
     * @param favorite Adds a favorite node
     */
    removeFavorite(node: IZoweNodeType);
    /**
     * Refreshes the tree
     */
    refresh(): void;
    /**
     * Refreshes an element of the tree
     * @param favorite Node to refresh
     */
    refreshElement(node: IZoweNodeType): void;
    /**
     * Event Emitters used to notify subscribers that the refresh event has fired
     */
    onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent);
    /**
     * Change the state of an expandable node
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    flipState(element: IZoweNodeType, isOpen: boolean);

    /**
     * Rename the node. Begins a dialog.
     * @param the node to be renamed
     */
    rename(node: IZoweNodeType);
    /**
     * Opens the node. Begins a dialog.
     * @param node: the node to be opened
     * @param preview: open in preview of edit mode
     */
    open(node: IZoweNodeType, preview: boolean);
    /**
     * Begins a copy operation on the node.
     * @param node: the node to be copied
     */
    copy(node: IZoweNodeType);
    /**
     * Concludes a copy/paste operation on the node.
     * @param node: the node to be pasted
     */
    paste(node: IZoweNodeType);
    /**
     * Deletes a node.
     * @param node: the node to be deleted
     */
    delete(node: IZoweNodeType);
    /**
     * Reveals and selects a node within the tree.
     * @param treeView: the vscode tree container
     * @param node: the node to be selected
     */
    setItem(treeView: vscode.TreeView<IZoweNodeType>, node: IZoweNodeType);
    /**
     * Saves the currently employed filter as a favorite.
     * @param node: A root node representing a session
     */
    saveSearch(node: IZoweNodeType);
    /**
     * Saves an edited file.
     * @param node: the node to be saved
     */
    saveFile(document: vscode.TextDocument);

    // TODO
    refreshPS(node: IZoweNodeType);

    uploadDialog(node: IZoweDatasetTreeNode): any;

    // TODO replace with filterPrompt
    // datasetFilterPrompt(node: IZoweNodeType): any;
    // filterPrompt(node: IZoweUSSTreeNode): any;
    // searchPrompt(node: IZoweJobTreeNode): any;
    /**
     * Begins a filter/serach operation on a node.
     * @param node: the root node to be searched from
     */
    filterPrompt(node: IZoweNodeType);

    /**
     * Adds a search history element to persisted settings.
     * @param node: the root node representing the operation
     */
    addSearchHistory(element: string);
    /**
     * Retrieves search history elements from persisted settings.
     */
    getSearchHistory();
    /**
     * Returns the type of the tree provider.
     * @returns {PersistenceSchemaEnum} the type of tree: Dataset, USS, or Job
     */
    getTreeType(): PersistenceSchemaEnum;
    /**
     * Deletes a root node from the tree.
     * @param node: A root node representing a session
     */
    deleteSession(node: IZoweNodeType): any;
    /**
     * Lets the user open a dataset by filtering the currently-loaded list
     */
    getAllLoadedItems?(): Promise<IZoweUSSTreeNode[]>;
    /**
     * Retrieves the vscode tree container
     */
    getTreeView(): vscode.TreeView<IZoweNodeType>;

    /**
     * Finds an equivalent node but not as a favorite
     *
     * @param {IZoweDatasetTreeNode} node
     * @deprecated should not be visible outside of class
     */
    findFavoritedNode(node: IZoweNodeType): IZoweNodeType;
    /**
     * Finds the equivalent node but not as a favorite
     *
     * @param {IZoweDatasetTreeNode} node
     * @deprecated should not be visible outside of class
     */
    findNonFavoritedNode(node: IZoweNodeType): IZoweNodeType;
    /**
     * Updates favorite
     *
     * @deprecated should not be visible outside of class
     */
    updateFavorites();
    /**
     * Renames a node from the favorites list
     *
     * @param {IZoweDatasetTreeNode} node
     * @deprecated should not be visible outside of class
     */
    renameFavorite(node: IZoweDatasetTreeNode, newLabel: string);
    /**
     * Renames a node based on the profile and it's label
     * @deprecated should not be visible outside of class
     *
     * @param {string} criteria the member name to add
     */
    addFileHistory?(criteria: string);
    /**
     * Returns the array of recently-opened member names
     *
     * @returns {string[]} the array of recently-opened member names
     */
    getFileHistory?();
    /**
     * Removes a member name from the recently-opened members array
     *
     * @param {string} name the member to remove
     */
    removeFileHistory?(name: string);
    /**
     * Returns a new dataset filter string, from an old filter and a new string
     *
     * @param {string} newFilter the new filter to add
     * @param {IZoweDatasetTreeNode} node the node with the old filter
     */
    createFilterString?(newFilter: string, node: IZoweNodeType);
    /**
     * @param {string} profileLabel
     * @param {string} beforeLabel
     * @param {string} afterLabel
     */
    renameNode(profile: string, beforeDataSetName: string, afterDataSetName: string);
    /**
     * Opens an item & reveals it in the tree
     *
     * @param {string} path the path of the item
     * @param {IZoweNodeType} sessionNode the session to use
     */
    openItemFromPath?(path: string, sessionNode: IZoweNodeType);
}
