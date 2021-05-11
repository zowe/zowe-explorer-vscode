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

import * as vscode from "vscode";
import * as globals from "../globals";
import * as path from "path";
import { IProfileLoaded, Logger, Session } from "@zowe/imperative";
import { FilterItem, FilterDescriptor, resolveQuickPickHelper, errorHandling } from "../utils/ProfilesUtils";
import { sortTreeItems, getAppName, checkIfChildPath } from "../shared/utils";
import { IZoweTree, IZoweUSSTreeNode, ValidProfileEnum, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";

import * as nls from "vscode-nls";
import { resetValidationSettings } from "../shared/actions";
import { PersistentFilters } from "../PersistentFilters";
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
export async function createUSSTree(log: Logger) {
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
    public static readonly defaultDialogText: string =
        "\uFF0B " + localize("filterPrompt.option.prompt.search", "Create a new filter");
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.USS;
    public mFavoriteSession: ZoweUSSNode;
    public mSessionNodes: IZoweUSSTreeNode[] = [];
    public mFavorites: IZoweUSSTreeNode[] = [];
    private treeView: vscode.TreeView<IZoweUSSTreeNode>;

    constructor() {
        super(
            USSTree.persistenceSchema,
            new ZoweUSSNode(
                localize("Favorites", "Favorites"),
                vscode.TreeItemCollapsibleState.Collapsed,
                null,
                null,
                null
            )
        );
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession as IZoweUSSTreeNode];
        this.treeView = vscode.window.createTreeView("zowe.uss.explorer", { treeDataProvider: this });
    }

    /**
     * Method for renaming a USS Node. This could be a Favorite Node
     *
     * @param originalNode
     * @param {string} filePath
     */
    public async rename(originalNode: IZoweUSSTreeNode) {
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
                    vscode.window.showErrorMessage(
                        localize(
                            "renameUSS.unsavedWork",
                            "Unable to rename {0} because you have unsaved changes in this {1}. Please save your work before renaming the {1}.",
                            originalNode.fullPath,
                            nodeType
                        ),
                        { modal: true }
                    );
                    return;
                }
            }
        }
        const loadedNodes = await this.getAllLoadedItems();
        const options: vscode.InputBoxOptions = {
            prompt: localize("renameUSS.enterName", "Enter a new name for the {0}", nodeType),
            value: originalNode.label.replace(/^\[.+\]:\s/, ""),
            ignoreFocusOut: true,
            validateInput: (value) => this.checkDuplicateLabel(parentPath + value, loadedNodes),
        };
        const newName = await vscode.window.showInputBox(options);
        if (newName && parentPath + newName !== originalNode.fullPath) {
            try {
                const newNamePath = path.posix.join(parentPath, newName);
                const oldNamePath = originalNode.fullPath;

                // // Handle rename in back-end:
                await ZoweExplorerApiRegister.getUssApi(originalNode.getProfile()).rename(oldNamePath, newNamePath);

                // Handle rename in UI:
                if (oldFavorite) {
                    if (originalNodeInFavorites) {
                        this.renameUSSNode(originalNode, newNamePath); // Rename corresponding node in Sessions
                    }
                    // Below handles if originalNode is in a session node or is only indirectly in Favorites (e.g. is only a child of a favorite).
                    // Also handles if there are multiple appearances of originalNode in Favorites.
                    // This has to happen before renaming originalNode.rename, as originalNode's label is used to find the favorite equivalent.
                    this.renameFavorite(originalNode, newNamePath); // Doesn't do anything if there aren't any appearances of originalNode in Favs
                }
                // Rename originalNode in UI
                const hasClosedTab = await originalNode.rename(newNamePath);
                await originalNode.reopen(hasClosedTab);
                this.updateFavorites();
            } catch (err) {
                errorHandling(
                    err,
                    originalNode.mProfileName,
                    localize("renameUSS.error", "Unable to rename node: ") + err.message
                );
                throw err;
            }
        }
    }

    public checkDuplicateLabel(newFullPath: string, nodesToCheck: IZoweUSSTreeNode[]) {
        for (const node of nodesToCheck) {
            const nodeType = contextually.isFolder(node) ? "folder" : "file";
            if (newFullPath === node.fullPath.trim()) {
                return localize(
                    "renameUSS.duplicateName",
                    "A {0} already exists with this name. Please choose a different name.",
                    nodeType
                );
            }
        }
        return null;
    }

    public open(node: IZoweUSSTreeNode, preview: boolean) {
        throw new Error("Method not implemented.");
    }
    public copy(node: IZoweUSSTreeNode) {
        throw new Error("Method not implemented.");
    }
    public paste(node: IZoweUSSTreeNode) {
        throw new Error("Method not implemented.");
    }
    public delete(node: IZoweUSSTreeNode) {
        throw new Error("Method not implemented.");
    }
    public saveFile(document: vscode.TextDocument) {
        throw new Error("Method not implemented.");
    }
    public refreshPS(node: IZoweUSSTreeNode) {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(node: IZoweUSSTreeNode) {
        throw new Error("Method not implemented.");
    }

    /**
     * Finds the equivalent node as a favorite.
     * Used to ensure functions like delete, rename are synced between non-favorite nodes and their favorite equivalents.
     * This will also find the node if it is a child of a favorite and has been loaded.
     *
     * @param node
     */
    public findFavoritedNode(node: IZoweUSSTreeNode) {
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
        let matchingNode: IZoweUSSTreeNode;
        const profileName = node.getProfileName();
        const sessionNode = this.mSessionNodes.find((session) => session.getProfileName() === profileName.trim());
        if (sessionNode) {
            matchingNode = this.findMatchInLoadedChildren(sessionNode, node.fullPath);
        }
        return matchingNode;
    }

    /**
     * This function is for renaming the non-favorited equivalent of a favorited node for a given profile.
     * @param profileLabel
     * @param oldNamePath
     * @param newNamePath
     */
    public async renameUSSNode(node: IZoweUSSTreeNode, newNamePath: string) {
        const matchingNode: IZoweUSSTreeNode = this.findNonFavoritedNode(node);
        if (matchingNode) {
            matchingNode.rename(newNamePath);
        }
    }

    /**
     * Renames a node from the favorites list
     *
     * @param node
     */
    public async renameFavorite(node: IZoweUSSTreeNode, newNamePath: string) {
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
        return this.treeView;
    }

    /**
     * Takes argument of type IZoweUSSTreeNode and retrieves all of the first level children
     *
     * @param {IZoweUSSTreeNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweUSSTreeNode[] | Promise<IZoweUSSTreeNode[]>}
     */
    public async getChildren(element?: IZoweUSSTreeNode | undefined): Promise<IZoweUSSTreeNode[]> {
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
     */
    public async addSession(sessionName?: string, profileType?: string) {
        const setting = PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
        // Loads profile associated with passed sessionName, persisted profiles or default if none passed
        if (sessionName) {
            const profile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);

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
            const allProfiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const theProfile of allProfiles) {
                // If session is already added, do nothing
                if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === theProfile.name)) {
                    continue;
                }
                for (const session of this.mHistory.getSessions()) {
                    if (session === theProfile.name) {
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
            if (this.mSessionNodes.length === 1) {
                this.addSingleSession(Profiles.getInstance().getDefaultProfile(profileType));
            }
        }
        this.refresh();
    }

    /**
     * Removes a session from the list in the uss files tree
     *
     * @param {IZoweUSSTreeNode} [node]
     */
    public deleteSession(node: IZoweUSSTreeNode) {
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.trim() !== node.label.trim());
        this.mHistory.removeSession(node.label);
        this.refresh();
    }

    /**
     * Adds a node to the USS favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async addFavorite(node: IZoweUSSTreeNode) {
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
            temp = new ZoweUSSNode(
                label,
                vscode.TreeItemCollapsibleState.None,
                profileNodeInFavorites,
                node.getSession(),
                null,
                false,
                profileName
            );
            temp.fullPath = node.fullPath;
            this.saveSearch(temp);
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
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label === temp.label)) {
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
    public async saveSearch(node: IZoweUSSTreeNode) {
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
    public async removeFavorite(node: IZoweUSSTreeNode) {
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        profileNodeInFavorites.children = profileNodeInFavorites.children.filter(
            (temp) => !(temp.label === node.label && temp.contextValue.startsWith(node.contextValue))
        );
        // Remove profile node from Favorites if it contains no more favorites.
        if (profileNodeInFavorites.children.length < 1) {
            return this.removeFavProfile(profileName, false);
        }
        await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
        return;
    }

    public async updateFavorites() {
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry =
                    "[" +
                    profileNode.label.trim() +
                    "]: " +
                    fav.fullPath +
                    "{" +
                    contextually.getBaseContext(fav) +
                    "}";
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
    public async removeFavProfile(profileName: string, userSelected: boolean) {
        // If user selected the "Remove profile from Favorites option", confirm they are okay with deleting all favorited items for that profile.
        if (userSelected) {
            const checkConfirmation = localize(
                "removeFavProfile.confirm",
                "This will remove all favorited USS items for profile {0}. Continue?",
                profileName
            );
            const continueRemove = localize("removeFavProfile.continue", "Continue");
            const cancelRemove = localize("removeFavProfile.cancel", "Cancel");
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: checkConfirmation,
                ignoreFocusOut: true,
                canPickMany: false,
            };
            // If user did not select "Continue", do nothing.
            if (
                (await vscode.window.showQuickPick([continueRemove, cancelRemove], quickPickOptions)) !== continueRemove
            ) {
                return;
            }
        }

        // Remove favorited profile from UI
        this.mFavorites.forEach((favProfileNode) => {
            const favProfileLabel = favProfileNode.label.trim();
            if (favProfileLabel === profileName) {
                this.mFavorites = this.mFavorites.filter((tempNode) => tempNode.label.trim() !== favProfileLabel);
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
    public async getAllLoadedItems() {
        if (this.log) {
            this.log.debug(
                localize(
                    "enterPattern.log.debug.prompt",
                    "Prompting the user to choose a member from the filtered list"
                )
            );
        }
        const loadedNodes: IZoweUSSTreeNode[] = [];
        const sessions = await this.getChildren();

        // Add all data sets loaded in the tree to an array
        for (const session of sessions) {
            if (!session.contextValue.includes(globals.FAVORITE_CONTEXT)) {
                const nodes = await session.getChildren();

                const checkForChildren = async (nodeToCheck: IZoweUSSTreeNode) => {
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
    public async filterPrompt(node: IZoweUSSTreeNode) {
        if (this.log) {
            this.log.debug(localize("filterPrompt.log.debug.promptUSSPath", "Prompting the user for a USS path"));
        }
        await this.checkCurrentProfile(node);
        if (
            Profiles.getInstance().validProfile === ValidProfileEnum.VALID ||
            Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED
        ) {
            let sessionNode = node.getSessionNode();
            let remotepath: string;
            if (contextually.isSessionNotFav(node)) {
                if (this.mHistory.getSearchHistory().length > 0) {
                    const createPick = new FilterDescriptor(USSTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory
                        .getSearchHistory()
                        .map((element) => new FilterItem(element));
                    if (globals.ISTHEIA) {
                        const options1: vscode.QuickPickOptions = {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter"),
                        };
                        // get user selection
                        const choice = await vscode.window.showQuickPick([createPick, ...items], options1);
                        if (!choice) {
                            vscode.window.showInformationMessage(
                                localize("enterPattern.pattern", "No selection made.")
                            );
                            return;
                        }
                        remotepath = choice === createPick ? "" : choice.label;
                    } else {
                        const quickpick = vscode.window.createQuickPick();
                        quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
                        quickpick.items = [createPick, ...items];
                        quickpick.ignoreFocusOut = true;
                        quickpick.show();
                        const choice = await resolveQuickPickHelper(quickpick);
                        quickpick.hide();
                        if (!choice) {
                            vscode.window.showInformationMessage(
                                localize("enterPattern.pattern", "No selection made.")
                            );
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
                    prompt: localize("filterPrompt.option.prompt.search", "Create a new filter"),
                    value: remotepath,
                };
                // get user input
                remotepath = await vscode.window.showInputBox(options);
                if (!remotepath || remotepath.length === 0) {
                    vscode.window.showInformationMessage(localize("filterPrompt.enterPath", "You must enter a path."));
                    return;
                }
            } else {
                // executing search from saved search in favorites
                remotepath = node.label.trim();
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
            // Sanitization: Replace multiple preceding forward slashes with just one forward slash
            const sanitizedPath = remotepath.replace(/\/\/+/, "/");
            sessionNode.tooltip = sessionNode.fullPath = sanitizedPath;
            sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            const icon = getIconByNode(sessionNode);
            if (icon) {
                sessionNode.iconPath = icon.path;
            }
            // update the treeview with the new path
            sessionNode.label = `${sessionNode.getProfileName()} [${sanitizedPath}]`;
            sessionNode.dirty = true;
            this.addSearchHistory(sanitizedPath);
        }
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param ussFileProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweUSSTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(
        ussFileProvider: IZoweUSSTreeNode[],
        profileName: string
    ): IZoweUSSTreeNode | undefined {
        return ussFileProvider.find((treeNode) => treeNode.label === profileName);
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {ZoweUSSNode}
     */
    public createProfileNodeForFavs(profileName: string): ZoweUSSNode {
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
    public async initializeFavorites(log: Logger) {
        this.log = log;
        this.log.debug(localize("initializeFavorites.log.debug", "Initializing profiles with USS favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            this.log.debug(localize("initializeFavorites.no.favorites", "No USS favorites found."));
            return;
        }
        lines.forEach(async (line) => {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const favLabel = line.substring(line.indexOf(":") + 1, line.indexOf("{")).trim();
            // The profile node used for grouping respective favorited items. (Undefined if not created yet.)
            let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
            if (profileNodeInFavorites === undefined) {
                // If favorite node for profile doesn't exist yet, create a new one for it
                profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
            }
            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNodeForProfile = await this.initializeFavChildNodeForProfile(
                favLabel,
                line,
                profileNodeInFavorites
            );
            profileNodeInFavorites.children.push(favChildNodeForProfile);
        });
    }

    /**
     * Creates an individual favorites node WITHOUT profiles or sessions, to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited file/folder's label
     * @param contextValue The favorited file/folder's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweUssTreeNode
     */
    public async initializeFavChildNodeForProfile(label: string, line: string, parentNode: IZoweUSSTreeNode) {
        const favoriteSearchPattern = /^\[.+\]\:\s.*\{ussSession\}$/;
        const directorySearchPattern = /^\[.+\]\:\s.*\{directory\}$/;
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
    public async loadProfilesForFavorites(log: Logger, parentNode: IZoweUSSTreeNode) {
        const profileName = parentNode.label;
        const updatedFavsForProfile: IZoweUSSTreeNode[] = [];
        let profile: IProfileLoaded;
        let session: Session;
        this.log = log;
        this.log.debug(
            localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for USS favorites", profileName)
        );
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            // If no profile/session yet, then add session and profile to parent profile node in this.mFavorites array:
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                // Set mProfileName for the getProfileName function, but after initialization of child fav nodes.
                // This way, it won't try to load profile in constructor for child fav nodes too early.
                parentNode.mProfileName = profileName;
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (
                    Profiles.getInstance().validProfile === ValidProfileEnum.VALID ||
                    Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED
                ) {
                    session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
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
                const errMessage: string =
                    localize(
                        "initializeUSSFavorites.error.profile1",
                        "Error: You have Zowe USS favorites that refer to a non-existent CLI profile named: "
                    ) +
                    profileName +
                    localize(
                        "intializeUSSFavorites.error.profile2",
                        ". To resolve this, you can create a profile with this name, "
                    ) +
                    localize(
                        "initializeUSSFavorites.error.profile3",
                        "or remove the favorites with this profile name from the Zowe-USS-Persistent setting, which can be found in your "
                    ) +
                    getAppName(globals.ISTHEIA) +
                    localize("initializeUSSFavorites.error.profile4", " user settings.");
                errorHandling(error, null, errMessage);
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

    public async addFileHistory(criteria: string) {
        this.mHistory.addFileHistory(criteria);
        this.refresh();
    }

    public getFileHistory(): string[] {
        return this.mHistory.getFileHistory();
    }

    public removeFileHistory(name: string) {
        this.mHistory.removeFileHistory(name);
    }

    /**
     * Opens a USS item & reveals it in the tree
     *
     */
    public async openItemFromPath(itemPath: string, sessionNode: IZoweUSSTreeNode) {
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
            vscode.window.showInformationMessage(
                localize("findUSSItem.unsuccessful", "File does not exist. It may have been deleted.")
            );
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
    private async addSingleSession(profile: IProfileLoaded) {
        if (profile) {
            // If baseProfile exists, combine that information first before adding the session to the tree
            // TODO: Move addSession to abstract/ZoweTreeProvider (similar to editSession)
            const baseProfile = Profiles.getInstance().getBaseProfile();
            if (baseProfile) {
                try {
                    const combinedProfile = await Profiles.getInstance().getCombinedProfile(profile, baseProfile);
                    profile = combinedProfile;
                } catch (error) {
                    throw error;
                }
            }
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a session with the USS API
            const session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new ZoweUSSNode(
                profile.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                null,
                session,
                "",
                false,
                profile.name
            );
            node.contextValue = globals.USS_SESSION_CONTEXT;
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
