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
import * as dsActions from "./actions";
import { IProfileLoaded, Logger, Session } from "@zowe/imperative";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { FilterDescriptor, FilterItem, resolveQuickPickHelper, errorHandling } from "../utils";
import { sortTreeItems, getAppName, getDocumentFilePath } from "../shared/utils";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweDatasetTreeNode } from "../api/IZoweTreeNode";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { getIconByNode } from "../generators/icons";
import * as fs from "fs";
import * as contextually from "../shared/context";
import { closeOpenedTextFile } from "../utils/workspace";
import * as nls from "vscode-nls";
import { resetValidationSettings } from "../shared/actions";
import { PersistentFilters } from "../PersistentFilters";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Creates the Dataset tree that contains nodes of sessions and data sets
 *
 * @export
 */
export async function createDatasetTree(log: Logger) {
    const tree = new DatasetTree();
    await tree.initializeFavorites(log);
    await tree.addSession();
    return tree;
}

/**
 * A tree that contains nodes of sessions and data sets
 *
 * @export
 * @class DatasetTree
 * @implements {vscode.TreeDataProvider}
 */
export class DatasetTree extends ZoweTreeProvider implements IZoweTree<IZoweDatasetTreeNode> {
    private static readonly persistenceSchema: globals.PersistenceSchemaEnum = globals.PersistenceSchemaEnum.Dataset;
    private static readonly defaultDialogText: string = "\uFF0B " + localize("defaultFilterPrompt.option.prompt.search",
        "Create a new filter. Comma separate multiple entries (pattern 1, pattern 2, ...)");
    public mFavoriteSession: ZoweDatasetNode;

    public mSessionNodes: IZoweDatasetTreeNode[] = [];
    public mFavorites: IZoweDatasetTreeNode[] = [];
    private treeView: vscode.TreeView<IZoweDatasetTreeNode>;

