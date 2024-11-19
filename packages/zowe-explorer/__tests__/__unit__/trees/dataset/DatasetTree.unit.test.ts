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
import * as fs from "fs";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
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
import { ProfilesCache, imperative, Gui, Validation } from "@zowe/zowe-explorer-api";
import { Constants } from "../../../../src/configuration/Constants";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { Profiles } from "../../../../src/configuration/Profiles";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../../../src/icons/IconGenerator";
import { FilterDescriptor } from "../../../../src/management/FilterManagement";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ZowePersistentFilters } from "../../../../src/tools/ZowePersistentFilters";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { DatasetTree } from "../../../../src/trees/dataset/DatasetTree";
import { DatasetUtils } from "../../../../src/trees/dataset/DatasetUtils";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { MockedProperty, mocked } from "../../../__mocks__/mockUtils";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { IZoweDatasetTreeNode } from "../../../../../zowe-explorer-api/src/tree/IZoweTreeNode";
import { ZoweScheme } from "../../../../../zowe-explorer-api/src/fs/types/abstract";
import { Sorting } from "../../../../../zowe-explorer-api/src/tree";
import { IconUtils } from "../../../../src/icons/IconUtils";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { ZoweTreeProvider } from "../../../../src/trees/ZoweTreeProvider";

jest.mock("fs");
jest.mock("util");

