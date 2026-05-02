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
import { vi } from "vitest";

import * as vscode from "vscode";
import { Constants } from "../../../src/configuration/Constants";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";
import { USSTree } from "../../../src/trees/uss/USSTree";
import { IconGenerator } from "../../../src/icons/IconGenerator";
import { removeNodeFromArray } from "./shared";
import { imperative, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweTreeProvider } from "../../../src/providers/ZoweTreeProvider";

export function createUSSTree(favoriteNodes: ZoweUSSNode[], sessionNodes: ZoweUSSNode[], treeView?: vscode.TreeView<ZoweTreeProvider>): USSTree {
    const newTree = new USSTree();
    newTree.mSessionNodes = [...sessionNodes];
    newTree.mFavorites = favoriteNodes;
    newTree.addSession = vi.fn();
    newTree.getSessions = vi.fn().mockReturnValue([]);
    newTree.getFavorites = vi.fn();
    newTree.getSearchHistory = vi.fn();
    newTree.removeSearchHistory = vi.fn();
    newTree.resetSearchHistory = vi.fn();
    newTree.resetFileHistory = vi.fn();
    newTree.refresh = vi.fn();
    newTree.nodeDataChanged = vi.fn();
    newTree.checkCurrentProfile = vi.fn();
    newTree.refreshElement = vi.fn();
    newTree.getChildren = vi.fn();
    newTree.addFavorite = vi.fn().mockImplementation((newFavorite) => newTree.mFavorites.push(newFavorite));
    newTree.removeFavorite = vi.fn().mockImplementation((badFavorite) => removeNodeFromArray(badFavorite, newTree.mFavorites));
    newTree.openItemFromPath = vi.fn();
    newTree.deleteSession = vi.fn().mockImplementation((badSession) => removeNodeFromArray(badSession, newTree.mSessionNodes));
    newTree.getAllLoadedItems = vi.fn();
    newTree.getTreeView = vi.fn().mockImplementation(() => treeView);
    newTree.getTreeItem = vi.fn().mockImplementation(() => new vscode.TreeItem("test"));
    newTree.getTreeType = vi.fn().mockImplementation(() => PersistenceSchemaEnum.USS);
    newTree.setItem = vi.fn();
    newTree.addSearchHistory = vi.fn();
    newTree.getFileHistory = vi.fn();

    return newTree;
}

export function createUSSNode(session, profile) {
    const parentNode = new ZoweUSSNode({
        label: "sestest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session,
        profile,
        contextOverride: Constants.USS_SESSION_CONTEXT,
    });
    parentNode.fullPath = "/u/myuser";
    const ussNode = new ZoweUSSNode({
        label: "usstest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        parentNode,
        parentPath: parentNode.fullPath,
        profile,
        contextOverride: Constants.USS_DIR_CONTEXT,
    });
    ussNode.fullPath = "/u/myuser/usstest";
    return ussNode;
}

export function createUSSSessionNode(session: imperative.Session, profile: imperative.IProfileLoaded) {
    const zoweUSSNode = new ZoweUSSNode({
        label: "sestest",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        session,
        profile,
    });
    zoweUSSNode.fullPath = "/test";
    zoweUSSNode.contextValue = Constants.USS_SESSION_CONTEXT;
    const targetIcon = IconGenerator.getIconByNode(zoweUSSNode);
    if (targetIcon) {
        zoweUSSNode.iconPath = targetIcon.path;
    }

    return zoweUSSNode;
}

// This is NOT a favorite equivalent of the node created by createdUSSNode.
// This is a favorited textfile node. createUSSNode creates a USS session node.
export function createFavoriteUSSNode(session, profile) {
    const parentNode = new ZoweUSSNode({
        label: "parentNode",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session,
        profile,
    });
    const ussNodeF = new ZoweUSSNode({
        label: "usstest",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        parentNode,
        session,
        profile,
    });
    parentNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
    ussNodeF.contextValue = Constants.USS_TEXT_FILE_CONTEXT + Constants.FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}
