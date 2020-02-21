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
import { ZoweDatasetNode } from "../../../src/ZoweDatasetNode";
import * as extension from "../../../src/extension";
import { Session, IProfileLoaded } from "@zowe/imperative";

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

const session = new Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

const testTree = DatasetTree();
const profileOne: IProfileLoaded = { name: "profile1", profile: {}, type: "zosmf", message: "", failNotFound: false };
const sessNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileOne);

describe("mvsNodeActions", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });
    // TODO this test is actually throwing an error biut gets away with it from the tests perspective
    it("should call upload dialog and upload file", async () => {
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null, null, profileOne);
        const nodeAsFavorite = new ZoweDatasetNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed,
                                                     sessNode, null, null, extension.PDS_FAV_CONTEXT, profileOne);
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
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const nodeAsFavorite = new ZoweDatasetNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed,
                                                     sessNode, null, extension.PDS_FAV_CONTEXT);
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
            const node = new ZoweDatasetNode(labelName, vscode.TreeItemCollapsibleState.Collapsed, null, null);
            const label = mvsNodeActions.getDatasetLabel(node);
            expect(label).toEqual(labelName);
        });
        it("should return default label for dataset", () => {
            const labelNameWithProfile = "[myProfile123]: dataset.test";
            const labelName = "dataset.test";
            const parentNode = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null);
            parentNode.contextValue = extension.FAVORITE_CONTEXT;
            const node = new ZoweDatasetNode(labelNameWithProfile, vscode.TreeItemCollapsibleState.Collapsed, parentNode, null);
            const label = mvsNodeActions.getDatasetLabel(node);
            expect(label).toEqual(labelName);
        });
    });
});