function createGlobalMocks() {
    const globalMocks = {
        testProfileLoaded: createValidIProfile(),
        mockProfileInstance: null,
        mockShowWarningMessage: jest.fn(),
        mockProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
        mockTreeProviders: createTreeProviders(),
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfileLoaded);

    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
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
    jest.spyOn(Gui, "showInputBox").mockImplementation();
    Object.defineProperty(zosfiles, "Rename", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Rename, "dataSet", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Rename, "dataSetMember", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles, "Download", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "log", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "unlinkSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(fs, "existsSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
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
    Object.defineProperty(zosfiles.Download, "dataSet", {
        value: jest.fn().mockResolvedValue({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        }),
        configurable: true,
    });
    Object.defineProperty(zosfiles.Download, "dataSetMember", {
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

    it("Checking definition of the dataset tree", () => {
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

    it("Checking function with PS Dataset", () => {
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
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode({
            label: "BRTVS99.PUBLIC",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });
        node.resourceUri = blockMocks.datasetSessionNode.resourceUri?.with({
            path: `/${blockMocks.datasetSessionNode.label as string}/${node.label as string}`,
        });

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile("BRTVS99.PUBLIC", Constants.DS_PDS_CONTEXT, favProfileNode);

        expect(favChildNodeForProfile).toEqual(node);
    });
    it("Checking function for sequential DS favorite", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        blockMocks.datasetSessionNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const node = new ZoweDatasetNode({
            label: "BRTVS99.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.DS_FAV_CONTEXT,
        });
        node.resourceUri = blockMocks.datasetSessionNode.resourceUri?.with({
            path: `/${blockMocks.datasetSessionNode.label as string}/${node.label as string}`,
        });
        node.command = { command: "vscode.open", title: "", arguments: [node.resourceUri] };

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile(
            "BRTVS99.PS",
            Constants.DS_DS_CONTEXT,
            blockMocks.datasetSessionNode
        );

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
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        await testTree.initializeFavChildNodeForProfile("BRTVS99.BAD", "badContextValue", favProfileNode);

        expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
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
        favoriteSessionNode.contextValue = Constants.FAVORITE_CONTEXT;
        const targetIcon = IconGenerator.getIconByNode(favoriteSessionNode);
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
                contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
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
                contextOverride: Constants.VSAM_CONTEXT,
            }),
        ];
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(testTree);

        const children = await testTree.getChildren(testTree.mSessionNodes[1]);
        expect(children.map((c) => c.label)).toEqual(sampleChildren.map((c) => c.label));
        expect(children).toEqual(sampleChildren);
    });
    it("Checking function for session node with an imperative error", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const testError = new imperative.ImperativeError({ msg: "test" });
        const spyOnDataSetsMatchingPattern = jest.spyOn(zosfiles.List, "dataSetsMatchingPattern");
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
            contextOverride: Constants.DS_FILE_ERROR_CONTEXT,
        });
        nodeImpError.command = { command: "zowe.placeholderCommand", title: "" };
        nodeImpError.errorDetails = testError;
        const nodeMigrated = new ZoweDatasetNode({
            label: "HLQ.USER.MIGRAT",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testTree.mSessionNodes[1],
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
        });
        const sampleChildren: ZoweDatasetNode[] = [nodeOk, nodeImpError, nodeMigrated];
        jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(testTree);

        const children = await testTree.getChildren(testTree.mSessionNodes[1]);
        expect(children.map((c) => c.label)).toEqual(sampleChildren.map((c) => c.label));
        expect(children).toEqual(sampleChildren);
        spyOnDataSetsMatchingPattern.mockRestore();
    });
    it("Checking that we fallback to old dataSet API if newer dataSetsMatchingPattern does not exist", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        const mockMvsApi = ZoweExplorerApiRegister.getMvsApi(blockMocks.profile);
        mockMvsApi.dataSetsMatchingPattern = null;
        const getMvsApiMock = jest.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        ZoweExplorerApiRegister.getMvsApi = getMvsApiMock.bind(ZoweExplorerApiRegister);

        const spyOnDataSetsMatchingPattern = jest.spyOn(zosfiles.List, "dataSetsMatchingPattern");
        const spyOnDataSet = jest.spyOn(zosfiles.List, "dataSet");
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
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
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
        profileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
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
        const log = imperative.Logger.getAppLogger();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy = jest.spyOn(testTree, "loadProfilesForFavorites");

        await testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
});
describe("Dataset Tree Unit Tests - Function loadProfilesForFavorites", () => {
    function createBlockMocks() {
        const log = imperative.Logger.getAppLogger();
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
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const testTree = new DatasetTree();
        testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
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
                    validProfile: Validation.ValidationType.VALID,
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
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
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
        expect(showErrorMessageSpy).toHaveBeenCalledTimes(1);
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
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const favPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.PDS_FAV_CONTEXT,
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
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavPdsNode = testTree.mFavorites[0].children[0];

        expect(resultFavPdsNode).toEqual(expectedFavPdsNode);
    });
    it("Checking that loaded profile/session from profile node in Favorites is inherited for child nodes", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoriteNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const favPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });
        const testTree = new DatasetTree();
        favProfileNode.children.push(favPdsNode);
        testTree.mFavorites.push(favProfileNode);
        const expectedFavPdsNode = new ZoweDatasetNode({
            label: "favoritePds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: Constants.PDS_FAV_CONTEXT,
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

    it("Checking function on the root node", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        const parentNode = testTree.getParent(blockMocks.datasetSessionNode);

        expect(parentNode).toBeUndefined();
    });
    it("Checking function on the non-root node", () => {
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

    it("Checking common run of function", () => {
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

    it("Checking common run of function", () => {
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

    it("Checking common run of function", () => {
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
            log: imperative.Logger.getAppLogger(),
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
            mockMHistory: ZowePersistentFilters,
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
        newMocks.mockProfileInstance.validProfile = Validation.ValidationType.VALID;
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
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue({
            ds: {
                addSingleSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
            uss: {
                addSingleSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
            jobs: {
                addSingleSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
        } as any);

        await testTree.addSession(blockMocks.imperativeProfile.name);
        expect(testTree.mSessionNodes[1].label).toBe(blockMocks.imperativeProfile.name);
    });

    it("Checking successful adding of session with disabled validation", () => {
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

    it("Checking successful adding of session without sessname passed", () => {
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
        jest.spyOn(Profiles.getInstance(), "fetchAllProfiles").mockReturnValue(Promise.resolve([blockMocks.imperativeProfile]));
        jest.spyOn(SharedActions, "resetValidationSettings").mockImplementation();

        await expect(testTree.addSession({ profileType: "test" })).resolves.not.toThrow();
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

    it("Tests that addSingleSession adds type info to the session", async () => {
        const dsTree = new DatasetTree();
        const profile1 = await createIProfile();

        profile1.name = "test1Profile";

        await dsTree.addSingleSession(profile1);

        const sessionNode = dsTree.mSessionNodes.find((tNode) => tNode.label?.toString() === profile1.name)

        expect(sessionNode).toBeDefined();

        const context = sessionNode?.contextValue;
        expect(context).toContain("_type=zosmf");
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
        expect(zoweLoggerErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should call 'errorHandling()' if the error does not include the hostname", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        jest.spyOn(ZoweExplorerApiRegister.getMvsApi(blockMocks.testProfile), "getSession").mockImplementationOnce(() => {
            throw new Error("test error");
        });
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");
        expect(blockMocks.testTree.addSingleSession({ name: "test1234" }));
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
});

describe("Dataset Tree Unit Tests - Function addFavorite", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const profile = createInstanceOfProfile(imperativeProfile);
        const fspStat = jest.spyOn(DatasetFSProvider.instance, "stat").mockReturnValue({
            etag: "123ABC",
        } as any);

        return {
            session,
            datasetSessionNode,
            treeView,
            profile,
            imperativeProfile,
            fspStat,
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

        expect(testTree.mFavorites[0].label).toBe(blockMocks.datasetSessionNode.label?.toString());
        expect(testTree.mFavorites[0].contextValue).toBe(Constants.FAV_PROFILE_CONTEXT);
        expect(testTree.mFavorites[0].children[0].label).toBe(node.label?.toString());
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(Constants.DS_DS_CONTEXT + Constants.FAV_SUFFIX);
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
        node.contextValue = Constants.DS_PDS_CONTEXT;

        await testTree.addFavorite(node);

        expect(testTree.mFavorites[0].label).toBe(blockMocks.datasetSessionNode.label?.toString());
        expect(testTree.mFavorites[0].contextValue).toBe(Constants.FAV_PROFILE_CONTEXT);
        expect(testTree.mFavorites[0].children[0].label).toBe(node.label?.toString());
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX);
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
        parent.contextValue = Constants.DS_PDS_CONTEXT;
        child.contextValue = Constants.DS_MEMBER_CONTEXT;

        await testTree.addFavorite(child);

        expect(testTree.mFavorites[0].label).toBe(blockMocks.datasetSessionNode.label?.toString());
        expect(testTree.mFavorites[0].contextValue).toBe(Constants.FAV_PROFILE_CONTEXT);
        expect(testTree.mFavorites[0].children[0].label).toBe(parent.label?.toString());
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX);
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

        expect(testTree.mFavorites[0].label).toBe(blockMocks.datasetSessionNode.label?.toString());
        expect(testTree.mFavorites[0].contextValue).toBe(Constants.FAV_PROFILE_CONTEXT);
        expect(testTree.mFavorites[0].children[0].label).toBe(testTree.mSessionNodes[1].pattern);
        expect(testTree.mFavorites[0].children[0].contextValue).toBe(Constants.DS_SESSION_CONTEXT + Constants.FAV_SUFFIX);
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

        expect(testTree.mFavorites[0].children.map((entry) => entry.label)).toEqual([node.label?.toString()]);
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
        parent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        child.contextValue = Constants.DS_MEMBER_CONTEXT;

        await testTree.addFavorite(child);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("PDS already in favorites");
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
        expect(profileNodeInFavs.children[0].label).toBe(node1.label?.toString());
        expect(profileNodeInFavs.children[1].label).toBe(node2.label?.toString());

        // Actual test
        await testTree.removeFavorite(profileNodeInFavs.children[0]);
        expect(removeFavProfileSpy).not.toHaveBeenCalled();
        expect(profileNodeInFavs.children.length).toBe(1);
        expect(profileNodeInFavs.children[0].label).toBe(node2.label?.toString());
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
        expect(profileNodeInFavs.children[0].label).toBe(node.label?.toString());
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

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label?.toString() ?? "UNDEFINED", true);

        // Check that favorite is removed from UI
        expect(blockMocks.testTree.mFavorites.length).toEqual(0);
        // Check that favorite is removed from settings file
        expect(updateFavoritesSpy).toHaveBeenCalledTimes(1);
    });
    it("Tests that removeFavProfile leaves profile node in Favorites when user cancels", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        // Make sure favorite is added before the actual unit test
        expect(blockMocks.testTree.mFavorites.length).toEqual(1);

        const expectedFavProfileNode = blockMocks.testTree.mFavorites[0];
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label?.toString() ?? "UNDEFINED", true);

        expect(blockMocks.testTree.mFavorites.length).toEqual(1);
        expect(blockMocks.testTree.mFavorites[0]).toEqual(expectedFavProfileNode);
    });
    it("Tests that removeFavProfile successfully removes profile node in Favorites when called outside user command", async () => {
        createGlobalMocks();
        const blockMocks = await createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        // Make sure favorite is added before the actual unit test
        expect(blockMocks.testTree.mFavorites.length).toEqual(1);

        await blockMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label?.toString() ?? "UNDEFINED", false);

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

        jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValue(globalMocks.mockTreeProviders.ds);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes = globalMocks.mockTreeProviders.ds.mSessionNodes;
        testTree.mSessionNodes.push(createMockNode("Favorites", Constants.DS_SESSION_CONTEXT));

        testTree.deleteSession(globalMocks.mockTreeProviders.ds.mSessionNodes[0]);
        testTree.deleteSession(globalMocks.mockTreeProviders.ds.mSessionNodes[1]);

        expect(testTree.mSessionNodes.map((node) => node.label)).toEqual(["Favorites"]);
    });

    it("Checking case profile needs to be hidden for all trees", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();

        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(globalMocks.mockTreeProviders);
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
        node.contextValue = Constants.DS_PDS_CONTEXT;

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
        node.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;

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
        node.contextValue = Constants.DS_PDS_CONTEXT;

        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
        testTree.flipState(node, false);
        expect(JSON.stringify(node.iconPath)).toContain("folder-closed.svg");
        testTree.flipState(node, true);
        expect(JSON.stringify(node.iconPath)).toContain("folder-open.svg");
    });
});
describe("Dataset Tree Unit Tests - Function datasetFilterPrompt", () => {
    function createBlockMocks(globalMocks): { [key: string]: any } {
        const newMocks = {
            log: imperative.Logger.getAppLogger(),
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
            checkJwtTokenForProfile: jest.spyOn(ZoweTreeProvider as any, "checkJwtTokenForProfile").mockResolvedValueOnce(true),
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

    it("Checking function on favorites", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const addSessionSpy = jest.spyOn(testTree, "addSession");
        const favoriteSearch = new ZoweDatasetNode({
            label: `[${blockMocks.datasetSessionNode.label as string}]: HLQ.PROD1.STUFF`,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_SESSION_CONTEXT + Constants.FAV_SUFFIX,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });

        jest.spyOn(testTree, "addSingleSession").mockImplementation();
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue({
            ds: {
                addSingleSession: jest.fn(),
                setStatusForSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                refresh: jest.fn(),
            } as any,
            uss: {
                addSingleSession: jest.fn(),
                setStatusForSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                refresh: jest.fn(),
            } as any,
            jobs: {
                addSingleSession: jest.fn(),
                setStatusForSession: jest.fn(),
                mSessionNodes: [blockMocks.datasetSessionNode],
                refresh: jest.fn(),
            } as any,
        } as any);

        await testTree.datasetFilterPrompt(favoriteSearch);
        expect(addSessionSpy).toHaveBeenLastCalledWith({ sessionName: blockMocks.datasetSessionNode.label.toString().trim() });
    });
    it("Checking adding of new filter", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const node = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: Constants.DS_DS_CONTEXT,
        });
        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node.contextValue = Constants.FILTER_SEARCH;
        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockResolvedValueOnce([node]);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking adding of new filter of multiple ds search", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD(STUF*),HLQ.PROD1*");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        testTree.mSessionNodes[1].collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const node = new ZoweDatasetNode({
            label: "STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testTree.mSessionNodes[1],
            session: blockMocks.session,
            contextOverride: Constants.DS_DS_CONTEXT,
        });
        node.pattern = undefined as any;
        node.contextValue += "pds";

        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockReturnValueOnce([node] as any);
        jest.spyOn(testTree, "checkFilterPattern").mockReturnValue(true);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD, HLQ.PROD1*");
    });
    it("Checking adding of new filter with data set member", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD1(MEMBER)");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1");
    });
    it("Checking adding of new filter with Unverified profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockImplementationOnce((_name, _type) => blockMocks.imperativeProfile),
                    getBaseProfile: jest.fn(),
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: blockMocks.imperativeProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(testTree.mSessionNodes[1].pattern).toEqual("HLQ.PROD1.STUFF");
    });
    it("Checking cancelled attempt to add a filter", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("You must enter a pattern.");
    });
    it("Checking usage of existing filter from filterPrompt", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const quickPickItem = new FilterDescriptor("HLQ.PROD1.STUFF");
        mocked(vscode.window.createQuickPick).mockReturnValueOnce(
            createQuickPickContent("HLQ.PROD1.STUFF", [quickPickItem], blockMocks.qpPlaceholder)
        );
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(quickPickItem);
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
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
        const blockMocks = createBlockMocks(globalMocks);

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

        expect(mocked(Gui.showMessage)).toHaveBeenCalledWith("No selection made. Operation cancelled.");
    });
    it("Checking adding of new filter error is caught on getChildren", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
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
        const errorSpy = jest.spyOn(AuthUtils, "errorHandling");

        await testTree.datasetFilterPrompt(testTree.mSessionNodes[1]);

        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockClear();
    });
    it("Checking function for return if getChildren is undefined", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
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
        const errorSpy = jest.spyOn(AuthUtils, "errorHandling");

        expect(await testTree.datasetFilterPrompt(testTree.mSessionNodes[1])).not.toBeDefined();

        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockClear();
    });
    it("Checking function for return if element.getChildren calls error handling for success: false", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const errorHandlingMock = new MockedProperty(AuthUtils, "errorHandling");

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.PROD1.STUFF");
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
        expect(errorHandlingMock.mock).toHaveBeenCalled();
        errorHandlingMock[Symbol.dispose]();
    });
    it("Checking function for return if element.getChildren returns undefined", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(new FilterDescriptor("\uFF0B " + "Create a new filter"));
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
        const blockMocks = createBlockMocks(globalMocks);

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
            log: imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            mockDefaultProfile: jest.fn(),
            treeView: createTreeView(),
            datasetSessionNode: null as any as ZoweDatasetNode,
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
                    validProfile: Validation.ValidationType.VALID,
                    getProfileSetting: newMocks.mockGetProfileSetting.mockReturnValue({
                        name: newMocks.imperativeProfile.name,
                        status: "active",
                    }),
                    editSession: newMocks.mockEditSession.mockReturnValueOnce("testProfile"),
                    checkCurrentProfile: newMocks.mockCheckCurrentProfile.mockReturnValue({
                        status: "active",
                        name: "testProfile",
                    }),
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

        await testTree.editSession(node);

        expect(node.getProfile().profile).toEqual(blockMocks.imperativeProfile.profile);
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
            contextOverride: Constants.DS_DS_CONTEXT,
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

        expect(mocked(vscode.workspace.getConfiguration)).toHaveBeenCalledTimes(2);
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

    it("Checking common run of function", () => {
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
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const favoriteNode = new ZoweDatasetNode({
            label: node.label?.toString(),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
        });
        favoriteNode.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        favProfileNode.children.push(favoriteNode);
        testTree.mFavorites.push(favProfileNode);

        const foundNode = testTree.findFavoritedNode(node);

        expect(foundNode).toBe(favoriteNode);
    });
    it("Checking that function does not error when there is no favorite or matching profile node in Favorites", () => {
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

    it("Checking common run of function", () => {
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
        favoriteNode.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        testTree.mSessionNodes[1].children.push(node);

        const foundNode = testTree.findNonFavoritedNode(favoriteNode);

        expect(foundNode).toBe(node);
    });
});

describe("Dataset Tree Unit Tests - Function openItemFromPath", () => {
    function createBlockMocks(): { [key: string]: any } {
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
            contextOverride: Constants.DS_DS_CONTEXT,
        });
        testTree.mSessionNodes[1].children.push(node);
        testTree.mSessionNodes[1].pattern = "test";
        jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockReturnValue(Promise.resolve([node]));

        await testTree.openItemFromPath(
            `[${blockMocks.datasetSessionNode.label as string}]: ${node.label?.toString()}`,
            blockMocks.datasetSessionNode
        );
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

        await testTree.openItemFromPath(
            `[${blockMocks.datasetSessionNode.label as string}]: ${parent.label?.toString()}(${child.label?.toString()})`,
            blockMocks.datasetSessionNode
        );
        expect(testTree.getSearchHistory()).toEqual([`${parent.label?.toString()}(${child.label?.toString()})`]);
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
            rename: jest.spyOn(vscode.workspace.fs, "rename").mockImplementation(),
        };
    }

    it("Tests that rename() renames a node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(Gui.showInputBox).mockResolvedValueOnce("HLQ.TEST.RENAME.NODE.NEW");
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

        await testTree.rename(node);
        expect(blockMocks.rename).toHaveBeenLastCalledWith(
            { path: "/sestest/HLQ.TEST.RENAME.NODE", scheme: ZoweScheme.DS },
            { path: "/sestest/HLQ.TEST.RENAME.NODE.NEW", scheme: ZoweScheme.DS },
            { overwrite: false }
        );
    });

    it("Checking function with PS Dataset using Unverified profile", async () => {
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
                    validProfile: Validation.ValidationType.UNVERIFIED,
                    getBaseProfile: jest.fn(),
                };
            }),
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
        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet");

        await testTree.rename(node);
        expect(renameDataSetSpy).toHaveBeenLastCalledWith(node);
    });

    it("Checking function with PS Dataset given lowercase name", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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
        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet");

        await testTree.rename(node);
        expect(renameDataSetSpy).toHaveBeenLastCalledWith(node);
    });

    it("Checking function with Favorite PS Dataset", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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
        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet");

        await testTree.rename(node);
        expect(renameDataSetSpy).toHaveBeenLastCalledWith(node);
    });
    it("Checking failed attempt to rename PS Dataset", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const defaultError = new Error("Default error message");
        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet").mockRejectedValueOnce(defaultError);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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

        let error;
        try {
            await testTree.rename(node);
        } catch (err) {
            error = err;
        }

        expect(renameDataSetSpy).toHaveBeenLastCalledWith(node);
        expect(error).toBe(defaultError);
    });
    it("Checking function with PDS Member", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
        });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const favParent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            session: blockMocks.session,
        });
        const favChild = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favParent,
            session: blockMocks.session,
        });
        favParent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        favChild.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);

        const findEquivalentNodeSpy = jest.spyOn(testTree, "findEquivalentNode");
        const refreshElementSpy = jest.spyOn(testTree, "refreshElement");

        const renameDataSetMemberSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSetMember");

        mocked(Gui.showInputBox).mockImplementation((options) => {
            options.validateInput("HLQ.TEST.RENAME.NODE");
            return Promise.resolve("HLQ.TEST.RENAME.NODE");
        });
        await testTree.rename(child);
        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith(child);
        expect(findEquivalentNodeSpy).toHaveBeenCalledWith(child.getParent(), false);
        expect(findEquivalentNodeSpy).toHaveBeenCalledWith(child.getParent(), false);
        expect(refreshElementSpy).toHaveBeenCalledWith(child.getParent());
    });

    it("Checking function with PDS", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        // Create nodes in Session section
        const parent = new ZoweDatasetNode({
            label: "HLQ.TEST.OLDNAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_PDS_CONTEXT,
            parentNode: testTree.mSessionNodes[1],
            profile: blockMocks.imperativeProfile,
            session: blockMocks.session,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
            parentNode: parent,
        });
        // Simulate corresponding nodes in favorites
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);

        const refreshElementSpy = jest.spyOn(testTree, "refreshElement");

        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet");

        mocked(Gui.showInputBox).mockImplementation((options) => {
            return Promise.resolve("HLQ.TEST.NEWNAME.NODE");
        });
        await testTree.rename(parent);
        expect(renameDataSetSpy).toHaveBeenLastCalledWith(parent);
        expect(parent.resourceUri?.path).toBe("/sestest/HLQ.TEST.NEWNAME.NODE");
        expect(child.resourceUri?.path).toBe("/sestest/HLQ.TEST.NEWNAME.NODE/mem1");
        expect(refreshElementSpy).toHaveBeenCalled();
    });

    it("Checking function with PDS Member given in lowercase", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
        });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const favParent = new ZoweDatasetNode({
            label: "HLQ.TEST.RENAME.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            session: blockMocks.session,
        });
        const favChild = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favParent,
            session: blockMocks.session,
        });
        favParent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        favChild.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);
        const renameDataSetMemberSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSetMember");
        const renameMock = jest.spyOn(vscode.workspace.fs, "rename").mockImplementation();

        await testTree.rename(child);

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith(child);
        expect(renameMock).toHaveBeenCalled();
        renameMock.mockRestore();
    });
    it("Checking function with favorite PDS Member", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
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
            contextOverride: Constants.PDS_FAV_CONTEXT,
        });
        const child = new ZoweDatasetNode({
            label: "mem1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            session: blockMocks.session,
        });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Simulate corresponding nodes in favorites
        const favProfileNode = new ZoweDatasetNode({
            label: blockMocks.imperativeProfile.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetFavoritesNode,
            session: blockMocks.session,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
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
        favParent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        favChild.contextValue = Constants.DS_MEMBER_CONTEXT;
        // Push test nodes to respective arrays
        parent.children.push(child);
        testTree.mSessionNodes[1].children.push(parent);
        favParent.children.push(favChild);
        favProfileNode.children.push(favParent);
        testTree.mFavorites.push(favProfileNode);
        const renameDataSetMemberSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSetMember");

        await testTree.rename(favChild);

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith(favChild);
    });
    it("Checking failed attempt to rename PDS Member", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const defaultError = new Error("Default error message");
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const renameDataSetMemberSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSetMember");
        renameDataSetMemberSpy.mockImplementation(() => {
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
        child.contextValue = Constants.DS_MEMBER_CONTEXT;

        let error;
        try {
            await testTree.rename(child);
        } catch (err) {
            error = err;
        }

        expect(renameDataSetMemberSpy).toHaveBeenLastCalledWith(child);
        expect(error).toBe(defaultError);
    });
    it("Checking validate validateDataSetName util function successfully execution", () => {
        expect(DatasetUtils.validateDataSetName("#DSNAME.DSNAME")).toBe(true);
    });

    it("Checking validate validateDataSetName util function fail", () => {
        expect(DatasetUtils.validateDataSetName("#DSNAME.DSNAMEMORETHAN8CHARS.TEST")).toBe(false);
    });
    it("Checking validate validateDataSetName util function fail on max ds length", () => {
        const dsName = "#DSNAMET.DSNAME.DSNAME.DSNAME.DSNAME.DSNAMETE";
        expect(dsName.length - 1 === Constants.MAX_DATASET_LENGTH).toBe(true);
        expect(DatasetUtils.validateDataSetName(dsName)).toBe(false);
    });

    it("Tests that rename() validates the dataset name", async () => {
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
        });
        const renameDataSetSpy = jest.spyOn((DatasetTree as any).prototype, "renameDataSet");
        const testValidDsName = async (text: string) => {
            mocked(vscode.window.showInputBox).mockImplementation((options) => {
                options.validateInput(text);
                return Promise.resolve(text);
            });
            await testTree.rename(node);
            expect(renameDataSetSpy).toHaveBeenLastCalledWith(node);
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

    it("successfully initialize favorites", () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new DatasetTree();
        testTree.mSessionNodes.push(blockMocks.datasetSessionNode);
        const log = imperative.Logger.getAppLogger();

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
        session.contextValue = Constants.DS_SESSION_CONTEXT;
        const pds = new ZoweDatasetNode({
            label: "testPds",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: session,
        });
        pds.contextValue = Constants.DS_PDS_CONTEXT;

        const nodeA = new ZoweDatasetNode({
            label: "A",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        jest.spyOn(nodeA, "getStats").mockReturnValue({ user: "someUser", createdDate: new Date(), modifiedDate: new Date() });
        const nodeB = new ZoweDatasetNode({
            label: "B",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        jest.spyOn(nodeB, "getStats").mockReturnValue({
            user: "anotherUser",
            createdDate: new Date("2021-01-01T12:00:00"),
            modifiedDate: new Date("2022-01-01T12:00:00"),
        });
        const nodeC = new ZoweDatasetNode({
            label: "C",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: pds,
        });
        jest.spyOn(nodeC, "getStats").mockReturnValue({
            user: "someUser",
            createdDate: new Date("2022-02-01T12:00:00"),
            modifiedDate: new Date("2022-03-15T16:30:00"),
        });
        pds.children = [nodeA, nodeB, nodeC];
        pds.sort = {
            method: Sorting.DatasetSortOpts.Name,
            direction: Sorting.SortDirection.Ascending,
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
                method: Sorting.DatasetSortOpts.Name,
                direction: Sorting.SortDirection.Descending,
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
                method: Sorting.DatasetSortOpts.Name,
                direction: Sorting.SortDirection.Descending,
            };
            // insert node with same date modified
            const nodeD = new ZoweDatasetNode({
                label: "D",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: nodes.pds,
                session: createISession(),
            });
            jest.spyOn(nodeD, "getStats").mockReturnValue({
                user: "someUser",
                createdDate: new Date("2021-01-01T12:00:00"),
                modifiedDate: new Date("2022-03-15T16:30:00"),
            });
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
            jest.spyOn(nodeD, "getStats").mockReturnValue({
                user: "someUser",
                createdDate: new Date("not a valid date"),
                modifiedDate: new Date("2022-03-15T16:30:00"),
            });
            nodes.pds.children = [...(nodes.pds.children ?? []), nodeD];
            mocks.showQuickPick.mockResolvedValueOnce({ label: "$(calendar) Date Created" });
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
        });

        it("sorts by created date: handling node with undefined property", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            delete (nodes.pds.children as any)[1].getStats().createdDate;
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
            jest.spyOn(nodeD, "getStats").mockReturnValue({
                user: "someUser",
                createdDate: new Date("2021-01-01T12:00:00"),
                modifiedDate: new Date("2022-03-15T16:30:00"),
            });
            nodes.pds.children = [...(nodes.pds.children ?? []), nodeD];
            await tree.sortPdsMembersDialog(nodes.pds);
            expect(mocks.nodeDataChanged).toHaveBeenCalled();
            expect(mocks.refreshElement).not.toHaveBeenCalled();
            expect(nodes.pds.children?.map((c: IZoweDatasetTreeNode) => c.label)).toStrictEqual(["A", "D", "C", "B"]);
        });

        it("sorts by last modified date: handling node with undefined property", async () => {
            const mocks = getBlockMocks();
            const nodes = nodesForSuite();
            delete (nodes.pds.children as any)[1].getStats().modifiedDate;
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
            delete (nodes.pds.children as any)[0].getStats().user;
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

            nodes.pds.filter = { method: Sorting.DatasetFilterOpts.UserId, value: "invalidUserId" };
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
                method: Sorting.DatasetFilterOpts.LastModified,
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
        it("adds a new DS template to the persistent object", async () => {
            const mockTemplates = [{ test1: {} }, { test2: {} }, { test3: {} }];
            const newTemplate = { test: {} };
            mockTemplates.unshift(newTemplate as any);
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                inspect: jest.fn().mockReturnValue({ globalValue: mockTemplates }),
            } as any);
            Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [], configurable: true });
            const infoLoggerSpy = jest.spyOn(ZoweLogger, "info");
            const setValueSpy = jest.spyOn(SettingsConfig, "setDirectValue").mockImplementation();
            // Object.defineProperty(SettingsConfig, "setDirectValue", { value: jest.fn(), configurable: true });

            await tree.addDsTemplate(newTemplate as any);
            expect(infoLoggerSpy).toHaveBeenCalledWith("Adding new data set template {0}.");
            expect(setValueSpy).toHaveBeenCalled();
            infoLoggerSpy.mockClear();
            setValueSpy.mockClear();
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
            const mockTemplates = [{ test1: {} }, { test2: {} }, { test3: {} }];
            Object.defineProperty(SettingsConfig, "getDirectValue", {
                value: jest.fn().mockReturnValue(mockTemplates),
                configurable: true,
            });
            expect(tree.getDsTemplates()).toEqual(mockTemplates);
        });
    });

    describe("getFavorites", () => {
        it("gets all the favorites from persistent object", () => {
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                favorites: ["test1", "test2", "test3"],
            });
            expect(tree.getFavorites()).toEqual(["test1", "test2", "test3"]);
        });
    });
});

