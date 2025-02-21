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

import * as vscode from "vscode";
import * as path from "path";
import {
    FsAbstractUtils,
    Gui,
    imperative,
    IZoweUSSTreeNode,
    PersistenceSchemaEnum,
    Types,
    Validation,
    ZosEncoding,
    ZoweExplorerApiType,
    ZoweScheme,
} from "@zowe/zowe-explorer-api";
import { UssFSProvider } from "./UssFSProvider";
import { Constants } from "../../configuration/Constants";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { ZoweTreeProvider } from "../ZoweTreeProvider";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { TreeViewUtils } from "../../utils/TreeViewUtils";
import { SharedContext } from "../shared/SharedContext";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { SharedUtils } from "../shared/SharedUtils";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { FilterDescriptor, FilterItem } from "../../management/FilterManagement";
import { AuthUtils } from "../../utils/AuthUtils";

/**
 * A tree that contains nodes of sessions and USS Files
 *
 * @export
 * @class USSTree
 * @implements {vscode.TreeDataProvider}
 */
export class USSTree extends ZoweTreeProvider<IZoweUSSTreeNode> implements Types.IZoweUSSTreeType {
    public static readonly defaultDialogText: string = `$(plus) ${vscode.l10n.t("Create a new filter")}`;
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.USS;
    public mFavoriteSession: ZoweUSSNode;
    public mSessionNodes: IZoweUSSTreeNode[] = [];
    public mFavorites: IZoweUSSTreeNode[] = [];
    public lastOpened: Types.ZoweNodeInteraction = {};
    private treeView: vscode.TreeView<IZoweUSSTreeNode>;
    public copying: Promise<unknown>;

    // only support drag and drop ops within the USS tree at this point
    public dragMimeTypes: string[] = [];
    public dropMimeTypes: string[] = ["application/vnd.code.tree.zowe.uss.explorer"];

    private draggedNodes: Record<string, IZoweUSSTreeNode> = {};

