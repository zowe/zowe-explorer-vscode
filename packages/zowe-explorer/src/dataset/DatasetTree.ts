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
import * as nls from "vscode-nls";

import * as globals from "../globals";
import * as dsActions from "./actions";
import {
    DataSetAllocTemplate,
    Gui,
    ValidProfileEnum,
    IZoweTree,
    IZoweDatasetTreeNode,
    PersistenceSchemaEnum,
    NodeInteraction,
    IZoweTreeNode,
    DatasetFilter,
    DatasetSortOpts,
    SortDirection,
    NodeSort,
    DatasetFilterOpts,
} from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { FilterDescriptor, FilterItem, errorHandling, syncSessionNode } from "../utils/ProfilesUtils";
import { sortTreeItems, getAppName, getDocumentFilePath, SORT_DIRS } from "../shared/utils";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { getIconById, getIconByNode, IconId, IIconItem } from "../generators/icons";
import * as dayjs from "dayjs";
import * as fs from "fs";
import * as contextually from "../shared/context";
import { resetValidationSettings } from "../shared/actions";
import { closeOpenedTextFile } from "../utils/workspace";
import { IDataSet, IListOptions, imperative } from "@zowe/cli";
import { DATASET_FILTER_OPTS, DATASET_SORT_OPTS, validateDataSetName, validateMemberName } from "./utils";
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
 * Creates the Dataset tree that contains nodes of sessions and data sets
 *
 * @export
 */
