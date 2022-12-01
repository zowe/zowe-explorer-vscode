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
import * as jobUtils from "../job/utils";
import * as globals from "../globals";
import { IJob, imperative } from "@zowe/cli";
import {
    ValidProfileEnum,
    IZoweTree,
    IZoweJobTreeNode,
    PersistenceSchemaEnum,
    ZoweVsCodeExtension,
} from "@zowe/zowe-explorer-api";
import { FilterItem, errorHandling } from "../utils/ProfilesUtils";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Job } from "./ZoweJobNode";
import { getAppName, sortTreeItems, labelRefresh } from "../shared/utils";
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
}

/**
 * Creates the Job tree that contains nodes of sessions, jobs and spool items
 *
 * @export
 * @class ZosJobsProvider
 * @implements {vscode.TreeDataProvider}
 */
export async function createJobsTree(log: imperative.Logger) {
    const tree = new ZosJobsProvider();
    await tree.initializeJobsTree(log);
    await tree.addSession();
    return tree;
}

// tslint:disable-next-line: max-classes-per-file
export class ZosJobsProvider extends ZoweTreeProvider implements IZoweTree<IZoweJobTreeNode> {
    public static readonly JobId = "JobId:";
    public static readonly Owner = "Owner:";
    public static readonly Prefix = "Prefix:";
    public static readonly Status = "Status";
    public static readonly defaultDialogText: string = localize("SpecifyCriteria", "Create new..");
    private static readonly persistenceSchema: PersistenceSchemaEnum = PersistenceSchemaEnum.Job;

    public mSessionNodes: IZoweJobTreeNode[] = [];
    public mFavorites: IZoweJobTreeNode[] = [];
    public searchByQuery = new FilterItem({
        text: globals.plusSign + localize("zosJobsProvider.option.prompt.createId", "Create job search filter"),
        menuType: globals.JobPickerTypes.QuerySearch,
    });
    public searchById = new FilterItem({
        text: globals.plusSign + localize("zosJobsProvider.option.prompt.createOwner", "Job id search"),
        menuType: globals.JobPickerTypes.IdSearch,
    });
    private treeView: vscode.TreeView<IZoweJobTreeNode>;

