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
import * as vscode from "vscode";
import * as globals from "../../src/globals";
import { getIconByNode } from "../../src/generators/icons";

const mockUSSRefresh = jest.fn();
export function generateUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView: any): any {
    return {
        mSessionNodes: [...sessionNodes],
        mFavorites: favoriteNodes,
        addSession: jest.fn(),
        refresh: mockUSSRefresh,
        refreshAll: mockUSSRefresh,
        removeRecall: jest.fn(),
        addRecall: jest.fn(),
        treeView,
        checkCurrentProfile: jest.fn(),
        refreshElement: jest.fn(),
        getChildren: jest.fn(),
        addFavorite: jest.fn(),
        removeFavorite: jest.fn(),
        initializeUSSFavorites: jest.fn(),
        searchInLoadedItems: jest.fn(),
        getTreeView: jest.fn().mockImplementation(() => treeView),
        setItem: jest.fn(),
        addHistory: jest.fn()
    };
}

export function generateUSSNode(session, profile) {
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profile.name);
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    return ussNode;
}

export function generateFavoriteUSSNode(session, profile) {
    const ussNodeF = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const mParent = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    mParent.contextValue = globals.FAVORITE_CONTEXT;
    ussNodeF.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}

export function addSessionNode(theTree, theSession, theProfile) {
    const newSessNode = new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, theSession, null, false, theProfile.name)
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