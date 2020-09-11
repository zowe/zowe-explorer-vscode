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

import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as imperative from "@zowe/imperative";
import * as vscode from "vscode";
import * as globals from "../../src/globals";
import { ZoweTreeProvider } from "../../src/abstract/ZoweTreeProvider";
import { getIconByNode } from "../../src/generators/icons";
import { removeNodeFromArray } from "./shared";
import { USSTree } from "../../src/uss/USSTree";

export function createUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView?: vscode.TreeView<ZoweTreeProvider>): USSTree {
    const newTree = new USSTree();
    newTree.mSessionNodes = [...sessionNodes];
    newTree.mFavorites = favoriteNodes;
    newTree.addSession = jest.fn();
    newTree.refresh = jest.fn();
    newTree.checkCurrentProfile = jest.fn();
    newTree.refreshElement = jest.fn();
    newTree.getChildren = jest.fn();
    newTree.addFavorite = jest.fn().mockImplementation((newFavorite) => newTree.mFavorites.push(newFavorite));
    newTree.removeFavorite = jest.fn().mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, newTree.mFavorites));
    newTree.openItemFromPath = jest.fn();
    newTree.deleteSession = jest.fn().mockImplementation((badSession) => removeNodeFromArray(badSession, newTree.mSessionNodes));
    newTree.getAllLoadedItems = jest.fn();
    newTree.getTreeView = jest.fn().mockImplementation(() => treeView);
    newTree.getTreeItem = jest.fn().mockImplementation(() => new vscode.TreeItem("test"));
    newTree.getTreeType = jest.fn().mockImplementation(() => globals.PersistenceSchemaEnum.USS);
    newTree.setItem = jest.fn();
    newTree.addSearchHistory = jest.fn();

    return newTree;
}

export function createUSSNode(session, profile) {
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profile.name);
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    return ussNode;
}

export function createUSSSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const zoweUSSNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed, null,
        session, "/", false, profile.name, undefined, profile);
    zoweUSSNode.fullPath = "test";
    zoweUSSNode.contextValue = globals.USS_SESSION_CONTEXT;
    const targetIcon = getIconByNode(zoweUSSNode);
    if (targetIcon) {
        zoweUSSNode.iconPath = targetIcon.path;
    }

    return zoweUSSNode;
}

// This is NOT a favorite equivalent of the node created by createdUSSNode.
// This is a favorited textfile node. createUSSNode creates a USS session node.
export function createFavoriteUSSNode(session, profile) {
    const ussNodeF = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const mParent = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    mParent.contextValue = globals.FAV_PROFILE_CONTEXT;
    ussNodeF.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}
