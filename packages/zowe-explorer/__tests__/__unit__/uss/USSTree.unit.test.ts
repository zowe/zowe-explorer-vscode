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

import { Gui, IZoweUSSTreeNode, ProfilesCache, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import { createUSSTree, USSTree } from "../../../src/uss/USSTree";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import {
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createFileResponse,
    createInstanceOfProfile,
    createValidIProfile,
    createTreeView,
    createTreeProviders,
} from "../../../__mocks__/mockCreators/shared";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { createUSSNode, createFavoriteUSSNode, createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { getIconByNode } from "../../../src/generators/icons";
import * as workspaceUtils from "../../../src/utils/workspace";
import { createUssApi, bindUssApi } from "../../../__mocks__/mockCreators/api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { join } from "path";
import * as sharedUtils from "../../../src/shared/utils";
import { mocked } from "../../../__mocks__/mockUtils";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockDefaultProfile: jest.fn(),
        executeCommand: jest.fn(),
        Utilities: jest.fn(),
        showQuickPick: jest.fn(),
        renameUSSFile: jest.fn(),
        showInformationMessage: jest.fn(),
        mockShowWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showInputBox: jest.fn(),
        filters: jest.fn(),
        getFilters: jest.fn(),
        createTreeView: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        createQuickPick: jest.fn(),
        getConfiguration: jest.fn(),
        ZosmfSession: jest.fn(),
        createSessCfgFromArgs: jest.fn(),
        mockValidationSetting: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        mockCheckCurrentProfile: jest.fn(),
        mockTextDocumentDirty: { fileName: `/test/path/temp/_U_/sestest/test/node`, isDirty: true },
        mockTextDocumentClean: { fileName: `/test/path/temp/_U_/sestest/testClean/node`, isDirty: false },
        mockTextDocuments: [],
        mockProfilesInstance: null,
        withProgress: jest.fn(),
        closeOpenedTextFile: jest.fn(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        testProfile: createIProfile(),
        testBaseProfile: createValidIProfile(),
        testCombinedProfile: createValidIProfile(),
        testSession: createISession(),
        testResponse: createFileResponse({ items: [] }),
        testUSSNode: null,
        testTree: null,
        profilesForValidation: { status: "active", name: "fake" },
        mockProfilesCache: new ProfilesCache(zowe.imperative.Logger.getAppLogger()),
        mockTreeProviders: createTreeProviders(),
    };

    globalMocks.mockTextDocuments.push(globalMocks.mockTextDocumentDirty);
    globalMocks.mockTextDocuments.push(globalMocks.mockTextDocumentClean);
    globalMocks.testBaseProfile.profile.tokenType = "tokenType";
    globalMocks.testBaseProfile.profile.tokenValue = "testTokenValue";
    globalMocks.testCombinedProfile.profile.tokenType = "tokenType";
    globalMocks.testCombinedProfile.profile.tokenValue = "testTokenValue";
    globalMocks.mockProfilesInstance = createInstanceOfProfile(globalMocks.testProfile);
    globalMocks.mockProfilesInstance.getBaseProfile.mockResolvedValue(globalMocks.testBaseProfile);
    globalMocks.mockProfilesInstance.loadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfilesInstance.allProfiles = [globalMocks.testProfile, { name: "firstName" }, { name: "secondName" }];
    Object.defineProperty(Gui, "setStatusBarMessage", {
        value: jest.fn().mockReturnValue({
            dispose: jest.fn(),
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(workspaceUtils, "closeOpenedTextFile", {
        value: globalMocks.closeOpenedTextFile,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "renameUSSFile", {
        value: globalMocks.renameUSSFile,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.showInformationMessage,
        configurable: true,
    });
    Object.defineProperty(globalMocks.ZosmfSession, "createSessCfgFromArgs", {
        value: globalMocks.createSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.filters, "getFilters", { value: globalMocks.getFilters, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: globalMocks.createQuickPick, configurable: true });
    Object.defineProperty(zowe, "Download", {
        value: {
            ussFile: jest.fn().mockReturnValueOnce({
                apiResponse: {
                    etag: "ABC123",
                },
            }),
        },
        configurable: true,
    });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(zowe.Utilities, "isFileTagBinOrAscii", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: globalMocks.showErrorMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.getConfiguration,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(vscode.workspace, "textDocuments", {
        value: globalMocks.mockTextDocuments,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(globalMocks.mockProfilesInstance),
        configurable: true,
    });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);
    globalMocks.getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
    globalMocks.mockDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => ["[test]: /u/aDir{directory}", "[test]: /u/myFile.txt{textFile}"],
        update: jest.fn(() => {
            return {};
        }),
    });
    globalMocks.testTree = new USSTree();
    globalMocks.testTree.treeView = createTreeView();
    const ussSessionTestNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testUSSNode = createUSSNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testTree.mSessionNodes.push(ussSessionTestNode);
    globalMocks.testTree.addSearchHistory("/u/myuser");

    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn().mockReturnValue({ usingTeamConfig: false }),
    });

    jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({
        ds: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testTree.mSessionNodes], refresh: jest.fn() } as any,
        uss: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testTree.mSessionNodes], refresh: jest.fn() } as any,
        jobs: { addSingleSession: jest.fn(), mSessionNodes: [...globalMocks.testTree.mSessionNodes], refresh: jest.fn() } as any,
    } as any);
    jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();
    jest.spyOn(LocalFileManagement, "deleteFileInfo").mockImplementation();
    jest.spyOn(LocalFileManagement, "removeRecoveredFile").mockImplementation();

    return globalMocks;
}

