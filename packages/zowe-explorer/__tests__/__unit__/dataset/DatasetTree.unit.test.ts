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
import * as globals from "../../../src/globals";
import * as fs from "fs";
import * as zowe from "@zowe/cli";
import { DatasetTree } from "../../../src/dataset/DatasetTree";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import {
    DatasetFilterOpts,
    DatasetSortOpts,
    Gui,
    IZoweDatasetTreeNode,
    ProfilesCache,
    SortDirection,
    ValidProfileEnum,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import { getIconByNode } from "../../../src/generators/icons";
import {
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createQuickPickContent,
    createTreeView,
    createWorkspaceConfiguration,
    createPersistentConfig,
    createValidIProfile,
    createInstanceOfProfileInfo,
    createGetConfigMock,
    createTreeProviders,
    createMockNode,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree, createDatasetFavoritesNode } from "../../../__mocks__/mockCreators/datasets";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import * as workspaceUtils from "../../../src/utils/workspace";
import { PersistentFilters } from "../../../src/PersistentFilters";
import * as dsUtils from "../../../src/dataset/utils";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import * as sharedActions from "../../../src/shared/actions";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { join } from "path";
import { mocked } from "../../../__mocks__/mockUtils";
import * as sharedUtils from "../../../src/shared/utils";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";
import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";

jest.mock("fs");
jest.mock("util");

function createGlobalMocks() {
    globals.defineGlobals("");

    const globalMocks = {
        isTheia: jest.fn(),
        testProfileLoaded: createValidIProfile(),
        mockProfileInstance: null,
        mockShowWarningMessage: jest.fn(),
        mockProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(zowe.imperative.Logger.getAppLogger()),
        mockTreeProviders: createTreeProviders(),
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfileLoaded);

    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        configurable: true,
    });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "setStatusBarMessage", { value: jest.fn().mockReturnValue({ dispose: jest.fn() }), configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Rename", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Rename, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Rename, "dataSetMember", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "Download", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: globalMocks.isTheia, configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "unlinkSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "existsSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
    Object.defineProperty(workspaceUtils, "closeOpenedTextFile", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", {
        value: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        configurable: true,
    });
    Object.defineProperty(vscode, "ConfigurationTarget", {
        value: jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3,
            };
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((progLocation, callback) => {
            return callback();
        }),
        configurable: true,
    });
    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.automaticProfileValidation": true,
        }),
    });
    Object.defineProperty(globalMocks.mockProfilesCache, "getConfigInstance", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(zowe.Download, "dataSet", {
        value: jest.fn().mockResolvedValue({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        }),
        configurable: true,
    });
    Object.defineProperty(zowe.Download, "dataSetMember", {
        value: jest.fn(() => {
            return {
                success: true,
                commandResponse: null,
                apiResponse: {
                    etag: "123",
                },
            };
        }),
        configurable: true,
    });
    Object.defineProperty(Gui, "warningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();
    jest.spyOn(LocalFileManagement, "deleteFileInfo").mockImplementation();
    jest.spyOn(LocalFileManagement, "removeRecoveredFile").mockImplementation();

    return globalMocks;
}

describe("Dataset Tree Unit Tests - Initialisation", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            treeView,
            datasetSessionNode,
        };
    }

    it("Checking definition of the dataset tree", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        expect(testTree.mSessionNodes.map((node) => node.label)).toEqual(["Favorites", blockMocks.datasetSessionNode.label]);
        expect(testTree.getTreeView()).toEqual(blockMocks.treeView);
    });
});

