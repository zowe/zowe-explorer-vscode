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

import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import * as imperative from "@zowe/imperative";
import * as globals from "../../src/globals";

export function generateDatasetSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const datasetNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded,
        null, session, undefined, undefined, profile);
    datasetNode.contextValue = globals.DS_SESSION_CONTEXT;

    return datasetNode;
}

export function generateDatasetTree(sessionNode: ZoweDatasetNode, treeView: any): any {
    const testDatasetTree = {
        mSessionNodes: [],
        mFavorites: [],
        treeView,
        addSession: jest.fn(),
        addHistory: jest.fn(),
        addRecall: jest.fn(),
        getHistory: jest.fn(),
        getRecall: jest.fn(),
        refresh: jest.fn(),
        refreshElement: jest.fn(),
        checkCurrentProfile: jest.fn(),
        getChildren: jest.fn(),
        createFilterString: jest.fn(),
        setItem: jest.fn(),
        getTreeView: jest.fn(),
        searchInLoadedItems: jest.fn(),
        removeFavorite: jest.fn(),
        removeRecall: jest.fn(),
        enterPattern: jest.fn(),
        initializeFavorites: jest.fn(),
        openItemFromPath: jest.fn(),
        renameFavorite: jest.fn(),
        updateFavorites: jest.fn(),
        renameNode: jest.fn(),
        findFavoritedNode: jest.fn(),
        findNonFavoritedNode: jest.fn(),
        getProfileName: jest.fn(),
        getSession: jest.fn(),
        getProfiles: jest.fn()
    };
    testDatasetTree.mSessionNodes = [];
    testDatasetTree.mSessionNodes.push(sessionNode);

    return testDatasetTree;
}