describe("USSTree Unit Tests - Function initializeFavorites", () => {
    it("Tests that initializeFavorites() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const testTree1 = await createUSSTree(zowe.imperative.Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(1);
        expect(favProfileNode.children.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode({ label: "/u/aDir", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, session: globalMocks.testSession }),
            new ZoweUSSNode({ label: "/u/myFile.txt", collapsibleState: vscode.TreeItemCollapsibleState.None, session: globalMocks.testSession }),
        ];

        expectedUSSFavorites.forEach((node) => (node.contextValue += globals.FAV_SUFFIX));
        expectedUSSFavorites.forEach((node) => {
            if (node.contextValue !== globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX) {
                node.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [node] };
            }
        });
        expect(favProfileNode.children[0].fullPath).toEqual("/u/aDir");
        expect(favProfileNode.children[1].label).toEqual("myFile.txt");
    });
});

describe("USSTree Unit Tests - Function initializeFavChildNodeForProfile", () => {
    it("Tests initializeFavChildNodeForProfile() for favorited search", async () => {
        await createGlobalMocks();
        const testTree1 = await createUSSTree(zowe.imperative.Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        const label = "/u/fakeuser";
        const line = "[test]: /u/fakeuser{ussSession}";
        const expectedFavSearchNode = new ZoweUSSNode({
            label: "/u/fakeuser",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
        });
        expectedFavSearchNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        expectedFavSearchNode.fullPath = label;
        expectedFavSearchNode.label = expectedFavSearchNode.tooltip = label;
        expectedFavSearchNode.command = { command: "zowe.uss.fullPath", title: "", arguments: [expectedFavSearchNode] };
        const targetIcon = getIconByNode(expectedFavSearchNode);
        if (targetIcon) {
            expectedFavSearchNode.iconPath = targetIcon.path;
        }
        const favSearchNode = await testTree1.initializeFavChildNodeForProfile(label, line, favProfileNode);

        expect(favSearchNode).toEqual(expectedFavSearchNode);
    });
});

describe("USSTree Unit Tests - Function createProfileNodeForFavs", () => {
    it("Tests that profile grouping node is created correctly", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedFavProfileNode = new ZoweUSSNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
        });
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        const createdFavProfileNode = await globalMocks.testTree.createProfileNodeForFavs("testProfile");

        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Tests that profile grouping node is created correctly if icon is defined", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedFavProfileNode = new ZoweUSSNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
        });
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const icons = await import("../../../src/generators/icons");
        const folderIcon = (await import("../../../src/generators/icons/items/folder")).default;
        const savedIconsProperty = Object.getOwnPropertyDescriptor(icons, "getIconByNode");
        Object.defineProperty(icons, "getIconByNode", {
            value: jest.fn(() => {
                return folderIcon;
            }),
        });

        const createdFavProfileNode = await globalMocks.testTree.createProfileNodeForFavs("testProfile");

        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);

        // Reset getIconByNode to its original functionality
        Object.defineProperty(icons, "getIconByNode", savedIconsProperty);
    });
});

describe("USSTree Unit Tests - Function checkDuplicateLabel", () => {
    it("Tests that checkDuplicateLabel() returns null if passed a unique name", async () => {
        const globalMocks = await createGlobalMocks();

        const returnVal = globalMocks.testTree.checkDuplicateLabel("totallyNewLabel", [globalMocks.testUSSNode]);
        expect(returnVal).toEqual(null);
    });
    it("Tests that checkDuplicateLabel() returns an error message if passed a name that's already used for an existing folder", async () => {
        const globalMocks = await createGlobalMocks();

        const returnVal = globalMocks.testTree.checkDuplicateLabel("/u/myuser/testDir", [globalMocks.testUSSNode]);
        expect(returnVal).toEqual("A folder already exists with this name. Please choose a different name.");
    });
});

describe("USSTree Unit Tests - Functions addFileHistory & getFileHistory", () => {
    it("Tests that addFileHistory() & getFileHistory() are executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.addFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory()[0]).toEqual("TESTHISTORY");
    });
});

