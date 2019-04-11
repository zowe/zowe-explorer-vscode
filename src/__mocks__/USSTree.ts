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
import { ZoweUSSNode } from "../ZoweUSSNode";
import { MockMethod } from "../decorators/MockMethod";

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
