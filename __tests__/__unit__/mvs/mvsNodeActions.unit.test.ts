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

const mockRefresh = jest.fn();
const showOpenDialog = jest.fn();
const openTextDocument = jest.fn();

Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
const DatasetTree = jest.fn().mockImplementation(() => {
    return {
        mSessionNodes: [],
        mFavorites: [],
        refresh: mockRefresh
    };
});

const testTree = DatasetTree();

describe("mvsNodeActions", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });
    it("should call upload dialog and upload file", async () => {
        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.Collapsed, null, null);
        const fileUri = {fsPath: "/tmp/foo"};
        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        await mvsNodeActions.uploadDialog(node, testTree);
        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refresh).toBeCalled();
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

