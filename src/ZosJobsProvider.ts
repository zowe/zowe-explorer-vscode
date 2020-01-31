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
import { ZosmfSession, IJob } from "@brightside/core";
import { IProfileLoaded, Logger } from "@brightside/imperative";
// tslint:disable-next-line: no-duplicate-imports
import { Profiles } from "./Profiles";
import { PersistentFilters } from "./PersistentFilters";
import { Job } from "./ZoweJobNode";
import {
    OwnerFilterDescriptor,
    JobIdFilterDescriptor,
    applyIcons,
    FilterItem,
    FilterDescriptor,
    getAppName,
    resolveQuickPickHelper,
    sortTreeItems,
    errorHandling,
    labelHack
} from "./utils";
import { IZoweTree } from "./ZoweTree";
import * as extension from "../src/extension";
import * as nls from "vscode-nls";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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
export class ZosJobsProvider implements IZoweTree<Job> {
    public static readonly JobId = "JobId:";
    public static readonly Owner = "Owner:";
    public static readonly Prefix = "Prefix:";
    public static readonly defaultDialogText: string = localize("SpecifyCriteria", "Create new..");
    private static readonly persistenceSchema: string = "Zowe-Jobs-Persistent";

    public mSessionNodes: Job[] = [];
    public mFavoriteSession: Job;
    public mFavorites: Job[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<Job | undefined> = new vscode.EventEmitter<Job | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<Job | undefined> = this.mOnDidChangeTreeData.event;
    public createOwner = new OwnerFilterDescriptor();
    public createId = new JobIdFilterDescriptor();

    private validProfile: number = -1;
    private mHistory: PersistentFilters;
    private log: Logger;

    constructor() {
        this.mFavoriteSession = new Job(localize("FavoriteSession", "Favorites"), vscode.TreeItemCollapsibleState.Collapsed, null, null, null, null);
        this.mFavoriteSession.contextValue = extension.FAVORITE_CONTEXT;
        this.mFavoriteSession.iconPath = applyIcons(this.mFavoriteSession);
        this.mSessionNodes = [this.mFavoriteSession];
        this.mHistory = new PersistentFilters(ZosJobsProvider.persistenceSchema);
    }

    public getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        if (element) {
            // solution for optional credentials. Owner is having error on initialization.
            if (element.owner === "") {
                return;
            }
            if (element.contextValue === extension.FAVORITE_CONTEXT) {
                return this.mFavorites;
            }
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    public getTreeItem(element: Job): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    public getParent(element: Job): Job {
        return element.mParent;
    }

    /**
     * Adds a session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public async addSession(sessionName?: string) {
        // Loads profile associated with passed sessionName, default if none passed
        if (sessionName) {
            const zosmfProfile: IProfileLoaded = Profiles.getInstance().loadNamedProfile(sessionName);
            if (zosmfProfile) {
                this.addSingleSession(zosmfProfile);
            }
        } else {
            const zosmfProfiles: IProfileLoaded[] = Profiles.getInstance().allProfiles;
            for (const zosmfProfile of zosmfProfiles) {
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
                this.addSingleSession(Profiles.getInstance().getDefaultProfile());
            }
        }
        this.refresh();
    }

    public deleteSession(node: Job) {
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label.trim() !== node.label.trim());
        let revisedLabel =  node.label;
        if (revisedLabel.includes("[")) {
            revisedLabel = revisedLabel.substring(0, revisedLabel.indexOf(" ["));
        }
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }

    public async deleteJob(node: Job) {
        try {
            await ZoweExplorerApiRegister.getJesApi(node.profile).deleteJob(node.job.jobname, node.job.jobid);
            vscode.window.showInformationMessage(localize("deleteJob.job", "Job ") + node.job.jobname + "(" + node.job.jobid + ")" +
            localize("deleteJob.delete", " deleted"));
            this.removeJobsFavorite(this.createJobsFavorite(node));
        } catch (error) {
            await errorHandling(error, node.getProfileName(), error.message);
        }
    }
    /**
     * Selects a specific job in the Jobs view
     *
     * @param {Job}
     */
    public setJob(treeView: vscode.TreeView<Job>, job: Job) {
        treeView.reveal(job, { select: true, focus: true });
    }


    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: Job): void {
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
    public async flipState(element: Job, isOpen: boolean = false) {
        if (element.label !== "Favorites") {
            let usrNme: string;
            let passWrd: string;
            let baseEncd: string;
            let sesNamePrompt: string;
            if (element.contextValue.endsWith(extension.FAV_SUFFIX)) {
                sesNamePrompt = element.label.substring(1, element.label.indexOf("]"));
            } else {
                sesNamePrompt = element.label;
            }
            if ((!element.session.ISession.user) || (!element.session.ISession.password)) {
                try {
                    const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
                    if (values !== undefined) {
                        usrNme = values [0];
                        passWrd = values [1];
                        baseEncd = values [2];
                    }
                } catch (error) {
                    await errorHandling(error, element.getProfileName(), error.message);
                }
                if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                    element.session.ISession.user = usrNme;
                    element.session.ISession.password = passWrd;
                    element.session.ISession.base64EncodedAuth = baseEncd;
                    element.owner = usrNme;
                    this.validProfile = 1;
                } else {
                    return;
                }
                await this.refreshElement(element);
                await this.refresh();
            } else {
                this.validProfile = 1;
            }
        } else {
            this.validProfile = 1;
        }
        if (this.validProfile === 1) {
            element.iconPath = applyIcons(element, isOpen ? extension.ICON_STATE_OPEN : extension.ICON_STATE_CLOSED);
            element.dirty = true;
            this.mOnDidChangeTreeData.fire(element);
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
                if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === extension.JOBS_JOB_CONTEXT) {
                    favJob = new Job(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed, this.mFavoriteSession,
                            ZosmfSession.createBasicZosmfSession(zosmfProfile.profile), new JobDetail(nodeName), zosmfProfile);
                    favJob.contextValue = extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX;
                    favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
                } else { // for search
                    favJob = new Job(
                        line.substring(0, line.indexOf("{")),
                        vscode.TreeItemCollapsibleState.None,
                        this.mFavoriteSession,
                        ZosmfSession.createBasicZosmfSession(zosmfProfile.profile),
                        null, zosmfProfile
                    );
                    favJob.command = {command: "zowe.jobs.search", title: "", arguments: [favJob]};
                    favJob.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
                }
                favJob.iconPath = applyIcons(favJob);
                this.mFavorites.push(favJob);
        } catch(e) {
            const errMessage: string =
            localize("initializeJobsFavorites.error.profile1",
                "Error: You have Jobs favorites that refer to a non-existent CLI profile named: ") + profileName +
                localize("initializeJobsFavorites.error.profile2",
                ". To resolve this, you can create a profile with this name, ") +
                localize("initializeJobsFavorites.error.profile3",
                "or remove the favorites with this profile name from the Zowe-Jobs-Persistent setting, which can be found in your ") +
                getAppName(extension.ISTHEIA) + localize("initializeJobsFavorites.error.profile4", " user settings.");
            errorHandling(e, null, errMessage);
            return;
        }
        });
    }

    /**
     * Adds a node to the Jobs favorites list
     *
     * @param {Job} node
     */
    public async addJobsFavorite(node: Job) {
        const favJob = this.createJobsFavorite(node);
        if (!this.mFavorites.find((tempNode) => tempNode.label === favJob.label)) {
            this.mFavorites.push(favJob);
            sortTreeItems(this.mFavorites, extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    /**
     * Adds a save search to the Jobs favorites list
     *
     * @param {Job} node
     */
    public async saveSearch(node: Job) {
        const favSessionContext = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
        const favJob = new Job("[" + node.getSessionName() + "]: " +
            this.createSearchLabel(node.owner, node.prefix, node.searchId),
        vscode.TreeItemCollapsibleState.None, node.mParent, node.session, node.job, node.profile);
        favJob.owner = node.owner;
        favJob.prefix = node.prefix;
        favJob.searchId = node.searchId;
        favJob.contextValue = favSessionContext;
        favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
        favJob.iconPath = applyIcons(favJob);
        if (!this.mFavorites.find((tempNode) => tempNode.label === favJob.label)) {
            this.mFavorites.push(favJob);
            sortTreeItems(this.mFavorites, favSessionContext);
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }
    /**
     * Removes a node from the favorites list
     *
     * @param {Job} node
     */
    public async removeJobsFavorite(node: Job) {
        const startLength = this.mFavorites.length;
        this.mFavorites = this.mFavorites.filter((temp) =>
           !((temp.label === node.label) && (temp.contextValue.startsWith(node.contextValue))));
        if (startLength !== this.mFavorites.length) {
            await this.updateFavorites();
            this.refreshElement(this.mFavoriteSession);
        }
    }

    public async updateFavorites() {
        const settings: any = { ...vscode.workspace.getConfiguration().get(ZosJobsProvider.persistenceSchema) };
        if (settings.persistence) {
            settings.favorites = this.mFavorites.map((fav) => fav.label +
                "{" + (fav.contextValue === extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX ?
                        extension.JOBS_JOB_CONTEXT :
                        extension.JOBS_SESSION_CONTEXT ) + "}");
            await vscode.workspace.getConfiguration().update(ZosJobsProvider.persistenceSchema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    /**
     * Prompts the user for search details to populate the [TreeView]{@link vscode.TreeView}
     *
     * @param {Job} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: Job) {
        let choice: vscode.QuickPickItem;
        let searchCriteria: string = "";
        const hasHistory = this.mHistory.getHistory().length > 0;
        let usrNme: string;
        let passWrd: string;
        let baseEncd: string;
        let sesNamePrompt: string;
        if (node.contextValue.endsWith(extension.FAV_SUFFIX)) {
            sesNamePrompt = node.label.substring(1, node.label.indexOf("]"));
        } else {
            sesNamePrompt = node.label;
        }
        if ((!node.session.ISession.user) || (!node.session.ISession.password)) {
            try {
                const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
                if (values !== undefined) {
                    usrNme = values [0];
                    passWrd = values [1];
                    baseEncd = values [2];
                }
            } catch (error) {
                await errorHandling(error, node.getProfileName(), error.message);
            }
            if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                node.session.ISession.user = usrNme;
                node.session.ISession.password = passWrd;
                node.session.ISession.base64EncodedAuth = baseEncd;
                node.owner = usrNme;
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
            if (node.contextValue === extension.JOBS_SESSION_CONTEXT) { // This is the profile object context
                if (hasHistory) { // Check if user has created some history
                    const items: vscode.QuickPickItem[] = this.mHistory.getHistory().map((element) => new FilterItem(element));
                    if (extension.ISTHEIA) { // Theia doesn't work properly when directly creating a QuickPick
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
                        quickpick.items = [this.createOwner, this.createId,  ...items];
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
                            if ( quickpick.value.length > 0) {
                                searchCriteria = this.interpretFreeform(quickpick.value);
                            }
                        } else {
                            searchCriteria = choice.label;
                        }
                    }
                }
                if (!searchCriteria) { // Do we have anything to search with yet?
                    // if (searchCriteria === ZosJobsProvider.defaultDialogText) {
                    let options: vscode.InputBoxOptions;
                    let owner: string;
                    let prefix: string;
                    let jobid: string;
                    // manually entering a search
                    if (!hasHistory || choice === this.createOwner) { // User has selected owner/prefix option
                        options = {
                            prompt: localize("jobsFilterPrompt.option.prompt.owner",
                            "Enter the Job Owner. Default is *."),
                            validateInput: (value: string) => (value.match(/ /g) ? localize("jobs.enter.valid.owner", "Please enter a valid owner name (no spaces allowed).") : ""),
                            value: node.owner
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
                            value: node.prefix
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
                                value: node.searchId
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
                            value: node.searchId
                        };
                        // get user input
                        jobid = await vscode.window.showInputBox(options);
                        if (!jobid) {
                            vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                            return;
                        }
                    }
                    searchCriteria = this.createSearchLabel(owner, prefix, jobid);
                }
                this.applySearchLabelToNode(node, searchCriteria);
            } else {
                // executing search from saved search in favorites
                searchCriteria = node.label.trim().substring(node.label.trim().indexOf(":") + 2);
                const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
                const faveNode = node;
                await this.addSession(session);
                node = this.mSessionNodes.find((tempNode) => tempNode.label.trim() === session);
                if ((!node.session.ISession.user) || (!node.session.ISession.password)) {
                    node.session.ISession.user = faveNode.session.ISession.user;
                    node.session.ISession.password = faveNode.session.ISession.password;
                    node.session.ISession.base64EncodedAuth = faveNode.session.ISession.base64EncodedAuth;
                }
                this.applySearchLabelToNode(node, searchCriteria);
            }
            node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            node.iconPath = applyIcons(node.getSessionNode(), extension.ICON_STATE_OPEN);
            labelHack(node);
            node.dirty = true;
            this.refreshElement(node);
            this.addHistory(searchCriteria);
        }
    }

    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        if (e.affectsConfiguration(ZosJobsProvider.persistenceSchema)) {
            const setting: any = { ...vscode.workspace.getConfiguration().get(ZosJobsProvider.persistenceSchema) };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace.getConfiguration().update(ZosJobsProvider.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public async addHistory(criteria: string) {
        if (criteria) {
            this.mHistory.addHistory(criteria);
        }
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
            revisedCriteria = Job.JobId+jobid.toUpperCase().trim();
        } else {
            if (owner) {
                revisedCriteria = Job.Owner+owner.trim()+ " ";
            }
            if (prefix) {
                revisedCriteria += Job.Prefix+prefix.trim();
            }
        }
        return revisedCriteria.trim();
    }
    public interpretFreeform(input: string): string {
        let jobId: string;
        let owner: string;
        let prefix: string;


        // test if it's like our stored structure
        const criteria: string[] = input.split(" ");
        criteria.forEach((crit, index) => {
            if (crit.toUpperCase().indexOf(ZosJobsProvider.JobId.toUpperCase()) > -1 && criteria.length >= index + 2) {
                jobId = criteria[index+1].trim().toUpperCase();
            }
            if (crit.toUpperCase().indexOf(ZosJobsProvider.Owner.toUpperCase()) > -1 && criteria.length >= index + 2) {
                owner = criteria[index+1].trim().toUpperCase();
            }
            if (crit.toUpperCase().indexOf(ZosJobsProvider.Prefix.toUpperCase()) > -1 && criteria.length >= index + 2) {
                prefix = criteria[index+1].trim().toUpperCase();
            }
        });
        // test for a jobId on it's own
        const jobPattern = new RegExp("[a-zA-Z]{3}[0-9]{5}");
        const jobs = jobPattern.exec(input);
        if (jobs && jobs.length>0) {
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
     * @param node - a Job node
     * @param storedSearch - The original search string
     */
    private applySearchLabelToNode(node: Job, storedSearch: string) {
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

    private createJobsFavorite(node: Job) {
        const favJob = new Job("[" + node.getSessionName() + "]: " +
                node.label.substring(0, node.label.lastIndexOf(")") + 1),
                    vscode.TreeItemCollapsibleState.Collapsed, node.mParent, node.session, node.job, node.profile);
        favJob.contextValue = extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX;
        favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
        favJob.iconPath = applyIcons(favJob);
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
            // Uses loaded profile to create a zosmf session with brightside
            const session = ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, zosmfProfile);
            node.contextValue = extension.JOBS_SESSION_CONTEXT;
            node.iconPath = applyIcons(node);
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