describe("Dataset Tree Unit Tests - Function getTreeItem", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking function with PS Dataset", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const node = new ZoweDatasetNode({
            label: "BRTVS99",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        expect(testTree.getTreeItem(node)).toBeInstanceOf(vscode.TreeItem);
    });
});
describe("Dataset Tree Unit tests - Function initializeFavChildNodeForProfile", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            imperativeProfile,
            session,
            datasetSessionNode,
        };
    }

    it("Checking function for PDS favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode({
            label: "BRTVS99.PUBLIC",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile("BRTVS99.PUBLIC", globals.DS_PDS_CONTEXT, favProfileNode);

        expect(favChildNodeForProfile).toEqual(node);
    });
    it("Checking function for sequential DS favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode({
            label: "BRTVS99.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            contextOverride: globals.DS_FAV_CONTEXT,
        });
        node.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [node] };

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile("BRTVS99.PS", globals.DS_DS_CONTEXT, favProfileNode);

        expect(favChildNodeForProfile).toEqual(node);
    });
    it("Checking function for invalid context value", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        await testTree.initializeFavChildNodeForProfile("BRTVS99.BAD", "badContextValue", favProfileNode);

        expect(showErrorMessageSpy).toBeCalledTimes(1);
        showErrorMessageSpy.mockClear();
    });
});
describe("Dataset Tree Unit Tests - Function getChildren", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const profile = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            imperativeProfile,
            session,
            profile,
            datasetSessionNode,
            treeView,
            mvsApi,
        };
    }

    it("Checking function for root node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const favoriteSessionNode = new ZoweDatasetNode({ label: "Favorites", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        favoriteSessionNode.contextValue = globals.FAVORITE_CONTEXT;
        const targetIcon = getIconByNode(favoriteSessionNode);
        if (targetIcon) {
            favoriteSessionNode.iconPath = targetIcon.path;
        }

        const children = await testTree.getChildren();

        expect(favoriteSessionNode).toMatchObject(children[0]);
        expect(blockMocks.datasetSessionNode).toMatchObject(children[1]);
    });
    it("Checking function for session node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        blockMocks.datasetSessionNode.pattern = "test";
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].dirty = true;
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode({
                label: "BRTVS99",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.CA10",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
                contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.CA11.SPFTEMP0.CNTL",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.DDIR",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.VS1",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
                contextOverride: globals.VSAM_CONTEXT,
            }),
        ];
        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };

        const children = await testTree.getChildren(testTree.mSessionNodes[1]);
        expect(children.map((c) => c.label)).toEqual(sampleChildren.map((c) => c.label));
        expect(children).toEqual(sampleChildren);
    });
    it("Checking function for session node with an imperative error", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const testError = new zowe.imperative.ImperativeError({ msg: "test" });
        const spyOnDataSetsMatchingPattern = jest.spyOn(zowe.List, "dataSetsMatchingPattern");
        spyOnDataSetsMatchingPattern.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: [
                { dsname: "HLQ.USER", dsorg: "PS" },
                { dsname: "HLQ.USER.IMP.ERROR", error: testError },
                { dsname: "HLQ.USER.MIGRAT", dsorg: "PS", migr: "YES" },
            ],
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        blockMocks.datasetSessionNode.pattern = "test";
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].dirty = true;
        const nodeOk = new ZoweDatasetNode({
            label: "HLQ.USER",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            profile: blockMocks.imperativeProfile,
        });
        const nodeImpError = new ZoweDatasetNode({
            label: "HLQ.USER.IMP.ERROR",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_FILE_ERROR_CONTEXT,
        });
        nodeImpError.errorDetails = testError;
        const nodeMigrated = new ZoweDatasetNode({
            label: "HLQ.USER.MIGRAT",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
        });
        const sampleChildren: ZoweDatasetNode[] = [nodeOk, nodeImpError, nodeMigrated];
        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.placeholderCommand", title: "" };

        const children = await testTree.getChildren(testTree.mSessionNodes[1]);
        expect(children.map((c) => c.label)).toEqual(sampleChildren.map((c) => c.label));
        expect(children).toEqual(sampleChildren);
        spyOnDataSetsMatchingPattern.mockRestore();
    });
    it("Checking that we fallback to old dataSet API if newer dataSetsMatchingPattern does not exist", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const mockMvsApi = await ZoweExplorerApiRegister.getMvsApi(blockMocks.profile);
        mockMvsApi.dataSetsMatchingPattern = null;
        const getMvsApiMock = jest.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock.bind(ZoweExplorerApiRegister);

        const spyOnDataSetsMatchingPattern = jest.spyOn(zowe.List, "dataSetsMatchingPattern");
        const spyOnDataSet = jest.spyOn(zowe.List, "dataSet");
        spyOnDataSet.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                items: [{ dsname: "HLQ.USER", dsorg: "PS" }],
            },
        });
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        blockMocks.datasetSessionNode.pattern = "test";
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].dirty = true;
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode({
                label: "HLQ.USER",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: testTree.mSessionNodes[1],
                profile: blockMocks.imperativeProfile,
            }),
        ];
        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };

        const children = await testTree.getChildren(testTree.mSessionNodes[1]);
        expect(children.map((c) => c.label)).toEqual(sampleChildren.map((c) => c.label));
        expect(children).toEqual(sampleChildren);
        expect(spyOnDataSet).toHaveBeenCalled();
        expect(spyOnDataSetsMatchingPattern).not.toHaveBeenCalled();
        spyOnDataSet.mockRestore();
        spyOnDataSetsMatchingPattern.mockRestore();
    });
    it("Checking function for favorite node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);

        const children = await testTree.getChildren(testTree.mSessionNodes[0]);

        expect(children).toEqual([favProfileNode]);
    });
    it("Checking function for favorited node with no member pattern", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const profileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });
        profileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        profileNode.memberPattern = undefined;
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mFavorites.push(profileNode);

        const children = await testTree.getChildren(testTree.mSessionNodes[0]);

        expect(children).toEqual([profileNode]);
    });
    it("Checking function for profile node in Favorites section", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const log = zowe.imperative.Logger.getAppLogger();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy = jest.spyOn(testTree, "loadProfilesForFavorites");

        await testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
    it("Checking function for PDS Dataset node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "BRTVS99.PUBLIC",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        parent.dirty = true;
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode({ label: "BRTVS99", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent }),
            new ZoweDatasetNode({ label: "BRTVS99.DDIR", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent }),
        ];
        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[1]] };

        const children = await testTree.getChildren(parent);

        expect(children).toEqual(sampleChildren);
    });
    it("Checking function for return if element.getChildren is undefined", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "BRTVS99.PUBLIC",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        parent.dirty = true;
        jest.spyOn(parent, "getChildren").mockResolvedValueOnce(undefined as any);

        const children = await testTree.getChildren(parent);

        expect(children).not.toBeDefined();
    });
});
describe("Dataset Tree Unit Tests - Function loadProfilesForFavorites", () => {
    function createBlockMocks() {
        const log = zowe.imperative.Logger.getAppLogger();
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetFavoriteNode = createDatasetFavoritesNode();
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            log,
            imperativeProfile,
            session,
            datasetFavoriteNode,
            treeView,
            mvsApi,
        };
    }

    it("Checking that loaded profile and session values are added to the profile grouping node in Favorites", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
        });
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
        });

        // Mock successful loading of profile/session
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    getBaseProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return {
                            name: blockMocks.imperativeProfile.name,
                            status: "unverified",
                        };
                    }),
                    validProfile: ValidProfileEnum.VALID,
                };
            }),
        });
        Object.defineProperty(blockMocks.mvsApi, "getSession", {
            value: jest.fn(() => {
                return blockMocks.session;
            }),
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavProfileNode = testTree.mFavorites[0];

        expect(resultFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Checking that error is handled if profile not successfully loaded for profile grouping node in Favorites", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweDatasetNode({
            label: "badTestProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
        });
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        throw new Error();
                    }),
                    getBaseProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                };
            }),
        });
        mocked(Gui.errorMessage).mockResolvedValueOnce("Remove");
        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        expect(showErrorMessageSpy).toBeCalledTimes(1);
        showErrorMessageSpy.mockClear();
    });
    it("Checking that favorite nodes with pre-existing profile/session values continue using those values", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
        });
        const favPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });
        const testTree = new DatasetTree();
        favProfileNode.children.push(favPdsNode);
        testTree.mFavorites.push(favProfileNode);
        const expectedFavPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavPdsNode = testTree.mFavorites[0].children[0];

        expect(resultFavPdsNode).toEqual(expectedFavPdsNode);
    });
    it("Checking that loaded profile/session from profile node in Favorites gets passed to child favorites without profile/session", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
        });
        // Leave mParent parameter undefined for favPDsNode and expectedFavPdsNode to test undefined profile/session condition
        const favPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });
        const testTree = new DatasetTree();
        favProfileNode.children.push(favPdsNode);
        testTree.mFavorites.push(favProfileNode);
        const expectedFavPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.PDS_FAV_CONTEXT,
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavPdsNode = testTree.mFavorites[0].children[0];

        expect(resultFavPdsNode).toEqual(expectedFavPdsNode);
    });
});
describe("Dataset Tree Unit Tests - Function getParent", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking function on the root node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        const parentNode = testTree.getParent(blockMocks.datasetSessionNode);

        expect(parentNode).toBeUndefined();
    });
    it("Checking function on the non-root node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "BRTVS99",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
        });

        expect(testTree.getParent(node)).toMatchObject(blockMocks.datasetSessionNode);
    });
});
describe("Dataset Tree Unit Tests - Function getSearchHistory", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();

        testTree.addSearchHistory("testHistory");

        expect(testTree.getSearchHistory()).toEqual(["testHistory"]);
    });
});
describe("Dataset Tree Unit Tests - Function addFileHistory", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();

        testTree.addFileHistory("testFileHistory");

        expect(testTree.getFileHistory()).toEqual(["TESTFILEHISTORY"]);
    });
});
describe("Dataset Tree Unit Tests - Function removeFileHistory", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();

        testTree.addFileHistory("testFileHistory");
        expect(testTree.getFileHistory()).toEqual(["TESTFILEHISTORY"]);
        testTree.removeFileHistory("testFileHistory");
        expect(testTree.getFileHistory()).toEqual([]);
    });
});
describe("Dataset Tree Unit Tests - Function addSession", () => {
    function createBlockMocks() {
        const newMocks = {
            log: zowe.imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            treeView: createTreeView(),
            testDatasetTree: null,
            datasetSessionNode: null,
            profile: null,
            mockResetValidation: jest.fn(),
            mockDefaultProfile: jest.fn(),
            mockLoadNamedProfile: jest.fn(),
            mockValidationSetting: jest.fn(),
            mockAddSingleSession: jest.fn(),
            mockDisableValidationContext: jest.fn(),
            mockEnableValidationContext: jest.fn(),
            mockLoadDefaultProfile: jest.fn(),
            mockProfileInstance: null,
            mockMHistory: PersistentFilters,
            mockGetConfiguration: jest.fn(),
            mockPersistenceSchema: createPersistentConfig(),
        };

        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        // Profile instance mocks
        newMocks.mockProfileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.mockProfileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        newMocks.mockLoadDefaultProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.mockProfileInstance.getDefaultProfile = newMocks.mockLoadDefaultProfile;
        newMocks.mockProfileInstance.enableValidationContext = newMocks.mockEnableValidationContext;
        newMocks.mockProfileInstance.disableValidationContext = newMocks.mockDisableValidationContext;
        newMocks.mockProfileInstance.validProfile = ValidProfileEnum.VALID;
        newMocks.mockProfileInstance.allProfiles = jest.fn().mockReturnValue([newMocks.imperativeProfile]);

        return newMocks;
    }
    it("Checking successful adding of session", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        jest.spyOn(testTree, "addSingleSession").mockImplementation();
        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({
            ds: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
            uss: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
            jobs: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
        } as any);

        await testTree.addSession(blockMocks.imperativeProfile.name);
        expect(testTree.mSessionNodes[1].label).toBe(blockMocks.imperativeProfile.name);
    });

    it("Checking successful adding of session with disabled validation", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = createDatasetTree(blockMocks.datasetSessionNode, blockMocks.treeView);
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        Object.defineProperty(testTree.mHistory, "getSessions", {
            value: jest.fn(() => {
                return ["sestest", "profile1", "profile2"];
            }),
        });

        blockMocks.mockProfileInstance.validationSetting = blockMocks.mockValidationSetting.mockReturnValueOnce(false);

        testTree.addSession(blockMocks.imperativeProfile.name);
        expect(testTree.mSessionNodes[1].label).toBe(blockMocks.imperativeProfile.name);
    });

    it("Checking successful adding of session without sessname passed", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = createDatasetTree(blockMocks.datasetSessionNode, blockMocks.treeView);
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mHistory.push(blockMocks.imperativeProfile.name);

        testTree.addSession();
        expect(testTree.mSessionNodes[1].label).toBe(blockMocks.imperativeProfile.name);
    });

    it("Checking failed attempt to add a session due to the missing profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        jest.spyOn(Profiles.getInstance(), "loadNamedProfile").mockReturnValueOnce(null);

        await testTree.addSession("fake");

        expect(testTree.mSessionNodes[1]).not.toBeDefined();
    });

    it("Checking successful adding of session with profile type passed", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes = [
            {
                label: {
                    toString: () => "test",
                },
                getProfileName: () => "sestest",
            } as any,
        ];
        jest.spyOn((testTree as any).mHistory, "getSessions").mockReturnValue(["sestest"]);
        jest.spyOn(Profiles.getInstance(), "fetchAllProfilesByType").mockReturnValue(Promise.resolve([blockMocks.imperativeProfile]));
        jest.spyOn(sharedActions, "resetValidationSettings").mockImplementation();

        await expect(testTree.addSession(null, "test")).resolves.not.toThrow();
    });
});

