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

import { imperative, IUploadOptions, IZosFilesResponse } from "@zowe/cli";
import * as globals from "../globals";
import * as vscode from "vscode";
import * as path from "path";
import { FileAttributes, Gui, IZoweUSSTreeNode, ZoweTreeNode, IZoweTree, ValidProfileEnum, IUss } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, syncSessionNode } from "../utils/ProfilesUtils";
import { getIconByNode } from "../generators/icons/index";
import * as contextually from "../shared/context";
import * as nls from "vscode-nls";
import { UssFileTree } from "./FileStructure";
import { ZoweLogger } from "../utils/LoggerUtils";
import { UssFSProvider } from "./UssFSProvider";
import { USSTree } from "./USSTree";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Injects extra data to tooltip based on node status and other conditions
 * @param node
 * @param tooltip
 * @returns {string}
 */
function injectAdditionalDataToTooltip(node: ZoweUSSNode, tooltip: string): string {
    ZoweLogger.trace("uss.utils.injectAdditionalDataToTooltip called.");
    if (node.downloaded && node.downloadedTime) {
        return `${tooltip}\n(Downloaded: ${new Date(node.downloadedTime).toLocaleString(vscode.env.language)})`;
    }

    return tooltip;
}

/**
 * A type of TreeItem used to represent sessions and USS directories and files
 *
 * @export
 * @class ZoweUSSNode
 * @extends {vscode.TreeItem}
 */
export class ZoweUSSNode extends ZoweTreeNode implements IZoweUSSTreeNode {
    public command: vscode.Command;
    public dirty = true;
    public children: IZoweUSSTreeNode[] = [];
    public collapsibleState: vscode.TreeItemCollapsibleState;
    public profileName = "";
    public shortLabel = "";
    public downloadedTime = null;
    public profile: imperative.IProfileLoaded; // TODO: This reference should be stored instead of the name
    private downloadedInternal = false;
    private prevPath: string;
    public fullPath: string;
    public attributes: FileAttributes;
    public resourceUri?: vscode.Uri;

