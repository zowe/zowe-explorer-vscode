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
} from "../../../__mocks__/mockCreators/shared";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { createUSSNode, createFavoriteUSSNode, createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { getIconByNode } from "../../../src/generators/icons";
import * as workspaceUtils from "../../../src/utils/workspace";
import { createUssApi, bindUssApi } from "../../../__mocks__/mockCreators/api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

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
        createTreeView: jest.fn(),
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

    return globalMocks;
}

describe("USSTree Unit Tests - Function USSTree.initializeFavorites()", () => {
    it("Tests that initializeFavorites() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const testTree1 = await createUSSTree(zowe.imperative.Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(1);
        expect(favProfileNode.children.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, globalMocks.testSession, "", false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, globalMocks.testSession, "", false, "test"),
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

describe("USSTree Unit Tests - Function initializeFavChildNodeForProfile()", () => {
    it("Tests initializeFavChildNodeForProfile() for favorited search", async () => {
        await createGlobalMocks();
        const testTree1 = await createUSSTree(zowe.imperative.Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        const label = "/u/fakeuser";
        const line = "[test]: /u/fakeuser{ussSession}";
        const expectedFavSearchNode = new ZoweUSSNode("/u/fakeuser", vscode.TreeItemCollapsibleState.None, favProfileNode, null, null, false, null);
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

describe("USSTree Unit Tests - Function USSTree.createProfileNodeForFavs()", () => {
    it("Tests that profile grouping node is created correctly", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedFavProfileNode = new ZoweUSSNode(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            null,
            undefined,
            undefined
        );
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        const createdFavProfileNode = await globalMocks.testTree.createProfileNodeForFavs("testProfile");

        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Tests that profile grouping node is created correctly if icon is defined", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedFavProfileNode = new ZoweUSSNode(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            null,
            undefined,
            undefined
        );
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

describe("USSTree Unit Tests - Function USSTree.checkDuplicateLabel()", () => {
    it("Tests that checkDuplicateLabel() returns null if passed a unique name", async () => {
        const globalMocks = await createGlobalMocks();

        const returnVal = globalMocks.testTree.checkDuplicateLabel("totallyNewLabel", [globalMocks.testUSSNode]);
        expect(returnVal).toEqual(null);
    });
    it("Tests that checkDuplicateLabel() returns an error message if passed a name that's already used for an existing folder", async () => {
        const globalMocks = await createGlobalMocks();

        const returnVal = globalMocks.testTree.checkDuplicateLabel("/u/myuser/usstest", [globalMocks.testUSSNode]);
        expect(returnVal).toEqual("A folder already exists with this name. Please choose a different name.");
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFileHistory() & USSTree.getFileHistory()", () => {
    it("Tests that addFileHistory() & getFileHistory() are executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.addFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory()[0]).toEqual("TESTHISTORY");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeFileHistory()", () => {
    it("Tests that removeFileHistory() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.removeFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory().includes("TESTHISTORY")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            childFile: null,
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
        };
        newMocks.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newMocks.parentDir, null, "/parent");
        newMocks.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
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

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
        };
        await globalMocks.testTree.addFavorite(newMocks.testDir);
        const favProfileNode = globalMocks.testTree.mFavorites[0];
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        favProfileNode.mProfileName = globalMocks.testProfile.name;

        return newMocks;
    }

    it("Tests that removeFavorite() works properly when starting with more than one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const removeFavProfileSpy = jest.spyOn(globalMocks.testTree, "removeFavProfile");
        const profileNodeInFavs = globalMocks.testTree.mFavorites[0];

        // Add second favorite
        const testDir2 = new ZoweUSSNode("testDir2", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/");
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

describe("USSTree Unit Tests - Function USSTree.removeFavProfile", () => {
    async function createBlockMocks(globalMocks) {
        globalMocks.testTree.mFavorites = [];
        const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/");
        await globalMocks.testTree.addFavorite(testDir);
        const profileNodeInFavs: IZoweUSSTreeNode = globalMocks.testTree.mFavorites[0];
        profileNodeInFavs.mProfileName = globalMocks.testProfile.name;

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

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);

        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.None, globalMocks.testTree.mSessionNodes[1], null, "/a/b");
        globalMocks.testTree.mSessionNodes[1].children.push(file);
        Object.defineProperty(globalMocks.testTree.mSessionNodes[1], "getChildren", {
            value: jest.fn(() => {
                return Promise.resolve([file]);
            }),
        });

        await globalMocks.testTree.openItemFromPath("/a/b/c.txt", globalMocks.testTree.mSessionNodes[1]);

        expect(globalMocks.testTree.getSearchHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);

        jest.spyOn(globalMocks.testTree, "getChildren").mockReturnValue(Promise.resolve([]));
        const fileHistorySpy = jest.spyOn(globalMocks.testTree, "removeFileHistory");

        await globalMocks.testTree.openItemFromPath("/d.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(fileHistorySpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    it("Tests if addSession works properly", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.testSession, null);
        globalMocks.testTree.mSessionNodes.push(testSessionNode);
        globalMocks.testTree.addSession("testSessionNode");

        const foundNode = globalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testTree2: new USSTree(),
            testSessionNode: new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.testSession, null),
            startLength: null,
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

        blockMocks.testTree2.deleteSession(blockMocks.testTree2.mSessionNodes[blockMocks.startLength - 1]);
        expect(blockMocks.testTree2.mSessionNodes.length).toEqual(blockMocks.startLength - 1);
    });
});

describe("USSTree Unit Tests - Function USSTree.filterPrompt()", () => {
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

    it("Tests that filter() works properly when user enters path", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpValue = "/U/HARRY";
        globalMocks.showInputBox.mockReturnValueOnce("/U/HARRY");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("Tests that filter() makes the call to get the combined session information", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.qpValue = "/U/HLQ";
        globalMocks.showInputBox.mockReturnValueOnce("/U/HLQ");
        const syncSessionNodeSpy = jest.spyOn(utils, "syncSessionNode");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);

        expect(syncSessionNodeSpy).toBeCalledTimes(1);
    });

    it("Tests that filter() works properly when user enters path with Unverified profile", async () => {
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

    it("Tests that filter() exits when user cancels out of input field", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works on a file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpValue = "/U/HLQ/STUFF";
        blockMocks.qpItem = new utils.FilterDescriptor("/U/HLQ/STUFF");
        globalMocks.showInputBox.mockReturnValueOnce("/U/HLQ/STUFF");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HLQ/STUFF");
    });

    it("Tests that filter() exits when user cancels the input path box", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpItem = undefined;

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made. Operation cancelled.");
    });

    it("Tests that filter() works when new path is specified (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpValue = "/u/myFiles";
        globalMocks.showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        globalMocks.showInputBox.mockReturnValueOnce("/u/myFiles");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");
    });

    it("Tests that filter() exits when user cancels the input path box (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.showQuickPick.mockReturnValueOnce("\uFF0B " + "Create a new filter");
        globalMocks.showInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works with a file (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpValue = "/u/thisFile";
        globalMocks.showQuickPick.mockReturnValueOnce(new utils.FilterDescriptor("/u/thisFile"));
        globalMocks.showInputBox.mockReturnValueOnce("/u/thisFile");

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");
    });

    it("Tests that filter() exits when no selection made (Theia)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.showQuickPick.mockReturnValueOnce(undefined);

        await globalMocks.testTree.filterPrompt(globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made. Operation cancelled.");
    });

    it("Tests that filter() works correctly for favorited search nodes with credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const sessionWithCred = createISession();
        globalMocks.createSessCfgFromArgs.mockReturnValue(sessionWithCred);
        const dsNode = new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionWithCred, null, false, "ussTestSess2");
        dsNode.mProfileName = "ussTestSess2";
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        globalMocks.testTree.mSessionNodes.push(dsNode);

        await globalMocks.testTree.filterPrompt(dsNode);
        globalMocks.testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) {
                expect(sessionNode.fullPath).toEqual("/u/myFile.txt");
            }
        });
    });

    it("Tests that filter() works correctly for favorited search nodes without credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const sessionNoCred = createISessionWithoutCredentials();
        globalMocks.createSessCfgFromArgs.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionNoCred, null, false, "ussTestSess2");
        dsNode.mProfileName = "ussTestSess2";
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

describe("USSTree Unit Tests - Function USSTree.getAllLoadedItems()", () => {
    it("Testing that getAllLoadedItems() returns the correct array", async () => {
        const globalMocks = await createGlobalMocks();

        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
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
    const ussFavNodeParent = new ZoweUSSNode(
        "sestest",
        vscode.TreeItemCollapsibleState.Expanded,
        null,
        globalMocks.testSession,
        null,
        false,
        globalMocks.testProfile.name
    );
    ussFavNodeParent.children.push(ussFavNode);
    globalMocks.testTree.mFavorites.push(ussFavNodeParent);

    return ussFavNode;
};

describe("USSTree Unit Tests - Function USSTree.findFavoritedNode()", () => {
    it("Testing that findFavoritedNode() returns the favorite of a non-favorited node", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testUSSNode.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        const ussFavNode = setupUssFavNode(globalMocks);

        const foundNode = await globalMocks.testTree.findFavoritedNode(globalMocks.testUSSNode);

        expect(foundNode).toStrictEqual(ussFavNode);
    });
    it("Tests that findFavoritedNode() does not error when there is no favorite or matching profile node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const node = createUSSNode(globalMocks.testSession, globalMocks.testProfile);

        expect(() => {
            globalMocks.testTree.findFavoritedNode(node);
        }).not.toThrow();
    });
});

describe("USSTree Unit Tests - Function USSTree.findNonFavoritedNode()", () => {
    it("Testing that findNonFavoritedNode() returns the non-favorite from a favorite node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = setupUssFavNode(globalMocks);

        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const nonFaveNode = await globalMocks.testTree.findNonFavoritedNode(ussFavNode);
        expect(nonFaveNode).toStrictEqual(globalMocks.testUSSNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.findEquivalentNode()", () => {
    it("Testing that findEquivalentNode() returns the corresponding node for a favorite node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = setupUssFavNode(globalMocks);

        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const nonFaveNode = await globalMocks.testTree.findEquivalentNode(ussFavNode, true);
        expect(nonFaveNode).toStrictEqual(globalMocks.testUSSNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.findMatchInLoadedChildren()", () => {
    it("Testing that findMatchInLoadedChildren() can find a nested child node by fullPath", async () => {
        const globalMocks = await createGlobalMocks();
        const sessionNode = globalMocks.testTree.mSessionNodes[1];
        const ussChild = new ZoweUSSNode(
            "ussChild",
            vscode.TreeItemCollapsibleState.Expanded,
            globalMocks.testUSSNode,
            globalMocks.testSession,
            globalMocks.testUSSNode.fullPath,
            false,
            globalMocks.testProfile.name
        );
        globalMocks.testUSSNode.children.push(ussChild);
        sessionNode.children.push(globalMocks.testUSSNode);

        const matchingNode = await globalMocks.testTree.findMatchInLoadedChildren(sessionNode, ussChild.fullPath);
        expect(matchingNode).toStrictEqual(ussChild);
    });
});

describe("USSTree Unit Tests - Function USSTree.renameUSSNode()", () => {
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

describe("USSTree Unit Tests - Function USSTree.renameFavorite()", () => {
    it("Checking common run of function", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            globalMocks.testSession,
            null,
            false,
            globalMocks.testProfile.name
        );
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);
        const renameSpy = jest.spyOn(ussFavNode, "rename");

        await globalMocks.testTree.renameFavorite(ussFavNode, "/u/myuser/renamed");

        expect(renameSpy).toBeCalledTimes(1);
        expect(renameSpy).toBeCalledWith("/u/myuser/renamed");
    });
});

describe("USSTree Unit Tests - Function USSTree.saveSearch()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            folder: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
            file: null,
            resolveQuickPickHelper: jest.spyOn(Gui, "resolveQuickPick"),
        };
        globalMocks.testTree.mFavorites = [];
        newMocks.file = new ZoweUSSNode("abcd", vscode.TreeItemCollapsibleState.None, newMocks.folder, null, "/parent");
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

describe("USSTree Unit Tests - Function USSTree.rename()", () => {
    function createBlockMocks(globalMocks) {
        globalMocks.testUSSNode.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Expanded,
            null,
            globalMocks.testSession,
            null,
            false,
            globalMocks.testProfile.name
        );
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
        const testUSSDir = new ZoweUSSNode(
            "test",
            vscode.TreeItemCollapsibleState.Expanded,
            globalMocks.testUSSNode,
            globalMocks.testSession,
            "/",
            false,
            globalMocks.testProfile.name
        );
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
        const testUSSDir = new ZoweUSSNode(
            "testClean", // This name intentionally contains the mock dirty document path as a substring to test for false positives
            vscode.TreeItemCollapsibleState.Expanded,
            globalMocks.testUSSNode,
            globalMocks.testSession,
            "/",
            false,
            globalMocks.testProfile.name
        );
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

describe("USSTree Unit Tests - Functions USSTree.addFileHistory() & USSTree.getFileHistory()", () => {
    it("Tests that addFileHistory() & getFileHistory() are executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.addFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory()[0]).toEqual("TESTHISTORY");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeFileHistory()", () => {
    it("Tests that removeFileHistory() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.removeFileHistory("testHistory");
        expect(globalMocks.testTree.getFileHistory().includes("TESTHISTORY")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
            childFile: null,
        };
        newMocks.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newMocks.parentDir, null, "/parent");
        newMocks.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
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

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
        };
        globalMocks.testTree.mFavorites = [];
        await globalMocks.testTree.addFavorite(newMocks.testDir);
        const favProfileNode = globalMocks.testTree.mFavorites[0];
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        favProfileNode.mProfileName = globalMocks.testProfile.name;

        return newMocks;
    }

    it("Tests that removeFavorite() works properly", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const favProfileNode = globalMocks.testTree.mFavorites[0];

        // Checking that favorites are set successfully before test
        expect(favProfileNode.children[0].fullPath).toEqual(blockMocks.testDir.fullPath);

        await globalMocks.testTree.removeFavorite(blockMocks.testDir);

        expect(favProfileNode.children).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const globalMocks = await createGlobalMocks();

        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[0], null, "/a/b");
        jest.spyOn(globalMocks.testTree, "getChildren").mockReturnValue(Promise.resolve([file]));

        await globalMocks.testTree.openItemFromPath("/a/b/c.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.getSearchHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(globalMocks.testTree, "getChildren").mockReturnValue(Promise.resolve([]));
        const fileHistorySpy = jest.spyOn(globalMocks.testTree, "removeFileHistory");

        await globalMocks.testTree.openItemFromPath("/d.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(fileHistorySpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    it("Tests if addSession works properly", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.testSession, null);
        globalMocks.testTree.mSessionNodes.push(testSessionNode);
        globalMocks.testTree.addSession("testSessionNode");

        const foundNode = globalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.addSingleSession()", () => {
    it("Tests if addSingleSession uses the baseProfile to get the combined profile information", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.mSessionNodes.pop();
        globalMocks.testSession.ISession.tokenType = globalMocks.testBaseProfile.profile.tokenType;
        globalMocks.testSession.ISession.tokenValue = globalMocks.testBaseProfile.profile.tokenValue;

        // Mock the USS API so that getSession returns the correct value
        const mockUssApi = await ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
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
        const mockUssApi = await ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(globalMocks.testSession);

        await globalMocks.testTree.addSingleSession(globalMocks.testProfile);

        expect(globalMocks.testTree.mSessionNodes.length).toEqual(2);
        expect(globalMocks.testTree.mSessionNodes[1].profile.name).toEqual(globalMocks.testProfile.name);
    });
});

describe("USSTree Unit Tests - Function USSTree.getChildren()", () => {
    it("Tests that getChildren() returns valid list of elements", async () => {
        const globalMocks = await createGlobalMocks();

        const rootChildren = await globalMocks.testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, false),
            new ZoweUSSNode(
                "sestest",
                vscode.TreeItemCollapsibleState.Collapsed,
                null,
                globalMocks.testSession,
                "/",
                false,
                globalMocks.testProfile.name
            ),
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

        const testDir = new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "test");
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
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, globalMocks.testTree.mSessionNodes[0], null, null)
        );
        const favChildren = await globalMocks.testTree.getChildren(globalMocks.testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, globalMocks.testTree.mSessionNodes[0], null, null),
        ];

        expect(favChildren).toEqual(sampleChildren);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<directory>", async () => {
        const globalMocks = await createGlobalMocks();

        const directory = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, null);
        const file = new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, directory, null, null);
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
        const favProfileNode = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            null,
            undefined,
            undefined
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy = jest.spyOn(globalMocks.testTree, "loadProfilesForFavorites");

        await globalMocks.testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
});
// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("USSTree Unit Tests - Function USSTree.loadProfilesForFavorites", () => {
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
        const favProfileNode = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            null,
            null,
            false,
            undefined,
            undefined,
            undefined
        );
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            globalMocks.testSession,
            null,
            false,
            "sestest",
            undefined,
            globalMocks.testProfile
        );

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
        const favProfileNode = new ZoweUSSNode(
            "badTestProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            null,
            null,
            false,
            undefined,
            undefined,
            undefined
        );
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
        const favProfileNode = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            globalMocks.testSession,
            null,
            false,
            "sestest",
            undefined,
            globalMocks.testProfile
        );
        const favDirNode = new ZoweUSSNode(
            "favDir",
            vscode.TreeItemCollapsibleState.Collapsed,
            favProfileNode,
            globalMocks.testSession,
            "",
            false,
            "sestest",
            null,
            globalMocks.testProfile
        );
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode(
            "favDir",
            vscode.TreeItemCollapsibleState.Collapsed,
            favProfileNode,
            globalMocks.testSession,
            "",
            false,
            "sestest",
            null,
            globalMocks.testProfile
        );

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
    it("Tests that loaded profile/session from profile node in Favorites gets passed to child favorites without profile/session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession,
            globalMocks.testSession,
            null,
            false,
            "sestest",
            undefined,
            globalMocks.testProfile
        );
        // Leave mParent parameter undefined for favDirNode and expectedFavDirNode to test undefined profile/session condition
        const favDirNode = new ZoweUSSNode(
            "favDir",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            null,
            "",
            false,
            "sestest",
            null,
            globalMocks.testProfile
        );
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode(
            "favDir",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.testSession,
            "",
            false,
            "sestest",
            null,
            globalMocks.testProfile
        );

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.editSession()", () => {
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
    /*************************************************************************************************************
     * Test the editSession command
     *************************************************************************************************************/
    it("Test the editSession command ", async () => {
        const globalMocks = await createGlobalMocks();
        const testSessionNode = new ZoweUSSNode(
            "testSessionNode",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.testSession,
            null,
            false,
            globalMocks.testProfile.name
        );
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

    /*************************************************************************************************************
     * Test the editSession command with inactive profiles
     *************************************************************************************************************/
    it("Test the editSession command ", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode(
            "testSessionNode",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.testSession,
            null,
            false,
            globalMocks.testProfile.name
        );
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
});