describe("USSTree Unit Tests - Function addSingleSession", () => {
    function createBlockMocks() {
        const newMocks = {
            mockProfilesInstance: null,
            testProfile: createIProfile(),
            testBaseProfile: createValidIProfile(),
            testCombinedProfile: createValidIProfile(),
            testSession: createISession(),
            testUSSNode: null,
            testTree: null,
            profilesForValidation: { status: "active", name: "fake" },
        };

        newMocks.testBaseProfile.profile.tokenType = "tokenType";
        newMocks.testBaseProfile.profile.tokenValue = "testTokenValue";
        newMocks.testCombinedProfile.profile.tokenType = "tokenType";
        newMocks.testCombinedProfile.profile.tokenValue = "testTokenValue";
        newMocks.mockProfilesInstance = createInstanceOfProfile(newMocks.testProfile);
        newMocks.mockProfilesInstance.getBaseProfile.mockResolvedValue(newMocks.testBaseProfile);
        newMocks.mockProfilesInstance.loadNamedProfile.mockReturnValue(newMocks.testProfile);
        newMocks.mockProfilesInstance.allProfiles = [newMocks.testProfile, { name: "firstName" }, { name: "secondName" }];
        newMocks.testTree = new DatasetTree();
        const datasetSessionTestNode = createDatasetSessionNode(newMocks.testSession, newMocks.testProfile);
        newMocks.testTree.mSessionNodes.push(datasetSessionTestNode);
        mocked(Profiles.getInstance).mockReturnValue(newMocks.mockProfilesInstance);

        return newMocks;
    }

    it("Tests that addSingleSession doesn't add the session again, if it was already added", async () => {
        await createGlobalMocks();
        const blockMocks = await createBlockMocks();

        await blockMocks.testTree.addSingleSession(blockMocks.testProfile);

        expect(blockMocks.testTree.mSessionNodes.length).toEqual(2);
    });

    it("Tests that addSingleSession successfully adds a session", async () => {
        await createGlobalMocks();
        const blockMocks = await createBlockMocks();

        blockMocks.testTree.mSessionNodes.pop();
        blockMocks.testSession.ISession.tokenType = blockMocks.testBaseProfile.profile.tokenType;
        blockMocks.testSession.ISession.tokenValue = blockMocks.testBaseProfile.profile.tokenValue;

        // Mock the USS API so that getSession returns the correct value
        const mockMvsApi = await ZoweExplorerApiRegister.getMvsApi(blockMocks.testProfile);
        const getMvsApiMock = jest.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockMvsApi, "getSession").mockReturnValue(blockMocks.testSession);

        await blockMocks.testTree.addSingleSession(blockMocks.testProfile);

        expect(blockMocks.testTree.mSessionNodes.length).toEqual(2);
        expect(blockMocks.testTree.mSessionNodes[1].profile.name).toEqual(blockMocks.testProfile.name);
    });

    it("should log the error if the error includes the hostname", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        jest.spyOn(ZoweExplorerApiRegister.getMvsApi(blockMocks.testProfile), "getSession").mockImplementationOnce(() => {
            throw new Error("test error hostname:sample.com");
        });
        const zoweLoggerErrorSpy = jest.spyOn(ZoweLogger, "error");
        expect(blockMocks.testTree.addSingleSession({ name: "test1234" }));
        expect(zoweLoggerErrorSpy).toBeCalledTimes(1);
    });

    it("should call 'errorHandling()' if the error does not include the hostname", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        jest.spyOn(ZoweExplorerApiRegister.getMvsApi(blockMocks.testProfile), "getSession").mockImplementationOnce(() => {
            throw new Error("test error");
        });
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");
        expect(blockMocks.testTree.addSingleSession({ name: "test1234" }));
        expect(errorHandlingSpy).toBeCalledTimes(1);
    });
});

