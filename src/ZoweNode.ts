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
import * as vscode from "vscode";
import { Session, AbstractSession } from "@brightside/imperative";

/**
 * A type of TreeItem used to represent sessions and data sets
 *
 * @export
 * @class ZoweNode
 * @extends {vscode.TreeItem}
 */
export class ZoweNode extends vscode.TreeItem {
    public command: vscode.Command;
    public pattern = "";
    public dirty = true;
    public children: ZoweNode[] = [];

    /**
     * Creates an instance of ZoweNode
     *
     * @param {string} mLabel - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} mCollapsibleState - file/folder
     * @param {ZoweNode} mParent
     * @param {Session} session
     */
    constructor(public mLabel: string, public mCollapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: ZoweNode, private session: Session, information: boolean = false) {
        super(mLabel, mCollapsibleState);
        if (information) {
            this.contextValue = "information";
        } else if (mCollapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = "pds";
        } else if (mParent && mParent.mParent !== null) {
            this.contextValue = "member";
        } else {
            this.contextValue = "ds";
        }
    }

    /**
     * Retrieves child nodes of this ZoweNode
     *
     * @returns {Promise<ZoweNode[]>}
     */
    public async getChildren(): Promise<ZoweNode[]> {
        if ((!this.pattern && this.contextValue === "session")){ 
            return [new ZoweNode("Use the search button to display datasets", vscode.TreeItemCollapsibleState.None, this, null, true)];
        }

        if (this.contextValue === "ds" || this.contextValue === "member" || this.contextValue === "information") {
            return [];
        }

        if (!this.dirty || this.mLabel === "Favorites") {
            return this.children;
        }

        if (!this.mLabel) {
            vscode.window.showErrorMessage("Invalid node");
            throw Error("Invalid node");
        }

        // Check if node is a favorite
        let label = this.mLabel.trim();
        if (this.mLabel.startsWith("[")) {
            label = this.mLabel.substring(this.mLabel.indexOf(":") + 1).trim();
        }

        // Gets the datasets from the pattern or members of the dataset and displays any thrown errors
        const responses: zowe.IZosFilesResponse[] = [];
        try {
            if (this.contextValue === "session") {
                this.pattern = this.pattern.toUpperCase();
                // loop through each pattern
                for (const pattern of this.pattern.split(",")) {
                    responses.push(await zowe.List.dataSet(this.getSession(), pattern.trim(), {attributes: true})); 
                }
            } else {
                responses.push(await zowe.List.allMembers(this.getSession(), label, {attributes: true}));
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Retrieving response from zowe.List\n${err}\n`);
            throw Error(`Retrieving response from zowe.List\n${err}\n`);
        }

        // push nodes to an object with property names to avoid duplicates
        const elementChildren = {};
        responses.forEach((response) => {
            // Throws reject if the brightside command does not throw an error but does not succeed
            if (!response.success) {
                throw Error("The response from Zowe CLI was not successful");
            }

            // Loops through all the returned dataset members and creates nodes for them
            for (const item of response.apiResponse.items) {
                // Creates a ZoweNode for a PDS
                if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    const temp = new ZoweNode(item.dsname, vscode.TreeItemCollapsibleState.Collapsed, this, null);
                    elementChildren[temp.label] = temp;
                } else if (this.contextValue === "session") {
                    // Creates a ZoweNode for a PS
                    const temp = new ZoweNode(item.dsname, vscode.TreeItemCollapsibleState.None, this, null);
                    temp.command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [temp]};
                    elementChildren[temp.label] = temp;
                } else {
                    // Creates a ZoweNode for a PDS member
                    const temp = new ZoweNode(item.member, vscode.TreeItemCollapsibleState.None, this, null);
                    temp.command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [temp]};
                    elementChildren[temp.label] = temp;
                }
            }
        });

        if (this.contextValue === "session") {
            this.dirty = false;
        }
        if(Object.keys(elementChildren).length === 0) {
            return this.children = [new ZoweNode("No datasets found", vscode.TreeItemCollapsibleState.None, this, null, true)];
        } else {
            return this.children = Object.keys(elementChildren).sort().map((labels) => elementChildren[labels]);
        }
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
     * Returs the session node for this node
     *
     * @returns {ZoweNode}
     */
    public getSessionNode(): ZoweNode {
        return this.session ? this : this.mParent.getSessionNode();
    }
}
