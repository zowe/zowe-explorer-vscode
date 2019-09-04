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
import * as zowe from "@brightside/core";
import { Session, IProfileLoaded, Logger } from "@brightside/imperative";
// tslint:disable-next-line: no-duplicate-imports
import { loadNamedProfile, loadDefaultProfile } from "./ProfileLoader";
import { PersistentFilters } from "./PersistentFilters";
import { Job } from "./ZoweJobNode";
import * as utils from "./utils";
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
    await tree.initialize(log);
    return tree;
}

export class ZosJobsProvider implements vscode.TreeDataProvider<Job> {

    private static readonly persistenceSchema: string = "Zowe-Jobs-Persistent-Favorites";
    private static readonly favorites: string = "favorites";
    private static readonly defaultDialogText: string = localize("SpecifyCriteria", " -- Specify Owner/Prefix or JobID -- ");
    private static readonly JobId = "JobId:";
    private static readonly Owner = "Owner:";
    private static readonly Prefix = "Prefix:";

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
        this.mFavoriteSession.contextValue = "favorite";
        this.mFavoriteSession.iconPath = utils.applyIcons(this.mFavoriteSession);
        this.mSessionNodes = [this.mFavoriteSession];
        this.mHistory = new PersistentFilters(ZosJobsProvider.persistenceSchema);
    }

    public getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        if (element) {
            if (element.contextValue === "favorite") {
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
            const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null);
            node.contextValue = "server";
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
        element.iconPath = utils.applyIcons(element, isOpen ? "open" : "closed");
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Initialize the favorites and history information
     * @param log - Logger
     */
    public async initialize(log: Logger) {
        this.log = log;
        this.log.debug(localize("initializeFavorites.log.debug", "initializing favorites"));
        const lines: string[] = this.mHistory.readFavorites();
        lines.forEach((line) => {
            const profileName = line.substring(1, line.lastIndexOf("]"));
            const nodeName = (line.substring(line.indexOf(":") + 1, line.indexOf("{"))).trim();
            const sesName = line.substring(1, line.lastIndexOf("]")).trim();
            try {
                const zosmfProfile = loadNamedProfile(sesName);
                const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
                let node: Job;
                // if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === "job") {
                //     node = new Job(
                //         nodeName,
                //         vscode.TreeItemCollapsibleState.Collapsed,
                //         this.mFavoriteSession,
                //         session,
                //         "",
                //         false,
                //         profileName
                //     );
                // } else {
                //     node = new Job(
                //         nodeName,
                //         vscode.TreeItemCollapsibleState.None,
                //         this.mFavoriteSession,
                //         session,
                //         "",
                //         false,
                //         profileName
                //     );
                //     node.command = {command: "zowe.uss.ZoweUSSNode.open",
                //                     title: localize("initializeUSSFavorites.lines.title", "Open"), arguments: [node]};
                // }
                node.contextValue += "f";
                node.iconPath = utils.applyIcons(node);
                this.mFavorites.push(node);
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
     * @param {ZoweUSSNode} node
     */
    public async addJobsFavorite(node: Job) {
        let temp: Job;
        // temp = new Job(node.fullPath,
        //     node.collapsibleState,
        //     this.mFavoriteSession,
        //     node.getSession(),
        //     node.mParent.fullPath,
        //     false,
        //     node.getSessionNode().mProfileName);
        // temp.contextValue += "f";
        // if (temp.contextValue === "textFilef" || temp.contextValue === "binaryFilef") {
        //     temp.command = { command: "zowe.job.ZoweUSSNode.open", title: "Open", arguments: [temp] };
        // }
        // temp.iconPath = utils.applyIcons(node);
        // if (!this.mFavorites.find((tempNode) => tempNode.label === temp.label)) {
        //     this.mFavorites.push(temp); // testing
        //     await this.updateFavorites();
        //     this.refreshElement(this.mFavoriteSession);
        // }
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {Job} node
     */
    public async removeJobsFavorite(node: Job) {
        //this.mFavorites = this.mFavorites.filter((temp) =>
        //    !((temp.fullPath === node.fullPath) && (temp.contextValue.startsWith(node.contextValue))));
        // await this.updateFavorites();
        this.refreshElement(this.mFavoriteSession);
    }
    /**
     * Prompts the user for details that will populates the [TreeView]{@link vscode.TreeView}
     *
     * @param {Job} node - The session node
     * @returns {Promise<void>}
     */
    public async searchPrompt(node: Job) {
        if (this.log) {
            this.log.debug(localize("ussFilterPrompt.log.debug.promptUSSPath", "Prompting the user for a USS path"));
        }
        const sessionNode = node.getSessionNode();
        let searchCriteria: string = ZosJobsProvider.defaultDialogText;

        const modItems = Array.from(this.mHistory.getHistory());
        if (modItems.length > 0) {
            // accessing history
            const options1: vscode.QuickPickOptions = {
                placeHolder: localize("searchHistory.options.prompt",
                "Choose \"-- Specify Filter --\" to define a new filter or select a previously defined one")
            };
            modItems.unshift(ZosJobsProvider.defaultDialogText);
            // get user selection
            searchCriteria = await vscode.window.showQuickPick(modItems, options1);
            if (!searchCriteria) {
                vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                return;
            }
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
            jobid = jobid.toUpperCase();
            const alphaNumeric = new RegExp("^\w+$");
            if (jobid.trim().length > 1 && !alphaNumeric.test(jobid.trim())) {
                searchCriteria = ZosJobsProvider.JobId+jobid.trim();
                node.searchId = jobid.trim();
                node.owner = "";
                node.prefix = "";
            } else {
                node.searchId = "";
                if (owner.length>0) {
                    searchCriteria = ZosJobsProvider.Owner+owner.trim()+ " ";
                    node.owner = owner.trim();
                } else {
                    node.owner = "";
                }
                if (prefix.length>0) {
                    searchCriteria += ZosJobsProvider.Prefix+prefix.trim();
                    node.prefix = prefix.trim();
                } else {
                    node.prefix = "";
                }
            }
        }
        // Now interpret criteria
        node.searchId = "";
        node.owner = "*";
        node.prefix = "*";
        const criteria: string[] = searchCriteria.split(" ");
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
        this.addHistory(node, searchCriteria);

        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node.iconPath = utils.applyIcons(sessionNode, "open");
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

    public async addHistory(node, criteria: string) {
        this.mHistory.addHistory(criteria);
    }
}