describe("Dataset Tree Unit Tests - Function addFavorite", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profile = createInstanceOfProfile(imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
            profile,
            imperativeProfile,
        };
    }

    it("Checking adding of PS Dataset node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });

        await testTree.addFavorite(node);

        expect(testTree.mFavorites[0].label).toBe(`${blockMocks.datasetSessionNode.label}`);
        expect(testTree.mFavorites[0].contextValue).toBe(`${globals.FAV_PROFILE_CONTEXT}`);
        expect(testTree.mFavorites[0].children[0].label).toBe(`${node.label}`);
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(`${globals.DS_DS_CONTEXT}${globals.FAV_SUFFIX}`);
    });
    it("Checking adding of PDS Dataset node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        node.contextValue = globals.DS_PDS_CONTEXT;

        await testTree.addFavorite(node);

        expect(testTree.mFavorites[0].label).toBe(`${blockMocks.datasetSessionNode.label}`);
        expect(testTree.mFavorites[0].contextValue).toBe(`${globals.FAV_PROFILE_CONTEXT}`);
        expect(testTree.mFavorites[0].children[0].label).toBe(`${node.label}`);
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(`${globals.DS_PDS_CONTEXT}${globals.FAV_SUFFIX}`);
    });
    it("Checking adding of PDS Member node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        const child = new ZoweDatasetNode({ label: "Child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        parent.contextValue = globals.DS_PDS_CONTEXT;
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await testTree.addFavorite(child);

        expect(testTree.mFavorites[0].label).toBe(`${blockMocks.datasetSessionNode.label}`);
        expect(testTree.mFavorites[0].contextValue).toBe(`${globals.FAV_PROFILE_CONTEXT}`);
        expect(testTree.mFavorites[0].children[0].label).toBe(`${parent.label}`);
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(`${globals.DS_PDS_CONTEXT}${globals.FAV_SUFFIX}`);
    });
    it("Checking adding of Session node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].pattern = "test";

        await testTree.addFavorite(testTree.mSessionNodes[1]);

        expect(testTree.mFavorites[0].label).toBe(`${blockMocks.datasetSessionNode.label}`);
        expect(testTree.mFavorites[0].contextValue).toBe(`${globals.FAV_PROFILE_CONTEXT}`);
        expect(testTree.mFavorites[0].children[0].label).toBe(`${testTree.mSessionNodes[1].pattern}`);
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(`${globals.DS_SESSION_CONTEXT}${globals.FAV_SUFFIX}`);
    });
    it("Checking attempt to add a duplicate node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });

        await testTree.addFavorite(node);
        await testTree.addFavorite(node);

        expect(testTree.mFavorites[0].children.map((entry) => entry.label)).toEqual([`${node.label}`]);
    });
    it("Checking attempt to add a member of favorite PDS", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        const child = new ZoweDatasetNode({ label: "Child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await testTree.addFavorite(child);

        expect(mocked(Gui.showMessage)).toBeCalledWith("PDS already in favorites");
    });
});
describe("Dataset Tree Unit Tests - Function removeFavorite", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking removeFavorite when starting with more than one favorite for the profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node1 = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        const node2 = new ZoweDatasetNode({
            label: "Dataset2",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        const removeFavProfileSpy = jest.spyOn(testTree, "removeFavProfile");

        // We're breaking rule 1 function call per 1 it block, but there's no over proper way to verify the functionality
        // First we need to have the item and be sure that it's properly added to have legit removal operation
        await testTree.addFavorite(node1);
        await testTree.addFavorite(node2);
        const profileNodeInFavs = testTree.mFavorites[0];
        expect(profileNodeInFavs.children[0].label).toBe(`${node1.label}`);
        expect(profileNodeInFavs.children[1].label).toBe(`${node2.label}`);

        // Actual test
        await testTree.removeFavorite(profileNodeInFavs.children[0]);
        expect(removeFavProfileSpy).not.toBeCalled();
        expect(profileNodeInFavs.children.length).toBe(1);
        expect(profileNodeInFavs.children[0].label).toBe(`${node2.label}`);
    });
    it("Checking removeFavorite when starting with only one favorite for the profile", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });

        const removeFavProfileSpy = jest.spyOn(testTree, "removeFavProfile");

        // We're breaking rule 1 function call per 1 it block, but there's no over proper way to verify the functionality
        // First we need to have the item and be sure that it's properly added to have legit removal operation
        await testTree.addFavorite(node);
        const profileNodeInFavs = testTree.mFavorites[0];
        expect(profileNodeInFavs.children[0].label).toBe(`${node.label}`);
        await testTree.removeFavorite(profileNodeInFavs.children[0]);
        expect(removeFavProfileSpy).toHaveBeenCalledWith(profileNodeInFavs.label, false);
        expect(testTree.mFavorites.length).toBe(0);
    });

    it("Checking removeFavorite when calling with a node that is not favorited", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });

        const updateFavoritesSpy = jest.spyOn(testTree, "updateFavorites");
        const removeFavoriteSpy = jest.spyOn(testTree, "removeFavorite");

        await testTree.removeFavorite(node);
        expect(removeFavoriteSpy).toHaveReturned();
        expect(updateFavoritesSpy).not.toHaveBeenCalled();
    });
});
describe("Dataset Tree Unit Tests - Function removeFavProfile", () => {
    async function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testTree = new DatasetTree();
        testTree.mFavorites = [];
        testTree.mSessionNodes.push(datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
        });
        await testTree.addFavorite(node);
        const profileNodeInFavs: IZoweDatasetTreeNode = testTree.mFavorites[0];

        return {
            treeView,
            testTree,
            profileNodeInFavs,
        };
    }
    it("Tests successful removal of profile node in Favorites when user confirms they want to Continue removing it", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks();
        const updateFavoritesSpy = jest.spyOn(blockMocks.testTree, "updateFavorites");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        // Make sure favorite is added before the actual unit test
        expect(blockMocks.testTree.mFavorites.length).toEqual(1);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Continue");

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label.toString(), true);

        // Check that favorite is removed from UI
        expect(blockMocks.testTree.mFavorites.length).toEqual(0);
        // Check that favorite is removed from settings file
        expect(updateFavoritesSpy).toBeCalledTimes(1);
    });
    it("Tests that removeFavProfile leaves profile node in Favorites when user cancels", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        // Make sure favorite is added before the actual unit test
        expect(blockMocks.testTree.mFavorites.length).toEqual(1);

        const expectedFavProfileNode = blockMocks.testTree.mFavorites[0];
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label.toString(), true);

        expect(blockMocks.testTree.mFavorites.length).toEqual(1);
        expect(blockMocks.testTree.mFavorites[0]).toEqual(expectedFavProfileNode);
    });
    it("Tests that removeFavProfile successfully removes profile node in Favorites when called outside user command", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        // Make sure favorite is added before the actual unit test
        expect(blockMocks.testTree.mFavorites.length).toEqual(1);

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label.toString(), false);

        expect(blockMocks.testTree.mFavorites.length).toEqual(0);
    });
});
describe("Dataset Tree Unit Tests - Function deleteSession", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();

        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue(globalMocks.mockTreeProviders);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes = globalMocks.mockTreeProviders.ds.mSessionNodes;
        testTree.mSessionNodes.push(createMockNode("Favorites", globals.DS_SESSION_CONTEXT));

        testTree.deleteSession(testTree.mSessionNodes[0]);
        testTree.deleteSession(testTree.mSessionNodes[1]);

        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.map((node) => node.label)).toEqual(["Favorites"]);
    });

    it("Checking case profile needs to be hidden for all trees", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();

        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue(globalMocks.mockTreeProviders);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes = globalMocks.mockTreeProviders.ds.mSessionNodes;

        testTree.deleteSession(testTree.mSessionNodes[0], true);
        testTree.deleteSession(testTree.mSessionNodes[1], true);

        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.map((node) => node.label)).toEqual([]);
        expect(globalMocks.mockTreeProviders.uss.mSessionNodes.map((node) => node.label)).toEqual([]);
        expect(globalMocks.mockTreeProviders.job.mSessionNodes.map((node) => node.label)).toEqual([]);
    });
});
describe("Dataset Tree Unit Tests - Function flipState", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCreds = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            sessionWithoutCreds,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking flipping of PDS Dataset node", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        node.contextValue = globals.DS_PDS_CONTEXT;

        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
        testTree.flipState(node, false);
        expect(JSON.stringify(node.iconPath)).toContain("folder-closed.svg");
        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
    });
    it("Checking flipping of Favorite PDS Dataset node", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
        testTree.flipState(node, false);
        expect(JSON.stringify(node.iconPath)).toContain("folder-closed.svg");
        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
    });
    it("Checking flipping of PDS Dataset with credential prompt", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "Dataset",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.sessionWithoutCreds,
        });
        node.contextValue = globals.DS_PDS_CONTEXT;

        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
        testTree.flipState(node, false);
        expect(JSON.stringify(node.iconPath)).toContain("folder-closed.svg");
        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
    });
});
describe("Dataset Tree Unit Tests - Function datasetFilterPrompt", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: zowe.imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            mockDefaultProfile: jest.fn(),
            mockGetProfileSetting: jest.fn(),
            mockCheckCurrentProfile: jest.fn(),
            treeView: createTreeView(),
            mockLoadNamedProfile: jest.fn(),
            datasetSessionNode: null,
            mockResetValidationSettings: jest.fn(),
            qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
            mockEnableValidationContext: jest.fn(),
            testTree: new DatasetTree(),
        };

        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        globalMocks.mockProfileInstance.allProfiles = [newMocks.imperativeProfile, { name: "firstName" }, { name: "secondName" }];
        globalMocks.mockProfileInstance.loadNamedProfile.mockReturnValueOnce(newMocks.imperativeProfile);
        globalMocks.mockProfileInstance.resetValidationSettings.mockReturnValue(newMocks.datasetSessionNode);
        globalMocks.mockProfileInstance.getProfileSetting.mockReturnValue({
            name: newMocks.imperativeProfile.name,
            status: "active",
        });
        globalMocks.mockProfileInstance.checkCurrentProfile.mockReturnValue({
            name: newMocks.imperativeProfile.name,
            status: "active",
        });
        newMocks.testTree.mSessionNodes.push(newMocks.datasetSessionNode);

        return newMocks;
    }

    it("Checking adding of new filter - Theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isTheia.mockReturnValue(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking cancelled attempt to add a filter - Theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isTheia.mockReturnValue(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(mocked(Gui.showMessage)).toBeCalledWith("You must enter a pattern.");
    });
    it("Checking usage of existing filter - Theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isTheia.mockReturnValue(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("HLQ.PROD1.STUFF"));
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.addSearchHistory("test");

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking cancelling of filter prompt with available filters - Theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isTheia.mockReturnValue(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.addSearchHistory("test");

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(mocked(Gui.showMessage)).toBeCalledWith("No selection made. Operation cancelled.");
    });
    it("Checking function on favorites", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const addSessionSpy = jest.spyOn(testTree, "addSession");
        const favoriteSearch = new ZoweDatasetNode({
            label: `[${blockMocks.datasetSessionNode.label}]: HLQ.PROD1.STUFF`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favoriteSearch.contextValue = globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX;

        jest.spyOn(testTree, "addSingleSession").mockImplementation();
        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({
            ds: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
            uss: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
            jobs: { addSingleSession: jest.fn(), mSessionNodes: [blockMocks.datasetSessionNode], refresh: jest.fn() } as any,
        } as any);

        await testTree.datasetFilterPrompt(favoriteSearch);

        expect(addSessionSpy).toHaveBeenLastCalledWith(blockMocks.datasetSessionNode.label.trim());
    });
    it("Checking adding of new filter", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: globals.DS_DS_CONTEXT,
        });
        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node.contextValue = globals.FILTER_SEARCH;
        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockResolvedValueOnce([node]);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking adding of new filter of multiple ds search", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD(STUF*),HLQ.PROD1*");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const node = new ZoweDatasetNode({
            label: "STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: globals.DS_DS_CONTEXT,
        });
        node.pattern = undefined as any;
        node.contextValue += "pds";

        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockReturnValueOnce([node] as any);
        jest.spyOn(testTree, "checkFilterPattern").mockReturnValue(true);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD, HLQ.PROD1*");
    });
    it("Checking adding of new filter with data set member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1(MEMBER)");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.ACTIVE_CONTEXT);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1");
    });
    it("Checking adding of new filter with Unverified profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockImplementationOnce((name, type) => blockMocks.imperativeProfile),
                    getBaseProfile: jest.fn(),
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].contextValue).toEqual(globals.DS_SESSION_CONTEXT + globals.UNVERIFIED_CONTEXT);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking cancelled attempt to add a filter", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(mocked(Gui.showMessage)).toBeCalledWith("You must enter a pattern.");
    });
    it("Checking usage of existing filter from filterPrompt", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const quickPickItem = new utils.FilterDescriptor("HLQ.PROD1.STUFF");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(
            createQuickPickContent("HLQ.PROD1.STUFF", [quickPickItem], blockMocks.qpPlaceholder)
        );
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(quickPickItem);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const resolveQuickPickSpy = jest.spyOn(Gui, "resolveQuickPick");
        resolveQuickPickSpy.mockResolvedValueOnce(quickPickItem);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.addSearchHistory("test");

        await testTree.filterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking cancelling of filter prompt with available filters", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const quickPickItem = undefined;
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(createQuickPickContent("HLQ.PROD1.STUFF", quickPickItem, blockMocks.qpPlaceholder));
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(quickPickItem);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const resolveQuickPickSpy = jest.spyOn(Gui, "resolveQuickPick");
        resolveQuickPickSpy.mockResolvedValueOnce(quickPickItem);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.addSearchHistory("test");

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(mocked(Gui.showMessage)).toBeCalledWith("No selection made. Operation cancelled.");
    });
    it("Checking adding of new filter error is caught on getChildren", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        Object.defineProperty(testTree.mSessionNodes[1], "getChildren", {
            value: jest.fn(() => {
                throw new Error("test error");
            }),
            configurable: true,
        });
        const errorSpy = jest.spyOn(utils, "errorHandling");

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(errorSpy).toBeCalled();
        errorSpy.mockClear();
    });
    it("Checking function for return if getChildren is undefined", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        Object.defineProperty(testTree.mSessionNodes[1], "getChildren", {
            value: jest.fn(() => {
                return;
            }),
            configurable: true,
        });
        const errorSpy = jest.spyOn(utils, "errorHandling");

        expect(await testTree.datasetFilterPrompt(testTree.mSessionNodes[1])).not.toBeDefined();

        expect(errorSpy).not.toBeCalled();
        errorSpy.mockClear();
    });
    it("Checking function for return if element.getChildren calls error handling for success: false", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const errorSpy = jest.spyOn(utils, "errorHandling");
        const debugSpy = jest.spyOn(ZoweLogger, "debug");

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        Object.defineProperty(testTree.mSessionNodes[1], "getDatasets", {
            value: jest.fn().mockResolvedValueOnce([
                {
                    success: false,
                    commandResponse: null,
                    apiResponse: "Error: test error",
                },
            ]),
            configurable: true,
        });

        expect(await testTree.datasetFilterPrompt(testTree.mSessionNodes[1])).not.toBeDefined();
        expect(debugSpy).toBeCalled();
        expect(errorSpy).toBeCalled();
        debugSpy.mockClear();
        errorSpy.mockClear();
    });
    it("Checking function for return if element.getChildren returns undefined", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        Object.defineProperty(testTree.mSessionNodes[1], "getDatasets", {
            value: jest.fn().mockResolvedValueOnce(undefined),
            configurable: true,
        });

        expect(await testTree.datasetFilterPrompt(testTree.mSessionNodes[1])).not.toBeDefined();
    });

    it("updates stats with modified date and user ID if provided in API", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const newNode = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        testTree.mSessionNodes[1].children = [newNode];
        const updateStatsSpy = jest.spyOn(ZoweDatasetNode.prototype, "updateStats");
        const getDatasetsSpy = jest.spyOn((ZoweDatasetNode as any).prototype, "getDatasets");
        getDatasetsSpy.mockResolvedValueOnce([
            {
                success: true,
                commandResponse: null,
                apiResponse: {
                    items: [
                        {
                            m4date: "2023-10-31",
                            mtime: "12:00",
                            msec: "30",
                            member: "HI",
                            user: "SOMEUSR",
                        },
                        {
                            changed: "2023-10-31 03:00:00",
                            member: "BYE",
                            id: "SOMEUSR",
                        },
                    ],
                },
            },
        ]);
        await testTree.mSessionNodes[1].children[0].getChildren();

        expect(updateStatsSpy).toHaveBeenCalled();
    });
});
describe("Dataset Tree Unit Tests - Function editSession", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: zowe.imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            mockDefaultProfile: jest.fn(),
            treeView: createTreeView(),
            datasetSessionNode: null,
            profile: null,
            mockGetProfileSetting: jest.fn(),
            mockEditSession: jest.fn(),
            mockCheckCurrentProfile: jest.fn(),
        };

        newMocks.datasetSessionNode = await createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.profile = createInstanceOfProfile(newMocks.imperativeProfile);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [newMocks.imperativeProfile, { name: "firstName" }, { name: "secondName" }],
                    getDefaultProfile: newMocks.mockDefaultProfile,
                    getBaseProfile: jest.fn(),
                    validProfile: ValidProfileEnum.VALID,
                    getProfileSetting: newMocks.mockGetProfileSetting.mockReturnValue({
                        name: newMocks.imperativeProfile.name,
                        status: "active",
                    }),
                    editSession: newMocks.mockEditSession.mockReturnValueOnce("testProfile"),
                    checkCurrentProfile: newMocks.mockCheckCurrentProfile.mockReturnValue({
                        status: "active",
                        name: "testProfile",
                    }),
                    loadNamedProfile: jest.fn().mockReturnValue(newMocks.imperativeProfile),
                };
            }),
        });

        return newMocks;
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "EditSession",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });

        await testTree.editSession(node, testTree);

        expect(node.getProfile().profile).toBe("testProfile");
    });
});
describe("Dataset Tree Unit Tests - Function getAllLoadedItems", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: globals.DS_DS_CONTEXT,
        });
        testTree.mSessionNodes[1].children.push(node);

        const items = await testTree.getAllLoadedItems();

        expect(items).toEqual([node]);
    });
});
describe("Dataset Tree Unit Tests - Function onDidConfiguration", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const workspaceConfiguration = createWorkspaceConfiguration();

        return {
            session,
            datasetSessionNode,
            treeView,
            workspaceConfiguration,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.workspace.getConfiguration).mockReturnValue(blockMocks.workspaceConfiguration);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        const event = {
            affectsConfiguration: jest.fn(),
        };
        event.affectsConfiguration.mockReturnValue(true);
        mocked(vscode.workspace.getConfiguration).mockClear();

        await testTree.onDidChangeConfiguration(event);

        expect(mocked(vscode.workspace.getConfiguration)).toBeCalledTimes(2);
    });
});
describe("Dataset Tree Unit Tests - Function renameNode", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        const beforeNode = new ZoweDatasetNode({
            label: "TO.RENAME",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_PDS_CONTEXT,
        });
        const afterNode = new ZoweDatasetNode({
            label: "RENAMED",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_PDS_CONTEXT,
        });
        // the IDs will never match, so for the sake of this test,
        // going to fake the IDs so that the expect passes
        afterNode.id = "<root>.TO.RENAME";
        blockMocks.datasetSessionNode.children.push(beforeNode);
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.renameNode("sestest", "TO.RENAME", "RENAMED");

        expect(testTree.mSessionNodes[1].children[0]).toEqual({ ...afterNode, id: beforeNode.id });
    });
});
describe("Dataset Tree Unit Tests - Function renameFavorite", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        const nodeFromSession = new ZoweDatasetNode({
            label: "TO.RENAME",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_PDS_CONTEXT,
        });
        // Parent is normally a profile node in Favorites section, but is null here because it does not matter for this test
        const matchingFavNode = new ZoweDatasetNode({
            label: "TO.RENAME",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX,
        });
        const expectedMatchingFavNodeResult = new ZoweDatasetNode({
            label: "RENAMED",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX,
        });
        Object.defineProperty(testTree, "findFavoritedNode", {
            value: jest.fn(() => {
                return matchingFavNode;
            }),
        });

        await testTree.renameFavorite(nodeFromSession, "RENAMED");

        expect(matchingFavNode).toEqual({ ...expectedMatchingFavNodeResult, id: matchingFavNode.id });
    });
});
describe("Dataset Tree Unit Tests - Function findFavoritedNode", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const datasetFavoritesNode = createDatasetFavoritesNode();

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            datasetFavoritesNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const favoriteNode = new ZoweDatasetNode({
            label: `${node.label}`,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            profile: blockMocks.imperativeProfile,
        });
        favoriteNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        favProfileNode.children.push(favoriteNode);
        testTree.mFavorites.push(favProfileNode);

        const foundNode = testTree.findFavoritedNode(node);

        expect(foundNode).toBe(favoriteNode);
    });
    it("Checking that function does not error when there is no favorite or matching profile node in Favorites", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });

        expect(() => {
            testTree.findFavoritedNode(node);
        }).not.toThrow();
    });
});
describe("Dataset Tree Unit Tests - Function findNonFavoritedNode", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking common run of function", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const favoriteNode = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favoriteNode.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        testTree.mSessionNodes[1].children.push(node);

        const foundNode = testTree.findNonFavoritedNode(favoriteNode);

        expect(foundNode).toBe(node);
    });
});

