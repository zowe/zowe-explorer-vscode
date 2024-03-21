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
import * as imperative from "@zowe/imperative";
import { IZoweTreeNode } from "./IZoweTreeNode";
import { PersistenceSchemaEnum } from "../profiles/UserSettings";
import { Types } from "../Types";

/**
 * The base interface for Zowe tree browsers that implement the
 * vscode.TreeDataProvider.
 *
 * @export
 * @interface IZoweTree
 * @extends {vscode.TreeDataProvider<T>}
 * @template T provide a subtype of vscode.TreeItem
 */
export interface IZoweTree<T> extends vscode.TreeDataProvider<T>, Partial<vscode.TreeDragAndDropController<T>> {
    /**
     * Root session nodes
     */
    mSessionNodes: IZoweTreeNode[];
    /**
     * Root favorites node
     */
    mFavoriteSession: IZoweTreeNode;
    /**
     * Array of favorite nodes
     */
    mFavorites: IZoweTreeNode[];

    /**
     * Defines the last node that was opened in the editor
     */
    lastOpened?: Types.ZoweNodeInteraction;

    /**
     * Whether the tree is copying files.
     *
     * `await` this promise to wait for the copy operation to complete.
     */
    copying?: Promise<unknown>;

    /**
     * A record of open files from this tree.
     */
    openFiles?: Record<string, IZoweTreeNode>;

    /**
     * Adds a session to the container
     * @param sessionName
     * @param type e.g. zosmf
     * @param provider tree provider to add to, undefined will add for all
     */
    addSession(sessionName?: string, type?: string, provider?: IZoweTree<IZoweTreeNode>): Promise<void>;

    /**
     * Adds a single session to the tree
     * @param profile the profile to add to the tree
     */
    addSingleSession(profile: imperative.IProfileLoaded): Promise<void>;

    /**
     * Edit a session to the container
     * @param node This parameter identifies the node that needs to be called
     */
    editSession(node: IZoweTreeNode, zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<void>;

    /**
     * Get sessions from persistent object of provider
     */
    getSessions(): string[];

    /**
     * Add a new session to the container
     * @param zoweFileProvider The tree to which the profile should be added
     */
    createZoweSession(zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<void>;

    /**
     * Create a brand new Schema
     * @param zoweFileProvider The tree from which the schema will be created
     */
    createZoweSchema(zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<void>;

    /**
     * Adds a favorite node
     * @param favorite Adds a favorite node
     */
    checkCurrentProfile(node: IZoweTreeNode);

    /**
     * Log in to authentication service
     * @param node This parameter identifies the node that needs to be called
     */
    ssoLogin(node: IZoweTreeNode);

    /**
     * Log out from authentication service
     * @param node This parameter identifies the node that needs to be called
     */
    ssoLogout(node: IZoweTreeNode);

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
     * Removes profile node from Favorites section
     * @param profileName
     */
    removeFavProfile(profileName: string, userSelected: boolean);
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
     * Signals that node data has changed in the tree view
     * @param element to pass to event listener callback
     */
    nodeDataChanged?(node: IZoweTreeNode): void;
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
     * Rename the node. Begins a dialog.
     * @param the node to be renamed
     */
    rename(node: IZoweTreeNode);
    /**
     * Opens the node. Begins a dialog.
     * @param node: the node to be opened
     * @param preview: open in preview of edit mode
     */
    open(node: IZoweTreeNode, preview: boolean);
    /**
     * Begins a copy operation on the node.
     * @param node: the node to be copied
     */
    copy(node: IZoweTreeNode);
    /**
     * Concludes a copy/paste operation on the node.
     * @param node: the node to be pasted
     */
    paste(node: IZoweTreeNode);
    /**
     * Deletes a node.
     * @param node: the node to be deleted
     */
    delete(node: IZoweTreeNode);
    /**
     * Reveals and selects a node within the tree.
     * @param treeView: the vscode tree container
     * @param node: the node to be selected
     */
    setItem(treeView: vscode.TreeView<IZoweTreeNode>, node: IZoweTreeNode);
    /**
     * Saves the currently employed filter as a favorite.
     * @param node: A root node representing a session
     */
    saveSearch(node: IZoweTreeNode);
    /**
     * Saves an edited file.
     * @param node: the node to be saved
     */
    saveFile(document: vscode.TextDocument);

    refreshPS(node: IZoweTreeNode);

    uploadDialog(node: IZoweTreeNode);

    /**
     * Begins a filter/search operation on a node.
     * @param node: the root node to be searched from
     */
    filterPrompt(node: IZoweTreeNode);

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
     * @param hideFromAllTrees: <optional> whether to hide from all trees or just the single tree
     */
    deleteSession(node: IZoweTreeNode, hideFromAllTrees?: boolean);
    /**
     * Lets the user open a dataset by filtering the currently-loaded list
     */
    getAllLoadedItems?(): Promise<IZoweTreeNode[]>;
    /**
     * Retrieves the vscode tree container
     */
    getTreeView(): vscode.TreeView<IZoweTreeNode>;

    /**
     * Finds an equivalent node but not as a favorite
     *
     * @param {IZoweTreeNode} node
     */
    findFavoritedNode(node: IZoweTreeNode): IZoweTreeNode;
    /**
     * Finds the equivalent node but not as a favorite
     *
     * @param {IZoweTreeNode} node
     */
    findNonFavoritedNode(node: IZoweTreeNode): IZoweTreeNode;
    /**
     * Finds the equivalent node, based on isFavorite
     * @param {IZoweTreeNode} node
     */
    findEquivalentNode(node: IZoweTreeNode, isFavorite: boolean): IZoweTreeNode;
    /**
     * Updates favorite
     */
    updateFavorites();
    /**
     * Renames a node from the favorites list
     *
     * @param {IZoweTreeNode} node
     */
    renameFavorite(node: IZoweTreeNode, newLabel: string);
    /**
     * Renames a node based on the profile and it's label
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
     * Removes session from the session array
     * @param {string} name the sessions to remove
     */
    removeSession?(name: string): void;
    /**
     * Returns a new dataset filter string, from an old filter and a new string
     *
     * @param {string} newFilter the new filter to add
     * @param {IZoweTreeNode} node the node with the old filter
     */
    createFilterString?(newFilter: string, node: IZoweTreeNode);
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
     * @param {IZoweTreeNode} sessionNode the session to use
     */
    openItemFromPath?(path: string, sessionNode: IZoweTreeNode);
    /**
     * Adds template for data set creation attributes
     *
     * @param {any} criteria the member name to add
     */
    addDsTemplate?(criteria: Types.DataSetAllocTemplate): void;
    /**
     * Returns the array of saved templates for data set creation attributes
     *
     * @returns {DataSetAllocTemplate[]} the array of recently-opened member names
     */
    getDsTemplates?(): Types.DataSetAllocTemplate[];
    /* Initializes polling (refresh w/ configurable interval) for the provided node.
     *
     * @param {IZoweTreeNode} node the node to poll data for
     */
    pollData?(node: IZoweTreeNode): any;
}
