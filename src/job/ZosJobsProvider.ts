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
import { IJob } from "@zowe/cli";
import { IProfileLoaded, Logger, Session } from "@zowe/imperative";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { Job } from "./ZoweJobNode";
import { getAppName, sortTreeItems, labelRefresh } from "../shared/utils";
import { FilterItem, FilterDescriptor, resolveQuickPickHelper, errorHandling } from "../utils";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweJobTreeNode } from "../api/IZoweTreeNode";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { getIconById, getIconByNode, IconId } from "../generators/icons";
import * as contextually from "../shared/context";
import * as nls from "vscode-nls";
import { DefaultProfileManager } from "../profiles/DefaultProfileManager";
import { PersistentFilters } from "../PersistentFilters";
import { resetValidationSettings } from "../shared/actions";
// import { getValidSession } from "../profiles/utils";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Creates the Job tree that contains nodes of sessions, jobs and spool items
 *
 * @export
 * @class ZosJobsProvider
 * @implements {vscode.TreeDataProvider}
 */
export async function createJobsTree(log: Logger) {
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
    public static readonly defaultDialogText: string = localize("SpecifyCriteria", "Create new..");
    private static readonly persistenceSchema: globals.PersistenceSchemaEnum = globals.PersistenceSchemaEnum.Job;

    public mSessionNodes: IZoweJobTreeNode[] = [];
    public mFavorites: IZoweJobTreeNode[] = [];
    public createOwner = new jobUtils.OwnerFilterDescriptor();
    public createId = new jobUtils.JobIdFilterDescriptor();
    private treeView: vscode.TreeView<IZoweJobTreeNode>;

    constructor() {
        super(ZosJobsProvider.persistenceSchema,
            new Job(localize("Favorites", "Favorites"), vscode.TreeItemCollapsibleState.Collapsed, null, null, null, null));
        this.mFavoriteSession.contextValue = globals.FAVORITE_CONTEXT;
        const icon = getIconByNode(this.mFavoriteSession);
        if (icon) {
            this.mFavoriteSession.iconPath = icon.path;
        }
        this.mSessionNodes = [this.mFavoriteSession];
        this.treeView = vscode.window.createTreeView("zowe.jobs", {treeDataProvider: this});
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
            if (element.contextValue && element.contextValue === globals.FAV_PROFILE_CONTEXT){
                const favsForProfile = this.loadProfilesForFavorites(this.log, element);
                return favsForProfile;
            }
            const newSession = await this.checkCurrentProfile(element, false);
            if (newSession) {
                try {
                    return element.getChildren();
                } catch (err) {
                    vscode.window.showErrorMessage(err.message);
                }
            }
            // If there was some error, no children should be returned
            return [];
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
     */
    public async addSession(sessionName?: string, profileType?: string) {
        const setting = PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const theProfile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (theProfile) {
                await this.addSingleSession(theProfile);
            }
            for (const node of this.mSessionNodes) {
                const name = node.getProfileName();
                if (name === theProfile.name){
                    resetValidationSettings(node, setting);
                }
             }
        } else {
            const allProfiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const sessionProfile of allProfiles) {
                // If session is already added, do nothing
                if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === sessionProfile.name)) {
                    continue;
                }
                for (const session of this.mHistory.getSessions()) {
                    if (session === sessionProfile.name) {
                        await this.addSingleSession(sessionProfile);
                        for (const node of this.mSessionNodes) {
                            const name = node.getProfileName();
                            if (name === sessionProfile.name){
                                resetValidationSettings(node, setting);
                            }
                        }
                    }
                }
            }
            if (this.mSessionNodes.length === 1) {
                await this.addSingleSession(DefaultProfileManager.getInstance().getDefaultProfile(profileType));
            }
        }
        this.refresh();
    }

    public async delete(node: IZoweJobTreeNode) {
        try {
            await ZoweExplorerApiRegister.getJesApi(node.getProfile()).deleteJob(node.job.jobname, node.job.jobid);
            vscode.window.showInformationMessage(localize("deleteJob.job", "Job ") + node.job.jobname + "(" + node.job.jobid + ")" +
                localize("deleteJob.delete", " deleted"));
            this.removeFavorite(this.createJobsFavorite(node));
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
    public findMatchingProfileInArray(jobsProvider: IZoweJobTreeNode[], profileName: string): IZoweJobTreeNode|undefined {
        return jobsProvider.find((treeNode) => treeNode.label.trim() === profileName );
    }

    /**
     * Creates and returns new profile node, and pushes it to mFavorites
     * @param profileName Name of profile
     * @returns {Job}
     */
    public createProfileNodeForFavs(profileName: string): Job {
        const favProfileNode = new Job(profileName, vscode.TreeItemCollapsibleState.Collapsed,
            this.mFavoriteSession, null, null, null);
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
    public async initializeJobsTree(log: Logger) {
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
            const favLabel = (line.substring(line.indexOf(":") + 1, line.indexOf("{"))).trim();
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
    public async initializeFavChildNodeForProfile(label: string, contextValue: string, parentNode: IZoweJobTreeNode){
        let favJob: Job;
        if (contextValue.startsWith(globals.JOBS_JOB_CONTEXT)){
            favJob = new Job(label, vscode.TreeItemCollapsibleState.Collapsed,
                parentNode, null, new JobDetail(label), null);
            favJob.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
            favJob.command = {command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob]};
        } else { // for search
            favJob = new Job(label, vscode.TreeItemCollapsibleState.None,
                parentNode, null, null, null);
            favJob.command = {command: "zowe.jobs.search", title: "", arguments: [favJob]};
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
    public async loadProfilesForFavorites(log: Logger, parentNode: IZoweJobTreeNode ) {
        const profileName = parentNode.label.trim();
        const updatedFavsForProfile: IZoweJobTreeNode[] = [];
        let profile: IProfileLoaded;
        let session: Session;
        this.log = log;
        this.log.debug(localize("loadProfilesForFavorites.log.debug", "Loading profile: {0} for jobs favorites", profileName));
        // Load profile for parent profile node in this.mFavorites array
        if (!parentNode.getProfile() || !parentNode.getSession()) {
            try {
                profile = Profiles.getInstance().loadNamedProfile(profileName);
                session = await ZoweExplorerApiRegister.getJesApi(profile).getSession();
                parentNode.setProfileToChoice(profile);
                parentNode.setSessionToChoice(session);
                parentNode.owner = session.ISession.user;
            } catch(error) {
                const errMessage: string =
                localize("initializeJobsFavorites.error.profile1",
                    "Error: You have Jobs favorites that refer to a non-existent CLI profile named: ") + profileName +
                localize("initializeJobsFavorites.error.profile2",
                    ". To resolve this, you can create a profile with this name, ") +
                localize("initializeJobsFavorites.error.profile3",
                    "or remove the favorites with this profile name from the Zowe-Jobs-Persistent setting, which can be found in your ") +
                getAppName(globals.ISTHEIA) + localize("initializeJobsFavorites.error.profile4", " user settings.");
                errorHandling(error, null, errMessage);
            }
        }
        profile = parentNode.getProfile();
        session = parentNode.getSession();
        // Pass loaded profile/session to the parent node's favorites children.
        const profileInFavs = this.findMatchingProfileInArray(this.mFavorites, profileName);
        const favsForProfile = profileInFavs.children;
        for (const favorite of favsForProfile ) {
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
            favJob = new Job(this.createSearchLabel(node.owner, node.prefix, node.searchId), vscode.TreeItemCollapsibleState.None,
                profileNodeInFavorites, node.getSession(), node.job, node.getProfile());
            favJob.contextValue = node.contextValue;
            favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
            this.saveSearch(favJob);
        } else {
            // Favorite a job
            favJob = new Job(node.label.trim(), vscode.TreeItemCollapsibleState.Collapsed,
                profileNodeInFavorites, node.getSession(), node.job, node.getProfile());
            favJob.contextValue = node.contextValue;
            favJob.command = {command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob]};
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
        const startLength = profileNodeInFavorites.children.length;
        profileNodeInFavorites.children = profileNodeInFavorites.children.filter((temp) =>
            !((temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue))));
        if (startLength !== profileNodeInFavorites.children.length) {
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    public async updateFavorites() {
        const favoritesArray = [];
        this.mFavorites.forEach((profileNode) => {
            profileNode.children.forEach((fav) => {
                const favoriteEntry = "[" + profileNode.label.trim() + "]: " + fav.label + "{" + (contextually.isFavoriteJob(fav) ?
                    globals.JOBS_JOB_CONTEXT :
                    globals.JOBS_SESSION_CONTEXT) + "}";
                favoritesArray.push(favoriteEntry);
            });
        });
        this.mHistory.updateFavorites(favoritesArray);
    }

    /**
     * Prompts the user for search details to populate the [TreeView]{@link vscode.TreeView}
     *
     * @param {IZoweJobTreeNode} node - The session node
     * @returns {Promise<void>}
     */
    public async filterPrompt(node: IZoweJobTreeNode) {
        let choice: vscode.QuickPickItem;
        let searchCriteria: string = "";
        const hasHistory = this.mHistory.getSearchHistory().length > 0;
        await this.checkCurrentProfile(node, true);
        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            if (contextually.isSessionNotFav(node)) { // This is the profile object context
                if (hasHistory) { // Check if user has created some history
                    const items: vscode.QuickPickItem[] = this.mHistory.getSearchHistory().map((element) => new FilterItem(element));
                    if (globals.ISTHEIA) { // Theia doesn't work properly when directly creating a QuickPick
                        const options1: vscode.QuickPickOptions = {
                            placeHolder: localize("searchHistory.options.prompt", "Select a filter")
                        };
                        // get user selection
                        choice = (await vscode.window.showQuickPick([this.createOwner, this.createId, ...items], options1));
                        if (!choice) {
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                            return;
                        }
                        searchCriteria = choice === this.createOwner || choice === this.createId ? "" : choice.label;
                    } else { // VSCode route to create a QuickPick
                        const quickpick = vscode.window.createQuickPick();
                        quickpick.items = [this.createOwner, this.createId, ...items];
                        quickpick.placeholder = localize("searchHistory.options.prompt", "Select a filter");
                        quickpick.ignoreFocusOut = true;
                        quickpick.show();
                        choice = await resolveQuickPickHelper(quickpick);
                        quickpick.hide();
                        if (!choice) {
                            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                            return;
                        }
                        if (choice instanceof FilterDescriptor) {
                            if (quickpick.value.length > 0) {
                                searchCriteria = this.interpretFreeform(quickpick.value);
                            }
                        } else {
                            searchCriteria = choice.label;
                        }
                    }
                }
                let options: vscode.InputBoxOptions;
                let owner: string;
                let prefix: string;
                let jobid: string;
                if (searchCriteria) {
                    owner = searchCriteria.match(/Owner:/) ? searchCriteria.match(/(?<=Owner\:).*(?=\s)/)[0] : null;
                    prefix = searchCriteria.match(/Prefix:/) ? searchCriteria.match(/(?<=Prefix\:).*$/)[0] : null;
                    jobid = searchCriteria.match(/JobId:/) ? searchCriteria.match(/(?<=JobId\:).*$/)[0] : null;
                }
                // manually entering a search
                if (!hasHistory || choice === this.createOwner || searchCriteria.match(/Owner:/)) { // User has selected owner/prefix option
                    options = {
                        prompt: localize("jobsFilterPrompt.option.prompt.owner",
                            "Enter the Job Owner. Default is *."),
                        validateInput: (value: string) => (value.match(/ /g) ? localize("jobs.enter.valid.owner",
                            "Please enter a valid owner name (no spaces allowed).") : ""),
                        value: owner
                    };
                    // get user input
                    owner = await vscode.window.showInputBox(options);
                    if (owner === undefined) {
                        vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                        return;
                    }
                    if (!owner) {
                        owner = "*";
                    }
                    owner = owner.toUpperCase();
                    options = {
                        prompt: localize("jobsFilterPrompt.option.prompt.prefix", "Enter a Job prefix. Default is *."),
                        value: prefix
                    };
                    // get user input
                    prefix = await vscode.window.showInputBox(options);
                    if (prefix === undefined) {
                        vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                        return;
                    }
                    if (!prefix) {
                        prefix = "*";
                    }
                    prefix = prefix.toUpperCase();
                    if (!hasHistory || choice === this.createId) {
                        options = {
                            prompt: localize("jobsFilterPrompt.option.prompt.jobid", "Enter a Job id"),
                            value: jobid
                        };
                        // get user input
                        jobid = await vscode.window.showInputBox(options);
                        if (jobid === undefined) {
                            vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                            return;
                        }
                    }
                } else { // User has selected JobId option
                    options = {
                        prompt: localize("jobsFilterPrompt.option.prompt.jobid", "Enter a Job id"),
                        value: jobid
                    };
                    // get user input
                    jobid = await vscode.window.showInputBox(options);
                    if (!jobid) {
                        vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                        return;
                    }
                }
                searchCriteria = this.createSearchLabel(owner, prefix, jobid);
                this.applySearchLabelToNode(node, searchCriteria);
            } else {
                // executing search from saved search in favorites
                searchCriteria = node.label.trim();
                const session = node.getProfileName();
                const faveNode = node;
                await this.addSession(session);
                node = this.mSessionNodes.find((tempNode) => tempNode.label.trim() === session);
                if ((!node.getSession().ISession.user) || (!node.getSession().ISession.password)) {
                    node.getSession().ISession.user = faveNode.getSession().ISession.user;
                    node.getSession().ISession.password = faveNode.getSession().ISession.password;
                    node.getSession().ISession.base64EncodedAuth = faveNode.getSession().ISession.base64EncodedAuth;
                }
                this.applySearchLabelToNode(node, searchCriteria);
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
            const setting: any = {...vscode.workspace.getConfiguration().get(ZosJobsProvider.persistenceSchema)};
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace.getConfiguration().update(ZosJobsProvider.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public hideSession(node: IZoweJobTreeNode) {
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.trim() !== node.label.trim());
        this.deleteSessionByLabel(node.getLabel());
    }

    /**
     * Creates a display string to represent a search
     * @param owner - The owner search item
     * @param prefix - The job prefix search item
     * @param jobid - A specific jobid search item
     */
    public createSearchLabel(owner: string, prefix: string, jobid: string): string {
        let revisedCriteria: string = "";

        const alphaNumeric = new RegExp("^\w+$");
        if (jobid && !alphaNumeric.exec(jobid.trim())) {
            revisedCriteria = Job.JobId + jobid.toUpperCase().trim();
        } else {
            if (owner) {
                revisedCriteria = Job.Owner + owner.trim() + " ";
            }
            if (prefix) {
                revisedCriteria += Job.Prefix + prefix.trim();
            }
        }
        return revisedCriteria.trim();
    }

    public async addFileHistory(criteria: string) {
        throw new Error("Method not implemented.");
    }

    public interpretFreeform(input: string): string {
        let jobId: string;
        let owner: string;
        let prefix: string;


        // test if it's like our stored structure
        const criteria: string[] = input.split(" ");
        criteria.forEach((crit, index) => {
            if (crit.toUpperCase().indexOf(ZosJobsProvider.JobId.toUpperCase()) > -1 && criteria.length >= index + 2) {
                jobId = criteria[index + 1].trim().toUpperCase();
            }
            if (crit.toUpperCase().indexOf(ZosJobsProvider.Owner.toUpperCase()) > -1 && criteria.length >= index + 2) {
                owner = criteria[index + 1].trim().toUpperCase();
            }
            if (crit.toUpperCase().indexOf(ZosJobsProvider.Prefix.toUpperCase()) > -1 && criteria.length >= index + 2) {
                prefix = criteria[index + 1].trim().toUpperCase();
            }
        });
        // test for a jobId on it's own
        const jobPattern = new RegExp("[a-zA-Z]{3}[0-9]{5}");
        const jobs = jobPattern.exec(input);
        if (jobs && jobs.length > 0) {
            return this.createSearchLabel("*", "*", jobs[0]);
        }
        if (!owner && !prefix && !jobId) {
            const validPattern = new RegExp("[a-zA-Z0-9*]{2,8}");
            criteria.forEach((crit, index) => {
                if (index === 0 && validPattern.test(crit)) {
                    owner = crit.trim();
                } else if (index === 1 && validPattern.test(crit)) {
                    prefix = crit.trim();
                }
            });
        }
        return this.createSearchLabel(owner, prefix, jobId);
    }

    /**
     * Function that takes a search criteria and updates a search node based upon it
     * @param node - a IZoweJobTreeNode node
     * @param storedSearch - The original search string
     */
    private applySearchLabelToNode(node: IZoweJobTreeNode, storedSearch: string) {
        if (storedSearch) {
            node.searchId = "";
            node.owner = "*";
            node.prefix = "*";
            const criteria: string[] = storedSearch.split(" ");
            for (const crit of criteria) {
                let index = crit.indexOf(ZosJobsProvider.JobId);
                if (index > -1) {
                    index += ZosJobsProvider.JobId.length;
                    node.searchId = crit.substring(index).trim();
                }
                index = crit.indexOf(ZosJobsProvider.Owner);
                if (index > -1) {
                    index += ZosJobsProvider.Owner.length;
                    node.owner = crit.substring(index).trim();
                }
                index = crit.indexOf(ZosJobsProvider.Prefix);
                if (index > -1) {
                    index += ZosJobsProvider.Prefix.length;
                    node.prefix = crit.substring(index).trim();
                }
            }
        }
    }

    private createJobsFavorite(node: IZoweJobTreeNode) {
        node.label = node.label.substring(0, node.label.lastIndexOf(")") + 1);
        node.contextValue = contextually.asFavorite(node);
        return node;
    }

    /**
     * Adds a single session to the jobs tree
     *
     */
    private async addSingleSession(profileLoaded: IProfileLoaded) {
        if (profileLoaded) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === profileLoaded.name)) {
                return;
            }

            let session;
            try {
                // Uses loaded profile to create a zosmf session with Zowe
                // session = await getValidSession(profileLoaded, profileLoaded.name, false);
                session = await ZoweExplorerApiRegister.getJesApi(profileLoaded).getSession();
            } catch (error) {
                await errorHandling(error);
            }
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(profileLoaded.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, profileLoaded);
            node.contextValue = globals.JOBS_SESSION_CONTEXT;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            node.dirty = true;
            this.mSessionNodes.push(node);
            this.mHistory.addSession(profileLoaded.name);
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