describe("Dataset Tree Unit Tests - Function openItemFromPath", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            datasetSessionNode,
            treeView,
        };
    }

    it("Checking opening of PS Dataset", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
        });
        testTree.mSessionNodes[1].children.push(node);
        testTree.mSessionNodes[1].pattern = "test";
        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockReturnValue(Promise.resolve([node]));

        await testTree.openItemFromPath(`[${blockMocks.datasetSessionNode.label}]: ${node.label}`, blockMocks.datasetSessionNode);

        expect(testTree.getSearchHistory()).toEqual([node.label]);
    });

    it("Checking opening of PDS Member", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
        });
        const child = new ZoweDatasetNode({ label: "TESTMEMB", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        testTree.mSessionNodes[1].children.push(parent);
        testTree.mSessionNodes[1].pattern = "test";
        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockReturnValue(Promise.resolve([parent]));
        jest.spyOn(parent, "getChildren").mockReturnValue(Promise.resolve([child]));

        await testTree.openItemFromPath(`[${blockMocks.datasetSessionNode.label}]: ${parent.label}(${child.label})`, blockMocks.datasetSessionNode);

        expect(testTree.getSearchHistory()).toEqual([`${parent.label}(${child.label})`]);
    });
});

describe("Dataset Tree Unit Tests - Function renameNode", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const node = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: datasetSessionNode,
        });
        const testTree = new DatasetTree();

        datasetSessionNode.children.push(node);
        testTree.mSessionNodes.push(datasetSessionNode);
        jest.spyOn(datasetSessionNode, "getChildren").mockReturnValue(Promise.resolve([datasetSessionNode]));

        return {
            imperativeProfile,
            node,
            datasetSessionNode,
            testTree,
        };
    }

    it("Checking opening of PS Dataset", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        await blockMocks.testTree.renameNode(blockMocks.imperativeProfile.name, blockMocks.node.label.toString(), "newLabel");

        expect(blockMocks.node.label).toEqual("newLabel");
    });
});

