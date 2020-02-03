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

import * as vscode from "vscode";
import * as mvsNodeActions from "../../../src/mvs/mvsNodeActions";
import { ZoweNode } from "../../../src/ZoweNode";
import * as extension from "../../../src/extension";
import * as brtimperative from "@brightside/imperative";

const mockRefresh = jest.fn();
const showOpenDialog = jest.fn();
const openTextDocument = jest.fn();
const mockRefreshElement = jest.fn();
const mockFindFavoritedNode = jest.fn();
const mockFindNonFavoritedNode = jest.fn();

Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
const DatasetTree = jest.fn().mockImplementation(() => {
    return {
        mSessionNodes: [],
        mFavorites: [],
        refresh: mockRefresh,
        refreshElement: mockRefreshElement,
        findFavoritedNode: mockFindFavoritedNode,
        findNonFavoritedNode: mockFindNonFavoritedNode
    };
});

const session = new brtimperative.Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

const testTree = DatasetTree();
const sessNode = new ZoweNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session);

describe("mvsNodeActions", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });
    it("should call upload dialog and upload file", async () => {
        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const nodeAsFavorite = new ZoweNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, extension.PDS_FAV_CONTEXT);
        testTree.mFavorites.push(nodeAsFavorite);
        const fileUri = {fsPath: "/tmp/foo"};

        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        mockFindFavoritedNode.mockReturnValue(nodeAsFavorite);

        await mvsNodeActions.uploadDialog(node, testTree);

        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refreshElement).toBeCalledWith(node);
        expect(testTree.refreshElement).toBeCalledWith(nodeAsFavorite);
    });
    it("should call upload dialog and upload file (from favorites)", async () => {
        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const nodeAsFavorite = new ZoweNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, extension.PDS_FAV_CONTEXT);
        testTree.mFavorites.push(nodeAsFavorite);
        const fileUri = {fsPath: "/tmp/foo"};

        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        mockFindNonFavoritedNode.mockReturnValue(node);

        await mvsNodeActions.uploadDialog(nodeAsFavorite, testTree);

        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refreshElement).toBeCalledWith(node);
        expect(testTree.refreshElement).toBeCalledWith(nodeAsFavorite);
    });
    describe("getDatasetLabel", () => {
        afterEach(() => {
            jest.resetAllMocks();
        });
        it("should return default label for dataset", () => {
            const labelName = "dataset.test";
            const node = new ZoweNode(labelName, vscode.TreeItemCollapsibleState.Collapsed, null, null);
            const label = mvsNodeActions.getDatasetLabel(node);
            expect(label).toEqual(labelName);
        });
        it("should return default label for dataset", () => {
            const labelNameWithProfile = "[myProfile123]: dataset.test";
            const labelName = "dataset.test";
            const parentNode = new ZoweNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null);
            parentNode.contextValue = extension.FAVORITE_CONTEXT;
            const node = new ZoweNode(labelNameWithProfile, vscode.TreeItemCollapsibleState.Collapsed, parentNode, null);
            const label = mvsNodeActions.getDatasetLabel(node);
            expect(label).toEqual(labelName);
        });
    });
});

