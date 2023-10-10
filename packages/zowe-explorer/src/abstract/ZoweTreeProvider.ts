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
import { imperative } from "@zowe/cli";
import { PersistentFilters } from "../PersistentFilters";
import { getIconByNode, getIconById, IconId } from "../generators/icons";
import * as contextually from "../shared/context";
import { IZoweTreeNode, IZoweDatasetTreeNode, IZoweNodeType, IZoweTree, PersistenceSchemaEnum, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { setProfile, setSession, errorHandling } from "../utils/ProfilesUtils";

import * as nls from "vscode-nls";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ZoweTreeProvider {
    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | void> = new vscode.EventEmitter<IZoweTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | void> = this.mOnDidChangeTreeData.event;

    protected mHistory: PersistentFilters;
    protected log: imperative.Logger = imperative.Logger.getAppLogger();
    protected validProfile: number = -1;

    public constructor(protected persistenceSchema: PersistenceSchemaEnum, public mFavoriteSession: IZoweTreeNode) {
        this.mHistory = new PersistentFilters(this.persistenceSchema);
    }

    /**
     * Takes argument of type IZoweTreeNode and returns it converted to a general [TreeItem]
     *
     * @param {IZoweTreeNode} element
     * @returns {vscode.TreeItem}
     */
    public getTreeItem(element: IZoweTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        ZoweLogger.trace("ZoweTreeProvider.getTreeItem called.");
        return element;
    }

    public getParent(element: IZoweTreeNode): IZoweTreeNode {
        ZoweLogger.trace("ZoweTreeProvider.getParent called.");
        return element.getParent();
    }

    /**
     * Selects a specific item in the tree view
     *
     * @param {IZoweTreeNode}
     */
    public setItem(treeView: vscode.TreeView<IZoweTreeNode>, item: IZoweTreeNode): void {
        ZoweLogger.trace("ZoweTreeProvider.setItem called.");
        treeView.reveal(item, { select: true, focus: true });
    }

    /**
     * Call whenever the context of a node needs to be refreshed to add the home suffix
     * @param node Node to refresh
     */
    public async refreshHomeProfileContext(node): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.refreshHomeProfileContext called.");
        const mProfileInfo = await Profiles.getInstance().getProfileInfo();
        if (mProfileInfo.usingTeamConfig && !contextually.isHomeProfile(node)) {
            const prof = mProfileInfo.getAllProfiles().find((p) => p.profName === node.getProfileName());
            const osLocInfo = mProfileInfo.getOsLocInfo(prof);
            if (osLocInfo?.[0]?.global) {
                node.contextValue += globals.HOME_SUFFIX;
            }
        }
    }

    /**
     * Fire the "onDidChangeTreeData" event to signal that a node in the tree has changed.
     * Unlike `refreshElement`, this function does *not* signal a refresh for the given node -
     * it simply tells VS Code to repaint the node in the tree.
     * @param node The node that should be repainted
     */
    public nodeDataChanged(node: IZoweTreeNode): void {
        this.mOnDidChangeTreeData.fire(node);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: IZoweDatasetTreeNode): void {
        ZoweLogger.trace("ZoweTreeProvider.refreshElement called.");
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        ZoweLogger.trace("ZoweTreeProvider.refresh called.");
        this.mOnDidChangeTreeData.fire();
    }

    /**
     * Change the state of an expandable node
     * @param provider the tree view provider
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    public flipState(element: IZoweTreeNode, isOpen: boolean = false): void {
        ZoweLogger.trace("ZoweTreeProvider.flipState called.");
        element.collapsibleState = isOpen ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        const icon = getIconByNode(element);
        if (icon) {
            element.iconPath = icon.path;
        }
        element.dirty = true;
        if (isOpen) {
            this.mOnDidChangeTreeData.fire(element);
        }
    }

    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.onDidChangeConfiguration called.");
        if (e.affectsConfiguration(this.persistenceSchema)) {
            const setting: any = {
                ...SettingsConfig.getDirectValue(this.persistenceSchema),
            };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await SettingsConfig.setDirectValue(this.persistenceSchema, setting);
            }
        }
    }

    public getSearchHistory(): string[] {
        ZoweLogger.trace("ZoweTreeProvider.getSearchHistory called.");
        return this.mHistory.getSearchHistory();
    }

    public getTreeType(): PersistenceSchemaEnum {
        ZoweLogger.trace("ZoweTreeProvider.getTreeType called.");
        return this.persistenceSchema;
    }

    public addSearchHistory(criteria: string): void {
        ZoweLogger.trace("ZoweTreeProvider.addSearchHistory called.");
        if (criteria) {
            this.mHistory.addSearchHistory(criteria);
        }
    }

    public findNonFavoritedNode(_element: IZoweTreeNode): any {
        ZoweLogger.trace("ZoweTreeProvider.findNonFavoritedNode called.");
        return undefined;
    }

    public findFavoritedNode(_element: IZoweTreeNode): any {
        ZoweLogger.trace("ZoweTreeProvider.findFavoritedNode called.");
        return undefined;
    }
    public renameFavorite(_node: IZoweTreeNode, _newLabel: string): any {
        ZoweLogger.trace("ZoweTreeProvider.renameFavorite called.");
        return undefined;
    }
    public renameNode(_profile: string, _beforeDataSetName: string, _afterDataSetName: string): any {
        ZoweLogger.trace("ZoweTreeProvider.renameNode called.");
        return undefined;
    }

    public async editSession(node: IZoweTreeNode, zoweFileProvider: IZoweTree<IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.editSession called.");
        const profile = node.getProfile();
        const profileName = node.getProfileName();
        const EditSession = await Profiles.getInstance().editSession(profile, profileName);
        if (EditSession) {
            node.getProfile().profile = EditSession as imperative.IProfile;
            setProfile(node, EditSession as imperative.IProfile);
            if (node.getSession()) {
                setSession(node, EditSession as imperative.ISession);
            } else {
                zoweFileProvider.deleteSession(node.getSessionNode());
                this.mHistory.addSession(node.label as string);
                await zoweFileProvider.addSession(node.getProfileName());
            }
            this.refresh();
            // Remove the edited profile from profilesForValidation
            // Revalidate updated profile and update the validation icon
            await this.checkCurrentProfile(node);
        }
    }

    public async checkCurrentProfile(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.checkCurrentProfile called.");
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        if (profileStatus.status === "inactive") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.INACTIVE_CONTEXT;
                const inactiveIcon = getIconById(IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
                Profiles.getInstance().validProfile = ValidProfileEnum.INVALID;
            }

            await errorHandling(
                localize("validateProfiles.invalid1", "Profile Name ") +
                    profile.name +
                    localize(
                        "validateProfiles.invalid2",
                        " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
                    )
            );
        } else if (profileStatus.status === "active") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.ACTIVE_CONTEXT;
                const activeIcon = getIconById(IconId.sessionActive);
                if (activeIcon) {
                    node.iconPath = activeIcon.path;
                }
                Profiles.getInstance().validProfile = ValidProfileEnum.VALID;
            }
        } else if (profileStatus.status === "unverified") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.UNVERIFIED_CONTEXT;
                Profiles.getInstance().validProfile = ValidProfileEnum.UNVERIFIED;
            }
        }
        await this.refresh();
    }

    public async ssoLogin(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.ssoLogin called.");
        await Profiles.getInstance().ssoLogin(node);
        if (contextually.isDsSession(node)) {
            await vscode.commands.executeCommand("zowe.ds.refreshAll");
        } else if (contextually.isUssSession(node)) {
            await vscode.commands.executeCommand("zowe.uss.refreshAll");
        } else {
            await vscode.commands.executeCommand("zowe.jobs.refreshAllJobs");
        }
    }

    public async ssoLogout(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.ssoLogout called.");
        await Profiles.getInstance().ssoLogout(node);
        if (contextually.isDsSession(node)) {
            await vscode.commands.executeCommand("zowe.ds.refreshAll");
        } else if (contextually.isUssSession(node)) {
            await vscode.commands.executeCommand("zowe.uss.refreshAll");
        } else {
            await vscode.commands.executeCommand("zowe.jobs.refreshAllJobs");
        }
    }

    public async createZoweSchema(zoweFileProvider: IZoweTree<IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.createZoweSchema called.");
        await Profiles.getInstance().createZoweSchema(zoweFileProvider);
    }

    public async createZoweSession(zoweFileProvider: IZoweTree<IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.createZoweSession called.");
        await Profiles.getInstance().createZoweSession(zoweFileProvider);
    }

    protected deleteSessionByLabel(revisedLabel: string): void {
        ZoweLogger.trace("ZoweTreeProvider.deleteSessionByLabel called.");
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }
}