describe("Dataset Tree Unit Tests - Function createFilterString", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: datasetSessionNode,
            session,
        });
        const testTree = new DatasetTree();
        const historySpy = jest.spyOn(testTree, "getSearchHistory");

        node.pattern = "filter1,filter2";
        datasetSessionNode.children.push(node);
        testTree.mSessionNodes.push(datasetSessionNode);
        jest.spyOn(datasetSessionNode, "getChildren").mockReturnValue(Promise.resolve([node]));
        historySpy.mockReturnValue(["filter1, filter2"]);

        return {
            imperativeProfile,
            node,
            testTree,
            historySpy,
        };
    }

    it("Tests that createFilterString() creates a new filter from a string and a node's old filter", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const newFilterString = await blockMocks.testTree.createFilterString("newFilter", blockMocks.node);

        expect(newFilterString).toEqual("filter1,filter2,newFilter");
    });

    it("Tests that createFilterString() doesn't add a filter twice", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const newFilterString = await blockMocks.testTree.createFilterString("filter2", blockMocks.node);

        expect(newFilterString).toEqual("filter1,filter2");
    });

    it("Tests that createFilterString() works if the node has no filter applied", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        blockMocks.node.pattern = "";
        blockMocks.historySpy.mockReturnValue([]);

        const newFilterString = await blockMocks.testTree.createFilterString("newFilter", blockMocks.node);

        expect(newFilterString).toEqual("newFilter");
    });
});

describe("Dataset Tree Unit Tests - Function rename", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const datasetFavoritesNode = createDatasetFavoritesNode();
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            datasetFavoritesNode,
            treeView,
            mvsApi,
            profileInstance,
            mockCheckCurrentProfile,
        };
    }

    it("Tests that rename() renames a node", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");

        await testTree.rename(node);

        expect(renameDataSetSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
    });

    it("returns early if errorForUnsavedResource was true", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            profile: testTree.mSessionNodes[1].getProfile(),
        });
        const renameDataSet = jest.spyOn(testTree as any, "renameDataSet");
        const promptedForUnsavedResource = jest.spyOn(TreeViewUtils, "errorForUnsavedResource").mockResolvedValueOnce(true);
        await testTree.rename(node);
        expect(promptedForUnsavedResource).toHaveBeenCalled();
        expect(renameDataSet).not.toHaveBeenCalled();
    });

    it("Checking function with PS Dataset using Unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const profile = blockMocks.imperativeProfile;
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                    getBaseProfile: jest.fn(),
                    loadNamedProfile: jest.fn().mockReturnValue(profile),
                };
            }),
        });
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");

        await testTree.rename(node);

        expect(renameDataSetSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
    });

    it("Checking function with PS Dataset given lowercase name", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.new");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");

        await testTree.rename(node);

        expect(renameDataSetSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
    });

    it("Checking function with Favorite PS Dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        node.contextValue = "ds_fav";
        testTree.mSessionNodes[1].children.push(node);
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");

        await testTree.rename(node);

        expect(renameDataSetSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
    });
    it("Checking failed attempt to rename PS Dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const defaultError = new Error("Default error message");
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(zowe.Rename.dataSet).mockImplementation(() => {
            throw defaultError;
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");

        let error;
        try {
            await testTree.rename(node);
        } catch (err) {
            error = err;
        }

        expect(renameDataSetSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "HLQ.TEST.RENAME.NODE.NEW");
        expect(error).toBe(defaultError);
    });
    it("Checking function with PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("MEM2");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        // Create nodes in Session section
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const favParent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const favChild = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favParent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favParent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        favChild.contextValue = globals.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);

        const renameDataSetMemberSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSetMember");

        const testValidDsName = async (text: string) => {
            mocked(vscode.window.showInputBox).mockImplementation((options) => {
                options.validateInput(text);
                return Promise.resolve(text);
            });
            await testTree.rename(child);
            expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "mem1", "MEM2");
        };

        await testValidDsName("HLQ.TEST.RENAME.NODE");

        await testTree.rename(child);
    });
    it("Checking function with PDS Member given in lowercase", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("mem2");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        // Create nodes in Session section
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const favParent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const favChild = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favParent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favParent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        favChild.contextValue = globals.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);
        const renameDataSetMemberSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSetMember");

        await testTree.rename(child);

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "mem1", "MEM2");
    });
    it("Checking function with favorite PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("MEM2");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        // Create nodes in Session section
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: globals.PDS_FAV_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const favParent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        const favChild = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favParent,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favParent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        favChild.contextValue = globals.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);
        const renameDataSetMemberSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSetMember");

        await testTree.rename(favChild);

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "mem1", "MEM2");
    });
    it("Checking failed attempt to rename PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const defaultError = new Error("Default error message");
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(zowe.Rename.dataSetMember).mockImplementation(() => {
            throw defaultError;
        });
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("MEM2");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
        });
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        const renameDataSetMemberSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSetMember");

        let error;
        try {
            await testTree.rename(child);
        } catch (err) {
            error = err;
        }

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith("HLQ.TEST.RENAME.NODE", "mem1", "MEM2");
        expect(error).toBe(defaultError);
    });
    it("Checking validate validateDataSetName util function successfully execution", async () => {
        expect(dsUtils.validateDataSetName("#DSNAME.DSNAME")).toBe(true);
    });

    it("Checking validate validateDataSetName util function fail", async () => {
        expect(dsUtils.validateDataSetName("#DSNAME.DSNAMEMORETHAN8CHARS.TEST")).toBe(false);
    });
    it("Checking validate validateDataSetName util function fail on max ds length", async () => {
        const dsName = "#DSNAMET.DSNAME.DSNAME.DSNAME.DSNAME.DSNAMETE";
        expect(dsName.length - 1 === globals.MAX_DATASET_LENGTH).toBe(true);
        expect(dsUtils.validateDataSetName(dsName)).toBe(false);
    });

    it("Tests that rename() validates the dataset name", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(workspaceUtils.closeOpenedTextFile).mockResolvedValueOnce(false);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
        });
        const renameDataSetSpy = jest.spyOn(blockMocks.mvsApi, "renameDataSet");
        const testValidDsName = async (text: string) => {
            mocked(vscode.window.showInputBox).mockImplementation((options) => {
                options.validateInput(text);
                return Promise.resolve(text);
            });
            const oldName = node.label;
            await testTree.rename(node);
            expect(renameDataSetSpy).toHaveBeenLastCalledWith(oldName, text);
        };

        await testValidDsName("HLQ.TEST.RENAME.NODE.NEW.TEST");
        await testValidDsName("INVALID-DATASET-NAME");
    });
});