    constructor() {
        super(DatasetTree.persistenceSchema, new ZoweDatasetNode(localize("Favorites", "Favorites"),
            vscode.TreeItemCollapsibleState.Collapsed, null, null, null));
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession];
        this.treeView = vscode.window.createTreeView("zowe.explorer", { treeDataProvider: this });
    }

    /**
     * Rename data set
     *
     * @export
     * @param node - The node
     */
    public async rename(node: IZoweDatasetTreeNode) {
        await Profiles.getInstance().checkCurrentProfile(node.getProfile());
        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            return contextually.isDsMember(node) ? this.renameDataSetMember(node) : this.renameDataSet(node);
        }
    }

    public open(node: IZoweDatasetTreeNode, preview: boolean) {
        throw new Error("Method not implemented.");
    }
    public copy(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public paste(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public delete(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public saveSearch(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public saveFile(document: vscode.TextDocument) {
        throw new Error("Method not implemented.");
    }
    public refreshPS(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(node: IZoweDatasetTreeNode) {
        throw new Error("Method not implemented.");
    }
    public filterPrompt(node: IZoweDatasetTreeNode) {
        return this.datasetFilterPrompt(node);
    }

    /**
     * Takes argument of type IZoweDatasetTreeNode and retrieves all of the first level children
     *
     * @param [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweDatasetTreeNode[] | Promise<IZoweDatasetTreeNode[]>}
     */
    public async getChildren(element?: IZoweDatasetTreeNode | undefined): Promise<IZoweDatasetTreeNode[]> {
        if (element) {
            if (contextually.isFavoriteContext(element)) {
                return this.mFavorites;
            }
            if (element.contextValue && element.contextValue === globals.FAV_PROFILE_CONTEXT){
                const favsForProfile = this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            await Profiles.getInstance().checkCurrentProfile(element.getProfile());
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param datasetProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweDatasetTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(datasetProvider: IZoweDatasetTreeNode[], profileName: string): IZoweDatasetTreeNode|undefined {
        return datasetProvider.find((treeNode) => treeNode.label === profileName );
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {ZoweDatasetNode}
     */
    public createProfileNodeForFavs(profileName: string): ZoweDatasetNode {
        const favProfileNode = new ZoweDatasetNode(profileName, vscode.TreeItemCollapsibleState.Collapsed,
            this.mFavoriteSession, null, undefined, undefined);
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
        this.log.debug(localize("initializeFavorites.log.debug", "Initializing profiles with data set favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            this.log.debug(localize("initializeFavorites.no.favorites", "No data set favorites found."));
            return;
        }
        // Line validation
        const favoriteDataSetPattern = /^\[.+\]\:\s[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7}(\.[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7})*\{p?ds\}$/;
        const favoriteSearchPattern = /^\[.+\]\:\s.*\{session}$/;
        for (const line of lines) {
            if (!(favoriteDataSetPattern.test(line) || favoriteSearchPattern.test(line))){
                this.log.warn(localize("initializeFavorites.invalidDsFavorite1", "Invalid Data Sets favorite: {0}.", line) +
                localize("initializeFavorites.invalidDsFavorite2",
                " Please check formatting of the Zowe-DS-Persistent 'favorites' settings in the {0} user settings.", getAppName(globals.ISTHEIA)));
                continue;
            }
            // Parse line
            const profileName = line.substring(1, line.lastIndexOf("]")).trim();
            const favLabel = line.substring(line.indexOf(":") + 2, line.indexOf("{"));
            const favContextValue = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
            // The profile node used for grouping respective favorited items. (Undefined if not created yet.)
            let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
            if (profileNodeInFavorites === undefined) {
                // If favorite node for profile doesn't exist yet, create a new one for it
                profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
            }
            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNodeForProfile = await this.initializeFavChildNodeForProfile(favLabel, favContextValue, profileNodeInFavorites);
            profileNodeInFavorites.children.push(favChildNodeForProfile);
        }
    }

    /**
     * Creates an individual favorites node WITHOUT profiles or sessions, to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited data set's label
     * @param contextValue The favorited data set's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweDatasetTreeNode
     */
    public async initializeFavChildNodeForProfile(label: string, contextValue: string, parentNode: IZoweDatasetTreeNode){
        const profileName = parentNode.label;
        let node: ZoweDatasetNode;
        if (contextValue === globals.DS_PDS_CONTEXT || contextValue === globals.DS_DS_CONTEXT) {
            if (contextValue === globals.DS_PDS_CONTEXT) {
                node = new ZoweDatasetNode(label, vscode.TreeItemCollapsibleState.Collapsed,
                    parentNode, undefined, undefined, undefined);
            } else {
                node = new ZoweDatasetNode(label, vscode.TreeItemCollapsibleState.None,
                    parentNode, undefined, contextValue, undefined);
                node.command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [node]};
            }
            node.contextValue = contextually.asFavorite(node);
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
        } else if (contextValue === globals.DS_SESSION_CONTEXT) {
            node = new ZoweDatasetNode(label,
                vscode.TreeItemCollapsibleState.None, parentNode , undefined, undefined, undefined);
            node.command = {command: "zowe.pattern", title: "", arguments: [node]};
            node.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
        } else {
            // This case should not happen if the regex for initializeFavorites is defined correctly, but is here as a catch-all just in case.
            vscode.window.showErrorMessage(
                localize("initializeFavChildNodeForProfile.error",
                    "Error creating data set favorite node: {0} for profile {1}.", label, profileName)
            );
        }
        return node;
    }

    /**
     * Loads profile for the profile node in Favorites that was clicked on, as well as for its children favorites.
     * @param log
     */
    public async loadProfilesForFavorites(log: Logger, parentNode: IZoweDatasetTreeNode) {
        const profileName = parentNode.label;
        const updatedFavsForProfile: IZoweDatasetTreeNode[] = [];
        let profile: IProfileLoaded;
        let session: Session;
        this.log = log;
        this.log.debug(localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for data set favorites", profileName));
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            // If no profile/session yet, then add session and profile to parent profile node in this.mFavorites array:
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                parentNode.setProfileToChoice(profile);
                parentNode.setSessionToChoice(session);
            } catch (error) {
                const errMessage: string =
                    localize("loadProfilesForFavorites.error.profile1",
                        "Error: You have Zowe Data Set favorites that refer to a non-existent CLI profile named: {0}.", profileName) +
                    localize("loadProfilesForFavorites.error.profile2",
                        " To resolve this, you can create a profile with this name, ") +
                    localize("loadProfilesForFavorites.error.profile3",
                        "or remove the favorites with this profile name from the Zowe-DS-Persistent setting in your {0} user settings.",
                        getAppName(globals.ISTHEIA));
                await errorHandling(error, null, errMessage);
            }
        }
        profile = parentNode.getProfile();
        session = parentNode.getSession();
        // Pass loaded profile/session to the parent node's favorites children.
        const profileInFavs = this.findMatchingProfileInArray(this.mFavorites, profileName);
        const favsForProfile = profileInFavs.children;
        for (const favorite of favsForProfile ) {
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

    /**
     * Returns the tree view for the current DatasetTree
     *
     * @returns {vscode.TreeView<IZoweDatasetTreeNode>}
     */
    public getTreeView(): vscode.TreeView<IZoweDatasetTreeNode> {
        return this.treeView;
    }

    /**
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public async addSession(sessionName?: string, profileType?: string) {
        const setting = PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const profile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (profile) {
                this.addSingleSession(profile);
            }
            for (const node of this.mSessionNodes) {
                const name = node.getProfileName();
                if (name === profile.name){
                    await resetValidationSettings(node, setting);
                 }
             }
        } else {
            const profiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const theProfile of profiles) {
                // If session is already added, do nothing
                if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === theProfile.name)) {
                    continue;
                }
                for (const session of this.mHistory.getSessions()) {
                    if (session === theProfile.name) {
                        this.addSingleSession(theProfile);
                        for (const node of this.mSessionNodes) {
                            const name = node.getProfileName();
                            if (name === theProfile.name){
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
     * Removes a session from the list in the data set tree
     *
     * @param node
     */
    public deleteSession(node: IZoweDatasetTreeNode) {
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.trim() !== node.label.trim());
        this.mHistory.removeSession(node.label);
        this.refresh();
    }

    /**
     * Adds a node to the favorites list
     *
     * @param  node
     */
    public async addFavorite(node: IZoweDatasetTreeNode) {
        let temp: ZoweDatasetNode;
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites === undefined) {
            // If favorite node for profile doesn't exist yet, create a new one for it
            profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
        }
        if (contextually.isDsMember(node)) {
            if (contextually.isFavoritePds(node.getParent())) {
                // This only returns true for members whose PDS **node** is literally already in the Favorites section.
                vscode.window.showInformationMessage(localize("addFavorite", "PDS already in favorites"));
                return;
            }
            this.addFavorite(node.getParent());
            return;
        } else if (contextually.isDsSession(node)) {
            temp = new ZoweDatasetNode(node.pattern, vscode.TreeItemCollapsibleState.None,
                profileNodeInFavorites, node.getSession(), node.contextValue, node.getEtag(), node.getProfile());

            await this.checkCurrentProfile(node);

            temp.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
            // add a command to execute the search
            temp.command = { command: "zowe.pattern", title: "", arguments: [temp] };
        } else {    // pds | ds
            temp = new ZoweDatasetNode(node.label, node.collapsibleState,
                profileNodeInFavorites, node.getSession(), node.contextValue, node.getEtag(), node.getProfile());
            temp.contextValue = contextually.asFavorite(temp);
            if (contextually.isFavoriteDs(temp)) {
                temp.command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [temp] };
            }

            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
        }
        if (!profileNodeInFavorites.children.find((tempNode) =>
            (tempNode.label === temp.label) && (tempNode.contextValue === temp.contextValue)
        )) {
            profileNodeInFavorites.children.push(temp);
            sortTreeItems(profileNodeInFavorites.children, globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Renames a node based on the profile and its label
     *
     * @param profileLabel
     * @param beforeLabel
     * @param afterLabel
     */

    public async renameNode(profileLabel: string, beforeLabel: string, afterLabel: string) {
        const sessionNode = this.mSessionNodes.find((session) => session.label.trim() === profileLabel.trim());
        if (sessionNode) {
            const matchingNode = sessionNode.children.find((node) => node.label === beforeLabel);
            if (matchingNode) {
                matchingNode.label = afterLabel;
                matchingNode.tooltip = afterLabel;
                this.refreshElement(matchingNode);
            }
        }
    }

    /**
     * Renames a node from the favorites list
     *
     * @param node
     */
    public async renameFavorite(node: IZoweDatasetTreeNode, newLabel: string) {
        const matchingNode = this.findFavoritedNode(node);
        if (matchingNode) {
            matchingNode.label = newLabel;
            matchingNode.tooltip = newLabel;
            this.refreshElement(matchingNode);
        }
    }

    /**
     * Finds the equivalent node as a favorite.
     * Used to ensure functions like delete, rename are synced between non-favorite nodes and their favorite equivalents.
     *
     * @param node
     */
    public findFavoritedNode(node: IZoweDatasetTreeNode) {
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (!profileNodeInFavorites){
            return;
        }
        return profileNodeInFavorites.children.find(
            (temp) => (temp.label === node.getLabel()) && (temp.contextValue.includes(node.contextValue))
        );
    }

    /**
     * Finds the equivalent node not as a favorite.
     * Used to ensure functions like delete, rename are synced between favorite nodes and their non-favorite equivalents.
     *
     * @param node
     */
    public findNonFavoritedNode(node: IZoweDatasetTreeNode) {
        const profileName = node.getProfileName();
        const sessionNode = this.mSessionNodes.find((session) => session.label.trim() === profileName);
        return sessionNode.children.find((temp) => temp.label === node.label);
    }

    /**
     * Removes a node from the favorites list
     *
     * @param node
     */
    public async removeFavorite(node: IZoweDatasetTreeNode) {
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        profileNodeInFavorites.children = profileNodeInFavorites.children.filter((temp) =>
            !((temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue)))
        );
        this.refresh();
        await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }

    /**
     * Writes favorites to the settings file.
     */
    public async updateFavorites() {
        const favoritesArray = [];
        this.mFavorites.forEach( (profileNode) => {
            profileNode.children.forEach( (favorite) => {
                const favoriteEntry = "[" + profileNode.label.trim() + "]: " + favorite.label + "{" + contextually.getBaseContext(favorite) + "}";
                favoritesArray.push(favoriteEntry);
            });
        });
        this.mHistory.updateFavorites(favoritesArray);
    }

    public async onDidChangeConfiguration(e) {
        // Empties the persistent favorites & history arrays, if the user has set persistence to False
        if (e.affectsConfiguration(DatasetTree.persistenceSchema)) {
            const setting: any = { ...vscode.workspace.getConfiguration().get(DatasetTree.persistenceSchema) };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace.getConfiguration().update(DatasetTree.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public async addSearchHistory(criteria: string) {
        this.mHistory.addSearchHistory(criteria);
        this.refresh();
    }

    public getSearchHistory() {
        return this.mHistory.getSearchHistory();
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

    public async createFilterString(newFilter: string, node: IZoweDatasetTreeNode) {
        // Store previous filters (before refreshing)
        let theFilter = this.getSearchHistory()[0] || null;

        // Check if filter is currently applied
        if (node.pattern !== "" && theFilter) {
            const currentFilters = node.pattern.split(",");

            // Check if current filter includes the new node
            const matchedFilters = currentFilters.filter((filter) => {
                const regex = new RegExp(filter.trim().replace(`*`, "") + "$");
                return regex.test(newFilter);
            });

            if (matchedFilters.length === 0) {
                // remove the last segement with a dot of the name for the new filter
                theFilter = `${node.pattern},${newFilter}`;
            } else { theFilter = node.pattern; }
        } else {
            // No filter is currently applied
            theFilter = newFilter;
        }
        return theFilter;
    }

    /**
     * Opens a data set & reveals it in the tree
     *
     */
    public async openItemFromPath(itemPath: string, sessionNode: IZoweDatasetTreeNode) {
        let parentNode: IZoweDatasetTreeNode = null;
        let memberNode: IZoweDatasetTreeNode;
        let parentName = null;
        let memberName = null;

        // Get node names from path
        if (itemPath.indexOf("(") > -1) {
            parentName = itemPath.substring(itemPath.indexOf(" ") + 1, itemPath.indexOf("(")).trim();
            memberName = itemPath.substring(itemPath.indexOf("(") + 1, itemPath.indexOf(")"));
        } else {
            parentName = itemPath.substring(itemPath.indexOf(" ") + 1);
        }

        // Update tree filter to include selected node, and expand session node in tree
        sessionNode.tooltip = sessionNode.pattern = await this.createFilterString(parentName, sessionNode);
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        sessionNode.label = sessionNode.label.trim() + " ";
        sessionNode.label = sessionNode.label.trim();
        sessionNode.dirty = true;
        await this.refresh();
        let children = await sessionNode.getChildren();

        // Find parent node in tree
        parentNode = children.find((child) => child.label.trim() === parentName);
        if (parentNode) {
            parentNode.label = parentNode.tooltip = parentNode.pattern = parentName;
            parentNode.dirty = true;
        } else {
            vscode.window.showInformationMessage(localize("findParentNode.unsuccessful", "Node does not exist. It may have been deleted."));
            this.removeFileHistory(itemPath);
            return;
        }

        // If parent node has a child, expand parent node, and find child in tree
        if (itemPath.indexOf("(") > -1) {
            parentNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            children = await parentNode.getChildren();
            memberNode = children.find((child) => child.label.trim() === memberName);
            if (!memberNode) {
                vscode.window.showInformationMessage(localize("findParentNode.unsuccessful", "Node does not exist. It may have been deleted."));
                this.removeFileHistory(itemPath);
                return;
            } else {
                memberNode.getParent().label = memberNode.getParent().label.trim() + " ";
                memberNode.getParent().label = memberNode.getParent().label.trim();
                memberNode.getParent().collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                this.addSearchHistory(`${parentName}(${memberName})`);
                dsActions.openPS(memberNode, true, this);
            }
        } else {
            this.addSearchHistory(parentName);
            dsActions.openPS(parentNode, true, this);
        }
    }

    public async getAllLoadedItems() {
        this.log.debug(localize("enterPattern.log.debug.prompt", "Prompting the user to choose a member from the filtered list"));
        const loadedItems: IZoweDatasetTreeNode[] = [];
        const sessions = await this.getChildren();

        // Add all data sets loaded in the tree to an array
        for (const session of sessions) {
            if (!session.contextValue.includes(globals.FAVORITE_CONTEXT)) {
                if (session.children) {
                    for (const node of session.children) {
                        if (node.contextValue !== globals.INFORMATION_CONTEXT) {
                            loadedItems.push(node);
                            for (const member of node.children) {
                                if (member.contextValue !== globals.INFORMATION_CONTEXT) {
                                    loadedItems.push(member);
                                }
                            }
                        }
                    }
                }
            }
        }
        return loadedItems;
    }

    public async datasetFilterPrompt(node: IZoweDatasetTreeNode) {
        this.log.debug(localize("enterPattern.log.debug.prompt", "Prompting the user for a data set pattern"));
        let pattern: string;
        await this.checkCurrentProfile(node);

        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            if (contextually.isSessionNotFav(node)) {
                if (this.mHistory.getSearchHistory().length > 0) {
                    const createPick = new FilterDescriptor(DatasetTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory.getSearchHistory().map((element) => new FilterItem(element));
                    if (globals.ISTHEIA) {
                        const options1: vscode.QuickPickOptions = {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter")
                        };
                        // get user selection
                        const choice = (await vscode.window.showQuickPick([createPick, ...items], options1));
                        if (!choice) {
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                            return;
                        }
                        pattern = choice === createPick ? "" : choice.label;
                    } else {
                        const quickpick = vscode.window.createQuickPick();
                        quickpick.items = [createPick, ...items];
                        quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
                        quickpick.ignoreFocusOut = true;
                        quickpick.show();
                        const choice = await resolveQuickPickHelper(quickpick);
                        quickpick.hide();
                        if (!choice) {
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                            return;
                        }
                        if (choice instanceof FilterDescriptor) {
                            if (quickpick.value) { pattern = quickpick.value; }
                        } else { pattern = choice.label; }
                    }
                }
                const options2: vscode.InputBoxOptions = {
                    prompt: localize("enterPattern.options.prompt",
                        "Search data sets by entering patterns: use a comma to separate multiple patterns"),
                    value: pattern,
                };
                // get user input
                pattern = await vscode.window.showInputBox(options2);
                if (!pattern) {
                    vscode.window.showInformationMessage(localize("datasetFilterPrompt.enterPattern", "You must enter a pattern."));
                    return;
                }
            } else {
                // executing search from saved search in favorites
                pattern = node.getLabel();
                const sessionName = node.getProfileName();
                await this.addSession(sessionName);
                const faveNode = node;
                node = this.mSessionNodes.find((tempNode) => tempNode.label.trim() === sessionName);
                if ((!node.getSession().ISession.user) || (!node.getSession().ISession.password)) {
                    node.getSession().ISession.user = faveNode.getSession().ISession.user;
                    node.getSession().ISession.password = faveNode.getSession().ISession.password;
                    node.getSession().ISession.base64EncodedAuth = faveNode.getSession().ISession.base64EncodedAuth;
                }
            }
            // update the treeview with the new pattern
            node.label = node.label.trim() + " ";
            node.label.trim();
            node.tooltip = node.pattern = pattern.toUpperCase();
            node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            node.dirty = true;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            this.addSearchHistory(node.pattern);
        }
    }

    /**
     * Rename data set member
     *
     * @param node - The node
     */
    private async renameDataSetMember(node: IZoweDatasetTreeNode) {
        const beforeMemberName = node.label.trim();
        const dataSetName = node.getParent().getLabel();

        let afterMemberName = await vscode.window.showInputBox({ value: beforeMemberName });
        if (!afterMemberName) {
            vscode.window.showInformationMessage(localize("renameDataSet.cancelled", "Rename operation cancelled."));
            return;
        }
        afterMemberName = afterMemberName.toUpperCase();
        const beforeFullPath = getDocumentFilePath(`${node.getParent().getLabel()}(${node.getLabel()})`, node);
        const closedOpenedInstance = await closeOpenedTextFile(beforeFullPath);

        this.log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterMemberName);
        if (afterMemberName && afterMemberName !== beforeMemberName) {
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).renameDataSetMember(
                    dataSetName,
                    beforeMemberName,
                    afterMemberName);
                node.label = afterMemberName;
                node.tooltip = afterMemberName;
            } catch (err) {
                this.log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
                await errorHandling(err, dataSetName, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
                throw err;
            }
            let otherParent;
            if (contextually.isFavorite(node.getParent())) {
                otherParent = this.findNonFavoritedNode(node.getParent());
            } else {
                otherParent = this.findFavoritedNode(node.getParent());
            }
            if (otherParent) {
                const otherMember = otherParent.children.find((child) => child.label === beforeMemberName);
                if (otherMember) {
                    otherMember.label = afterMemberName;
                    otherMember.tooltip = afterMemberName;
                    this.refreshElement(otherMember);
                }
            }
            this.refreshElement(node);
            if (fs.existsSync(beforeFullPath)) {
                fs.unlinkSync(beforeFullPath);
            }
            if (closedOpenedInstance) {
                vscode.commands.executeCommand("zowe.ZoweNode.openPS", node);
            }
        }
    }

    /**
     * Rename data set
     *
     * @param node - The node
     */
    private async renameDataSet(node: IZoweDatasetTreeNode) {
        const beforeDataSetName = node.label.trim();

        let afterDataSetName = await vscode.window.showInputBox({ value: beforeDataSetName });
        if (!afterDataSetName) {
            vscode.window.showInformationMessage(localize("renameDataSet.cancelled", "Rename operation cancelled."));
            return;
        }
        afterDataSetName = afterDataSetName.toUpperCase();
        const beforeFullPath = getDocumentFilePath(node.getLabel(), node);
        const closedOpenedInstance = await closeOpenedTextFile(beforeFullPath);

        this.log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterDataSetName);
        if (afterDataSetName && afterDataSetName !== beforeDataSetName) {
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).renameDataSet(beforeDataSetName, afterDataSetName);
                // Rename corresponding node in Sessions or Favorites section (whichever one Rename wasn't called from)
                if (contextually.isFavorite(node)) {
                    const profileName = node.getProfileName();
                    this.renameNode(profileName, beforeDataSetName, afterDataSetName);
                } else {
                    this.renameFavorite(node, afterDataSetName);
                }
                // Rename the node that was clicked on
                node.label = afterDataSetName;
                node.tooltip = afterDataSetName;
                this.refreshElement(node);
                this.updateFavorites();

                if (fs.existsSync(beforeFullPath)) {
                    fs.unlinkSync(beforeFullPath);
                }

                if (closedOpenedInstance) {
                    vscode.commands.executeCommand("zowe.ZoweNode.openPS", node);
                }
            } catch (err) {
                this.log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
                await errorHandling(err, node.label, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
                throw err;
            }
        }
    }

    /**
     * Adds a single session to the data set tree
     *
     */
    private addSingleSession(profile: IProfileLoaded) {
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a session with the MVS API
            const session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
            // Creates ZoweDatasetNode to track new session and pushes it to mSessionNodes
            const node = new ZoweDatasetNode(
                profile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profile);
            node.contextValue = globals.DS_SESSION_CONTEXT;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            this.mSessionNodes.push(node);
            this.mHistory.addSession(profile.name);
        }
    }
}
