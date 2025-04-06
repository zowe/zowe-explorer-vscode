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
import { Constants, JwtCheckResult } from "../configuration/Constants";
import { IconGenerator } from "../icons/IconGenerator";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { SharedTreeProviders } from "./shared/SharedTreeProviders";
import { SharedActions } from "./shared/SharedActions";
import { IconUtils } from "../icons/IconUtils";
import { AuthUtils } from "../utils/AuthUtils";
import { TreeViewUtils } from "../utils/TreeViewUtils";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";

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
     * Handles updates to the node when it is expanded or collapsed by the user
     * @param element The node being flipped
     * @param isOpen Whether the node is expanding or collapsing. Note that the collapsible state on the node is not yet updated to the new state.
     */
    public flipState(element: T, isOpen: boolean = false): void {
        ZoweLogger.trace("ZoweTreeProvider.flipState called.");
        this.onCollapsibleStateChange(element, isOpen ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    }

    /**
     * Handles updates to the node when it is expanded or collapsed by the user.
     *
     * @param element The node whose collapsible state is changing
     * @param newState The new collapsible state of the node
     */
    public onCollapsibleStateChange(element: T, newState: vscode.TreeItemCollapsibleState): void {
        ZoweLogger.trace("ZoweTreeProvider.onCollapsibleStateChange called.");
        element.collapsibleState = newState;
        TreeViewUtils.updateNodeIcon(element, this, newState);
        if (newState === vscode.TreeItemCollapsibleState.Collapsed) {
            // Only mark as dirty when the node is collapsing to avoid a duplicate refresh
            // This prepares the node for a refresh once it is expanded again
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

    private setStatusForSession(node: IZoweTreeNode, status: Validation.ValidationType): void {
        if (node == null) {
            // If no session node was found for this provider, don't try to update it
            return;
        }
        let statusContext: string;
        let iconId: IconUtils.IconId;
        switch (status) {
            default:
            case Validation.ValidationType.UNVERIFIED:
                statusContext = Constants.UNVERIFIED_CONTEXT;
                iconId = node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded ? IconUtils.IconId.sessionOpen : IconUtils.IconId.session;
                break;
            case Validation.ValidationType.VALID:
                statusContext = Constants.ACTIVE_CONTEXT;
                iconId =
                    node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded
                        ? IconUtils.IconId.sessionActiveOpen
                        : IconUtils.IconId.sessionActive;
                break;
            case Validation.ValidationType.INVALID:
                statusContext = Constants.INACTIVE_CONTEXT;
                iconId = IconUtils.IconId.sessionInactive;
                break;
        }

        node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
        node.contextValue = node.contextValue + statusContext;
        const inactiveIcon = IconGenerator.getIconById(iconId);
        if (inactiveIcon) {
            node.iconPath = inactiveIcon.path;
        }
        this.nodeDataChanged(node as T);
    }

    private static updateSessionContext(profileName: string, status: Validation.ValidationType): void {
        for (const provider of Object.values(SharedTreeProviders.providers)) {
            const session = (provider as IZoweTree<IZoweTreeNode>).mSessionNodes.find((n) => n.getProfileName() === profileName);
            (provider as ZoweTreeProvider<IZoweTreeNode>).setStatusForSession(session, status);
        }
    }

    public async checkCurrentProfile(node: IZoweTreeNode): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("ZoweTreeProvider.checkCurrentProfile called.");
        const profile = node.getProfile();
        const profileName = profile.name ?? node.getProfileName();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        const jwtCheckResult = await ZoweTreeProvider.checkJwtForProfile(profileName);
        if (jwtCheckResult === JwtCheckResult.TokenExpired) {
            // Mark profile as inactive if user dismissed "token expired/login" prompt or login failed
            profileStatus.status = "inactive";
            Profiles.getInstance().validProfile = Validation.ValidationType.INVALID;
        }
        if (profileStatus.status === "inactive") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                ZoweTreeProvider.updateSessionContext(profileName, Validation.ValidationType.INVALID);
                Profiles.getInstance().validProfile = Validation.ValidationType.INVALID;
            }

            Profiles.getInstance().showProfileInactiveMsg(profile.name);
        } else if (profileStatus.status === "active") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                ZoweTreeProvider.updateSessionContext(profileName, Validation.ValidationType.VALID);
                Profiles.getInstance().validProfile = Validation.ValidationType.VALID;
            }
        } else if (profileStatus.status === "unverified") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                ZoweTreeProvider.updateSessionContext(profileName, Validation.ValidationType.UNVERIFIED);
                Profiles.getInstance().validProfile = Validation.ValidationType.UNVERIFIED;
            }
        }
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
     * Checks if a JSON Web Token (JWT) is used for authenticating the given profile name.
     * If so, it grabs and decodes the token to determine its expiration date.
     * If the token has expired, it prompts the user to log in again and returns a result based on the login attempt.
     *
     * @param profileName The name of the profile to check the JWT token for
     * @returns The result of the JWT token check (expired, unsupported, or valid)
     */
    protected static async checkJwtForProfile(profileName: string): Promise<JwtCheckResult> {
        const loadedProfile = Profiles.getInstance().loadNamedProfile(profileName);

        // Check if the profile uses a token-based authentication method
        let tokenType: string;
        try {
            tokenType = ZoweExplorerApiRegister.getInstance().getCommonApi(loadedProfile).getTokenTypeName();
        } catch (err) {
            // The API doesn't support tokens, so no expiration check needed
            return JwtCheckResult.TokenUnusedOrUnsupported;
        }

        // Skip token validation for falsy token types or LTPA2 tokens
        if (tokenType == null || tokenType === "LtpaToken2") {
            return JwtCheckResult.TokenUnusedOrUnsupported;
        }

        // Check if token has expired
        const profInfo = await Profiles.getInstance().getProfileInfo();
        if (profInfo.hasTokenExpiredForProfile(profileName)) {
            // Token expired - prompt user to login again
            const loginSuccessful = await AuthUtils.promptForSsoLogin(profileName);
            // Return "token expired" as the user is currently logging into the authentication service.
            // The profile cannot be used until the user finishes logging in.
            return loginSuccessful ? JwtCheckResult.TokenValid : JwtCheckResult.TokenExpired;
        }

        // Token is valid and not expired
        return JwtCheckResult.TokenValid;
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
