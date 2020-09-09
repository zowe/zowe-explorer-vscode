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
import { ZoweUSSNode } from "../uss/ZoweUSSNode";
import { MockMethod } from "../decorators/MockMethod";
import { IZoweUSSTreeNode, IZoweDatasetTreeNode, IZoweTreeNode } from "../api/IZoweTreeNode";
import { createTreeView } from "../../__mocks__/mockCreators/shared";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";

/**
 * A tree that contains nodes of files and folders
 *
 * @export
 * @class USSTree
 * @implements {vscode.TreeDataProvider}
 */
export class USSTree implements vscode.TreeDataProvider<ZoweUSSNode> {
    public mSessionNodes: ZoweUSSNode[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<ZoweUSSNode | undefined> = new vscode.EventEmitter<ZoweUSSNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<ZoweUSSNode | undefined> = this.mOnDidChangeTreeData.event;
    public mFavorites: ZoweUSSNode[];

    /**
     * @param {IZoweUSSTreeNode} node
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public addFavorite(node: IZoweUSSTreeNode) {}

    /**
     * @param {string} itemPath
     * @param {IZoweUSSTreeNode} sessionNode
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public async openItemFromPath(itemPath: string, sessionNode: IZoweUSSTreeNode) {}

    /**
     * @param {IZoweUSSTreeNode} node
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public removeFavorite(node: IZoweUSSTreeNode) {}

    /**
     * @returns {IZoweUSSTreeNode[]}
     * @memberof USSTree
     */
    @MockMethod()
    public getAllLoadedItems(): IZoweUSSTreeNode[] {
        return null;
    }

    /**
     * @returns {vscode.TreeView<ZoweTreeProvider>}
     * @memberof USSTree
     */
    @MockMethod()
    public getTreeView(): vscode.TreeView<ZoweTreeProvider> {
        return createTreeView();
    }

    /**
     * @param {vscode.TreeView<IZoweTreeNode>} treeView
     * @param {IZoweTreeNode} item
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public setItem(treeView: vscode.TreeView<IZoweTreeNode>, item: IZoweTreeNode) {}

    /**
     * @param {string} criteria
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public addSearchHistory(criteria: string) {}

    /**
     * @param {IZoweDatasetTreeNode} element
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public refreshElement(element: IZoweDatasetTreeNode) {}

    /**
     * @param {IZoweUSSTreeNode} node
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public checkCurrentProfile(node: IZoweUSSTreeNode) {}

    /**
     * @param {string} name - The name to remove from the file history array
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public removeFileHistory(name: string) {}

    /**
     * @param {string} criteria - The name to add to the file history array
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public addFileHistory(criteria: string) {}

    /**
     * @returns {string[]}
     * @memberof USSTree
     */
    @MockMethod()
    // tslint:disable-next-line:no-empty
    public getFileHistory(): string[] {
        return null;
    }

    /**
     * Takes argument of type ZoweUSSNode and returns it converted to a general [TreeItem]
     *
     * @param {ZoweUSSNode} element - The ZoweUSSNode that is to be converted
     * @returns {vscode.TreeItem}
     * @memberof USSTree
     */
    @MockMethod()
    public getTreeItem(element: ZoweUSSNode): vscode.TreeItem {
        return null;
    }

    /**
     * Takes argument of type ZoweUSSNode and retrieves all of the first level children
     *
     * @param {ZoweUSSNode} [element] - The ZoweUSSNode that is to be converted
     * @returns {Thenable<ZoweUSSNode[]>}
     * @memberof USSTree
     */
    @MockMethod()
    public getChildren(element?: ZoweUSSNode): Promise<ZoweUSSNode[]> {
        return new Promise<ZoweUSSNode[]>((resolve) => {
            return resolve(null);
        });
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     * @memberof USSTree
     */
    @MockMethod()
    public refresh(): void {
        return null;
    }

    /**
     * Check if the parent exists, and return null if it has no parent
     *
     * @param {ZoweUSSNode} element - The ZoweUSSNode of which to retrieve the parent
     * @returns {vscode.ProviderResult<ZoweUSSNode>}
     * @memberof USSTree
     */
    @MockMethod()
    public getParent(element: ZoweUSSNode): vscode.ProviderResult<ZoweUSSNode> {
        return null;
    }

    @MockMethod()
    public async addSession(sessionName?: string): Promise<void> {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }

    @MockMethod()
    public async deleteSession(node?: ZoweUSSNode): Promise<void> {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }
}