describe("USSTree Unit Tests - Functions removeFileHistory", () => {
    it("Tests that removeFileHistory() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.removeFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory().includes("TESTHISTORY")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Function removeFavorite", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testDir: new ZoweUSSNode({
                label: "testDir",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testTree.mSessionNodes[1],
                parentPath: "/",
            }),
        };
        await globalMocks.testTree.addFavorite(newMocks.testDir);
        const favProfileNode = globalMocks.testTree.mFavorites[0];
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        favProfileNode.profile = globalMocks.testProfile;

        return newMocks;
    }

    it("Tests that removeFavorite() works properly when starting with more than one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const removeFavProfileSpy = jest.spyOn(globalMocks.testTree, "removeFavProfile");
        const profileNodeInFavs = globalMocks.testTree.mFavorites[0];

        // Add second favorite
        const testDir2 = new ZoweUSSNode({
            label: "testDir2",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
            parentPath: "/",
        });
        await globalMocks.testTree.addFavorite(testDir2);

        // Checking that favorites are set successfully before test
        expect(profileNodeInFavs.children.length).toEqual(2);
        expect(profileNodeInFavs.children[0].fullPath).toEqual(blockMocks.testDir.fullPath);
        expect(profileNodeInFavs.children[1].fullPath).toEqual(testDir2.fullPath);

        // Actual test
        await globalMocks.testTree.removeFavorite(blockMocks.testDir);
        expect(removeFavProfileSpy).not.toBeCalled();
        expect(profileNodeInFavs.children[0].fullPath).toEqual(testDir2.fullPath);
    });
    it("Tests that removeFavorite() works properly when starting with only one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const removeFavProfileSpy = jest.spyOn(globalMocks.testTree, "removeFavProfile");
        const profileNodeInFavs = globalMocks.testTree.mFavorites[0];

        // Checking that favorites are set successfully before test
        expect(profileNodeInFavs.children[0].fullPath).toEqual(blockMocks.testDir.fullPath);

        await globalMocks.testTree.removeFavorite(blockMocks.testDir);
        expect(removeFavProfileSpy).toHaveBeenCalledWith(profileNodeInFavs.label, false);
        expect(profileNodeInFavs.children).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function removeFavProfile", () => {
    async function createBlockMocks(globalMocks) {
        globalMocks.testTree.mFavorites = [];
        const testDir = new ZoweUSSNode({
            label: "testDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
            parentPath: "/",
        });
        await globalMocks.testTree.addFavorite(testDir);
        const profileNodeInFavs: IZoweUSSTreeNode = globalMocks.testTree.mFavorites[0];
        (profileNodeInFavs as any).profile = globalMocks.testProfile;

        const newMocks = {
            profileNodeInFavs,
        };

        return newMocks;
    }

    it("Tests successful removal of profile node in Favorites when user confirms they want to Continue removing it", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const updateFavoritesSpy = jest.spyOn(globalMocks.testTree, "updateFavorites");
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);

        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Continue");
        await globalMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label, true);

        // Check that favorite is removed from UI
        expect(globalMocks.testTree.mFavorites.length).toEqual(0);
        // Check that favorite is removed from settings file
        expect(updateFavoritesSpy).toBeCalledTimes(1);
    });
    it("Tests that removeFavProfile leaves profile node in Favorites when user cancels", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);
        const expectedFavProfileNode = globalMocks.testTree.mFavorites[0];

        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");
        await globalMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label, true);

        expect(globalMocks.testTree.mFavorites.length).toEqual(1);
        expect(globalMocks.testTree.mFavorites[0]).toEqual(expectedFavProfileNode);
    });
    it("Tests that removeFavProfile successfully removes profile node in Favorites when called outside user command", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);

        await globalMocks.testTree.removeFavProfile(blockMocks.profileNodeInFavs.label, false);

        expect(globalMocks.testTree.mFavorites.length).toEqual(0);
    });
});

describe("USSTree Unit Tests - Function addSession", () => {
    it("Tests if addSession works properly", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode({
            label: "testSessionNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testSession,
        });
        globalMocks.testTree.mSessionNodes.push(testSessionNode);
        globalMocks.testTree.addSession("testSessionNode");

        const foundNode = globalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function deleteSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testTree2: new USSTree(),
            testSessionNode: new ZoweUSSNode({
                label: "testSessionNode",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: globalMocks.testSession,
            }),
            startLength: 0,
        };
        const ussSessionTestNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
        newMocks.testTree2.mSessionNodes.push(ussSessionTestNode);
        newMocks.testTree2.mSessionNodes.push(newMocks.testSessionNode);
        newMocks.startLength = newMocks.testTree2.mSessionNodes.length;

        return newMocks;
    }

    it("Tests that deleteSession works properly", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue(globalMocks.mockTreeProviders);

        blockMocks.testTree2.mSessionNodes = globalMocks.mockTreeProviders.ds.mSessionNodes;
        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.length).toEqual(2);
        expect(globalMocks.mockTreeProviders.uss.mSessionNodes.length).toEqual(2);
        expect(globalMocks.mockTreeProviders.job.mSessionNodes.length).toEqual(2);
        blockMocks.testTree2.deleteSession(globalMocks.mockTreeProviders.ds.mSessionNodes[1], true);
        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.length).toEqual(1);
        expect(globalMocks.mockTreeProviders.uss.mSessionNodes.length).toEqual(1);
        expect(globalMocks.mockTreeProviders.job.mSessionNodes.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function filterPrompt", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            theia: false,
            qpValue: "",
            qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
            resolveQuickPickHelper: jest.spyOn(Gui, "resolveQuickPick"),
        };
        Object.defineProperty(globals, "ISTHEIA", { get: () => newMocks.theia });
        newMocks.resolveQuickPickHelper.mockImplementation(() => Promise.resolve(newMocks.qpItem));
        globalMocks.createQuickPick.mockReturnValue({
            placeholder: "Select a filter",
            activeItems: [newMocks.qpItem],
            ignoreFocusOut: true,
            items: [newMocks.qpItem],
            value: newMocks.qpValue,
            show: jest.fn(() => {
                return {};
            }),
            hide: jest.fn(() => {
                return {};
            }),
            onDidAccept: jest.fn(() => {
                return {};
            }),
        });

        return newMocks;
    }

    it("works properly when user enters path", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpValue = "/U/HARRY";
        globalMocks.showInputBox.mockReturnValueOnce("/U/HARRY");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("works properly when user enters the root path (/)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpValue = "/";
        globalMocks.showInputBox.mockReturnValueOnce("/");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/");
    });

    it("makes the call to get the combined session information", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.qpValue = "/U/HLQ";
        globalMocks.showInputBox.mockReturnValueOnce("/U/HLQ");
        const syncSessionNodeSpy = jest.spyOn(utils, "syncSessionNode");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);

        expect(syncSessionNodeSpy).toBeCalledTimes(1);
    });

    it("works properly when user enters path with Unverified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: globalMocks.testProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
            configurable: true,
        });

        blockMocks.qpValue = "/U/HARRY";
        globalMocks.showInputBox.mockReturnValueOnce("/U/HARRY");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("exits when user cancels out of input field", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("works on a file path", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpValue = "/U/HLQ/STUFF";
        blockMocks.qpItem = new utils.FilterDescriptor("/U/HLQ/STUFF");
        globalMocks.showInputBox.mockReturnValueOnce("/U/HLQ/STUFF");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HLQ/STUFF");
    });

    it("exits when user cancels the input path box", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpItem = undefined;

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made. Operation cancelled.");
    });

    it("works when new path is specified (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpValue = "/u/myFiles";
        globalMocks.showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        globalMocks.showInputBox.mockReturnValueOnce("/u/myFiles");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");
    });

    it("exits when user cancels the input path box (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.showQuickPick.mockReturnValueOnce("\uFF0B " + "Create a new filter");
        globalMocks.showInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("works with a file (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpValue = "/u/thisFile";
        globalMocks.showQuickPick.mockReturnValueOnce(new utils.FilterDescriptor("/u/thisFile"));
        globalMocks.showInputBox.mockReturnValueOnce("/u/thisFile");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");
    });

    it("exits when no selection made (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.showQuickPick.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made. Operation cancelled.");
    });

    it("works correctly for favorited search nodes with credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const sessionWithCred = createISession();
        globalMocks.createSessCfgFromArgs.mockReturnValue(sessionWithCred);
        const dsNode = new ZoweUSSNode({
            label: "/u/myFile.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: sessionWithCred,
            profile: { name: "ussTestSess2" } as any,
        });
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        globalMocks.testTree.mSessionNodes.push(dsNode);

        await globalMocks.testTree.filterPrompt(dsNode);
        globalMocks.testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) {
                expect(sessionNode.fullPath).toEqual("/u/myFile.txt");
            }
        });
    });

    it("works correctly for favorited search nodes without credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const sessionNoCred = createISessionWithoutCredentials();
        globalMocks.createSessCfgFromArgs.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode({
            label: "/u/myFile.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: sessionNoCred,
            profile: { name: "ussTestSess2" } as any,
        });
        dsNode.getSession().ISession.user = "";
        dsNode.getSession().ISession.password = "";
        dsNode.getSession().ISession.base64EncodedAuth = "";
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        globalMocks.testTree.mSessionNodes.push(dsNode);

        await globalMocks.testTree.filterPrompt(dsNode);
        globalMocks.testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) {
                expect(sessionNode.fullPath).toEqual("/u/myFile.txt");
            }
        });
    });
});

