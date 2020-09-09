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
import * as globals from "../globals";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as moment from "moment";
import { Session, IProfileLoaded } from "@zowe/imperative";
import { IZoweUSSTreeNode } from "../api/IZoweTreeNode";
import { errorHandling, refreshTree } from "../utils";
import { ZoweTreeNode } from "../abstract/ZoweTreeNode";
import { IZoweTree } from "../api/IZoweTree";
import { getIconByNode } from "../generators/icons/index";
import { injectAdditionalDataToTooltip } from "../uss/utils";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import * as contextually from "../shared/context";
import { closeOpenedTextFile } from "../utils/workspace";
import * as nls from "vscode-nls";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
            this.contextValue = globals.USS_DIR_CONTEXT;
        } else if (binary) {
            this.contextValue = globals.DS_BINARY_FILE_CONTEXT;
        } else {
            this.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        }
        if (this.parentPath) {
            this.fullPath = this.tooltip = this.parentPath + "/" + label;
            if (parentPath === "/") {
                // Keep fullPath of root level nodes preceded by a single slash
                this.fullPath = this.tooltip = "/" + label;
            }
        }
        if (mParent && contextually.isFavoriteContext(mParent)) {
            this.profileName = "[" + mProfileName + "]: ";
            this.fullPath = label.trim();
            // File or directory name only (no parent path)
            this.shortLabel = this.fullPath.split("/", this.fullPath.length).pop();
            // Display name for favorited file or directory in tree view
            this.label = this.profileName + this.shortLabel;
            this.tooltip = this.profileName + this.fullPath;
        }
        // TODO: this should not be necessary if each node gets initialized with the profile reference.
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
     * Implements access tto profile name
     * for {IZoweUSSTreeNode}.
     *
     * @returns {string}
     */
    public getProfileName(): string {
        return this.returnmProfileName();
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
        if ((!this.fullPath && contextually.isSession(this)) || contextually.isDocument(this)) {
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
        const sessNode = this.getSessionNode();
        try {
            responses.push(await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: localize("ZoweUssNode.getList.progress", "Get USS file list command submitted.")
            }, () => {
                return ZoweExplorerApiRegister.getUssApi(this.getProfile()).fileList(this.fullPath);
            }));
        } catch (err) {
            await errorHandling(err, this.label, localize("getChildren.error.response", "Retrieving response from ") + `uss-file-list`);
            await refreshTree(sessNode);
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
        if (contextually.isSession(this)) {
            this.dirty = false;
        }
        return this.children = Object.keys(elementChildren).sort().map((labels) => elementChildren[labels]);
    }

    public setBinary(binary: boolean) {
        this.binary = binary;
        if (this.binary) {
            this.contextValue = globals.DS_BINARY_FILE_CONTEXT;
            this.getSessionNode().binaryFiles[this.fullPath] = true;
        } else {
            this.contextValue = globals.DS_TEXT_FILE_CONTEXT;
            delete this.getSessionNode().binaryFiles[this.fullPath];
        }
        if (this.getParent() && contextually.isFavoriteContext(this.getParent())) {
            this.binary ? this.contextValue = globals.DS_BINARY_FILE_CONTEXT + globals.FAV_SUFFIX :
                this.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
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
     * Helper method to change the node names in one go
     * @param newFullPath string
     */
    public async rename(newFullPath: string) {
        const currentFilePath = this.getUSSDocumentFilePath();
        const hasClosedInstance = await closeOpenedTextFile(currentFilePath);
        this.fullPath = newFullPath;
        this.shortLabel = newFullPath.split("/").pop();
        this.label = this.shortLabel;
        this.tooltip = injectAdditionalDataToTooltip(this, newFullPath);

        return hasClosedInstance;
    }

    /**
     * Refreshes node and reopens it.
     * @param hasClosedInstance
     */
    public async refreshAndReopen(hasClosedInstance = false) {
        if (this.isFolder) {
            await vscode.commands.executeCommand("zowe.uss.refreshAll");
        } else {
            await vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
        }

        if (!this.isFolder && (hasClosedInstance || (this.binary && this.downloaded))) {
            await vscode.commands.executeCommand("zowe.uss.ZoweUSSNode.open", this);
        }
    }

    /**
     * Helper method which sets an icon of node and initiates reloading of tree
     * @param iconPath
     */
    public setIcon(iconPath: { light: string; dark: string }) {
        this.iconPath = iconPath;
        vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
    }

    public async deleteUSSNode(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("deleteUSSNode.quickPickOption", "Delete {0}? This will permanently remove it from your system.", this.label),
            ignoreFocusOut: true,
            canPickMany: false
        };
        if (await vscode.window.showQuickPick([localize("deleteUSSNode.showQuickPick.delete", "Delete"),
            localize("deleteUSSNode.showQuickPick.cancel", "Cancel")],
            quickPickOptions) !== localize("deleteUSSNode.showQuickPick.delete", "Delete")) {
            return;
        }
        try {
            await ZoweExplorerApiRegister.getUssApi(this.profile).delete(this.fullPath, contextually.isUssDirectory(this));
            this.getParent().dirty = true;
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                // tslint:disable-next-line: no-empty
            } catch (err) {
            }
        } catch (err) {
            vscode.window.showErrorMessage(localize("deleteUSSNode.error.node", "Unable to delete node: ") + err.message);
            throw (err);
        }

        // Remove node from the USS Favorites tree
        ussFileProvider.removeFavorite(this);
        ussFileProvider.removeFileHistory(`[${this.getProfileName()}]: ${this.parentPath}/${this.label}`);
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
     * Getter for folder type
     */
    public get isFolder(): boolean {
        return [globals.USS_DIR_CONTEXT, globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX].indexOf(this.contextValue) > -1;
    }

    /**
     * Downloads and displays a file in a text editor view
     *
     * @param {IZoweTreeNode} node
     */
    public async openUSS(download = false, previewFile: boolean, ussFileProvider?: IZoweTree<IZoweUSSTreeNode>) {
        await ussFileProvider.checkCurrentProfile(this);
        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            try {
                let label: string;
                switch (true) {
                    case (contextually.isFavoriteContext(this.getParent())):
                        label = this.label.substring(this.label.indexOf(":") + 1).trim();
                        break;
                    // Handle file path for files in directories and favorited directories
                    case (contextually.isUssDirectory(this.getParent())):
                        label = this.fullPath;
                        break;
                    case (contextually.isUssSession(this.getParent())):
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
                                    returnEtag: true,
                                    encoding: profile.profile.encoding
                                });
                        }
                    );

                    this.downloaded = true;
                    this.setEtag(response.apiResponse.etag);
                }

                // Add document name to recently-opened files
                ussFileProvider.addFileHistory(`[${this.getProfile().name}]: ${this.fullPath}`);
                ussFileProvider.getTreeView().reveal(this, { select: true, focus: true, expand: false });

                await this.initializeFileOpening(documentFilePath, previewFile);
            } catch (err) {
                await errorHandling(err, this.mProfileName, err.message);
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
        switch (true) {
            case (contextually.isUssDirectory(this.getParent())):
                label = this.fullPath;
                break;
            case (contextually.isFavoriteContext(this.getParent())):
            case (contextually.isUssSession(this.getParent())):
                label = this.label;
                break;
            default:
                vscode.window.showErrorMessage(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
                throw Error(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
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
                const prof = this.getProfile();
                const response = await ZoweExplorerApiRegister.getUssApi(prof).getContents(this.fullPath, {
                    file: ussDocumentFilePath,
                    binary: this.binary || await ZoweExplorerApiRegister.getUssApi(this.getProfile()).isFileTagBinOrAscii(this.fullPath),
                    returnEtag: true,
                    encoding: prof?.profile.encoding
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
                await errorHandling(err, this.mProfileName, err.message);
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
                const yesResponse = localize("openUSS.log.info.failedToOpenAsText.yes", "Re-download");
                const noResponse = localize("openUSS.log.info.failedToOpenAsText.no", "Cancel");

                const response = await vscode.window.showErrorMessage(
                    localize(
                        "openUSS.log.info.failedToOpenAsText",
                        "Failed to open file as text. Re-download file as binary?"),
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
                    await vscode.window.showTextDocument(document, { preview: false });
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
        return path.join(globals.USS_DIR || "", "/" + this.getSessionNode().getProfileName() + "/", this.fullPath);
    }

    private returnmProfileName(): string {
        return this.mProfileName;
    }
}

let wasSavedRecently = false;
let saveListener = null;

/**
 * Helper function which sets up listener for save wiping out the data after certain delay to prevent the fact of second save
 * @param wipeOutTime {number}
 */
export function attachRecentSaveListener(wipeOutTime = 500) {
    if (saveListener) {
        saveListener.dispose();
    }

    saveListener = vscode.workspace.onDidSaveTextDocument(() => {
        wasSavedRecently = true;

        setTimeout(() => {
            wasSavedRecently = false;
        }, wipeOutTime);
    });
}

/**
 * Helper function which returns saved save flag
 *
 * @returns {boolean}
 */
export function getRecentSaveStatus() {
    return wasSavedRecently;
}

/**
 * Helper function which disposes recent save listener
 */
export function disposeRecentSaveListener() {
    if (saveListener) {
        saveListener.dispose();
    }
}
