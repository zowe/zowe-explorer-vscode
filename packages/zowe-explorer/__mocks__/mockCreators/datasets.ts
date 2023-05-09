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

import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import { imperative } from "@zowe/cli";
import * as globals from "../../src/globals";
import { removeNodeFromArray } from "./shared";
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";

export function createDatasetSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const datasetNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profile);
    datasetNode.contextValue = globals.DS_SESSION_CONTEXT;

    return datasetNode;
}

export function createDatasetFavoritesNode() {
    const datasetNode = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null);
    datasetNode.contextValue = globals.FAVORITE_CONTEXT;

    return datasetNode;
}

export function createDatasetTree(sessionNode: ZoweDatasetNode, treeView: any, favoritesNode?: ZoweDatasetNode): any {
    const testDatasetTree = {
        mSessionNodes: [sessionNode],
        mFavorites: [],
        mFileHistory: [],
        mHistory: [],
        treeView,
        addSession: jest.fn(),
        addSearchHistory: jest.fn(),
        addFileHistory: jest.fn(),
        addFavorite: jest.fn(),
        getSearchHistory: jest.fn(),
        getFileHistory: jest.fn(),
        refresh: jest.fn(),
        refreshElement: jest.fn(),
        checkCurrentProfile: jest.fn(),
        getChildren: jest.fn(),
        getTreeType: jest.fn().mockReturnValue(PersistenceSchemaEnum.Dataset),
        createZoweSchema: jest.fn(),
        createZoweSession: jest.fn(),
        createFilterString: jest.fn(),
        setItem: jest.fn(),
        getTreeView: jest.fn().mockReturnValue(treeView),
        getAllLoadedItems: jest.fn(),
        removeFavorite: jest.fn(),
        removeFavProfile: jest.fn(),
        deleteSession: jest.fn(),
        removeFileHistory: jest.fn(),
        enterPattern: jest.fn(),
        initializeFavorites: jest.fn(),
        openItemFromPath: jest.fn(),
        renameFavorite: jest.fn(),
        updateFavorites: jest.fn(),
        renameNode: jest.fn(),
        findFavoritedNode: jest.fn(),
        findNonFavoritedNode: jest.fn(),
        findEquivalentNode: jest.fn(),
        getProfileName: jest.fn(),
        getSession: jest.fn(),
        getProfiles: jest.fn(),
        getDsTemplates: jest.fn(),
        addDsTemplate: jest.fn(),
    };
    testDatasetTree.addFavorite.mockImplementation((newFavorite) => testDatasetTree.mFavorites.push(newFavorite));
    testDatasetTree.addFileHistory.mockImplementation((newFile) => testDatasetTree.mFileHistory.push(newFile));
    testDatasetTree.removeFileHistory.mockImplementation((badFile) =>
        testDatasetTree.mFileHistory.splice(testDatasetTree.mFileHistory.indexOf(badFile), 1)
    );
    testDatasetTree.getFileHistory.mockImplementation(() => testDatasetTree.mFileHistory);
    testDatasetTree.deleteSession.mockImplementation((badSession) => removeNodeFromArray(badSession, testDatasetTree.mSessionNodes));
    testDatasetTree.removeFavorite.mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testDatasetTree.mFavorites));
    testDatasetTree.removeFavProfile.mockImplementation((badFavProfileName) => {
        const badFavProfileNode = testDatasetTree.mFavorites.find((treeNode) => treeNode.label === badFavProfileName);
        removeNodeFromArray(badFavProfileNode, testDatasetTree.mFavorites);
    });
    if (!favoritesNode) {
        return testDatasetTree;
    }
    testDatasetTree.mSessionNodes.push(favoritesNode);
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
        vols: "3BP001",
    };
}

export function createDSMemberAttributes(label: string) {
    return {
        member: label,
        vers: 1,
        mod: 0,
        c4date: "2019/05/08",
        m4date: "2020/05/08",
        cnorc: 11,
        inorc: 11,
        mnorc: 0,
        mtime: "08:54",
        msec: "41",
        user: ">7CHARS",
        sclm: "N",
    };
}