describe("USSTree Unit Tests - Function getAllLoadedItems", () => {
    it("Testing that getAllLoadedItems() returns the correct array", async () => {
        const globalMocks = await createGlobalMocks();

        const folder = new ZoweUSSNode({
            label: "folder",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
            parentPath: "/",
        });
        const file = new ZoweUSSNode({
            label: "file",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: folder,
            parentPath: "/folder",
        });
        globalMocks.testTree.mSessionNodes[1].children = [folder];
        folder.children.push(file);

        const treeGetChildren = jest
            .spyOn(globalMocks.testTree, "getChildren")
            .mockImplementationOnce(() => Promise.resolve([globalMocks.testTree.mSessionNodes[1]]));
        const sessionGetChildren = jest
            .spyOn(globalMocks.testTree.mSessionNodes[1], "getChildren")
            .mockImplementationOnce(() => Promise.resolve(globalMocks.testTree.mSessionNodes[1].children));

        const loadedItems = await globalMocks.testTree.getAllLoadedItems();
        expect(loadedItems).toStrictEqual([file, folder]);
    });
});

const setupUssFavNode = (globalMocks): ZoweUSSNode => {
    const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
    const ussFavNodeParent = new ZoweUSSNode({
        label: "sestest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session: globalMocks.testSession,
        profile: globalMocks.testProfile,
    });
    ussFavNodeParent.children.push(ussFavNode);
    globalMocks.testTree.mFavorites.push(ussFavNodeParent);

    return ussFavNode;
};

describe("USSTree Unit Tests - Function findFavoritedNode", () => {
    it("Testing that findFavoritedNode() returns the favorite of a non-favorited node", async () => {
        const globalMocks = await createGlobalMocks();

        const ussFavNode = setupUssFavNode(globalMocks);
        const foundNode = await globalMocks.testTree.findFavoritedNode(globalMocks.testUSSNode);

        expect(foundNode).toStrictEqual(ussFavNode);
    });
    it("Tests that findFavoritedNode() returns undefined when there is no favorite or matching profile node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const node = createUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const foundNode = await globalMocks.testTree.findFavoritedNode(node);

        expect(foundNode).toBeUndefined();
    });
});

describe("USSTree Unit Tests - Function findNonFavoritedNode", () => {
    it("Testing that findNonFavoritedNode() returns the non-favorite from a favorite node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = setupUssFavNode(globalMocks);

        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const nonFaveNode = await globalMocks.testTree.findNonFavoritedNode(ussFavNode);
        expect(nonFaveNode).toStrictEqual(globalMocks.testUSSNode);
    });
});

describe("USSTree Unit Tests - Function findEquivalentNode", () => {
    it("Testing that findEquivalentNode() returns the corresponding node for a favorite node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = setupUssFavNode(globalMocks);

        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const nonFaveNode = await globalMocks.testTree.findEquivalentNode(ussFavNode, true);
        expect(nonFaveNode).toStrictEqual(globalMocks.testUSSNode);
    });
});

describe("USSTree Unit Tests - Function findMatchInLoadedChildren", () => {
    it("Testing that findMatchInLoadedChildren() can find a nested child node by fullPath", async () => {
        const globalMocks = await createGlobalMocks();
        const sessionNode = globalMocks.testTree.mSessionNodes[1];
        const ussChild = new ZoweUSSNode({
            label: "ussChild",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: globalMocks.testUSSNode,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            parentPath: globalMocks.testUSSNode.fullPath,
        });
        globalMocks.testUSSNode.children.push(ussChild);
        sessionNode.children.push(globalMocks.testUSSNode);

        const matchingNode = await globalMocks.testTree.findMatchInLoadedChildren(sessionNode, ussChild.fullPath);
        expect(matchingNode).toStrictEqual(ussChild);
    });
});

