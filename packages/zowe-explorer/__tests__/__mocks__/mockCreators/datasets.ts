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
    vi.spyOn(ZowePersistentFilters.prototype as any, "initialize").mockReturnValueOnce(undefined);
    const testDatasetTree = new DatasetTree();
    Object.assign(testDatasetTree, {
        mSessionNodes: [sessionNode],
        mFavorites: [],
        mFileHistory: [],
        mPersistence: [],
        mOnDidChangeTreeData: {
            fire: vi.fn(),
        },
        treeView,
        addSession: vi.fn(),
        addSearchHistory: vi.fn(),
        addFileHistory: vi.fn().mockImplementation((newFile) => testDatasetTree.mFileHistory.push(newFile)),
        addFavorite: vi.fn().mockImplementation((newFavorite) => testDatasetTree.mFavorites.push(newFavorite)),
        addSearchedKeywordHistory: vi.fn(),
        addSortSetting: vi.fn(),
        getSearchHistory: vi.fn(),
        getSearchedKeywordHistory: vi.fn(),
        getFileHistory: vi.fn().mockImplementation(() => testDatasetTree.mFileHistory),
        getSessions: vi.fn().mockReturnValue([]),
        getFavorites: vi.fn(),
        getSortSettings: vi.fn().mockReturnValue({}),
        removeSearchHistory: vi.fn(),
        removeSearchedKeywordHistory: vi.fn(),
        resetSearchHistory: vi.fn(),
        resetSearchedKeywordHistory: vi.fn(),
        resetFileHistory: vi.fn(),
        refresh: vi.fn(),
        refreshElement: vi.fn(),
        checkCurrentProfile: vi.fn(),
        getChildren: vi.fn(),
        getTreeType: vi.fn().mockReturnValue(PersistenceSchemaEnum.Dataset),
        createZoweSchema: vi.fn(),
        createZoweSession: vi.fn(),
        createFilterString: vi.fn(),
        setItem: vi.fn(),
        getTreeView: vi.fn().mockReturnValue(treeView),
        getAllLoadedItems: vi.fn(),
        removeFavorite: vi.fn().mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, testDatasetTree.mFavorites)),
        removeFavProfile: vi.fn().mockImplementation((badFavProfileName) => {
            const badFavProfileNode = testDatasetTree.mFavorites.find((treeNode) => treeNode.label === badFavProfileName);
            removeNodeFromArray(badFavProfileNode, testDatasetTree.mFavorites);
        }),
        deleteSession: vi.fn().mockImplementation((badSession) => removeNodeFromArray(badSession, testDatasetTree.mSessionNodes)),
        removeFileHistory: vi
            .fn()
            .mockImplementation((badFile) => testDatasetTree.mFileHistory.splice(testDatasetTree.mFileHistory.indexOf(badFile), 1)),
        enterPattern: vi.fn(),
        initializeFavorites: vi.fn(),
        openItemFromPath: vi.fn(),
        renameFavorite: vi.fn(),
        updateFavorites: vi.fn(),
        renameNode: vi.fn(),
        findFavoritedNode: vi.fn(),
        findNonFavoritedNode: vi.fn(),
        findEquivalentNode: vi.fn(),
        getProfileName: vi.fn(),
        getSession: vi.fn(),
        getProfiles: vi.fn(),
        getProfile: vi.fn(),
        getDsTemplates: vi.fn(),
        addDsTemplate: vi.fn(),
    });
    vi.spyOn(testDatasetTree, "persistence", "get").mockReturnValue({ getSortSetting: vi.fn() });
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