describe("Dataset Tree Unit Tests - Function openWithEncoding", () => {
    it("sets binary encoding if selection was made", async () => {
        const setEncodingMock = jest.spyOn(DatasetFSProvider.instance, "setEncodingForFile").mockImplementation();
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(SharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "binary" });
        await DatasetTree.prototype.openWithEncoding(node);
        expect(setEncodingMock).toHaveBeenCalledWith(node.resourceUri, { kind: "binary" });
        expect(node.openDs).toHaveBeenCalledTimes(1);
        setEncodingMock.mockRestore();
    });

    it("sets text encoding if selection was made", async () => {
        const setEncodingMock = jest.spyOn(DatasetFSProvider.instance, "setEncodingForFile").mockImplementation();
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(SharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        await DatasetTree.prototype.openWithEncoding(node);
        expect(setEncodingMock).toHaveBeenCalledWith(node.resourceUri, { kind: "text" });
        expect(node.openDs).toHaveBeenCalledTimes(1);
        setEncodingMock.mockRestore();
    });

    it("does not set encoding if prompt was cancelled", async () => {
        const setEncodingSpy = jest.spyOn(DatasetFSProvider.instance, "setEncodingForFile");
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openDs = jest.fn();
        jest.spyOn(SharedUtils, "promptForEncoding").mockResolvedValueOnce(undefined);
        await DatasetTree.prototype.openWithEncoding(node);
        expect(setEncodingSpy).not.toHaveBeenCalled();
        expect(node.openDs).toHaveBeenCalledTimes(0);
    });
});

