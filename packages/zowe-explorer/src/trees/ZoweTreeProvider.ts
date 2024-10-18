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
import { IZoweTreeNode, imperative, Types, IZoweTree, PersistenceSchemaEnum, Validation } from "@zowe/zowe-explorer-api";
import { ZowePersistentFilters } from "../tools/ZowePersistentFilters";
import { ZoweLogger } from "../tools/ZoweLogger";
import { Profiles } from "../configuration/Profiles";
import { SharedContext } from "./shared/SharedContext";
import { Constants } from "../configuration/Constants";
import { IconGenerator } from "../icons/IconGenerator";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { SharedTreeProviders } from "./shared/SharedTreeProviders";
import { SharedActions } from "./shared/SharedActions";
import { IconUtils } from "../icons/IconUtils";
import { AuthUtils } from "../utils/AuthUtils";
import { TreeViewUtils } from "../utils/TreeViewUtils";

export class ZoweTreeProvider<T extends IZoweTreeNode> {
    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<T | undefined | null | void> = new vscode.EventEmitter();
    public readonly onDidChangeTreeData = this.mOnDidChangeTreeData.event;

    protected mHistory: ZowePersistentFilters;
    protected log: imperative.Logger = imperative.Logger.getAppLogger();
    protected validProfile: number = -1;

