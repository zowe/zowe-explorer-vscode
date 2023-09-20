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
import * as globals from "../globals";
import * as path from "path";
import { imperative } from "@zowe/cli";
import { FilterItem, FilterDescriptor, errorHandling, syncSessionNode } from "../utils/ProfilesUtils";
import { sortTreeItems, getAppName, checkIfChildPath } from "../shared/utils";
import { Gui, IZoweTree, IZoweUSSTreeNode, NodeInteraction, ValidProfileEnum, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";

import * as nls from "vscode-nls";
import { resetValidationSettings } from "../shared/actions";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";
import { TreeViewUtils } from "../utils/TreeViewUtils";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Creates the USS tree that contains nodes of sessions and data sets
 *
 * @export
 */
export async function createUSSTree(log: imperative.Logger): Promise<USSTree> {
    ZoweLogger.trace("uss.USSTree.createUSSTree called.");
    const tree = new USSTree();
    await tree.initializeFavorites(log);
    await tree.addSession();
    return tree;
}

/**
 * A tree that contains nodes of sessions and USS Files
 *
 * @export
 * @class USSTree
 * @implements {vscode.TreeDataProvider}
 */
export class USSTree extends ZoweTreeProvider implements IZoweTree<IZoweUSSTreeNode> {
    public static readonly defaultDialogText: string = localize("filterPrompt.option.prompt.search", "$(plus) Create a new filter");
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.USS;
    public mFavoriteSession: ZoweUSSNode;
    public mSessionNodes: IZoweUSSTreeNode[] = [];
    public mFavorites: IZoweUSSTreeNode[] = [];
    public lastOpened: NodeInteraction = {};
    private treeView: vscode.TreeView<IZoweUSSTreeNode>;

    public constructor() {
        super(
            USSTree.persistenceSchema,
            new ZoweUSSNode(localize("Favorites", "Favorites"), vscode.TreeItemCollapsibleState.Collapsed, null, null, null)
        );
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession as IZoweUSSTreeNode];
        this.treeView = Gui.createTreeView("zowe.uss.explorer", {
            treeDataProvider: this,
            canSelectMany: true,
        });
    }

    /**
     * Method for renaming a USS Node. This could be a Favorite Node
     *
     * @param originalNode
     * @param {string} filePath
     */
    public async rename(originalNode: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("USSTree.rename called.");
        const currentFilePath = originalNode.getUSSDocumentFilePath(); // The user's complete local file path for the node
        const openedTextDocuments: readonly vscode.TextDocument[] = vscode.workspace.textDocuments; // Array of all documents open in VS Code
        const nodeType = contextually.isFolder(originalNode) ? "folder" : "file";
        const parentPath = path.dirname(originalNode.fullPath);
        let originalNodeInFavorites: boolean = false;
        let oldFavorite: IZoweUSSTreeNode;

        // Could be a favorite or regular entry always deal with the regular entry
        // Check if an old favorite exists for this node
        if (contextually.isFavorite(originalNode) || contextually.isFavoriteDescendant(originalNode)) {
            originalNodeInFavorites = true; // Node is a favorite or a descendant of a node in Favorites section
            oldFavorite = originalNode;
        } else {
            oldFavorite = this.findFavoritedNode(originalNode);
        }

        // If the USS node or any of its children are locally open with unsaved data, prevent rename until user saves their work.
        for (const doc of openedTextDocuments) {
            const docIsChild = checkIfChildPath(currentFilePath, doc.fileName);
            if (doc.fileName === currentFilePath || docIsChild === true) {
                if (doc.isDirty === true) {
                    Gui.errorMessage(
                        localize(
                            "renameUSS.unsavedWork",
                            "Unable to rename {0} because you have unsaved changes in this {1}. Please save your work before renaming the {1}.",
                            originalNode.fullPath,
                            nodeType
                        ),
                        { vsCodeOpts: { modal: true } }
                    );
                    return;
                }
            }
        }
        const loadedNodes = await this.getAllLoadedItems();
        const options: vscode.InputBoxOptions = {
            prompt: localize("renameUSS.enterName", "Enter a new name for the {0}", nodeType),
            value: originalNode.label.toString().replace(/^\[.+\]:\s/, ""),
            ignoreFocusOut: true,
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            validateInput: (value) => this.checkDuplicateLabel(parentPath + value, loadedNodes),
        };
        const newName = await Gui.showInputBox(options);
        if (newName && parentPath + newName !== originalNode.fullPath) {
            try {
                const newNamePath = path.posix.join(parentPath, newName);
                const oldNamePath = originalNode.fullPath;

                // // Handle rename in back-end:
                await ZoweExplorerApiRegister.getUssApi(originalNode.getProfile()).rename(oldNamePath, newNamePath);

                // Handle rename in UI:
                if (oldFavorite) {
                    if (originalNodeInFavorites) {
                        await this.renameUSSNode(originalNode, newNamePath); // Rename corresponding node in Sessions
                    }
                    // Below handles if originalNode is in a session node or is only indirectly in Favorites (e.g. is only a child of a favorite).
                    // Also handles if there are multiple appearances of originalNode in Favorites.
                    // This has to happen before renaming originalNode.rename, as originalNode's label is used to find the favorite equivalent.
                    // Doesn't do anything if there aren't any appearances of originalNode in Favs
                    await this.renameFavorite(originalNode, newNamePath);
                }
                // Rename originalNode in UI
                const hasClosedTab = await originalNode.rename(newNamePath);
                await originalNode.reopen(hasClosedTab);
                this.updateFavorites();
            } catch (err) {
                if (err instanceof Error) {
                    await errorHandling(err, originalNode.mProfileName, localize("renameUSS.error", "Unable to rename node:"));
                }
                throw err;
            }
        }
    }

    public checkDuplicateLabel(newFullPath: string, nodesToCheck: IZoweUSSTreeNode[]): string {
        ZoweLogger.trace("USSTree.checkDuplicateLabel called.");
        for (const node of nodesToCheck) {
            const nodeType = contextually.isFolder(node) ? "folder" : "file";
            if (newFullPath === node.fullPath.trim()) {
                return localize("renameUSS.duplicateName", "A {0} already exists with this name. Please choose a different name.", nodeType);
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
     * This function is for renaming the non-favorited equivalent of a favorited node for a given profile.
     * @param profileLabel
     * @param oldNamePath
     * @param newNamePath
     */
    public async renameUSSNode(node: IZoweUSSTreeNode, newNamePath: string): Promise<void> {
        ZoweLogger.trace("USSTree.renameUSSNode called.");
        const matchingNode: IZoweUSSTreeNode = this.findNonFavoritedNode(node);
        if (matchingNode) {
            await matchingNode.rename(newNamePath);
        }
    }

    /**
     * Renames a node from the favorites list
     *
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
            if (contextually.isFavoriteContext(element)) {
                return this.mFavorites;
            }
            if (element.contextValue && element.contextValue === globals.FAV_PROFILE_CONTEXT) {
                const favsForProfile = await this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    /**
     * Adds a new session to the uss files tree
     *
     * @param {string} [sessionName] - optional; loads persisted profiles or default if not passed
     * @param {string} [profileType] - optional; loads profiles of a certain type if passed
     */
    public async addSession(sessionName?: string, profileType?: string): Promise<void> {
        ZoweLogger.trace("USSTree.addSession called.");
        const setting: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION);
        // Loads profile associated with passed sessionName, persisted profiles or default if none passed
        if (sessionName) {
            const profile: imperative.IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName.trim());

            if (profile) {
                await this.addSingleSession(profile);
                for (const node of this.mSessionNodes) {
                    const name = node.getProfileName();
                    if (name === profile.name) {
                        await resetValidationSettings(node, setting);
                    }
                }
            }
        } else {
            const profiles: imperative.IProfileLoaded[] = await Profiles.getInstance().fetchAllProfiles();
            if (profiles) {
                for (const theProfile of profiles) {
                    // If session is already added, do nothing
                    if (this.mSessionNodes.find((tempNode) => tempNode.label.toString().trim() === theProfile.name.trim())) {
                        continue;
                    }
                    for (const session of this.mHistory.getSessions()) {
                        if (session && session.trim() === theProfile.name) {
                            await this.addSingleSession(theProfile);
                            for (const node of this.mSessionNodes) {
                                const name = node.getProfileName();
                                if (name === theProfile.name) {
                                    await resetValidationSettings(node, setting);
                                }
                            }
                        }
                    }
                }
            }
            if (this.mSessionNodes.length === 1) {
                try {
                    await this.addSingleSession(Profiles.getInstance().getDefaultProfile(profileType));
                } catch (error) {
                    // catch and log error of no default,
                    // if not type passed getDefaultProfile assumes zosmf
                    ZoweLogger.warn(error);
                }
            }
        }
        this.refresh();
    }

    /**
     * Removes a session from the list in the uss files tree
     *
     * @param {IZoweUSSTreeNode} [node]
     */
    public deleteSession(node: IZoweUSSTreeNode): void {
        ZoweLogger.trace("USSTree.deleteSession called.");
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.toString() !== node.label.toString());
        this.mHistory.removeSession(node.label as string);
        this.refresh();
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
            profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
        }
        if (contextually.isUssSession(node)) {
            // Favorite a USS search
            temp = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.None, profileNodeInFavorites, node.getSession(), null, false, profileName);
            temp.fullPath = node.fullPath;
            await this.saveSearch(temp);
            temp.command = { command: "zowe.uss.fullPath", title: "", arguments: [temp] };
        } else {
            // Favorite USS files and directories
            temp = new ZoweUSSNode(
                label,
                node.collapsibleState,
                profileNodeInFavorites,
                node.getSession(),
                node.getParent().fullPath,
                false,
                profileName
            );
            temp.contextValue = contextually.asFavorite(temp);
            if (contextually.isFavoriteTextOrBinary(temp)) {
                temp.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [temp] };
            }
        }
        const icon = getIconByNode(temp);
        if (icon) {
            temp.iconPath = icon.path;
        }
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label.toString().trim() === temp.label.toString().trim())) {
            profileNodeInFavorites.children.push(temp);
            sortTreeItems(profileNodeInFavorites.children, globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            sortTreeItems(this.mFavorites, globals.FAV_PROFILE_CONTEXT);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Adds a search node to the USS favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async saveSearch(node: IZoweUSSTreeNode): Promise<IZoweUSSTreeNode> {
        ZoweLogger.trace("USSTree.saveSearch called.");
        const fullPathLabel = node.fullPath;
        node.label = node.tooltip = fullPathLabel;
        node.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        await this.checkCurrentProfile(node);
        return node;
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
                return this.removeFavProfile(profileName, false);
            }
        }
        await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
        return;
    }

    public updateFavorites(): void {
        ZoweLogger.trace("USSTree.upldateFavorites called.");
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry = "[" + profileNode.label.toString() + "]: " + fav.fullPath + "{" + contextually.getBaseContext(fav) + "}";
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
            const checkConfirmation = localize(
                "removeFavProfile.confirm",
                "This will remove all favorited USS items for profile {0}. Continue?",
                profileName
            );
            const continueRemove = localize("removeFavProfile.continue", "Continue");
            await Gui.warningMessage(checkConfirmation, {
                items: [continueRemove],
                vsCodeOpts: { modal: true },
            }).then((selection) => {
                if (!selection || selection === "Cancel") {
                    cancelled = true;
                }
            });
        }
        if (cancelled) {
            return;
        }

        // Remove favorited profile from UI
        this.mFavorites.forEach((favProfileNode) => {
            const favProfileLabel = favProfileNode.label as string;
            if (favProfileLabel === profileName) {
                this.mFavorites = this.mFavorites.filter((tempNode) => tempNode?.label.toString() !== favProfileLabel);
                favProfileNode.dirty = true;
                this.refresh();
            }
        });

        // Update the favorites in settings file
        await this.updateFavorites();
        return;
    }

    /**
     * Fetches an array of all nodes loaded in the tree
     *
     */
    public async getAllLoadedItems(): Promise<IZoweUSSTreeNode[]> {
        ZoweLogger.trace("USSTree.getAllLoadedItems called.");
        if (this.log) {
            ZoweLogger.debug(localize("enterPattern.log.debug.prompt", "Prompting the user to choose a member from the filtered list"));
        }
        const loadedNodes: IZoweUSSTreeNode[] = [];
        const sessions = await this.getChildren();

        // Add all data sets loaded in the tree to an array
        for (const session of sessions) {
            if (!session.contextValue.includes(globals.FAVORITE_CONTEXT)) {
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
        if (this.log) {
            ZoweLogger.debug(localize("filterPrompt.log.debug.promptUSSPath", "Prompting the user for a USS path"));
        }
        await this.checkCurrentProfile(node);
        if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
            let sessionNode;
            let remotepath: string;
            if (contextually.isSessionNotFav(node)) {
                sessionNode = node;
                if (this.mHistory.getSearchHistory().length > 0) {
                    const createPick = new FilterDescriptor(USSTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory.getSearchHistory().map((element) => new FilterItem({ text: element }));
                    if (globals.ISTHEIA) {
                        // get user selection
                        const choice = await Gui.showQuickPick([createPick, globals.SEPARATORS.RECENT_FILTERS, ...items], {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter"),
                        });
                        if (!choice) {
                            Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
                            return;
                        }
                        remotepath = choice === createPick ? "" : choice.label;
                    } else {
                        const quickpick = Gui.createQuickPick();
                        quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
                        quickpick.items = [createPick, globals.SEPARATORS.RECENT_FILTERS, ...items];
                        quickpick.ignoreFocusOut = true;
                        quickpick.show();
                        const choice = await Gui.resolveQuickPick(quickpick);
                        quickpick.hide();
                        if (!choice) {
                            Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
                            return;
                        }
                        if (choice instanceof FilterDescriptor) {
                            if (quickpick.value) {
                                remotepath = quickpick.value;
                            }
                        } else {
                            remotepath = choice.label;
                        }
                    }
                }
                // manually entering a search - switch to an input box
                const options: vscode.InputBoxOptions = {
                    placeHolder: localize("filterPrompt.option.prompt.placeholder", "New filter"),
                    value: remotepath,
                };
                // get user input
                remotepath = await Gui.showInputBox(options);
                if (!remotepath || remotepath.length === 0) {
                    Gui.showMessage(localize("filterPrompt.enterPath", "You must enter a path."));
                    return;
                }
            } else {
                // executing search from saved search in favorites
                remotepath = node.label as string;
                const profileName = node.getProfileName();
                await this.addSession(profileName);
                const faveNode = node;
                sessionNode = this.mSessionNodes.find((tempNode) => tempNode.getProfileName() === profileName);
                if (!sessionNode.getSession().ISession.user || !sessionNode.getSession().ISession.password) {
                    sessionNode.getSession().ISession.user = faveNode.getSession().ISession.user;
                    sessionNode.getSession().ISession.password = faveNode.getSession().ISession.password;
                    sessionNode.getSession().ISession.base64EncodedAuth = faveNode.getSession().ISession.base64EncodedAuth;
                }
            }
            // Get session for sessionNode
            syncSessionNode(Profiles.getInstance())((profileValue) => ZoweExplorerApiRegister.getUssApi(profileValue).getSession())(node);
            // Sanitization: Replace multiple forward slashes with just one forward slash
            const sanitizedPath = remotepath.replace(/\/+/g, "/").replace(/(\/*)$/, "");
            sessionNode.tooltip = sessionNode.fullPath = sanitizedPath;
            const icon = getIconByNode(sessionNode);
            if (icon) {
                sessionNode.iconPath = icon.path;
            }
            // update the treeview with the new path
            sessionNode.description = sanitizedPath;
            if (!contextually.isFilterFolder(sessionNode)) {
                sessionNode.contextValue += `_${globals.FILTER_SEARCH}`;
            }
            sessionNode.dirty = true;
            this.addSearchHistory(sanitizedPath);
            await TreeViewUtils.expandNode(sessionNode, this);
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
    public createProfileNodeForFavs(profileName: string): ZoweUSSNode {
        ZoweLogger.trace("USSTree.createProfileNodeForFavs called.");
        const favProfileNode = new ZoweUSSNode(
            profileName,
            vscode.TreeItemCollapsibleState.Collapsed,
            this.mFavoriteSession,
            null,
            undefined,
            undefined
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const icon = getIconByNode(favProfileNode);
        if (icon) {
            favProfileNode.iconPath = icon.path;
        }
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
        ZoweLogger.debug(localize("initializeFavorites.log.debug", "Initializing profiles with USS favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            ZoweLogger.debug(localize("initializeFavorites.no.favorites", "No USS favorites found."));
            return;
        }
        for (const line of lines) {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const favLabel = line.substring(line.indexOf(":") + 1, line.indexOf("{")).trim();
            // The profile node used for grouping respective favorited items. (Undefined if not created yet.)
            let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
            if (profileNodeInFavorites === undefined) {
                // If favorite node for profile doesn't exist yet, create a new one for it
                profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
            }
            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNodeForProfile = await this.initializeFavChildNodeForProfile(favLabel, line, profileNodeInFavorites);
            profileNodeInFavorites.children.push(favChildNodeForProfile);
        }
    }

    /**
     * Creates an individual favorites node WITHOUT profiles or sessions, to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited file/folder's label
     * @param contextValue The favorited file/folder's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweUssTreeNode
     */
    public initializeFavChildNodeForProfile(label: string, line: string, parentNode: IZoweUSSTreeNode): ZoweUSSNode {
        ZoweLogger.trace("USSTree.initializeFavChildNodeForProfile called.");
        const favoriteSearchPattern = /^\[.+\]:\s.*\{ussSession\}$/;
        const directorySearchPattern = /^\[.+\]:\s.*\{directory\}$/;
        let node: ZoweUSSNode;
        if (directorySearchPattern.test(line)) {
            node = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.Collapsed, parentNode, null, "", false, null);
        } else if (favoriteSearchPattern.test(line)) {
            node = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.None, parentNode, null, null, false, null);
            node.contextValue = globals.USS_SESSION_CONTEXT;
            node.fullPath = label;
            node.label = node.tooltip = label;
            // add a command to execute the search
            node.command = { command: "zowe.uss.fullPath", title: "", arguments: [node] };
        } else {
            node = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.None, parentNode, null, "", false, null);
            node.command = {
                command: "zowe.uss.ZoweUSSNode.open",
                title: localize("initializeUSSFavorites.lines.title", "Open"),
                arguments: [node],
            };
        }
        node.contextValue = contextually.asFavorite(node);
        const icon = getIconByNode(node);
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
        ZoweLogger.debug(localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for USS favorites", profileName));
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            // If no profile/session yet, then add session and profile to parent profile node in this.mFavorites array:
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                // Set mProfileName for the getProfileName function, but after initialization of child fav nodes.
                // This way, it won't try to load profile in constructor for child fav nodes too early.
                parentNode.mProfileName = profileName;
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || !contextually.isValidationEnabled(parentNode)) {
                    session = await ZoweExplorerApiRegister.getUssApi(profile).getSession();
                    parentNode.setProfileToChoice(profile);
                    parentNode.setSessionToChoice(session);
                } else {
                    const infoNode = new ZoweUSSNode(
                        localize("loadProfilesForFavorites.authFailed", "You must authenticate to view favorites."),
                        vscode.TreeItemCollapsibleState.None,
                        parentNode,
                        null,
                        parentNode.fullPath
                    );
                    infoNode.contextValue = globals.INFORMATION_CONTEXT;
                    infoNode.iconPath = undefined;
                    return [infoNode];
                }
            } catch (error) {
                ZoweLogger.error(error);
                const errMessage: string =
                    localize(
                        "initializeUSSFavorites.error.profile1",
                        "Error: You have Zowe USS favorites that refer to a non-existent CLI profile named: {0}",
                        profileName
                    ) +
                    localize("initializeUSSFavorites.error.profile2", ". To resolve this, you can remove {0}", profileName) +
                    localize(
                        "initializeUSSFavorites.error.profile3",
                        " from the Favorites section of Zowe Explorer's USS view. Would you like to do this now? ",
                        getAppName(globals.ISTHEIA)
                    );
                const btnLabelRemove = localize("initializeUSSFavorites.error.buttonRemove", "Remove");
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
        await sessionNode.getChildren();

        // Reveal the searched item in the tree
        const selectedNode: IZoweUSSTreeNode = sessionNode.children.find((elt) => elt.label === selectedNodeName);
        if (selectedNode) {
            selectedNode.openUSS(false, true, this);
        } else {
            Gui.showMessage(localize("findUSSItem.unsuccessful", "File does not exist. It may have been deleted."));
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
        const match: IZoweUSSTreeNode = parentNode.children.find((child) => child.fullPath === fullPath);
        if (match === undefined) {
            // Is match contained within one of the children?
            for (const node of parentNode.children) {
                const isFullPathChild: boolean = checkIfChildPath(node.fullPath, fullPath);
                if (isFullPathChild) {
                    return this.findMatchInLoadedChildren(node, fullPath);
                }
            }
        }
        return match;
    }

    /**
     * Adds a single session to the USS tree
     *
     */
    private async addSingleSession(profile: imperative.IProfileLoaded): Promise<void> {
        ZoweLogger.trace("USSTree.addSingleSession called.");
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tNode) => tNode.label.toString() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a session with the USS API
            let session: imperative.Session;
            try {
                session = await ZoweExplorerApiRegister.getUssApi(profile).getSession();
            } catch (err) {
                if (err.toString().includes("hostname")) {
                    ZoweLogger.error(err);
                } else {
                    await errorHandling(err, profile.name);
                }
            }
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new ZoweUSSNode(
                profile.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                null,
                session,
                null,
                false,
                profile.name,
                null,
                profile
            );
            node.contextValue = globals.USS_SESSION_CONTEXT;
            await this.refreshHomeProfileContext(node);
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            node.dirty = true;
            this.mSessionNodes.push(node);
            this.mHistory.addSession(profile.name);
        }
    }
}
