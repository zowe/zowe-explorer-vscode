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
import * as contextually from "../shared/context";
import { Logger, IProfile, ISession } from "@zowe/imperative";
import { PersistentFilters } from "../PersistentFilters";
import { OwnerFilterDescriptor } from "../job/utils";
import { getIconByNode, getIconById, IconId } from "../generators/icons";
import { Profiles } from "../Profiles";
import { setProfile, setSession, errorHandling } from "../utils";
import { IZoweTreeNode, IZoweDatasetTreeNode, IZoweNodeType } from "../api/IZoweTreeNode";
import { IZoweTree } from "../api/IZoweTree";
import * as nls from "vscode-nls";
// import { getValidSession } from "../profiles/utils";
import { getNewNodeIcon } from "../shared/actions";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

// tslint:disable-next-line: max-classes-per-file
export class ZoweTreeProvider {

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | undefined> = new vscode.EventEmitter<IZoweTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | undefined> = this.mOnDidChangeTreeData.event;
    public createOwner = new OwnerFilterDescriptor();

    protected mHistory: PersistentFilters;
    protected log: Logger = Logger.getAppLogger();
    protected validProfile: number = -1;

    constructor(protected persistenceSchema: globals.PersistenceSchemaEnum, public mFavoriteSession: IZoweTreeNode) {
        this.mHistory = new PersistentFilters(this.persistenceSchema);
    }

    /**
     * Takes argument of type IZoweTreeNode and returns it converted to a general [TreeItem]
     *
     * @param {IZoweTreeNode} element
     * @returns {vscode.TreeItem}
     */
    public getTreeItem(element: IZoweTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public getParent(element: IZoweTreeNode): IZoweTreeNode {
        return element.getParent();
    }

    /**
     * Selects a specific item in the tree view
     *
     * @param {IZoweTreeNode}
     */
    public setItem(treeView: vscode.TreeView<IZoweTreeNode>, item: IZoweTreeNode) {
        treeView.reveal(item, {select: true, focus: true});
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: IZoweDatasetTreeNode): void {
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        this.mOnDidChangeTreeData.fire();
    }

    /**
     * Change the state of an expandable node
     * @param provider the tree view provider
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    public async flipState(element: IZoweTreeNode, isOpen: boolean = false) {
        element.collapsibleState = isOpen ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        const icon = getIconByNode(element);
        if (icon) {
            element.iconPath = icon.path;
        }
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }


    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        if (e.affectsConfiguration(this.persistenceSchema)) {
            const setting: any = {...vscode.workspace.getConfiguration().get(this.persistenceSchema)};
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace.getConfiguration().update(this.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public getSearchHistory() {
        return this.mHistory.getSearchHistory();
    }

    public getTreeType() {
        return this.persistenceSchema;
    }

    public async addSearchHistory(criteria: string) {
        if (criteria) {
            this.mHistory.addSearchHistory(criteria);
            this.refresh();
        }
    }

    public findNonFavoritedNode(element: IZoweTreeNode) {
        return undefined;
    }

    public findFavoritedNode(element: IZoweTreeNode) {
        return undefined;
    }
    public renameFavorite(node: IZoweTreeNode, newLabel: string) {
        return undefined;
    }
    public renameNode(profile: string, beforeDataSetName: string, afterDataSetName: string) {
        return undefined;
    }

    public async editSession(node: IZoweTreeNode, zoweFileProvider: IZoweTree<IZoweNodeType>) {
        const profile = node.getProfile();
        const profileName = node.getProfileName();

        // Check what happens if inactive
        const newProfile = await Profiles.getInstance().editSession(profile, profileName);

        if (newProfile) {
            // Get the active session
            // const EditSession = await getValidSession(node.getProfile(), node.getProfile().name, false);
            const EditSession = await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).getSession();

            if (EditSession) {
                node.getProfile().profile = newProfile as IProfile;
                await setProfile(node, newProfile as IProfile);
                if (await node.getSession()) {
                    await setSession(node, newProfile as ISession);
                } else {
                    this.deleteSessionByLabel(node.label);
                    zoweFileProvider.addSession(node.getProfileName());
                }
                this.refresh();
            }
            const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile, contextually.getNodeCategory(node), false);

            // Set node to proper active status in tree
            const sessionNode = node.getSessionNode();
            const newIcon = getNewNodeIcon(profileStatus.status, sessionNode);
            if (newIcon) { sessionNode.iconPath = newIcon.path; }

            node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            node.dirty = true;
            zoweFileProvider.refreshElement(node);
        }
    }

    public async checkCurrentProfile(node: IZoweTreeNode, prompt?: boolean): Promise<boolean> {
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile, contextually.getNodeCategory(node), prompt);
        if (profileStatus.status === "inactive") {
            if ((node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))) {
                // change contextValue only if the word inactive is not there
                if (node.contextValue.toLowerCase().indexOf("inactive") === -1) {
                    node.contextValue = node.contextValue + globals.INACTIVE_CONTEXT;
                }
                const inactiveIcon = getIconById(IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
            }

            await errorHandling(new Error(localize("validateProfiles.invalid1", "Profile Name ") +
                (profile.name) +
                localize("validateProfiles.invalid2",
                " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct.")));
            this.log.debug(localize("validateProfiles.invalid1", "Profile Name ") +
                (node.getProfileName()) +
                localize("validateProfiles.invalid2",
                " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."));

            return false;
        } else if (profileStatus.status === "active") {
            // Attach the valid session to the session node, if possible
            let sessionNode = node;
            while (sessionNode.getParent() && sessionNode.getParent().label !== "Favorites") { sessionNode = sessionNode.getParent(); }
            if (await sessionNode.getSession()) {
                await setSession(sessionNode, profile.profile as ISession);
            } else {
                // const newSession = await getValidSession(profile, profile.name, false);
                const newSession = await ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                const changedProfileIndex = Profiles.getInstance().allProfiles.findIndex((searchedProfile) => searchedProfile.name === profile.name);
                Profiles.getInstance().allProfiles[changedProfileIndex] = profile;
                await setProfile(sessionNode, profile.profile);
                Object.defineProperty(sessionNode, "session", { value: newSession, configurable: true });
                sessionNode.children = [];
                sessionNode.dirty = true;
            }
        } else if (profileStatus.status === "unverified") {
            if ((node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))) {
                // change contextValue only if the word unverified is not there
                if (node.contextValue.toLowerCase().indexOf("unverified") === -1) {
                    node.contextValue = node.contextValue + globals.UNVERIFIED_CONTEXT;
                }
            }
        }

        // Set node to proper active status in tree
        const sessNode = node.getSessionNode();
        const newIcon = getNewNodeIcon(profileStatus.status, sessNode);
        if (newIcon) { sessNode.iconPath = newIcon.path; }

        return true;
    }

    public async createZoweSession(zoweFileProvider: IZoweTree<IZoweNodeType>) {
        await Profiles.getInstance().createZoweSession(zoweFileProvider);
    }

    protected deleteSessionByLabel(revisedLabel: string) {
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }
}