    public constructor() {
        super(
            USSTree.persistenceSchema,
            new ZoweUSSNode({
                label: vscode.l10n.t("Favorites"),
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            })
        );
        this.mFavoriteSession.contextValue = Constants.FAVORITE_CONTEXT;
        const icon = IconGenerator.getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession as IZoweUSSTreeNode];
        this.treeView = Gui.createTreeView<IZoweUSSTreeNode>("zowe.uss.explorer", {
            treeDataProvider: this,
            dragAndDropController: this,
            canSelectMany: true,
        });
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.treeView.onDidCollapseElement(TreeViewUtils.refreshIconOnCollapse([SharedContext.isUssDirectory, SharedContext.isUssSession], this));
    }

    public handleDrag(source: IZoweUSSTreeNode[], dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): void {
        const items = [];
        for (const srcItem of source) {
            this.draggedNodes[srcItem.resourceUri.path] = srcItem;
            items.push({
                label: srcItem.label,
                uri: srcItem.resourceUri,
            });
        }
        dataTransfer.set("application/vnd.code.tree.zowe.uss.explorer", new vscode.DataTransferItem(items));
    }

    private async crossLparMove(sourceNode: IZoweUSSTreeNode, sourceUri: vscode.Uri, destUri: vscode.Uri, recursiveCall?: boolean): Promise<void> {
        const destinationInfo = FsAbstractUtils.getInfoForUri(destUri, Profiles.getInstance());

        if (SharedContext.isUssDirectory(sourceNode)) {
            if (!UssFSProvider.instance.exists(destUri)) {
                // create directory on remote FS
                try {
                    await ZoweExplorerApiRegister.getUssApi(destinationInfo.profile).create(
                        destUri.path.substring(destinationInfo.slashAfterProfilePos),
                        "directory"
                    );
                } catch (err) {
                    // The directory might already exist. Ignore the error and try to move files
                }
                // create directory entry in local FS
                UssFSProvider.instance.createDirectory(destUri);
            }
            const children = await sourceNode.getChildren();
            for (const childNode of children) {
                // move any files within the folder to the destination
                await this.crossLparMove(
                    childNode,
                    sourceUri.with({
                        path: path.posix.join(sourceUri.path, childNode.label as string),
                    }),
                    destUri.with({
                        path: path.posix.join(destUri.path, childNode.label as string),
                    }),
                    true
                );
            }
            await vscode.workspace.fs.delete(sourceUri, { recursive: true });
        } else {
            // create a file on the remote system for writing
            try {
                await ZoweExplorerApiRegister.getUssApi(destinationInfo.profile).create(
                    destUri.path.substring(destinationInfo.slashAfterProfilePos),
                    "file"
                );
            } catch (err) {
                // The file might already exist. Ignore the error and try to write it to the LPAR
            }
            // read the contents from the source LPAR
            const contents = await UssFSProvider.instance.readFile(sourceNode.resourceUri);
            // write the contents to the destination LPAR
            try {
                await UssFSProvider.instance.writeFile(
                    destUri.with({
                        query: "forceUpload=true",
                    }),
                    contents,
                    { create: true, overwrite: true, noStatusMsg: true }
                );
            } catch (err) {
                // If the write fails, we cannot move to the next file.
                if (err instanceof Error) {
                    Gui.errorMessage(
                        vscode.l10n.t("Failed to move file {0}: {1}", destUri.path.substring(destinationInfo.slashAfterProfilePos), err.message)
                    );
                }
                return;
            }

            if (!recursiveCall) {
                // Delete any files from the selection on the source LPAR
                await vscode.workspace.fs.delete(sourceNode.resourceUri, { recursive: false });
            }
        }
    }

    public async handleDrop(
        targetNode: IZoweUSSTreeNode | undefined,
        dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const droppedItems = dataTransfer.get("application/vnd.code.tree.zowe.uss.explorer");
        if (!droppedItems) {
            return;
        }

        // get the closest parent folder if the target is a file node
        let target = targetNode;
        if (!SharedContext.isUssDirectory(target)) {
            target = target.getParent() as IZoweUSSTreeNode;
        }

        const overwrite = await SharedUtils.handleDragAndDropOverwrite(target, this.draggedNodes);
        if (overwrite === false) {
            return;
        }

        const movingMsg = Gui.setStatusBarMessage(`$(sync~spin) ${vscode.l10n.t("Moving USS files...")}`);
        const parentsToUpdate = new Set<IZoweUSSTreeNode>();

        for (const item of droppedItems.value) {
            const node = this.draggedNodes[item.uri.path];
            if (node.getParent() === target) {
                // skip nodes that are direct children of the target node
                continue;
            }

            const newUriForNode = vscode.Uri.from({
                scheme: ZoweScheme.USS,
                path: path.posix.join("/", target.getProfile().name, target.fullPath, item.label as string),
            });
            const prof = node.getProfile();
            const hasMoveApi = ZoweExplorerApiRegister.getUssApi(prof).move != null;

            if (target.getProfile() !== prof || !hasMoveApi) {
                // Cross-LPAR, or the "move" API does not exist: write the folders/files on the destination LPAR and delete from source LPAR
                await this.crossLparMove(node, node.resourceUri, newUriForNode);
            } else if (await UssFSProvider.instance.move(item.uri, newUriForNode)) {
                // remove node from old parent and relocate to new parent
                const oldParent = node.getParent() as IZoweUSSTreeNode;
                oldParent.children = oldParent.children.filter((c) => c !== node);
                node.resourceUri = newUriForNode;
            }
            parentsToUpdate.add(node.getParent() as IZoweUSSTreeNode);
        }
        for (const parent of parentsToUpdate) {
            this.refreshElement(parent);
        }
        this.refreshElement(target);
        movingMsg.dispose();
        this.draggedNodes = {};
    }

    /**
     * Method for renaming a USS Node. This could be a Favorite Node
     *
     * @param originalNode
     * @param {string} filePath
     */
    public async rename(originalNode: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.rename called.");
        await Profiles.getInstance().checkCurrentProfile(originalNode.getProfile());
        if (await TreeViewUtils.errorForUnsavedResource(originalNode)) {
            return;
        }

        const nodeType = SharedContext.isFolder(originalNode) ? "folder" : "file";
        const parentPath = path.dirname(originalNode.fullPath);

        const loadedNodes = await this.getAllLoadedItems();
        const options: vscode.InputBoxOptions = {
            prompt: vscode.l10n.t({
                message: "Enter a new name for the {0}",
                args: [nodeType],
                comment: ["Node type"],
            }),
            value: originalNode.label.toString().replace(/^\[.+\]:\s/, ""),
            ignoreFocusOut: true,
            validateInput: (value) => this.checkDuplicateLabel(parentPath + value, loadedNodes),
        };
        const newName = await Gui.showInputBox(options);
        if (newName && parentPath + newName !== originalNode.fullPath) {
            try {
                const newNamePath = path.posix.join(parentPath, newName);

                const favDescendant = SharedContext.isFavoriteDescendant(originalNode);
                const originalInFavorites = SharedContext.isFavorite(originalNode) || favDescendant;

                const equivalentNode = this.findEquivalentNode(originalNode, originalInFavorites);

                // Use the node implementation to do the actual rename operation
                await originalNode.rename(newNamePath);

                if (equivalentNode != null) {
                    if (originalInFavorites) {
                        // this is a non-favorited node: refresh parent
                        SharedTreeProviders.uss.refreshElement(equivalentNode.getParent());
                    } else {
                        const nodeParent = equivalentNode.getParent();
                        if (
                            (SharedContext.isFavorite(nodeParent) || SharedContext.isFavoriteDescendant(nodeParent)) &&
                            SharedContext.isUssDirectory(nodeParent)
                        ) {
                            // parent folder is favorited; refresh element
                            this.refreshElement(nodeParent as ZoweUSSNode);
                        } else {
                            // equivalent node is favorited and not a descendant
                            equivalentNode.fullPath = originalNode.fullPath;
                            equivalentNode.label = originalNode.label;
                            equivalentNode.resourceUri = originalNode.resourceUri;
                            equivalentNode.tooltip = originalNode.tooltip;
                            if (nodeType === "folder" && equivalentNode.children.length > 0) {
                                equivalentNode.children.forEach((child) => {
                                    (child as ZoweUSSNode).renameChild(equivalentNode.resourceUri);
                                });
                            }
                        }
                    }
                }

                // only reassign a command for renamed file nodes
                if (!SharedContext.isUssDirectory(originalNode)) {
                    originalNode.command.arguments = [originalNode.resourceUri];
                }
                this.mOnDidChangeTreeData.fire();
                this.updateFavorites();
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Uss,
                        profile: originalNode.getProfile(),
                        scenario: vscode.l10n.t("Unable to rename node:"),
                    });
                }
                throw err;
            }
        }
    }

    public checkDuplicateLabel(newFullPath: string, nodesToCheck: IZoweUSSTreeNode[]): string {
        ZoweLogger.trace("USSTree.checkDuplicateLabel called.");
        for (const node of nodesToCheck) {
            const nodeType = SharedContext.isFolder(node) ? "folder" : "file";
            if (newFullPath === node.fullPath.trim()) {
                return vscode.l10n.t({
                    message: "A {0} already exists with this name. Please choose a different name.",
                    args: [nodeType],
                    comment: ["Node type"],
                });
            }
        }
        return null;
    }

    public open(_node: IZoweUSSTreeNode, _preview: boolean): void {
        throw new Error("Method not implemented.");
    }
    public copy(_node: IZoweUSSTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public paste(_node: IZoweUSSTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public delete(_node: IZoweUSSTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public saveFile(_document: vscode.TextDocument): void {
        throw new Error("Method not implemented.");
    }
    public refreshPS(_node: IZoweUSSTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(_node: IZoweUSSTreeNode): void {
        throw new Error("Method not implemented.");
    }

    /**
     * Finds the equivalent node as a favorite.
     * Used to ensure functions like delete, rename are synced between non-favorite nodes and their favorite equivalents.
     * This will also find the node if it is a child of a favorite and has been loaded.
     *
     * @param node
     */
    public findFavoritedNode(node: IZoweUSSTreeNode): IZoweUSSTreeNode {
        ZoweLogger.trace("USSTree.findFavoriteNode called.");
        let matchingNodeInFavs: IZoweUSSTreeNode;
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites) {
            matchingNodeInFavs = this.findMatchInLoadedChildren(profileNodeInFavorites, node.fullPath);
        }
        return matchingNodeInFavs;
    }

    /**
     * Finds the equivalent node not as a favorite
     *
     * @param node The favorited node you want to find the non-favorite equivalent for.
     */
    public findNonFavoritedNode(node: IZoweUSSTreeNode): IZoweUSSTreeNode {
        ZoweLogger.trace("USSTree.findNonFavoriteNode called.");
        let matchingNode: IZoweUSSTreeNode;
        const profileName = node.getProfileName();
        const sessionNode = this.mSessionNodes.find((session) => session.getProfileName() === profileName);
        if (sessionNode) {
            matchingNode = this.findMatchInLoadedChildren(sessionNode, node.fullPath);
        }
        return matchingNode;
    }

    /**
     * Finds the equivalent node based on whether the passed node is a favorite.
     * @param node
     */
    public findEquivalentNode(node: IZoweUSSTreeNode, isFavorite: boolean): IZoweUSSTreeNode {
        ZoweLogger.trace("USSTree.findEquivalentNode called.");
        return isFavorite ? this.findNonFavoritedNode(node) : this.findFavoritedNode(node);
    }

    /**
     * Renames a node from the favorites list
     * @deprecated No longer used as more info is now needed during the rename operation.

     * @param node
     */
    public async renameFavorite(node: IZoweUSSTreeNode, newNamePath: string): Promise<void> {
        ZoweLogger.trace("USSTree.renameFavorite called.");
        const matchingNode: IZoweUSSTreeNode = this.findFavoritedNode(node);
        if (matchingNode) {
            await matchingNode.rename(newNamePath);
            this.refreshElement(this.mFavoriteSession); // Needed in case the node appears multiple times in Favorites (e.g. as child, grandchild)
        }
    }

    /**
     * Returns the tree view for the current USSTree
     *
     * @returns {vscode.TreeView<ZoweUSSNode>}
     */
    public getTreeView(): vscode.TreeView<IZoweUSSTreeNode> {
        ZoweLogger.trace("USSTree.getTreeView called.");
        return this.treeView;
    }

    /**
     * Takes argument of type IZoweUSSTreeNode and retrieves all of the first level children
     *
     * @param {IZoweUSSTreeNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweUSSTreeNode[] | Promise<IZoweUSSTreeNode[]>}
     */
    public async getChildren(element?: IZoweUSSTreeNode | undefined): Promise<IZoweUSSTreeNode[]> {
        ZoweLogger.trace("USSTree.getChildren called.");
        if (element) {
            if (SharedContext.isFavoriteContext(element)) {
                return this.mFavorites;
            }
            if (element.contextValue && element.contextValue === Constants.FAV_PROFILE_CONTEXT) {
                const favsForProfile = await this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    /**
     * Adds a single session to the tree
     * @param profile the profile to add to the tree
     */
    public async addSingleSession(profile: imperative.IProfileLoaded): Promise<void> {
        ZoweLogger.trace("USSTree.addSingleSession called.");
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tNode) => tNode.label.toString() === profile.name)) {
                return;
            }
            // If there is no API registered for the profile type, do nothing
            if (!ZoweExplorerApiRegister.getInstance().registeredUssApiTypes().includes(profile.type)) {
                ZoweLogger.warn(`USS API is not registered for profile type ${profile.type}, skipping ${profile.name}`);
                return;
            }
            // Uses loaded profile to create a session with the USS API
            let session: imperative.Session;
            try {
                session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
            } catch (err) {
                if (err.toString().includes("hostname")) {
                    ZoweLogger.error(err);
                } else {
                    await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Uss, profile });
                }
            }
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new ZoweUSSNode({
                label: profile.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile,
                contextOverride: Constants.USS_SESSION_CONTEXT + Constants.TYPE_SUFFIX + profile.type,
            });
            await this.refreshHomeProfileContext(node);
            const icon = IconGenerator.getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            node.dirty = true;
            this.mSessionNodes.push(node);
            this.mHistory.addSession(profile.name);
        }
    }

    /**
     * Removes a session from the list in the uss files tree
     *
     * @param {IZoweUSSTreeNode} [node]
     */
    public deleteSession(node: IZoweUSSTreeNode, hideFromAllTrees?: boolean): void {
        ZoweLogger.trace("USSTree.deleteSession called.");
        super.deleteSession(node, hideFromAllTrees);
    }

    /**
     * Adds a node to the USS favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async addFavorite(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.addFavorite called.");
        let temp: ZoweUSSNode;
        const label = node.fullPath;
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites === undefined) {
            // If favorite node for profile doesn't exist yet, create a new one for it
            profileNodeInFavorites = await this.createProfileNodeForFavs(profileName);
        }
        if (SharedContext.isUssSession(node)) {
            if (!node.fullPath) {
                this.refreshElement(this.mFavoriteSession);
                return;
            }

            // Favorite a USS search
            temp = new ZoweUSSNode({
                label,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: profileNodeInFavorites,
                session: node.getSession(),
                profile: node.getProfile(),
            });
            temp.fullPath = node.fullPath;
            await this.saveSearch(temp);
            temp.command = { command: "zowe.uss.fullPath", title: "", arguments: [temp] };
        } else {
            // Favorite USS files and directories
            temp = new ZoweUSSNode({
                label,
                collapsibleState: node.collapsibleState,
                parentNode: profileNodeInFavorites,
                session: node.getSession(),
                profile: node.getProfile(),
                parentPath: node.getParent().fullPath,
            });
            temp.resourceUri = node.resourceUri;
            temp.contextValue = SharedContext.asFavorite(temp);
            if (SharedContext.isFavoriteTextOrBinary(temp)) {
                temp.command = node.command;
            }
        }
        const icon = IconGenerator.getIconByNode(temp);
        if (icon) {
            temp.iconPath = icon.path;
        }
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label.toString().trim() === temp.label.toString().trim())) {
            profileNodeInFavorites.children.push(temp);
            SharedUtils.sortTreeItems(profileNodeInFavorites.children, Constants.USS_SESSION_CONTEXT + Constants.FAV_SUFFIX);
            SharedUtils.sortTreeItems(this.mFavorites, Constants.FAV_PROFILE_CONTEXT);
            this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Adds a search node to the USS favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async saveSearch(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.saveSearch called.");
        const fullPathLabel = node.fullPath;
        node.label = node.tooltip = fullPathLabel;
        node.contextValue = Constants.USS_SESSION_CONTEXT + Constants.FAV_SUFFIX;
        await this.checkCurrentProfile(node);
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async removeFavorite(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.removeFavorite called.");
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites) {
            profileNodeInFavorites.children = profileNodeInFavorites.children?.filter(
                (temp) => !(temp.label === node.label && temp.contextValue.startsWith(node.contextValue))
            );
            // Remove profile node from Favorites if it contains no more favorites.
            if (profileNodeInFavorites.children?.length < 1) {
                await this.removeFavProfile(profileName, false);
            }
        }
        this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }

    public updateFavorites(): void {
        ZoweLogger.trace("USSTree.upldateFavorites called.");
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry = "[" + profileNode.label.toString() + "]: " + fav.fullPath + "{" + SharedContext.getBaseContext(fav) + "}";
                favoritesArray.push(favoriteEntry);
            });
        });
        this.mHistory.updateFavorites(favoritesArray);
    }

    /**
     * Removes profile node from Favorites section
     * @param profileName Name of profile
     * @param userSelected True if the function is being called directly because the user selected to remove the profile from Favorites
     */
    public async removeFavProfile(profileName: string, userSelected: boolean): Promise<void> {
        ZoweLogger.trace("USSTree.removeFavProfile called.");
        // If user selected the "Remove profile from Favorites option", confirm they are okay with deleting all favorited items for that profile.
        let cancelled = false;
        if (userSelected) {
            const checkConfirmation = vscode.l10n.t({
                message: "This will remove all favorited USS items for profile {0}. Continue?",
                args: [profileName],
                comment: ["Profile name"],
            });
            const continueRemove = vscode.l10n.t("Continue");
            const selection = await Gui.warningMessage(checkConfirmation, {
                items: [continueRemove],
                vsCodeOpts: { modal: true },
            });
            if (!selection || selection === "Cancel") {
                cancelled = true;
            }
        }
        if (cancelled) {
            return;
        }

        // Remove favorited profile from UI
        this.mFavorites.forEach((favProfileNode) => {
            const favProfileLabel = favProfileNode.label?.toString();
            if (favProfileLabel === profileName) {
                this.mFavorites = this.mFavorites.filter((tempNode) => tempNode?.label.toString() !== favProfileLabel);
                favProfileNode.dirty = true;
                this.refresh();
            }
        });

        // Update the favorites in settings file
        this.updateFavorites();
    }

    /**
     * Fetches an array of all nodes loaded in the tree
     *
     */
    public async getAllLoadedItems(): Promise<IZoweUSSTreeNode[]> {
        ZoweLogger.trace("USSTree.getAllLoadedItems called.");
        ZoweLogger.debug(vscode.l10n.t("Prompting the user to choose a member from the filtered list"));
        const loadedNodes: IZoweUSSTreeNode[] = [];
        const sessions = await this.getChildren();

        // Add all data sets loaded in the tree to an array
        for (const session of sessions) {
            if (!session.contextValue.includes(Constants.FAVORITE_CONTEXT)) {
                const nodes = await session.getChildren();

                const checkForChildren = async (nodeToCheck: IZoweUSSTreeNode): Promise<void> => {
                    const children = nodeToCheck.children;
                    if (children.length !== 0) {
                        for (const child of children) {
                            await checkForChildren(child);
                        }
                    }
                    loadedNodes.push(nodeToCheck);
                };

                if (nodes) {
                    for (const node of nodes) {
                        await checkForChildren(node);
                    }
                }
            }
        }
        return loadedNodes;
    }

    /**
     * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
     *
     * @param {IZoweUSSTreeNode} node - The session node
     * @returns {Promise<void>}
     */
    public async filterPrompt(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.filterPrompt called.");
        await this.checkCurrentProfile(node);
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            let remotepath: string;
            if (SharedContext.isSessionNotFav(node)) {
                ZoweLogger.debug(vscode.l10n.t("Prompting the user for a USS path"));
                if (this.mHistory.getSearchHistory().length > 0) {
                    const createPick = new FilterDescriptor(USSTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory.getSearchHistory().map((element) => new FilterItem({ text: element }));
                    const quickpick = Gui.createQuickPick();
                    quickpick.placeholder = vscode.l10n.t("Select a filter");
                    quickpick.items = [createPick, Constants.SEPARATORS.RECENT_FILTERS, ...items];
                    quickpick.ignoreFocusOut = true;
                    quickpick.show();
                    const choice = await Gui.resolveQuickPick(quickpick);
                    quickpick.hide();
                    if (!choice) {
                        Gui.showMessage(vscode.l10n.t("No selection made. Operation cancelled."));
                        quickpick.dispose();
                        return;
                    }
                    if (choice instanceof FilterDescriptor) {
                        if (quickpick.value) {
                            remotepath = quickpick.value;
                        }
                    } else {
                        remotepath = choice.label;
                    }
                    quickpick.dispose();
                }
                // manually entering a search - switch to an input box
                const options: vscode.InputBoxOptions = {
                    placeHolder: vscode.l10n.t("New filter"),
                    value: remotepath,
                    validateInput: (input: string) => (input.length > 0 ? null : vscode.l10n.t("Please enter a valid USS path.")),
                };
                // get user input
                remotepath = await Gui.showInputBox(options);
                if (remotepath == null) {
                    return;
                }
            } else {
                // executing search from saved search in favorites
                remotepath = node.label as string;
                // add the session if it doesn't already exist
                const profileName = node.getProfileName();
                await this.addSession({ sessionName: profileName });
                // grab the session and check to see if the session on the favorited node needs updated
                const nonFavNode = this.mSessionNodes.find((tempNode) => tempNode.getProfileName() === profileName);
                if (nonFavNode && (!node.getSession().ISession.user || !node.getSession().ISession.password)) {
                    node.getSession().ISession.user = nonFavNode.getSession().ISession.user;
                    node.getSession().ISession.password = nonFavNode.getSession().ISession.password;
                    node.getSession().ISession.base64EncodedAuth = nonFavNode.getSession().ISession.base64EncodedAuth;
                }
            }
            // Get session for sessionNode
            AuthUtils.syncSessionNode((profile) => ZoweExplorerApiRegister.getUssApi(profile), node);
            // Sanitization: Replace multiple forward slashes with just one forward slash
            const sanitizedPath = remotepath.replace(/\/+/g, "/").replace(/(\/*)$/, "");
            node.fullPath = sanitizedPath;
            const icon = IconGenerator.getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            // update the treeview with the new path
            if (!SharedContext.isFavorite(node)) {
                node.description = sanitizedPath;
            }
            if (!SharedContext.isFilterFolder(node)) {
                node.contextValue += `_${Constants.FILTER_SEARCH}`;
            }
            node.dirty = true;
            this.addSearchHistory(sanitizedPath);
            await TreeViewUtils.expandNode(node, this);
            this.refresh();
        }
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param ussFileProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweUSSTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(ussFileProvider: IZoweUSSTreeNode[], profileName: string): IZoweUSSTreeNode | undefined {
        ZoweLogger.trace("USSTree.findMatchingProfileInArray called.");
        return ussFileProvider.find((treeNode) => treeNode.label === profileName);
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {ZoweUSSNode}
     */
    public async createProfileNodeForFavs(profileName: string): Promise<ZoweUSSNode | null> {
        ZoweLogger.trace("USSTree.createProfileNodeForFavs called.");
        let favProfileNode: ZoweUSSNode;
        try {
            const profile = Profiles.getInstance().loadNamedProfile(profileName);
            favProfileNode = new ZoweUSSNode({
                label: profileName,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.FAV_PROFILE_CONTEXT,
                parentNode: this.mFavoriteSession,
                profile,
            });
        } catch (err) {
            if (err instanceof Error) {
                ZoweLogger.warn(`Skipping creation of favorited profile. ${err.toString()}`);
            }
            return null;
        }

        if (await this.isGlobalProfileNode(favProfileNode)) {
            favProfileNode.contextValue += Constants.HOME_SUFFIX;
            const icon = IconGenerator.getIconByNode(favProfileNode);
            if (icon) {
                favProfileNode.iconPath = icon.path;
            }
        } else {
            favProfileNode.contextValue = Constants.USS_SESSION_CONTEXT;
            const icon = IconGenerator.getIconByNode(favProfileNode);
            if (icon) {
                favProfileNode.iconPath = icon.path;
            }
        }
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        this.mFavorites.push(favProfileNode);
        return favProfileNode;
    }

    /**
     * Initializes the Favorites tree based on favorites held in persistent store.
     * Includes creating profile nodes in Favorites, as well as profile-less child favorite nodes.
     * Profile loading only occurs in loadProfilesForFavorites when the profile node in Favorites is clicked on.
     * @param log
     */
    public async initializeFavorites(log: imperative.Logger): Promise<void> {
        ZoweLogger.trace("USSTree.initializeFavorites called.");
        this.log = log;
        ZoweLogger.debug(vscode.l10n.t("Initializing profiles with USS favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            ZoweLogger.debug(vscode.l10n.t("No USS favorites found."));
            return;
        }

        const favorites = SharedUtils.parseFavorites(lines);
        for (const fav of favorites) {
            // The profile node used for grouping respective favorited items.
            // Create a node if it does not already exist in the Favorites array
            const favProfileNode =
                this.findMatchingProfileInArray(this.mFavorites, fav.profileName) ?? (await this.createProfileNodeForFavs(fav.profileName));

            if (favProfileNode == null || fav.contextValue == null) {
                continue;
            }

            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNode = await this.initializeFavChildNodeForProfile(fav.label, fav.contextValue, favProfileNode);
            if (favChildNode != null) {
                favProfileNode.children.push(favChildNode);
            }
        }
    }

    /**
     * Creates an individual favorites node to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited file/folder's label
     * @param contextValue The favorited file/folder's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweUssTreeNode
     */
    public async initializeFavChildNodeForProfile(label: string, context: string, parentNode: IZoweUSSTreeNode): Promise<ZoweUSSNode> {
        ZoweLogger.trace("USSTree.initializeFavChildNodeForProfile called.");
        const profile = parentNode.getProfile();
        let node: ZoweUSSNode;
        switch (context) {
            case Constants.USS_DIR_CONTEXT:
                node = new ZoweUSSNode({
                    label,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    parentNode,
                    profile,
                });
                if (!UssFSProvider.instance.exists(node.resourceUri)) {
                    await vscode.workspace.fs.createDirectory(node.resourceUri);
                }
                break;
            case Constants.USS_SESSION_CONTEXT:
                node = new ZoweUSSNode({
                    label,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.USS_SESSION_CONTEXT + Constants.FAV_SUFFIX,
                    parentNode,
                    profile,
                });
                node.fullPath = label;
                node.label = node.tooltip = label;
                break;
            default:
                // assume context is "textFile"
                node = new ZoweUSSNode({
                    label,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode,
                    profile,
                });
                if (!UssFSProvider.instance.exists(node.resourceUri)) {
                    const parentUri = node.resourceUri.with({ path: path.posix.join(node.resourceUri.path, "..") });
                    if (!UssFSProvider.instance.exists(parentUri)) {
                        await vscode.workspace.fs.createDirectory(parentUri);
                    }
                    await vscode.workspace.fs.writeFile(node.resourceUri, new Uint8Array());
                }
                if (!UssFSProvider.instance.exists(node.resourceUri)) {
                    const parentUri = node.resourceUri.with({ path: path.posix.join(node.resourceUri.path, "..") });
                    if (!UssFSProvider.instance.exists(parentUri)) {
                        await vscode.workspace.fs.createDirectory(parentUri);
                    }
                    await vscode.workspace.fs.writeFile(node.resourceUri, new Uint8Array());
                }
                break;
        }
        node.contextValue = SharedContext.asFavorite(node);
        const icon = IconGenerator.getIconByNode(node);
        if (icon) {
            node.iconPath = icon.path;
        }
        return node;
    }

    /**
     * Loads profile for the profile node in Favorites that was clicked on, as well as for its children favorites.
     * @param log
     * @param parentNode
     */
    public async loadProfilesForFavorites(log: imperative.Logger, parentNode: IZoweUSSTreeNode): Promise<IZoweUSSTreeNode[] | ZoweUSSNode[]> {
        ZoweLogger.trace("USSTree.loadProfilesForFavorites called.");
        const profileName = parentNode.label as string;
        const updatedFavsForProfile: IZoweUSSTreeNode[] = [];
        let profile: imperative.IProfileLoaded;
        let session: imperative.Session;
        this.log = log;
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Loading profile: {0} for USS favorites",
                args: [profileName],
                comment: ["Profile name"],
            })
        );
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            // If no profile/session yet, then add session and profile to parent profile node in this.mFavorites array:
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (Profiles.getInstance().validProfile === Validation.ValidationType.VALID || !SharedContext.isValidationEnabled(parentNode)) {
                    session = await ZoweExplorerApiRegister.getUssApi(profile).getSession();
                    parentNode.setProfileToChoice(profile);
                    parentNode.setSessionToChoice(session);
                } else {
                    const infoNode = new ZoweUSSNode({
                        label: vscode.l10n.t("You must authenticate to view favorites."),
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode,
                        parentPath: parentNode.fullPath,
                        contextOverride: Constants.INFORMATION_CONTEXT,
                    });
                    return [infoNode];
                }
            } catch (error) {
                ZoweLogger.error(error);
                const errMessage: string = vscode.l10n.t({
                    message: `Error: You have Zowe USS favorites that refer to a non-existent CLI profile named: {0}.
                     To resolve this, you can remove {0} from the Favorites section of Zowe Explorer's USS view.
                      Would you like to do this now? {1}`,
                    args: [profileName, SharedUtils.getAppName()],
                    comment: ["Profile name", "Application name"],
                });
                const btnLabelRemove = vscode.l10n.t("initializeUSSFavorites.error.buttonRemove", "Remove");
                Gui.errorMessage(errMessage, {
                    items: [btnLabelRemove],
                    vsCodeOpts: { modal: true },
                }).then(async (selection) => {
                    if (selection === btnLabelRemove) {
                        await this.removeFavProfile(profileName, false);
                    }
                });
                return;
            }
        }
        profile = parentNode.getProfile();
        session = parentNode.getSession();
        // Pass loaded profile/session to the parent node's favorites children.
        const profileInFavs = this.findMatchingProfileInArray(this.mFavorites, profileName);
        const favsForProfile = profileInFavs.children;
        for (const favorite of favsForProfile) {
            // If profile and session already exists for favorite node, add to updatedFavsForProfile and go to next array item
            if (favorite.getProfile() && favorite.getSession()) {
                updatedFavsForProfile.push(favorite);
                continue;
            }
            // If no profile/session for favorite node yet, then add session and profile to favorite node:
            favorite.setProfileToChoice(profile);
            favorite.setSessionToChoice(session);
            updatedFavsForProfile.push(favorite);
        }
        // This updates the profile node's children in the this.mFavorites array, as well.
        return updatedFavsForProfile;
    }

    public addFileHistory(criteria: string): void {
        ZoweLogger.trace("USSTree.addFileHistory called.");
        this.mHistory.addFileHistory(criteria);
        this.refresh();
    }

    public getFileHistory(): string[] {
        ZoweLogger.trace("USSTree.getFileHistory called.");
        return this.mHistory.getFileHistory();
    }

    public removeFileHistory(name: string): void {
        ZoweLogger.trace("USSTree.removeFileHistory called.");
        this.mHistory.removeFileHistory(name);
    }

    public removeSearchHistory(name: string): void {
        ZoweLogger.trace("USSTree.removeSearchHistory called.");
        this.mHistory.removeSearchHistory(name);
    }

    public removeSession(name: string): void {
        ZoweLogger.trace("USSTree.removeSession called.");
        this.mHistory.removeSession(name);
    }

    public resetSearchHistory(): void {
        ZoweLogger.trace("USSTree.resetSearchHistory called.");
        this.mHistory.resetSearchHistory();
    }

    public resetFileHistory(): void {
        ZoweLogger.trace("USSTree.resetFileHistory called.");
        this.mHistory.resetFileHistory();
    }

    public getSessions(): string[] {
        ZoweLogger.trace("USSTree.getSessions called.");
        return this.mHistory.getSessions();
    }

    public getFavorites(): string[] {
        ZoweLogger.trace("USSTree.getFavorites called.");
        return this.mHistory.readFavorites();
    }

    /**
     * Opens a USS item & reveals it in the tree
     *
     */
    public async openItemFromPath(itemPath: string, sessionNode: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.openItemFromPath called.");
        // USS file was selected
        const nodePath = itemPath
            .substring(itemPath.indexOf("/") + 1)
            .trim()
            .split("/");
        const selectedNodeName = nodePath[nodePath.length - 1];

        // Update the tree filter & expand the tree
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        sessionNode.tooltip = sessionNode.fullPath = `/${nodePath.slice(0, nodePath.length - 1).join("/")}`;
        sessionNode.label = `${sessionNode.getProfileName()} [/${nodePath.join("/")}]`;
        sessionNode.dirty = true;
        this.addSearchHistory(`[${sessionNode.getProfileName()}]: /${nodePath.join("/")}`);
        const children = await sessionNode.getChildren();

        // Reveal the searched item in the tree
        const selectedNode: IZoweUSSTreeNode = children.find((elt) => elt.label === selectedNodeName);
        if (selectedNode) {
            await selectedNode.openUSS(false, true, this);
        } else {
            Gui.showMessage(vscode.l10n.t("File does not exist. It may have been deleted."));
            this.removeFileHistory(`[${sessionNode.getProfileName()}]: ${itemPath}`);
        }
    }

    /**
     * Finds matching node by fullPath in the loaded descendants (i.e. children, grandchildren, etc.) of a parent node.
     * @param parentNode The node whose descendants are being searched through.
     * @param fullPath The fullPath used as the matching criteria.
     * @returns {IZoweUSSTreeNode}
     */
    protected findMatchInLoadedChildren(parentNode: IZoweUSSTreeNode, fullPath: string): IZoweUSSTreeNode {
        ZoweLogger.trace("USSTree.findMatchInLoadedChildren called.");
        // // Is match direct child?
        const match = parentNode.children.find((child) => child.fullPath === fullPath);
        if (match === undefined) {
            // Is match contained within one of the children?
            for (const node of parentNode.children) {
                if (node.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    continue;
                }
                const isFullPathChild: boolean = SharedUtils.checkIfChildPath(node.fullPath, fullPath);
                if (isFullPathChild) {
                    return this.findMatchInLoadedChildren(node, fullPath);
                }
            }
        }
        return match;
    }

    public async openWithEncoding(node: IZoweUSSTreeNode, encoding?: ZosEncoding): Promise<void> {
        if (encoding == null) {
            const ussApi = ZoweExplorerApiRegister.getUssApi(node.getProfile());
            let taggedEncoding: string;
            if (ussApi.getTag != null) {
                taggedEncoding = await ussApi.getTag(node.fullPath);
            }
            encoding = await SharedUtils.promptForEncoding(node, taggedEncoding !== "untagged" ? taggedEncoding : undefined);
        }
        if (encoding !== undefined) {
            if (!(await FsAbstractUtils.confirmForUnsavedDoc(node.resourceUri))) {
                return;
            }
            await node.setEncoding(encoding);
            await node.openUSS(true, false, this);
        }
    }
}
