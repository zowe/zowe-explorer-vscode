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
import { ZosmfSession, IJob } from "@zowe/cli";
import { IProfileLoaded, Logger } from "@zowe/imperative";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { Job } from "./ZoweJobNode";
import { getAppName, sortTreeItems, labelRefresh } from "../shared/utils";
import { FilterItem, FilterDescriptor, resolveQuickPickHelper, errorHandling } from "../utils";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweJobTreeNode } from "../api/IZoweTreeNode";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";

import * as nls from "vscode-nls";
import { resetValidationSettings } from "../shared/actions";
import { PersistentFilters } from "../PersistentFilters";
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
    public async saveSearch(node: IZoweJobTreeNode) {
        const favSessionContext = contextually.asFavorite(node);
        const favJob = new Job("[" + node.getProfileName() + "]: " +
            this.createSearchLabel(node.owner, node.prefix, node.searchId),
        vscode.TreeItemCollapsibleState.None, node.getParent(), node.getSession(), node.job, node.getProfile());
        favJob.owner = node.owner;
        favJob.prefix = node.prefix;
        favJob.searchId = node.searchId;
        favJob.contextValue = favSessionContext;
        favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
        const icon = getIconByNode(favJob);
        if (icon) {
            favJob.iconPath = icon.path;
        }
        if (!this.mFavorites.find((tempNode) => tempNode.label === favJob.label)) {
            this.mFavorites.push(favJob);
            sortTreeItems(this.mFavorites, favSessionContext);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
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
            await Profiles.getInstance().checkCurrentProfile(element.getProfile());
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
     */
    public async addSession(sessionName?: string, profileType?: string) {
        const setting = PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const theProfile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (theProfile) {
                this.addSingleSession(theProfile);
            }
            for (const node of this.mSessionNodes) {
                const name = node.getProfileName();
                if (name === theProfile.name){
                    await resetValidationSettings(node, setting);
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
                        this.addSingleSession(sessionProfile);
                        for (const node of this.mSessionNodes) {
                            const name = node.getProfileName();
                            if (name === sessionProfile.name){
                                await resetValidationSettings(node, setting);
                            }
                        }
                    }
                }
            }
            if (this.mSessionNodes.length === 1) {
                this.addSingleSession(Profiles.getInstance().getDefaultProfile(profileType));
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
     * Initialize the favorites and history information
     * @param log - Logger
     */
    public async initializeJobsTree(log: Logger) {
        this.log = log;
        this.log.debug(localize("initializeFavorites.log.debug", "initializing favorites"));
        const lines: string[] = this.mHistory.readFavorites();
        lines.forEach((line) => {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const nodeName = (line.substring(line.indexOf(":") + 1, line.indexOf("{"))).trim();
            const sesName = line.substring(1, line.lastIndexOf("]")).trim();
            try {
                const zosmfProfile = Profiles.getInstance().loadNamedProfile(sesName);
                let favJob: Job;
                if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")).startsWith(globals.JOBS_JOB_CONTEXT)) {
                    favJob = new Job(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed, this.mFavoriteSession,
                        ZosmfSession.createBasicZosmfSession(zosmfProfile.profile), new JobDetail(nodeName), zosmfProfile);
                    favJob.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
                    favJob.command = {command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob]};
                } else { // for search
                    favJob = new Job(
                        line.substring(0, line.indexOf("{")),
                        vscode.TreeItemCollapsibleState.None,
                        this.mFavoriteSession,
                        ZosmfSession.createBasicZosmfSession(zosmfProfile.profile),
                        null, zosmfProfile
                    );
                    favJob.command = {command: "zowe.jobs.search", title: "", arguments: [favJob]};
                    favJob.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
                }
                const icon = getIconByNode(favJob);
                if (icon) {
                    favJob.iconPath = icon.path;
                }
                this.mFavorites.push(favJob);
            } catch (e) {
                const errMessage: string =
                    localize("initializeJobsFavorites.error.profile1",
                        "Error: You have Jobs favorites that refer to a non-existent CLI profile named: ") + profileName +
                    localize("initializeJobsFavorites.error.profile2",
                        ". To resolve this, you can create a profile with this name, ") +
                    localize("initializeJobsFavorites.error.profile3",
                        "or remove the favorites with this profile name from the Zowe-Jobs-Persistent setting, which can be found in your ") +
                    getAppName(globals.ISTHEIA) + localize("initializeJobsFavorites.error.profile4", " user settings.");
                errorHandling(e, null, errMessage);
                return;
            }
        });
    }

    /**
     * Adds a node to the Jobs favorites list
     *
     * @param {IZoweJobTreeNode} node
     */
    public async addFavorite(node: IZoweJobTreeNode) {
        const favJob = this.createJobsFavorite(node);
        if (!this.mFavorites.find((tempNode) => tempNode.label === favJob.label)) {
            this.mFavorites.push(favJob);
            sortTreeItems(this.mFavorites, globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX);
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
        const startLength = this.mFavorites.length;
        this.mFavorites = this.mFavorites.filter((temp) =>
            !((temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue))));
        if (startLength !== this.mFavorites.length) {
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    public async updateFavorites() {
        const settings: any = {...vscode.workspace.getConfiguration().get(ZosJobsProvider.persistenceSchema)};
        if (settings.persistence) {
            settings.favorites = this.mFavorites.map((fav) => fav.label +
                "{" + (contextually.isFavoriteJob(fav) ?
                    globals.JOBS_JOB_CONTEXT :
                    globals.JOBS_SESSION_CONTEXT) + "}");
            await vscode.workspace.getConfiguration().update(ZosJobsProvider.persistenceSchema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    /**
     * Prompts the user for search details to populate the [TreeView]{@link vscode.TreeView}
     *
     * @param {IZoweJobTreeNode} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: IZoweJobTreeNode) {
        let choice: vscode.QuickPickItem;
        let searchCriteria: string = "";
        const hasHistory = this.mHistory.getSearchHistory().length > 0;
        let sesNamePrompt: string;
        if (contextually.isFavorite(node)) {
            sesNamePrompt = node.label.substring(1, node.label.indexOf("]"));
        } else {
            sesNamePrompt = node.label;
        }
        await this.checkCurrentProfile(node);
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
                searchCriteria = node.label.trim().substring(node.label.trim().indexOf(":") + 2);
                const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
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

    public deleteSession(node: IZoweJobTreeNode) {
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

    private createJobsFavorite(node: IZoweJobTreeNode): IZoweJobTreeNode {
        const favJob = new Job("[" + node.getSessionNode().label + "]: " +
            node.label.substring(0, node.label.lastIndexOf(")") + 1),
            vscode.TreeItemCollapsibleState.Collapsed, node.getParent(), node.getSession(), node.job, node.getProfile());
        favJob.contextValue = contextually.asFavorite(node);
        favJob.command = {command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob]};
        const icon = getIconByNode(favJob);
        if (icon) {
            favJob.iconPath = icon.path;
        }
        return favJob;
    }

    /**
     * Adds a single session to the jobs tree
     *
     */
    private async addSingleSession(zosmfProfile: IProfileLoaded) {
        if (zosmfProfile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === zosmfProfile.name)) {
                return;
            }
            // Uses loaded profile to create a zosmf session with Zowe
            const session = ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, zosmfProfile);
            node.contextValue = globals.JOBS_SESSION_CONTEXT;
            const icon = getIconByNode(node);
            if (icon) {
                node.iconPath = icon.path;
            }
            node.dirty = true;
            this.mSessionNodes.push(node);
            this.mHistory.addSession(zosmfProfile.name);
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
