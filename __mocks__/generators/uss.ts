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