describe("USSTree Unit Tests - Function renameUSSNode", () => {
    it("Checking common run of function", async () => {
        const globalMocks = await createGlobalMocks();
        const ussSessionNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
        const ussNode = createUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const renameSpy = jest.spyOn(ussNode, "rename");

        ussSessionNode.children.push(ussNode);
        globalMocks.testTree.mSessionNodes[1].children.push(ussNode);

        await globalMocks.testTree.renameUSSNode(ussNode, "/u/myuser/renamed");

        expect(renameSpy).toBeCalledTimes(1);
        expect(renameSpy).toBeCalledWith("/u/myuser/renamed");
    });
});

describe("USSTree Unit Tests - Function renameFavorite", () => {
    it("Checking common run of function", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);
        const renameSpy = jest.spyOn(ussFavNode, "rename");

        await globalMocks.testTree.renameFavorite(ussFavNode, "/u/myuser/renamed");

        expect(renameSpy).toBeCalledTimes(1);
        expect(renameSpy).toBeCalledWith("/u/myuser/renamed");
    });
});

describe("USSTree Unit Tests - Function saveSearch", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            folder: new ZoweUSSNode({
                label: "parent",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testTree.mSessionNodes[1],
                parentPath: "/",
            }),
            file: null,
            resolveQuickPickHelper: jest.spyOn(Gui, "resolveQuickPick"),
        };
        globalMocks.testTree.mFavorites = [];
        newMocks.file = new ZoweUSSNode({
            label: "abcd",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: newMocks.folder,
            parentPath: "/parent",
        });
        newMocks.file.contextValue = globals.USS_SESSION_CONTEXT;

        return newMocks;
    }

    it("Testing that saveSearch() works properly for a folder", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await globalMocks.testTree.addFavorite(blockMocks.folder);
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await globalMocks.testTree.addFavorite(blockMocks.file);
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const ussNodeToSave = blockMocks.file;
        const expectedNode = ussNodeToSave;

        expectedNode.label = expectedNode.fullPath;
        expectedNode.tooltip = expectedNode.fullPath;
        expectedNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;

        await globalMocks.testTree.saveSearch(ussNodeToSave);

        expect(ussNodeToSave).toEqual(expectedNode);
    });

    it("Testing that saveSearch() works properly on the same session, different path", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const testNode = globalMocks.testTree.mSessionNodes[1];
        testNode.fullPath = "/a1234";

        await globalMocks.testTree.addFavorite(testNode);
        const favProfileNode = globalMocks.testTree.mFavorites[0];

        testNode.fullPath = "/r1234";
        await globalMocks.testTree.addFavorite(testNode);
        expect(favProfileNode.children.length).toEqual(2);
    });
});

