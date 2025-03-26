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
import { IZoweTreeNode, ZosEncoding } from "./IZoweTreeNode";
import { PersistenceSchemaEnum } from "../profiles/UserSettings";
import { Types } from "../Types";
import { Validation } from "../profiles/Validation";

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
     * @deprecated Unused in v3 since open files are now tracked by the `FileSystemProvider`
     */
    openFiles?: Record<string, IZoweTreeNode>;

    /**
     * Adds a session to the container
     * @param opts Options for adding sessions to tree
     */
    addSession(opts?: Types.AddSessionOpts): void | Promise<void>;

    /**
     * Adds a single session to the tree
     * @param profile the profile to add to the tree
     */
    addSingleSession(profile: imperative.IProfileLoaded): void | Promise<void>;

    /**
     * Edit a session to the container
     * @param node This parameter identifies the node that needs to be called
     */
    editSession(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Get sessions from persistent object of provider
     */
    getSessions(): string[];

    /**
     * Add a new session to the container
     * @param zoweFileProvider The tree to which the profile should be added
     */
    createZoweSession(zoweFileProvider: IZoweTree<IZoweTreeNode>): void | Promise<void>;

    /**
     * Create a brand new Schema
     * @param zoweFileProvider The tree from which the schema will be created
     */
    createZoweSchema(zoweFileProvider: IZoweTree<IZoweTreeNode>): void | Promise<void>;

    /**
     * Validates the profile for the given node
     * @param node Node to validate/check its current profile
     */
    checkCurrentProfile(node: IZoweTreeNode): Validation.IValidationProfile | Promise<Validation.IValidationProfile>;

    /**
     * Log in to authentication service
     * @param node This parameter identifies the node that needs to be called
     */
    ssoLogin(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Log out from authentication service
     * @param node This parameter identifies the node that needs to be called
     */
    ssoLogout(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Adds a favorite node
     * @param favorite Adds a favorite node
     */
    addFavorite(favorite: IZoweTreeNode): void | Promise<void>;

    /**
     * refresh favorites
     * @param favorite Adds a favorite node
     */
    refreshFavorites?(): void | Promise<void>;

    /**
     * Removes a favorite node
     * @param favorite Adds a favorite node
     */
    removeFavorite(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Removes profile node from Favorites section
     * @param profileName
     */
    removeFavProfile(profileName: string, userSelected: boolean): void | Promise<void>;

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
    onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent): void | Promise<void>;

    /**
     * Change the state of an expandable node
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     *
     * @deprecated Use `onCollapsibleStateChange` instead.
     */
    flipState(element: IZoweTreeNode, isOpen: boolean): void;

    /**
     * Handle updates to a node when the collapsible state is changed by the user.
     *
     * @param element The node whose collapsible state is changing
     * @param newState The new collapsible state of the node
     *
     * Note that the new collapsible state is not guaranteed to be set on the node when this function is called.
     * The `newState` parameter contains the accurate collapsible state for the node.
     */
    onCollapsibleStateChange?(element: IZoweTreeNode, newState: vscode.TreeItemCollapsibleState): void | Promise<void>;

    /**
     * Rename the node. Begins a dialog.
     * @param the node to be renamed
     */
    rename(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Opens the node. Begins a dialog.
     * @param node: the node to be opened
     * @param preview: open in preview of edit mode
     */
    open(node: IZoweTreeNode, preview: boolean): void | Promise<void>;

    /**
     * Begins a copy operation on the node.
     * @param node: the node to be copied
     */
    copy(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Concludes a copy/paste operation on the node.
     * @param node: the node to be pasted
     */
    paste(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Deletes a node.
     * @param node: the node to be deleted
     */
    delete(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Reveals and selects a node within the tree.
     * @param treeView: the vscode tree container
     * @param node: the node to be selected
     */
    setItem(treeView: vscode.TreeView<IZoweTreeNode>, node: IZoweTreeNode): void;

    /**
     * Saves the currently employed filter as a favorite.
     * @param node: A root node representing a session
     */
    saveSearch(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Saves an edited file.
     * @param node: the node to be saved
     */
    saveFile(document: vscode.TextDocument): void | Promise<void>;

    /**
     * Refresh the given node with current mainframe data.
     * @param node: the node to be refreshed
     */
    refreshPS(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Confirmation dialog to upload/save the given node.
     * @param node: the node to be uploaded/saved
     */
    uploadDialog(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Begins a filter/search operation on a node.
     * @param node: the root node to be searched from
     */
    filterPrompt(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Adds a search history element to persisted settings.
     * @param node: the root node representing the operation
     */
    addSearchHistory(element: string): void;

    /**
     * Retrieves search history elements from persisted settings.
     */
    getSearchHistory(): string[];

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
    deleteSession(node: IZoweTreeNode, hideFromAllTrees?: boolean): void;

    /**
     * Lets the user open a dataset by filtering the currently-loaded list
     */
    getAllLoadedItems?(): IZoweTreeNode[] | Promise<IZoweTreeNode[]>;

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
    updateFavorites(): void | Promise<void>;

    /**
     * Renames a node from the favorites list
     *
     * @param {IZoweTreeNode} node
     */
    renameFavorite(node: IZoweTreeNode, newLabel: string): void | Promise<void>;

    /**
     * Renames a node based on the profile and it's label
     *
     * @param {string} criteria the member name to add
     */
    addFileHistory?(criteria: string): void;

    /**
     * Returns the array of recently-opened member names
     *
     * @returns {string[]} the array of recently-opened member names
     */
    getFileHistory?(): string[];

    /**
     * Removes a member name from the recently-opened members array
     *
     * @param {string} name the member to remove
     */
    removeFileHistory?(name: string): void;

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
    createFilterString?(newFilter: string, node: IZoweTreeNode): string;

    /**
     * @param {string} profileLabel
     * @param {string} beforeLabel
     * @param {string} afterLabel
     */
    renameNode(profile: string, beforeDataSetName: string, afterDataSetName: string): void | Promise<void>;

    /**
     * Opens an item & reveals it in the tree
     *
     * @param {string} path the path of the item
     * @param {IZoweTreeNode} sessionNode the session to use
     */
    openItemFromPath?(path: string, sessionNode: IZoweTreeNode): void | Promise<void>;

    /**
     * Adds template for data set creation attributes
     *
     * @param {any} criteria the member name to add
     */
    addDsTemplate?(criteria: Types.DataSetAllocTemplate): void | Promise<void>;

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
    pollData?(node: IZoweTreeNode): void | Promise<void>;

    /**
     * Opens resource for the provided node using encoding specified by user.
     * @param {IZoweTreeNode} node
     * @param {ZosEncoding} encoding File encoding, user will be prompted if undefined
     */
    openWithEncoding?(node: IZoweTreeNode, encoding?: ZosEncoding): void | Promise<void>;
}
