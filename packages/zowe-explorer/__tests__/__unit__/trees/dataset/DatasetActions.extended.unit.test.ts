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
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { Constants } from "../../../../src/configuration/Constants";
import { createIProfile, createISession, createTreeView } from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { AuthUtils } from "../../../../src/utils/AuthUtils";

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
        showInputBox: jest.fn(),
        showErrorMessage: jest.fn(),
        showQuickPick: jest.fn(),
        getConfiguration: jest.fn(),
        existsSync: jest.fn(),
        createSessCfgFromArgs: jest.fn(),
        refreshAll: jest.fn(),
        profilesForValidation: { status: "active", name: "fake" },
    };

    Object.defineProperty(vscode.window, "showOpenDialog", { value: newMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: newMocks.openTextDocument, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((progLocation, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
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

        await DatasetActions.uploadDialog(node, testTree);

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
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });
        testTree.mFavorites.push(nodeAsFavorite);
        testTree.getTreeView.mockReturnValueOnce(createTreeView());
        const fileUri = { fsPath: "/tmp/foo" };

        globalMocks.showOpenDialog.mockReturnValueOnce([fileUri]);
        globalMocks.mockFindNonFavoritedNode.mockReturnValueOnce(node);

        await DatasetActions.uploadDialog(nodeAsFavorite, testTree);

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
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });
        testTree.mFavorites.push(nodeAsFavorite);
        globalMocks.showOpenDialog.mockReturnValueOnce(undefined);
        await DatasetActions.uploadDialog(node, testTree);

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
                    report: jest.fn(),
                };
                const token = {
                    isCancellationRequested: true,
                    onCancellationRequested: jest.fn(),
                };
                return callback(progress, token);
            }),
            configurable: true,
        });

        await DatasetActions.uploadDialog(node, testTree);

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
        const errHandlerSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        await DatasetActions.uploadDialog(node, testTree);

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
        const errHandlerSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        await DatasetActions.uploadDialog(node, testTree);

        expect(errHandlerSpy).toHaveBeenCalledWith(testError, "sestest");
    });
});

describe("dsNodeActions", () => {
    const mockRemoveFavorite = jest.fn();
    const mockcreateZoweSession = jest.fn();
    const mockaddSearchHistory = jest.fn();
    const mockgetSearchHistory = jest.fn();
    const mockRefresh = jest.fn();
    const mockRefreshElement = jest.fn();
    const mockGetChildren = jest.fn();
    const mockGetTreeView = jest.fn();
    const mockPattern = jest.fn();
    const mockRenameFavorite = jest.fn();
    const mockUpdateFavorites = jest.fn();
    const mockRenameNode = jest.fn();
    const mockFindFavoritedNode = jest.fn();
    const mockFindNonFavoritedNode = jest.fn();
    const mockGetProfileName = jest.fn();
    const mockGetSession = jest.fn();
    const mockGetProfiles = jest.fn();
    const mockLoadNamedProfile = jest.fn();

    function getDSTree() {
        const dsNode1 = getDSNode();
        const DatasetTree = jest.fn().mockImplementation(() => {
            return {
                log: jest.fn(),
                mSessionNodes: [],
                mFavorites: [],
                addSession: mockcreateZoweSession,
                addSearchHistory: mockaddSearchHistory,
                getSearchHistory: mockgetSearchHistory,
                refresh: mockRefresh,
                refreshAll: mockRefresh,
                refreshElement: mockRefreshElement,
                getChildren: mockGetChildren,
                getTreeView: mockGetTreeView,
                removeFavorite: mockRemoveFavorite,
                enterPattern: mockPattern,
                renameFavorite: mockRenameFavorite,
                updateFavorites: mockUpdateFavorites,
                renameNode: mockRenameNode,
                findFavoritedNode: mockFindFavoritedNode,
                findNonFavoritedNode: mockFindNonFavoritedNode,
                getProfileName: mockGetProfileName,
                getSession: mockGetSession,
                getProfiles: mockGetProfiles,
            };
        });
        const testDSTree1 = DatasetTree();
        testDSTree1.mSessionNodes = [];
        testDSTree1.mSessionNodes.push(dsNode1);
        return testDSTree1;
    }

    async function getDSNode() {
        const globalMocks = await createGlobalMocks();
        const parentNode = new ZoweDatasetNode({
            label: "parentNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        const dsNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        dsNode.contextValue = Constants.DS_SESSION_CONTEXT;
        dsNode.pattern = "test hlq";
        return dsNode;
    }

    const createBlockMocks = async () => {
        const globalMocks = await createGlobalMocks();
        mockLoadNamedProfile.mockReturnValue(globalMocks.profileOne);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    type: "zosmf",
                    enableValidationContext: jest.fn(),
                    loadNamedProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    getBaseProfile: jest.fn(() => {
                        return globalMocks.profileOne;
                    }),
                    profilesForValidation: [],
                    validateProfiles: jest.fn(),
                };
            }),
        });

        Object.defineProperty(DatasetActions, "RefreshAll", { value: globalMocks.refreshAll });
        Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: globalMocks.showErrorMessage });
        Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick });
        Object.defineProperty(vscode.window, "showInformationMessage", { value: globalMocks.showInformationMessage });
        // Object.defineProperty(, "createSessCfgFromArgs", { value: globalMocks.createSessCfgFromArgs });
        Object.defineProperty(SharedActions, "refreshAll", { value: jest.fn() });
    };
    const testDSTree = getDSTree();

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });
    describe("refreshAll", () => {
        it("Testing that refreshAllJobs is executed successfully", async () => {
            const globalMocks = await createGlobalMocks();
            await createBlockMocks();
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        getDefaultProfile: mockLoadNamedProfile,
                        loadNamedProfile: mockLoadNamedProfile,
                        usesSecurity: true,
                        enableValidationContext: jest.fn(),
                        getProfiles: jest.fn(() => {
                            return [
                                { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                                { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                            ];
                        }),
                        getBaseProfile: jest.fn(() => {
                            return globalMocks.profileOne;
                        }),
                        refresh: jest.fn(),
                        checkCurrentProfile: jest.fn(() => {
                            return globalMocks.profilesForValidation;
                        }),
                        profilesForValidation: [],
                        validateProfiles: jest.fn(),
                    };
                }),
            });
            const spy = jest.spyOn(SharedActions, "refreshAll");
            await SharedActions.refreshAll(testDSTree);
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
