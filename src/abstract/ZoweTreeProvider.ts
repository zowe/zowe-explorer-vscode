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
import { Logger } from "@zowe/imperative";
import { Profiles } from "../Profiles";
import { PersistentFilters } from "../PersistentFilters";
import { OwnerFilterDescriptor, applyIcons } from "../utils";
import { IZoweTreeNode, IZoweDatasetTreeNode } from "../api/IZoweTreeNode";
import * as extension from "../extension";

// tslint:disable-next-line: max-classes-per-file
export class ZoweTreeProvider {

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | undefined> = new vscode.EventEmitter<IZoweTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | undefined> = this.mOnDidChangeTreeData.event;
    public createOwner = new OwnerFilterDescriptor();

    protected mHistory: PersistentFilters;
    protected log: Logger;
    protected validProfile: number = -1;

    constructor(protected persistenceSchema: string, public mFavoriteSession: IZoweTreeNode) {
        this.mHistory = new PersistentFilters(this.persistenceSchema);
    }

    /**
     * Takes argument of type IZoweTreeNode and returns it converted to a general [TreeItem]
     *
     * @param {IZoweTreeNode} element
     * @returns {vscode.TreeItem}
     */
    public getTreeItem(element: IZoweTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public getParent(element: IZoweTreeNode): IZoweTreeNode {
        return element.getParent();
    }

    /**
     * Selects a specific item in the tree view
     *
     * @param {IZoweTreeNode}
     */
    public setItem(treeView: vscode.TreeView<IZoweTreeNode>, item: IZoweTreeNode) {
        treeView.reveal(item, { select: true, focus: true });
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: IZoweDatasetTreeNode): void {
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
    public async flipState(element: IZoweTreeNode, isOpen: boolean = false) {
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
            if ((!element.getSession().ISession.user) || (!element.getSession().ISession.password)) {
                try {
                    const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
                    if (values !== undefined) {
                        usrNme = values [0];
                        passWrd = values [1];
                        baseEncd = values [2];
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(error.message);
                }
                if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                    element.getSession().ISession.user = usrNme;
                    element.getSession().ISession.password = passWrd;
                    element.getSession().ISession.base64EncodedAuth = baseEncd;
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

    public async onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
        if (e.affectsConfiguration(this.persistenceSchema)) {
            const setting: any = { ...vscode.workspace.getConfiguration().get(this.persistenceSchema) };
            if (!setting.persistence) {
                setting.favorites = [];
                setting.history = [];
                await vscode.workspace.getConfiguration().update(this.persistenceSchema, setting, vscode.ConfigurationTarget.Global);
            }
        }
    }

    public getHistory() {
        return this.mHistory.getHistory();
    }

    public async addHistory(criteria: string) {
        if (criteria) {
            this.mHistory.addHistory(criteria);
            this.refresh();
        }
    }

    public findNonFavoritedNode(element: IZoweTreeNode) {
        return undefined;
    }

    public findFavoritedNode(element: IZoweTreeNode) {
        return undefined;
    }
    public renameFavorite(node: IZoweTreeNode, newLabel: string) {
        return undefined;
    }
    public renameNode(profile: string, beforeDataSetName: string, afterDataSetName: string) {
        return undefined;
    }
    protected deleteSessionByLabel(revisedLabel: string) {
        if (revisedLabel.includes("[")) {
            revisedLabel = revisedLabel.substring(0, revisedLabel.indexOf(" ["));
        }
        this.mHistory.removeSession(revisedLabel);
        this.refresh();
    }
}
