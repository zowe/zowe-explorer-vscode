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

export function generateUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView: any): any {
    return {
        mSessionNodes: [...sessionNodes],
        mFavorites: favoriteNodes,
        addSession: jest.fn(),
        refresh: mockUSSRefresh,
        refreshAll: mockUSSRefresh,
        removeRecall: jest.fn(),
        addRecall: jest.fn(),
        getTreeView: jest.fn(),
        treeView,
        checkCurrentProfile: jest.fn(),
        refreshElement: jest.fn(),
        getChildren: jest.fn(),
        addFavorite: jest.fn(),
        removeFavorite: jest.fn(),
        initializeUSSFavorites: jest.fn()
    };
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