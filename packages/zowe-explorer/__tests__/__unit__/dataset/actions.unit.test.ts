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
import * as zowe from "@zowe/cli";
import { Gui, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import {
    createSessCfgFromArgs,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createTextDocument,
    createTreeView,
    createQuickPickContent,
} from "../../../__mocks__/mockCreators/shared";
import {
    createDatasetAttributes,
    createDatasetSessionNode,
    createDatasetFavoritesNode,
    createDatasetTree,
    createDSMemberAttributes,
} from "../../../__mocks__/mockCreators/datasets";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import * as dsActions from "../../../src/dataset/actions";
import * as globals from "../../../src/globals";
import * as path from "path";
import * as fs from "fs";
import * as sharedUtils from "../../../src/shared/utils";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import * as wsUtils from "../../../src/utils/workspace";
import { getNodeLabels } from "../../../src/dataset/utils";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import * as context from "../../../src/shared/context";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";

// Missing the definition of path module, because I need the original logic for tests
jest.mock("fs");
jest.mock("vscode");

let mockClipboardData = null;
let clipboard;

function createGlobalMocks() {
    globals.defineGlobals("");
    clipboard = {
        writeText: jest.fn().mockImplementation((value) => (mockClipboardData = value)),
        readText: jest.fn().mockImplementation(() => mockClipboardData),
    };

    const newMocks = {
        imperativeProfile: createIProfile(),
        profileInstance: null,
        session: createISession(),
        treeView: createTreeView(),
        datasetSessionNode: null,
        datasetSessionFavNode: null,
        testFavoritesNode: createDatasetFavoritesNode(),
        testDatasetTree: null,
        getContentsSpy: null,
        statusBarMsgSpy: null,
        mvsApi: null,
        mockShowWarningMessage: jest.fn(),
    };

    newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
    newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
    newMocks.datasetSessionFavNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
    newMocks.testFavoritesNode.children.push(newMocks.datasetSessionFavNode);
    newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView, newMocks.testFavoritesNode);
    newMocks.mvsApi = createMvsApi(newMocks.imperativeProfile);
    newMocks.getContentsSpy = jest.spyOn(newMocks.mvsApi, "getContents");
    bindMvsApi(newMocks.mvsApi);

    Object.defineProperty(vscode.window, "withProgress", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Upload", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Upload, "bufferToDataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Upload, "pathToDataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "setStatusBarMessage", { value: jest.fn().mockReturnValue({ dispose: jest.fn() }), configurable: true });
    newMocks.statusBarMsgSpy = jest.spyOn(Gui, "setStatusBarMessage");

    Object.defineProperty(Gui, "warningMessage", {
        value: newMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "applyEdit", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Download", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Download, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Delete", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Delete, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Create", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Create, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Create, "dataSetLike", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "unlinkSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "existsSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(sharedUtils, "concatChildNodes", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "List", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.List, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createWebviewPanel", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.env, "clipboard", { value: clipboard, configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    mocked(Profiles.getInstance).mockReturnValue(newMocks.profileInstance);

    return newMocks;
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

const createBlockMocksShared = () => {
    const session = createISession();
    const imperativeProfile = createIProfile();
    const zosmfSession = createSessCfgFromArgs(imperativeProfile);
    const treeView = createTreeView();
    const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
    const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
    const mvsApi = createMvsApi(imperativeProfile);
    bindMvsApi(mvsApi);

    return {
        session,
        zosmfSession,
        treeView,
        imperativeProfile,
        datasetSessionNode,
        mvsApi,
        testDatasetTree,
    };
};

describe("Dataset Actions Unit Tests - Function createMember", () => {
    afterAll(() => jest.restoreAllMocks());
    const globalMocks = createGlobalMocks();

    it("Checking of common dataset member creation", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, blockMocks.session);

        const mySpy = mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("testMember");
            return Promise.resolve("testMember");
        });

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        globalMocks.getContentsSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.createMember(parent, blockMocks.testDatasetTree);

        expect(mySpy).toBeCalledWith({
            placeHolder: "Name of Member",
            validateInput: expect.any(Function),
        });
        expect(mocked(zowe.Upload.bufferToDataSet)).toBeCalledWith(blockMocks.zosmfSession, Buffer.from(""), parent.label + "(testMember)", {
            responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout,
        });
    });
    it("Checking failed attempt to create dataset member", async () => {
        const blockMocks = createBlockMocksShared();
        createGlobalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, blockMocks.session);

        mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(zowe.Upload.bufferToDataSet).mockRejectedValueOnce(Error("test"));

        try {
            await dsActions.createMember(parent, blockMocks.testDatasetTree);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Unable to create member. Error: test");
        mocked(zowe.Upload.bufferToDataSet).mockReset();
    });
    it("Checking of attempt to create member without name", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, blockMocks.session);

        mocked(vscode.window.showInputBox).mockResolvedValue("");
        await dsActions.createMember(parent, blockMocks.testDatasetTree);

        expect(mocked(zowe.Upload.bufferToDataSet)).not.toBeCalled();
    });
    it("Checking of member creation for favorite dataset", async () => {
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, blockMocks.session);
        const nonFavoriteLabel = parent.label;
        parent.label = `${parent.label}`;
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        const mySpy = mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        globalMocks.getContentsSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.createMember(parent, blockMocks.testDatasetTree);

        expect(mySpy).toBeCalledWith({ placeHolder: "Name of Member", validateInput: expect.any(Function) });
        expect(mocked(zowe.Upload.bufferToDataSet)).toBeCalledWith(blockMocks.zosmfSession, Buffer.from(""), nonFavoriteLabel + "(testMember)", {
            responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout,
        });
    });
});

describe("Dataset Actions Unit Tests - Function refreshPS", () => {
    afterAll(() => jest.restoreAllMocks());

    it("Checking common PS dataset refresh", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.refreshPS(node);

        expect(mocked(zowe.Download.dataSet)).toBeCalledWith(blockMocks.zosmfSession, node.label, {
            file: path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()),
            returnEtag: true,
        });
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(
            path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString())
        );
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking duplicate PS dataset refresh attempt", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: false } as any);
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.refreshPS(node);

        expect(mocked(vscode.commands.executeCommand)).not.toBeCalled();
    });
    it("Checking failed attempt to refresh PS dataset (not found exception)", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockRejectedValueOnce(Error("not found"));

        globalMocks.getContentsSpy.mockRejectedValueOnce(new Error("not found"));

        await dsActions.refreshPS(node);

        expect(mocked(Gui.showMessage)).toBeCalledWith("Unable to find file " + node.label);
        expect(mocked(vscode.commands.executeCommand)).not.toBeCalled();
    });
    it("Checking failed attempt to refresh PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockRejectedValueOnce(Error(""));

        await dsActions.refreshPS(child);

        expect(mocked(zowe.Download.dataSet)).toBeCalledWith(blockMocks.zosmfSession, child.getParent().getLabel() + "(" + child.label + ")", {
            file: path.join(globals.DS_DIR, child.getSessionNode().label.toString(), `${child.getParent().label}(${child.label})`),
            returnEtag: true,
        });
        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error");
    });
    it("Checking favorite empty PDS refresh", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.refreshPS(node);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking favorite PDS Member refresh", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.refreshPS(child);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking favorite PS refresh", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        child.contextValue = globals.DS_FAV_CONTEXT;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true } as any);
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        await dsActions.refreshPS(child);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
});

