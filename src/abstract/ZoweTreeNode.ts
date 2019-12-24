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
import { Session } from "@brightside/imperative";
import { IZoweTreeNode } from "../api/ZoweTree";
// import * as extension from "../extension";

/**
 * Common implementation of functions and methods associated with the
 * IZoweTreeNode
 *
 * @export
 * @class ZoweNode
 * @extends {vscode.TreeItem}
 */
export class ZoweTreeNode extends vscode.TreeItem {
    public command: vscode.Command;
    public fullPath = "";
    public dirty = false;
    public children: IZoweTreeNode[] = [];
    public binaryFiles = {};
    public binary = false;
    public shortLabel = "";

    /**
     * Creates an instance of ZoweNode
     *
     * @param {string} label - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} mCollapsibleState - file/folder
     * @param {IZoweTreeNode} mParent
     * @param {Session} session
     * @param {string} etag
     */
    constructor(label: string,
                collapsibleState: vscode.TreeItemCollapsibleState,
                private mParent: IZoweTreeNode,
                protected session: Session) {
        super(label, collapsibleState);
    }

    /**
     * Retrieves parent node of this IZoweTreeNode
     *
     * @returns {Promise<IZoweTreeNode>}
     */
    public getParent(): IZoweTreeNode {
        return this.mParent;
    }

    /**
     * Returns the [Session] for this node
     *
     * @returns {Session}
     */
    public getSession(): Session {
        return this.session || (this.getParent() ? this.getParent().getSession(): undefined);
    }

    /**
     * This is the default was that the label should be accessed as it
     * automatically trims the value
     */
    public getLabel(): string {
        return this.label.trim();
    }
}
