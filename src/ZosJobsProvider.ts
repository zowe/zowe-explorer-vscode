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
import { ZosmfSession, IJob, DeleteJobs } from "@brightside/core";
import { IProfileLoaded, Logger } from "@brightside/imperative";
// tslint:disable-next-line: no-duplicate-imports
import { loadNamedProfile, loadDefaultProfile } from "./ProfileLoader";
import { PersistentFilters } from "./PersistentFilters";
import { Job } from "./ZoweJobNode";
import * as utils from "./utils";
import * as extension from "../src/extension";
import * as nls from "vscode-nls";
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
    await tree.addSession(log);
    await tree.initializeJobsTree(log);
    return tree;
}

export class ZosJobsProvider implements vscode.TreeDataProvider<Job> {
    public static readonly JobId = "JobId:";
    public static readonly Owner = "Owner:";
    public static readonly Prefix = "Prefix:";
    public static readonly defaultDialogText: string = localize("SpecifyCriteria", "Create new..");

    private static readonly persistenceSchema: string = "Zowe-Jobs-Persistent-Favorites";


    public mSessionNodes: Job[] = [];
    public mFavoriteSession: Job;
    public mFavorites: Job[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<Job | undefined> = new vscode.EventEmitter<Job | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<Job | undefined> = this.mOnDidChangeTreeData.event;

    private mHistory: PersistentFilters;
    private log: Logger;

    constructor() {
        this.mFavoriteSession = new Job(localize("FavoriteSession", "Favorites"), vscode.TreeItemCollapsibleState.Collapsed, null, null, null);
        this.mFavoriteSession.contextValue = extension.FAVORITE_CONTEXT;
        this.mFavoriteSession.iconPath = utils.applyIcons(this.mFavoriteSession);
        this.mSessionNodes = [this.mFavoriteSession];
        this.mHistory = new PersistentFilters(ZosJobsProvider.persistenceSchema);
    }

    public getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        if (element) {
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
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public async addSession(log: Logger, sessionName?: string) {
        // Loads profile associated with passed sessionName, default if none passed
        const zosmfProfile: IProfileLoaded = sessionName ? loadNamedProfile(sessionName) : loadDefaultProfile(log);

        if (zosmfProfile) {
            // If session is already added, do nothing
            if (this.mSessionNodes.find((tempNode) => tempNode.label.trim() === zosmfProfile.name)) {
                return;
            }

            // Uses loaded profile to create a zosmf session with brightside
            const session = ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null);
            node.contextValue = extension.JOBS_SESSION_CONTEXT;
            node.iconPath = utils.applyIcons(node);
            this.mSessionNodes.push(node);
            node.dirty = true;
            this.refresh();
        }
    }

    public deleteSession(node: Job) {
        // Removes deleted session from mSessionNodes
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label !== node.label);
        this.refresh();
    }

