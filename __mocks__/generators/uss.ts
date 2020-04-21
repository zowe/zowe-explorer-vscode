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
import { USS_SESSION_CONTEXT, FAVORITE_CONTEXT, DS_TEXT_FILE_CONTEXT, FAV_SUFFIX } from "../../src/globals";

const mockUSSRefresh = jest.fn();
const mockAddZoweSession = jest.fn();
const mockAddRecall = jest.fn();
const mockRemoveRecall = jest.fn();
const mockCheckCurrentProfile = jest.fn();
const mockUSSRefreshElement = jest.fn();
const mockGetUSSChildren = jest.fn();
const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockInitializeFavorites = jest.fn();
const mockGetTreeView = jest.fn();

export function generateUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView: any): any {
    const testUSSTree = {
            mSessionNodes: [],
            mFavorites: favoriteNodes,
            addSession: mockAddZoweSession,
            refresh: mockUSSRefresh,
            refreshAll: mockUSSRefresh,
            removeRecall: mockRemoveRecall,
            addRecall: mockAddRecall,
            getTreeView: mockGetTreeView,
            treeView: treeView,
            checkCurrentProfile: mockCheckCurrentProfile,
            refreshElement: mockUSSRefreshElement,
            getChildren: mockGetUSSChildren,
            addFavorite: mockAddFavorite,
            removeFavorite: mockRemoveFavorite,
            initializeUSSFavorites: mockInitializeFavorites
        };
    testUSSTree.mSessionNodes = [];
    sessionNodes.forEach((theNode) => testUSSTree.mSessionNodes.push(theNode));
    return testUSSTree;
}

export function generateUSSNode(session, profile) {
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profile.name);
    ussNode.contextValue = USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    return ussNode;
}

export function generateFavoriteUSSNode(session, profile) {
    const ussNodeF = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    const mParent = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profile.name);
    mParent.contextValue = FAVORITE_CONTEXT;
    ussNodeF.contextValue = DS_TEXT_FILE_CONTEXT + FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}