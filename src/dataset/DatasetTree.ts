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
import { IProfileLoaded, Logger, IProfile, ISession } from "@zowe/imperative";
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
import { ZoweTreeNode } from "../abstract/ZoweTreeNode";

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
    await tree.initialize(log);
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
        if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID) {
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
            await Profiles.getInstance().checkCurrentProfile(element.getProfile());
            return element.getChildren();
        }
        return this.mSessionNodes;
    }


    /**
     * Initializes the tree based on favorites held in persistent store
     *
     * @param log
     */
    public async initialize(log: Logger) {
        this.log = log;
        this.log.debug(localize("initializeFavorites.log.debug", "initializing favorites"));
        const lines: string[] = this.mHistory.readFavorites();
        for (const line of lines) {
            if (line === "") {
                continue;
            }
            // validate line
            const favoriteDataSetPattern = /^\[.+\]\:\s[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7}(\.[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7})*\{p?ds\}$/;
            const favoriteSearchPattern = /^\[.+\]\:\s.*\{session}$/;
            if (favoriteDataSetPattern.test(line)) {
                const sesName = line.substring(1, line.lastIndexOf("]")).trim();
                try {
                    const profile = Profiles.getInstance().loadNamedProfile(sesName);
                    const session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                    let node: ZoweDatasetNode;
                    if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === globals.DS_PDS_CONTEXT) {
                        node = new ZoweDatasetNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed,
                            this.mFavoriteSession, session, undefined, undefined, profile);
                    } else {
                        node = new ZoweDatasetNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.None,
                            this.mFavoriteSession, session, undefined, undefined, profile);
                        node.command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [node] };
                    }
                    node.contextValue = contextually.asFavorite(node);
                    const icon = getIconByNode(node);
                    if (icon) {
                        node.iconPath = icon.path;
                    }
                    this.mFavorites.push(node);
                } catch (e) {
                    const errMessage: string =
                        localize("initializeFavorites.error.profile1",
                            "Error: You have Zowe Data Set favorites that refer to a non-existent CLI profile named: ") + sesName +
                        localize("intializeFavorites.error.profile2",
                            ". To resolve this, you can create a profile with this name, ") +
                        localize("initializeFavorites.error.profile3",
                            "or remove the favorites with this profile name from the Zowe-DS-Persistent setting, which can be found in your ") +
                        getAppName(globals.ISTHEIA) + localize("initializeFavorites.error.profile4", " user settings.");
                    await errorHandling(e, null, errMessage);
                    continue;
                }
            } else if (favoriteSearchPattern.test(line)) {
                const sesName = line.substring(1, line.lastIndexOf("]")).trim();
                let profile: IProfileLoaded;
                try {
                    profile = Profiles.getInstance().loadNamedProfile(sesName);
                } catch (error) {
                    const errMessage: string =
                        localize("loadNamedProfile.error.profileName",
                            "Initialization Error: Could not find profile named: ") +
                        +sesName +
                        localize("loadNamedProfile.error.period", ".");
                    await errorHandling(error, null, errMessage);
                    continue;
                }
                const session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                const node = new ZoweDatasetNode(line.substring(0, line.lastIndexOf("{")),
                    vscode.TreeItemCollapsibleState.None, this.mFavoriteSession, session, undefined, undefined, profile);
                node.command = { command: "zowe.pattern", title: "", arguments: [node] };
                node.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
                const icon = getIconByNode(node);
                if (icon) {
                    node.iconPath = icon.path;
                }
                this.mFavorites.push(node);
            } else {
                vscode.window.showErrorMessage(localize("initializeFavorites.fileCorrupted", "Favorites file corrupted: ") + line);
            }
        }
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
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const zosmfProfile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (zosmfProfile) {
                this.addSingleSession(zosmfProfile);
            }
        } else {
            const profiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const zosmfProfile of profiles) {
                // If session is already added, do nothing
                if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === zosmfProfile.name)) {
                    continue;
                }
                for (const session of this.mHistory.getSessions()) {
                    if (session === zosmfProfile.name) {
                        this.addSingleSession(zosmfProfile);
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
        let revisedLabel = node.label;
        if (revisedLabel.includes("[")) {
            revisedLabel = revisedLabel.substring(0, revisedLabel.indexOf(" ["));
        }
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }

    /**
     * Adds a node to the favorites list
     *
     * @param  node
     */
    public async addFavorite(node: IZoweDatasetTreeNode) {
        let temp: ZoweDatasetNode;
        if (contextually.isDsMember(node)) {
            if (contextually.isFavoritePds(node.getParent())) {
                vscode.window.showInformationMessage(localize("addFavorite", "PDS already in favorites"));
                return;
            }
            this.addFavorite(node.getParent());
            return;
        } else if (contextually.isDsSession(node)) {
            temp = new ZoweDatasetNode("[" + node.getSessionNode().label.trim() + "]: " + node.pattern, vscode.TreeItemCollapsibleState.None,
                this.mFavoriteSession, node.getSession(), node.contextValue, node.getEtag(), node.getProfile());

            await this.checkCurrentProfile(node);

            temp.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
            // add a command to execute the search
            temp.command = { command: "zowe.pattern", title: "", arguments: [temp] };
        } else {    // pds | ds
            temp = new ZoweDatasetNode("[" + node.getSessionNode().label.trim() + "]: " + node.label, node.collapsibleState,
                this.mFavoriteSession, node.getSession(), node.contextValue, node.getEtag(), node.getProfile());
            temp.contextValue = contextually.asFavorite(temp);
            if (contextually.isFavoriteDs(temp)) {
                temp.command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [temp] };
            }

            const icon = getIconByNode(temp);
            if (icon) {
                temp.iconPath = icon.path;
            }
        }
        if (!this.mFavorites.find((tempNode) =>
            (tempNode.label === temp.label) && (tempNode.contextValue === temp.contextValue)
        )) {
            this.mFavorites.push(temp);
            sortTreeItems(this.mFavorites, globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Renames a node based on the profile and it's label
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
        const matchingNode = this.mFavorites.find(
            (temp) => (temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue))
        );
        if (matchingNode) {
            const prefix = matchingNode.label.substring(0, matchingNode.label.indexOf(":") + 2);
            matchingNode.label = prefix + newLabel;
            matchingNode.tooltip = prefix + newLabel;
            this.refreshElement(matchingNode);
        }
    }

    /**
     * Finds the equivalent node as a favorite
     *
     * @param node
     */
    public findFavoritedNode(node: IZoweDatasetTreeNode) {
        return this.mFavorites.find(
            (temp) => (temp.label === `[${node.getParent().getLabel()}]: ${node.label}`) && (temp.contextValue.includes(node.contextValue))
        );
    }

    /**
     * Finds the equivalent node not as a favorite
     *
     * @param node
     */
    public findNonFavoritedNode(node: IZoweDatasetTreeNode) {
        const profileLabel = node.label.substring(1, node.label.indexOf("]"));
        const nodeLabel = node.label.substring(node.label.indexOf(":") + 2);
        const sessionNode = this.mSessionNodes.find((session) => session.label.trim() === profileLabel);
        return sessionNode.children.find((temp) => temp.label === nodeLabel);
    }

    /**
     * Removes a node from the favorites list
     *
     * @param node
     */
    public async removeFavorite(node: IZoweDatasetTreeNode) {
        this.mFavorites = this.mFavorites.filter((temp) =>
            !((temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue)))
        );
        this.refresh();
        await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }

    public async updateFavorites() {
        const settings = this.mFavorites.map((fav) =>
            fav.label + "{" + contextually.getBaseContext(fav) + "}"
        );
        this.mHistory.updateFavorites(settings);
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

        if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID) {
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
                pattern = node.label.trim().substring(node.getLabel().indexOf(":") + 2);
                const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
                await this.addSession(session);
                const faveNode = node;
                node = this.mSessionNodes.find((tempNode) => tempNode.label.trim() === session);
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
        let dataSetName;
        let profileLabel;

        if (contextually.isFavorite(node.getParent())) {
            profileLabel = node.getParent().getLabel().substring(0, node.getParent().getLabel().indexOf(":") + 2);
            dataSetName = node.getParent().getLabel().substring(node.getParent().getLabel().indexOf(":") + 2);
        } else {
            dataSetName = node.getParent().getLabel();
        }
        let afterMemberName = await (vscode.window.showInputBox({ value: beforeMemberName }));
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
            } catch (err) {
                this.log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
                await errorHandling(err, profileLabel, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
                throw err;
            }
            let otherParent;
            if (contextually.isFavorite(node)) {
                otherParent = this.findNonFavoritedNode(node.getParent());
            } else {
                otherParent = this.findFavoritedNode(node.getParent());
            }
            if (otherParent) {
                const otherMember = otherParent.children.find((child) => child.label === beforeMemberName);
                if (otherMember) {
                    otherMember.label = afterMemberName;
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
        let beforeDataSetName = node.label.trim();
        let favPrefix = "";
        let isFavourite;

        if (contextually.isFavorite(node)) {
            isFavourite = true;
            favPrefix = node.label.substring(0, node.label.indexOf(":") + 2);
            beforeDataSetName = node.label.substring(node.label.indexOf(":") + 2);
        }
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
                node.label = `${favPrefix}${afterDataSetName}`;
                node.tooltip = `${favPrefix}${afterDataSetName}`;

                if (isFavourite) {
                    const profile = favPrefix.substring(1, favPrefix.indexOf("]"));
                    this.renameNode(profile, beforeDataSetName, afterDataSetName);
                } else {
                    const temp = node.label;
                    node.label = "[" + node.getSessionNode().label.trim() + "]: " + beforeDataSetName;
                    this.renameFavorite(node, afterDataSetName);
                    node.label = temp;
                }
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
                await errorHandling(err, favPrefix, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
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
