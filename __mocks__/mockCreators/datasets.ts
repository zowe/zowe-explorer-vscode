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
import { removeNodeFromArray } from "./shared";

export function createDatasetSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const datasetNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded,
        null, session, undefined, undefined, profile);
    datasetNode.contextValue = globals.DS_SESSION_CONTEXT;

    return datasetNode;
}

export function createDatasetTree(sessionNode: ZoweDatasetNode, treeView: any): any {
    const testDatasetTree = {
        mSessionNodes: [sessionNode],
        mFavorites: [],
        mRecall: [],
        treeView,
        addSession: jest.fn(),
        addHistory: jest.fn(),
        addRecall: jest.fn(),
        addFavorite: jest.fn(),
        getHistory: jest.fn(),
        getRecall: jest.fn(),
        refresh: jest.fn(),
        refreshElement: jest.fn(),
        checkCurrentProfile: jest.fn(),
        getChildren: jest.fn(),
        getTreeType: jest.fn().mockImplementation(() => globals.PersistenceSchemaEnum.Dataset),
        createZoweSession: jest.fn(),
        createFilterString: jest.fn(),
        setItem: jest.fn(),
        getTreeView: jest.fn().mockImplementation(() => treeView),
        searchInLoadedItems: jest.fn(),
        removeFavorite: jest.fn(),
        deleteSession: jest.fn(),
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
    testDatasetTree.addFavorite.mockImplementation((newFavorite) => testDatasetTree.mFavorites.push(newFavorite));
    testDatasetTree.addRecall.mockImplementation((newRecall) => testDatasetTree.mRecall.push(newRecall));
    testDatasetTree.removeRecall.mockImplementation((badRecall) => testDatasetTree.mRecall.splice(testDatasetTree.mRecall.indexOf(badRecall), 1));
    testDatasetTree.getRecall.mockImplementation(() => { return testDatasetTree.mRecall });
    testDatasetTree.deleteSession.mockImplementation((badSession) => removeNodeFromArray(badSession, testDatasetTree.mSessionNodes));
    testDatasetTree.removeFavorite.mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testDatasetTree.mFavorites));

    return testDatasetTree;
}

export function createDatasetAttributes(label: string, context: string) {
    return {
        blksz: "6160",
        catnm: "ICFCAT.MV3B.CATALOGA",
        cdate: "2019/05/08",
        dev: "3390",
        dsname: label,
        dsntp: context,
        dsorg: "PO",
        edate: "***None***",
        extx: "1",
        lrecl: "80",
        migr: "NO",
        mvol: "N",
        ovf: "NO",
        rdate: "2019/07/17",
        recfm: "FB",
        sizex: "15",
        spacu: "CYLINDERS",
        used: "6",
        vol: "3BP001",
        vols: "3BP001"
    };
}
