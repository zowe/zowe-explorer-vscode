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
import { ZoweDatasetNode } from "../dataset/ZoweDatasetNode";
import { MockMethod } from "../decorators/MockMethod";

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
        return null;
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
        return new Promise<ZoweDatasetNode[]>((resolve) => {
            return resolve(null);
        });
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     * @memberof DatasetTree
     */
    @MockMethod()
    public refresh(): void {
        return null;
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
    public async addSession(_sessionName?: string): Promise<void> {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }

    @MockMethod()
    public async deleteSession(_node?: ZoweDatasetNode): Promise<void> {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }

    @MockMethod()
    public async removeFavorite(_node: ZoweDatasetNode) {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }
}
