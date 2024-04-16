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
import { IJob } from "@zowe/zos-jobs-for-zowe-sdk";
import { Gui, Validation, imperative, IZoweTree, IZoweTreeNode, IZoweJobTreeNode, PersistenceSchemaEnum, Types } from "@zowe/zowe-explorer-api";
import { FilterItem, errorHandling } from "../utils/ProfilesUtils";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ZoweJobNode } from "./ZoweJobNode";
import { getAppName, sortTreeItems, jobStringValidator, updateOpenFiles, parseFavorites } from "../shared/utils";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/ZoweLogger";
import { Poller } from "@zowe/zowe-explorer-api/src/utils";
import { PollDecorator } from "../utils/DecorationProviders";
import { TreeViewUtils } from "../utils/TreeViewUtils";
import { TreeProviders } from "../shared/TreeProviders";
import { JOB_FILTER_OPTS } from "./utils";
import * as path from "path";
import { JobFSProvider } from "./JobFSProvider";

interface IJobSearchCriteria {
    Owner: string | undefined;
    Prefix: string | undefined;
    JobId: string | undefined;
    Status: string | undefined;
}

interface IJobStatusOption {
    key: string;
    label: string;
    value: string;
    picked: boolean;
}

interface IJobPickerOption {
    key: string;
    label: string;
    value: string;
    show: boolean;
    placeHolder: string;
    validateInput?: vscode.InputBoxOptions["validateInput"];
}

/**
 * Creates the Job tree that contains nodes of sessions, jobs and spool items
 *
 * @export
 * @class ZosJobsProvider
 * @implements {vscode.TreeDataProvider}
 */
export async function createJobsTree(log: imperative.Logger): Promise<ZosJobsProvider> {
    ZoweLogger.trace("ZosJobsProvider.createJobsTree called.");
    const tree = new ZosJobsProvider();
    tree.initializeJobsTree(log);
    await tree.addSession(undefined, undefined, tree);
    return tree;
}

export class ZosJobsProvider extends ZoweTreeProvider<IZoweJobTreeNode> implements Types.IZoweJobTreeType {
    public static readonly JobId = "JobId: ";
    public static readonly Owner = "Owner: ";
    public static readonly Prefix = "Prefix: ";
    public static readonly Status = "Status: ";
    public static readonly defaultDialogText: string = vscode.l10n.t("Create new...");
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.Job;
    private static readonly submitJobQueryLabel = vscode.l10n.t("$(check) Submit this query");
    private static readonly chooseJobStatusLabel = "Job Status";
    public openFiles: Record<string, IZoweJobTreeNode> = {};
    public dragMimeTypes: string[] = ["application/vnd.code.tree.zowe.jobs.explorer"];
    public dropMimeTypes: string[] = ["application/vnd.code.tree.zowe.jobs.explorer"];

    public JOB_PROPERTIES = [
        {
            key: `owner`,
            label: `Job Owner`,
            value: "",
            show: true,
            placeHolder: vscode.l10n.t("Enter job owner ID"),
            validateInput: (text: string): string | null => jobStringValidator(text, "owner"),
        },
        {
            key: `prefix`,
            label: `Job Prefix`,
            value: "*",
            show: true,
            placeHolder: vscode.l10n.t("Enter job prefix"),
            validateInput: (text: string): string | null => jobStringValidator(text, "prefix"),
        },
        {
            key: `job-status`,
            label: ZosJobsProvider.chooseJobStatusLabel,
            value: "*",
            show: true,
            placeHolder: vscode.l10n.t("Enter job status"),
        },
    ];

    public mSessionNodes: IZoweJobTreeNode[] = [];
    public mFavorites: IZoweJobTreeNode[] = [];
    public lastOpened: Types.ZoweNodeInteraction = {};
    public searchByQuery = new FilterItem({
        text: vscode.l10n.t("$(plus) Create job search filter"),
        menuType: globals.JobPickerTypes.QuerySearch,
    });
    public searchById = new FilterItem({
        text: vscode.l10n.t("$(search) Search by job ID"),
        menuType: globals.JobPickerTypes.IdSearch,
    });
    private treeView: vscode.TreeView<IZoweJobTreeNode>;

