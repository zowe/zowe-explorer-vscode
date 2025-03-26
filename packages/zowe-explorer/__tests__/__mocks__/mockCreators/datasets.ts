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

import * as vscode from "vscode";
import { Constants } from "../../../src/configuration/Constants";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { removeNodeFromArray } from "./shared";
import { imperative, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { DatasetTree } from "../../../src/trees/dataset/DatasetTree";
import { ZowePersistentFilters } from "../../../src/tools/ZowePersistentFilters";

export function createDatasetSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const datasetNode = new ZoweDatasetNode({
        label: "sestest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session,
        profile,
    });
    datasetNode.contextValue = Constants.DS_SESSION_CONTEXT;

    return datasetNode;
}

export function createDatasetFavoritesNode() {
    const datasetNode = new ZoweDatasetNode({
        label: "Favorites",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
    datasetNode.contextValue = Constants.FAVORITE_CONTEXT;

    return datasetNode;
}

export function createDatasetTree(sessionNode: ZoweDatasetNode, treeView: any, favoritesNode?: ZoweDatasetNode): any {
    jest.spyOn(ZowePersistentFilters.prototype as any, "initialize").mockReturnValueOnce(undefined);
    const testDatasetTree = new DatasetTree();
    Object.assign(testDatasetTree, {
        mSessionNodes: [sessionNode],
        mFavorites: [],
        mFileHistory: [],
        mHistory: [],
        mOnDidChangeTreeData: {
            fire: jest.fn(),
        },
        treeView,
        addSession: jest.fn(),
        addSearchHistory: jest.fn(),
        addFileHistory: jest.fn().mockImplementation((newFile) => testDatasetTree.mFileHistory.push(newFile)),
        addFavorite: jest.fn().mockImplementation((newFavorite) => testDatasetTree.mFavorites.push(newFavorite)),
        getSearchHistory: jest.fn(),
        getFileHistory: jest.fn().mockImplementation(() => testDatasetTree.mFileHistory),
        getSessions: jest.fn().mockReturnValue([]),
        getFavorites: jest.fn(),
        removeSearchHistory: jest.fn(),
        resetSearchHistory: jest.fn(),
        resetFileHistory: jest.fn(),
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
        removeFavorite: jest.fn().mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testDatasetTree.mFavorites)),
        removeFavProfile: jest.fn().mockImplementation((badFavProfileName) => {
            const badFavProfileNode = testDatasetTree.mFavorites.find((treeNode) => treeNode.label === badFavProfileName);
            removeNodeFromArray(badFavProfileNode, testDatasetTree.mFavorites);
        }),
        deleteSession: jest.fn().mockImplementation((badSession) => removeNodeFromArray(badSession, testDatasetTree.mSessionNodes)),
        removeFileHistory: jest
            .fn()
            .mockImplementation((badFile) => testDatasetTree.mFileHistory.splice(testDatasetTree.mFileHistory.indexOf(badFile), 1)),
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
        getProfile: jest.fn(),
        getDsTemplates: jest.fn(),
        addDsTemplate: jest.fn(),
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