describe("Dataset Tree Unit Tests - Function createProfileNodeForFavs", () => {
    it("Tests that profile grouping node is created correctly - project-level profile", async () => {
        const globalMocks = await createGlobalMocks();
        const testTree = new DatasetTree();
        const expectedFavProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
            parentNode: testTree.mFavoriteSession,
            profile: globalMocks.testProfileLoaded,
        });

        // Assume test node is a project-level, favorited profile
        expectedFavProfileNode.contextValue = Constants.DS_SESSION_CONTEXT;
        const icon = IconGenerator.getIconByNode(expectedFavProfileNode);
        if (icon) {
            expectedFavProfileNode.iconPath = icon.path;
        }
        expectedFavProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;

        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        const existsMock = jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValueOnce(false);

        const createdFavProfileNode = await testTree.createProfileNodeForFavs("testProfile", globalMocks.testProfileLoaded);
        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);
        expect(existsMock).toHaveBeenCalledWith(expectedFavProfileNode.resourceUri);
        expect(createDirMock).toHaveBeenCalledWith(expectedFavProfileNode.resourceUri);
        createDirMock.mockRestore();
        existsMock.mockRestore();
    });

    it("Tests that profile grouping node is created correctly - global profile", async () => {
        const globalMocks = await createGlobalMocks();
        const testTree = new DatasetTree();
        const expectedFavProfileNode = new ZoweDatasetNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
            parentNode: testTree.mFavoriteSession,
            profile: globalMocks.testProfileLoaded,
        });

        const isGlobalProfNodeMock = jest.spyOn(testTree as any, "isGlobalProfileNode").mockResolvedValueOnce(true);
        const icon = IconGenerator.getIconById(IconUtils.IconId.home);
        expectedFavProfileNode.iconPath = icon.path;

        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        const existsMock = jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValueOnce(false);

        const createdFavProfileNode = await testTree.createProfileNodeForFavs("testProfile", globalMocks.testProfileLoaded);
        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);
        expect(existsMock).toHaveBeenCalledWith(expectedFavProfileNode.resourceUri);
        expect(createDirMock).toHaveBeenCalledWith(expectedFavProfileNode.resourceUri);
        expect(isGlobalProfNodeMock).toHaveBeenCalled();
        createDirMock.mockRestore();
        existsMock.mockRestore();
        isGlobalProfNodeMock.mockRestore();
    });
});