    public constructor() {
        super(
            ZosJobsProvider.persistenceSchema,
            new ZoweJobNode({
                label: vscode.l10n.t("Favorites"),
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            })
        );
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession];
        this.treeView = Gui.createTreeView("zowe.jobs.explorer", {
            treeDataProvider: this,
            canSelectMany: true,
        });
        this.treeView.onDidCollapseElement(TreeViewUtils.refreshIconOnCollapse([contextually.isJob, contextually.isJobsSession], this));
    }

    public rename(_node: IZoweJobTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public open(_node: IZoweJobTreeNode, _preview: boolean): void {
        throw new Error("Method not implemented.");
    }
    public copy(_node: IZoweJobTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public paste(_node: IZoweJobTreeNode): void {
        throw new Error("Method not implemented.");
    }

    /**
     * Adds a save search to the Jobs favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public saveSearch(node: IZoweJobTreeNode): void {
        ZoweLogger.trace("ZosJobsProvider.saveSearch called.");
        node.contextValue = contextually.asFavorite(node);
    }
    public saveFile(_document: vscode.TextDocument): void {
        throw new Error("Method not implemented.");
    }
    public refreshPS(_node: IZoweJobTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(_node: IZoweJobTreeNode): void {
        throw new Error("Method not implemented.");
    }
    public filterPrompt(node: IZoweJobTreeNode): Promise<void> {
        return this.searchPrompt(node);
    }

    /**
     * Takes argument of type IZoweJobTreeNode and retrieves all of the first level children
     *
     * @param {IZoweJobTreeNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweJobTreeNode[] | Promise<IZoweJobTreeNode[]>}
     */
    public async getChildren(element?: IZoweJobTreeNode | undefined): Promise<IZoweJobTreeNode[]> {
        ZoweLogger.trace("ZosJobsProvider.getChildren called.");
        if (element) {
            // solution for optional credentials. Owner is having error on initialization.
            if (element.owner === "") {
                return;
            }
            if (contextually.isFavoriteContext(element)) {
                return this.mFavorites;
            }
            if (element.contextValue && element.contextValue === globals.FAV_PROFILE_CONTEXT) {
                const favsForProfile = this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    /**
     * Returns the tree view for the current JobTree
     *
     * @returns {vscode.TreeView<ZoweJobNode>}
     */
    public getTreeView(): vscode.TreeView<IZoweJobTreeNode> {
        ZoweLogger.trace("ZosJobsProvider.getTreeView called.");
        return this.treeView;
    }

    /**
     * Adds a session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     * @param {string} [profileType] - optional; loads profiles of a certain type if passed
     */
    public async addSession(sessionName?: string, profileType?: string, provider?: IZoweTree<IZoweTreeNode>): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.addSession called.");
        await super.addSession(sessionName, profileType, provider);
    }

    /**
     * Adds a single session to the tree
     * @param profile the profile to add to the tree
     */
    public async addSingleSession(profile: imperative.IProfileLoaded): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.addSingleSession called.");
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tNode) => tNode.label.toString() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a zosmf session with Zowe
            let session: imperative.Session;
            try {
                session = ZoweExplorerApiRegister.getJesApi(profile).getSession();
            } catch (err) {
                if (err.toString().includes("hostname")) {
                    ZoweLogger.error(err);
                } else {
                    await errorHandling(err, profile.name);
                }
            }
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new ZoweJobNode({
                label: profile.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile,
            });
            node.contextValue = globals.JOBS_SESSION_CONTEXT;
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

    public async delete(node: IZoweJobTreeNode): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.delete called.");

        await JobFSProvider.instance.delete(node.resourceUri, { recursive: false, deleteRemote: true });
        const favNode = this.relabelFavoritedJob(node);
        favNode.contextValue = contextually.asFavorite(favNode);
        await this.removeFavorite(favNode);
        node.getSessionNode().children = node.getSessionNode().children.filter((n) => n !== node);
        this.refresh();
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param jobsProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweJobTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(jobsProvider: IZoweJobTreeNode[], profileName: string): IZoweJobTreeNode | undefined {
        ZoweLogger.trace("ZosJobsProvider.findMatchingProfileInArray called.");
        return jobsProvider.find((treeNode) => treeNode.label === profileName);
    }

    /**
     * Finds the equivalent, favorited node.
     * @param node
     */
    public findFavoritedNode(node: IZoweJobTreeNode): IZoweJobTreeNode {
        ZoweLogger.trace("ZosJobsProvider.findFavoritedNode called.");
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, node.getProfileName());
        return profileNodeInFavorites?.children.find(
            (temp) => temp.label === node.getLabel().toString() && temp.contextValue.includes(node.contextValue)
        );
    }

    /**
     * Finds the equivalent, non-favorited node.
     * @param node
     */
    public findNonFavoritedNode(node: IZoweJobTreeNode): IZoweJobTreeNode {
        ZoweLogger.trace("ZosJobsProvider.findNonFavoritedNode called.");
        const profileName = node.getProfileName();
        const sessionNode = this.mSessionNodes.find((session) => session.label.toString().trim() === profileName);
        return sessionNode?.children.find((temp) => temp.label === node.label);
    }

    /**
     * Finds the equivalent node based on whether the passed node is a favorite.
     * @param node
     */
    public findEquivalentNode(node: IZoweJobTreeNode, isFavorite: boolean): IZoweJobTreeNode {
        ZoweLogger.trace("ZosJobsProvider.findEquivalentNode called.");
        return isFavorite ? this.findNonFavoritedNode(node) : this.findFavoritedNode(node);
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {ZoweJobNode}
     */
    public createProfileNodeForFavs(profileName: string, profile?: imperative.IProfileLoaded): ZoweJobNode {
        ZoweLogger.trace("ZosJobsProvider.createProfileNodeForFavs called.");
        const favProfileNode = new ZoweJobNode({
            label: profileName,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            parentNode: this.mFavoriteSession,
            profile,
        });
        if (!JobFSProvider.instance.exists(favProfileNode.resourceUri)) {
            JobFSProvider.instance.createDirectory(favProfileNode.resourceUri);
        }
        this.mFavorites.push(favProfileNode);
        return favProfileNode;
    }

    /**
     * Initialize the favorites and history information
     * @param log - Logger
     */
    public initializeJobsTree(log: imperative.Logger): void {
        ZoweLogger.trace("ZosJobsProvider.initializeJobsTree called.");
        this.log = log;
        ZoweLogger.debug(vscode.l10n.t("Initializing profiles with jobs favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            ZoweLogger.debug(vscode.l10n.t("No jobs favorites found."));
            return;
        }

        const favorites = parseFavorites(lines);
        for (const fav of favorites) {
            // The profile node used for grouping respective favorited items.
            // Create a node if it does not already exist in the Favorites array
            const profileNodeInFavorites =
                this.findMatchingProfileInArray(this.mFavorites, fav.profileName) ??
                this.createProfileNodeForFavs(fav.profileName, Profiles.getInstance().loadNamedProfile(fav.profileName));

            if (fav.contextValue == null) {
                continue;
            }

            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNodeForProfile = this.initializeFavChildNodeForProfile(fav.label, fav.contextValue, profileNodeInFavorites);
            profileNodeInFavorites.children.push(favChildNodeForProfile);
        }
    }

    /**
     * Creates an individual favorites node WITHOUT profiles or sessions, to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited data set's label
     * @param contextValue The favorited data set's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweJobTreeNode
     */
    public initializeFavChildNodeForProfile(label: string, contextValue: string, parentNode: IZoweJobTreeNode): ZoweJobNode {
        ZoweLogger.trace("ZosJobsProvider.initializeFavChildNodeForProfile called.");
        let favJob: ZoweJobNode;
        if (contextValue.startsWith(globals.JOBS_JOB_CONTEXT)) {
            favJob = new ZoweJobNode({
                label,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX,
                parentNode,
                profile: parentNode.getProfile(),
                job: new JobDetail(label),
            });
            if (JobFSProvider.instance.exists(favJob.resourceUri)) {
                JobFSProvider.instance.createDirectory(favJob.resourceUri, { job: favJob.job });
            }
        } else {
            // for search
            favJob = new ZoweJobNode({
                label,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX,
                parentNode,
                profile: parentNode.getProfile(),
            });
        }
        const icon = getIconByNode(favJob);
        if (icon) {
            favJob.iconPath = icon.path;
        }
        return favJob;
    }

    /**
     * Loads profile for the profile node in Favorites that was clicked on, as well as for its children favorites.
     * @param log
     * @param parentNode
     */
    public async loadProfilesForFavorites(log: imperative.Logger, parentNode: IZoweJobTreeNode): Promise<IZoweJobTreeNode[] | ZoweJobNode[]> {
        ZoweLogger.trace("ZosJobsProvider.loadProfilesForFavorites called.");
        const profileName = parentNode.label as string;
        const updatedFavsForProfile: IZoweJobTreeNode[] = [];
        let profile: imperative.IProfileLoaded;
        let session: imperative.Session;
        this.log = log;
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Loading profile: {0} for jobs favorites",
                args: [profileName],
                comment: ["Profile name"],
            })
        );
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (Profiles.getInstance().validProfile === Validation.ValidationType.VALID || !contextually.isValidationEnabled(parentNode)) {
                    session = ZoweExplorerApiRegister.getJesApi(profile).getSession();
                    parentNode.setProfileToChoice(profile);
                    parentNode.setSessionToChoice(session);
                    parentNode.owner = session.ISession.user;
                } else {
                    return [
                        new ZoweJobNode({
                            label: vscode.l10n.t("You must authenticate to view favorites."),
                            collapsibleState: vscode.TreeItemCollapsibleState.None,
                            parentNode,
                        }),
                    ];
                }
            } catch (error) {
                const errMessage: string = vscode.l10n.t({
                    message: `Error: You have Zowe Job favorites that refer to a non-existent CLI profile named: {0}.
                         To resolve this, you can remove {0} from the Favorites section of Zowe Explorer's Jobs view.
                          Would you like to do this now? {1}`,
                    args: [profileName, getAppName()],
                    comment: ["Profile name", "Application name"],
                });
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                ZoweLogger.error(errMessage + error.toString());
                const btnLabelRemove = vscode.l10n.t("Remove");
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
            if (!favorite.owner) {
                // Needed for setting tooltip
                favorite.owner = session.ISession.user;
            }
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
     * Adds a node to the Jobs favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public addFavorite(node: IZoweJobTreeNode): void {
        ZoweLogger.trace("ZosJobsProvider.addFavorite called.");
        let favJob: ZoweJobNode;
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites === undefined) {
            // If favorite node for profile doesn't exist yet, create a new one for it
            profileNodeInFavorites = this.createProfileNodeForFavs(profileName, node.getProfile());
            profileNodeInFavorites.iconPath = node.iconPath;
        }
        if (contextually.isSession(node)) {
            // Favorite a search/session
            favJob = new ZoweJobNode({
                label: this.createSearchLabel(node.owner, node.prefix, node.searchId, node.status),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX,
                parentNode: profileNodeInFavorites,
                session: node.getSession(),
                profile: node.getProfile(),
                job: node.job,
            });
            favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
            this.saveSearch(favJob);
        } else {
            // Favorite a job
            favJob = new ZoweJobNode({
                label: node.label as string,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: node.contextValue + globals.FAV_SUFFIX,
                parentNode: profileNodeInFavorites,
                session: node.getSession(),
                profile: node.getProfile(),
                job: node.job,
            });
            this.relabelFavoritedJob(favJob);
        }
        const icon = getIconByNode(favJob);
        if (icon) {
            favJob.iconPath = icon.path;
        }
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label === favJob.label)) {
            profileNodeInFavorites.children.push(favJob);
            sortTreeItems(profileNodeInFavorites.children, globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            sortTreeItems(this.mFavorites, globals.FAV_PROFILE_CONTEXT);
            this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public async removeFavorite(node: IZoweJobTreeNode): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.removeFavorite called.");
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        const profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites) {
            const startLength = profileNodeInFavorites.children.length;
            profileNodeInFavorites.children = profileNodeInFavorites.children.filter(
                (temp) => !(temp.label === node.label && temp.contextValue.startsWith(node.contextValue))
            );
            // Remove profile node from Favorites if it contains no more favorites.
            if (profileNodeInFavorites.children.length < 1) {
                return this.removeFavProfile(profileName, false);
            }
            if (startLength !== profileNodeInFavorites.children.length) {
                this.updateFavorites();
                this.refreshElement(this.mFavoriteSession);
            }
        }
    }

    public updateFavorites(): void {
        ZoweLogger.trace("ZosJobsProvider.updateFavorites called.");
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry =
                    "[" +
                    profileNode.label.toString() +
                    "]: " +
                    fav.label.toString() +
                    "{" +
                    (contextually.isFavoriteJob(fav) ? globals.JOBS_JOB_CONTEXT : globals.JOBS_SESSION_CONTEXT) +
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
    public async removeFavProfile(profileName: string, userSelected: boolean): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.removeFavProfile called.");
        // If user selected the "Remove profile from Favorites option", confirm they are okay with deleting all favorited items for that profile.
        let cancelled = false;
        if (userSelected) {
            const checkConfirmation = vscode.l10n.t({
                message: "This will remove all favorited Jobs items for profile {0}. Continue?",
                args: [profileName],
                comment: ["Profile name"],
            });
            const continueRemove = vscode.l10n.t("Continue");
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
        this.updateFavorites();
    }

    public removeSearchHistory(name: string): void {
        ZoweLogger.trace("ZosJobsProvider.removeSearchHistory called.");
        this.mHistory.removeSearchHistory(name);
    }

    public removeSession(name: string): void {
        ZoweLogger.trace("ZosJobsProvider.removeSession called.");
        this.mHistory.removeSession(name);
    }

    public resetSearchHistory(): void {
        ZoweLogger.trace("ZosJobsProvider.resetSearchHistory called.");
        this.mHistory.resetSearchHistory();
    }

    public getSessions(): string[] {
        ZoweLogger.trace("DatasetTree.getSessions called.");
        return this.mHistory.getSessions();
    }

    public getFileHistory(): string[] {
        ZoweLogger.trace("DatasetTree.getFileHistory called.");
        return this.mHistory.getFileHistory();
    }

    public getFavorites(): string[] {
        ZoweLogger.trace("DatasetTree.getFavorites called.");
        return this.mHistory.readFavorites();
    }

    public async getUserJobsMenuChoice(): Promise<FilterItem | undefined> {
        ZoweLogger.trace("ZosJobsProvider.getUserJobsMenuChoice called.");
        const items: FilterItem[] = this.mHistory
            .getSearchHistory()
            .map((element) => new FilterItem({ text: element, menuType: globals.JobPickerTypes.History }));

        // VSCode route to create a QuickPick
        const quickpick = Gui.createQuickPick();
        quickpick.items = [this.searchByQuery, this.searchById, globals.SEPARATORS.RECENT_FILTERS, ...items];
        quickpick.placeholder = vscode.l10n.t("Select a filter");
        quickpick.ignoreFocusOut = true;
        quickpick.show();
        const choice = await Gui.resolveQuickPick(quickpick);
        quickpick.hide();
        if (!choice) {
            Gui.showMessage(vscode.l10n.t("No selection made. Operation cancelled."));
            return undefined;
        }
        return choice as FilterItem;
    }

    public async getUserSearchQueryInput(choice: FilterItem, node: IZoweJobTreeNode): Promise<IJobSearchCriteria | undefined> {
        ZoweLogger.trace("ZosJobsProvider.getUserSearchQueryInput called.");
        if (!choice) {
            return undefined;
        }
        const { menuType } = choice.filterItem;
        const { QuerySearch, History, IdSearch } = globals.JobPickerTypes;

        if (menuType === QuerySearch) {
            return this.handleEditingMultiJobParameters(this.JOB_PROPERTIES, node);
        }
        if (menuType === IdSearch) {
            return this.handleSearchByJobId();
        }

        if (menuType === History) {
            const parsedHistory = this.parseJobSearchQuery(choice.label);
            if (parsedHistory.JobId) {
                return this.handleSearchByJobId(parsedHistory.JobId);
            } else {
                const quickPickPrefilledItems = this.getPopulatedPickerValues(parsedHistory);
                return this.handleEditingMultiJobParameters(quickPickPrefilledItems, node);
            }
        }
    }

    public async applyRegularSessionSearchLabel(node: IZoweJobTreeNode): Promise<string | undefined> {
        ZoweLogger.trace("ZosJobsProvider.applyRegularSessionsSearchLabel called.");
        const choice = await this.getUserJobsMenuChoice();
        const searchCriteriaObj = await this.getUserSearchQueryInput(choice, node);

        if (!searchCriteriaObj) {
            return undefined;
        }
        const searchCriteria = this.createSearchLabel(
            searchCriteriaObj.Owner,
            searchCriteriaObj.Prefix,
            searchCriteriaObj.JobId,
            searchCriteriaObj.Status
        );
        this.applySearchLabelToNode(node, searchCriteriaObj);
        return searchCriteria;
    }

    public async handleSearchByJobId(jobId?: string): Promise<IJobSearchCriteria> {
        ZoweLogger.trace("ZosJobsProvider.handleSearchByJobId called.");
        const options = {
            prompt: vscode.l10n.t("Enter a job ID"),
            value: jobId,
        };
        const newUserJobId = await Gui.showInputBox(options);
        if (!newUserJobId) {
            Gui.showMessage(vscode.l10n.t("Job search cancelled."));
            return;
        }
        return {
            Owner: undefined,
            Prefix: undefined,
            JobId: newUserJobId,
            Status: undefined,
        };
    }

    public parseJobSearchQuery(searchCriteria: string): IJobSearchCriteria {
        ZoweLogger.trace("ZosJobsProvider.parseJobSearchQuery called.");
        const searchCriteriaObj: IJobSearchCriteria = {
            Owner: undefined,
            Prefix: undefined,
            JobId: undefined,
            Status: undefined,
        };
        Object.preventExtensions(searchCriteriaObj);
        if (!searchCriteria) {
            return searchCriteriaObj;
        }
        let searchOptionArray = searchCriteria.split(/\s\|\s|(?<!:)\s/);
        if (searchOptionArray != null) {
            searchOptionArray = searchOptionArray.filter((val) => val?.includes(":")).map((val) => (val.startsWith(":") ? val.substring(1) : val));
            searchOptionArray.forEach((searchOption) => {
                const keyValue = searchOption.split(":");
                const key = keyValue[0]?.trim();
                const value = keyValue[1]?.trim();
                try {
                    searchCriteriaObj[key] = value;
                } catch (e) {
                    // capture and ignore errors
                }
            });
        }
        return searchCriteriaObj;
    }

    public getPopulatedPickerValues(searchObj: IJobSearchCriteria): IJobPickerOption[] {
        ZoweLogger.trace("ZosJobsProvider.getPopulatedPickerValues called.");
        const historyPopulatedItems = this.JOB_PROPERTIES;
        historyPopulatedItems.forEach((prop) => {
            if (prop.key === "owner") {
                prop.value = searchObj.Owner;
            }
            if (prop.key === "prefix") {
                prop.value = searchObj.Prefix;
            }
            if (prop.key === "job-status") {
                prop.value = searchObj.Status;
            }
        });
        return historyPopulatedItems;
    }

    public async applySavedFavoritesSearchLabel(node): Promise<string> {
        ZoweLogger.trace("ZosJobsProvider.applySavedFavoritesSearchLabel called.");
        // executing search from saved search in favorites
        const searchCriteria = node.label as string;
        const session = node.getProfileName();
        const faveNode = node;
        await this.addSession(session);
        node = this.mSessionNodes.find((tempNode) => tempNode.label?.toString() === session);
        if (!node.getSession().ISession.user || !node.getSession().ISession.password) {
            node.getSession().ISession.user = faveNode.getSession().ISession.user;
            node.getSession().ISession.password = faveNode.getSession().ISession.password;
            node.getSession().ISession.base64EncodedAuth = faveNode.getSession().ISession.base64EncodedAuth;
        }
        return searchCriteria;
    }

    /**
     * Prompts the user for search details to populate the [TreeView]{@link vscode.TreeView}
     *
     * @param {IZoweJobTreeNode} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: IZoweJobTreeNode): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.searchPrompt called.");
        await this.checkCurrentProfile(node);
        let searchCriteria: string = "";
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            const isSessionNotFav = contextually.isSessionNotFav(node);
            const isExpanded = node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;

            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }

            if (isSessionNotFav) {
                searchCriteria = await this.applyRegularSessionSearchLabel(node);

                if (searchCriteria != null) {
                    node.filtered = true;
                    node.label = node.getProfileName();
                    node.tooltip = node.description = searchCriteria;
                    node.dirty = true;
                    this.addSearchHistory(searchCriteria);
                    await TreeViewUtils.expandNode(node, this);
                }
            } else {
                if (isExpanded) {
                    node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                } else {
                    searchCriteria = await this.applySavedFavoritesSearchLabel(node);
                    const jobQueryObj = this.parseJobSearchQuery(searchCriteria);
                    this.applySearchLabelToNode(node, jobQueryObj);
                    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                }
                node.dirty = true;
            }
            this.refresh();
        }
    }

    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent): Promise<void> {
        ZoweLogger.trace("ZosJobsProvider.onDidChangeConfiguration called.");
        if (e.affectsConfiguration(ZosJobsProvider.persistenceSchema)) {
            const setting: any = {
                ...SettingsConfig.getDirectValue(ZosJobsProvider.persistenceSchema),
            };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await SettingsConfig.setDirectValue(ZosJobsProvider.persistenceSchema, setting);
            }
        }
    }

    public deleteSession(node: IZoweJobTreeNode, hideFromAllTrees?: boolean): void {
        ZoweLogger.trace("ZosJobsProvider.deleteSession called.");
        super.deleteSession(node, hideFromAllTrees);
    }

    /**
     * Creates a display string to represent a search
     * @param owner - The owner search item
     * @param prefix - The job prefix search item
     * @param jobid - A specific jobid search item
     */
    public createSearchLabel(owner: string, prefix: string, jobid: string, status: string): string {
        ZoweLogger.trace("ZosJobsProvider.createSearchLabel called.");
        const alphaNumeric = new RegExp("^w+$");
        if (jobid && !alphaNumeric.exec(jobid.trim())) {
            return ZosJobsProvider.JobId + jobid.toUpperCase().trim();
        }
        let revisedCriteria = "";
        if (owner) {
            revisedCriteria = ZosJobsProvider.Owner + owner.trim() + " | ";
        }
        if (prefix) {
            revisedCriteria += ZosJobsProvider.Prefix + prefix.trim() + " | ";
        }
        if (status) {
            revisedCriteria += ZosJobsProvider.Status + status.trim();
        }

        return revisedCriteria.trim();
    }

    public addFileHistory(_criteria: string): void {
        ZoweLogger.trace("ZosJobsProvider.addFileHistory called.");
        throw new Error("Method not implemented.");
    }

    private async setJobStatus(node: IZoweJobTreeNode): Promise<IJobStatusOption> {
        ZoweLogger.trace("ZosJobsProvider.setJobStatus called.");
        const jobStatusSelection = ZoweExplorerApiRegister.getJesApi(node.getProfile()).getJobsByParameters
            ? globals.JOB_STATUS
            : globals.JOB_STATUS_UNSUPPORTED;
        let choice = await Gui.showQuickPick(jobStatusSelection);
        if (!choice) {
            choice = globals.JOB_STATUS.find((status) => status.label === "*");
        }
        return choice;
    }

    private async handleEditingMultiJobParameters(
        jobProperties: IJobPickerOption[],
        node: IZoweJobTreeNode
    ): Promise<IJobSearchCriteria | undefined> {
        ZoweLogger.trace("ZosJobsProvider.handleEditingMultiJobParameters called.");
        const editableItems: vscode.QuickPickItem[] = [
            new FilterItem({ text: ZosJobsProvider.submitJobQueryLabel, show: true }),
            globals.SEPARATORS.BLANK,
        ];
        jobProperties.forEach((prop) => {
            if (prop.key === "owner" && !prop.value) {
                const session = node.getSession();
                prop.value = session?.ISession?.user;
            }
            editableItems.push(new FilterItem({ text: prop.label, description: prop.value, show: prop.show }));
        });
        const choice = await Gui.showQuickPick(editableItems, {
            ignoreFocusOut: true,
            matchOnDescription: false,
        });
        if (!choice) {
            Gui.showMessage(vscode.l10n.t("No selection made. Operation cancelled."));
            return undefined;
        }
        const pattern = choice.label;

        switch (pattern) {
            case ZosJobsProvider.chooseJobStatusLabel:
                jobProperties.find((prop) => prop.key === "job-status").value = (await this.setJobStatus(node)).label;
                break;
            case ZosJobsProvider.submitJobQueryLabel: {
                node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                node.searchId = "";
                node.prefix = jobProperties.find((prop) => prop.key === "prefix").value;
                node.owner = jobProperties.find((prop) => prop.key === "owner").value;
                node.status = jobProperties.find((prop) => prop.key === "job-status").value;
                const searchCriteriaObj: IJobSearchCriteria = {
                    Owner: node.owner,
                    Prefix: node.prefix,
                    JobId: undefined,
                    Status: node.status,
                };

                this.resetJobProperties(jobProperties);
                await TreeViewUtils.expandNode(node, this);
                return searchCriteriaObj;
            }
            default: {
                const property = jobProperties.find((prop) => prop.label === pattern);
                if (property != null) {
                    const options: vscode.InputBoxOptions = {
                        value: property.value,
                        placeHolder: property.placeHolder,
                        validateInput: property.validateInput,
                    };
                    property.value = await Gui.showInputBox(options);
                }
            }
        }
        return this.handleEditingMultiJobParameters(jobProperties, node);
    }
    private resetJobProperties(jobProperties: IJobPickerOption[]): IJobPickerOption[] {
        ZoweLogger.trace("ZosJobsProvider.resetJobProperties called.");
        jobProperties.forEach((prop) => {
            if (prop.key === "owner") {
                prop.value = "";
            }
            if (prop.key === "prefix") {
                prop.value = "*";
            }
            if (prop.key === "job-status") {
                prop.value = "*";
            }
        });
        return jobProperties;
    }

    /**
     * Function that takes a search criteria and updates a search node based upon it
     * @param node - a IZoweJobTreeNode node
     * @param storedSearch - The original search string
     */
    private applySearchLabelToNode(node: IZoweJobTreeNode, storedSearchObj: IJobSearchCriteria): void {
        ZoweLogger.trace("ZosJobsProvider.applySearchLabelToNode called.");
        if (storedSearchObj) {
            node.searchId = storedSearchObj.JobId || "";
            node.owner = storedSearchObj.Owner || "*";
            node.prefix = storedSearchObj.Prefix || "*";
            node.status = storedSearchObj.Status || "*";
        }
    }

    private relabelFavoritedJob(node: IZoweJobTreeNode): IZoweJobTreeNode {
        ZoweLogger.trace("ZosJobsProvider.relabelFavoritedJob called.");
        node.label = node.label.toString().substring(0, node.label.toString().lastIndexOf(")") + 1);
        return node;
    }

    /**
     * Given user-provided input, determine whether the input is a valid polling interval.
     * @param value The polling interval provided by the user
     * @returns undefined if valid; otherwise, a description string that explains what a valid polling interval is.
     */
    private validatePollInterval(value: string): string {
        const valueAsNum = Number(value);
        if (!isNaN(valueAsNum) && valueAsNum >= globals.MS_PER_SEC) {
            return undefined;
        }

        return vscode.l10n.t("The polling interval must be greater than or equal to 1000ms.");
    }

    /**
     * Show poll options for the spool file matching the provided URI, before the user starts polling.
     * @returns true if the user started polling, false if they dismiss the dialog
     */
    private async showPollOptions(uri: vscode.Uri): Promise<number> {
        const pollValue = SettingsConfig.getDirectValue<number>("zowe.jobs.pollInterval");
        const intervalInput = await Gui.showInputBox({
            title: vscode.l10n.t({
                message: "Poll interval (in ms) for: {0}",
                args: [path.posix.basename(uri.path)],
                comment: ["URI path"],
            }),
            value: pollValue.toString(),
            validateInput: (value: string) => this.validatePollInterval(value),
        });

        return intervalInput ? Number(intervalInput) : 0;
    }

    /**
     * Poll the provided spool file, given a user-provided polling interval.
     * @param node The node to start/stop polling
     */
    public async pollData(node: IZoweJobTreeNode): Promise<void> {
        if (!contextually.isSpoolFile(node)) {
            return;
        }

        // If the uri is already being polled, mark it as ready for removal
        if (node.resourceUri.path in Poller.pollRequests && contextually.isPolling(node)) {
            Poller.pollRequests[node.resourceUri.path].dispose = true;
            PollDecorator.updateIcon(node.resourceUri);
            node.contextValue = node.contextValue.replace(globals.POLL_CONTEXT, "");

            // Fire "tree changed event" to reflect removal of polling context value
            this.mOnDidChangeTreeData.fire(node);
            return;
        }

        // Always prompt the user for a poll interval
        const pollInterval = await this.showPollOptions(node.resourceUri);

        if (pollInterval === 0) {
            Gui.showMessage(
                vscode.l10n.t({
                    message: "Polling dismissed for {0}; operation cancelled.",
                    args: [node.resourceUri.path],
                    comment: ["Encoded URI path"],
                })
            );
            return;
        }

        // Pass request function to the poller for continuous updates
        Poller.addRequest(node.resourceUri.path, {
            msInterval: pollInterval,
            request: async () => {
                const statusMsg = Gui.setStatusBarMessage(
                    vscode.l10n.t({
                        message: `$(sync~spin) Polling: {0}...`,
                        args: [path.posix.basename(node.resourceUri.path)],
                        comment: ["Unique Spool name"],
                    }),
                    globals.STATUS_BAR_TIMEOUT_MS
                );
                await JobFSProvider.instance.fetchSpoolAtUri(node.resourceUri);
                statusMsg.dispose();
            },
        });
        PollDecorator.updateIcon(node.resourceUri);
        node.contextValue += globals.POLL_CONTEXT;

        // Fire "tree changed event" to reflect added polling context value
        this.refreshElement(node);
    }

    public sortBy(session: IZoweJobTreeNode): void {
        if (session.children != null) {
            session.children.sort(ZoweJobNode.sortJobs(session.sort));
            this.nodeDataChanged(session);
        }
    }

    /**
     * Updates or resets the filter for a given job.
     * @param job The job whose filter should be updated/reset
     * @param newFilter Either a valid `JobFilter` object, or `null` to reset the filter
     * @param isSession Whether the node is a session
     */
    public updateFilterForJob(job: IZoweJobTreeNode, newFilter: string | null): void {
        job.filter = newFilter;
        job.description = newFilter
            ? vscode.l10n.t({
                  message: "Filter: {0}",
                  args: [newFilter],
                  comment: ["The new filter"],
              })
            : null;
        this.nodeDataChanged(job);
        if (newFilter === null) {
            job["children"] = job["actualJobs"];
            TreeProviders.job.refresh();
        }
    }

    public async filterJobsDialog(job: IZoweJobTreeNode): Promise<vscode.InputBox> {
        if (job.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
            Gui.infoMessage(vscode.l10n.t("Use the search button to display jobs"));
            return;
        }
        const selection = await Gui.showQuickPick(JOB_FILTER_OPTS, {
            placeHolder: vscode.l10n.t("Set a filter..."),
        });
        const filterMethod = JOB_FILTER_OPTS.indexOf(selection);

        const userDismissed = filterMethod < 0;
        const clearFilterOpt = vscode.l10n.t("$(clear-all) Clear filter for profile");
        if (userDismissed || selection === clearFilterOpt) {
            if (selection === clearFilterOpt) {
                this.updateFilterForJob(job, null);
                Gui.setStatusBarMessage(
                    vscode.l10n.t({
                        message: "$(check) Filter cleared for {0}",
                        args: [job.label as string],
                        comment: ["Job label"],
                    }),
                    globals.MS_PER_SEC * 4
                );
            }
            return;
        }
        if (!("filter" in job) && !("actualJobs" in job)) {
            job.actualJobs = job["children"];
        }
        this.nodeDataChanged(job);

        job.description = "";
        const actual_jobs: IZoweJobTreeNode[] = job["actualJobs"];
        const inputBox = await vscode.window.createInputBox();
        inputBox.placeholder = vscode.l10n.t("Enter local filter...");
        inputBox.onDidChangeValue((query) => {
            query = query.toUpperCase();
            job["children"] = actual_jobs.filter((item) =>
                item["job"]["exec-member"]
                    ? `${item["job"].jobname}(${item["job"].jobid}) - ${item["job"]["exec-member"] as string} - ${item["job"].retcode}`.includes(
                          query
                      )
                    : `${item["job"].jobname}(${item["job"].jobid}) - ${item["job"].retcode}`.includes(query)
            );
            TreeProviders.job.refresh();
            this.updateFilterForJob(job, query);
            Gui.setStatusBarMessage(
                vscode.l10n.t({
                    message: "$(check) Filter updated for {0}",
                    args: [job.label as string],
                    comment: ["Job label"],
                }),
                globals.MS_PER_SEC * 4
            );
        });
        job.children = actual_jobs;
        this.nodeDataChanged(job);
        inputBox.onDidAccept(() => {
            inputBox.hide();
        });
        inputBox.show();
        return inputBox;
    }

    /**
     * Event listener to mark a job doc URI as null in the openFiles record
     * @param this (resolves ESlint warning about unbound methods)
     * @param doc A doc URI that was closed
     */
    public static onDidCloseTextDocument(this: void, doc: vscode.TextDocument): void {
        if (doc.uri.scheme === "zosspool") {
            updateOpenFiles(TreeProviders.job, doc.uri.path, null);
        }
    }
}

/**
 * Helper class to allow generation of job details by history or favorite
 */
class JobDetail implements IJob {
    public jobid: string;
    public jobname: string;
    public subsystem: string;
    public owner: string;
    public status: string;
    public type: string;
    public class: string;
    public retcode: string;
    public url: string;
    public "files-url": string;
    public "job-correlator": string;
    public phase: number;
    public "phase-name": string;
    public "reason-not-running"?: string;

    public constructor(combined: string) {
        this.jobname = combined.substring(0, combined.indexOf("("));
        this.jobid = combined.substring(combined.indexOf("(") + 1, combined.indexOf(")"));
    }
}
