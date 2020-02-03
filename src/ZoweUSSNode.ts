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
import { Session, IProfileLoaded } from "@brightside/imperative";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { IZoweTreeNode } from "./ZoweTree";
// tslint:disable-next-line: no-duplicate-imports
import * as extension from "../src/extension";
import * as utils from "./utils";
import { getIconByNode } from "./generators/icons/index";
import * as moment from "moment";
import { injectAdditionalDataToTooltip } from "./utils/uss";
import { Profiles } from "./Profiles";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/**
 * A type of TreeItem used to represent sessions and USS directories and files
 *
 * @export
 * @class ZoweUSSNode
 * @extends {vscode.TreeItem}
 */
export class ZoweUSSNode extends vscode.TreeItem implements IZoweTreeNode {
    public command: vscode.Command;
    public fullPath = "";
    public dirty = extension.ISTHEIA;  // Make sure this is true for theia instances
    public children: ZoweUSSNode[] = [];
    public binaryFiles = {};
    public shortLabel = "";
    public downloadedTime = null as string;
    public profileName = "";
    public profile: IProfileLoaded; // TODO: This reference should be stored instead of the name
    private downloadedInternal = false;

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
                public mProfileName?: string,
                private etag?: string) {
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
        // TODO: this should not be necessary of each node gets initialized with the profile reference.
        if (mProfileName) {
            this.profile = Profiles.getInstance().loadNamedProfile(mProfileName);
        } else if (mParent && mParent.mProfileName) {
            this.mProfileName = mParent.mProfileName;
            this.profile = Profiles.getInstance().loadNamedProfile(mParent.mProfileName);
        }
        this.etag = etag ? etag : "";
        utils.applyIcons(this);
    }

    /**
     * Implements access to profile name
     * for {IZoweTreeNode}.
     *
     * @returns {string}
     */
    public getProfileName(): string {
        return this.mProfileName;
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
            responses.push(await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: localize("ZoweUssNode.getList.progress", "Get USS file list command submitted.")
            }, () => {
               return ZoweExplorerApiRegister.getUssApi(this.profile).fileList(this.fullPath);
            }));
        } catch (err) {
            utils.errorHandling(err, this.label, localize("getChildren.error.response", "Retrieving response from ") + `uss-file-list`);
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
                const existing = this.children.find((element) => element.label.trim() === item.name);
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
                        if (this.getSessionNode().binaryFiles.hasOwnProperty(this.fullPath + "/" + item.name)) {
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
                        temp.command = {
                            command: "zowe.uss.ZoweUSSNode.open",
                            title: localize("getChildren.responses.open", "Open"), arguments: [temp]
                        };
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
        if (this.binary) {
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

        const icon = getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }

        this.dirty = true;
    }

    /**
     * Helper getter to check dirtiness of node inside opened editor tabs, can be more accurate than saved value
     *
     * @returns {boolean}
     */
    public get isDirtyInEditor(): boolean {
        const openedTextDocuments = vscode.workspace.textDocuments;
        const currentFilePath = extension.getUSSDocumentFilePath(this);

        for (const document of openedTextDocuments) {
            if (document.fileName === currentFilePath) {
                return document.isDirty;
            }
        }

        return false;
    }

    public get openedDocumentInstance(): vscode.TextDocument {
        const openedTextDocuments = vscode.workspace.textDocuments;
        const currentFilePath = extension.getUSSDocumentFilePath(this);

        for (const document of openedTextDocuments) {
            if (document.fileName === currentFilePath) {
                return document;
            }
        }

        return null;
    }

    /**
     * helper method to change the node names in one go
     * @param oldReference string
     * @param revision string
     */
    public rename(newFullPath: string) {
        this.fullPath = newFullPath;
        this.shortLabel = newFullPath.split("/").pop();
        this.label = this.shortLabel;
        this.tooltip = injectAdditionalDataToTooltip(this, newFullPath);

        vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
    }

    /**
     * Helper method which sets an icon of node and initiates reloading of tree
     * @param iconPath
     */
    public setIcon(iconPath: {light: string; dark: string}) {
        this.iconPath = iconPath;
        vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
    }

    /**
     * Returns the [etag] for this node
     *
     * @returns {string}
     */
    public getEtag(): string {
        return this.etag;
    }

    /**
     * Set the [etag] for this node
     *
     * @returns {void}
     */
    public setEtag(etagValue): void {
        this.etag = etagValue;
    }

    /**
     * Getter for downloaded property
     *
     * @returns boolean
     */
    public get downloaded(): boolean {
        return this.downloadedInternal;
    }

    /**
     * Setter for downloaded property
     * @param value boolean
     */
    public set downloaded(value: boolean) {
        this.downloadedInternal = value;

        if (value) {
            this.downloadedTime = moment().toISOString();
            this.tooltip = injectAdditionalDataToTooltip(this, this.fullPath);
        }

        const icon = getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }
    }
}
