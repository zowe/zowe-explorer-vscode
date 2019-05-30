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
import * as path from "path";
import * as vscode from "vscode";
import { ZoweNode } from "./ZoweNode";
import {IProfileLoaded } from "@brightside/imperative";
import { loadNamedProfile, loadDefaultProfile} from "./ProfileLoader";

/**
 * A tree that contains nodes of sessions and data sets
 *
 * @export
 * @class DatasetTree
 * @implements {vscode.TreeDataProvider}
 */
export class DatasetTree implements vscode.TreeDataProvider<ZoweNode> {
    public mSessionNodes: ZoweNode[];
    public mFavoriteSession: ZoweNode;
    public mFavorites: ZoweNode[] = [];

    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<ZoweNode | undefined> = new vscode.EventEmitter<ZoweNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<ZoweNode | undefined> = this.mOnDidChangeTreeData.event;

    constructor() {
        this.mFavoriteSession = new ZoweNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null);
        this.mFavoriteSession.contextValue = "favorite";
        this.mSessionNodes = [this.mFavoriteSession];
    }

    /**
     * Takes argument of type ZoweNode and returns it converted to a general [TreeItem]
     *
     * @param {ZoweNode} element
     * @returns {vscode.TreeItem}
     */
    public getTreeItem(element: ZoweNode): vscode.TreeItem {
        return element;
    }

    /**
     * Takes argument of type ZoweNode and retrieves all of the first level children
     *
     * @param {ZoweNode} [element] - Optional parameter; if not passed, returns root session nodes
     * @returns {ZoweNode[] | Promise<ZoweNode[]>}
     */
    public getChildren(element?: ZoweNode): ZoweNode[] | Promise<ZoweNode[]> {
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
     * @param {ZoweNode} element
     * @returns {vscode.ProviderResult<ZoweNode>}
     */
    public getParent(element: ZoweNode): vscode.ProviderResult<ZoweNode> {
        return element.mParent;
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
        if (this.mSessionNodes.find((tempNode) => tempNode.mLabel === zosmfProfile.name)) {
            return;
        }

        // Uses loaded profile to create a zosmf session with brightside
        const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

        // Creates ZoweNode to track new session and pushes it to mSessionNodes
        const node = new ZoweNode(zosmfProfile.name, vscode.TreeItemCollapsibleState.Collapsed, null, session);
        node.contextValue = "session";
        this.mSessionNodes.push(node);
        this.refresh();
    }

    /**
     * Removes a session from the list in the data set tree
     *
     * @param {ZoweNode} [node]
     */
    public deleteSession(node: ZoweNode) {
        // Removes deleted session from mSessionNodes
        this.mSessionNodes = this.mSessionNodes.filter((tempNode) => tempNode.label !== node.label);
        this.refresh();
    }

    /**
     * Adds a node to the favorites list
     *
     * @param {ZoweNode} node
     */
    public async addFavorite(node: ZoweNode) {
        let temp: ZoweNode;
        if (node.contextValue === "member") {
            if (node.mParent.contextValue === "pdsf") {
                vscode.window.showInformationMessage("PDS already in favorites");
                return;
            }
            this.addFavorite(node.mParent);
            return;
        } else if (node.contextValue === "session") {
            temp = new ZoweNode("[" + node.getSessionNode().mLabel + "]: " + node.pattern, vscode.TreeItemCollapsibleState.None,
                this.mFavoriteSession, node.getSession());
            temp.contextValue = "sessionf";
            // add a command to execute the search
            temp.command = {command: "zowe.pattern", title: "", arguments: [temp]};
            const light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
            const dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
            temp.iconPath = {light, dark};
        } else {    // pds | ds
            temp = new ZoweNode("[" + node.getSessionNode().mLabel + "]: " + node.mLabel, node.collapsibleState,
                this.mFavoriteSession, node.getSession());
            temp.contextValue += "f";
            if (temp.contextValue === "dsf") {
                temp.command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [temp]};
            }
        }

        if (!this.mFavorites.find((tempNode) =>
            (tempNode.mLabel === temp.mLabel) && (tempNode.contextValue === temp.contextValue)
        )) {
            this.mFavorites.push(temp);
            this.refresh();
            await this.updateFavorites();
        }
    }

    /**
     * Removes a node from the favorites list
     *
     * @param {ZoweNode} node
     */
    public async removeFavorite(node: ZoweNode) {
        this.mFavorites = this.mFavorites.filter((temp) =>
            !((temp.mLabel === node.mLabel) && (temp.contextValue.startsWith(node.contextValue)))
        );
        this.refresh();
        await this.updateFavorites();
    }

    public async updateFavorites() {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration().get("Zowe-Persistent-Favorites") };
        if (settings.persistence) {
            settings.favorites = this.mFavorites.map((fav) =>
                fav.mLabel + "{" + fav.contextValue.slice(0, -1) + "}"
            );
            await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites", settings, vscode.ConfigurationTarget.Global);
        }
    }
}
