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

export function generateUSSSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const zoweUSSNode = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, null,
        session, "/", false, profile.name, undefined, profile);
    zoweUSSNode.contextValue = globals.USS_SESSION_CONTEXT;

    return zoweUSSNode;
}

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