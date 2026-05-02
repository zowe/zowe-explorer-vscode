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
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { Constants } from "../../../../src/configuration/Constants";
import { createIProfile, createISession, createTreeView } from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { ZoweExplorerApiType } from "@zowe/zowe-explorer-api";

vi.mock("../../../../src/tools/ZoweLocalStorage");

async function createGlobalMocks() {
    const newMocks = {
        mockRefresh: vi.fn(),
        showOpenDialog: vi.fn(),
        showInformationMessage: vi.fn(),
        openTextDocument: vi.fn(),
        mockRefreshElement: vi.fn(),
        mockFindFavoritedNode: vi.fn(),
        mockFindNonFavoritedNode: vi.fn(),
        mockUploadFile: vi.fn(),
        treeView: createTreeView(),
        session: createISession(),
        profileOne: createIProfile(),
        showInputBox: vi.fn(),
        showErrorMessage: vi.fn(),
        showQuickPick: vi.fn(),
        getConfiguration: vi.fn(),
        existsSync: vi.fn(),
        createSessCfgFromArgs: vi.fn(),
        refreshAll: vi.fn(),
        profilesForValidation: { status: "active", name: "fake" },
    };

    Object.defineProperty(vscode.window, "showOpenDialog", { value: newMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: newMocks.openTextDocument, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: vi.fn(), configurable: true });
    Object.defineProperty(vscode.window, "withProgress", {
        value: vi.fn().mockImplementation((progLocation, callback) => {
            const progress = {
                report: vi.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: vi.fn(),
            };
            return callback(progress, token);
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: vi.fn().mockReturnValue({ onDidCollapseElement: vi.fn() }),
        configurable: true,
    });

    const putContents = vi.fn().mockResolvedValue({ success: true, commandResponse: "", apiResponse: {} });
    ZoweExplorerApiRegister.getMvsApi = vi.fn<any, Parameters<typeof ZoweExplorerApiRegister.getMvsApi>>().mockReturnValue({ putContents });

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
        vi.clearAllMocks();
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
        expect(globalMocks.showInformationMessage.mock.calls.map((call) => call[0])).toEqual(["Operation cancelled"]);
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
            value: vi.fn().mockImplementation((progLocation, callback) => {
                const progress = {
                    report: vi.fn(),
                };
                const token = {
                    isCancellationRequested: true,
                    onCancellationRequested: vi.fn(),
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
        const getMvsApiMock2 = vi.fn();
        getMvsApiMock2.mockReturnValue(mockMvsApi2);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock2.bind(ZoweExplorerApiRegister);
        vi.spyOn(mockMvsApi2, "putContents").mockResolvedValue({
            success: false,
            commandResponse: "",
            apiResponse: {},
        });
        const errHandlerSpy = vi.spyOn(AuthUtils, "errorHandling").mockImplementation((() => undefined) as any);
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
        const getMvsApiMock2 = vi.fn();
        getMvsApiMock2.mockReturnValue(mockMvsApi2);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock2.bind(ZoweExplorerApiRegister);
        const testError = new Error("putContents failed");
        vi.spyOn(mockMvsApi2, "putContents").mockRejectedValue(testError);
        const errHandlerSpy = vi.spyOn(AuthUtils, "errorHandling").mockImplementation((() => undefined) as any);
        await DatasetActions.uploadDialog(node, testTree);
        expect(errHandlerSpy).toHaveBeenCalledWith(testError, { apiType: ZoweExplorerApiType.Mvs, profile: globalMocks.profileOne });
    });
});

describe("Dataset Actions - upload with encoding", () => {
    function createBlockMocks(globalMocks) {
        Object.defineProperty(vscode.window, "withProgress", {
            value: vi.fn().mockImplementation((progLocation, callback) => {
                const progress = { report: vi.fn() };
                const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
                return callback(progress, token);
            }),
            configurable: true,
        });
        const parentNode = new ZoweDatasetNode({
            label: "PDS.DATA",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            profile: globalMocks.profileOne,
            session: globalMocks.session,
        });
        const node = new ZoweDatasetNode({
            label: "PDS.DATA",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode,
            profile: globalMocks.profileOne,
        });
        return { node };
    }

    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("uploadDialogWithEncoding calls uploadFileWithEncoding with user codepage", async () => {
        const globalMocks = await createGlobalMocks();
        const { node } = createBlockMocks(globalMocks);
        const dsTree = createDatasetTree(node, globalMocks.treeView);
        vi.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValue({ kind: "other", codepage: "IBM-1047" } as any);
        const fileUri = { fsPath: "/tmp/foo.txt" } as any;
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        const uploadWithEncSpy = vi.spyOn(DatasetActions, "uploadFileWithEncoding").mockResolvedValue({ success: true } as any);

        await DatasetActions.uploadDialogWithEncoding(node as any, dsTree as any);

        expect(SharedUtils.promptForUploadEncoding).toHaveBeenCalled();
        expect(uploadWithEncSpy).toHaveBeenCalledWith(node, fileUri.fsPath, { kind: "other", codepage: "IBM-1047" });
    });

    it("uploadFileWithEncoding maps binary and codepage options correctly", async () => {
        const globalMocks = await createGlobalMocks();
        const { node } = createBlockMocks(globalMocks);
        const putContents = vi.fn().mockResolvedValue({ success: true });
        ZoweExplorerApiRegister.getMvsApi = vi.fn<any, Parameters<typeof ZoweExplorerApiRegister.getMvsApi>>().mockReturnValue({ putContents });

        await DatasetActions.uploadFileWithEncoding(node as any, "/tmp/a.txt", { kind: "binary" } as any);
        expect(putContents).toHaveBeenLastCalledWith("/tmp/a.txt", "PDS.DATA", expect.objectContaining({ binary: true }));

        await DatasetActions.uploadFileWithEncoding(node as any, "/tmp/b.txt", { kind: "other", codepage: "ISO8859-1" } as any);
        expect(putContents).toHaveBeenLastCalledWith("/tmp/b.txt", "PDS.DATA", expect.objectContaining({ binary: false, encoding: "ISO8859-1" }));
    });
});

describe("dsNodeActions", () => {
    const mockRemoveFavorite = vi.fn();
    const mockcreateZoweSession = vi.fn();
    const mockaddSearchHistory = vi.fn();
    const mockgetSearchHistory = vi.fn();
    const mockRefresh = vi.fn();
    const mockRefreshElement = vi.fn();
    const mockGetChildren = vi.fn();
    const mockGetTreeView = vi.fn();
    const mockPattern = vi.fn();
    const mockRenameFavorite = vi.fn();
    const mockUpdateFavorites = vi.fn();
    const mockRenameNode = vi.fn();
    const mockFindFavoritedNode = vi.fn();
    const mockFindNonFavoritedNode = vi.fn();
    const mockGetProfileName = vi.fn();
    const mockGetSession = vi.fn();
    const mockGetProfiles = vi.fn();
    const mockLoadNamedProfile = vi.fn();

    function getDSTree() {
        const dsNode1 = getDSNode();
        const DatasetTree = vi.fn().mockImplementation(() => {
            return {
                log: vi.fn(),
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
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    type: "zosmf",
                    enableValidationContext: vi.fn(),
                    loadNamedProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    getBaseProfile: vi.fn(() => {
                        return globalMocks.profileOne;
                    }),
                    profilesForValidation: [],
                    validateProfiles: vi.fn(),
                };
            }),
        });

        Object.defineProperty(DatasetActions, "RefreshAll", { value: globalMocks.refreshAll });
        Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: globalMocks.showErrorMessage });
        Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick });
        Object.defineProperty(vscode.window, "showInformationMessage", { value: globalMocks.showInformationMessage });
        // Object.defineProperty(, "createSessCfgFromArgs", { value: globalMocks.createSessCfgFromArgs });
        Object.defineProperty(SharedActions, "refreshAll", { value: vi.fn() });
    };
    const testDSTree = getDSTree();

    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });
    describe("refreshAll", () => {
        it("Testing that refreshAllJobs is executed successfully", async () => {
            const globalMocks = await createGlobalMocks();
            await createBlockMocks();
            Object.defineProperty(Profiles, "getInstance", {
                value: vi.fn(() => {
                    return {
                        getDefaultProfile: mockLoadNamedProfile,
                        loadNamedProfile: mockLoadNamedProfile,
                        usesSecurity: true,
                        enableValidationContext: vi.fn(),
                        getProfiles: vi.fn(() => {
                            return [
                                { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                                { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                            ];
                        }),
                        getBaseProfile: vi.fn(() => {
                            return globalMocks.profileOne;
                        }),
                        refresh: vi.fn(),
                        checkCurrentProfile: vi.fn(() => {
                            return globalMocks.profilesForValidation;
                        }),
                        profilesForValidation: [],
                        validateProfiles: vi.fn(),
                    };
                }),
            });
            const spy = vi.spyOn(SharedActions, "refreshAll");
            await SharedActions.refreshAll(testDSTree);
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
