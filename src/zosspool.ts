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
import { IJobFile } from '@brightside/core';
import { Job } from './zosjobs';

export class ZosSpoolProvider implements vscode.TreeDataProvider<Spool> {
    public mSessionNode: Spool = undefined;

    public mOnDidChangeTreeData: vscode.EventEmitter<Spool | undefined> = new vscode.EventEmitter<Spool | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<Spool | undefined> = this.mOnDidChangeTreeData.event;

    getChildren(element?: Spool | undefined): vscode.ProviderResult<Spool[]> {
        if(element){
            return element.getChildren();
        } else {
            return [this.mSessionNode];
        }
    }

    getTreeItem(element: Spool): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getParent?(element: Spool): vscode.ProviderResult<Spool> {
        return element;
    }

    /**
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public setJob(job: Job) {
        this.mSessionNode = new Spool(`${job.job.jobname}(${job.job.jobid})`, vscode.TreeItemCollapsibleState.Expanded, job, null);
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

class Spool extends vscode.TreeItem {
    constructor(public mLabel: string, public mCollapsibleState: vscode.TreeItemCollapsibleState, public job: Job, public spoolFile: IJobFile) {
        super(mLabel, mCollapsibleState);
    }

    public async getChildren(): Promise<Spool[]> {
        let children: Spool[] = [];
        let spools: zowe.IJobFile[] = await zowe.GetJobs.getSpoolFiles(this.job.session, this.job.job.jobname, this.job.job.jobid);
        spools.forEach((spool) => {
            let spoolNode = new Spool(`${spool.ddname}(${spool.id})`, vscode.TreeItemCollapsibleState.None, this.job, spool);
            spoolNode.command = {command: "zowe.zosJobsOpenspool", title: "", arguments: [this.job.session, spool]};
            children.push(spoolNode);
        });
        return children;
    }
}