describe("Dataset Tree Unit Tests - Function extractPatterns", () => {
    it("Handles member wildcards that match the regex", () => {
        const testTree = new DatasetTree();
        expect(testTree.extractPatterns("HLQ.PROD.STUFF(TEST*)")).toStrictEqual([
            {
                dsn: "HLQ.PROD.STUFF",
                member: "TEST*",
            },
        ]);
    });
    it("Handles data set wildcards that do not match the regex", () => {
        const testTree = new DatasetTree();
        expect(testTree.extractPatterns("HLQ.PROD.*")).toStrictEqual([
            {
                dsn: "HLQ.PROD.*",
            },
        ]);
    });
});

describe("Dataset Tree Unit Tests - Function buildFinalPattern", () => {
    it("Handles both patterns with member wildcards and normal patterns", () => {
        const testTree = new DatasetTree();
        const patterns = testTree.extractPatterns("HLQ.PROD.STUFF*(TEST*), HLQ.DEV.STUFF.*");
        // The member wildcard will not appear in the final pattern, but the member pattern is attached to the PDS nodes
        expect(testTree.buildFinalPattern(patterns)).toStrictEqual("HLQ.PROD.STUFF*, HLQ.DEV.STUFF.*");
    });
});

describe("Dataset Tree Unit Tests - Function applyPatternsToChildren", () => {
    it("applies the filter search context value to a PDS that matches the given patterns", () => {
        const testTree = new DatasetTree();
        const fakeSessionNode = { dirty: false, contextValue: Constants.DS_SESSION_CONTEXT };
        const fakeChildren = [{ label: "HLQ.PROD.PDS", contextValue: Constants.DS_PDS_CONTEXT }];
        const withProfileMock = jest.spyOn(SharedContext, "withProfile").mockImplementation((child) => String(child.contextValue));
        testTree.applyPatternsToChildren(fakeChildren as any[], [{ dsn: "HLQ.PROD.PDS", member: "A*" }], fakeSessionNode as any);
        expect(SharedContext.isFilterFolder(fakeChildren[0])).toBe(true);
        withProfileMock.mockRestore();
    });
    it("applies a closed filter folder icon to the PDS if collapsed", () => {
        const testTree = new DatasetTree();
        const fakeSessionNode = { dirty: false, contextValue: Constants.DS_SESSION_CONTEXT };
        const fakeChildren = [
            {
                label: "HLQ.PROD.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextValue: Constants.DS_PDS_CONTEXT,
                iconPath: undefined,
            },
        ];
        const withProfileMock = jest.spyOn(SharedContext, "withProfile").mockImplementation((child) => String(child.contextValue));
        testTree.applyPatternsToChildren(fakeChildren as any[], [{ dsn: "HLQ.PROD.PDS", member: "A*" }], fakeSessionNode as any);
        expect(fakeChildren[0].iconPath).toBe(IconGenerator.getIconById(IconUtils.IconId.filterFolder).path);
        withProfileMock.mockRestore();
    });
    it("applies an open filter folder icon to the PDS if expanded", () => {
        const testTree = new DatasetTree();
        const fakeSessionNode = { dirty: false, contextValue: Constants.DS_SESSION_CONTEXT };
        const fakeChildren = [
            {
                label: "HLQ.PROD.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: Constants.DS_PDS_CONTEXT,
                iconPath: undefined,
            },
        ];
        const withProfileMock = jest.spyOn(SharedContext, "withProfile").mockImplementation((child) => String(child.contextValue));
        testTree.applyPatternsToChildren(fakeChildren as any[], [{ dsn: "HLQ.PROD.PDS", member: "A*" }], fakeSessionNode as any);
        expect(fakeChildren[0].iconPath).toBe(IconGenerator.getIconById(IconUtils.IconId.filterFolderOpen).path);
        withProfileMock.mockRestore();
    });
});