describe("USSTree Unit Tests - Function rename", () => {
    function createBlockMocks(globalMocks) {
        globalMocks.testUSSNode.contextValue = globals.USS_TEXT_FILE_CONTEXT;

        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile.name,
        });
        ussFavNodeParent.shortLabel = "usstest";
        ussFavNodeParent.fullPath = globalMocks.testUSSNode.fullPath;
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);

        const newMocks = {
            ussFavNode,
            ussFavNodeParent,
        };

        return newMocks;
    }

    it("Tests that USSTree.rename() shows error if an open dirty file's fullpath includes that of the node being renamed", async () => {
        // Open dirty file defined by globalMocks.mockTextDocumentDirty, with filepath including "sestest/test/node"
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        const testUSSDir = new ZoweUSSNode({
            label: "test",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: globalMocks.testUSSNode,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            parentPath: "/",
        });
        Object.defineProperty(testUSSDir, "getUSSDocumentFilePath", {
            value: jest.fn(() => {
                return "/test/path/temp/_U_/sestest/test";
            }),
        });
        const vscodeErrorMsgSpy = jest.spyOn(vscode.window, "showErrorMessage");
        const getAllLoadedItemsSpy = jest.spyOn(globalMocks.testTree, "getAllLoadedItems");

        await globalMocks.testTree.rename(testUSSDir);

        expect(vscodeErrorMsgSpy.mock.calls.length).toBe(1);
        expect(vscodeErrorMsgSpy.mock.calls[0][0]).toContain("because you have unsaved changes in this");
        expect(getAllLoadedItemsSpy.mock.calls.length).toBe(0);
    });

    it("Tests that USSTree.rename() shows no error if an open clean file's fullpath includes that of the node being renamed", async () => {
        // Open clean file defined by globalMocks.mockTextDocumentClean, with filepath including "sestest/test2/node"
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        const testUSSDir = new ZoweUSSNode({
            label: "testClean", // This name intentionally contains the mock dirty document path as a substring to test for false positives
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: globalMocks.testUSSNode,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            parentPath: "/",
        });
        Object.defineProperty(testUSSDir, "getUSSDocumentFilePath", {
            value: jest.fn(() => {
                return "/test/path/temp/_U_/sestest/testClean";
            }),
        });
        const vscodeErrorMsgSpy = jest.spyOn(vscode.window, "showErrorMessage");

        await globalMocks.testTree.rename(testUSSDir);

        expect(vscodeErrorMsgSpy.mock.calls.length).toBe(0);
    });

    it("Tests that USSTree.rename() is executed successfully for non-favorited node that is also in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const ussFavNode = blockMocks.ussFavNode;
        globalMocks.testUSSNode.fullPath = globalMocks.testUSSNode.fullPath + "/usstest";
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const renameNode = jest.spyOn(globalMocks.testUSSNode, "rename");
        const renameFavoriteSpy = jest.spyOn(globalMocks.testTree, "renameFavorite");
        renameNode.mockResolvedValue(false);
        globalMocks.showInputBox.mockReturnValueOnce("new name");
        Object.defineProperty(globalMocks.testTree, "findFavoritedNode", {
            value: jest.fn(() => {
                return ussFavNode;
            }),
        });

        await globalMocks.testTree.rename(globalMocks.testUSSNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(renameFavoriteSpy).toHaveBeenCalledTimes(1);
    });

    it("Tests that USSTree.rename() is executed successfully for non-favorited node with no Favorite equivalent", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        globalMocks.testTree.mFavorites = [];
        globalMocks.testUSSNode.fullPath = globalMocks.testUSSNode.fullPath + "/usstest";
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const renameUSSNodeSpy = jest.spyOn(globalMocks.testTree, "renameUSSNode");
        const renameFavoriteSpy = jest.spyOn(globalMocks.testTree, "renameFavorite");
        const renameNode = jest.spyOn(globalMocks.testUSSNode, "rename");
        renameNode.mockResolvedValue(false);

        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(globalMocks.testUSSNode);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(renameUSSNodeSpy).toHaveBeenCalledTimes(0);
        expect(renameFavoriteSpy).toHaveBeenCalledTimes(0);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const renameUSSNodeSpy = jest.spyOn(globalMocks.testTree, "renameUSSNode");
        const renameFavoriteSpy = jest.spyOn(globalMocks.testTree, "renameFavorite");

        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(blockMocks.ussFavNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(renameUSSNodeSpy.mock.calls.length).toBe(1);
        expect(renameFavoriteSpy.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file, when tree is not expanded", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const renameUSSNode = jest.spyOn(globalMocks.testTree, "renameUSSNode");
        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(blockMocks.ussFavNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(renameUSSNode.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        const refreshSpy = jest.spyOn(globalMocks.testTree, "refreshElement");
        globalMocks.showInputBox.mockReturnValueOnce("");

        await globalMocks.testTree.rename(globalMocks.testUSSNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        globalMocks.showInputBox.mockReturnValueOnce("new name");
        globalMocks.renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await globalMocks.testTree.rename(globalMocks.testUSSNode);
        } catch (err) {
            // Prevent exception from failing test
        }
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Function addFavorite", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            childFile: null,
            parentDir: new ZoweUSSNode({
                label: "parent",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testTree.mSessionNodes[1],
                parentPath: "/",
            }),
        };
        newMocks.childFile = new ZoweUSSNode({
            label: "child",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: newMocks.parentDir,
            parentPath: "/parent",
        });
        newMocks.childFile.contextValue = globals.USS_TEXT_FILE_CONTEXT;
        globalMocks.testTree.mFavorites = [];

        return newMocks;
    }

    it("Tests that addFavorite() works for directories", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await globalMocks.testTree.addFavorite(blockMocks.parentDir);
        const favProfileNode = globalMocks.testTree.mFavorites[0];

        expect(favProfileNode.children[0].fullPath).toEqual(blockMocks.parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await globalMocks.testTree.addFavorite(blockMocks.childFile);
        const favProfileNode = globalMocks.testTree.mFavorites[0];

        expect(favProfileNode.children[0].fullPath).toEqual(blockMocks.childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await globalMocks.testTree.addFavorite(blockMocks.parentDir);
        await globalMocks.testTree.addFavorite(blockMocks.parentDir);
        expect(globalMocks.testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function openItemFromPath", () => {
    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const globalMocks = await createGlobalMocks();

        const file = new ZoweUSSNode({
            label: "c.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
            parentPath: "/a/b",
        });
        jest.spyOn(globalMocks.testTree.mSessionNodes[1], "getChildren").mockResolvedValue([file]);
        const openNodeSpy = jest.spyOn(file, "openUSS").mockImplementation();

        await globalMocks.testTree.openItemFromPath("/a/b/c.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(openNodeSpy).toHaveBeenCalledWith(false, true, globalMocks.testTree);
        expect(globalMocks.testTree.getSearchHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(globalMocks.testTree.mSessionNodes[1], "getChildren").mockResolvedValue([]);
        const fileHistorySpy = jest.spyOn(globalMocks.testTree, "removeFileHistory");

        await globalMocks.testTree.openItemFromPath("/d.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(fileHistorySpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function addSingleSession", () => {
    it("Tests if addSingleSession uses the baseProfile to get the combined profile information", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.mSessionNodes.pop();
        globalMocks.testSession.ISession.tokenType = globalMocks.testBaseProfile.profile.tokenType;
        globalMocks.testSession.ISession.tokenValue = globalMocks.testBaseProfile.profile.tokenValue;

        // Mock the USS API so that getSession returns the correct value
        const mockUssApi = ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(globalMocks.testSession);

        await globalMocks.testTree.addSingleSession(globalMocks.testProfile);

        expect(globalMocks.testTree.mSessionNodes[1].session.ISession.tokenValue).toEqual("testTokenValue");
    });

    it("Tests that addSingleSession doesn't add the session again, if it was already added", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testTree.addSingleSession(globalMocks.testProfile);

        expect(globalMocks.testTree.mSessionNodes.length).toEqual(2);
    });

    it("Tests that addSingleSession successfully adds a session", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.mSessionNodes.pop();
        globalMocks.testSession.ISession.tokenType = globalMocks.testBaseProfile.profile.tokenType;
        globalMocks.testSession.ISession.tokenValue = globalMocks.testBaseProfile.profile.tokenValue;

        // Mock the USS API so that getSession returns the correct value
        const mockUssApi = ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(globalMocks.testSession);

        await globalMocks.testTree.addSingleSession(globalMocks.testProfile);

        expect(globalMocks.testTree.mSessionNodes.length).toEqual(2);
        expect(globalMocks.testTree.mSessionNodes[1].profile.name).toEqual(globalMocks.testProfile.name);
    });
});

describe("USSTree Unit Tests - Function getChildren", () => {
    it("Tests that getChildren() returns valid list of elements", async () => {
        const globalMocks = await createGlobalMocks();

        const rootChildren = await globalMocks.testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode({ label: "Favorites", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed }),
            new ZoweUSSNode({
                label: "sestest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: globalMocks.testSession,
                profile: globalMocks.testProfile,
                parentPath: "/",
            }),
        ];
        sessNode[0].contextValue = globals.FAVORITE_CONTEXT;
        sessNode[1].contextValue = globals.USS_SESSION_CONTEXT;
        sessNode[1].fullPath = "test";

        // Set icon
        let targetIcon = getIconByNode(sessNode[0]);
        if (targetIcon) {
            sessNode[0].iconPath = targetIcon.path;
        }
        targetIcon = getIconByNode(sessNode[1]);
        if (targetIcon) {
            sessNode[1].iconPath = targetIcon.path;
        }

        expect(sessNode).toEqual(rootChildren);
        expect(JSON.stringify(sessNode[0].iconPath)).toContain("folder-root-favorite-star-closed.svg");
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<session>", async () => {
        const globalMocks = await createGlobalMocks();

        const testDir = new ZoweUSSNode({
            label: "aDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
        });
        globalMocks.testTree.mSessionNodes[1].children.push(testDir);
        const mockApiResponseItems = {
            items: [
                {
                    mode: "d",
                    mSessionName: "sestest",
                    name: "aDir",
                },
            ],
        };
        const mockApiResponseWithItems = createFileResponse(mockApiResponseItems);
        globalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);
        const sessChildren = await globalMocks.testTree.getChildren(globalMocks.testTree.mSessionNodes[1]);
        const sampleChildren: ZoweUSSNode[] = [testDir];

        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<favorite>", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.mFavorites.push(
            new ZoweUSSNode({
                label: "/u/myUser",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: globalMocks.testTree.mSessionNodes[0],
            })
        );
        const favChildren = await globalMocks.testTree.getChildren(globalMocks.testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode({
                label: "/u/myUser",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: globalMocks.testTree.mSessionNodes[0],
            }),
        ];

        expect(favChildren).toEqual(sampleChildren);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<directory>", async () => {
        const globalMocks = await createGlobalMocks();

        const directory = new ZoweUSSNode({
            label: "/u",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mSessionNodes[1],
        });
        const file = new ZoweUSSNode({ label: "myFile.txt", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: directory });
        const sampleChildren: ZoweUSSNode[] = [file];
        sampleChildren[0].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[0]] };
        directory.children.push(file);
        directory.dirty = true;
        const mockApiResponseItems = {
            items: [
                {
                    mode: "f",
                    mSessionName: "sestest",
                    name: "myFile.txt",
                },
            ],
        };
        const mockApiResponseWithItems = createFileResponse(mockApiResponseItems);
        globalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);

        jest.spyOn(zowe.List, "fileList").mockResolvedValueOnce({
            success: true,
            apiResponse: {
                items: [
                    {
                        name: "myFile.txt",
                        mode: "-rw-r--r--",
                        size: 20,
                        uid: 0,
                        user: "WSADMIN",
                        gid: 1,
                        group: "OMVSGRP",
                        mtime: "2015-11-24T02:12:04",
                    },
                ],
                returnedRows: 1,
                totalRows: 1,
                JSONversion: 1,
            },
            commandResponse: undefined as any,
        });

        const dirChildren = await globalMocks.testTree.getChildren(directory);
        expect(dirChildren[0].label).toEqual(sampleChildren[0].label);
    });
    it("Testing that getChildren() gets profile-loaded favorites for profile node in Favorites section", async () => {
        const globalMocks = await createGlobalMocks();
        const log = zowe.imperative.Logger.getAppLogger();
        const favProfileNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testTree.mFavoriteSession,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy = jest.spyOn(globalMocks.testTree, "loadProfilesForFavorites");

        await globalMocks.testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
});

describe("USSTree Unit Tests - Function loadProfilesForFavorites", () => {
    function createBlockMocks(globalMocks) {
        const log = zowe.imperative.Logger.getAppLogger();
        const ussApi = createUssApi(globalMocks.testProfile);
        bindUssApi(ussApi);

        return {
            log,
            ussApi,
        };
    }

    it("Tests that loaded profile and session values are added to the profile grouping node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
        });
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });

        // Mock successful loading of profile/session
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        return globalMocks.testProfile;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    validProfile: ValidProfileEnum.VALID,
                };
            }),
            configurable: true,
        });
        Object.defineProperty(blockMocks.ussApi, "getSession", {
            value: jest.fn(() => {
                return globalMocks.testSession;
            }),
        });

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavProfileNode = globalMocks.testTree.mFavorites[0];

        expect(resultFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Tests that error is handled if profile not successfully loaded for profile grouping node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode({
            label: "badTestProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
        });
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        throw new Error();
                    }),
                };
            }),
            configurable: true,
        });
        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Remove" });
        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        expect(showErrorMessageSpy).toBeCalledTimes(1);
        showErrorMessageSpy.mockClear();
    });
    it("Tests that favorite nodes with pre-existing profile/session values continue using those values", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        const favDirNode = new ZoweUSSNode({
            label: "favDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode({
            label: "favDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
    it("Tests that loaded profile/session from profile node in Favorites gets passed to child favorites without profile/session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testTree.mFavoriteSession,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        // Leave mParent parameter undefined for favDirNode and expectedFavDirNode to test undefined profile/session condition
        const favDirNode = new ZoweUSSNode({
            label: "favDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            profile: globalMocks.testProfile,
        });
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode({
            label: "favDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
});

describe("USSTree Unit Tests - Function editSession", () => {
    const profileLoad: zowe.imperative.IProfileLoaded = {
        name: "fake",
        profile: {
            host: "fake",
            port: 999,
            user: "fake",
            password: "fake",
            rejectUnauthorize: false,
        },
        type: "zosmf",
        failNotFound: true,
        message: "fake",
    };
    const profilesForValidation = { status: "active", name: "fake" };

    it("Test the editSession command", async () => {
        const globalMocks = await createGlobalMocks();
        const testSessionNode = new ZoweUSSNode({
            label: "testSessionNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        const checkSession = jest.spyOn(globalMocks.testTree, "editSession");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    editSession: jest.fn(() => {
                        return profileLoad;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            }),
            configurable: true,
        });
        globalMocks.testTree.editSession(testSessionNode);
        expect(checkSession).toHaveBeenCalled();
    });

    it("Test the editSession command with inactive profiles", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode({
            label: "testSessionNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
        });
        const checkSession = jest.spyOn(globalMocks.testTree, "editSession");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    editSession: jest.fn(() => {
                        return profileLoad;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return { status: "inactive", name: globalMocks.testProfile.name };
                    }),
                    profilesForValidation: [{ status: "inactive", name: globalMocks.testProfile.name }],
                    validateProfiles: jest.fn(),
                };
            }),
            configurable: true,
        });
        globalMocks.testTree.editSession(testSessionNode);
        expect(checkSession).toHaveBeenCalled();
    });

    describe("removeSearchHistory", () => {
        it("removes the search item passed in from the current history", async () => {
            const globalMocks = await createGlobalMocks();
            expect(globalMocks.testTree["mHistory"]["mSearchHistory"].length).toEqual(3);
            globalMocks.testTree.removeSearchHistory("/u/myuser");
            expect(globalMocks.testTree["mHistory"]["mSearchHistory"].length).toEqual(2);
        });
    });

    describe("resetSearchHistory", () => {
        it("clears the entire search history", async () => {
            const globalMocks = await createGlobalMocks();
            expect(globalMocks.testTree["mHistory"]["mSearchHistory"].length).toEqual(3);
            globalMocks.testTree.resetSearchHistory();
            expect(globalMocks.testTree["mHistory"]["mSearchHistory"].length).toEqual(0);
        });
    });

    describe("resetFileHistory", () => {
        it("clears the entire file history", async () => {
            const globalMocks = await createGlobalMocks();
            expect(globalMocks.testTree["mHistory"]["mFileHistory"].length).toEqual(2);
            globalMocks.testTree.resetFileHistory();
            expect(globalMocks.testTree["mHistory"]["mFileHistory"].length).toEqual(0);
        });
    });

    describe("getSessions", () => {
        it("gets all the available sessions from persistent object", async () => {
            const globalMocks = await createGlobalMocks();
            globalMocks.testTree["mHistory"]["mSessions"] = ["sestest"];
            expect(globalMocks.testTree.getSessions()).toEqual(["sestest"]);
        });
    });

    describe("getFavorites", () => {
        it("gets all the favorites from persistent object", async () => {
            const globalMocks = await createGlobalMocks();
            jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: () => ["test1", "test2", "test3"],
            } as any);
            expect(globalMocks.testTree.getFavorites()).toEqual(["test1", "test2", "test3"]);
        });
    });

    describe("onDidCloseTextDocument", () => {
        it("sets the entry in openFiles record to null if USS URI is valid", async () => {
            const globalMocks = await createGlobalMocks();
            const tree = globalMocks.testTree as unknown as any;
            Object.defineProperty(vscode.workspace, "textDocuments", {
                value: [],
                configurable: true,
            });
            Object.defineProperty(globals, "USS_DIR", {
                value: join("some", "fspath", "_U_"),
            });
            const doc = {
                isClosed: true,
                isDirty: false,
                uri: { scheme: "file", fsPath: join(globals.USS_DIR, "lpar", "someFile.txt") },
            } as vscode.TextDocument;

            jest.spyOn(TreeProviders, "uss", "get").mockReturnValue(tree);
            await USSTree.onDidCloseTextDocument(doc);
            expect(tree.openFiles[doc.uri.fsPath]).toBeNull();
        });
    });
});

