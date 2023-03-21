/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as vscode from "vscode";
import { imperative } from "@zowe/cli";
import { IZoweTreeNode } from "./IZoweTreeNode";

/**
 * Common implementation of functions and methods associated with the
 * IZoweTreeNode
 *
 * @export
 * @class ZoweDatasetNode
 * @extends {vscode.TreeItem}
 */
export class ZoweTreeNode extends vscode.TreeItem {
    public command: vscode.Command;
    public fullPath = "";
    public dirty = false;
    public children: IZoweTreeNode[] = [];
    public binaryFiles = {};
    public binary = false;
    public shortLabel = "";

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {string} label - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} mCollapsibleState - file/folder
     * @param {IZoweTreeNode} mParent
     * @param {imperative..Session} session
     * @param {string} etag
     */
    public constructor(
        label: string | vscode.TreeItemLabel,
        collapsibleState: vscode.TreeItemCollapsibleState,
        private mParent: IZoweTreeNode,
        protected session: imperative.Session,
        protected profile: imperative.IProfileLoaded
    ) {
        super(label, collapsibleState);
        // TODO Check this
        if (!profile && mParent && mParent.getProfile()) {
            this.profile = mParent.getProfile();
        }
    }

    /**
     * Retrieves parent node of this IZoweTreeNode
     *
     * @returns {Promise<IZoweTreeNode>}
     */
    public getParent(): IZoweTreeNode {
        return this.mParent;
    }

    /**
     * Returns the [imperative.Session] for this node
     *
     * @returns {imperative.Session}
     */
    public getSession(): imperative.Session {
        return this.session ?? this.getParent()?.getSession();
    }

    /**
     * Returns the imperative.IProfileLoaded profile for this node
     *
     * @returns {imperative.IProfileLoaded}
     */
    public getProfile(): imperative.IProfileLoaded {
        return this.profile ?? this.getParent()?.getProfile();
    }

    /**
     * Implements access to profile name
     *
     * @returns {string}
     */
    public getProfileName(): string {
        return this.getProfile()?.name;
    }

    /**
     * This is the default was that the label should be accessed as it
     * automatically trims the value
     */
    public getLabel(): string | vscode.TreeItemLabel {
        return this.label;
    }

    /**
     * Sets the imperative.IProfileLoaded profile for this node to the one chosen in parameters.
     *
     * @param {imperative.IProfileLoaded} The profile you will set the node to use
     */
    public setProfileToChoice(aProfile: imperative.IProfileLoaded): void {
        this.profile = aProfile;
    }
    /**
     * Sets the session for this node to the one chosen in parameters.
     *
     * @param aSession The session you will set the node to use
     */
    public setSessionToChoice(aSession: imperative.Session): void {
        this.session = aSession;
    }
}
