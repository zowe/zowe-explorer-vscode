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

import * as zowe from "@zowe/cli";
import { Session, IProfileLoaded } from "@zowe/imperative";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { IZoweUSSTreeNode } from "./api/IZoweTreeNode";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
import * as extension from "../src/extension";
import * as utils from "./utils";
import * as fs from "fs";
import * as path from "path";
import { ZoweTreeNode } from "./abstract/ZoweTreeNode";
import { IZoweTree } from "./api/IZoweTree";
import { getIconByNode } from "./generators/icons/index";
import * as moment from "moment";
import { injectAdditionalDataToTooltip } from "./utils/uss";
import { Profiles } from "./Profiles";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { attachRecentSaveListener, disposeRecentSaveListener, getRecentSaveStatus } from "./utils/file";

/**
 * A type of TreeItem used to represent sessions and USS directories and files
 *
 * @export
 * @class ZoweUSSNode
 * @extends {vscode.TreeItem}
 */
export class ZoweUSSNode extends ZoweTreeNode implements IZoweUSSTreeNode {
    public command: vscode.Command;
    public fullPath = "";
    public dirty = true;
    public children: IZoweUSSTreeNode[] = [];
    public binaryFiles = {};
    public binary = false;
    public profileName = "";
    public shortLabel = "";
    public downloadedTime = null as string;
    public profile: IProfileLoaded; // TODO: This reference should be stored instead of the name
    private downloadedInternal = false;

