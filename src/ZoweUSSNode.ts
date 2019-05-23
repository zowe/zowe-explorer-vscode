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

import * as zowe from "@brightside/core";
import { Session } from "@brightside/imperative";
import * as vscode from "vscode";

/**
 * A type of TreeItem used to represent sessions and USS directories and files
 *
 * @export
 * @class ZoweUSSNode
 * @extends {vscode.TreeItem}
 */
export class ZoweUSSNode extends vscode.TreeItem {
    public command: vscode.Command;
    public fullPath = "";
    public dirty = true;
    public children: ZoweUSSNode[] = [];
    public binaryFiles = {};
    public profileName = "";
    public shortLabel = "";

    /**
     * Creates an instance of ZoweUSSNode
     *
     * @param {string} mLabel - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} mCollapsibleState - file/directory
     * @param {ZoweUSSNode} mParent - The parent node
     * @param {Session} session
     * @param {String} parentPath - The file path of the parent on the server
     * @param {String} mProfileName - Profile to which the node belongs to
     */
    constructor(public mLabel: string,
                public mCollapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: ZoweUSSNode,
                private session: Session,
                private parentPath: string,
                public binary = false,
                private mProfileName?: string) {
        super(mLabel, mCollapsibleState);
        if (mCollapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = "directory";
        } else if (binary) {
            this.contextValue = "binaryFile";
        } else {
            this.contextValue = "textFile";
        }
        if (parentPath) {
            this.fullPath = this.tooltip = parentPath + "/" + mLabel;
            if (parentPath === "/") {
                // Keep fullPath of root level nodes preceded by a single slash
                this.fullPath = this.tooltip = "/" + mLabel;
            }
        }
        if (this.mParent && this.mParent.contextValue === 'favorite') {
            this.profileName = "[" + mProfileName + "]: ";
            this.fullPath = mLabel.trim();
            // File or directory name only (no parent path)
            this.shortLabel = this.fullPath.split('/', this.fullPath.length).pop(); 
            // Display name for favorited file or directory in tree view
            this.label = this.profileName + this.shortLabel; 
            this.tooltip = this.profileName + this.fullPath;
        }
    }

    /**
     * Retrieves child nodes of this ZoweUSSNode
     *
     * @returns {Promise<ZoweUSSNode[]>}
     */
    public async getChildren(): Promise<ZoweUSSNode[]> {
        if ((!this.fullPath && this.contextValue === "uss_session") || 
                (this.contextValue === "textFile" || this.contextValue === "binaryFile")) {
            return [];
        }

        if (!this.dirty) {
            return this.children;
        }

        if (!this.mLabel) {
            vscode.window.showErrorMessage("Invalid node");
            throw Error("Invalid node");
        }

        // Gets the directories from the fullPath and displays any thrown errors
        const responses: zowe.IZosFilesResponse[] = [];
        let response: any;
        try {
            responses.push(await zowe.List.fileList(this.getSession(), this.fullPath));
        } catch (err) {
            vscode.window.showErrorMessage(`Retrieving response from zowe.List\n${err}\n`);
            throw Error(`Retrieving response from zowe.List\n${err}\n`);
        }

        // push nodes to an object with property names to avoid duplicates
        const elementChildren = {};
        let fullPath;
        responses.forEach((response) => {
            // Throws reject if the brightside command does not throw an error but does not succeed
            if (!response.success) {
                throw Error("The response from Zowe CLI was not successful");
            }

            // Loops through all the returned file references members and creates nodes for them
            for (const item of response.apiResponse.items) {
                if (item.name !== '.' && item.name !== '..') {
                    // Creates a ZoweUSSNode for a directory
                    if (item.mode.startsWith('d')) {
                        const temp = new ZoweUSSNode(item.name, vscode.TreeItemCollapsibleState.Collapsed, this, null, this.fullPath);
                        elementChildren[temp.label] = temp;
                    } else {
                        // Creates a ZoweUSSNode for a file
                        let temp;
                        if(this.getSessionNode().binaryFiles.hasOwnProperty(this.fullPath + '/' + item.name)) {
                            temp = new ZoweUSSNode(item.name, vscode.TreeItemCollapsibleState.None, this, null, this.fullPath, true);
                        } else {
                            temp = new ZoweUSSNode(item.name, vscode.TreeItemCollapsibleState.None, this, null, this.fullPath);
                        }
                        temp.command = {command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [temp]};
                        elementChildren[temp.label] = temp;
                    }
                }
            }
        });

        if (this.contextValue === "uss_session") {
            this.dirty = false;
        }
        return this.children = Object.keys(elementChildren).sort().map((labels) => elementChildren[labels]);
    }

    /**
     * Returns the [Session] for this node
     *
     * @returns {Session}
     */
    public getSession(): Session {
        return this.session || this.mParent.getSession();
    }

    /**
     * Returns the session node for this node
     *
     * @returns {ZoweUSSNode}
     */
    public getSessionNode(): ZoweUSSNode {
        return this.session ? this : this.mParent.getSessionNode();
    }

    public setBinary(binary: boolean) {
        this.binary = binary;
        if(this.binary){
            this.contextValue = "binaryFile";
            this.getSessionNode().binaryFiles[this.fullPath] = true;
        } else {
            this.contextValue = "textFile";
            delete this.getSessionNode().binaryFiles[this.fullPath];
        }
        if (this.mParent && this.mParent.contextValue === 'favorite') {
            this.binary ? this.contextValue = "binaryFilef" : this.contextValue = "textFilef";
        }
        this.dirty = true;
    }
}
