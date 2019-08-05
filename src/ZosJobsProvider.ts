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
import { IProfileLoaded, Logger } from "@brightside/imperative";
// tslint:disable-next-line: no-duplicate-imports
import { IJob, IJobFile } from "@brightside/core";
import { loadNamedProfile, loadDefaultProfile } from "./ProfileLoader";
import * as utils from "./utils";
import { Job } from "./Job";

/**
 * A tree that contains nodes of jobs and spool elements
 *
 * @export
 * @class ZosJobsProvider
 * @implements {vscode.TreeDataProvider}
 */
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
            if (this.mSessionNodes.find((tempNode) => tempNode.mLabel === zosmfProfile.name)) {
                return;
            }

            // Uses loaded profile to create a zosmf session with brightside
            const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

            // Creates ZoweNode to track new session and pushes it to mSessionNodes
            const node = new Job(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, null);
            node.contextValue = "server";
            node.iconPath = utils.applyIcons(node.contextValue);
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
    public refresh(): void {
        this.mOnDidChangeTreeData.fire();
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element): void {
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Change the state of an expandable node
     * @param provider the tree view provider
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    public async flipState(element: Job, isOpen: boolean = false) {
        element.iconPath = utils.applyIcons(element.contextValue, isOpen ? "open" : "closed");
        element.dirty = element.contextValue === "job";
        this.mOnDidChangeTreeData.fire(element);
    }
}
