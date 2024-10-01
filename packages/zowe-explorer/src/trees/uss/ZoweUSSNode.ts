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

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as vscode from "vscode";
import * as path from "path";
import {
    Gui,
    imperative,
    IZoweUSSTreeNode,
    ZoweTreeNode,
    Types,
    Validation,
    ZosEncoding,
    ZoweScheme,
    UssFile,
    UssDirectory,
    FsAbstractUtils,
    MainframeInteraction,
} from "@zowe/zowe-explorer-api";
import { USSUtils } from "./USSUtils";
import { Constants } from "../../configuration/Constants";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedContext } from "../shared/SharedContext";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { SharedUtils } from "../shared/SharedUtils";
import { USSFileStructure } from "./USSFileStructure";
import { UssFSProvider } from "./UssFSProvider";
import { AuthUtils } from "../../utils/AuthUtils";
import type { Definitions } from "../../configuration/Definitions";

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
    public downloadedTime = null;
    private downloadedInternal = false;
    public fullPath: string;
    public resourceUri?: vscode.Uri;

    public onUpdateEmitter: vscode.EventEmitter<IZoweUSSTreeNode>;
    private parentPath: string;
    private etag?: string;

    /**
     * Creates an instance of ZoweUSSNode
     *
     * @param {IZoweUssTreeOpts} opts
     */
    public constructor(opts: Definitions.IZoweUssTreeOpts) {
        super(opts.label, opts.collapsibleState, opts.parentNode, opts.session, opts.profile);
        this.parentPath = opts.parentPath;
        if (opts.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = Constants.USS_DIR_CONTEXT;
        } else if (opts.encoding?.kind === "binary") {
            this.contextValue = Constants.USS_BINARY_FILE_CONTEXT;
        } else {
            this.contextValue = Constants.USS_TEXT_FILE_CONTEXT;
        }
        if (this.parentPath) {
            this.fullPath = this.tooltip = path.posix.join(this.parentPath, opts.label);
        }
        if (opts.parentNode && opts.parentNode.contextValue === Constants.FAV_PROFILE_CONTEXT) {
            this.fullPath = opts.label.trim();
            // File or directory name only (no parent path)
            // Display name for favorited file or directory in tree view
            this.label = this.fullPath.split("/", this.fullPath.length).pop();
            this.tooltip = this.fullPath;
        }
        this.etag = opts.etag ? opts.etag : "";

        if (opts.contextOverride) {
            this.contextValue = opts.contextOverride;
        }

        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }
        const isSession = this.getParent() == null;
        if (isSession) {
            this.id = `uss.${this.label.toString()}`;
        }
        if (opts.profile) {
            this.profile = opts.profile;
        }
        this.onUpdateEmitter = new vscode.EventEmitter<IZoweUSSTreeNode>();
        if (opts.label !== vscode.l10n.t("Favorites")) {
            const sessionLabel = opts.profile?.name ?? SharedUtils.getSessionLabel(this);
            this.resourceUri = vscode.Uri.from({
                scheme: ZoweScheme.USS,
                path: path.posix.join("/", sessionLabel, this.fullPath),
            });
            if (isSession) {
                UssFSProvider.instance.createDirectory(this.resourceUri);
            } else if (this.contextValue === Constants.INFORMATION_CONTEXT) {
                this.command = { command: "zowe.placeholderCommand", title: "Placeholder" };
            } else if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
                this.command = { command: "vscode.open", title: "", arguments: [this.resourceUri] };
            }

            if (opts.encoding != null) {
                UssFSProvider.instance.makeEmptyFileWithEncoding(this.resourceUri, opts.encoding);
            }
        }
    }
    public getBaseName(): string {
        return path.basename(this.resourceUri.path);
    }

    public getEncodingInMap(uriPath: string): ZosEncoding {
        return UssFSProvider.instance.encodingMap[uriPath];
    }

    public updateEncodingInMap(uriPath: string, encoding: ZosEncoding): void {
        UssFSProvider.instance.encodingMap[uriPath] = encoding;
    }

    public setEtag(etag: string): void {
        const ussEntry = UssFSProvider.instance.lookup(this.resourceUri, true) as UssFile | UssDirectory;
        if (ussEntry == null || FsAbstractUtils.isDirectoryEntry(ussEntry)) {
            return;
        }

        ussEntry.etag = etag;
    }

    public getAttributes(): Types.FileAttributes {
        const ussEntry = UssFSProvider.instance.lookup(this.resourceUri, true) as UssFile | UssDirectory;
        if (ussEntry == null) {
            return undefined;
        }
        return ussEntry.attributes;
    }

    public setAttributes(attributes: Partial<Types.FileAttributes>): void {
        const ussEntry = UssFSProvider.instance.lookup(this.resourceUri, true) as UssFile | UssDirectory;
        if (ussEntry == null) {
            return;
        }
        ussEntry.attributes = { ...ussEntry.attributes, ...attributes };
    }

    public setProfileToChoice(profile: imperative.IProfileLoaded): void {
        super.setProfileToChoice(profile, UssFSProvider.instance);
    }

    public get onUpdate(): vscode.Event<IZoweUSSTreeNode> {
        return this.onUpdateEmitter.event;
    }

    public getSessionNode(): IZoweUSSTreeNode {
        ZoweLogger.trace("ZoweUSSNode.getSessionNode called.");
        return this.session ? this : (this.getParent()?.getSessionNode() as IZoweUSSTreeNode) ?? this;
    }

    /**
     * Retrieves child nodes of this IZoweTreeNode
     *
     * @returns {Promise<IZoweUSSTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweUSSTreeNode[]> {
        ZoweLogger.trace("ZoweUSSNode.getChildren called.");
        if ((!this.fullPath && SharedContext.isSession(this)) || SharedContext.isDocument(this)) {
            const placeholder = new ZoweUSSNode({
                label: vscode.l10n.t("Use the search button to list USS files"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: Constants.INFORMATION_CONTEXT,
            });
            return [placeholder];
        }

        if (!this.dirty) {
            if (this.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                this.children = [];
            }
            return this.children;
        }

        if (!this.label) {
            Gui.errorMessage(vscode.l10n.t("Invalid node"));
            throw Error("Invalid node");
        }

        // Get the list of files/folders at the given USS path and handle any errors
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        const response = await this.getUssFiles(cachedProfile);
        if (!response.success) {
            return this.children;
        }

        // If search path has changed, invalidate all children
        if (this.resourceUri.path !== this.fullPath) {
            this.children = [];
        }

        const existingItems: Record<string, ZoweUSSNode> = {};
        for (const element of this.children as ZoweUSSNode[]) {
            existingItems[`${element.parentPath}/${element.label.toString()}`] = element;
        }
        const responseNodes: IZoweUSSTreeNode[] = [];
        for (const item of response.apiResponse.items) {
            // ".", "..", and "..." have already been filtered out
            let ussNode = existingItems[`${this.fullPath}/${item.name as string}`];

            // The child node already exists. Use that node for the list instead, and update the file attributes in case they've changed
            if (ussNode != null) {
                ussNode.setAttributes({
                    gid: item.gid,
                    uid: item.uid,
                    group: item.group,
                    perms: item.mode,
                    owner: item.user,
                });
                responseNodes.push(ussNode);
                ussNode.onUpdateEmitter.fire(ussNode);
                continue;
            }

            const isDir = item.mode.startsWith("d");
            const collapseState = isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
            ussNode = new ZoweUSSNode({
                label: item.name,
                collapsibleState: collapseState,
                parentNode: this,
                parentPath: this.fullPath,
                profile: cachedProfile,
                encoding: isDir ? undefined : this.getEncodingInMap(`${this.fullPath}/${item.name as string}`),
            });
            if (isDir) {
                // Create an entry for the USS folder if it doesn't exist.
                if (!UssFSProvider.instance.exists(ussNode.resourceUri)) {
                    await vscode.workspace.fs.createDirectory(ussNode.resourceUri);
                }
            } else {
                // Create an entry for the USS file if it doesn't exist.
                if (!UssFSProvider.instance.exists(ussNode.resourceUri)) {
                    await vscode.workspace.fs.writeFile(ussNode.resourceUri, new Uint8Array());
                }
            }
            ussNode.setAttributes({
                gid: item.gid,
                uid: item.uid,
                group: item.group,
                perms: item.mode,
                owner: item.user,
            });
            responseNodes.push(ussNode);
        }

        const nodesToAdd = responseNodes.filter((c) => !this.children.includes(c));
        const nodesToRemove = this.children.filter((c) => !responseNodes.includes(c));

        // remove any entries from FS provider that were deleted from mainframe when tree view is refreshed
        for (const node of nodesToRemove) {
            if (node.resourceUri) {
                UssFSProvider.instance.removeEntry(node.resourceUri);
            }
        }

        this.children = this.children
            .concat(nodesToAdd)
            .filter((c) => !nodesToRemove.includes(c))
            .sort((a, b) => (a.label as string).localeCompare(b.label as string));
        this.dirty = false;
        return this.children;
    }

    public getEncoding(): ZosEncoding {
        return UssFSProvider.instance.getEncodingForFile(this.resourceUri);
    }

    public setEncoding(encoding: ZosEncoding): void {
        ZoweLogger.trace("ZoweUSSNode.setEncoding called.");
        if (!(this.contextValue.startsWith(Constants.USS_BINARY_FILE_CONTEXT) || this.contextValue.startsWith(Constants.USS_TEXT_FILE_CONTEXT))) {
            throw new Error(`Cannot set encoding for node with context ${this.contextValue}`);
        }
        if (encoding?.kind === "binary") {
            this.contextValue = Constants.USS_BINARY_FILE_CONTEXT;
        } else {
            this.contextValue = Constants.USS_TEXT_FILE_CONTEXT;
        }
        UssFSProvider.instance.setEncodingForFile(this.resourceUri, encoding);
        if (encoding != null) {
            this.updateEncodingInMap(this.fullPath, encoding);
        } else {
            delete UssFSProvider.instance.encodingMap[this.fullPath];
        }
        if (this.getParent() && this.getParent().contextValue === Constants.FAV_PROFILE_CONTEXT) {
            this.contextValue =
                encoding?.kind === "binary"
                    ? Constants.USS_BINARY_FILE_CONTEXT + Constants.FAV_SUFFIX
                    : Constants.USS_TEXT_FILE_CONTEXT + Constants.FAV_SUFFIX;
        }

        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }

        this.tooltip = USSUtils.injectAdditionalDataToTooltip(this, this.fullPath);
        this.dirty = true;
    }

    public get openedDocumentInstance(): vscode.TextDocument {
        ZoweLogger.trace("ZoweUSSNode.openedDocumentInstance called.");
        return vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === this.resourceUri.toString());
    }

    public renameChild(parentUri: vscode.Uri): void {
        const childPath = path.posix.join(parentUri.path, this.label as string);
        this.fullPath = childPath;
        this.resourceUri = parentUri.with({
            path: childPath,
        });
        this.label = path.posix.basename(this.fullPath);
        this.tooltip = USSUtils.injectAdditionalDataToTooltip(this, childPath);
        if (!SharedContext.isUssDirectory(this)) {
            this.command.arguments = [this.resourceUri];
            return;
        }

        if (this.children.length > 0) {
            this.children.forEach((c) => {
                (c as ZoweUSSNode).renameChild(this.resourceUri);
            });
        }
    }

    /**
     * Helper method to change the UI node names in one go
     * @param newFullPath string
     */
    public async rename(newFullPath: string): Promise<zosfiles.IZosFilesResponse> {
        ZoweLogger.trace("ZoweUSSNode.rename called.");

        const oldUri = vscode.Uri.from({
            scheme: ZoweScheme.USS,
            path: path.posix.join("/", this.profile.name, this.fullPath),
        });
        const newUri = vscode.Uri.from({
            scheme: ZoweScheme.USS,
            path: path.posix.join("/", this.profile.name, newFullPath),
        });

        try {
            await UssFSProvider.instance.rename(oldUri, newUri, { overwrite: false });
        } catch (err) {
            Gui.errorMessage(err.message);
            return;
        }

        this.fullPath = newFullPath;
        this.resourceUri = newUri;
        this.label = path.posix.basename(newFullPath);
        this.tooltip = USSUtils.injectAdditionalDataToTooltip(this, newFullPath);
        // Update the full path of any children already loaded locally
        if (this.children.length > 0) {
            this.children.forEach((child) => {
                (child as ZoweUSSNode).renameChild(newUri);
            });
        }
        const providers = SharedTreeProviders.providers;
        providers.uss.refresh();
        return {
            success: true,
            commandResponse: null,
        };
    }

    /**
     * Reopens a file if it was closed (e.g. while it was being renamed).
     * @param hasClosedInstance
     */
    public async reopen(hasClosedInstance = false): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.reopen called.");
        if (!this.isFolder && (hasClosedInstance || (this.getEncoding()?.kind === "binary" && this.downloaded))) {
            await vscode.commands.executeCommand("vscode.open", this.resourceUri);
        }
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

    public async deleteUSSNode(ussFileProvider: Types.IZoweUSSTreeType, _filePath: string, cancelled: boolean = false): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.deleteUSSNode called.");
        if (cancelled) {
            Gui.showMessage(vscode.l10n.t("Delete action was cancelled."));
            return;
        }
        try {
            await UssFSProvider.instance.delete(this.resourceUri, { recursive: this.isFolder });
        } catch (err) {
            ZoweLogger.error(err);
            if (err instanceof Error) {
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Unable to delete node: {0}",
                        args: [err.message],
                        comment: ["Error message"],
                    })
                );
            }
            throw err;
        }

        Gui.showMessage(
            vscode.l10n.t({
                message: "The item {0} has been deleted.",
                args: [this.label.toString()],
                comment: ["Label"],
            })
        );

        // Remove node from the USS Favorites tree
        await ussFileProvider.removeFavorite(this);
        ussFileProvider.removeFileHistory(`[${this.getProfileName()}]: ${this.parentPath}/${this.label.toString()}`);
        const parent = this.getParent();
        parent.children = parent.children.filter((c) => c !== this);
        if (ussFileProvider.nodeDataChanged) {
            ussFileProvider.nodeDataChanged(parent);
        }

        const parentEquivNode = ussFileProvider.findEquivalentNode(parent, SharedContext.isFavorite(parent));

        if (parentEquivNode != null) {
            // Refresh the correct node (parent of node to delete) to reflect changes
            ussFileProvider.refreshElement(parentEquivNode);
        }
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
            this.tooltip = USSUtils.injectAdditionalDataToTooltip(this, this.fullPath);
        }

        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }
    }

    /**
     * Getter for folder type
     */
    public get isFolder(): boolean {
        return [Constants.USS_DIR_CONTEXT, Constants.USS_DIR_CONTEXT + Constants.FAV_SUFFIX].indexOf(this.contextValue) > -1;
    }

    /**
     * Downloads and displays a file in a text editor view
     *
     * @param {IZoweTreeNode} node
     */
    public async openUSS(forceDownload: boolean, _previewFile: boolean, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.openUSS called.");
        const errorMsg = vscode.l10n.t("openUSS() called from invalid node.");
        switch (true) {
            // For opening favorited and non-favorited files
            case this.getParent().contextValue === Constants.FAV_PROFILE_CONTEXT:
                break;
            case SharedContext.isUssSession(this.getParent()):
                break;
            // Handle file path for files in directories and favorited directories
            case SharedContext.isUssDirectory(this.getParent()):
                break;
            default:
                Gui.errorMessage(errorMsg);
                throw Error(errorMsg);
        }

        await ussFileProvider.checkCurrentProfile(this);

        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            try {
                if (forceDownload) {
                    // if the encoding has changed, fetch the contents with the new encoding
                    await UssFSProvider.instance.fetchFileAtUri(this.resourceUri);
                    await vscode.commands.executeCommand("vscode.open", this.resourceUri);
                    await UssFSProvider.revertFileInEditor();
                } else {
                    await vscode.commands.executeCommand("vscode.open", this.resourceUri);
                }
                if (ussFileProvider) {
                    // Add document name to recently-opened files
                    ussFileProvider.addFileHistory(`[${this.getProfile().name}]: ${this.fullPath}`);
                    ussFileProvider.getTreeView().reveal(this, { select: true, focus: true, expand: false });
                }
            } catch (err) {
                await AuthUtils.errorHandling(err, this.getProfileName());
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
        const errorMsg = vscode.l10n.t("refreshUSS() called from invalid node.");
        switch (true) {
            case SharedContext.isUssDirectory(this.getParent()):
                break;
            // For favorited and non-favorited files
            case this.getParent().contextValue === Constants.FAV_PROFILE_CONTEXT:
            case SharedContext.isUssSession(this.getParent()):
                break;
            default:
                Gui.errorMessage(errorMsg);
                throw Error(errorMsg);
        }

        try {
            await UssFSProvider.instance.fetchFileAtUri(this.resourceUri);
            this.downloaded = true;
        } catch (err) {
            if (err instanceof Error && err.message.includes(vscode.l10n.t("not found"))) {
                ZoweLogger.warn(err.toString());
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Unable to find file: {0}",
                        args: [err.message],
                        comment: ["Error message"],
                    })
                );
            } else {
                await AuthUtils.errorHandling(err, this.getProfileName());
            }
        }
    }

    /**
     * Pastes a subtree of files and folders into another location.
     *
     * @param rootPath The start/root path for pasting the file structure
     * @param tree The structure of files and folders to paste
     * @param ussApi The USS API to use for this operation
     */
    public async paste(
        destUri: vscode.Uri,
        uss: { tree: USSFileStructure.UssFileTree; api?: MainframeInteraction.IUss; options?: zosfiles.IUploadOptions }
    ): Promise<void> {
        ZoweLogger.trace("ZoweUSSNode.paste called.");
        if (!uss.api) {
            ZoweLogger.trace("\terror: paste called with invalid API");
            return;
        }
        const hasCopy = uss.api.copy != null;
        const hasUploadFromBuffer = uss.api.uploadFromBuffer != null;
        if (!uss.api.fileList || (!hasCopy && !hasUploadFromBuffer)) {
            throw new Error(vscode.l10n.t("Required API functions for pasting (fileList and copy/uploadFromBuffer) were not found."));
        }
        const localUri = vscode.Uri.from({
            scheme: ZoweScheme.USS,
            path: uss.tree.localUri.path,
            query: `tree=${encodeURIComponent(JSON.stringify(uss.tree))}`,
        });

        await UssFSProvider.instance.copy(localUri, destUri, {
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
            const fileTreeToPaste: USSFileStructure.UssFileTree = JSON.parse(clipboardContents);
            const api = ZoweExplorerApiRegister.getUssApi(this.profile);

            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: vscode.l10n.t("Uploading USS files..."),
                stageName: 0,
            };
            const options: zosfiles.IUploadOptions = {
                task,
                encoding: prof.profile?.encoding,
                responseTimeout: prof.profile?.responseTimeout,
            };

            for (const subnode of fileTreeToPaste.children) {
                await this.paste(
                    vscode.Uri.from({
                        scheme: ZoweScheme.USS,
                        path: `/${this.profile.name}${this.fullPath}`,
                    }),
                    { api, tree: subnode, options }
                );
            }
        } catch (error) {
            await AuthUtils.errorHandling(error, this.label.toString(), vscode.l10n.t("Error uploading files"));
        }
    }

    private async getUssFiles(profile: imperative.IProfileLoaded): Promise<zosfiles.IZosFilesResponse> {
        try {
            if (!ZoweExplorerApiRegister.getUssApi(profile).getSession(profile)) {
                throw new imperative.ImperativeError({
                    msg: vscode.l10n.t("Profile auth error"),
                    additionalDetails: vscode.l10n.t("Profile is not authenticated, please log in to continue"),
                    errorCode: `${imperative.RestConstants.HTTP_STATUS_401 as number}`,
                });
            }
            if (SharedContext.isSession(this)) {
                return await UssFSProvider.instance.listFiles(
                    profile,
                    SharedContext.isFavorite(this)
                        ? this.resourceUri
                        : this.resourceUri.with({
                              path: path.posix.join(this.resourceUri.path, this.fullPath),
                          })
                );
            } else {
                return await UssFSProvider.instance.listFiles(profile, this.resourceUri);
            }
        } catch (error) {
            await AuthUtils.errorHandling(error, this.getProfileName(), vscode.l10n.t("Retrieving response from USS list API"));
            AuthUtils.syncSessionNode((prof) => ZoweExplorerApiRegister.getUssApi(prof), this.getSessionNode());
            this.dirty = false;
            return { success: false, commandResponse: null };
        }
    }
}
