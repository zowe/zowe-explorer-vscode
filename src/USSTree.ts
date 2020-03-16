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

import { IProfileLoaded, Logger } from "@zowe/imperative";
import { FilterItem, FilterDescriptor, getAppName, resolveQuickPickHelper, sortTreeItems, errorHandling } from "./utils";
import * as ussNodeActions from "./uss/ussNodeActions";
import * as vscode from "vscode";
import { IZoweTree } from "./api/IZoweTree";
import { IZoweUSSTreeNode } from "./api/IZoweTreeNode";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { Profiles } from "./Profiles";
import * as extension from "../src/extension";
import * as nls from "vscode-nls";
import { ZoweTreeProvider } from "./abstract/ZoweTreeProvider";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { getIconByNode } from "./generators/icons";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Creates the USS tree that contains nodes of sessions and data sets
 *
 * @export
 */
export async function createUSSTree(log: Logger) {
    const tree = new USSTree();
    await tree.initialize(log);
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


    public static readonly defaultDialogText: string = "\uFF0B " + localize("filterPrompt.option.prompt.search", "Create a new filter");
    private static readonly persistenceSchema: string = "Zowe-USS-Persistent";
    public mFavoriteSession: ZoweUSSNode;
    public mSessionNodes: IZoweUSSTreeNode[] = [];
    public mFavorites: IZoweUSSTreeNode[] = [];
    private treeView: vscode.TreeView<IZoweUSSTreeNode>;

    constructor() {
        super(USSTree.persistenceSchema, new ZoweUSSNode(localize("Favorites", "Favorites"),
            vscode.TreeItemCollapsibleState.Collapsed, null, null, null));
        this.mFavoriteSession.contextValue = extension.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession as IZoweUSSTreeNode];
        this.treeView = vscode.window.createTreeView("zowe.uss.explorer", {treeDataProvider: this});
    }

    public async rename(originalNode: IZoweUSSTreeNode) {
        await ussNodeActions.renameUSSNode(originalNode, this, undefined);
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
            if (element.contextValue === extension.FAVORITE_CONTEXT) {
                return this.mFavorites;
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
    public async addSession(sessionName?: string) {
        // Loads profile associated with passed sessionName, persisted profiles or default if none passed
        if (sessionName) {
            const profile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (profile) {
                this.addSingleSession(profile);
            }
        } else {
            const allProfiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const profile of allProfiles) {
                // If session is already added, do nothing
                if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === profile.name)) {
                    continue;
                }
                for (const session of this.mHistory.getSessions()) {
                    if (session === profile.name) {
                        this.addSingleSession(profile);
                    }
                }
            }
            if (this.mSessionNodes.length === 1) {
                this.addSingleSession(Profiles.getInstance().getDefaultProfile());
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
        let revisedLabel =  node.label;
        if (revisedLabel.includes("[")) {
            revisedLabel = revisedLabel.substring(0, revisedLabel.indexOf(" ["));
        }
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }

    /**
     * Adds a node to the USS favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async addFavorite(node: IZoweUSSTreeNode) {
        let temp: ZoweUSSNode;
        temp = new ZoweUSSNode(node.fullPath,
            node.collapsibleState,
            this.mFavoriteSession,
            node.getSession(),
            node.getParent().fullPath,
            false,
            node.getSessionNode().getProfileName());
        temp.contextValue += extension.FAV_SUFFIX;
        if (temp.contextValue === extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX ||
            temp.contextValue === extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX) {
            temp.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [temp] };
        }
        const icon = getIconByNode(temp);
        if (icon) {
            temp.iconPath = icon.path;
        }
        if (!this.mFavorites.find((tempNode) => tempNode.label === temp.label)) {
            this.mFavorites.push(temp);
            sortTreeItems(this.mFavorites, extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX);
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
        const label = "[" + node.getSessionNode().getProfileName() + "]: " + node.fullPath;
        const temp = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.None,
            this.mFavoriteSession, node.getSession(), null, false, node.getSessionNode().getProfileName());

        temp.fullPath = node.fullPath;
        temp.label = temp.tooltip = label;
        temp.contextValue = extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX;
        const icon = getIconByNode(temp);
        if (icon) {
            temp.iconPath = icon.path;
        }
        temp.command = { command: "zowe.uss.fullPath", title: "", arguments: [temp] };
        if (!this.mFavorites.find((tempNode) => tempNode.label === temp.label)) {
            this.mFavorites.push(temp);
            sortTreeItems(this.mFavorites, extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {IZoweUSSTreeNode} node
     */
    public async removeFavorite(node: IZoweUSSTreeNode) {
        this.mFavorites = this.mFavorites.filter((temp) =>
            !((temp.fullPath === node.fullPath) && (temp.contextValue.startsWith(node.contextValue))));
        await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }

    public async updateFavorites() {
        const settings: any = { ...vscode.workspace.getConfiguration().get(USSTree.persistenceSchema) };
        if (settings.persistence) {
            settings.favorites = this.mFavorites.map((fav) =>
            (fav.fullPath.startsWith(fav.getProfileName()) ? fav.fullPath : fav.getProfileName() + fav.fullPath) + "{" +
                fav.contextValue.substring(0, fav.contextValue.indexOf(extension.FAV_SUFFIX)) + "}");
            await vscode.workspace.getConfiguration().update(USSTree.persistenceSchema, settings, vscode.ConfigurationTarget.Global);
        }
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
        let sessionNode = node.getSessionNode();
        let remotepath: string;
        let usrNme: string;
        let passWrd: string;
        let baseEncd: string;
        if ((!(node.getSession().ISession.user).trim()) || (!(node.getSession().ISession.password).trim())) {
            try {
                const values = await Profiles.getInstance().promptCredentials(node.getProfileName());
                if (values !== undefined) {
                    usrNme = values [0];
                    passWrd = values [1];
                    baseEncd = values [2];
                }
            } catch (error) {
                await errorHandling(error, node.getProfileName(),
                    localize("ussTree.error", "Error encountered in ") + `ussFilterPrompt.optionalProfiles!`);
            }
            if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                node.getSession().ISession.user = usrNme;
                node.getSession().ISession.password = passWrd;
                node.getSession().ISession.base64EncodedAuth = baseEncd;
                this.validProfile = 0;
            } else {
                return;
            }
            await this.refreshElement(node);
            await this.refresh();
        } else {
            this.validProfile = 0;
        }
        if (this.validProfile === 0) {
            if (node.contextValue === extension.USS_SESSION_CONTEXT) {
                if (this.mHistory.getHistory().length > 0) {

                    const createPick = new FilterDescriptor(USSTree.defaultDialogText);
                    const items: vscode.QuickPickItem[] = this.mHistory.getHistory().map((element) => new FilterItem(element));
                    if (extension.ISTHEIA) {
                        const options1: vscode.QuickPickOptions = {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter")
                        };
                        // get user selection
                        const choice = (await vscode.window.showQuickPick([createPick, ...items], options1));
                        if (!choice) {
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
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
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
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
                if (!remotepath) {
                    // manually entering a search - switch to an input box
                    const options: vscode.InputBoxOptions = {
                        prompt: localize("filterPrompt.option.prompt.search",
                            "Create a new filter"),
                        value: sessionNode.fullPath
                    };
                    // get user input
                    remotepath = await vscode.window.showInputBox(options);
                    if (!remotepath || remotepath.length === 0) {
                        vscode.window.showInformationMessage(localize("filterPrompt.enterPath", "You must enter a path."));
                        return;
                    }
                }
            } else {
                // executing search from saved search in favorites
                remotepath = node.label.trim().substring(node.label.trim().indexOf(":") + 2);
                const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
                await this.addSession(session);
                const faveNode = node;
                sessionNode = this.mSessionNodes.find((tempNode) =>
                    tempNode.getProfileName() === session
                );
                if ((!sessionNode.getSession().ISession.user) || (!sessionNode.getSession().ISession.password)) {
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
            this.addHistory(sanitizedPath);
        }
    }

    public async initialize(log: Logger) {
        this.log = log;
        this.log.debug(localize("initializeFavorites.log.debug", "initializing favorites"));
        const favoriteSearchPattern = /^\[.+\]\:\s.*\{uss_session\}$/;
        const directorySearchPattern = /^\[.+\]\:\s.*\{directory\}$/;
        const lines: string[] = this.mHistory.readFavorites();
        lines.forEach((line) => {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const nodeName = (line.substring(line.indexOf(":") + 1, line.indexOf("{"))).trim();
            const sesName = line.substring(1, line.lastIndexOf("]")).trim();
            try {
                const profile = Profiles.getInstance().loadNamedProfile(sesName);
                const session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
                let node: ZoweUSSNode;
                if (directorySearchPattern.test(line)) {
                    node = new ZoweUSSNode(nodeName,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        this.mFavoriteSession, session, "",
                        false, profileName);
                } else if (favoriteSearchPattern.test(line)) {
                    const label = "[" + sesName + "]: " + nodeName;
                    node = new ZoweUSSNode(label, vscode.TreeItemCollapsibleState.None,
                        this.mFavoriteSession, session, null, false, profileName);
                    node.contextValue = extension.USS_SESSION_CONTEXT;
                    node.fullPath = nodeName;
                    node.label = node.tooltip = label;
                    // add a command to execute the search
                    node.command = { command: "zowe.uss.fullPath", title: "", arguments: [node] };
                } else {
                    node = new ZoweUSSNode(nodeName,
                        vscode.TreeItemCollapsibleState.None,
                        this.mFavoriteSession, session, "",
                        false, profileName);
                    node.command = {command: "zowe.uss.ZoweUSSNode.open",
                                    title: localize("initializeUSSFavorites.lines.title", "Open"), arguments: [node]};
                }
                node.contextValue += extension.FAV_SUFFIX;
                const icon = getIconByNode(node);
                if (icon) {
                    node.iconPath = icon.path;
                }
                this.mFavorites.push(node);
            } catch(e) {
                const errMessage: string =
                localize("initializeUSSFavorites.error.profile1",
                    "Error: You have Zowe USS favorites that refer to a non-existent CLI profile named: ") + profileName +
                    localize("intializeUSSFavorites.error.profile2",
                    ". To resolve this, you can create a profile with this name, ") +
                    localize("initializeUSSFavorites.error.profile3",
                    "or remove the favorites with this profile name from the Zowe-USS-Persistent setting, which can be found in your ") +
                    getAppName(extension.ISTHEIA) + localize("initializeUSSFavorites.error.profile4", " user settings.");
                errorHandling(e, null, errMessage);
                return;
            }
        });
    }

    /**
     * Adds a single session to the USS tree
     *
     */
    private async addSingleSession(profile: IProfileLoaded) {
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a session with the USS API
            const session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new ZoweUSSNode(profile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, "", false,
                             profile.name);
            node.contextValue = extension.USS_SESSION_CONTEXT;
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