describe("Dataset Actions Unit Tests - Function deleteDatasetPrompt", () => {
    function createBlockMocks(globalMocks) {
        const testDatasetTree = createDatasetTree(globalMocks.datasetSessionNode, globalMocks.treeView, globalMocks.testFavoritesNode);
        const testDatasetNode = new ZoweDatasetNode(
            "HLQ.TEST.DS",
            vscode.TreeItemCollapsibleState.None,
            globalMocks.datasetSessionNode,
            globalMocks.session,
            globals.DS_PDS_CONTEXT,
            undefined,
            globalMocks.imperativeProfile
        );
        const testVsamNode = new ZoweDatasetNode(
            "HLQ.TEST.VSAM",
            vscode.TreeItemCollapsibleState.None,
            globalMocks.datasetSessionNode,
            globalMocks.session,
            globals.VSAM_CONTEXT,
            undefined,
            globalMocks.imperativeProfile
        );
        const testMigrNode = new ZoweDatasetNode(
            "HLQ.TEST.MIGR",
            vscode.TreeItemCollapsibleState.None,
            globalMocks.datasetSessionNode,
            globalMocks.session,
            globals.DS_MIGRATED_FILE_CONTEXT,
            undefined,
            globalMocks.imperativeProfile
        );
        const testMemberNode = new ZoweDatasetNode(
            "MEMB",
            vscode.TreeItemCollapsibleState.None,
            testDatasetNode,
            globalMocks.session,
            globals.DS_MEMBER_CONTEXT,
            undefined,
            globalMocks.imperativeProfile
        );
        const testFavoritedNode = new ZoweDatasetNode(
            "HLQ.TEST.FAV",
            vscode.TreeItemCollapsibleState.None,
            globalMocks.datasetSessionFavNode,
            globalMocks.session,
            globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX,
            undefined,
            globalMocks.imperativeProfile
        );
        const testFavMemberNode = new ZoweDatasetNode(
            "MEMB",
            vscode.TreeItemCollapsibleState.None,
            testFavoritedNode,
            globalMocks.session,
            globals.DS_MEMBER_CONTEXT,
            undefined,
            globalMocks.imperativeProfile
        );

        testDatasetNode.children.push(testMemberNode);
        testFavoritedNode.children.push(testFavMemberNode);
        globalMocks.datasetSessionNode.children.push(testDatasetNode);
        globalMocks.datasetSessionNode.children.push(testVsamNode);
        globalMocks.datasetSessionNode.children.push(testMigrNode);
        globalMocks.datasetSessionFavNode.children.push(testFavoritedNode);

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
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
        });

        return {
            testDatasetTree,
            testDatasetNode,
            testVsamNode,
            testMigrNode,
            testMemberNode,
            testFavMemberNode,
            testFavoritedNode,
        };
    }

    // afterAll(() => jest.restoreAllMocks());

    it("Should delete one dataset", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(`The following 1 item(s) were deleted: ${blockMocks.testDatasetNode.getLabel()}`);
    });

    it("Should delete one member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMemberNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(
            `The following 1 item(s) were deleted: ${blockMocks.testMemberNode.getParent().getLabel()}(${blockMocks.testMemberNode.getLabel()})`
        );
    });

    it("Should delete one VSAM", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testVsamNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(`The following 1 item(s) were deleted: ${blockMocks.testVsamNode.getLabel()}`);
    });

    it("Should delete one migrated dataset", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMigrNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(`The following 1 item(s) were deleted: ${blockMocks.testMigrNode.getLabel()}`);
    });

    it("Should delete two datasets", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testDatasetNode, blockMocks.testVsamNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith(
            `The following 2 item(s) were deleted: ${blockMocks.testDatasetNode.getLabel()}, ${blockMocks.testVsamNode.getLabel()}`
        );
    });

    it("Should delete one dataset and one member but only the parent will be listed in output", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testMemberNode, blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(`The following 1 item(s) were deleted: ${blockMocks.testDatasetNode.getLabel()}`);
    });

    it("Should delete a favorited data set", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavoritedNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.warningMessage)).toBeCalledWith(
            `Are you sure you want to delete the following 1 item(s)?\nThis will permanently remove these data sets and/or members from your ` +
                `system.\n\n ${blockMocks.testFavoritedNode.getLabel()}`,
            { items: ["Delete"], vsCodeOpts: { modal: true } }
        );
    });

    it("Should delete a favorited member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavMemberNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.warningMessage)).toBeCalledWith(
            `Are you sure you want to delete the following 1 item(s)?\nThis will permanently remove these data sets and/or members from your ` +
                `system.\n\n ${blockMocks.testFavoritedNode.getLabel()}(${blockMocks.testFavMemberNode.getLabel()})`,
            { items: ["Delete"], vsCodeOpts: { modal: true } }
        );
    });

    it("Should not consider a session for deletion", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [globalMocks.datasetSessionNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith("No data sets selected for deletion, cancelling...");
    });

    it("Should account for favorited data sets during deletion", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const selectedNodes = [blockMocks.testFavoritedNode, blockMocks.testDatasetNode];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith(
            `The following 2 item(s) were deleted: ${blockMocks.testDatasetNode.getLabel()}, ${blockMocks.testFavoritedNode.getLabel()}`
        );
    });

    it("Should cancel deletion if user selects Cancel", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await dsActions.deleteDatasetPrompt(blockMocks.testDatasetTree);

        expect(mocked(vscode.window.withProgress).mock.calls.length).toBe(0);
    });
});