    constructor() {
        super(
            ZosJobsProvider.persistenceSchema,
            new Job(
                localize("Favorites", "Favorites"),
                vscode.TreeItemCollapsibleState.Collapsed,
                null,
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
        this.mSessionNodes = [this.mFavoriteSession];
        this.treeView = vscode.window.createTreeView("zowe.jobs.explorer", {
            treeDataProvider: this,
            canSelectMany: true,
        });
    }

    public rename(node: IZoweJobTreeNode) {
        throw new Error("Method not implemented.");
    }
    public open(node: IZoweJobTreeNode, preview: boolean) {
        throw new Error("Method not implemented.");
    }
    public copy(node: IZoweJobTreeNode) {
        throw new Error("Method not implemented.");
    }
    public paste(node: IZoweJobTreeNode) {
        throw new Error("Method not implemented.");
    }

    /**
     * Adds a save search to the Jobs favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public saveSearch(node: IZoweJobTreeNode) {
        node.contextValue = contextually.asFavorite(node);
        return node;
    }
    public saveFile(document: vscode.TextDocument) {
        throw new Error("Method not implemented.");
    }
    public refreshPS(node: IZoweJobTreeNode) {
        throw new Error("Method not implemented.");
    }
    public uploadDialog(node: IZoweJobTreeNode) {
        throw new Error("Method not implemented.");
    }
    public filterPrompt(node: IZoweJobTreeNode) {
        return this.searchPrompt(node);
    }

    /**
     * Takes argument of type IZoweJobTreeNode and retrieves all of the first level children
     *
     * @param {IZoweJobTreeNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {IZoweJobTreeNode[] | Promise<IZoweJobTreeNode[]>}
     */
    public async getChildren(element?: IZoweJobTreeNode | undefined): Promise<IZoweJobTreeNode[]> {
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
     * @returns {vscode.TreeView<Job>}
     */
    public getTreeView(): vscode.TreeView<IZoweJobTreeNode> {
        return this.treeView;
    }

    /**
     * Adds a session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     * @param {string} [profileType] - optional; loads profiles of a certain type if passed
     */
    public async addSession(sessionName?: string, profileType?: string) {
        const setting = PersistentFilters.getDirectValue(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION) as boolean;
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const theProfile: imperative.IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (theProfile) {
                await this.addSingleSession(theProfile);
            }
            for (const node of this.mSessionNodes) {
                const name = node.getProfileName();
                if (name === theProfile.name) {
                    await resetValidationSettings(node, setting);
                }
            }
        } else {
            const allProfiles: imperative.IProfileLoaded[] = await Profiles.getInstance().fetchAllProfiles();
            if (allProfiles) {
                for (const sessionProfile of allProfiles) {
                    // If session is already added, do nothing
                    if (this.mSessionNodes.find((tempNode) => tempNode.label.toString() === sessionProfile.name)) {
                        continue;
                    }
                    for (const session of this.mHistory.getSessions()) {
                        if (session === sessionProfile.name) {
                            await this.addSingleSession(sessionProfile);
                            for (const node of this.mSessionNodes) {
                                const name = node.getProfileName();
                                if (name === sessionProfile.name) {
                                    await resetValidationSettings(node, setting);
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
                    this.log.warn(error);
                }
            }
        }
        this.refresh();
    }

    public async delete(node: IZoweJobTreeNode) {
        try {
            await ZoweExplorerApiRegister.getJesApi(node.getProfile()).deleteJob(node.job.jobname, node.job.jobid);
            await this.removeFavorite(this.createJobsFavorite(node));
        } catch (error) {
            await errorHandling(error, node.getProfileName(), error.message);
        }
    }

    /**
     * Find profile node that matches specified profile name in a tree nodes array (e.g. this.mFavorites or this.mSessionNodes).
     * @param jobsProvider - The array of tree nodes to search through (e.g. this.mFavorites)
     * @param profileName - The name of the profile you are looking for
     * @returns {IZoweJobTreeNode | undefined} Returns matching profile node if found. Otherwise, returns undefined.
     */
    public findMatchingProfileInArray(
        jobsProvider: IZoweJobTreeNode[],
        profileName: string
    ): IZoweJobTreeNode | undefined {
        return jobsProvider.find((treeNode) => treeNode.label === profileName);
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {Job}
     */
    public createProfileNodeForFavs(profileName: string): Job {
        const favProfileNode = new Job(
            profileName,
            vscode.TreeItemCollapsibleState.Collapsed,
            this.mFavoriteSession,
            null,
            null,
            null
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
     * Initialize the favorites and history information
     * @param log - Logger
     */
    public async initializeJobsTree(log: imperative.Logger) {
        this.log = log;
        this.log.debug(localize("initializeJobsTree.log.debug", "Initializing profiles with jobs favorites."));
        const lines: string[] = this.mHistory.readFavorites();
        if (lines.length === 0) {
            this.log.debug(localize("initializeJobsTree.no.favorites", "No jobs favorites found."));
            return;
        }
        // Parse line
        lines.forEach(async (line) => {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const favLabel = line.substring(line.indexOf(":") + 1, line.indexOf("{")).trim();
            const favContextValue = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
            // The profile node used for grouping respective favorited items. (Undefined if not created yet.)
            let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
            if (profileNodeInFavorites === undefined) {
                // If favorite node for profile doesn't exist yet, create a new one for it
                profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
            }
            // Initialize and attach favorited item nodes under their respective profile node in Favorrites
            const favChildNodeForProfile = await this.initializeFavChildNodeForProfile(
                favLabel,
                favContextValue,
                profileNodeInFavorites
            );
            profileNodeInFavorites.children.push(favChildNodeForProfile);
        });
    }

    /**
     * Creates an individual favorites node WITHOUT profiles or sessions, to be added to the specified profile node in Favorites during activation.
     * This allows label and contextValue to be passed into these child nodes.
     * @param label The favorited data set's label
     * @param contextValue The favorited data set's context value
     * @param parentNode The profile node in this.mFavorites that the favorite belongs to
     * @returns IZoweJobTreeNode
     */
    public async initializeFavChildNodeForProfile(label: string, contextValue: string, parentNode: IZoweJobTreeNode) {
        let favJob: Job;
        if (contextValue.startsWith(globals.JOBS_JOB_CONTEXT)) {
            favJob = new Job(
                label,
                vscode.TreeItemCollapsibleState.Collapsed,
                parentNode,
                null,
                new JobDetail(label),
                null
            );
            favJob.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
            favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
        } else {
            // for search
            favJob = new Job(label, vscode.TreeItemCollapsibleState.None, parentNode, null, null, null);
            favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
            favJob.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
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
    public async loadProfilesForFavorites(log: imperative.Logger, parentNode: IZoweJobTreeNode) {
        const profileName = parentNode.label as string;
        const updatedFavsForProfile: IZoweJobTreeNode[] = [];
        let profile: imperative.IProfileLoaded;
        let session: imperative.Session;
        this.log = log;
        this.log.debug(
            localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for jobs favorites", profileName)
        );
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                await Profiles.getInstance().checkCurrentProfile(profile);
                if (
                    Profiles.getInstance().validProfile === ValidProfileEnum.VALID ||
                    !contextually.isValidationEnabled(parentNode)
                ) {
                    session = ZoweExplorerApiRegister.getJesApi(profile).getSession();
                    parentNode.setProfileToChoice(profile);
                    parentNode.setSessionToChoice(session);
                    parentNode.owner = session.ISession.user;
                } else {
                    return [
                        new Job(
                            localize("loadProfilesForFavorites.authFailed", "You must authenticate to view favorites."),
                            vscode.TreeItemCollapsibleState.None,
                            parentNode,
                            null,
                            null,
                            null
                        ),
                    ];
                }
            } catch (error) {
                const errMessage: string =
                    localize(
                        "initializeJobsFavorites.error.profile1",
                        "Error: You have Zowe Job favorites that refer to a non-existent CLI profile named: {0}",
                        profileName
                    ) +
                    localize(
                        "initializeJobsFavorites.error.profile2",
                        ". To resolve this, you can remove {0}",
                        profileName
                    ) +
                    localize(
                        "initializeJobsFavorites.error.profile3",
                        " from the Favorites section of Zowe Explorer's Jobs view. Would you like to do this now? ",
                        getAppName(globals.ISTHEIA)
                    );
                const btnLabelRemove = localize("initializeJobsFavorites.error.buttonRemove", "Remove");
                vscode.window.showErrorMessage(errMessage, { modal: true }, btnLabelRemove).then(async (selection) => {
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
    public async addFavorite(node: IZoweJobTreeNode) {
        let favJob: Job;
        // Get node's profile node in favorites
        const profileName = node.getProfileName();
        let profileNodeInFavorites = this.findMatchingProfileInArray(this.mFavorites, profileName);
        if (profileNodeInFavorites === undefined) {
            // If favorite node for profile doesn't exist yet, create a new one for it
            profileNodeInFavorites = this.createProfileNodeForFavs(profileName);
        }
        if (contextually.isSession(node)) {
            // Favorite a search/session
            favJob = new Job(
                this.createSearchLabel(node.owner, node.prefix, node.searchId, node.status),
                vscode.TreeItemCollapsibleState.None,
                profileNodeInFavorites,
                node.getSession(),
                node.job,
                node.getProfile()
            );
            favJob.contextValue = node.contextValue;
            favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
            this.saveSearch(favJob);
        } else {
            // Favorite a job
            favJob = new Job(
                node.label as string,
                vscode.TreeItemCollapsibleState.Collapsed,
                profileNodeInFavorites,
                node.getSession(),
                node.job,
                node.getProfile()
            );
            favJob.contextValue = node.contextValue;
            favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
            this.createJobsFavorite(favJob);
        }
        const icon = getIconByNode(favJob);
        if (icon) {
            favJob.iconPath = icon.path;
        }
        if (!profileNodeInFavorites.children.find((tempNode) => tempNode.label === favJob.label)) {
            profileNodeInFavorites.children.push(favJob);
            sortTreeItems(profileNodeInFavorites.children, globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX);
            sortTreeItems(this.mFavorites, globals.FAV_PROFILE_CONTEXT);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public async removeFavorite(node: IZoweJobTreeNode) {
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
                await this.updateFavorites();
                this.refreshElement(this.mFavoriteSession);
            }
        }
        return;
    }

    public async updateFavorites() {
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry =
                    "[" +
                    profileNode.label.toString() +
                    "]: " +
                    fav.label +
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
    public async removeFavProfile(profileName: string, userSelected: boolean) {
        // If user selected the "Remove profile from Favorites option", confirm they are okay with deleting all favorited items for that profile.
        let cancelled = false;
        if (userSelected) {
            const checkConfirmation = localize(
                "removeFavProfile.confirm",
                "This will remove all favorited Jobs items for profile {0}. Continue?",
                profileName
            );
            const continueRemove = localize("removeFavProfile.continue", "Continue");
            await vscode.window
                .showWarningMessage(checkConfirmation, { modal: true }, ...[continueRemove])
                .then((selection) => {
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
        return;
    }

    public async getUserJobsMenuChoice(): Promise<FilterItem | undefined> {
        const items: FilterItem[] = this.mHistory
            .getSearchHistory()
            .map((element) => new FilterItem({ text: element, menuType: globals.JobPickerTypes.History }));
        if (globals.ISTHEIA) {
            // Theia doesn't work properly when directly creating a QuickPick
            const selectFilter: vscode.QuickPickOptions = {
                placeHolder: localize("searchHistory.options.prompt", "Select a filter"),
            };
            // get user selection
            const choice = await vscode.window.showQuickPick(
                [this.searchByQuery, this.searchById, ...items],
                selectFilter
            );
            if (!choice) {
                vscode.window.showInformationMessage(
                    localize("enterPattern.pattern", "No selection made. Operation cancelled.")
                );
                return undefined;
            }
            return choice;
        } else {
            // VSCode route to create a QuickPick
            const quickpick = vscode.window.createQuickPick();
            quickpick.items = [this.searchByQuery, this.searchById, ...items];
            quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await jobUtils.resolveQuickPickHelper(quickpick);
            quickpick.hide();
            if (!choice) {
                vscode.window.showInformationMessage(
                    localize("enterPattern.pattern", "No selection made. Operation cancelled.")
                );
                return undefined;
            }
            return choice;
        }
    }

    public async getUserSearchQueryInput(
        choice: FilterItem,
        node: IZoweJobTreeNode
    ): Promise<IJobSearchCriteria | undefined> {
        if (!choice) {
            return undefined;
        }
        const { menuType } = choice.filterItem;
        const { QuerySearch, History, IdSearch } = globals.JobPickerTypes;

        if (menuType === QuerySearch) {
            return this.handleEditingMultiJobParameters(globals.JOB_PROPERTIES, node);
        }
        if (menuType === IdSearch) {
            return this.handleSearchByJobId();
        }

        if (menuType === History) {
            const parsedHistory = this.parseJobSearchQuery(choice.label);
            if (parsedHistory.JobId) {
                return this.handleSearchByJobId(parsedHistory.JobId);
            } else {
                const quickPickFilledItems = this.getSearchQueryOptions(parsedHistory);
                return this.handleEditingMultiJobParameters(quickPickFilledItems, node);
            }
        }
    }

    public async applyRegularSessionSearchLabel(node: IZoweJobTreeNode): Promise<string | undefined> {
        let searchCriteria;
        const choice = await this.getUserJobsMenuChoice();
        const searchCriteriaObj = await this.getUserSearchQueryInput(choice, node);

        if (!searchCriteriaObj) {
            return undefined;
        }
        if (globals.ISTHEIA) {
            searchCriteria = choice === this.searchByQuery || choice === this.searchById ? "" : choice.label;
        } else {
            searchCriteria = this.createSearchLabel(
                searchCriteriaObj.Owner,
                searchCriteriaObj.Prefix,
                searchCriteriaObj.JobId,
                searchCriteriaObj.Status
            );
        }
        this.applySearchLabelToNode(node, searchCriteriaObj);
        return searchCriteria;
    }

    public async handleSearchByJobId(jobId?: string): Promise<IJobSearchCriteria> {
        const options = {
            prompt: localize("jobsFilterPrompt.inputBox.prompt.jobid", "Enter a Job id"),
            value: jobId,
        };
        const newUserJobId = await ZoweVsCodeExtension.inputBox(options);
        if (!newUserJobId) {
            vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
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
        const searchOptionArray = searchCriteria.split(" ");
        searchOptionArray.forEach((searchOption) => {
            const keyValue = searchOption.split(":");
            const key = keyValue[0]?.trim();
            const value = keyValue[1]?.trim();
            try {
                searchCriteriaObj[key] = value;
            } catch (e) {}
        });
        return searchCriteriaObj;
    }

    public getSearchQueryOptions(searchObj: IJobSearchCriteria): IJobPickerOption[] {
        const historyPopulatedItems = globals.JOB_PROPERTIES;
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
        // executing search from saved search in favorites
        const searchCriteria = node.label as string;
        const session = node.getProfileName();
        const faveNode = node;
        await this.addSession(session);
        node = this.mSessionNodes.find((tempNode) => tempNode.label.toString() === session);
        if (!node.getSession().ISession.user || !node.getSession().ISession.password) {
            node.getSession().ISession.user = faveNode.getSession().ISession.user;
            node.getSession().ISession.password = faveNode.getSession().ISession.password;
            node.getSession().ISession.base64EncodedAuth = faveNode.getSession().ISession.base64EncodedAuth;
        }
        const jobQueryObj = this.parseJobSearchQuery(searchCriteria);
        this.applySearchLabelToNode(node, jobQueryObj);
        return searchCriteria;
    }

    /**
     * Prompts the user for search details to populate the [TreeView]{@link vscode.TreeView}
     *
     * @param {IZoweJobTreeNode} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: IZoweJobTreeNode) {
        await this.checkCurrentProfile(node);
        let searchCriteria: string = "";
        if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || !contextually.isValidationEnabled(node)) {
            if (contextually.isSessionNotFav(node)) {
                searchCriteria = await this.applyRegularSessionSearchLabel(node);
            } else {
                searchCriteria = await this.applySavedFavoritesSearchLabel(node);
            }
            if (!searchCriteria) {
                return undefined;
            }
            node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            labelRefresh(node);
            node.dirty = true;
            this.refreshElement(node);
            this.addSearchHistory(searchCriteria);
        }
    }

    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        if (e.affectsConfiguration(ZosJobsProvider.persistenceSchema)) {
            const setting: any = { ...vscode.workspace.getConfiguration().get(ZosJobsProvider.persistenceSchema) };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace
                    .getConfiguration()
                    .update(ZosJobsProvider.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public deleteSession(node: IZoweJobTreeNode) {
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label !== node.label);
        this.deleteSessionByLabel(node.getLabel() as string);
    }

    /**
     * Creates a display string to represent a search
     * @param owner - The owner search item
     * @param prefix - The job prefix search item
     * @param jobid - A specific jobid search item
     */
    public createSearchLabel(owner: string, prefix: string, jobid: string, status: string): string {
        const alphaNumeric = new RegExp("^w+$");
        if (jobid && !alphaNumeric.exec(jobid.trim())) {
            return Job.JobId + jobid.toUpperCase().trim();
        }
        let revisedCriteria = "";
        if (owner) {
            revisedCriteria = Job.Owner + owner.trim() + " ";
        }
        if (prefix) {
            revisedCriteria += Job.Prefix + prefix.trim() + " ";
        }
        if (status) {
            revisedCriteria += Job.Status + status.trim();
        }
        return revisedCriteria.trim();
    }

    public async addFileHistory(criteria: string) {
        throw new Error("Method not implemented.");
    }

    private async setJobStatus(node: IZoweJobTreeNode): Promise<IJobStatusOption> {
        const apiExists = ZoweExplorerApiRegister.getJesApi(node.getProfile()).getJobsByParameters;
        const jobStatusSelection = apiExists ? globals.JOB_STATUS : globals.JOB_STATUS_UNSUPPORTED;
        let choice = await vscode.window.showQuickPick(jobStatusSelection);
        if (!choice) {
            choice = globals.JOB_STATUS.find((status) => status.label === "*");
        }
        return choice;
    }

    private async handleEditingMultiJobParameters(jobProperties: IJobPickerOption[], node: IZoweJobTreeNode) {
        const editableItems = [];
        editableItems.push(new FilterItem({ text: ` + Submit this Job Search Query`, show: true }));
        jobProperties.forEach((prop) => {
            if (prop.key === "owner" && !prop.value) {
                const session = node.getSession();
                prop.value = session?.ISession?.user;
            }
            editableItems.push(new FilterItem({ text: prop.label, description: prop.value, show: prop.show }));
        });
        const choice = await vscode.window.showQuickPick(editableItems, {
            ignoreFocusOut: true,
            matchOnDescription: false,
        });
        if (!choice) {
            vscode.window.showInformationMessage(
                localize("enterPattern.pattern", "No selection made. Operation cancelled.")
            );
            return;
        }
        const pattern = choice.label;
        switch (pattern) {
            case "Job Status":
                const statusChoice = await this.setJobStatus(node);
                jobProperties.find((prop) => prop.key === "job-status").value = statusChoice.label;
                break;
            case " + Submit this Job Search Query":
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
                return Promise.resolve(searchCriteriaObj);
            default:
                const options: vscode.InputBoxOptions = {
                    value: jobProperties.find((prop) => prop.label === pattern).value,
                    placeHolder: jobProperties.find((prop) => prop.label === pattern).placeHolder,
                };
                jobProperties.find((prop) => prop.label === pattern).value = await ZoweVsCodeExtension.inputBox(
                    options
                );
        }
        return Promise.resolve(this.handleEditingMultiJobParameters(jobProperties, node));
    }

    /**
     * Function that takes a search criteria and updates a search node based upon it
     * @param node - a IZoweJobTreeNode node
     * @param storedSearch - The original search string
     */
    private applySearchLabelToNode(node: IZoweJobTreeNode, storedSearchObj: IJobSearchCriteria) {
        if (storedSearchObj) {
            node.searchId = storedSearchObj.JobId || "";
            node.owner = storedSearchObj.Owner || "*";
            node.prefix = storedSearchObj.Prefix || "*";
            node.status = storedSearchObj.Status || "*";
        }
    }

    private createJobsFavorite(node: IZoweJobTreeNode) {
        node.label = node.label.toString().substring(0, node.label.toString().lastIndexOf(")") + 1);
        node.contextValue = contextually.asFavorite(node);
        return node;
    }

    /**
     * Adds a single session to the jobs tree
     *
     */
    private async addSingleSession(profile: imperative.IProfileLoaded) {
        if (profile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tNode) => tNode.label.toString() === profile.name)) {
                return;
            }
            // Uses loaded profile to create a zosmf session with Zowe
            let session: imperative.Session;
            try {
                session = await ZoweExplorerApiRegister.getJesApi(profile).getSession();
            } catch (err) {
                if (err.toString().includes("hostname")) {
                    this.log.error(err);
                } else {
                    await errorHandling(err, profile.name);
                }
            }
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(profile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, profile);
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
}

/**
 * Helper class to allow generation of job details by history or favorite
 */
// tslint:disable-next-line: max-classes-per-file
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

    constructor(combined: string) {
        this.jobname = combined.substring(0, combined.indexOf("("));
        this.jobid = combined.substring(combined.indexOf("(") + 1, combined.indexOf(")"));
    }
}
