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
import * as dsUtils from "../../../src/dataset/utils";
import * as dsActions from "../../../src/dataset/actions";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { Session, IProfileLoaded } from "@zowe/imperative";
import { PDS_FAV_CONTEXT, FAVORITE_CONTEXT } from "../../../src/globals";

const mockRefresh = jest.fn();
const showOpenDialog = jest.fn();
const showInformationMessage = jest.fn();
const openTextDocument = jest.fn();
const mockRefreshElement = jest.fn();
const mockFindFavoritedNode = jest.fn();
const mockFindNonFavoritedNode = jest.fn();

Object.defineProperty(vscode.window, "showOpenDialog", { value: showOpenDialog });
Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: openTextDocument });
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
            sessNode, null, null, PDS_FAV_CONTEXT, profileOne);
        testTree.mFavorites.push(nodeAsFavorite);
        const fileUri = { fsPath: "/tmp/foo" };

        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        mockFindFavoritedNode.mockReturnValue(nodeAsFavorite);

        await dsActions.uploadDialog(node, testTree);

        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refreshElement).toBeCalledWith(node);
        expect(testTree.refreshElement).toBeCalledWith(nodeAsFavorite);
    });
    it("shouldn't call upload dialog and not upload file if selection is empty", async () => {
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null, null, profileOne);
        const nodeAsFavorite = new ZoweDatasetNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed,
            sessNode, null, null, PDS_FAV_CONTEXT, profileOne);
        testTree.mFavorites.push(nodeAsFavorite);

        showOpenDialog.mockReturnValue(undefined);

        await dsActions.uploadDialog(node, testTree);

        expect(showOpenDialog).toBeCalled();
        expect(showInformationMessage.mock.calls.map((call) => call[0])).toEqual(["No selection made."]);
        expect(openTextDocument).not.toBeCalled();
        expect(testTree.refreshElement).not.toBeCalled();
    });
    it("should call upload dialog and upload file (from favorites)", async () => {
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const nodeAsFavorite = new ZoweDatasetNode("[sestest]: node", vscode.TreeItemCollapsibleState.Collapsed,
            sessNode, null, PDS_FAV_CONTEXT);
        testTree.mFavorites.push(nodeAsFavorite);
        const fileUri = { fsPath: "/tmp/foo" };

        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        mockFindNonFavoritedNode.mockReturnValue(node);

        await dsActions.uploadDialog(nodeAsFavorite, testTree);

        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refreshElement).toBeCalledWith(node);
        expect(testTree.refreshElement).toBeCalledWith(nodeAsFavorite);
    });
});