    public constructor(protected persistenceSchema: PersistenceSchemaEnum, public mFavoriteSession: IZoweTreeNode) {
        this.mHistory = new ZowePersistentFilters(this.persistenceSchema);
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

    public getParent(element: T): vscode.ProviderResult<T> {
        ZoweLogger.trace("ZoweTreeProvider.getParent called.");
        return element.getParent() as T;
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

    protected async isGlobalProfileNode(node: T): Promise<boolean> {
        const mProfileInfo = await Profiles.getInstance().getProfileInfo();
        const prof = mProfileInfo.getAllProfiles().find((p) => p.profName === node.getProfileName());
        const osLocInfo = mProfileInfo.getOsLocInfo(prof);
        if (osLocInfo?.[0]?.global) {
            return true;
        }

        return SharedContext.isGlobalProfile(node);
    }

    /**
     * Call whenever the context of a node needs to be refreshed to add the home suffix
     * @param node Node to refresh
     */
    public async refreshHomeProfileContext(node: T): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.refreshHomeProfileContext called.");
        if (await this.isGlobalProfileNode(node)) {
            node.contextValue += Constants.HOME_SUFFIX;
        }
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: T): void {
        ZoweLogger.trace("ZoweTreeProvider.refreshElement called.");
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Fire the "onDidChangeTreeData" event to signal that a node in the tree has changed.
     * Unlike `refreshElement`, this function does *not* signal a refresh for the given node -
     * it simply tells VS Code to repaint the node in the tree.
     * @param node The node that should be repainted
     */
    public nodeDataChanged(element: T): void {
        ZoweLogger.trace("ZoweTreeProvider.nodeDataChanged called.");
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        ZoweLogger.trace("ZoweTreeProvider.refresh called.");
        this.mOnDidChangeTreeData.fire(null);
    }

    /**
     * Change the state of an expandable node
     * @param provider the tree view provider
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    public flipState(element: T, isOpen: boolean = false): void {
        ZoweLogger.trace("ZoweTreeProvider.flipState called.");
        element.collapsibleState = isOpen ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        const icon = IconGenerator.getIconByNode(element);
        if (icon) {
            element.iconPath = icon.path;
        }
        if (isOpen) {
            this.mOnDidChangeTreeData.fire(element);
        } else {
            // Don't mark as dirty when expanded to avoid duplicate refresh
            element.dirty = true;
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

    public async addSession(opts: Types.AddSessionOpts = {}): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.addSession called.");
        const treeProviders = opts.addToAllTrees ? Object.values(SharedTreeProviders.providers) : [this];
        const isUsingAutomaticProfileValidation: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION);
        for (const treeProvider of treeProviders) {
            if (opts.sessionName) {
                await this.loadProfileBySessionName(opts.sessionName, treeProvider, isUsingAutomaticProfileValidation);
            } else {
                await this.loadProfileByPersistedProfile(treeProvider, opts.profileType, isUsingAutomaticProfileValidation);
            }
            treeProvider.refresh();
        }
    }

    public deleteSession(node: IZoweTreeNode, hideFromAllTrees?: boolean): void {
        ZoweLogger.trace("ZoweTreeProvider.deleteSession called.");
        const treeProviders = hideFromAllTrees ? Object.values(SharedTreeProviders.providers) : [this];
        for (const treeProvider of treeProviders) {
            treeProvider.mSessionNodes = treeProvider.mSessionNodes.filter(
                (mSessionNode: IZoweTreeNode) => mSessionNode.getLabel() !== node.getLabel()
            );
            treeProvider.removeSession(node.getLabel() as string);
            treeProvider.refresh();
        }
    }

    public async editSession(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.editSession called.");
        const profile = node.getProfile();
        await Profiles.getInstance().editSession(profile);
    }

    public async checkCurrentProfile(node: IZoweTreeNode): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("ZoweTreeProvider.checkCurrentProfile called.");
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        if (profileStatus.status === "inactive") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.INACTIVE_CONTEXT;
                const inactiveIcon = IconGenerator.getIconById(IconUtils.IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
                Profiles.getInstance().validProfile = Validation.ValidationType.INVALID;
            }

            await AuthUtils.errorHandling(
                vscode.l10n.t({
                    message:
                        "Profile Name {0} is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct.",
                    args: [profile.name],
                    comment: ["Profile name"],
                }),
                { profile }
            );
        } else if (profileStatus.status === "active") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.ACTIVE_CONTEXT;
                const activeIcon = IconGenerator.getIconById(IconUtils.IconId.sessionActive);
                if (activeIcon) {
                    node.iconPath = activeIcon.path;
                }
                Profiles.getInstance().validProfile = Validation.ValidationType.VALID;
            }
        } else if (profileStatus.status === "unverified") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.UNVERIFIED_CONTEXT;
                Profiles.getInstance().validProfile = Validation.ValidationType.UNVERIFIED;
            }
        }
        await ZoweTreeProvider.checkJwtTokenForProfile(node.getProfileName());
        this.refresh();
        return profileStatus;
    }

    public async ssoLogin(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.ssoLogin called.");
        await Profiles.getInstance().ssoLogin(node);
        if (SharedContext.isDsSession(node)) {
            await vscode.commands.executeCommand("zowe.ds.refreshAll");
        } else if (SharedContext.isUssSession(node)) {
            await vscode.commands.executeCommand("zowe.uss.refreshAll");
        } else {
            await vscode.commands.executeCommand("zowe.jobs.refreshAllJobs");
        }
    }

    public async ssoLogout(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.ssoLogout called.");
        await Profiles.getInstance().ssoLogout(node);
        if (SharedContext.isDsSession(node)) {
            await vscode.commands.executeCommand("zowe.ds.refreshAll");
        } else if (SharedContext.isUssSession(node)) {
            await vscode.commands.executeCommand("zowe.uss.refreshAll");
        } else {
            await vscode.commands.executeCommand("zowe.jobs.refreshAllJobs");
        }
    }

    public async createZoweSchema(zoweFileProvider: IZoweTree<Types.IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.createZoweSchema called.");
        await Profiles.getInstance().createZoweSchema(zoweFileProvider);
    }

    public async createZoweSession(zoweFileProvider: IZoweTree<Types.IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.createZoweSession called.");
        await Profiles.getInstance().createZoweSession(zoweFileProvider);
    }

    /**
     * Checks if a JWT token is used for authenticating the given profile name.
     * If so, it will grab and decode the token to determine its expire date.
     * If the token has expired, it will prompt the user to log in again.
     *
     * @param profileName The name of the profile to check the JWT token for
     */
    protected static async checkJwtTokenForProfile(profileName: string): Promise<void> {
        const profInfo = await Profiles.getInstance().getProfileInfo();

        if (profInfo.hasTokenExpiredForProfile(profileName)) {
            await AuthUtils.promptUserForSsoLogin(profileName);
        }
    }

    private async loadProfileBySessionName(
        sessionName: string,
        treeProvider: IZoweTree<IZoweTreeNode>,
        isUsingAutomaticProfileValidation: boolean
    ): Promise<void> {
        const profile: imperative.IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName.trim());
        if (profile) {
            await treeProvider.addSingleSession(profile);
            for (const node of treeProvider.mSessionNodes) {
                if (node.label !== vscode.l10n.t("Favorites")) {
                    const name = node.getProfileName();
                    if (name === profile.name) {
                        SharedActions.resetValidationSettings(node, isUsingAutomaticProfileValidation);
                    }
                }
            }
        }
    }

    private async loadProfileByPersistedProfile(
        treeProvider: IZoweTree<IZoweTreeNode>,
        profileType: string,
        isUsingAutomaticProfileValidation: boolean
    ): Promise<void> {
        const profiles: imperative.IProfileLoaded[] = profileType
            ? await Profiles.getInstance().fetchAllProfilesByType(profileType)
            : await Profiles.getInstance().fetchAllProfiles();
        for (const profile of profiles) {
            const existingSessionNode = treeProvider.mSessionNodes.find((node) => node.label.toString().trim() === profile.name);
            const sessionInHistory = treeProvider.getSessions().some((session) => session?.trim() === profile.name);
            if (!existingSessionNode && sessionInHistory) {
                await treeProvider.addSingleSession(profile);
                for (const node of treeProvider.mSessionNodes) {
                    if (node.label !== vscode.l10n.t("Favorites") && node.getProfileName() === profile.name) {
                        SharedActions.resetValidationSettings(node, isUsingAutomaticProfileValidation);
                        break;
                    }
                }
            }
        }
        await TreeViewUtils.addDefaultSession(treeProvider, profileType);
    }
}
