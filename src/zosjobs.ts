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

import * as vscode from 'vscode';
import * as zowe from '@brightside/core';
import * as path from 'path';
import * as os from 'os';
import { CliProfileManager, Session, IProfileLoaded } from '@brightside/imperative';
import { IJob } from '@brightside/core';
import { loadNamedProfile, loadDefaultProfile } from './ProfileLoader';

export class ZosJobsProvider implements vscode.TreeDataProvider<Job> {
    public mSessionNodes: Job[] = [];

    public mOnDidChangeTreeData: vscode.EventEmitter<Job | undefined> = new vscode.EventEmitter<Job | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<Job | undefined> = this.mOnDidChangeTreeData.event;

    getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        if(element){
            return element.getChildren();
        } else {
            return this.mSessionNodes;
        }
    }

    getTreeItem(element: Job): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getParent?(element: Job): vscode.ProviderResult<Job> {
        return element;
    }

    /**
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public async addSession(sessionName?: string) {
        // Loads profile associated with passed sessionName, default if none passed
        const zosmfProfile: IProfileLoaded = sessionName? loadNamedProfile(sessionName): loadDefaultProfile();

        // If session is already added, do nothing
        if (this.mSessionNodes.filter((tempNode) => tempNode.mLabel === zosmfProfile.profile.name).length) {
            return;
        }

        // Uses loaded profile to create a zosmf session with brightside
        const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

        // Creates ZoweNode to track new session and pushes it to mSessionNodes
        const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, session, null);
        node.contextValue = "server";
        this.mSessionNodes.push(node);
        this.refresh();
    }

    public deleteSession(node: Job) {
        // Removes deleted session from mSessionNodes
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label !== node.label);
        this.refresh();
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        this.mOnDidChangeTreeData.fire();
    }
}

export class Job extends vscode.TreeItem {
    public dirty: boolean = true;
    private children: Job[] = [];
    private _owner: string;
    private _prefix: string;

    constructor(public mLabel: string, public mCollapsibleState: vscode.TreeItemCollapsibleState, public session: Session, public job: IJob) {
        super(mLabel, mCollapsibleState);
        this._owner = session.ISession.user;
        this._prefix = "*";
    }

    public async getChildren(): Promise<Job[]> {
        if(this.dirty){
            this.children = [];
            let jobs: zowe.IJob[] = await zowe.GetJobs.getJobsByOwnerAndPrefix(this.session, this._owner, this._prefix);
            jobs.forEach((job) => {
                let nodeTitle: string;
                if(job.retcode) {
                    nodeTitle = `${job.jobname}(${job.retcode})`;
                } else {
                    nodeTitle = `${job.jobname}(${job.status})`;
                }
                let jobNode = new Job(nodeTitle, vscode.TreeItemCollapsibleState.None, this.session, job);
                jobNode.command = {command: "zowe.zosJobsSelectjob", title: "", arguments: [jobNode]};
                jobNode.contextValue = "job";
                this.children.push(jobNode);
            });
            this.children.sort((a, b) => {
                if(a.job.jobid > b.job.jobid) {return 1;}
                if(a.job.jobid < b.job.jobid) {return -1;}
                return 0;
            });
        }
        return this.children;
    }

    get tooltip(): string {
        if(this.job !== null) {
            if(this.job.retcode) {
                return `${this.job.jobname}(${this.job.jobid}) - ${this.job.retcode}`;
            } else {
                return `${this.job.jobname}(${this.job.jobid})`;
            }
        } else {
            return `${this.mLabel} - owner: ${this._owner} prefix: ${this._prefix}`;
        }
    }

    set owner(newOwner: string) {
        if(newOwner !== undefined) {
            if(newOwner.length === 0){
                this._owner = this.session.ISession.user;
            } else {
                this._owner = newOwner;
            }
        }
    }

    set prefix(newPrefix: string) {
        if(newPrefix !== undefined) {
            if(newPrefix.length === 0){
                this._prefix = "*";
            } else {
                this._prefix = newPrefix;
            }
        }
    }
}