    /**
     * Creates an instance of ZoweUSSNode
     *
     * @param {string} label - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} collapsibleState - file/directory
     * @param {IZoweUSSTreeNode} mParent - The parent node
     * @param {Session} session
     * @param {String} parentPath - The file path of the parent on the server
     * @param {boolean} binary - Indictaes if this is a text or binary file
     * @param {String} mProfileName - Profile to which the node belongs to
     */
    constructor(label: string,
                collapsibleState: vscode.TreeItemCollapsibleState,
                mParent: IZoweUSSTreeNode,
                session: Session,
                private parentPath: string,
                binary = false,
                public mProfileName?: string,
                private etag: string = "",
                profile?: IProfileLoaded) {
        super(label, collapsibleState, mParent, session, profile);
        this.binary = binary;
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
        if (mParent && mParent.contextValue === extension.FAVORITE_CONTEXT) {
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
            this.setProfile(Profiles.getInstance().loadNamedProfile(mProfileName));
        } else if (mParent && mParent.mProfileName) {
            this.mProfileName = mParent.mProfileName;
            this.setProfile(Profiles.getInstance().loadNamedProfile(mParent.mProfileName));
        }
        this.etag = etag ? etag : "";
        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }
    }

    /**
     * Implements access to profile name
     * for {IZoweUSSTreeNode}.
     *
     * @returns {string}
     */
    public getProfileName(): string {
        return this.mProfileName;
    }

    public getSessionNode(): IZoweUSSTreeNode {
        return this.session ? this : this.getParent().getSessionNode();
    }

    /**
     * Retrieves child nodes of this IZoweTreeNode
     *
     * @returns {Promise<IZoweUSSTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweUSSTreeNode[]> {
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
               return ZoweExplorerApiRegister.getUssApi(this.getProfile()).fileList(this.fullPath);
            }));
        } catch (err) {
            utils.errorHandling(err, this.label, localize("getChildren.error.response", "Retrieving response from ") + `uss-file-list`);
        }
        // push nodes to an object with property names to avoid duplicates
        const elementChildren = {};
        responses.forEach((response) => {
            // Throws reject if the Zowe command does not throw an error but does not succeed
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

    public setBinary(binary: boolean) {
        this.binary = binary;
        if (this.binary) {
            this.contextValue = extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX;
            this.getSessionNode().binaryFiles[this.fullPath] = true;
        } else {
            this.contextValue = extension.DS_TEXT_FILE_CONTEXT;
            delete this.getSessionNode().binaryFiles[this.fullPath];
        }
        if (this.getParent() && this.getParent().contextValue === extension.FAVORITE_CONTEXT) {
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
        const currentFilePath = this.getUSSDocumentFilePath();

        for (const document of openedTextDocuments) {
            if (document.fileName === currentFilePath) {
                return document.isDirty;
            }
        }

        return false;
    }

    public get openedDocumentInstance(): vscode.TextDocument {
        const openedTextDocuments = vscode.workspace.textDocuments;
        const currentFilePath = this.getUSSDocumentFilePath();

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
        vscode.commands.executeCommand("zowe.uss.ZoweUSSNode.open", this);
    }

    /**
     * Helper method which sets an icon of node and initiates reloading of tree
     * @param iconPath
     */
    public setIcon(iconPath: {light: string; dark: string}) {
        this.iconPath = iconPath;
        vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
    }

    public async deleteUSSNode(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string) {
        // handle zosmf api issue with file paths
        const nodePath = this.fullPath.startsWith("/") ? this.fullPath.substring(1) : this.fullPath;
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("deleteUSSNode.quickPickOption", "Are you sure you want to delete ") + this.label,
            ignoreFocusOut: true,
            canPickMany: false
        };
        if (await vscode.window.showQuickPick([localize("deleteUSSNode.showQuickPick.yes", "Yes"),
        localize("deleteUSSNode.showQuickPick.no", "No")],
            quickPickOptions) !== localize("deleteUSSNode.showQuickPick.yes", "Yes")) {
            return;
        }
        try {
            const isRecursive = this.contextValue === extension.USS_DIR_CONTEXT ? true : false;
            await ZoweExplorerApiRegister.getUssApi(this.profile).delete(nodePath, isRecursive);
            this.getParent().dirty = true;
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            // tslint:disable-next-line: no-empty
            } catch (err) { }
        } catch (err) {
            vscode.window.showErrorMessage(localize("deleteUSSNode.error.node", "Unable to delete node: ") + err.message);
            throw (err);
        }

        // Remove node from the USS Favorites tree
        ussFileProvider.removeFavorite(this);
        ussFileProvider.refresh();
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
    /**
     * Downloads and displays a file in a text editor view
     *
     * @param {IZoweTreeNode} node
     */
    public async openUSS(download = false, previewFile: boolean, ussFileProvider?: IZoweTree<IZoweUSSTreeNode>) {
        let usrNme: string;
        let passWrd: string;
        let baseEncd: string;
        let validProfile: number = -1;
        if ((!this.getSession().ISession.user) || (!this.getSession().ISession.password)) {
            try {
                const values = await Profiles.getInstance().promptCredentials(this.getProfileName());
                if (values !== undefined) {
                    usrNme = values[0];
                    passWrd = values[1];
                    baseEncd = values[2];
                }
            } catch (error) {
                await utils.errorHandling(error, this.getProfileName(), error.message);
            }
            if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                this.getSession().ISession.user = usrNme;
                this.getSession().ISession.password = passWrd;
                this.getSession().ISession.base64EncodedAuth = baseEncd;
                validProfile = 0;
            } else {
                return;
            }
            await ussFileProvider.refreshElement(this);
            await ussFileProvider.refresh();
        } else {
            validProfile = 0;
        }
        if (validProfile === 0) {
            try {
                let label: string;
                switch (this.getParent().contextValue) {
                    case (extension.FAVORITE_CONTEXT):
                        label = this.label.substring(this.label.indexOf(":") + 1).trim();
                        break;
                    // Handle file path for files in directories and favorited directories
                    case (extension.USS_DIR_CONTEXT):
                    case (extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX):
                        label = this.fullPath;
                        break;
                    case (extension.USS_SESSION_CONTEXT):
                        label = this.label;
                        break;
                    default:
                        vscode.window.showErrorMessage(localize("openUSS.error.invalidNode", "open() called from invalid node."));
                        throw Error(localize("openUSS.error.invalidNode", "open() called from invalid node."));
                }
                // if local copy exists, open that instead of pulling from mainframe
                const documentFilePath = this.getUSSDocumentFilePath();
                if (download || !fs.existsSync(documentFilePath)) {
                    const profile = this.getProfile();
                    const fullPath = this.fullPath;
                    const chooseBinary = this.binary ||
                        await ZoweExplorerApiRegister.getUssApi(profile).isFileTagBinOrAscii(this.fullPath);
                    const response = await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: "Opening USS file..."
                        },
                        function downloadUSSFile() {
                            return ZoweExplorerApiRegister.getUssApi(profile).getContents(
                                fullPath, {
                                    file: documentFilePath,
                                    binary: chooseBinary,
                                    returnEtag: true
                                });
                        }
                    );

                    this.downloaded = true;
                    this.setEtag(response.apiResponse.etag);
                }

                await this.initializeFileOpening(documentFilePath, previewFile);
            } catch (err) {
                await utils.errorHandling(err, this.mProfileName, err.message);
                throw (err);
            }
        }
    }
    /**
     * Refreshes the passed node with current mainframe data
     *
     * @param {ZoweUSSNode} node - The node which represents the file
     */
    public async refreshUSS() {
        let label;
        switch (this.getParent().contextValue) {
            case (extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX):
                label = this.fullPath;
                break;
            case (extension.USS_DIR_CONTEXT):
                label = this.fullPath;
                break;
            case (extension.USS_SESSION_CONTEXT):
                label = this.label;
                break;
            default:
                vscode.window.showErrorMessage(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
                throw Error(localize("refreshUSS.error.invalidNode", "refreshPS() called from invalid node."));
        }
        try {
            const ussDocumentFilePath = this.getUSSDocumentFilePath();
            const isDirty = this.isDirtyInEditor;
            let wasSaved = false;

            if (isDirty) {
                attachRecentSaveListener();

                vscode.window.showTextDocument(this.openedDocumentInstance);
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                wasSaved = getRecentSaveStatus();

                disposeRecentSaveListener();
            }

            if ((isDirty && !this.isDirtyInEditor && !wasSaved) || !isDirty) {
                const response = await ZoweExplorerApiRegister.getUssApi(this.getProfile()).getContents(this.fullPath, {
                    file: ussDocumentFilePath,
                    returnEtag: true
                });
                this.setEtag(response.apiResponse.etag);
                this.downloaded = true;

                if (isDirty) {
                    await this.initializeFileOpening(ussDocumentFilePath, true);
                }
            } else if (wasSaved) {
                await this.initializeFileOpening(ussDocumentFilePath, true);
            }
        } catch (err) {
            if (err.message.includes(localize("refreshUSS.error.notFound", "not found"))) {
                vscode.window.showInformationMessage(localize("refreshUSS.file1", "Unable to find file: ") + label +
                    localize("refreshUSS.file2", " was probably deleted."));
            } else {
                await utils.errorHandling(err, this.mProfileName, err.message);
            }
        }
    }

    public async initializeFileOpening(documentPath: string, previewFile?: boolean) {
        let document;
        let openingTextFailed = false;

        if (!this.binary) {
            try {
                document = await vscode.workspace.openTextDocument(documentPath);
            } catch (err) {
                openingTextFailed = true;
            }

            if (openingTextFailed) {
                const yesResponse = localize("openUSS.log.info.failedToOpenAsText.yes", "Yes, re-download");
                const noResponse = localize("openUSS.log.info.failedToOpenAsText.no", "No");

                const response = await vscode.window.showErrorMessage(
                    localize(
                        "openUSS.log.info.failedToOpenAsText",
                        "Failed to open file as text. Do you want to try with re-downloading it as binary?"),
                    ...[
                        yesResponse,
                        noResponse
                    ]
                );

                if (response === yesResponse.toString()) {
                    await vscode.commands.executeCommand("zowe.uss.binary", this);
                }
            } else {
                if (previewFile === true) {
                    await vscode.window.showTextDocument(document);
                } else {
                    await vscode.window.showTextDocument(document, {preview: false});
                }
            }
        } else {
            const uriPath = vscode.Uri.file(documentPath);
            await vscode.commands.executeCommand("vscode.open", uriPath);
        }
    }

    /**
     * Returns the local file path for the ZoweUSSNode
     *
     */
    public getUSSDocumentFilePath() {
        return path.join(extension.USS_DIR || "", "/" + this.getSessionNode().getProfileName() + "/", this.fullPath);
    }
}