    public onUpdateEmitter: vscode.EventEmitter<IZoweUSSTreeNode>;

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
    public constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        mParent: IZoweUSSTreeNode,
        session: imperative.Session,
        private parentPath: string,
        binary = false,
        public mProfileName?: string,
        private etag: string = "",
        profile?: imperative.IProfileLoaded
    ) {
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
        if (mParent && mParent.contextValue === globals.FAV_PROFILE_CONTEXT) {
            this.profileName = this.mProfileName = mParent.label.toString();
            this.fullPath = label.trim();
            // File or directory name only (no parent path)
            this.shortLabel = this.fullPath.split("/", this.fullPath.length).pop();
            // Display name for favorited file or directory in tree view
            this.label = this.shortLabel;
            this.tooltip = this.fullPath;
        }
        // TODO: this should not be necessary if each node gets initialized with the profile reference.
        if (mProfileName) {
            this.setProfileToChoice(Profiles.getInstance().loadNamedProfile(mProfileName));
        } else if (mParent && mParent.mProfileName) {
            this.mProfileName = mParent.mProfileName;
            this.setProfileToChoice(Profiles.getInstance().loadNamedProfile(mParent.mProfileName));
        }
        this.etag = etag ? etag : "";
        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }
        const isSession = mParent == null;
        if (!globals.ISTHEIA && isSession) {
            this.id = `uss.${this.label.toString()}`;
        }
        if (profile) {
            this.profile = profile;
        }
        this.onUpdateEmitter = new vscode.EventEmitter<IZoweUSSTreeNode>();
        if (label !== localize("Favorites", "Favorites")) {
            this.resourceUri = vscode.Uri.parse(`zowe-uss:/${this.profile.name}${this.fullPath}`);
            if (isSession) {
                UssFSProvider.instance.createDirectory(this.resourceUri);
            }
        }
    }

    public get onUpdate(): vscode.Event<IZoweUSSTreeNode> {
        return this.onUpdateEmitter.event;
    }

    /**
     * Implements access tto profile name
     * for {IZoweUSSTreeNode}.
     *
     * @returns {string}
     */
    public getProfileName(): string {
        ZoweLogger.trace("ZoweUSSNode.getProfileName called.");
        return this.returnmProfileName();
    }

    public getSessionNode(): IZoweUSSTreeNode {
        ZoweLogger.trace("ZoweUSSNode.getSessionNode called.");
        return this.session ? this : this.getParent()?.getSessionNode() ?? this;
    }

    /**
     * Retrieves child nodes of this IZoweTreeNode
     *
     * @returns {Promise<IZoweUSSTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweUSSTreeNode[]> {
        ZoweLogger.trace("ZoweUSSNode.getChildren called.");
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
            Gui.errorMessage(localize("getChildren.error.invalidNode", "Invalid node"));
            throw Error("Invalid node");
        }

        // Get the list of files/folders at the given USS path and handle any errors
        let response: IZosFilesResponse;
        const sessNode = this.getSessionNode();
        let nodeProfile;
        try {
            const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
            if (!ZoweExplorerApiRegister.getUssApi(cachedProfile).getSession(cachedProfile)) {
                throw new imperative.ImperativeError({
                    msg: localize("getChildren.error.sessionMissing", "Profile auth error"),
                    additionalDetails: localize("getChildren.error.additionalDetails", "Profile is not authenticated, please log in to continue"),
                    errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
                });
            }
            nodeProfile = cachedProfile;
            if (contextually.isSession(this)) {
                response = await UssFSProvider.instance.listFiles(
                    nodeProfile,
                    this.resourceUri.with({
                        path: path.posix.join(this.resourceUri.path, this.fullPath),
                    })
                );
            } else {
                response = await UssFSProvider.instance.listFiles(nodeProfile, this.resourceUri);
            }
        } catch (err) {
            await errorHandling(err, this.label.toString(), localize("getChildren.error.response", "Retrieving response from ") + `uss-file-list`);
            syncSessionNode((profile) => ZoweExplorerApiRegister.getUssApi(profile), sessNode);
            return this.children;
        }

        // If search path has changed, invalidate all children
        if (this.resourceUri.path !== this.fullPath) {
            this.children = [];
        }

        const responseNodes: IZoweUSSTreeNode[] = [];
        for (const item of response.apiResponse.items) {
            // ".", "..", and "..." have already been filtered out

            const existing = this.children.find(
                // Ensure both parent path and short label match.
                // (Can't use mParent fullPath since that is already updated with new value by this point in getChildren.)
                (element: ZoweUSSNode) => element.parentPath === this.fullPath && element.label.toString() === item.name
            );

            // The child node already exists. Use that node for the list instead, and update the file attributes in case they've changed
            if (existing) {
                existing.attributes = {
                    gid: item.gid,
                    uid: item.uid,
                    group: item.group,
                    perms: item.mode,
                    owner: item.user,
                };
                responseNodes.push(existing);
                existing.onUpdateEmitter.fire(existing);
                continue;
            }

            const isDir = item.mode.startsWith("d");
            const collapseState = isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            const temp = new ZoweUSSNode(
                item.name,
                collapseState,
                this,
                null,
                this.fullPath,
                // we cannot determine binary without making an extra z/OSMF call to list the tags
                // TODO: discuss whether its worth the overhead to make API calls for the tag
                false,
                sessNode.mProfileName,
                undefined,
                nodeProfile
            );
            temp.attributes = {
                gid: item.gid,
                uid: item.uid,
                group: item.group,
                perms: item.mode,
                owner: item.user,
            };
            if (isDir) {
                // Create an entry for the USS folder if it doesn't exist.
                if (!UssFSProvider.instance.exists(temp.resourceUri)) {
                    vscode.workspace.fs.createDirectory(temp.resourceUri);
                }
            } else {
                // Create an entry for the USS file if it doesn't exist.
                if (!UssFSProvider.instance.exists(temp.resourceUri)) {
                    await vscode.workspace.fs.writeFile(temp.resourceUri, new Uint8Array());
                }
                temp.command = {
                    command: "vscode.open",
                    title: localize("getChildren.responses.open", "Open"),
                    arguments: [temp.resourceUri],
                };
            }
            responseNodes.push(temp);
        }

        const nodesToAdd = responseNodes.filter((c) => !this.children.includes(c));
        const nodesToRemove = this.children.filter((c) => !responseNodes.includes(c));

        // remove any entries from FS provider that were deleted from mainframe when tree view is refreshed
        for (const node of nodesToRemove) {
            if (node.resourceUri) {
                UssFSProvider.instance.removeEntryIfExists(node.resourceUri);
            }
        }

        this.children = this.children
            .concat(nodesToAdd)
            .filter((c) => !nodesToRemove.includes(c))
            .sort((a, b) => (a.label as string).localeCompare(b.label as string));
        this.prevPath = this.fullPath;
        this.dirty = false;
        return this.children;
    }

    public setBinary(binary: boolean): void {
        ZoweLogger.trace("ZoweUSSNode.setBinary called.");
        this.binary = binary;
        if (this.binary) {
            this.contextValue = globals.DS_BINARY_FILE_CONTEXT;
            this.getSessionNode().binaryFiles[this.fullPath] = true;
        } else {
            this.contextValue = globals.DS_TEXT_FILE_CONTEXT;
            delete this.getSessionNode().binaryFiles[this.fullPath];
        }
        if (this.getParent() && this.getParent().contextValue === globals.FAV_PROFILE_CONTEXT) {
            this.contextValue = this.binary ? globals.DS_BINARY_FILE_CONTEXT + globals.FAV_SUFFIX : globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
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
        ZoweLogger.trace("ZoweUSSNode.isDirtyInEditor called.");
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
        ZoweLogger.trace("ZoweUSSNode.openedDocumentInstance called.");
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
     * Helper method to change the UI node names in one go
     * @param newFullPath string
     */
    public async rename(newFullPath: string): Promise<boolean> {
        ZoweLogger.trace("ZoweUSSNode.rename called.");

        const oldUri = vscode.Uri.parse(`zowe-uss:/${this.profile.name}${this.fullPath}`);
        const newUri = vscode.Uri.parse(`zowe-uss:/${this.profile.name}${newFullPath}`);

        await vscode.workspace.fs.rename(oldUri, newUri);

        this.fullPath = newFullPath;
        this.resourceUri = newUri;
        this.shortLabel = newFullPath.split("/").pop();
        this.label = this.shortLabel;
        this.tooltip = injectAdditionalDataToTooltip(this, newFullPath);
        // Update the full path of any children already loaded locally
        if (this.children.length > 0) {
            this.children.forEach((child) => {
                // we don't have to call rename on child nodes anymore with FSP
                const newChildFullPath = newFullPath + "/" + child.shortLabel;
                child.fullPath = newChildFullPath;
            });
        }
        return true;
    }

    /**
     * Reopens a file if it was closed (e.g. while it was being renamed).
     * @param hasClosedInstance
     */
    public async reopen(hasClosedInstance = false): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.reopen called.");
        if (!this.isFolder && (hasClosedInstance || (this.binary && this.downloaded))) {
            await vscode.commands.executeCommand("zowe.uss.ZoweUSSNode.open", this);
        }
    }

    /**
     * Refreshes node and reopens it.
     * @param hasClosedInstance
     * @deprecated To be removed by version 2.0. Use reopen instead.
     */
    public async refreshAndReopen(hasClosedInstance = false): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.refreshAndReopen called.");
        await this.reopen(hasClosedInstance);
    }

    /**
     * Helper method which sets an icon of node and initiates reloading of tree
     * @param iconPath
     */
    public setIcon(iconPath: { light: string; dark: string }): void {
        ZoweLogger.trace("ZoweUSSNode.setIcon called.");
        this.iconPath = iconPath;
        vscode.commands.executeCommand("zowe.uss.refreshUSSInTree", this);
    }

    public async deleteUSSNode(ussFileProvider: USSTree, filePath: string = "", cancelled: boolean = false): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.deleteUSSNode called.");
        if (cancelled) {
            Gui.showMessage(localize("deleteUssPrompt.deleteCancelled", "Delete action was cancelled."));
            return;
        }
        try {
            await vscode.workspace.fs.delete(this.resourceUri);
        } catch (err) {
            ZoweLogger.error(err);
            if (err instanceof Error) {
                Gui.errorMessage(localize("deleteUSSNode.error.node", "Unable to delete node: ") + err.message);
            }
            throw err;
        }

        Gui.showMessage(localize("deleteUssNode.itemDeleted", "The item {0} has been deleted.", this.label.toString()));

        // Remove node from the USS Favorites tree
        await ussFileProvider.removeFavorite(this);
        ussFileProvider.removeFileHistory(`[${this.getProfileName()}]: ${this.parentPath}/${this.label.toString()}`);
        const parent = this.getParent();
        parent.children = parent.children.filter((c) => c !== this);
        ussFileProvider.nodeDataChanged(parent);
    }

    /**
     * Returns the [etag] for this node
     *
     * @returns {string}
     */
    public getEtag(): string {
        ZoweLogger.trace("ZoweUSSNode.getEtag called.");
        return this.etag;
    }

    /**
     * Set the [etag] for this node
     *
     * @returns {void}
     */
    public setEtag(etagValue): void {
        ZoweLogger.trace("ZoweUSSNode.setEtag called.");
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
            this.downloadedTime = new Date();
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
    public async openUSS(download: boolean, previewFile: boolean, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.openUSS called.");
        await ussFileProvider.checkCurrentProfile(this);

        const doubleClicked = Gui.utils.wasDoubleClicked(this, ussFileProvider);
        const shouldPreview = doubleClicked ? false : previewFile;
        if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
            try {
                switch (true) {
                    // For opening favorited and non-favorited files
                    case this.getParent().contextValue === globals.FAV_PROFILE_CONTEXT:
                        break;
                    case contextually.isUssSession(this.getParent()):
                        break;
                    // Handle file path for files in directories and favorited directories
                    case contextually.isUssDirectory(this.getParent()):
                        break;
                    default:
                        Gui.errorMessage(localize("openUSS.error.invalidNode", "open() called from invalid node."));
                        throw Error(localize("openUSS.error.invalidNode", "open() called from invalid node."));
                }

                // const documentFilePath = this.getUSSDocumentFilePath();
                // // check if some other file is already created with the same name avoid opening file warn user
                // const fileExists = fs.existsSync(documentFilePath);
                // if (fileExists && !fileExistsCaseSensitveSync(documentFilePath)) {
                //     Gui.showMessage(
                //         localize(
                //             "openUSS.name.exists",
                //             // eslint-disable-next-line max-len
                //             "There is already a file with the same name. Please change your OS file system settings if you want to give case sensitive file names"
                //         )
                //     );
                // } else {
                // if local copy exists, open that instead of pulling from mainframe
                // if (download || !fileExists) {
                //     const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
                //     const fullPath = this.fullPath;
                //     const chooseBinary =
                //         this.binary || (await ZoweExplorerApiRegister.getUssApi(cachedProfile).isFileTagBinOrAscii(this.fullPath));

                //
                //     const response = await ZoweExplorerApiRegister.getUssApi(cachedProfile).getContents(fullPath, {
                //         file: documentFilePath,
                //         binary: chooseBinary,
                //         returnEtag: true,
                //         encoding: cachedProfile.profile?.encoding,
                //         responseTimeout: cachedProfile.profile?.responseTimeout,
                //     });
                //     statusMsg.dispose();
                //     this.downloaded = true;
                //     this.setEtag(response.apiResponse.etag);
                // }

                // Add document name to recently-opened files
                ussFileProvider.addFileHistory(`[${this.getProfile().name}]: ${this.fullPath}`);
                ussFileProvider.getTreeView().reveal(this, { select: true, focus: true, expand: false });

                await this.initializeFileOpening(this.resourceUri, shouldPreview);
                // }
            } catch (err) {
                await errorHandling(err, this.mProfileName);
                throw err;
            }
        }
    }

    /**
     * Refreshes the passed node with current mainframe data
     *
     * @param {ZoweUSSNode} node - The node which represents the file
     */
    // This is not a UI refresh.
    public async refreshUSS(): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.refreshUSS called.");
        let label: string;
        switch (true) {
            case contextually.isUssDirectory(this.getParent()):
                label = this.fullPath;
                break;
            // For favorited and non-favorited files
            case this.getParent().contextValue === globals.FAV_PROFILE_CONTEXT:
            case contextually.isUssSession(this.getParent()):
                label = this.label.toString();
                break;
            default:
                Gui.errorMessage(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
                throw Error(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
        }
        try {
            const ussDocumentFilePath = this.getUSSDocumentFilePath();
            const isDirty = this.isDirtyInEditor;
            let wasSaved = false;

            if (isDirty) {
                attachRecentSaveListener();

                Gui.showTextDocument(this.openedDocumentInstance);
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                wasSaved = getRecentSaveStatus();

                disposeRecentSaveListener();
            }

            if ((isDirty && !this.isDirtyInEditor && !wasSaved) || !isDirty) {
                const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
                const response = await ZoweExplorerApiRegister.getUssApi(cachedProfile).getContents(this.fullPath, {
                    file: ussDocumentFilePath,
                    binary: this.binary || (await ZoweExplorerApiRegister.getUssApi(cachedProfile).isFileTagBinOrAscii(this.fullPath)),
                    returnEtag: true,
                    encoding: cachedProfile?.profile?.encoding,
                    responseTimeout: cachedProfile?.profile?.responseTimeout,
                });
                //this.setEtag(response.apiResponse.etag);
                this.downloaded = true;

                // if (isDirty) {
                //     await this.initializeFileOpening(ussDocumentFilePath, true);
                // }
            } else if (wasSaved) {
                //await this.initializeFileOpening(ussDocumentFilePath, true);
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes(localize("refreshUSS.error.notFound", "not found"))) {
                ZoweLogger.warn(err.toString());
                Gui.showMessage(
                    localize("refreshUSS.file1", "Unable to find file: ") + label + localize("refreshUSS.file2", " was probably deleted.")
                );
            } else {
                await errorHandling(err, this.mProfileName);
            }
        }
    }

    public async initializeFileOpening(uri: vscode.Uri, previewFile?: boolean): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.initializeFileOpening called.");
        let openingTextFailed = false;

        try {
            await vscode.commands.executeCommand("vscode.open", uri);
        } catch (err) {
            ZoweLogger.warn(err);
            openingTextFailed = true;
        }

        if (openingTextFailed) {
            const yesResponse = localize("openUSS.log.info.failedToOpenAsText.yes", "Re-download");
            const noResponse = localize("openUSS.log.info.failedToOpenAsText.no", "Cancel");

            const response = await Gui.errorMessage(
                localize("openUSS.log.info.failedToOpenAsText", "Failed to open file as text. Re-download file as binary?"),
                { items: [yesResponse, noResponse] }
            );

            if (response === yesResponse) {
                await vscode.commands.executeCommand("zowe.uss.binary", this);
            }
        }
    }

    /**
     * Returns the local file path for the ZoweUSSNode
     *
     */
    public getUSSDocumentFilePath(): string {
        ZoweLogger.trace("ZoweUSSNode.getUSSDocumentFilePath called.");
        return path.join(globals.USS_DIR || "", this.getSessionNode().getProfileName() || "", this.fullPath);
    }

    /**
     * Pastes a subtree of files and folders into another location.
     *
     * @param rootPath The start/root path for pasting the file structure
     * @param tree The structure of files and folders to paste
     * @param ussApi The USS API to use for this operation
     */
    public async paste(destUri: vscode.Uri, uss: { tree: UssFileTree; api: IUss; options?: IUploadOptions }): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.paste called.");
        const hasCopy = uss.api.copy != null;
        const hasUploadBufAsFile = uss.api.uploadBufferAsFile != null;
        if (!uss.api.fileList || !hasCopy || !hasUploadBufAsFile) {
            throw new Error(
                localize("paste.missingApis", "Required API functions for pasting (fileList and copy/uploadBufferAsFile) were not found.")
            );
        }

        await UssFSProvider.instance.copy(uss.tree.localUri.with({ query: `tree=${encodeURIComponent(JSON.stringify(uss.tree))}` }), destUri, {
            overwrite: true,
        });
    }

    /**
     * Initializes paste action for a USS tree
     */
    public async pasteUssTree(): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.pasteUssTree called.");
        const clipboardContents = await vscode.env.clipboard.readText();
        if (clipboardContents == null || clipboardContents.length < 1) {
            return;
        }

        const prof = this.getProfile();
        try {
            const fileTreeToPaste: UssFileTree = JSON.parse(clipboardContents);
            const api = ZoweExplorerApiRegister.getUssApi(this.profile);
            const sessionName = this.getSessionNode().getLabel() as string;

            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: localize("uploadFile.putContents", "Uploading USS files..."),
                stageName: 0,
            };
            const options: IUploadOptions = {
                task,
                encoding: prof.profile?.encoding,
                responseTimeout: prof.profile?.responseTimeout,
            };

            for (const subnode of fileTreeToPaste.children) {
                await this.paste(vscode.Uri.parse(`zowe-uss:/${this.profile.name}${this.fullPath}`), { api, tree: subnode, options });
            }
        } catch (error) {
            await errorHandling(error, this.label.toString(), localize("copyUssFile.error", "Error uploading files"));
        }
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
export function attachRecentSaveListener(wipeOutTime: number = 500): void {
    ZoweLogger.trace("ZoweUSSNode.attachRecentSaveListener called.");
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
export function getRecentSaveStatus(): boolean {
    ZoweLogger.trace("ZoweUSSNode.getRecentSaveStatus called.");
    return wasSavedRecently;
}

/**
 * Helper function which disposes recent save listener
 */
export function disposeRecentSaveListener(): void {
    ZoweLogger.trace("ZoweUSSNode.disposeRecentSaveListener called.");
    if (saveListener) {
        saveListener.dispose();
    }
}
