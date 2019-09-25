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
import * as extension from "./extension";
import * as utils from "./utils";

// tslint:disable-next-line: max-classes-per-file
export class Job extends vscode.TreeItem {
    public static readonly JobId = "JobId:";
    public static readonly Owner = "Owner:";
    public static readonly Prefix = "Prefix:";
    /**
     * Static method that creates a display string to represent a search
     * @param owner - The owner search item
     * @param prefix - The job prefix search item
     * @param jobid - A specific jobid search item
     */
    public static createSearchLabel(owner: string, prefix: string, jobid: string): string {
        let revisedCriteria: string = "";
        jobid = jobid.toUpperCase();
        const alphaNumeric = new RegExp("^\w+$");
        if (jobid.trim().length > 1 && !alphaNumeric.test(jobid.trim())) {
            revisedCriteria = Job.JobId+jobid.trim();
        } else {
            if (owner.length>0) {
                revisedCriteria = Job.Owner+owner.trim()+ " ";
            }
            if (prefix.length>0) {
                revisedCriteria += Job.Prefix+prefix.trim();
            }
        }
        return revisedCriteria;
    }

    public dirty = extension.ISTHEIA;  // Make sure this is true for theia instances
    private children: Job[] = [];
    // tslint:disable-next-line: variable-name
    private _owner: string;
    // tslint:disable-next-line: variable-name
    private _prefix: string;
    // tslint:disable-next-line: variable-name
    private _searchId: string;

    constructor(public label: string, public mCollapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: Job, public session: Session, public job: IJob) {
        super(label, mCollapsibleState);
        if (session) {
            this._owner = session.ISession.user;
        }
        this._prefix = "*";
        this._searchId = "";
        utils.applyIcons(this);
    }

    public getSessionName(): string {
        return this.getSessionNode().label.trim();
    }

    public getSessionNode(): Job {
        if(this.mParent == null) {
            return this;
        } else {
            return this.mParent;
        }
    }

    public async getChildren(): Promise<Job[]> {
        if (this.dirty) {
            const elementChildren = [];
            let spools: zowe.IJobFile[] = [];
            if (this.contextValue === extension.JOBS_JOB_CONTEXT || this.contextValue === extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX) {
                spools = await zowe.GetJobs.getSpoolFiles(this.session, this.job.jobname, this.job.jobid);
                spools.forEach((spool) => {
                    const existing = this.children.find((element) => element.label.trim() === `${spool.stepname}:${spool.ddname}(${spool.id})` );
                    if (existing) {
                        elementChildren.push(existing);
                    } else {
                        let prefix = spool.stepname;
                        if (prefix === undefined) {
                            prefix = spool.procstep;
                        }
                        const sessionName = this.contextValue === extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX ?
                            this.label.substring(1, this.label.lastIndexOf("]")).trim() :
                            this.getSessionName();
                        const spoolNode = new Spool(`${spool.stepname}:${spool.ddname}(${spool.id})`,
                            vscode.TreeItemCollapsibleState.None, this, this.session, spool, this.job, this);
                        spoolNode.iconPath = utils.applyIcons(spoolNode);
                        spoolNode.command = { command: "zowe.zosJobsOpenspool", title: "", arguments: [sessionName, spool] };
                        elementChildren.push(spoolNode);
                    }
                });
            } else {
                let jobs: zowe.IJob[] = [];
                if (this.searchId.length > 0 ) {
                    jobs.push(await zowe.GetJobs.getJob(this.session, this._searchId));
                } else {
                    jobs = await zowe.GetJobs.getJobsByOwnerAndPrefix(this.session, this._owner, this._prefix);
                }
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
                        jobNode.contextValue = extension.JOBS_JOB_CONTEXT;
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
    public getDetailLabel(): string {
        return this.contextValue === "Job" || this.contextValue === extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX ?
            `${this.job.jobname}(${this.job.jobid})`
            : Job.createSearchLabel(this.owner, this.prefix, this.searchId);
    }

    public reset() {
        utils.labelHack(this);
        this.children = [];
        this.dirty = true;
    }

    get tooltip(): string {
        if (this.job !== null) {
            if (this.job.retcode) {
                return `${this.job.jobname}(${this.job.jobid}) - ${this.job.retcode}`;
            } else {
                return `${this.job.jobname}(${this.job.jobid})`;
            }
        } else if (this.searchId.length>0) {
            return `${this.label} - job id: ${this.searchId}`;
        } else {
            return `${this.label} - owner: ${this.owner} prefix: ${this.prefix}`;
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

    set searchId(newId: string) {
        if (newId !== undefined) {
            this._searchId = newId;
        }
    }

    get searchId() {
        return this._searchId;
    }
}

// tslint:disable-next-line: max-classes-per-file
class Spool extends Job {
    constructor(public label: string, public mCollapsibleState: vscode.TreeItemCollapsibleState, public mParent: Job,
                public session: Session, public spool: IJobFile, public job: IJob, public parent: Job) {
        super(label, mCollapsibleState, mParent, session, job);
        this.contextValue = extension.JOBS_SPOOL_CONTEXT;
        utils.applyIcons(this);
    }
}
