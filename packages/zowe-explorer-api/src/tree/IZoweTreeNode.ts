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

export enum NodeAction {
    Download = "download",
}

/**
 * The base interface for Zowe tree nodes that are implemented by vscode.TreeItem.
 *
 * @export
 * @interface IZoweTreeNode
 */
export interface IZoweTreeNode extends vscode.TreeItem {
    /**
     * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
     */
    iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
    /**
     * Indicator that the child data may have become stale and requires refreshing.
     */
    dirty: boolean;
    /**
     *  A human-readable string describing this item.
     */
    label?: string | vscode.TreeItemLabel;
    /**
     * A description for this tree item.
     */
    description?: string | boolean;
    /**
     * A unique identifier for this tree item.
     * Used to prevent VScode from losing track of TreeItems in a TreeProvider.
     */
    id?: string;
    /**
     * The tooltip text when you hover over this item.
     */
    tooltip?: string | vscode.MarkdownString | undefined;
    /**
     * Describes the full path of a file
     */
    fullPath?: string;
    /**
     * Children nodes of this node
     */
    children?: IZoweTreeNode[];
    /**
     * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
     */
    collapsibleState?: vscode.TreeItemCollapsibleState;
    /**
     * Context value of the tree item. This can be used to contribute item specific actions in the tree.
     *
     * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
     */
    contextValue?: string;
    /**
     * Any ongoing actions that must be awaited before continuing
     */
    ongoingActions?: Record<NodeAction | string, Promise<any>>;
    /**
     * whether the node was double-clicked
     */
    wasDoubleClicked?: boolean;
    /**
     * Retrieves the node label
     */
    getLabel(): string | vscode.TreeItemLabel;
    /**
     * Retrieves the nodes parent node
     */
    getParent(): IZoweTreeNode;
    /**
     * Retrieves the nodes children nodes
     */
    getChildren(): Promise<IZoweTreeNode[]>;
    /**
     * Retrieves the profile name in use with this node
     */
    getProfileName(): string;
    /**
     * Retrieves the session node in use with this node
     */
    getSessionNode(): IZoweTreeNode;
    /**
     * Retrieves the session object in use with this node
     */
    getSession(): imperative.Session;
    /**
     * Retrieves the profile object in use with this node
     */
    getProfile(): imperative.IProfileLoaded;
    /**
     * Set the profile to use for this node to be the one chosen in the parameters
     *
     * @param profileObj The profile you will set the node to use
     */
    setProfileToChoice(profileObj: imperative.IProfileLoaded): void;
    /**
     * Set the session to use for this node to be the one chosen in the parameters
     *
     * @param sessionObj The session you will set the node to use
     */
    setSessionToChoice(sessionObj: imperative.Session): void;
}