describe("Dataset Tree Unit Tests - Function checkFilterPattern", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testTree = new DatasetTree();

        testTree.mSessionNodes.push(datasetSessionNode);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            testTree,
        };
    }

    it("should return true when pattern is *", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        expect(blockMocks.testTree.checkFilterPattern("*", "*")).toEqual(true);
    });

    it("should return true when pattern ends with *", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        expect(blockMocks.testTree.checkFilterPattern("SAMPLE*", "SAMPLE*")).toEqual(true);
    });

    it("should return true when pattern starts with *", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        expect(blockMocks.testTree.checkFilterPattern("*SAMPLE", "*SAMPLE")).toEqual(true);
    });

    it("should return true when pattern is of word*word*", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        expect(blockMocks.testTree.checkFilterPattern("SAMPLE*TEST*", "SAMPLE*TEST*")).toEqual(true);
    });

    it("should return true when pattern is of *word*word", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        expect(blockMocks.testTree.checkFilterPattern("*SAMPLE*TEST", "*SAMPLE*TEST")).toEqual(true);
    });

    it("should return true when pattern is of *word*word*", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        expect(blockMocks.testTree.checkFilterPattern("*SAMPLE*TEST*", "*SAMPLE*TEST*")).toEqual(true);
    });
});

describe("Dataset Tree Unit Tests - Function initializeFavorites", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const datasetFavoritesNode = createDatasetFavoritesNode();
        const mvsApi = createMvsApi(imperativeProfile);
        const mockCheckCurrentProfile = jest.fn();
        bindMvsApi(mvsApi);

        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(datasetSessionNode);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
            datasetFavoritesNode,
            treeView,
            mvsApi,
            profileInstance,
            mockCheckCurrentProfile,
            testTree,
        };
    }

    it("successfully initialize favorites", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const log = zowe.imperative.Logger.getAppLogger();

        Object.defineProperty(testTree, "mHistory", {
            value: {
                readFavorites: () => ["[SAMPLE]: SAMPLE.{session}", "*SAMPLE", "SAMPLE*"],
            },
        });
        expect(() => testTree.initializeFavorites(log)).not.toThrow();
    });
});
describe("Dataset Tree Unit Tests - Sorting and Filtering operations", () => {
    createGlobalMocks();
    mocked(vscode.window.createTreeView).mockReturnValueOnce(createTreeView());
    const tree = new DatasetTree();
    const nodesForSuite = (): Record<string, IZoweDatasetTreeNode> => {
        const session = new ZoweDatasetNode({
            label: "testSession",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: createISession(),
        });
        session.contextValue = globals.DS_SESSION_CONTEXT;
        const pds = new ZoweDatasetNode({
            label: "testPds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: session,
        });
        pds.contextValue = globals.DS_PDS_CONTEXT;

        const nodeA = new ZoweDatasetNode({
            label: "A",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        nodeA.stats = { user: "someUser", createdDate: new Date(), modifiedDate: new Date() };
        const nodeB = new ZoweDatasetNode({
            label: "B",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        nodeB.stats = { user: "anotherUser", createdDate: new Date("2021-01-01T12:00:00"), modifiedDate: new Date("2022-01-01T12:00:00") };
        const nodeC = new ZoweDatasetNode({
            label: "C",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        nodeC.stats = { user: "someUser", createdDate: new Date("2022-02-01T12:00:00"), modifiedDate: new Date("2022-03-15T16:30:00") };
        pds.children = [nodeA, nodeB, nodeC];
        pds.sort = {
            method: DatasetSortOpts.Name,
            direction: SortDirection.Ascending,
        };
        session.children = [pds];

        return {
            session,
            pds,
        };
    };

    const getBlockMocks = (): Record<string, jest.SpyInstance> => ({
        nodeDataChanged: jest.spyOn(DatasetTree.prototype, "nodeDataChanged"),
        refreshElement: jest.spyOn(DatasetTree.prototype, "refreshElement"),
        showQuickPick: jest.spyOn(Gui, "showQuickPick"),
        showInputBox: jest.spyOn(Gui, "showInputBox"),
    });

    afterEach(() => {
        const mocks = getBlockMocks();
        for (const mock of Object.values(mocks)) {
            mock.mockClear();
        }
    });

    afterAll(() => {
        const mocks = getBlockMocks();
        for (const mock of Object.values(mocks)) {
            mock.mockRestore();
        }
    });

    describe("sortBy & sortPdsMembersDialog", () => {
        // for sorting, we shouldn't need to refresh since all nodes
        // should be intact, just in a different order
        it("does nothing if no children exist", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            // case 1: called on PDS node
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(case-sensitive) Name (default)" });
            nodes.pds.children = [];
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).not.toHaveBeenCalled();

            // case 2: called on session node
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(case-sensitive) Name (default)" });
            nodes.session.children = [];
            await tree.sortPdsMembersDialog(nodes.session);
            expect(mocks.nodeDataChanged).not.toHaveBeenCalled();
        });

        it("sorts by name", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(case-sensitive) Name (default)" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "B", "C"]);
            expect(nodes.pds.children?.reduce((val, cur) => val + (cur.description as string), "")).toBe("");
        });

        it("sorts by created date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            nodes.pds.sort = {
                method: DatasetSortOpts.Name,
                direction: SortDirection.Descending,
            };
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Created" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "C", "B"]);
        });

        it("sorts by created date: handling 2 nodes with same date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            nodes.pds.sort = {
                method: DatasetSortOpts.Name,
                direction: SortDirection.Descending,
            };
            // insert node with same date modified
            const nodeD = new ZoweDatasetNode({
                label: "D",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: nodes.pds,
                session: createISession(),
            });
            nodeD.stats = { user: "someUser", createdDate: new Date("2021-01-01T12:00:00"), modifiedDate: new Date("2022-03-15T16:30:00") };
            nodes.pds.children = [...(nodes.pds.children ?? []), nodeD];
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Created" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "C", "D", "B"]);
        });

        it("sorts by created date: handling a invalid date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            // insert node with same date modified
            const nodeD = new ZoweDatasetNode({
                label: "D",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: nodes.pds,
                session: createISession(),
            });
            nodeD.stats = { user: "someUser", createdDate: new Date("not a valid date"), modifiedDate: new Date("2022-03-15T16:30:00") };
            nodes.pds.children = [...(nodes.pds.children ?? []), nodeD];
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Created" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
        });

        it("sorts by created date: handling node with undefined property", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            delete (nodes.pds.children as any)[1].stats.createdDate;
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Created" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["C", "A", "B"]);
        });

        it("sorts by last modified date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Modified" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["B", "C", "A"]);
        });

        it("sorts by last modified date: handling 2 nodes with same date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(fold) Sort Direction" });
            mocks.showQuickPick.mockResolvedValueOnce({ label: "Descending" });
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Modified" });
            // insert node with same date modified
            const nodeD = new ZoweDatasetNode({
                label: "D",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: nodes.pds,
                session: createISession(),
            });
            nodeD.stats = { user: "someUser", createdDate: new Date("2021-01-01T12:00:00"), modifiedDate: new Date("2022-03-15T16:30:00") };
            nodes.pds.children = [...(nodes.pds.children ?? []), nodeD];
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "D", "C", "B"]);
        });

        it("sorts by last modified date: handling node with undefined property", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            delete (nodes.pds.children as any)[1].stats.modifiedDate;
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Modified" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["C", "A", "B"]);
        });

        it("sorts by user ID", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(account) User ID" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["B", "A", "C"]);
        });

        it("sorts by user ID: handling node with undefined property", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            delete (nodes.pds.children as any)[0].stats.user;
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(account) User ID" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["B", "C", "A"]);
        });

        it("returns to sort selection dialog when sort direction selection is canceled", async () => {
            const sortPdsMembersDialog = jest.spyOn(tree, "sortPdsMembersDialog");
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(fold) Sort Direction" });
            mocks.showQuickPick.mockResolvedValueOnce(undefined);
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).not.toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(sortPdsMembersDialog).toHaveBeenCalledTimes(2);
        });

        it("sorting by session: descriptions are reset when sorted by name", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(case-sensitive) Name (default)" });
            await tree.sortPdsMembersDialog(nodes.session);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "B", "C"]);
            expect(nodes.pds.children?.reduce((val, cur) => val + (cur.description as string), "")).toBe("");
        });
    });

    describe("filterBy & filterPdsMembersDialog", () => {
        afterEach(() => {
            const mocks = getBlockMocks();
            for (const mock of Object.values(mocks)) {
                mock.mockReset();
            }
        });

        afterAll(() => {
            const mocks = getBlockMocks();
            for (const mock of Object.values(mocks)) {
                mock.mockRestore();
            }
        });

        it("calls refreshElement if PDS children were removed from a previous filter", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce("$(calendar) Date Modified" as any);
            mocks.showInputBox.mockResolvedValueOnce("2022-01-01");

            nodes.pds.filter = { method: DatasetFilterOpts.UserId, value: "invalidUserId" };
            nodes.pds.children = [];
            await tree.filterPdsMembersDialog(nodes.pds);
            // nodeDataChanged called once to show new description
            expect(mocks.nodeDataChanged).toHaveBeenCalledWith(nodes.pds);
            expect(mocks.refreshElement).toHaveBeenCalledWith(nodes.pds);
        });

        it("returns to filter selection dialog when filter entry is canceled", async () => {
            const filterPdsMembersSpy = jest.spyOn(tree, "filterPdsMembersDialog");
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce("$(calendar) Date Modified" as any);
            mocks.showInputBox.mockResolvedValueOnce(undefined);
            await tree.filterPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).not.toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(filterPdsMembersSpy).toHaveBeenCalledTimes(2);
        });

        it("filters single PDS by last modified date", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce("$(calendar) Date Modified" as any);
            mocks.showInputBox.mockResolvedValueOnce("2022-03-15");
            await tree.filterPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["C"]);
        });

        it("filters single PDS by user ID", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            mocks.showQuickPick.mockResolvedValueOnce("$(account) User ID" as any);
            mocks.showInputBox.mockResolvedValueOnce("anotherUser");
            await tree.filterPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["B"]);
        });

        it("filters PDS members using the session node filter", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            const uidString = "$(account) User ID" as any;
            const anotherUser = "anotherUser";
            mocks.showQuickPick.mockResolvedValueOnce(uidString).mockResolvedValueOnce(uidString);
            mocks.showInputBox.mockResolvedValueOnce(anotherUser).mockResolvedValueOnce(anotherUser);

            // case 1: old filter was set on session, just refresh PDS to use new filter
            nodes.session.filter = {
                method: DatasetFilterOpts.LastModified,
                value: "2020-01-01",
            };
            await tree.filterPdsMembersDialog(nodes.session);
            expect(mocks.refreshElement).toHaveBeenCalled();

            // case 2: no old filter present, PDS has children to be filtered
            nodes.session.filter = undefined;
            await tree.filterPdsMembersDialog(nodes.session);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
        });

        it("clears filter for a PDS when selected in dialog", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            const resp = "$(clear-all) Clear filter for PDS" as any;
            mocks.showQuickPick.mockResolvedValueOnce(resp);
            const updateFilterForNode = jest.spyOn(DatasetTree.prototype, "updateFilterForNode");
            await tree.filterPdsMembersDialog(nodes.pds);
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(updateFilterForNode).toHaveBeenCalledWith(nodes.pds, null, false);
        });
    });

    describe("removeSearchHistory", () => {
        it("removes the search item passed in from the current history", () => {
            tree.addSearchHistory("test");
            expect(tree["mHistory"]["mSearchHistory"].length).toEqual(1);
            tree.removeSearchHistory("test");
            expect(tree["mHistory"]["mSearchHistory"].length).toEqual(0);
        });
    });

    describe("resetSearchHistory", () => {
        it("clears the entire search history", () => {
            tree.addSearchHistory("test1");
            tree.addSearchHistory("test2");
            tree.addSearchHistory("test3");
            tree.addSearchHistory("test4");
            expect(tree["mHistory"]["mSearchHistory"].length).toEqual(4);
            tree.resetSearchHistory();
            expect(tree["mHistory"]["mSearchHistory"].length).toEqual(0);
        });
    });

    describe("resetFileHistory", () => {
        it("clears the entire file history", () => {
            tree.addFileHistory("test1");
            tree.addFileHistory("test2");
            tree.addFileHistory("test3");
            tree.addFileHistory("test4");
            expect(tree["mHistory"]["mFileHistory"].length).toEqual(4);
            tree.resetFileHistory();
            expect(tree["mHistory"]["mFileHistory"].length).toEqual(0);
        });
    });

    describe("addDsTemplate", () => {
        it("adds a new DS template to the persistent object", () => {
            tree.addDsTemplate({ test: "test" } as any);
            expect(tree["mHistory"]["mDsTemplates"].length).toEqual(1);
        });
    });

    describe("getSessions", () => {
        it("gets all the available sessions from persistent object", () => {
            tree["mHistory"]["mSessions"] = ["sestest"];
            expect(tree.getSessions()).toEqual(["sestest"]);
        });
    });

    describe("getDsTemplates", () => {
        it("gets all the DS templates from persistent object", () => {
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: () => ["test1", "test2", "test3"],
            } as any);
            expect(tree.getDsTemplates()).toEqual(["test1", "test2", "test3"]);
        });
    });

    describe("getFavorites", () => {
        it("gets all the favorites from persistent object", () => {
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: () => ["test1", "test2", "test3"],
            } as any);
            expect(tree.getFavorites()).toEqual(["test1", "test2", "test3"]);
        });
    });

    describe("onDidCloseTextDocument", () => {
        it("sets the entry in openFiles record to null if Data Set URI is valid", async () => {
            const doc = {
                isClosed: true,
                isDirty: false,
                uri: { scheme: "file", fsPath: join(globals.DS_DIR, "lpar", "SOME.PS") },
            } as vscode.TextDocument;

            jest.spyOn(TreeProviders, "ds", "get").mockReturnValue(tree);
            await DatasetTree.onDidCloseTextDocument(doc);
            expect(tree.openFiles[doc.uri.fsPath]).toBeNull();
        });
    });
});

