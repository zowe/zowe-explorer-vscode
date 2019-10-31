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
import * as nls from "vscode-nls";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as extension from "../src/extension";
import * as utils from "./utils";

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
    public dirty = extension.ISTHEIA;  // Make sure this is true for theia instances
    public children: ZoweUSSNode[] = [];
    public binaryFiles = {};
    public profileName = "";
    public shortLabel = "";

    /**
     * Creates an instance of ZoweUSSNode
     *
     * @param {string} label - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} collapsibleState - file/directory
     * @param {ZoweUSSNode} mParent - The parent node
     * @param {Session} session
     * @param {String} parentPath - The file path of the parent on the server
     * @param {String} mProfileName - Profile to which the node belongs to
     */
    constructor(label: string,
                collapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: ZoweUSSNode,
                private session: Session,
                private parentPath: string,
                public binary = false,
                public mProfileName?: string) {
        super(label, collapsibleState);
        if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = extension.USS_DIR_CONTEXT;
        } else if (binary) {
            this.contextValue = extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX;
        } else {
            this.contextValue = extension.DS_TEXT_FILE_CONTEXT;
        }
        if (this.parentPath) {
            this.fullPath = this.tooltip = this.parentPath + "/" + label;
            if (parentPath === "/") {
                // Keep fullPath of root level nodes preceded by a single slash
                this.fullPath = this.tooltip = "/" + label;
            }
        }
        if (this.mParent && this.mParent.contextValue === extension.FAVORITE_CONTEXT) {
            this.profileName = "[" + mProfileName + "]: ";
            this.fullPath = label.trim();
            // File or directory name only (no parent path)
            this.shortLabel = this.fullPath.split("/", this.fullPath.length).pop();
            // Display name for favorited file or directory in tree view
            this.label = this.profileName + this.shortLabel;
            this.tooltip = this.profileName + this.fullPath;
        }
        utils.applyIcons(this);
    }

    /**
     * Retrieves child nodes of this ZoweUSSNode
     *
     * @returns {Promise<ZoweUSSNode[]>}
     */
    public async getChildren(): Promise<ZoweUSSNode[]> {
        if ((!this.fullPath && this.contextValue === extension.USS_SESSION_CONTEXT) ||
                (this.contextValue === extension.DS_TEXT_FILE_CONTEXT ||
                    this.contextValue === extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX)) {
            return [];
        }

        if (!this.dirty) {
            if (this.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                this.children = [];
            }
            return this.children;
        }

        if (!this.label) {
            vscode.window.showErrorMessage(localize("getChildren.error.invalidNode", "Invalid node"));
            throw Error("Invalid node");
        }

        // Gets the directories from the fullPath and displays any thrown errors
        const responses: zowe.IZosFilesResponse[] = [];
        try {
            responses.push(await zowe.List.fileList(this.getSession(), this.fullPath));
        } catch (err) {
            vscode.window.showErrorMessage(localize("getChildren.error.response", "Retrieving response from ")
                                                    + `zowe.List\n${err}\n`);
            throw Error(localize("getChildren.error.response", "Retrieving response from ") + `zowe.List\n${err}\n`);
        }
        // push nodes to an object with property names to avoid duplicates
        const elementChildren = {};
        responses.forEach((response) => {
            // Throws reject if the brightside command does not throw an error but does not succeed
            if (!response.success) {
                throw Error(
                    localize("getChildren.responses.error.response", "The response from Zowe CLI was not successful"));
            }

            // Loops through all the returned file references members and creates nodes for them
            for (const item of response.apiResponse.items) {
                const existing = this.children.find((element) => element.label.trim() === item.name );
                if (existing) {
                    elementChildren[existing.label] = existing;
                } else if (item.name !== "." && item.name !== "..") {
                    // Creates a ZoweUSSNode for a directory
                    if (item.mode.startsWith("d")) {
                        const temp = new ZoweUSSNode(
                            item.name,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            this,
                            null,
                            this.fullPath,
                            false,
                            item.mProfileName);
                        elementChildren[temp.label] = temp;
                    } else {
                        // Creates a ZoweUSSNode for a file
                        let temp;
                        if(this.getSessionNode().binaryFiles.hasOwnProperty(this.fullPath + "/" + item.name)) {
                            temp = new ZoweUSSNode(
                                item.name,
                                vscode.TreeItemCollapsibleState.None,
                                this,
                                null,
                                this.fullPath,
                                true,
                                item.mProfileName);
                        } else {
                            temp = new ZoweUSSNode(
                                item.name,
                                vscode.TreeItemCollapsibleState.None,
                                this,
                                null,
                                this.fullPath,
                                false,
                                item.mProfileName);
                        }
                        temp.command = {command: "zowe.uss.ZoweUSSNode.open",
                                        title: localize("getChildren.responses.open", "Open"), arguments: [temp]};
                        elementChildren[temp.label] = temp;
                    }
                }
            }
        });
        if (this.contextValue === extension.USS_SESSION_CONTEXT) {
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
            this.contextValue = extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX;
            this.getSessionNode().binaryFiles[this.fullPath] = true;
        } else {
            this.contextValue = extension.DS_TEXT_FILE_CONTEXT;
            delete this.getSessionNode().binaryFiles[this.fullPath];
        }
        if (this.mParent && this.mParent.contextValue === extension.FAVORITE_CONTEXT) {
            this.binary ? this.contextValue = extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX :
             this.contextValue = extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX;
        }
        utils.applyIcons(this);
        this.dirty = true;
    }
}
