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
import * as dsActions from "../../../src/dataset/actions";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as globals from "../../../src/globals";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import { createIProfile, createISession, createTreeView } from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

async function createGlobalMocks() {
    const newMocks = {
        mockRefresh: jest.fn(),
        showOpenDialog: jest.fn(),
        showInformationMessage: jest.fn(),
        openTextDocument: jest.fn(),
        mockRefreshElement: jest.fn(),
        mockFindFavoritedNode: jest.fn(),
        mockFindNonFavoritedNode: jest.fn(),
        mockUploadFile: jest.fn(),
        treeView: createTreeView(),
        session: createISession(),
        profileOne: createIProfile(),
    };

    Object.defineProperty(vscode.window, "showOpenDialog", { value: newMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: newMocks.openTextDocument, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((progLocation, callback) => {
            const progress = {
                report: (message) => {
                    return;
                },
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: undefined,
            };
            return callback(progress, token);
        }),
        configurable: true,
    });

    const mockMvsApi = await ZoweExplorerApiRegister.getMvsApi(newMocks.profileOne);
    const getMvsApiMock = jest.fn();
    getMvsApiMock.mockReturnValue(mockMvsApi);
    ZoweExplorerApiRegister.getMvsApi = getMvsApiMock.bind(ZoweExplorerApiRegister);
    jest.spyOn(mockMvsApi, "putContents").mockResolvedValue({
        success: true,
        commandResponse: "",
        apiResponse: {},
    });

    return newMocks;
}

describe("mvsNodeActions", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            sessNode: createDatasetSessionNode(globalMocks.session, globalMocks.profileOne),
        };
        return newMocks;
    }
    afterEach(() => {
        jest.clearAllMocks();
    });
    it("should call upload dialog and upload file from session node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
        });
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };
        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);

        await dsActions.uploadDialog(node, testTree);

        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(testTree.refreshElement).toHaveBeenCalledWith(node);
    });
    it("should call upload dialog and upload file from favorites node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
        });
        const nodeAsFavorite = new ZoweDatasetNode({
            label: "[sestest]: node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });
        testTree.mFavorites.push(nodeAsFavorite);
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };

        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);
        globalMocks.mockFindNonFavoritedNode.mockReturnValueOnce(node);

        await dsActions.uploadDialog(nodeAsFavorite, testTree);

        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(testTree.refreshElement).toHaveBeenCalledWith(nodeAsFavorite);
    });
    it("shouldn't call upload dialog and not upload file if selection is empty", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
        });
        const nodeAsFavorite = new ZoweDatasetNode({
            label: "[sestest]: node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });
        testTree.mFavorites.push(nodeAsFavorite);
        globalMocks.showOpenDialog.mockReturnValueOnce(undefined);
        await dsActions.uploadDialog(node, testTree);

        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(globalMocks.showInformationMessage.mock.calls.map((call) => call[0])).toEqual(["Operation Cancelled"]);
        expect(globalMocks.openTextDocument).not.toHaveBeenCalled();
        expect(testTree.refreshElement).not.toHaveBeenCalled();
    });
    it("should cancel upload when info message cancel clicked", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
        });
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };
        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);
        Object.defineProperty(vscode.window, "withProgress", {
            value: jest.fn().mockImplementation((progLocation, callback) => {
                const progress = {
                    report: (message) => {
                        return;
                    },
                };
                const token = {
                    isCancellationRequested: true,
                    onCancellationRequested: undefined,
                };
                return callback(progress, token);
            }),
            configurable: true,
        });

        await dsActions.uploadDialog(node, testTree);

        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(globalMocks.openTextDocument).not.toHaveBeenCalled();
        expect(testTree.refreshElement).toHaveBeenCalledWith(node);
    });
    it("should return error from host", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
        });
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };
        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);
        const mockMvsApi2 = await ZoweExplorerApiRegister.getMvsApi(globalMocks.profileOne);
        const getMvsApiMock2 = jest.fn();
        getMvsApiMock2.mockReturnValue(mockMvsApi2);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock2.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockMvsApi2, "putContents").mockResolvedValue({
            success: false,
            commandResponse: "",
            apiResponse: {},
        });
        const errHandlerSpy = jest.spyOn(profUtils, "errorHandling").mockImplementation();
        await dsActions.uploadDialog(node, testTree);

        expect(errHandlerSpy).toHaveBeenCalled();
    });
    it("should return error from rejected promise", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testTree = createDatasetTree(blockMocks.sessNode, globalMocks.treeView);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.sessNode,
            profile: globalMocks.profileOne,
        });
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };
        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);
        const mockMvsApi2 = await ZoweExplorerApiRegister.getMvsApi(globalMocks.profileOne);
        const getMvsApiMock2 = jest.fn();
        getMvsApiMock2.mockReturnValue(mockMvsApi2);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock2.bind(ZoweExplorerApiRegister);
        const testError = new Error("putContents failed");
        jest.spyOn(mockMvsApi2, "putContents").mockRejectedValue(testError);
        const errHandlerSpy = jest.spyOn(profUtils, "errorHandling").mockImplementation();
        await dsActions.uploadDialog(node, testTree);

        expect(errHandlerSpy).toHaveBeenCalledWith(testError, "sestest");
    });
});
