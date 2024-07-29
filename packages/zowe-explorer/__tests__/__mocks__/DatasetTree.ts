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
import { ZoweDatasetNode } from "../../src/trees/dataset/ZoweDatasetNode";
import { MockMethod } from "../__decorators__/MockMethod";

/**
 * A tree that contains nodes of files and folders
 *
 * @export
 * @class DatasetTree
 * @implements {vscode.TreeDataProvider}
 */
export class DatasetTree implements vscode.TreeDataProvider<ZoweDatasetNode> {
    public mSessionNodes: ZoweDatasetNode[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<ZoweDatasetNode | undefined> = new vscode.EventEmitter<ZoweDatasetNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<ZoweDatasetNode | undefined> = this.mOnDidChangeTreeData.event;

    /**
     * Takes argument of type ZoweDatasetNode and returns it converted to a general [TreeItem]
     *
     * @param {ZoweDatasetNode} element - The ZoweDatasetNode that is to be converted
     * @returns {vscode.TreeItem}
     * @memberof DatasetTree
     */
    @MockMethod()
    public getTreeItem(_element: ZoweDatasetNode): vscode.TreeItem {
        return null as any;
    }

    /**
     * Takes argument of type ZoweDatasetNode and retrieves all of the first level children
     *
     * @param {ZoweDatasetNode} [element] - The ZoweDatasetNode that is to be converted
     * @returns {Thenable<ZoweDatasetNode[]>}
     * @memberof DatasetTree
     */
    @MockMethod()
    public getChildren(_element?: ZoweDatasetNode): Promise<ZoweDatasetNode[]> {
        return Promise.resolve([]);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     * @memberof DatasetTree
     */
    @MockMethod()
    public refresh(): void {
        return;
    }

    /**
     * Check if the parent exists, and return null if it has no parent
     *
     * @param {ZoweDatasetNode} element - The ZoweDatasetNode of which to retrieve the parent
     * @returns {vscode.ProviderResult<ZoweDatasetNode>}
     * @memberof DatasetTree
     */
    @MockMethod()
    public getParent(_element: ZoweDatasetNode): vscode.ProviderResult<ZoweDatasetNode> {
        return null;
    }

    @MockMethod()
    public addSession(_sessionName?: string): void | Promise<void> {
        return Promise.resolve();
    }

    @MockMethod()
    public deleteSession(_node?: ZoweDatasetNode): void {}

    @MockMethod()
    public removeFavorite(_node: ZoweDatasetNode): void | Promise<void> {
        return Promise.resolve();
    }
}
