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
import { IJob, IJobFile } from "@brightside/core";
import { loadNamedProfile, loadDefaultProfile } from "./ProfileLoader";
import * as utils from "./utils";


/**
 * Creates the Job tree that contains nodes of sessions, jibs and spool items
 *
 * @export
 */
export async function createJobsTree(log: Logger) {
    const tree = new ZosJobsProvider();
    await tree.addSession(log);
    return tree;
}

export class ZosJobsProvider implements vscode.TreeDataProvider<Job> {
    public mSessionNodes: Job[] = [];

    public mOnDidChangeTreeData: vscode.EventEmitter<Job | undefined> = new vscode.EventEmitter<Job | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<Job | undefined> = this.mOnDidChangeTreeData.event;

    public getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        if (element) {
            return element.getChildren();
        } else {
            return this.mSessionNodes;
        }
    }

    public getTreeItem(element: Job): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    public getParent?(element: Job): Job {
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
}

// tslint:disable-next-line: max-classes-per-file
export class Job extends vscode.TreeItem {
    public dirty: boolean = true;
    private children: Job[] = [];
    // tslint:disable-next-line: variable-name
    private _owner: string;
    // tslint:disable-next-line: variable-name
    private _prefix: string;

    constructor(public label: string, public mCollapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: Job, public session: Session, public job: IJob) {
        super(label, mCollapsibleState);
        this._owner = session.ISession.user;
        this._prefix = "*";
        utils.applyIcons(this);
    }

    public getSessionName(): string {
        if(this.mParent == null) {
            return this.label.trim();
        } else {
            return this.mParent.getSessionName();
        }
    }

    public async getChildren(): Promise<Job[]> {
        if (this.dirty) {
            const elementChildren = [];
            if (this.contextValue === "job") {
                const spools: zowe.IJobFile[] = await zowe.GetJobs.getSpoolFiles(this.session, this.job.jobname, this.job.jobid);
                spools.forEach((spool) => {
                    const existing = this.children.find((element) => element.label.trim() === `${spool.stepname}:${spool.ddname}(${spool.id})` );
                    if (existing) {
                        elementChildren.push(existing);
                    } else {
                        let prefix = spool.stepname;
                        if (prefix === undefined) {
                            prefix = spool.procstep;
                        }
                        const spoolNode = new Spool(`${spool.stepname}:${spool.ddname}(${spool.id})`,
                            vscode.TreeItemCollapsibleState.None, this, this.session, spool, this.job, this);
                        spoolNode.iconPath = utils.applyIcons(spoolNode);
                        spoolNode.command = { command: "zowe.zosJobsOpenspool", title: "", arguments: [this.getSessionName(), spool] };
                        elementChildren.push(spoolNode);
                    }
                });
                this.iconPath = utils.applyIcons(this, "open");
            } else {
                const jobs: zowe.IJob[] = await zowe.GetJobs.getJobsByOwnerAndPrefix(this.session, this._owner, this._prefix);
                jobs.forEach((job) => {
                    let nodeTitle: string;
                    if (job.retcode) {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.retcode}`;
                    } else {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.status}`;
                    }
                    const existing = this.children.find((element) => element.label.trim() === nodeTitle );
                    if (existing) {
                        elementChildren.push(existing);
                    } else {
                        const jobNode = new Job(nodeTitle, vscode.TreeItemCollapsibleState.Collapsed, this, this.session, job);
                        jobNode.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [jobNode] };
                        jobNode.contextValue = "job";
                        if (!jobNode.iconPath) {
                            jobNode.iconPath = utils.applyIcons(jobNode);
                        }
                        elementChildren.push(jobNode);
                    }
                });
            }
            elementChildren.sort((a, b) => {
                if (a.job.jobid > b.job.jobid) { return 1; }
                if (a.job.jobid < b.job.jobid) { return -1; }
                return 0;
            });
            this.children = elementChildren;
        }
        this.dirty = false;
        return this.children;
    }

    get tooltip(): string {
        if (this.job !== null) {
            if (this.job.retcode) {
                return `${this.job.jobname}(${this.job.jobid}) - ${this.job.retcode}`;
            } else {
                return `${this.job.jobname}(${this.job.jobid})`;
            }
        } else {
            return `${this.label} - owner: ${this._owner} prefix: ${this._prefix}`;
        }
    }

    set owner(newOwner: string) {
        if (newOwner !== undefined) {
            if (newOwner.length === 0) {
                this._owner = this.session.ISession.user;
            } else {
                this._owner = newOwner;
            }
        }
    }

    get owner() {
        return this._owner;
    }

    set prefix(newPrefix: string) {
        if (newPrefix !== undefined) {
            if (newPrefix.length === 0) {
                this._prefix = "*";
            } else {
                this._prefix = newPrefix;
            }
        }
    }

    get prefix() {
        return this._prefix;
    }

    public reset() {
        utils.labelHack(this);
        this.children = [];
        this.dirty = true;
    }
}
// tslint:disable-next-line: max-classes-per-file
class Spool extends Job {
    constructor(public label: string, public mCollapsibleState: vscode.TreeItemCollapsibleState, public mParent: Job,
                public session: Session, public spool: IJobFile, public job: IJob, public parent: Job) {
        super(label, mCollapsibleState, mParent, session, job);
        this.contextValue = "spool";
        utils.applyIcons(this);
    }
}