describe("USSTree Unit Tests - Function openWithEncoding", () => {
    beforeEach(() => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            getTag: jest.fn(),
        } as any);
    });

    it("sets binary encoding if selection was made", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openUSS = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "binary" });
        await USSTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(true);
        expect(node.encoding).toBeUndefined();
        expect(node.openUSS).toHaveBeenCalledTimes(1);
    });

    it("sets text encoding if selection was made", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openUSS = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        await USSTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeNull();
        expect(node.openUSS).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if prompt was cancelled", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openUSS = jest.fn();
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce(undefined);
        await USSTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeUndefined();
        expect(node.openUSS).toHaveBeenCalledTimes(0);
    });

    it("presents a confirmation dialog to the user when the file is unsaved", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.openUSS = jest.fn();
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
        await USSTree.prototype.openWithEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBe(null);
        expect(node.openUSS).toHaveBeenCalledTimes(1);
        expect(executeCommandSpy).toHaveBeenCalledWith("workbench.action.files.revert");

        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            getTag: jest.fn(),
        } as any);

        // case 2: user cancels encoding change
        (node.openUSS as any).mockClear();
        executeCommandSpy.mockClear();
        jest.spyOn(sharedUtils, "confirmForUnsavedDoc").mockResolvedValueOnce({
            actionConfirmed: false,
            isUnsaved: true,
            editor,
        });
        jest.spyOn(sharedUtils, "promptForEncoding").mockResolvedValueOnce({ kind: "text" });
        await USSTree.prototype.openWithEncoding(node);
        expect(node.openUSS).not.toHaveBeenCalled();
        expect(executeCommandSpy).not.toHaveBeenCalledWith("workbench.action.files.revert");
    });
});