    public async deleteJob(node: Job) {
        try {
            await DeleteJobs.deleteJob(node.session, node.job.jobname, node.job.jobid);
            vscode.window.showInformationMessage(localize("deleteJob.job", "Job ") + node.job.jobname + "(" + node.job.jobid + ")" +
            localize("deleteJob.delete", " deleted"));
            this.removeJobsFavorite(this.createJobsFavorite(node));
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
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
        element.iconPath = utils.applyIcons(element, isOpen ? extension.ICON_STATE_OPEN : extension.ICON_STATE_CLOSED);
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
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
                const zosmfProfile = loadNamedProfile(sesName);
                let favJob: Job;
                if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === extension.JOBS_JOB_CONTEXT) {
                    favJob = new Job(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed, this.mFavoriteSession,
                            ZosmfSession.createBasicZosmfSession(zosmfProfile.profile), new JobDetail(nodeName));
                    favJob.contextValue = extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX;
                    favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
                } else { // for search
                    favJob = new Job(
                        line.substring(0, line.indexOf("{")),
                        vscode.TreeItemCollapsibleState.None,
                        this.mFavoriteSession,
                        ZosmfSession.createBasicZosmfSession(zosmfProfile.profile),
                        null
                    );
                    favJob.command = {command: "zowe.jobs.search", title: "", arguments: [favJob]};
                    favJob.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
                }
                favJob.iconPath = utils.applyIcons(favJob);
                this.mFavorites.push(favJob);
        } catch(e) {
            vscode.window.showErrorMessage(
                localize("initializeJobsFavorites.error.profile1",
                "Error: You have Jobs favorites that refer to a non-existent CLI profile named: ") + profileName +
                localize("initializeJobsFavorites.error.profile2",
                ". To resolve this, you can create a profile with this name, ") +
                localize("initializeJobsFavorites.error.profile3",
                "or remove the favorites with this profile name from the Zowe-Jobs-Persistent-Favorites setting, ") +
                localize("initializeJobsFavorites.error.profile4", "which can be found in your VS Code user settings."));
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
            this.mFavorites.push(favJob); // testing
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
        const favJob = new Job("[" + node.getSessionName() + "]: " +
            Job.createSearchLabel(node.owner, node.prefix, node.searchId),
        vscode.TreeItemCollapsibleState.None, node.mParent, node.session, node.job);
        favJob.owner = node.owner;
        favJob.prefix = node.prefix;
        favJob.searchId = node.searchId;
        favJob.contextValue = extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX;
        favJob.command = { command: "zowe.jobs.search", title: "", arguments: [favJob] };
        favJob.iconPath = utils.applyIcons(favJob);
        if (!this.mFavorites.find((tempNode) => tempNode.label === favJob.label)) {
            this.mFavorites.push(favJob);
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
                // "[" + fav.label.substring(1, fav.label.lastIndexOf("]")) + "]: " +
                // (fav.label.substring(fav.label.indexOf(": ") + 2, fav.label.indexOf(")") + 1 )).trim() +
                // fav.getDetailLabel() +
                "{" + (fav.contextValue === extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX ?
                        extension.JOBS_JOB_CONTEXT :
                        extension.JOBS_SESSION_CONTEXT ) + "}");
            await vscode.workspace.getConfiguration().update(ZosJobsProvider.persistenceSchema, settings, vscode.ConfigurationTarget.Global);
        }
    }
    /**
     * Prompts the user for details that will populates the [TreeView]{@link vscode.TreeView}
     *
     * @param {Job} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: Job) {
        let searchCriteria: string = ZosJobsProvider.defaultDialogText;
        if (node.contextValue === extension.JOBS_SESSION_CONTEXT) {
            const modItems: vscode.QuickPickItem[] = [];
            for (const item of this.mHistory.getHistory()) {
                modItems.push(new HistoryItem(item));
            }
            if (modItems.length > 0) {
                // accessing history
                const options1: vscode.QuickPickOptions = {
                    placeHolder: localize("searchHistory.options.prompt",
                    "Choose \"Create new...\" to define a new filter alternatively select a previously defined filter")
                };
                modItems.unshift(new EditSwitch(ZosJobsProvider.defaultDialogText, "Click to create a new filter definition"));
                // get user selection
                const response = await vscode.window.showQuickPick(modItems, options1);
                if (!response ) {
                    vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                    return;
                }
                searchCriteria = response.label;
            }
            if (searchCriteria === ZosJobsProvider.defaultDialogText) {
                let owner: string;
                let prefix: string;
                let jobid: string;
                // manually entering a search
                let options: vscode.InputBoxOptions = {
                    prompt: localize("jobsFilterPrompt.option.prompt.owner",
                    "Search Jobs by entering an Owner and/or a Prefix or a JobID on it's own.\n\nEnter an Owner default is * to include all."),
                    value: node.owner
                };
                // get user input
                owner = await vscode.window.showInputBox(options);
                if (!owner) {
                    vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterOwner",
                            "No valid value for owner or wild card *. Search Cancelled"));
                    return;
                }
                owner = owner.toUpperCase();
                options = {
                    prompt: localize("jobsFilterPrompt.option.prompt.prefix", "Now enter a Job prefix default is * to include all jobs."),
                    value: node.prefix
                };
                // get user input
                prefix = await vscode.window.showInputBox(options);
                if (!searchCriteria) {
                    vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix",
                            "No valid value for prefix or wild card *. Search Cancelled"));
                    return;
                }
                prefix = prefix.toUpperCase();
                options = {
                    prompt: localize("jobsFilterPrompt.option.prompt.jobid", "\nEnter a specific Job id or leave blank"),
                    value: node.searchId
                };
                // get user input
                jobid = await vscode.window.showInputBox(options);
                if (!searchCriteria) {
                    vscode.window.showInformationMessage(localize("jobsFilterPrompt.enterPrefix", "Search Cancelled"));
                    return;
                }
                searchCriteria = Job.createSearchLabel(owner, prefix, jobid);
            }
            this.applySearchLabelToNode(node, searchCriteria);
        } else {
            // executing search from saved search in favorites
            searchCriteria = node.label.trim().substring(node.label.trim().indexOf(":") + 2);
            const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
            await this.addSession(this.log, session);
            node = this.mSessionNodes.find((tempNode) => tempNode.label.trim() === session);
            this.applySearchLabelToNode(node, searchCriteria);
        }
        this.addHistory(searchCriteria);

        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node.iconPath = utils.applyIcons(node.getSessionNode(), extension.ICON_STATE_OPEN);
        node.dirty = true;
        this.refreshElement(node);
    }

    public async onDidChangeConfiguration(e) {
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
        if (criteria !== ZosJobsProvider.defaultDialogText) {
            this.mHistory.addHistory(criteria);
        }
    }

    /**
     * Function that takes a search criteria and updates a search node based upon it
     * @param node - a Job node
     * @param storedSearch - The original search string
     */
    private applySearchLabelToNode(node: Job, storedSearch: string) {
        if (!storedSearch) {
            return;
        }
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

    private createJobsFavorite(node: Job) {
        const favJob = new Job("[" + node.getSessionName() + "]: " +
                node.label.substring(0, node.label.lastIndexOf(")") + 1),
                    vscode.TreeItemCollapsibleState.Collapsed, node.mParent, node.session, node.job);
        favJob.contextValue = extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX;
        favJob.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [favJob] };
        favJob.iconPath = utils.applyIcons(favJob);
        return favJob;
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
// tslint:disable-next-line: max-classes-per-file
export class EditSwitch implements vscode.QuickPickItem {
    public label: string;
    public detail: string;

    constructor(base: string, detail: string) {
        this.label = base;
        this.detail = detail;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class HistoryItem implements vscode.QuickPickItem {
    public label: string;
    public description: string;

    constructor(base: string, description?: string) {
        this.label = base;
        this.description = description;
    }
}