describe("Dataset Tree Unit Tests - Function openWithEncoding", () => {
    it("sets binary encoding if selection was made", async () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "binary" });
        await DatasetTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(true);
        expect(node.encoding).toBeUndefined();
        expect(node.openDs).toHaveBeenCalledTimes(1);
    });

    it("sets text encoding if selection was made", async () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        await DatasetTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeNull();
        expect(node.openDs).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if prompt was cancelled", async () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce(undefined);
        await DatasetTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeUndefined();
        expect(node.openDs).toHaveBeenCalledTimes(0);
    });

    it("presents a confirmation dialog to the user when the file is unsaved", async () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        const editor = { document: { uri: { path: "/folder/encodingTest" } } } as vscode.TextEditor;

        // case 1: user confirms encoding change
        jest.spyOn(sharedUtils, "confirmForUnsavedDoc").mockResolvedValueOnce({
            actionConfirmed: true,
            isUnsaved: true,
            editor,
        });
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        vscode.window.activeTextEditor = editor;
        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        await DatasetTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBe(null);
        expect(node.openDs).toHaveBeenCalledTimes(1);
        expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.files.revert");

        // case 2: user cancels encoding change
        (node.openDs as any).mockClear();
        executeCommandSpy.mockClear();
        jest.spyOn(sharedUtils, "confirmForUnsavedDoc").mockResolvedValueOnce({
            actionConfirmed: false,
            isUnsaved: true,
            editor,
        });
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        await DatasetTree.prototype.openWithEncoding(node);
        expect(node.openDs).not.toHaveBeenCalled();
        expect(executeCommandSpy).not.toHaveBeenCalledWith("workbench.action.files.revert");
    });
});
