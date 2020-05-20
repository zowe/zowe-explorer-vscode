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
import { USSTree } from "../../src/__mocks__/USSTree";
import { getIconByNode } from "../../src/generators/icons";

export function createUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView?: vscode.TreeView<ZoweTreeProvider>): USSTree {
    let newTree = new USSTree();
    newTree.mSessionNodes = [...sessionNodes];
    newTree.mFavorites = favoriteNodes;
    newTree.addSession = jest.fn();
    newTree.refresh = jest.fn();
    newTree.removeRecall = jest.fn();
    newTree.addRecall = jest.fn();
    newTree.checkCurrentProfile = jest.fn();
    newTree.refreshElement = jest.fn();
    newTree.getChildren = jest.fn();
    newTree.addFavorite = jest.fn();
    newTree.removeFavorite = jest.fn();
    newTree.searchInLoadedItems = jest.fn();
    newTree.getTreeView = jest.fn().mockImplementation(() => treeView);
    newTree.setItem = jest.fn();
    newTree.addHistory = jest.fn();
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
    const zoweUSSNode = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, null,
        session, "/", false, profile.name, undefined, profile);
    zoweUSSNode.contextValue = globals.USS_SESSION_CONTEXT;

    return zoweUSSNode;
}

export function createFavoriteUSSNode(session, profile) {
    const ussNodeF = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const mParent = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    mParent.contextValue = globals.FAVORITE_CONTEXT;
    ussNodeF.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}

export function addSessionNode(theTree, theSession, theProfile) {
    const newSessNode = new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, theSession, null, false, theProfile.name);
    theTree.mSessionNodes.push(newSessNode);
    const sessionIndex = theTree.mSessionNodes.length - 1;
    theTree.mSessionNodes[sessionIndex].contextValue = globals.USS_SESSION_CONTEXT;
    theTree.mSessionNodes[sessionIndex].fullPath = "test";
    const targetIcon = getIconByNode(theTree.mSessionNodes[sessionIndex]);
    if (targetIcon) {
        theTree.mSessionNodes[1].iconPath = targetIcon.path;
    }
    return theTree;
}