export async function createDatasetTree(log: imperative.Logger): Promise<DatasetTree> {
    const tree = new DatasetTree();
    tree.initializeFavorites(log);
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
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.Dataset;
    private static readonly defaultDialogText: string = localize(
        "defaultFilterPrompt.option.prompt.search",
        "$(plus) Create a new filter. For example: HLQ.*, HLQ.aaa.bbb, HLQ.ccc.ddd(member)"
    );
    public mFavoriteSession: ZoweDatasetNode;

    public mSessionNodes: IZoweDatasetTreeNode[] = [];
    public mFavorites: IZoweDatasetTreeNode[] = [];
    public lastOpened: NodeInteraction = {};
    // public memberPattern: IZoweDatasetTreeNode[] = [];
    private treeView: vscode.TreeView<IZoweDatasetTreeNode>;

    public constructor() {
        super(
            DatasetTree.persistenceSchema,
            new ZoweDatasetNode(localize("Favorites", "Favorites"), vscode.TreeItemCollapsibleState.Collapsed, null, null, null)
        );
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession];
        this.treeView = Gui.createTreeView("zowe.ds.explorer", {
            treeDataProvider: this,
            canSelectMany: true,
        });
    }

    /**
     * Rename data set
     *
     * @export
     * @param node - The node
     */
    public async rename(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.rename called.");
        await Profiles.getInstance().checkCurrentProfile(node.getProfile());
        if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || !contextually.isValidationEnabled(node)) {
            return contextually.isDsMember(node) ? this.renameDataSetMember(node) : this.renameDataSet(node);
        }
    }

    public open(_node: IZoweDatasetTreeNode, _preview: boolean): void {
        throw new Error("Method not implemented.");
    }
    public copy(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public paste(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public delete(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public saveSearch(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public saveFile(_document: vscode.TextDocument): void {
        throw new Error("Method not implemented.");
    }
    public refreshPS(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(_node: IZoweDatasetTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public filterPrompt(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.filterPrompt called.");
        return this.datasetFilterPrompt(node);
    }

    /**
     * Takes argument of type IZoweDatasetTreeNode and retrieves all of the first level children
     *
     * @param [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweDatasetTreeNode[] | Promise<IZoweDatasetTreeNode[]>}
     */
    public async getChildren(element?: IZoweDatasetTreeNode | undefined): Promise<IZoweDatasetTreeNode[]> {
        ZoweLogger.trace("DatasetTree.getChildren called.");
        if (element) {
            if (contextually.isFavoriteContext(element)) {
                return this.mFavorites;
            }
            if (element.contextValue && element.contextValue === globals.FAV_PROFILE_CONTEXT) {
                const favsForProfile = this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            const finalResponse: IZoweDatasetTreeNode[] = [];
            let response;
            try {
                response = await element.getChildren();
            } catch (error) {
                await errorHandling(error, String(element.label));
            }
            if (!response) {
                return;
            }
            for (const item of response) {
                if (item.pattern && item.memberPattern) {
                    finalResponse.push(item);
                }
                if (!item.memberPattern && !item.pattern) {
                    if (item.contextValue.includes(globals.DS_MEMBER_CONTEXT) && element.memberPattern) {
                        item.contextValue += globals.FILTER_SEARCH;
                    }
                    finalResponse.push(item);
                }
                item.contextValue = contextually.withProfile(item);
            }
            if (finalResponse.length === 0) {
                return (element.children = [
                    new ZoweDatasetNode(
                        localize("getChildren.noDataset", "No data sets found"),
                        vscode.TreeItemCollapsibleState.None,
                        element,
                        null,
                        globals.INFORMATION_CONTEXT
                    ),
                ]);
            }
            return finalResponse;
        }
        return this.mSessionNodes;
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param datasetProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweDatasetTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(datasetProvider: IZoweDatasetTreeNode[], profileName: string): IZoweDatasetTreeNode | undefined {
        ZoweLogger.trace("DatasetTree.findMatchingProfileInArray called.");
        return datasetProvider.find((treeNode) => treeNode.label === profileName);
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {ZoweDatasetNode}
     */
    public createProfileNodeForFavs(profileName: string): ZoweDatasetNode {
        ZoweLogger.trace("DatasetTree.createProfileNodeForFavs called.");
        const favProfileNode = new ZoweDatasetNode(
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
    public initializeFavorites(log: imperative.Logger): void {
        ZoweLogger.trace("DatasetTree.initializeFavorites called.");
        this.log = log;
        ZoweLogger.debug(localize("initializeFavorites.log.debug", "Initializing profiles with data set favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            ZoweLogger.debug(localize("initializeFavorites.no.favorites", "No data set favorites found."));
            return;
        }
        // Line validation

        const favoriteDataSetPattern = /^\[.+\]:\s[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7}(\.[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7})*\{p?ds\}$/;
        const favoriteSearchPattern = /^\[.+\]:\s.*\{session}$/;
        for (const line of lines) {
            if (!(favoriteDataSetPattern.test(line) || favoriteSearchPattern.test(line))) {
                ZoweLogger.warn(
                    localize("initializeFavorites.invalidDsFavorite1", "Invalid Data Sets favorite: {0}.", line) +
                        localize(
                            "initializeFavorites.invalidDsFavorite2",
                            " Please check formatting of the zowe.ds.history 'favorites' settings in the {0} user settings.",
                            getAppName(globals.ISTHEIA)
                        )
                );
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
            const favChildNodeForProfile = this.initializeFavChildNodeForProfile(favLabel, favContextValue, profileNodeInFavorites);
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
    public initializeFavChildNodeForProfile(label: string, contextValue: string, parentNode: IZoweDatasetTreeNode): ZoweDatasetNode {
        ZoweLogger.trace("DatasetTree.initializeFavChildNodeForProfile called.");
        const profileName = parentNode.label as string;
        let node: ZoweDatasetNode;
        if (contextValue === globals.DS_PDS_CONTEXT || contextValue === globals.DS_DS_CONTEXT) {
            if (contextValue === globals.DS_PDS_CONTEXT) {
                node = new ZoweDatasetNode(label, vscode.TreeItemCollapsibleState.Collapsed, parentNode, undefined, undefined, undefined);
            } else {
                node = new ZoweDatasetNode(label, vscode.TreeItemCollapsibleState.None, parentNode, undefined, contextValue, undefined);
                node.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [node] };
            }
            node.contextValue = contextually.asFavorite(node);
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
        } else if (contextValue === globals.DS_SESSION_CONTEXT) {
            node = new ZoweDatasetNode(label, vscode.TreeItemCollapsibleState.None, parentNode, undefined, undefined, undefined);
            node.command = { command: "zowe.ds.pattern", title: "", arguments: [node] };
            node.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
        } else {
            // This case should not happen if the regex for initializeFavorites is defined correctly, but is here as a catch-all just in case.
            Gui.errorMessage(
                localize("initializeFavChildNodeForProfile.error", "Error creating data set favorite node: {0} for profile {1}.", label, profileName)
            );
        }
        if (node) {
            node.contextValue = contextually.withProfile(node);
        }
        return node;
    }

    /**
     * Loads profile for the profile node in Favorites that was clicked on, as well as for its children favorites.
     * @param log
     */
    public async loadProfilesForFavorites(log: imperative.Logger, parentNode: IZoweDatasetTreeNode): Promise<IZoweDatasetTreeNode[]> {
        ZoweLogger.trace("DatasetTree.loadProfilesForFavorites called.");
        const profileName = parentNode.label as string;
        const updatedFavsForProfile: IZoweDatasetTreeNode[] = [];
        let profile: imperative.IProfileLoaded;
        let session: imperative.Session;
        this.log = log;
        ZoweLogger.debug(localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for data set favorites", profileName));
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            // If no profile/session yet, then add session and profile to parent profile node in this.mFavorites array:
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || !contextually.isValidationEnabled(parentNode)) {
                    session = await ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                    parentNode.setProfileToChoice(profile);
                    parentNode.setSessionToChoice(session);
                } else {
                    return [
                        new ZoweDatasetNode(
                            localize("loadProfilesForFavorites.authFailed", "You must authenticate to view favorites."),
                            vscode.TreeItemCollapsibleState.None,
                            parentNode,
                            null,
                            globals.INFORMATION_CONTEXT
                        ),
                    ];
                }
            } catch (error) {
                const errMessage: string =
                    localize(
                        "loadProfilesForFavorites.error.profile1",
                        "Error: You have Zowe Data Set favorites that refer to a non-existent CLI profile named: {0}",
                        profileName
                    ) +
                    localize("loadProfilesForFavorites.error.profile2", ". To resolve this, you can remove {0}", profileName) +
                    localize(
                        "loadProfilesForFavorites.error.profile3",
                        " from the Favorites section of Zowe Explorer's Data Sets view. Would you like to do this now? ",
                        getAppName(globals.ISTHEIA)
                    );
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                ZoweLogger.error(errMessage + error.toString());
                const btnLabelRemove = localize("loadProfilesForFavorites.error.buttonRemove", "Remove");
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

    /**
     * Returns the tree view for the current DatasetTree
     *
     * @returns {vscode.TreeView<IZoweDatasetTreeNode>}
     */
    public getTreeView(): vscode.TreeView<IZoweDatasetTreeNode> {
        ZoweLogger.trace("DatasetTree.getTreeView called.");
        return this.treeView;
    }

    /**
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     * @param {string} [profileType] - optional; loads profiles of a certain type if passed
     */
    public async addSession(sessionName?: string, profileType?: string): Promise<void> {
        ZoweLogger.trace("DatasetTree.addSession called.");
        const setting: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION);
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const profile: imperative.IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (profile) {
                await this.addSingleSession(profile);
                for (const node of this.mSessionNodes) {
                    if (node.label !== "Favorites") {
                        const name = node.getProfileName();
                        if (name === profile.name) {
                            resetValidationSettings(node, setting);
                        }
                    }
                }
            }
        } else {
            const profiles: imperative.IProfileLoaded[] = await Profiles.getInstance().fetchAllProfiles();
            if (profiles) {
                for (const theProfile of profiles) {
                    // If session is already added, do nothing
                    if (this.mSessionNodes.find((tempNode) => tempNode.label.toString() === theProfile.name)) {
                        continue;
                    }
                    for (const session of this.mHistory.getSessions()) {
                        if (session === theProfile.name) {
                            await this.addSingleSession(theProfile);
                            for (const node of this.mSessionNodes) {
                                if (node.label !== "Favorites") {
                                    const name = node.getProfileName();
                                    if (name === theProfile.name) {
                                        resetValidationSettings(node, setting);
                                    }
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
     * Removes a session from the list in the data set tree
     *
     * @param node
     */
    public deleteSession(node: IZoweDatasetTreeNode): void {
        ZoweLogger.trace("DatasetTree.deleteSession called.");
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.toString() !== node.label.toString());
        this.mHistory.removeSession(node.label as string);
        this.refresh();
    }

    /**
     * Adds a node to the favorites list
     *
     * @param  node
     */
    public async addFavorite(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.addFavorite called.");
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
                Gui.showMessage(localize("addFavorite", "PDS already in favorites"));
                return;
            }
            await this.addFavorite(node.getParent());
            return;
        } else if (contextually.isDsSession(node)) {
            temp = new ZoweDatasetNode(
                node.pattern,
                vscode.TreeItemCollapsibleState.None,
                profileNodeInFavorites,
                node.getSession(),
                node.contextValue,
                node.getEtag(),
                node.getProfile()
            );

            await this.checkCurrentProfile(node);

            temp.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
            // add a command to execute the search
            temp.command = { command: "zowe.ds.pattern", title: "", arguments: [temp] };
        } else {
            // pds | ds
            temp = new ZoweDatasetNode(
                node.label as string,
                node.collapsibleState,
                profileNodeInFavorites,
                node.getSession(),
                node.contextValue,
                node.getEtag(),
                node.getProfile()
            );
            temp.contextValue = contextually.asFavorite(temp);
            if (contextually.isFavoriteDs(temp)) {
                temp.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [temp] };
            }

            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
        }
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label === temp.label && tempNode.contextValue === temp.contextValue)) {
            profileNodeInFavorites.children.push(temp);
            sortTreeItems(profileNodeInFavorites.children, globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            sortTreeItems(this.mFavorites, globals.FAV_PROFILE_CONTEXT);
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

    public renameNode(profileLabel: string, beforeLabel: string, afterLabel: string): void {
        ZoweLogger.trace("DatasetTree.renameNode called.");
        const sessionNode = this.mSessionNodes.find((session) => session.label.toString() === profileLabel.trim());
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
    public renameFavorite(node: IZoweDatasetTreeNode, newLabel: string): void {
        ZoweLogger.trace("DatasetTree.renameFavorite called.");
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
    public findFavoritedNode(node: IZoweDatasetTreeNode): IZoweTreeNode {
        ZoweLogger.trace("DatasetTree.findFavoriteNode called.");
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        return profileNodeInFavorites?.children.find(
            (temp) => temp.label === node.getLabel().toString() && temp.contextValue.includes(node.contextValue)
        );
    }

    /**
     * Finds the equivalent node not as a favorite.
     * Used to ensure functions like delete, rename are synced between favorite nodes and their non-favorite equivalents.
     *
     * @param node
     */
    public findNonFavoritedNode(node: IZoweDatasetTreeNode): IZoweTreeNode {
        ZoweLogger.trace("DatasetTree.findNonFavoritedNode called.");
        const profileName = node.getProfileName();
        const sessionNode = this.mSessionNodes.find((session) => session.label.toString().trim() === profileName);
        return sessionNode?.children.find((temp) => temp.label === node.label);
    }

    /**
     * Finds the equivalent node depending on whether the passed node is a favorite.
     * @param node
     */
    public findEquivalentNode(node: IZoweDatasetTreeNode, isFavorite: boolean): IZoweTreeNode {
        ZoweLogger.trace("DatasetTree.findEquivalentNode called.");
        return isFavorite ? this.findNonFavoritedNode(node) : this.findFavoritedNode(node);
    }

    /**
     * Removes a node from the favorites list
     *
     * @param node
     */
    public async removeFavorite(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.removeFavorite called.");
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);

        if (profileNodeInFavorites === undefined) {
            return;
        }

        profileNodeInFavorites.children = profileNodeInFavorites.children.filter(
            (temp) => !(temp.label === node.label && temp.contextValue.startsWith(node.contextValue))
        );
        // Remove profile node from Favorites if it contains no more favorites.
        if (profileNodeInFavorites.children.length < 1) {
            return this.removeFavProfile(profileName, false);
        }
        this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }

    /**
     * Writes favorites to the settings file.
     */
    public updateFavorites(): void {
        ZoweLogger.trace("DatasetTree.updateFavorites called.");
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((favorite) => {
                const favoriteEntry =
                    "[" + profileNode.label.toString() + "]: " + favorite.label.toString() + "{" + contextually.getBaseContext(favorite) + "}";
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
        ZoweLogger.trace("DatasetTree.removeFavProfile called.");
        // If user selected the "Remove profile from Favorites option", confirm they are okay with deleting all favorited items for that profile.
        let cancelled = false;
        if (userSelected) {
            const checkConfirmation = localize(
                "removeFavProfile.confirm",
                "This will remove all favorited Data Sets items for profile {0}. Continue?",
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
                this.mFavorites = this.mFavorites.filter((tempNode) => tempNode.label.toString() !== favProfileLabel);
                favProfileNode.dirty = true;
                this.refresh();
            }
        });

        // Update the favorites in settings file
        await this.updateFavorites();
    }

    public async onDidChangeConfiguration(e): Promise<void> {
        ZoweLogger.trace("DatasetTree.onDidChangeConfiguration called.");
        // Empties the persistent favorites & history arrays, if the user has set persistence to False
        if (e.affectsConfiguration(DatasetTree.persistenceSchema)) {
            const setting: any = {
                ...SettingsConfig.getDirectValue(DatasetTree.persistenceSchema),
            };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await SettingsConfig.setDirectValue(DatasetTree.persistenceSchema, setting);
            }
        }
    }

    public addSearchHistory(criteria: string): void {
        ZoweLogger.trace("DatasetTree.addSearchHistory called.");
        this.mHistory.addSearchHistory(criteria);
        this.refresh();
    }

    public getSearchHistory(): string[] {
        ZoweLogger.trace("DatasetTree.getSearchHistory called.");
        return this.mHistory.getSearchHistory();
    }

    public addFileHistory(criteria: string): void {
        ZoweLogger.trace("DatasetTree.addFileHistory called.");
        this.mHistory.addFileHistory(criteria);
        this.refresh();
    }

    public getFileHistory(): string[] {
        ZoweLogger.trace("DatasetTree.getFileHistory called.");
        return this.mHistory.getFileHistory();
    }

    public removeFileHistory(name: string): Thenable<void> {
        ZoweLogger.trace("DatasetTree.removeFileHistory called.");
        return this.mHistory.removeFileHistory(name);
    }

    public addDsTemplate(criteria: DataSetAllocTemplate): void {
        this.mHistory.addDsTemplateHistory(criteria);
        this.refresh();
    }

    public getDsTemplates(): DataSetAllocTemplate[] {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.mHistory.getDsTemplates();
    }

    public createFilterString(newFilter: string, node: IZoweDatasetTreeNode): string {
        ZoweLogger.trace("DatasetTree.createFilterString called.");
        // Store previous filters (before refreshing)
        let theFilter = this.getSearchHistory()[0] || null;

        // Check if filter is currently applied
        if (node.pattern != null && node.pattern !== "" && theFilter) {
            const currentFilters = node.pattern.split(",");

            // Check if current filter includes the new node
            const matchedFilters = currentFilters.filter((filter) => {
                const regex = new RegExp(filter.trim().replace(/\*/g, "") + "$");
                return regex.test(newFilter);
            });

            if (matchedFilters.length === 0) {
                // remove the last segment with a dot of the name for the new filter
                theFilter = `${node.pattern},${newFilter}`;
            } else {
                theFilter = node.pattern;
            }
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
    public async openItemFromPath(itemPath: string, sessionNode: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.openItemFromPath called.");
        let parentNode: IZoweDatasetTreeNode = null;
        let memberNode: IZoweDatasetTreeNode;
        let parentName = "";
        let memberName = "";

        // Get node names from path
        if (itemPath.indexOf("(") > -1) {
            parentName = itemPath.substring(itemPath.indexOf(" ") + 1, itemPath.indexOf("(")).trim();
            memberName = itemPath.substring(itemPath.indexOf("(") + 1, itemPath.indexOf(")"));
        } else {
            parentName = itemPath.substring(itemPath.indexOf(" ") + 1);
        }

        // Update tree filter to include selected node, and expand session node in tree
        sessionNode.tooltip = sessionNode.pattern = this.createFilterString(parentName, sessionNode);
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        sessionNode.dirty = true;
        await this.refresh();
        let children = await sessionNode.getChildren();

        // Find parent node in tree
        parentNode = children.find((child) => child.label.toString() === parentName);
        if (parentNode) {
            parentNode.label = parentNode.tooltip = parentNode.pattern = parentName;
            parentNode.dirty = true;
        } else {
            Gui.showMessage(localize("findParentNode.unsuccessful", "Node does not exist. It may have been deleted."));
            this.removeFileHistory(itemPath);
            return;
        }

        // If parent node has a child, expand parent node, and find child in tree
        if (itemPath.indexOf("(") > -1) {
            parentNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            children = await parentNode.getChildren();
            memberNode = children.find((child) => child.label.toString() === memberName);
            if (!memberNode) {
                Gui.showMessage(localize("findParentNode.unsuccessful", "Node does not exist. It may have been deleted."));
                this.removeFileHistory(itemPath);
                return;
            } else {
                memberNode.getParent().collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                this.addSearchHistory(`${parentName}(${memberName})`);
                await dsActions.openPS(memberNode, true, this);
            }
        } else {
            this.addSearchHistory(parentName);
            await dsActions.openPS(parentNode, true, this);
        }
    }

    public async getAllLoadedItems(): Promise<IZoweDatasetTreeNode[]> {
        ZoweLogger.trace("DatasetTree.getAllLoadedItems called.");
        ZoweLogger.debug(localize("enterPattern.log.debug.prompt", "Prompting the user to choose a member from the filtered list"));
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

    public async datasetFilterPrompt(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.datasetFilterPrompt called.");
        ZoweLogger.debug(localize("enterPattern.log.debug.prompt", "Prompting the user for a data set pattern"));
        let pattern: string;
        await this.checkCurrentProfile(node);
        let nonFaveNode;

        if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
            if (contextually.isSessionNotFav(node)) {
                nonFaveNode = node;
                if (this.mHistory.getSearchHistory().length > 0) {
                    const createPick = new FilterDescriptor(DatasetTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory.getSearchHistory().map((element) => new FilterItem({ text: element }));
                    if (globals.ISTHEIA) {
                        const options1: vscode.QuickPickOptions = {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter"),
                        };
                        // get user selection
                        const choice = await Gui.showQuickPick([createPick, globals.SEPARATORS.RECENT_FILTERS, ...items], options1);
                        if (!choice) {
                            Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
                            return;
                        }
                        pattern = choice === createPick ? "" : choice.label;
                    } else {
                        const quickpick = Gui.createQuickPick();
                        quickpick.items = [createPick, globals.SEPARATORS.RECENT_FILTERS, ...items];
                        quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
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
                                pattern = quickpick.value;
                            }
                        } else {
                            pattern = choice.label;
                        }
                    }
                }
                const options2: vscode.InputBoxOptions = {
                    prompt: localize("enterPattern.options.prompt", "Search Data Sets: use a comma to separate multiple patterns"),
                    value: pattern,
                };
                // get user input
                pattern = await Gui.showInputBox(options2);
                if (!pattern) {
                    Gui.showMessage(localize("datasetFilterPrompt.enterPattern", "You must enter a pattern."));
                    return;
                }
            } else {
                // executing search from saved search in favorites
                pattern = node.getLabel() as string;
                const sessionName = node.getProfileName();
                await this.addSession(sessionName);
                nonFaveNode = this.mSessionNodes.find((tempNode) => tempNode.label.toString() === sessionName);
                if (!nonFaveNode.getSession().ISession.user || !nonFaveNode.getSession().ISession.password) {
                    nonFaveNode.getSession().ISession.user = node.getSession().ISession.user;
                    nonFaveNode.getSession().ISession.password = node.getSession().ISession.password;
                    nonFaveNode.getSession().ISession.base64EncodedAuth = node.getSession().ISession.base64EncodedAuth;
                }
            }
            // looking for members in pattern
            node.children = [];
            node.dirty = true;
            syncSessionNode(Profiles.getInstance())((profileValue) => ZoweExplorerApiRegister.getMvsApi(profileValue).getSession())(nonFaveNode);
            let dataSet: IDataSet;
            const dsSets: (IDataSet & { memberPattern?: string })[] = [];
            const dsNames = pattern.split(",");

            for (const ds of dsNames) {
                const match = /(.*)\((.*)\)/.exec(ds);
                if (match) {
                    const [, dataSetName, memberName] = match;
                    dataSet = {
                        dsn: dataSetName,
                        member: memberName,
                    };
                } else {
                    dataSet = {
                        dsn: ds.replace(/\s/g, ""),
                    };
                }
                dsSets.push(dataSet);
            }

            let datasets: string;
            for (const item of dsSets) {
                const newItem = item;
                if (newItem.dsn) {
                    if (datasets) {
                        datasets += `, ${item.dsn}`;
                    } else {
                        datasets = `${item.dsn}`;
                    }
                }
            }
            if (datasets) {
                nonFaveNode.tooltip = nonFaveNode.pattern = datasets.toUpperCase();
            } else {
                nonFaveNode.tooltip = nonFaveNode.pattern = pattern.toUpperCase();
            }
            let response;
            try {
                response = await this.getChildren(nonFaveNode);
            } catch (err) {
                await errorHandling(err, String(node.label));
            }
            if (!response) {
                nonFaveNode.tooltip = nonFaveNode.pattern = undefined;
                return;
            }
            // reset and remove previous search patterns for each child of getChildren
            for (const child of response) {
                let resetIcon: IIconItem;
                if (child.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    resetIcon = getIconById(IconId.folder);
                }
                if (child.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
                    resetIcon = getIconById(IconId.folderOpen);
                }
                if (resetIcon) {
                    child.iconPath = resetIcon.path;
                }

                // remove any previous search memberPatterns
                if (child.contextValue.includes(globals.FILTER_SEARCH)) {
                    child.contextValue = child.contextValue.replace(globals.FILTER_SEARCH, "");
                    child.memberPattern = "";
                    child.pattern = "";
                    this.refreshElement(child);
                }
                child.contextValue = contextually.withProfile(child);
            }
            // set new search patterns for each child of getChildren
            for (const child of response) {
                for (const item of dsSets) {
                    const label = child.label as string;
                    if (item.member && label !== "No data sets found") {
                        const dsn = item.dsn.split(".");
                        const name = label.split(".");
                        let index = 0;
                        let includes = false;
                        if (!child.pattern) {
                            for (const each of dsn) {
                                let inc = false;
                                inc = this.checkFilterPattern(name[index], each);
                                if (inc) {
                                    child.pattern = item.dsn;
                                    includes = true;
                                } else {
                                    child.pattern = "";
                                    includes = false;
                                }
                                index++;
                            }
                        }
                        if (includes && child.contextValue.includes("pds")) {
                            const childProfile = child.getProfile();
                            const options: IListOptions = {};
                            options.pattern = item.memberPattern;
                            options.attributes = true;
                            options.responseTimeout = childProfile.profile?.responseTimeout;
                            const memResponse = await ZoweExplorerApiRegister.getMvsApi(childProfile).allMembers(label, options);
                            let existing = false;
                            for (const mem of memResponse.apiResponse.items) {
                                existing = this.checkFilterPattern(mem.member, item.member);
                                if (existing) {
                                    child.memberPattern = item.member;
                                    if (!child.contextValue.includes(globals.FILTER_SEARCH)) {
                                        child.contextValue = String(child.contextValue) + globals.FILTER_SEARCH;
                                    }
                                    let setIcon: IIconItem;
                                    if (child.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                                        setIcon = getIconById(IconId.filterFolder);
                                    }
                                    if (child.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
                                        setIcon = getIconById(IconId.filterFolderOpen);
                                    }
                                    if (setIcon) {
                                        child.iconPath = setIcon.path;
                                    }
                                    this.refreshElement(child);
                                }
                            }
                        }
                    }
                }
                nonFaveNode.dirty = true;
                const icon = getIconByNode(nonFaveNode);
                if (icon) {
                    nonFaveNode.iconPath = icon.path;
                }
                child.contextValue = contextually.withProfile(child);
            }
            this.addSearchHistory(pattern);
        }
        await TreeViewUtils.expandNode(nonFaveNode, this);
    }

    public checkFilterPattern(dsName: string, itemName: string): boolean {
        ZoweLogger.trace("DatasetTree.checkFilterPattern called.");
        let existing: boolean;
        if (!/(\*?)(\w+)(\*)(\w+)(\*?)/.test(itemName)) {
            if (/^[^*](\w+)[^*]$/.test(itemName)) {
                if (dsName) {
                    const compare = dsName.localeCompare(itemName.toUpperCase());
                    if (compare === 0) {
                        existing = true;
                    }
                }
            }
            if (/^(\*)$/.test(itemName)) {
                existing = true;
            }
            if (itemName.startsWith("*") && itemName.endsWith("*")) {
                existing = dsName.includes(itemName.toUpperCase().replace(/\*/g, ""));
            }
            if (!itemName.startsWith("*") && itemName.endsWith("*")) {
                existing = dsName.startsWith(itemName.toUpperCase().replace(/\*/g, ""));
            }
            if (itemName.startsWith("*") && !itemName.endsWith("*")) {
                existing = dsName.endsWith(itemName.toUpperCase().replace(/\*/g, ""));
            }
        } else {
            let value: string;
            let split: string[];
            let isExist: boolean;
            if (/(^\w+)(\*)(\w+)(\*)/.test(itemName)) {
                value = itemName.slice(0, itemName.length - 1);
                split = value.split("*");
                isExist = dsName.startsWith(split[0].toUpperCase());
                if (isExist) {
                    existing = dsName.includes(split[1].toUpperCase());
                }
            }
            if (/(^\*)(\w+)(\*)(\w+)$/.test(itemName)) {
                value = itemName.slice(1, itemName.length);
                split = value.split("*");
                isExist = dsName.endsWith(split[1].toUpperCase());
                if (isExist) {
                    existing = dsName.includes(split[0].toUpperCase());
                }
            }
            if (/(^\*)(\w+)(\*)(\w+)(\*)$/.test(itemName)) {
                value = itemName.slice(1, itemName.length);
                value = value.slice(0, itemName.lastIndexOf("*") - 1);
                split = value.split("*");
                for (const i of split) {
                    isExist = dsName.includes(i.toUpperCase());
                }
                if (isExist) {
                    existing = true;
                }
            }
        }
        return existing;
    }

    /**
     * Rename data set member
     *
     * @param node - The node
     */
    private async renameDataSetMember(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.renameDataSetMember called.");
        const beforeMemberName = node.label as string;
        const dataSetName = node.getParent().getLabel() as string;
        const options: vscode.InputBoxOptions = {
            value: beforeMemberName,
            validateInput: (text) => {
                return validateMemberName(text) === true ? null : localize("member.validation", "Enter valid member name");
            },
        };
        let afterMemberName = await Gui.showInputBox(options);
        if (!afterMemberName) {
            Gui.showMessage(localize("renameDataSet.cancelled", "Rename operation cancelled."));
            return;
        }
        afterMemberName = afterMemberName.toUpperCase();
        const beforeFullPath = getDocumentFilePath(`${dataSetName}(${node.getLabel().toString()})`, node);
        const closedOpenedInstance = await closeOpenedTextFile(beforeFullPath);

        ZoweLogger.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterMemberName);
        if (afterMemberName && afterMemberName !== beforeMemberName) {
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).renameDataSetMember(dataSetName, beforeMemberName, afterMemberName);
                node.label = afterMemberName;
                node.tooltip = afterMemberName;
            } catch (err) {
                if (err instanceof Error) {
                    await errorHandling(err, dataSetName, localize("renameDataSet.error", "Unable to rename data set:"));
                }
                throw err;
            }
            const otherParent = this.findEquivalentNode(node.getParent(), contextually.isFavorite(node.getParent()));
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
                vscode.commands.executeCommand("zowe.ds.ZoweNode.openPS", node);
            }
        }
    }

    /**
     * Rename data set
     *
     * @param node - The node
     */
    private async renameDataSet(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("DatasetTree.renameDataSet called.");
        const beforeDataSetName = node.label as string;
        const options: vscode.InputBoxOptions = {
            value: beforeDataSetName,
            validateInput: (text) => {
                return validateDataSetName(text) === true ? null : localize("dataset.validation", "Enter a valid data set name.");
            },
        };
        let afterDataSetName = await Gui.showInputBox(options);
        if (!afterDataSetName) {
            Gui.showMessage(localize("renameDataSet.cancelled", "Rename operation cancelled."));
            return;
        }
        afterDataSetName = afterDataSetName.toUpperCase();
        const beforeFullPath = getDocumentFilePath(node.getLabel() as string, node);
        const closedOpenedInstance = await closeOpenedTextFile(beforeFullPath);

        ZoweLogger.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterDataSetName);
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
                    vscode.commands.executeCommand("zowe.ds.ZoweNode.openPS", node);
                }
            } catch (err) {
                if (err instanceof Error) {
                    await errorHandling(err, node.label.toString(), localize("renameDataSet.error", "Unable to rename data set:"));
                }
                throw err;
            }
        }
    }

    /**
     * Adds a single session to the data set tree
     *
     */
    private async addSingleSession(profile: imperative.IProfileLoaded): Promise<void> {
        ZoweLogger.trace("DatasetTree.addSingleSession called.");
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tNode) => tNode.label.toString() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a session with the MVS API
            let session: imperative.Session;
            try {
                session = await ZoweExplorerApiRegister.getMvsApi(profile).getSession();
            } catch (err) {
                if (err.toString().includes("hostname")) {
                    ZoweLogger.error(err);
                } else {
                    await errorHandling(err, profile.name);
                }
            }
            // Creates ZoweDatasetNode to track new session and pushes it to mSessionNodes
            const node = new ZoweDatasetNode(profile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profile);
            node.contextValue = globals.DS_SESSION_CONTEXT + (profile.type !== "zosmf" ? `.profile=${profile.type}.` : "");
            await this.refreshHomeProfileContext(node);
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            this.mSessionNodes.push(node);
            this.mHistory.addSession(profile.name);
        }
    }

    /**
     * Sorts some (or all) PDS children nodes using the given sorting method.
     * @param node The session whose PDS members should be sorted, or a PDS whose children should be sorted
     * @param sortOpts The sorting options to use
     * @param isSession whether the node is a session
     */
    public updateSortForNode(node: IZoweDatasetTreeNode, sortOpts: NodeSort, isSession: boolean): void {
        node.sort = sortOpts;

        if (isSession) {
            // if a session was selected, apply this sort to ALL PDS members
            if (node.children?.length > 0) {
                // children nodes already exist, sort and repaint to avoid extra refresh
                for (const c of node.children) {
                    if (contextually.isPds(c) && c.children) {
                        c.sort = node.sort;
                        c.children.sort(ZoweDatasetNode.sortBy(node.sort));
                        this.nodeDataChanged(c);
                    }
                }
            }
        } else if (node.children?.length > 0) {
            // children nodes already exist, sort and repaint to avoid extra refresh
            node.children.sort(ZoweDatasetNode.sortBy(node.sort));
            this.nodeDataChanged(node);
        }
    }

    /**
     * Presents a dialog to the user with options and methods for sorting PDS members.
     * @param node The node that was interacted with (via icon or right-click -> "Sort PDS members...")
     */
    public async sortPdsMembersDialog(node: IZoweDatasetTreeNode): Promise<void> {
        const isSession = contextually.isSession(node);

        // Assume defaults if a user hasn't selected any sort options yet
        const sortOpts = node.sort ?? {
            method: DatasetSortOpts.Name,
            direction: SortDirection.Ascending,
        };

        // Adapt menus to user based on the node that was interacted with
        const specifier = isSession
            ? localize("ds.allPdsSort", "all PDS members in {0}", node.label as string)
            : localize("ds.singlePdsSort", "the PDS members in {0}", node.label as string);
        const selection = await Gui.showQuickPick(
            DATASET_SORT_OPTS.map((opt, i) => ({
                label: sortOpts.method === i ? `${opt} $(check)` : opt,
                description: i === DATASET_SORT_OPTS.length - 1 ? SORT_DIRS[sortOpts.direction] : null,
            })),
            {
                placeHolder: localize("ds.selectSortOpt", "Select a sorting option for {0}", specifier),
            }
        );
        if (selection == null) {
            return;
        }

        if (selection.label === localize("setSortDirection", "$(fold) Sort Direction")) {
            // Update sort direction (if a new one was provided)
            const dir = await Gui.showQuickPick(SORT_DIRS, {
                placeHolder: localize("sort.selectDirection", "Select a sorting direction"),
            });
            if (dir != null) {
                node.sort = {
                    ...sortOpts,
                    direction: SORT_DIRS.indexOf(dir),
                };
            }
            await this.sortPdsMembersDialog(node);
            return;
        }

        const selectionText = selection.label.replace(" $(check)", "");
        const sortMethod = DATASET_SORT_OPTS.indexOf(selectionText);
        if (sortMethod === -1) {
            return;
        }

        // Update sort for node based on selections
        this.updateSortForNode(node, { ...sortOpts, method: sortMethod }, isSession);
        Gui.setStatusBarMessage(localize("sort.updated", "$(check) Sorting updated for {0}", node.label as string), globals.MS_PER_SEC * 4);
    }

    /**
     * Updates or resets the filter for a given data set node.
     * @param node The node whose filter should be updated/reset
     * @param newFilter Either a valid `DatasetFilter` object, or `null` to reset the filter
     * @param isSession Whether the node is a session
     */
    public updateFilterForNode(node: IZoweDatasetTreeNode, newFilter: DatasetFilter | null, isSession: boolean): void {
        const oldFilter = node.filter;
        node.filter = newFilter;

        // if a session was selected, apply this sort to all PDS members
        if (isSession) {
            if (node.children?.length > 0) {
                // children nodes already exist, sort and repaint to avoid extra refresh
                for (const c of node.children) {
                    const asDs = c as IZoweDatasetTreeNode;

                    // PDS-level filters should have precedence over a session-level filter
                    if (asDs.filter != null) {
                        continue;
                    }

                    if (contextually.isPds(c)) {
                        // If there was an old session-wide filter set: refresh to get any
                        // missing nodes - new filter will be applied
                        if (oldFilter != null) {
                            this.refreshElement(c);
                            continue;
                        }

                        if (newFilter != null && c.children?.length > 0) {
                            c.children = c.children.filter(ZoweDatasetNode.filterBy(newFilter));
                            this.nodeDataChanged(c);
                        } else {
                            this.refreshElement(c);
                        }
                    }
                }
            }
            return;
        }

        // Updating filter for PDS node
        // if a filter was already set for either session or PDS, just refresh to grab any missing nodes
        const sessionFilterPresent = (node.getSessionNode() as IZoweDatasetTreeNode).filter;
        if (oldFilter != null || sessionFilterPresent != null) {
            this.refreshElement(node);
            return;
        }

        // since there wasn't a previous filter, sort and repaint existing nodes
        if (newFilter != null && node.children?.length > 0) {
            node.children = node.children.filter(ZoweDatasetNode.filterBy(newFilter));
            this.nodeDataChanged(node);
        }
    }

    /**
     * Presents a dialog to the user with options and methods for sorting PDS members.
     * @param node The data set node that was interacted with (via icon or right-click => "Filter PDS members...")
     */
    public async filterPdsMembersDialog(node: IZoweDatasetTreeNode): Promise<void> {
        const isSession = contextually.isSession(node);

        // Adapt menus to user based on the node that was interacted with
        const specifier = isSession
            ? localize("ds.allPdsSort", "all PDS members in {0}", node.label as string)
            : localize("ds.singlePdsSort", "the PDS members in {0}", node.label as string);
        const clearFilter = isSession
            ? localize("ds.clearProfileFilter", "$(clear-all) Clear filter for profile")
            : localize("ds.clearPdsFilter", "$(clear-all) Clear filter for PDS");
        const selection = (
            await Gui.showQuickPick(
                [...DATASET_FILTER_OPTS.map((sortOpt, i) => (node.filter?.method === i ? `${sortOpt} $(check)` : sortOpt)), clearFilter],
                {
                    placeHolder: localize("ds.selectFilterOpt", "Set a filter for {0}", specifier),
                }
            )
        )?.replace(" $(check)", "");

        const filterMethod = DATASET_FILTER_OPTS.indexOf(selection);

        const userDismissed = filterMethod < 0;
        if (userDismissed || selection === clearFilter) {
            if (selection === clearFilter) {
                this.updateFilterForNode(node, null, isSession);
                Gui.setStatusBarMessage(localize("filter.cleared", "$(check) Filter cleared for {0}", node.label as string), globals.MS_PER_SEC * 4);
            }
            return;
        }

        const dateValidation = (value): string => {
            return dayjs(value).isValid() ? null : localize("ds.filterEntry.invalidDate", "Invalid date format specified");
        };

        const filter = await Gui.showInputBox({
            title: localize("ds.filterEntry.title", "Enter a value to filter by"),
            placeHolder: "",
            validateInput:
                filterMethod === DatasetFilterOpts.LastModified
                    ? dateValidation
                    : (val): string => (val.length > 0 ? null : localize("ds.filterEntry.invalid", "Invalid filter specified")),
        });

        // User dismissed filter entry, go back to filter selection
        if (filter == null) {
            await this.filterPdsMembersDialog(node);
            return;
        }

        // Update filter for node based on selection & filter entry
        this.updateFilterForNode(
            node,
            {
                method: filterMethod,
                value: filter,
            },
            isSession
        );
        Gui.setStatusBarMessage(localize("filter.updated", "$(check) Filter updated for {0}", node.label as string), globals.MS_PER_SEC * 4);
    }
}