describe("Dataset Actions Unit Tests - Function deleteDataset", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            profileInstance,
            mvsApi,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking common PS dataset deletion", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, blockMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(node.label, { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
    });
    it("Checking common PS dataset deletion with Unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, blockMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(node.label, { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
    });
    it("Checking common PS dataset deletion with not existing local file", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(false);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, blockMocks.testDatasetTree);

        expect(mocked(fs.unlinkSync)).not.toBeCalled();
        expect(deleteSpy).toBeCalledWith(node.label, { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
    });
    it("Checking common PS dataset failed deletion attempt due to absence on remote", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");
        deleteSpy.mockRejectedValueOnce(Error("not found"));

        await expect(dsActions.deleteDataset(node, blockMocks.testDatasetTree)).rejects.toEqual(Error("not found"));

        expect(mocked(Gui.showMessage)).toBeCalledWith("Unable to find file " + node.label);
    });
    it("Checking common PS dataset failed deletion attempt", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");
        deleteSpy.mockRejectedValueOnce(Error(""));

        await expect(dsActions.deleteDataset(node, blockMocks.testDatasetTree)).rejects.toEqual(Error(""));
        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error");
    });
    it("Checking Favorite PDS dataset deletion", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode(
            "HLQ.TEST.NODE",
            vscode.TreeItemCollapsibleState.None,
            parent,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, blockMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(node.label, { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
        expect(blockMocks.testDatasetTree.removeFavorite).toBeCalledWith(node);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), "HLQ.TEST.NODE"));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), "HLQ.TEST.NODE"));
    });
    it("Checking Favorite PDS Member deletion", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(child, blockMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(`${child.getParent().label.toString()}(${child.label.toString()})`, {
            responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout,
        });
        expect(blockMocks.testDatasetTree.removeFavorite).toBeCalledWith(child);
        expect(mocked(fs.existsSync)).toBeCalledWith(
            path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), `${child.getParent().label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(fs.unlinkSync)).toBeCalledWith(
            path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), `${child.getParent().label.toString()}(${child.label.toString()})`)
        );
    });
    it("Checking Favorite PS dataset deletion", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("HLQ.TEST.DELETE.PARENT", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.FAV_PROFILE_CONTEXT;
        const child = new ZoweDatasetNode("HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, parent, null, globals.DS_DS_CONTEXT);
        blockMocks.datasetSessionNode.children.push(child);
        blockMocks.testDatasetTree.mFavorites.push(parent);
        // Simulate context value update when PS is added as a favorite
        child.contextValue = globals.DS_FAV_CONTEXT;
        blockMocks.testDatasetTree.mFavorites[0].children.push(child);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(child, blockMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith("HLQ.TEST.DELETE.NODE", { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
        expect(blockMocks.testDatasetTree.removeFavorite).toBeCalledWith(child);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), "HLQ.TEST.DELETE.NODE"));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR, parent.getSessionNode().label.toString(), "HLQ.TEST.DELETE.NODE"));
    });
    it("Checking incorrect dataset failed deletion attempt", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        parent.contextValue = "junk";
        const child = new ZoweDatasetNode(
            "child",
            vscode.TreeItemCollapsibleState.None,
            parent,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Delete" as any);
        const deleteSpy = jest.spyOn(blockMocks.mvsApi, "deleteDataSet");
        deleteSpy.mockClear();

        await expect(dsActions.deleteDataset(child, blockMocks.testDatasetTree)).rejects.toEqual(Error("Cannot delete, item invalid."));
        expect(deleteSpy).not.toBeCalled();
    });
});

describe("Dataset Actions Unit Tests - Function enterPattern", () => {
    afterAll(() => jest.restoreAllMocks());

    it("Checking common dataset filter action", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.pattern = "TEST";
        node.contextValue = globals.DS_SESSION_CONTEXT;

        const mySpy = mocked(vscode.window.showInputBox).mockResolvedValue("test");
        await dsActions.enterPattern(node, blockMocks.testDatasetTree);

        expect(mySpy).toBeCalledWith(
            expect.objectContaining({
                prompt: "Search Data Sets: use a comma to separate multiple patterns",
                value: node.pattern,
            })
        );
        expect(mocked(Gui.showMessage)).not.toBeCalled();
    });
    it("Checking common dataset filter failed attempt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.pattern = "TEST";
        node.contextValue = globals.DS_SESSION_CONTEXT;

        mocked(vscode.window.showInputBox).mockResolvedValueOnce("");
        await dsActions.enterPattern(node, blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toBeCalledWith("You must enter a pattern.");
    });
    it("Checking favorite dataset filter action", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocksShared();
        const favoriteSample = new ZoweDatasetNode("[sestest]: HLQ.TEST", vscode.TreeItemCollapsibleState.None, undefined, null);

        await dsActions.enterPattern(favoriteSample, blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).toBeCalledWith("sestest");
    });
});

describe("Dataset Actions Unit Tests - Function saveFile", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const datasetFavoritesNode = createDatasetFavoritesNode();
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView, datasetFavoritesNode);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            datasetFavoritesNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking common dataset saving action when no session is defined", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const nodeWithoutSession = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            null,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([nodeWithoutSession]);
        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([nodeWithoutSession]);
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const getSessionSpy = jest.spyOn(blockMocks.mvsApi, "getSession").mockReturnValueOnce(blockMocks.sessionWithoutCredentials);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(getSessionSpy).toReturnWith(blockMocks.sessionWithoutCredentials);
        expect(mocked(vscode.workspace.applyEdit)).toHaveBeenCalledTimes(2);
    });
    it("Checking common dataset saving failed attempt due to inability to locate session and profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const nodeWithoutSession = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            null,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(undefined);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([nodeWithoutSession]);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Could not locate session when saving data set.");
    });
    it("Checking common dataset saving failed attempt due to its absence on the side of the server", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "node",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            undefined,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([node, blockMocks.datasetSessionNode]);
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const dataSetSpy = jest.spyOn(blockMocks.mvsApi, "dataSet").mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(dataSetSpy).toBeCalledWith("HLQ.TEST.AFILE", { responseTimeout: blockMocks.imperativeProfile.profile?.responseTimeout });
        expect(mocked(Gui.errorMessage)).toBeCalledWith("Data set failed to save. Data set may have been deleted or renamed on mainframe.");
    });
    it("Checking common dataset saving", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [
                {
                    etag: "123",
                },
            ],
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const mockSetEtag = jest.spyOn(node, "setEtag").mockImplementation(() => null);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mockSetEtag).toHaveBeenCalledWith("123");
        expect(mocked(globalMocks.statusBarMsgSpy)).toBeCalledWith("success", globals.STATUS_BAR_TIMEOUT_MS);
    });
    it("Checking common dataset failed saving attempt", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: false,
            commandResponse: "failed",
            apiResponse: [
                {
                    etag: "123",
                },
            ],
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mocked(Gui.errorMessage)).toBeCalledWith("failed");
        expect(mocked(vscode.workspace.applyEdit)).toHaveBeenCalledTimes(2);
    });
    it("Checking favorite dataset saving", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favoriteNode = new ZoweDatasetNode(
            "[TestSessionName]: HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            favoriteNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        favoriteNode.contextValue = globals.DS_DS_CONTEXT + globals.FAV_SUFFIX;
        node.contextValue = globals.DS_DS_CONTEXT + globals.FAV_SUFFIX;
        favoriteNode.children.push(node);
        blockMocks.testDatasetTree.mFavorites.push(favoriteNode);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [
                {
                    etag: "123",
                },
            ],
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        blockMocks.profileInstance.loadNamedProfile.mockReturnValue(blockMocks.imperativeProfile);
        const mockSetEtag = jest.spyOn(node, "setEtag").mockImplementation(() => null);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, blockMocks.imperativeProfile.name, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mocked(globalMocks.statusBarMsgSpy)).toBeCalledWith("success", globals.STATUS_BAR_TIMEOUT_MS);
    });
    it("Checking favorite PDS Member saving", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        // Create nodes for Session section
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_PDS_CONTEXT;
        const childNode = new ZoweDatasetNode(
            "MEM",
            vscode.TreeItemCollapsibleState.None,
            node,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        // Create nodes for Favorites section
        const favProfileNode = new ZoweDatasetNode(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetFavoritesNode,
            null,
            globals.FAV_PROFILE_CONTEXT
        );
        const favoriteNode = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            favProfileNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        favoriteNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const favoriteChildNode = new ZoweDatasetNode(
            "MEM",
            vscode.TreeItemCollapsibleState.None,
            favoriteNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        // Push nodes into respective Session or Favorites sections
        node.children.push(childNode);
        favoriteNode.children.push(favoriteChildNode);
        blockMocks.testDatasetTree.mFavorites.push(favProfileNode);
        blockMocks.testDatasetTree.mFavorites[0].children.push(favoriteNode);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node, childNode]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(MEM)" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [
                {
                    etag: "123",
                },
            ],
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const mockSetEtag = jest.spyOn(childNode, "setEtag").mockImplementation(() => null);
        const testDocument = createTextDocument("HLQ.TEST.AFILE(MEM)", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, blockMocks.imperativeProfile.name, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mockSetEtag).toHaveBeenCalledWith("123");
        expect(mocked(globalMocks.statusBarMsgSpy)).toBeCalledWith("success", globals.STATUS_BAR_TIMEOUT_MS);
        expect(blockMocks.profileInstance.loadNamedProfile).toBeCalledWith(blockMocks.imperativeProfile.name);
    });
    it("Checking common dataset failed saving attempt due to incorrect document path", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(zowe.List.dataSet)).not.toBeCalled();
        expect(mocked(zowe.Upload.pathToDataSet)).not.toBeCalled();
    });
    it("Checking PDS member saving attempt", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE(mem)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [
                {
                    etag: "123",
                },
            ],
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const testDocument = createTextDocument("HLQ.TEST.AFILE(mem)", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mocked(Gui.setStatusBarMessage)).toBeCalledWith("success", globals.STATUS_BAR_TIMEOUT_MS);
    });
    it("Checking common dataset saving failed due to conflict with server version", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: false,
            commandResponse: "Rest API failure with HTTP(S) status 412",
            apiResponse: [],
        });

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        const profile = blockMocks.imperativeProfile;
        profile.profile.encoding = 1047;
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(wsUtils, "markDocumentUnsaved", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(context, "isTypeUssTreeNode", {
            value: jest.fn().mockReturnValueOnce(false),
            configurable: true,
        });
        Object.defineProperty(ZoweExplorerApiRegister.getMvsApi, "getContents", {
            value: jest.fn(),
            configurable: true,
        });

        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);
        const logSpy = jest.spyOn(ZoweLogger, "warn");
        const commandSpy = jest.spyOn(vscode.commands, "executeCommand");

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(logSpy).toBeCalledWith("Remote file has changed. Presenting with way to resolve file.");
        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(commandSpy).toBeCalledWith("workbench.files.action.compareWithSaved");
        logSpy.mockClear();
        commandSpy.mockClear();
    });

    it("Checking common dataset saving failed due to conflict with server version when file size has not changed", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        blockMocks.testDatasetTree.getChildren.mockReturnValueOnce([blockMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }],
            },
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: false,
            commandResponse: "Rest API failure with HTTP(S) status 412",
            apiResponse: [],
        });

        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        const profile = blockMocks.imperativeProfile;
        profile.profile.encoding = 1047;
        blockMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(blockMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(wsUtils, "markDocumentUnsaved", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(context, "isTypeUssTreeNode", {
            value: jest.fn().mockReturnValueOnce(false),
            configurable: true,
        });
        Object.defineProperty(ZoweExplorerApiRegister.getMvsApi, "getContents", {
            value: jest.fn(),
            configurable: true,
        });

        const testDocument = createTextDocument("HLQ.TEST.AFILE", blockMocks.datasetSessionNode);
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);
        const logSpy = jest.spyOn(ZoweLogger, "warn");
        const commandSpy = jest.spyOn(vscode.commands, "executeCommand");
        const applyEditSpy = jest.spyOn(vscode.workspace, "applyEdit");
        jest.spyOn(fs, "statSync").mockReturnValueOnce({ size: 0 } as any);

        await dsActions.saveFile(testDocument, blockMocks.testDatasetTree);

        expect(logSpy).toBeCalledWith("Remote file has changed. Presenting with way to resolve file.");
        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(commandSpy).toBeCalledWith("workbench.files.action.compareWithSaved");
        expect(applyEditSpy).toHaveBeenCalledTimes(2);
        logSpy.mockClear();
        commandSpy.mockClear();
        applyEditSpy.mockClear();
    });
});

describe("Dataset Actions Unit Tests - Function showAttributes", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset attributes showing", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await dsActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toBeCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });

    it("Checking PS dataset member attributes showing", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;
        const nodeMember = new ZoweDatasetNode("MEMBER1", vscode.TreeItemCollapsibleState.None, node, null);
        nodeMember.contextValue = globals.DS_MEMBER_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const allMembersSpy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        allMembersSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDSMemberAttributes(nodeMember.label.toString())],
            },
        });

        await dsActions.showAttributes(nodeMember, blockMocks.testDatasetTree);

        expect(allMembersSpy).toBeCalledWith(node.label.toString().toUpperCase(), {
            attributes: true,
            pattern: nodeMember.label.toString().toUpperCase(),
        });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });

    it("Checking PS dataset attributes showing with Unverified Profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await dsActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toBeCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });
    it("Checking PDS dataset attributes showing", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_PDS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(node.label.toString(), node.contextValue)],
            },
        });

        await dsActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toBeCalledWith(node.label.toString(), { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });
    it("Checking Favorite PS dataset attributes showing", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT + globals.FAV_SUFFIX;
        const normalisedLabel = node.label as string;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(normalisedLabel, node.contextValue)],
            },
        });

        await dsActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toBeCalledWith(normalisedLabel, { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });
    it("Checking Favorite PDS dataset attributes showing", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const normalisedLabel = node.label as string;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [createDatasetAttributes(normalisedLabel, node.contextValue)],
            },
        });

        await dsActions.showAttributes(node, blockMocks.testDatasetTree);

        expect(datasetListSpy).toBeCalledWith(normalisedLabel, { attributes: true });
        expect(mocked(vscode.window.createWebviewPanel)).toBeCalled();
    });
    it("Checking failed attempt of dataset attributes showing (empty response)", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("AUSER.A1557332.A996850.TEST1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.createWebviewPanel).mockReturnValueOnce({
            webview: {
                html: "",
            },
        } as any);
        const datasetListSpy = jest.spyOn(blockMocks.mvsApi, "dataSet");
        datasetListSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await expect(dsActions.showAttributes(node, blockMocks.testDatasetTree)).rejects.toEqual(
            Error("No matching names found for query: AUSER.A1557332.A996850.TEST1")
        );
        expect(mocked(Gui.errorMessage)).toBeCalledWith(
            "Unable to list attributes. Error: No matching names found for query: AUSER.A1557332.A996850.TEST1"
        );
        expect(mocked(vscode.window.createWebviewPanel)).not.toBeCalled();
    });
});

describe("Dataset Actions Unit Tests - Function copyDataSets", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const pdsSessionNode = new ZoweDatasetNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Expanded,
            datasetSessionNode,
            session,
            undefined,
            undefined,
            profileInstance
        );
        pdsSessionNode.contextValue = globals.DS_PDS_CONTEXT;
        const pdsMemberNode = new ZoweDatasetNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Expanded,
            pdsSessionNode,
            session,
            undefined,
            undefined,
            profileInstance
        );
        pdsMemberNode.contextValue = globals.DS_MEMBER_CONTEXT;
        bindMvsApi(mvsApi);

        const pds = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.None, datasetSessionNode, null);
        pds.contextValue = globals.DS_PDS_CONTEXT;
        const memberChild = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, pds, null);
        memberChild.contextValue = globals.DS_MEMBER_CONTEXT;

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            pdsSessionNode,
            pdsMemberNode,
            pds,
            memberChild,
        };
    }

    beforeEach(() => (mockClipboardData = null));
    afterAll(() => jest.restoreAllMocks());

    it("Checking copy the info of a member node to the clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.pdsSessionNode, null);
        node.contextValue = globals.DS_MEMBER_CONTEXT;
        const nodeList: ZoweDatasetNode[] = [node];
        await dsActions.copyDataSets(null, nodeList, null);

        expect(clipboard.readText()).toBe('{"profileName":"sestest","dataSetName":"sestest","memberName":"HLQ.TEST.NODE","contextValue":"member"}');
    });
    it("Testing warning of multiple datasets with different types to be copied", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const Membernode = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.pdsSessionNode, null);
        const pdsNode = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.pdsSessionNode, null);
        pdsNode.contextValue = globals.DS_PDS_CONTEXT;
        Membernode.contextValue = globals.DS_MEMBER_CONTEXT;
        const nodeList: ZoweDatasetNode[] = [Membernode, pdsNode];
        await dsActions.copyDataSets(null, nodeList, null);
    });
    it("Testing copy of PDS", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const selectedNodeSpy = jest.spyOn(sharedUtils, "getSelectedNodeList");
        const copySpy = jest.spyOn(dsActions, "copyPartitionedDatasets");
        copySpy.mockResolvedValue(undefined);
        await dsActions.copyDataSets(blockMocks.pdsSessionNode, null, blockMocks.testDatasetTree);
        expect(selectedNodeSpy).toBeCalledWith(blockMocks.pdsSessionNode, null);
    });
    it("Checking copy the label of a favorite dataset member to the clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        const contextValue = globals.DS_MEMBER_CONTEXT + globals.FAV_SUFFIX;
        child.contextValue = contextValue;
        await dsActions.copyDataSets(child, null, blockMocks.testDatasetTree);
        expect(clipboard.readText()).toBe(`{"profileName":"sestest","dataSetName":"parent","memberName":"child","contextValue":"${contextValue}"}`);
    });
    it("Checking copy the label of a node (with a very complex context value) to the clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        const contextValue = globals.DS_MEMBER_CONTEXT + "_this_is_a_very_complex_context_value";
        child.contextValue = contextValue;
        await dsActions.copyDataSets(child, null, blockMocks.testDatasetTree);
        expect(clipboard.readText()).toBe(`{"profileName":"sestest","dataSetName":"parent","memberName":"child","contextValue":"${contextValue}"}`);
    });
    it("Checking copy the label of a member to the clipboard via quickkeys", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        const selectedNodes = [child];
        const treeView = createTreeView(selectedNodes);
        blockMocks.testDatasetTree.getTreeView.mockReturnValueOnce(treeView);
        await dsActions.copyDataSets(null, null, blockMocks.testDatasetTree);
        expect(clipboard.readText()).toBe('{"profileName":"sestest","dataSetName":"parent","memberName":"child","contextValue":"member"}');
    });
    it("Checking copy the info of multiple members to the clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const nodeList: ZoweDatasetNode[] = [blockMocks.memberChild, blockMocks.memberChild];
        await dsActions.copyDataSets(null, nodeList, blockMocks.testDatasetTree);
        expect(clipboard.readText()).toBe(
            JSON.stringify([
                { profileName: "sestest", dataSetName: "parent", memberName: "child", contextValue: "member" },
                { profileName: "sestest", dataSetName: "parent", memberName: "child", contextValue: "member" },
            ])
        );
    });
    it("Checking copy of sequential datasets with empty new datasetname", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        child.contextValue = globals.DS_DS_CONTEXT;
        await expect(dsActions.copyDataSets(child, null, blockMocks.testDatasetTree)).toStrictEqual(Promise.resolve());
    });
    it("Checking copy of sequential datasets", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const nodeCopy = new ZoweDatasetNode("nodeCopy", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        nodeCopy.contextValue = globals.DS_DS_CONTEXT;
        const testEnc = 5178;
        blockMocks.imperativeProfile.profile.encoding = testEnc;

        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("nodeCopyCpy");
            return Promise.resolve("nodeCopyCpy");
        });
        const allocateSpy = jest.spyOn(blockMocks.mvsApi, "allocateLikeDataSet");
        allocateSpy.mockResolvedValue({
            success: true,
            commandResponse: "response",
            apiResponse: {},
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSet");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });

        mocked(vscode.window.withProgress).mockImplementation((prm, fnc) => {
            fnc();
            return Promise.resolve(prm);
        });
        expect(mocked(Gui.errorMessage)).not.toHaveBeenCalled();
        await expect(dsActions.copyDataSets(nodeCopy, null, blockMocks.testDatasetTree)).toStrictEqual(Promise.resolve());
    });

    it("Checking failed copy of sequential datasets", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        child.contextValue = globals.DS_DS_CONTEXT;
        const profile = blockMocks.imperativeProfile;
        const fakeEncoding = 9999;
        profile.profile.encoding = fakeEncoding;

        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const testError = new Error("copyDataSets failed");
        const allocSpy = jest.spyOn(blockMocks.mvsApi, "allocateLikeDataSet").mockRejectedValueOnce(testError);
        mocked(vscode.window.withProgress).mockImplementation((params, fn) => {
            fn();
            return Promise.resolve(params);
        });

        await dsActions.copyDataSets(child, null, blockMocks.testDatasetTree);
        expect(allocSpy).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });
    it("Checking copy of partitioned datasets", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const pNode = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        const dsNode = new ZoweDatasetNode(
            "dsNode",
            vscode.TreeItemCollapsibleState.Expanded,
            pNode,
            blockMocks.zosmfSession,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        dsNode.contextValue = globals.DS_PDS_CONTEXT;
        const profile = blockMocks.imperativeProfile;
        const fakeEncoding = 9999;
        profile.profile.encoding = fakeEncoding;
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("pdsTest");
            return Promise.resolve("pdsTest");
        });
        jest.spyOn(dsNode, "getChildren").mockResolvedValue([pNode, pNode]);

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "myRes",
            apiResponse: {},
        });
        mocked(vscode.window.withProgress).mockImplementation((params, fn) => {
            fn();
            return Promise.resolve(params);
        });

        await dsActions.copyDataSets(dsNode, null, blockMocks.testDatasetTree);
        await expect(mocked(Gui.errorMessage)).not.toHaveBeenCalled();
    });

    it("Checking fail of copy partitioned datasets", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        blockMocks.datasetSessionNode.contextValue = globals.DS_PDS_CONTEXT;
        const profile = blockMocks.imperativeProfile;
        const fakeEncoding = 9999;
        profile.profile.encoding = fakeEncoding;

        await mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const testError = new Error("copyDataSets failed");
        const allocSpy = jest.spyOn(blockMocks.mvsApi, "allocateLikeDataSet").mockRejectedValueOnce(testError);
        mocked(vscode.window.withProgress).mockImplementation((params, fn) => {
            fn();
            return Promise.resolve(params);
        });

        await dsActions.copyDataSets(child, null, blockMocks.testDatasetTree);
        expect(allocSpy).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });
    it("Checking copy the label of a favorite member to the clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        const nodeList: ZoweDatasetNode[] = [child];
        await dsActions.copyDataSets(null, nodeList, blockMocks.testDatasetTree);

        expect(clipboard.readText()).toBe('{"profileName":"sestest","dataSetName":"parent","memberName":"child","contextValue":"member"}');
    });
    it("Testing pasteDataSetMembers() fails and gives error message with empty clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        vscode.env.clipboard.writeText("");
        const errSpy = jest.spyOn(Gui, "errorMessage");
        await expect(dsActions.pasteDataSetMembers(blockMocks.testDatasetTree, blockMocks.datasetSessionNode)).toEqual(Promise.resolve());
        expect(errSpy).toBeCalled();
    });
    it("Testing pasteDataSetMembers() fails and gives error message with empty clipboard", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        vscode.env.clipboard.writeText("");
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        const errSpy = jest.spyOn(Gui, "errorMessage");
        await expect(dsActions.pasteDataSetMembers(blockMocks.testDatasetTree, node)).toEqual(Promise.resolve());
        expect(errSpy).toBeCalled();
    });
    it("Testing pasteDataSetMembers() succesfully runs pasteMember()", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        vscode.env.clipboard.writeText(JSON.stringify(getNodeLabels(blockMocks.pdsMemberNode)));
        const errSpy = jest.spyOn(dsActions, "pasteMember");
        errSpy.mockResolvedValueOnce(null);
        await expect(dsActions.pasteDataSetMembers(blockMocks.testDatasetTree, blockMocks.pdsMemberNode)).toEqual(Promise.resolve());
    });

    it("Testing pasteDataSetMembers() successfully runs with multiple members", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const memberNode = new ZoweDatasetNode(
            "memberNode",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.pdsSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        memberNode.contextValue = globals.DS_MEMBER_CONTEXT;
        const nodeList = [memberNode, memberNode, memberNode];

        const filePaths = [];
        nodeList.forEach((el) => {
            filePaths.push(getNodeLabels(el));
        });
        vscode.env.clipboard.writeText(JSON.stringify(filePaths));

        mocked(vscode.window.withProgress).mockImplementation((params, fn) => {
            fn();
            return Promise.resolve(params);
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });

        await dsActions.pasteDataSetMembers(blockMocks.testDatasetTree, memberNode);
        expect(mocked(Gui.errorMessage)).not.toHaveBeenCalled();
    });
    it("Testing pasteDataSetMembers() fails with multiple members", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const nodeList = [blockMocks.memberChild, blockMocks.memberChild, blockMocks.memberChild];
        const filePaths = [];
        nodeList.forEach((el) => {
            filePaths.push(getNodeLabels(el));
        });
        vscode.env.clipboard.writeText(JSON.stringify(filePaths));

        mocked(vscode.window.withProgress).mockImplementation((params, fn) => {
            fn();
            return Promise.resolve(params);
        });
        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockRejectedValueOnce("");
        await expect(dsActions.pasteDataSetMembers(blockMocks.testDatasetTree, blockMocks.memberChild)).toBeFalsy;
    });

    it("Testing downloadDs() called with invalid node", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.pdsSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.pdsSessionNode.contextValue = "fakeContext";

        try {
            await dsActions.downloadDs(node);
        } catch (err) {
            /* Do nothing */
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Cannot download, item invalid.");
    });

    it("Testing downloadDs() called with a member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.pdsSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );

        const label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
        const filePathSpy = jest.spyOn(sharedUtils, "getDocumentFilePath");
        await dsActions.downloadDs(node);
        expect(filePathSpy).toBeCalledWith(label, node);
    });

    it("Testing refreshDataset() error handling", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testError = new Error("refreshDataset failed");
        const refreshSpy = jest.spyOn(blockMocks.pdsSessionNode, "getChildren").mockRejectedValueOnce(testError);
        await dsActions.refreshDataset(blockMocks.pdsSessionNode, blockMocks.testDatasetTree);
        expect(refreshSpy).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(mocked(Gui.errorMessage).mock.calls[0][0]).toContain(testError.message);
    });

    it("Should ask to replace the sequential and partitioned dataset if it already exists", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("HLQ.TEST.DATASET", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        const spyListDs = jest.spyOn(blockMocks.mvsApi, "dataSet").mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ name: "HLQ.TEST.DATASET" }],
            },
        });
        mocked(vscode.window.showInputBox).mockResolvedValue("HLQ.TEST.DATASET");
        const spyAction = jest.fn();

        // SEQUENTIAL
        mocked(Gui.showMessage).mockResolvedValueOnce("Replace");
        node.contextValue = globals.DS_DS_CONTEXT;
        jest.spyOn(dsActions, "copySequentialDatasets").mockImplementationOnce(async (nodes) => {
            await dsActions._copyProcessor(nodes, "ps", spyAction);
        });
        spyAction.mockClear();
        mocked(Gui.showMessage).mockClear();
        await dsActions.copySequentialDatasets([node]);
        expect(spyAction).toHaveBeenCalled();
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();

        // PARTITIONED
        mocked(Gui.showMessage).mockResolvedValueOnce("Replace");
        node.contextValue = globals.DS_PDS_CONTEXT;
        jest.spyOn(dsActions, "copyPartitionedDatasets").mockImplementationOnce(async (nodes) => {
            await dsActions._copyProcessor(nodes, "po", spyAction);
        });
        spyAction.mockClear();
        mocked(Gui.showMessage).mockClear();
        await dsActions.copyPartitionedDatasets([node]);
        expect(spyAction).toHaveBeenCalled();
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();

        spyListDs.mockReset().mockClear();
    });
});

describe("Dataset Actions Unit Tests - Function pasteMember", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Should call zowe.Copy.dataSet when pasting to sequential data set", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_DS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        clipboard.writeText(
            JSON.stringify({
                dataSetName: "HLQ.TEST.BEFORE.NODE",
                profileName: blockMocks.imperativeProfile.name,
            })
        );

        await dsActions.pasteMember(node, blockMocks.testDatasetTree);

        expect(copySpy).toHaveBeenCalledWith({ dsn: "HLQ.TEST.BEFORE.NODE" }, { dsn: "HLQ.TEST.TO.NODE" }, { replace: false });
    });
    it("Should call zowe.Copy.dataSet when pasting to sequential data set of Unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_DS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        clipboard.writeText(
            JSON.stringify({
                dataSetName: "HLQ.TEST.BEFORE.NODE",
                profileName: blockMocks.imperativeProfile.name,
            })
        );

        await dsActions.pasteMember(node, blockMocks.testDatasetTree);

        expect(copySpy).toHaveBeenCalledWith({ dsn: "HLQ.TEST.BEFORE.NODE" }, { dsn: "HLQ.TEST.TO.NODE" }, { replace: false });
    });
    it("Should throw an error if invalid clipboard data is supplied when pasting to sequential data set", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_DS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockClear();
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        clipboard.writeText("INVALID");

        await expect(dsActions.pasteMember(node, blockMocks.testDatasetTree)).rejects.toEqual(Error("Invalid paste. Copy data set(s) first."));
        expect(copySpy).not.toBeCalled();
    });
    it("Should not call zowe.Copy.dataSet when pasting to partitioned data set with no member name", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_PDS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockClear();
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("");
        clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));

        await dsActions.pasteMember(node, blockMocks.testDatasetTree);
        expect(copySpy).not.toBeCalled();
    });
    it("Should call zowe.Copy.dataSet when pasting to partitioned data set", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        node.contextValue = globals.DS_PDS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        globalMocks.getContentsSpy.mockRejectedValueOnce(Error("Member not found"));
        const listAllMembersSpy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        listAllMembersSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("mem1");
        clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));

        await dsActions.pasteMember(node, blockMocks.testDatasetTree);

        expect(copySpy).toHaveBeenCalledWith({ dsn: "HLQ.TEST.BEFORE.NODE" }, { dsn: "HLQ.TEST.TO.NODE", member: "mem1" }, { replace: false });
        expect(blockMocks.testDatasetTree.findFavoritedNode).toHaveBeenCalledWith(node);
    });
    it("Should ask to replace the member if it already exists", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_PDS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockClear();
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        const listAllMembersSpy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        listAllMembersSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ member: "MEM1" }, { member: "MEM2" }],
            },
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("mem1");
        clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));
        mocked(Gui.showMessage).mockResolvedValueOnce("Cancel");

        await dsActions.pasteMember(node, blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
        expect(copySpy).not.toBeCalled();
    });
    it("Should call zowe.Copy.dataSet when pasting to a favorited partitioned data set", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favoritedNode = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        favoritedNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const nonFavoritedNode = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        nonFavoritedNode.contextValue = globals.DS_PDS_CONTEXT;

        const copySpy = jest.spyOn(blockMocks.mvsApi, "copyDataSetMember");
        copySpy.mockClear();
        copySpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {},
        });
        globalMocks.getContentsSpy.mockRejectedValueOnce(Error("Member not found"));
        const listAllMembersSpy = jest.spyOn(blockMocks.mvsApi, "allMembers");
        listAllMembersSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("mem1");
        mocked(blockMocks.testDatasetTree.findNonFavoritedNode).mockReturnValueOnce(nonFavoritedNode);
        clipboard.writeText(JSON.stringify({ dataSetName: "HLQ.TEST.BEFORE.NODE", profileName: "sestest" }));

        await dsActions.pasteMember(favoritedNode, blockMocks.testDatasetTree);

        expect(copySpy).toHaveBeenCalledWith({ dsn: "HLQ.TEST.BEFORE.NODE" }, { dsn: "HLQ.TEST.TO.NODE", member: "mem1" }, { replace: false });
        expect(mocked(blockMocks.testDatasetTree.findNonFavoritedNode)).toHaveBeenCalledWith(favoritedNode);
        expect(mocked(blockMocks.testDatasetTree.refreshElement)).toHaveBeenLastCalledWith(nonFavoritedNode);
    });
});

describe("Dataset Actions Unit Tests - Function hMigrateDataSet", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking that hMigrateDataSet successfully migrates a data set", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        const migrateSpy = jest.spyOn(blockMocks.mvsApi, "hMigrateDataSet");
        migrateSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await dsActions.hMigrateDataSet(node);

        expect(migrateSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });

    it("Checking that hMigrateDataSet throws an error if the user is invalid", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.profileInstance.validProfile = ValidProfileEnum.INVALID;
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        await dsActions.hMigrateDataSet(node);

        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
    });
    it("Checking PS dataset migrate for Unverified Profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        const migrateSpy = jest.spyOn(blockMocks.mvsApi, "hMigrateDataSet");
        migrateSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await dsActions.hMigrateDataSet(node);

        expect(migrateSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function hRecallDataSet", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset recall", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        const recallSpy = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        recallSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await dsActions.hRecallDataSet(node);

        expect(recallSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });

    it("Checking PS dataset recall for Unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        const recallSpy = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        recallSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });

        await dsActions.hRecallDataSet(node);

        expect(recallSpy).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.showMessage)).toHaveBeenCalled();
    });
});
describe("Dataset Actions Unit Tests - Function showFileErrorDetails", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking PS dataset with fileError as contextValue", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const testError = new zowe.imperative.ImperativeError({ msg: "test" });
        const testErrorString = JSON.stringify(testError, null, 2);
        const node = new ZoweDatasetNode(
            "HLQ.TEST.TO.NODE",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            globals.DS_FILE_ERROR_CONTEXT
        );

        const spyRecall = jest.spyOn(blockMocks.mvsApi, "hRecallDataSet");
        const spyLogError = mocked(ZoweLogger.error);

        // succeeded at recalling the dataset
        spyRecall.mockResolvedValueOnce({ success: true } as any);
        await dsActions.showFileErrorDetails(node);
        expect(spyRecall).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        spyRecall.mockReset();

        // failed recalling the dataset
        spyRecall.mockRejectedValueOnce(testError);
        await dsActions.showFileErrorDetails(node);
        expect(spyRecall).toHaveBeenCalledWith("HLQ.TEST.TO.NODE");
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith(testError.message);
        expect(spyLogError).toHaveBeenCalledWith(testErrorString);
        spyRecall.mockReset();
        spyLogError.mockReset();

        // error details was already cached (this should always be the expected path)
        node.errorDetails = testError;
        await dsActions.showFileErrorDetails(node);
        expect(spyRecall).not.toHaveBeenCalled();
        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith(testError.message);
        expect(spyLogError).toHaveBeenCalledWith(testErrorString);
        spyRecall.mockReset();
        spyLogError.mockReset();

        // Invalid profile provided
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: jest.fn(),
                    validProfile: ValidProfileEnum.INVALID,
                };
            }),
        });
        await dsActions.showFileErrorDetails(node);
        expect(mocked(Gui.errorMessage)).toHaveBeenCalled();
        expect(spyRecall).not.toHaveBeenCalled();
        expect(spyLogError).not.toHaveBeenCalled();
    });
});

describe("Dataset Actions Unit Tests - Function createFile", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);
        mocked(treeView.reveal).mockReturnValue(new Promise((resolve) => resolve(null)));

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
            mockCheckCurrentProfile,
        };
    }
    it("Checking of proper configuration being picked up for different DS types", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const getChildrenSpy = jest.spyOn(blockMocks.datasetSessionNode, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await dsActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await dsActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await dsActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await dsActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await dsActions.createFile(blockMocks.datasetSessionNode, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PS);

        expect(createDataSetSpy).toHaveBeenCalledTimes(5);
    });
    it("Checking of proper configuration being picked up for different DS types with credentials prompt", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, null, blockMocks.sessionWithoutCredentials);
        node.setProfileToChoice(blockMocks.imperativeProfile);
        node.contextValue = globals.DS_SESSION_CONTEXT;
        const getChildrenSpy = jest.spyOn(node, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PS);

        expect(createDataSetSpy).toHaveBeenCalledTimes(5);
    });
    it("Checking of proper configuration being picked up for different DS types with credentials prompt for favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.profileInstance.promptCredentials.mockReturnValue(["fake", "fake", "fake"]);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, null, blockMocks.sessionWithoutCredentials);
        node.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        const getChildrenSpy = jest.spyOn(node, "getChildren");
        getChildrenSpy.mockResolvedValue([]);

        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Binary" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_BINARY);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: C" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_C);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Classic" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_CLASSIC);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Partitioned Data Set: Default" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PDS);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PS);

        expect(createDataSetSpy).toHaveBeenCalledTimes(5);
        createDataSetSpy.mockClear();
    });
    it("Checking PS dataset creation", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PS);
        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking PS dataset errored creation with Unverified profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        createDataSetSpy.mockRejectedValueOnce(Error("Generic Error"));
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        try {
            await dsActions.createFile(node, blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Error encountered when creating data set. Error: Generic Error");
        expect(mocked(vscode.workspace.getConfiguration)).lastCalledWith(globals.SETTINGS_DS_DEFAULT_PS);
        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking dataset attempt of creation with empty type", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValue("test");
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("Operation Cancelled");
        expect(mocked(vscode.workspace.getConfiguration)).not.toBeCalled();
        expect(createDataSetSpy).not.toHaveBeenCalled();
    });
    it("Tests that user can edit the node label", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Node Label
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Data Set Name" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TEST.EDIT");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST.EDIT", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
    });

    it("Tests that user can edit the attributes and save as new template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Save");
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TestTemplate");
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "TRK",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
        expect(templateSpy).toBeCalled();
        expect(addTempSpy).toBeCalled();
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
    it("Tests that user can edit the attributes and don't save as new template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, "TEST", {
            alcunit: "TRK",
            blksize: 6160,
            dsorg: "PS",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
        });
        expect(templateSpy).toBeCalled();
        expect(addTempSpy).toBeCalledTimes(0);
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
    it("Checking dataset creation of saved template", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        blockMocks.testDatasetTree.getDsTemplates.mockReturnValue([
            {
                TEMPTST: {
                    alcunit: "CYL",
                    blksize: 6160,
                    dsorg: "PO",
                    lrecl: 80,
                    primary: 1,
                    recfm: "FB",
                },
            },
        ]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        mocked(vscode.window.showQuickPick).mockResolvedValue("Allocate Data Set" as any);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("TEMPTST" as any);
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toHaveBeenCalledWith(zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED, "TEST", {
            alcunit: "CYL",
            blksize: 6160,
            dsorg: "PO",
            lrecl: 80,
            primary: 1,
            recfm: "FB",
            responseTimeout: undefined,
        });
    });
    it("Checking correct opCancelled message with no dsName returned", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, "" as any);
        node.contextValue = globals.DS_DS_CONTEXT;
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toBeCalledWith("Operation Cancelled");
    });
    it("Checking opCancelled message shown when no ds type chosen", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, "" as any);
        node.contextValue = globals.DS_DS_CONTEXT;
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toBeCalledWith("Operation Cancelled");
    });
    it("Checking opCancelled message shown when user escapes allocate or edit attributes options", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, "" as any);
        node.contextValue = globals.DS_DS_CONTEXT;
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toBeCalledWith("Operation Cancelled");
    });
    it("Checking opCancelled message shown when user escapes during edit attributes", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        blockMocks.testDatasetTree.createFilterString.mockReturnValue("test");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([]);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, "" as any);
        node.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = undefined as any;
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        const createDataSetSpy = jest.spyOn(Gui, "showMessage");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(createDataSetSpy).toBeCalledWith("Operation Cancelled");
    });
    it("Checking opCancelled message shown when no template name supplied", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        blockMocks.testDatasetTree.createFilterString.mockReturnValue("NODE1,NODE.*");
        blockMocks.testDatasetTree.getSearchHistory.mockReturnValue([null]);

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const createDataSetSpy = jest.spyOn(blockMocks.mvsApi, "createDataSet");
        createDataSetSpy.mockReset();
        const node = new ZoweDatasetNode("HLQ.TEST.TO.NODE", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_DS_CONTEXT;

        // 1st step: User names DS
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("test");

        // 2nd step: User selects DS type
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Sequential Data Set" as any);

        // 3rd step: User selects Edit attributes
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Edit Attributes" as any);

        // 4th step: User tries to edit Record Length
        const quickPickContent = createQuickPickContent("", [], "");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        const selectedItem: vscode.QuickPickItem = { label: "Allocation Unit" };
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(selectedItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("TRK");

        // Then they try to allocate
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce({ label: "Allocate Data Set" });

        const templateSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Save");
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        const opCancelledSpy = jest.spyOn(Gui, "showMessage");
        const addTempSpy = jest.spyOn(blockMocks.testDatasetTree, "addDsTemplate");
        await dsActions.createFile(node, blockMocks.testDatasetTree);

        expect(templateSpy).toBeCalled();
        expect(addTempSpy).toBeCalledTimes(0);
        expect(opCancelledSpy).toBeCalledWith("Operation Cancelled");
        templateSpy.mockClear();
        addTempSpy.mockClear();
    });
});

describe("Dataset Actions Unit Tests - Function openPS", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
        };
    }

    it("Checking of opening for common dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        await dsActions.openPS(node, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of opening for common dataset with unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        await dsActions.openPS(node, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of failed attempt to open dataset", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        globalMocks.getContentsSpy.mockRejectedValueOnce(new Error("testError"));
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);

        try {
            await dsActions.openPS(node, true, blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error: testError");
    });

    it("Check for invalid/null response without supporting ongoing actions", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        globalMocks.getContentsSpy.mockResolvedValueOnce(null);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        node.ongoingActions = undefined as any;

        try {
            await dsActions.openPS(node, true, blockMocks.testDatasetTree);
        } catch (err) {
            expect(err.message).toBe("Response was null or invalid.");
        }
    });

    it("Checking of opening for PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.DS_PDS_CONTEXT;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await dsActions.openPS(child, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(
            path.join(globals.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(
            sharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for PDS Member of favorite dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await dsActions.openPS(child, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(
            path.join(globals.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(
            sharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for sequential DS of favorite session", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favProfileNode = new ZoweDatasetNode(
            "parent",
            vscode.TreeItemCollapsibleState.None,
            null,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, favProfileNode, null);
        child.contextValue = globals.DS_FAV_CONTEXT;

        await dsActions.openPS(child, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, blockMocks.imperativeProfile.name, child.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(child.label.toString(), child));
    });
    it("Checks that openPS fails if called from an invalid node", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode(
            "parent",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null,
            undefined,
            undefined,
            blockMocks.imperativeProfile
        );
        blockMocks.datasetSessionNode.contextValue = "aieieiieeeeooooo";

        try {
            await dsActions.openPS(node, true, blockMocks.testDatasetTree);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Invalid data set or member.");
    });
    it("Checking that error is displayed and logged for opening of node with invalid context value", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parentNode = new ZoweDatasetNode(
            "badParent",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            blockMocks.session,
            "badContext",
            undefined,
            blockMocks.imperativeProfile
        );
        const node = new ZoweDatasetNode(
            "cantOpen",
            vscode.TreeItemCollapsibleState.None,
            parentNode,
            blockMocks.session,
            globals.DS_MEMBER_CONTEXT,
            undefined,
            blockMocks.imperativeProfile
        );
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        const logErrorSpy = jest.spyOn(ZoweLogger, "error");

        try {
            await dsActions.openPS(node, true, blockMocks.testDatasetTree);
        } catch (err) {
            // Do nothing
        }

        expect(showErrorMessageSpy).toBeCalledWith("Invalid data set or member.");
        expect(logErrorSpy).toBeCalledTimes(1);
    });
});

describe("Dataset Actions Unit Tests - Function allocateLike", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const testNode = new ZoweDatasetNode("nodePDS", vscode.TreeItemCollapsibleState.None, datasetSessionNode, null);
        const testSDSNode = new ZoweDatasetNode("nodeSDS", vscode.TreeItemCollapsibleState.None, datasetSessionNode, null);
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const mvsApi = createMvsApi(imperativeProfile);
        const quickPickItem = new utils.FilterDescriptor(datasetSessionNode.label.toString());
        const quickPickContent = createQuickPickContent("", [quickPickItem], "");

        bindMvsApi(mvsApi);
        testNode.contextValue = globals.DS_PDS_CONTEXT;
        testSDSNode.contextValue = globals.DS_DS_CONTEXT;

        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        mocked(Profiles.getInstance).mockReturnValue(profileInstance);
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.validateInput("test");
            return Promise.resolve("test");
        });
        jest.spyOn(datasetSessionNode, "getChildren").mockResolvedValue([testNode, testSDSNode]);
        testDatasetTree.createFilterString.mockReturnValue("test");
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValue(quickPickItem);
        jest.spyOn(dsActions, "openPS").mockImplementation(() => null);

        return {
            session,
            treeView,
            testNode,
            quickPickContent,
            testSDSNode,
            quickPickItem,
            profileInstance,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree,
        };
    }

    it("Tests that allocateLike works if called from the command palette", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await dsActions.allocateLike(blockMocks.testDatasetTree);

        expect(errorHandlingSpy).toHaveBeenCalledTimes(0);
        expect(blockMocks.quickPickContent.show).toHaveBeenCalledTimes(1);
    });
    it("Tests that allocateLike works if called from the context menu", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await dsActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(errorHandlingSpy).toHaveBeenCalledTimes(0);
        expect(blockMocks.quickPickContent.show).toHaveBeenCalledTimes(0);
    });
    it("Tests that the dataset filter string is updated on the session, to include the new node's name", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        await dsActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(blockMocks.datasetSessionNode.pattern).toEqual("TEST");
    });
    it("Tests that allocateLike fails if no profile is selected", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(null);

        await dsActions.allocateLike(blockMocks.testDatasetTree);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("You must select a profile.");
    });
    it("Tests that allocateLike fails if no new dataset name is provided", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.showInputBox).mockResolvedValueOnce(null);

        await dsActions.allocateLike(blockMocks.testDatasetTree, blockMocks.testNode);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("You must enter a new data set name.");
    });
    it("Tests that allocateLike fails if error is thrown", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");
        const errorMessage = new Error("Test error");
        jest.spyOn(blockMocks.mvsApi, "allocateLikeDataSet").mockRejectedValue(errorMessage);

        try {
            await dsActions.allocateLike(blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
        expect(errorHandlingSpy).toHaveBeenCalledWith(errorMessage, "test", "Unable to create data set.");
    });
});
