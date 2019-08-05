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

// tslint:disable-next-line: max-classes-per-file
export class Job extends vscode.TreeItem {
    public dirty: boolean = true;
    private children: Job[] = [];
    // tslint:disable-next-line: variable-name
    private _owner: string;
    // tslint:disable-next-line: variable-name
    private _prefix: string;

    constructor(public mLabel: string, public mCollapsibleState: vscode.TreeItemCollapsibleState,
                public mParent: Job, public session: Session, public job: IJob) {
        super(mLabel, mCollapsibleState);
        this._owner = session.ISession.user;
        this._prefix = "*";
    }

    public async getChildren(): Promise<Job[]> {
        if (this.dirty) {
            this.children = [];
            if (this.contextValue === "job") {
                const spools: zowe.IJobFile[] = await zowe.GetJobs.getSpoolFiles(this.session, this.job.jobname, this.job.jobid);
                spools.forEach((spool) => {
                    let prefix = spool.stepname;
                    if (prefix === undefined) {
                        prefix = spool.procstep;
                    }
                    const spoolNode = new Spool(`${spool.stepname}:${spool.ddname}(${spool.id})`,
                        vscode.TreeItemCollapsibleState.None, this, this.session, spool, this.job, this);
                    spoolNode.command = { command: "zowe.zosJobsOpenspool", title: "", arguments: [this.session, spool] };
                    spoolNode.contextValue = "spool";
                    if (!spoolNode.iconPath) {
                        spoolNode.iconPath = utils.applyIcons(spoolNode.contextValue);
                    }
                    this.children.push(spoolNode);
                    this.iconPath = utils.applyIcons(this.contextValue, "open");
                });
            } else {
                const jobs: zowe.IJob[] = await zowe.GetJobs.getJobsByOwnerAndPrefix(this.session, this._owner, this._prefix);
                jobs.forEach((job) => {
                    let nodeTitle: string;
                    if (job.retcode) {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.retcode}`;
                    } else {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.status}`;
                    }
                    const jobNode = new Job(nodeTitle, vscode.TreeItemCollapsibleState.Collapsed, this, this.session, job);
                    jobNode.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [jobNode] };
                    jobNode.contextValue = "job";
                    if (!jobNode.iconPath) {
                        jobNode.iconPath = utils.applyIcons(jobNode.contextValue);
                    }
                    jobNode.dirty = false;
                    this.children.push(jobNode);
                    this.children.sort((a, b) => {
                        if (a.job.jobid > b.job.jobid) { return 1; }
                        if (a.job.jobid < b.job.jobid) { return -1; }
                        return 0;
                    });
                });
            }
            this.dirty = false;
        }
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
            return `${this.mLabel} - owner: ${this._owner} prefix: ${this._prefix}`;
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
}
// tslint:disable-next-line: max-classes-per-file
class Spool extends Job {
    constructor(public mLabel: string, public mCollapsibleState: vscode.TreeItemCollapsibleState, public mParent: Job,
                public session: Session, public spool: IJobFile, public job: IJob, public parent: Job) {
        super(mLabel, mCollapsibleState, mParent, session, job);
    }
}
