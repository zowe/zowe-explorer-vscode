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

import * as zowe from "@brightside/core";
import { CliProfileManager, IProfileLoaded } from "@brightside/imperative";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { loadNamedProfile, loadDefaultProfile } from "./ProfileLoader";

/**
 * A tree that contains nodes of sessions and USS Files
 *
 * @export
 * @class USSTree
 * @implements {vscode.TreeDataProvider}
 */
export class USSTree implements vscode.TreeDataProvider<ZoweUSSNode> {
    public mSessionNodes: ZoweUSSNode[];
    public mFavoriteSession: ZoweUSSNode;
    public mFavorites: ZoweUSSNode[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<ZoweUSSNode | undefined> = new vscode.EventEmitter<ZoweUSSNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<ZoweUSSNode | undefined> = this.mOnDidChangeTreeData.event;

    constructor() {
        this.mSessionNodes = [];
        this.mFavoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null);
        this.mFavoriteSession.contextValue = "favorite";
        this.mSessionNodes = [this.mFavoriteSession];
    }

    /**
     * Takes argument of type ZoweUSSNode and returns it converted to a general [TreeItem]
     *
     * @param {ZoweUSSNode} element
     * @returns {vscode.TreeItem}
     */
    public getTreeItem(element: ZoweUSSNode): vscode.TreeItem {
        return element;
    }

    /**
     * Takes argument of type ZoweUSSNode and retrieves all of the first level children
     *
     * @param {ZoweUSSNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {ZoweUSSNode[] | Promise<ZoweUSSNode[]>}
     */
    public getChildren(element?: ZoweUSSNode): ZoweUSSNode[] | Promise<ZoweUSSNode[]> {
        if (element) {
            if (element.contextValue === "favorite") {
                return this.mFavorites;
            }
            return element.getChildren();
        }
        return this.mSessionNodes;
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        this.mOnDidChangeTreeData.fire();
    }

    /**
     * Returns the parent node or null if it has no parent
     *
     * @param {ZoweUSSNode} element
     * @returns {vscode.ProviderResult<ZoweUSSNode>}
     */
    public getParent(element: ZoweUSSNode): vscode.ProviderResult<ZoweUSSNode> {
        return element.mParent;
    }

    /**
     * Adds a new session to the uss files tree
     *
     * @param {string} [sessionName] - optional; loads default profile if not passed
     */
    public async addSession(sessionName?: string) {
        // Loads profile associated with passed sessionName, default if none passed
        const zosmfProfile: IProfileLoaded = sessionName? loadNamedProfile(sessionName): loadDefaultProfile();

        // If session is already added, do nothing
        if (this.mSessionNodes.find((tempNode) => tempNode.mLabel === zosmfProfile.name)) {
            return;
        }

        // Uses loaded profile to create a zosmf session with brightside
        const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

        // Creates ZoweUSSNode to track new session and pushes it to mSessionNodes
        const node = new ZoweUSSNode(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session, "");
        node.contextValue = "uss_session";
        this.mSessionNodes.push(node);
        this.refresh();
    }

    /**
     * Removes a session from the list in the uss files tree
     *
     * @param {ZoweUSSNode} [node]
     */
    public deleteSession(node: ZoweUSSNode) {
        // Removes deleted session from mSessionNodes
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label !== node.label);
        this.refresh();
    }

    /**
     * Adds a node to the USS favorites list
     *
     * @param {ZoweUSSNode} node
     */
    public async addUSSFavorite(node: ZoweUSSNode) {
        let temp: ZoweUSSNode;
        temp = new ZoweUSSNode(node.fullPath,
            node.collapsibleState,
            this.mFavoriteSession,
            node.getSession(),
            node.mParent.fullPath,
            false,
            node.getSessionNode().mLabel);
        temp.contextValue += "f";
        if (temp.contextValue === "textFilef" || temp.contextValue === "binaryFilef") {
            temp.command = {command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [temp]};
        }
        if (!this.mFavorites.find((tempNode) => tempNode.mLabel === temp.mLabel)) {
            this.mFavorites.push(temp); // testing
            this.refresh();
            await this.updateFavorites();
        }
    }

     /**
     * Removes a node from the favorites list
     *
     * @param {ZoweUSSNode} node
     */
    public async removeUSSFavorite(node: ZoweUSSNode) {
        this.mFavorites = this.mFavorites.filter((temp) =>
            !((temp.mLabel === node.mLabel) && (temp.contextValue.startsWith(node.contextValue))));
        this.refresh();
        await this.updateFavorites();
    }

    public async updateFavorites() {
        const settings: any = { ...vscode.workspace.getConfiguration().get("Zowe-USS-Persistent-Favorites")};
        if (settings.persistence) {
            settings.favorites = this.mFavorites.map((fav) => fav.profileName + fav.fullPath + "{" + fav.contextValue.slice(0, -1) + "}");
            await vscode.workspace.getConfiguration().update("Zowe-USS-Persistent-Favorites", settings, vscode.ConfigurationTarget.Global);
        }
    }
}