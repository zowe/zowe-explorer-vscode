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
import { IProfileLoaded, Logger } from "@brightside/imperative";
import * as utils from "../utils";
import { Job } from "../Job";
import { MockMethod } from "../decorators/MockMethod";

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

    @MockMethod()
    public getChildren(element?: Job | undefined): vscode.ProviderResult<Job[]> {
        return null;
    }
    @MockMethod()
    public getTreeItem(element: Job): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return null;
    }
    @MockMethod()
    public getParent?(element: Job): Job {
        return null;
    }

    /**
     * Adds a new session to the data set tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    @MockMethod()
    public async addSession(log: Logger, sessionName?: string) {
        return new Promise<void>((resolve) => {
            return resolve();
        });
    }
    @MockMethod()
    // tslint:disable-next-line: no-empty
    public deleteSession(node: Job) {
    }
    /**
     * Selects a specific job in the Jobs view
     *
     * @param {Job}
     */
    @MockMethod()
    // tslint:disable-next-line: no-empty
    public setJob(treeView: vscode.TreeView<Job>, job: Job) {
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    @MockMethod()
    // tslint:disable-next-line: no-empty
    public refresh(): void {
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    @MockMethod()
    public refreshElement(element): void {
        element.dirty = true;
    }

    /**
     * Change the state of an expandable node
     * @param provider the tree view provider
     * @param element the node being flipped
     * @param isOpen the intended state of the the tree view provider, true or false
     */
    @MockMethod()
    public async flipState(element: Job, isOpen: boolean = false) {
        element.iconPath = utils.applyIcons(element.contextValue, isOpen ? "open" : "closed");
        element.dirty = element.contextValue === "job";
    }
}
