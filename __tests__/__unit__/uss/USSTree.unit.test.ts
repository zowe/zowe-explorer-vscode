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

import { ValidProfileEnum, Profiles } from "../../../src/Profiles";
import { createUSSTree, USSTree } from "../../../src/uss/USSTree";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { Logger, IProfileLoaded } from "@zowe/imperative";
import * as utils from "../../../src/utils";
import {
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createFileResponse, createInstanceOfProfile, createValidIProfile
} from "../../../__mocks__/mockCreators/shared";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as profileUtils from "../../../src/profiles/utils";
import * as sharedActions from "../../../src/shared/actions";
import { createUSSNode, createFavoriteUSSNode, createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { getIconByNode } from "../../../src/generators/icons";
import * as workspaceUtils from "../../../src/utils/workspace";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { createUssApi, bindUssApi } from "../../../__mocks__/mockCreators/api";

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockDefaultProfile: jest.fn(),
        executeCommand: jest.fn(),
        Utilities: jest.fn(),
        showQuickPick: jest.fn(),
        renameUSSFile: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showInputBox: jest.fn(),
        filters: jest.fn(),
        getFilters: jest.fn(),
        createTreeView: jest.fn(),
        createQuickPick: jest.fn(),
        getConfiguration: jest.fn(),
        mockResetValidationSettings: jest.fn(),
        ZosmfSession: jest.fn(),
        mockCreateBasicZosmfSessionFromArguments: jest.fn(),
        mockValidationSetting: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        mockCheckCurrentProfile: jest.fn(),
        withProgress: jest.fn(),
        closeOpenedTextFile: jest.fn(),
        defaultProfileManagerInstance: null,
        defaultProfile: null,
        mockGetValidSession: jest.fn(),
        mockGetUssApi: jest.fn(),
        ussApi: null,
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        testProfile: createIProfile(),
        testSession: createISession(),
        testResponse: createFileResponse({ items: [] }),
        testUSSNode: null,
        testTree: null,
        profilesForValidation: null
    };

    Object.defineProperty(workspaceUtils, "closeOpenedTextFile", {
        value: globalMocks.closeOpenedTextFile,
        configurable: true
    });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(sharedActions, "resetValidationSettings", { value: globalMocks.mockResetValidationSettings, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "renameUSSFile", {
        value: globalMocks.renameUSSFile,
        configurable: true
    });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.showInformationMessage,
        configurable: true
    });
    Object.defineProperty(globalMocks.ZosmfSession, "mockCreateBasicZosmfSessionFromArguments",
        { value: globalMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.filters, "getFilters", { value: globalMocks.getFilters, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: globalMocks.createQuickPick, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: globalMocks.showErrorMessage,
        configurable: true
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.getConfiguration,
        configurable: true
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [globalMocks.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: globalMocks.mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return globalMocks.profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
                checkProfileValidationSetting: globalMocks.mockValidationSetting,
                disableValidationContext: globalMocks.mockDisableValidationContext,
                enableValidationContext: globalMocks.mockEnableValidationContext
            };
        }),
        configurable: true
    });

    // Mocking Default Profile Manager
    globalMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    await Profiles.createInstance(Logger.getAppLogger());
    globalMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
    Object.defineProperty(DefaultProfileManager,
                          "getInstance",
                          { value: jest.fn(() => globalMocks.defaultProfileManagerInstance), configurable: true });
    Object.defineProperty(globalMocks.defaultProfileManagerInstance,
                          "getDefaultProfile",
                          { value: jest.fn(() => globalMocks.defaultProfile), configurable: true });

    // USS API mocks
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockGetValidSession.mockReturnValue(globalMocks.testSession);
    globalMocks.ussApi = ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
    globalMocks.mockGetUssApi.mockReturnValue(globalMocks.ussApi);
    ZoweExplorerApiRegister.getUssApi = globalMocks.mockGetUssApi.bind(ZoweExplorerApiRegister);
    Object.defineProperty(globalMocks.ussApi, "getValidSession", { value: globalMocks.mockGetValidSession, configurable: true });

    globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);
    globalMocks.getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockValidationSetting.mockReturnValue(true);
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(() => {
            return {};
        })
    });
    globalMocks.testTree = new USSTree();
    const ussSessionTestNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testUSSNode = createUSSNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testTree.mSessionNodes.push(ussSessionTestNode);
    globalMocks.testTree.addSearchHistory("/u/myuser");
    globalMocks.profilesForValidation = {status: "active", name: "fake", session: globalMocks.testSession};
    Object.defineProperty(profileUtils, "getValidSession", { value: jest.fn(() => globalMocks.testSession), configurable: true });

    return globalMocks;
}

describe("USSTree Unit Tests - Function USSTree.initializeFavorites()", () => {
    it("Tests that initializeFavorites() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(1);
        expect(favProfileNode.children.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, globalMocks.testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, globalMocks.testSession, "",
                false, "test"),
        ];

        expectedUSSFavorites.forEach((node) => node.contextValue += globals.FAV_SUFFIX);
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
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        const favProfileNode = testTree1.mFavorites[0];
        const label = "/u/fakeuser";
        const line = "[test]: /u/fakeuser{ussSession}";
        const expectedFavSearchNode = new ZoweUSSNode("/u/fakeuser", vscode.TreeItemCollapsibleState.None, favProfileNode,
            null, null, false, null);
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
        const expectedFavProfileNode = new ZoweUSSNode("testProfile", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, null, undefined, undefined);
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        const createdFavProfileNode = await globalMocks.testTree.createProfileNodeForFavs("testProfile");

        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Tests that profile grouping node is created correctly if icon is defined", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedFavProfileNode = new ZoweUSSNode("testProfile", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, null, undefined, undefined);
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const icons = require("../../../src/generators/icons");
        const folderIcon = require("../../../src/generators/icons/items/folder").default;
        const savedIconsProperty = Object.getOwnPropertyDescriptor(icons, "getIconByNode");
        Object.defineProperty(icons, "getIconByNode", {
            value: jest.fn(() => {
                return folderIcon;
            })
        });

        const createdFavProfileNode = await globalMocks.testTree.createProfileNodeForFavs("testProfile");

        expect(createdFavProfileNode).toEqual(expectedFavProfileNode);

        // Reset getIconByNode to its original functionality
        Object.defineProperty(icons, "getIconByNode", savedIconsProperty);
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
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/")
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
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
                globalMocks.testTree.mSessionNodes[1], null, "/")
        };
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
        globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);

        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.None, globalMocks.testTree.mSessionNodes[1], null, "/a/b");
        globalMocks.testTree.mSessionNodes[1].children.push(file);
        Object.defineProperty(globalMocks.testTree.mSessionNodes[1], "getChildren", {
            value: jest.fn(() => {
                return Promise.resolve([file]);
            })
        });

        await globalMocks.testTree.openItemFromPath("/a/b/c.txt", globalMocks.testTree.mSessionNodes[1]);

        expect(globalMocks.testTree.getSearchHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);

        spyOn(globalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const fileHistorySpy = jest.spyOn(globalMocks.testTree, "removeFileHistory");

        await globalMocks.testTree.openItemFromPath("/d.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(fileHistorySpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createValidIProfile(),
            ussSessionNode: null,
            mockProfileInstance: null,
            mockLoadNamedProfile: jest.fn(),
            mockDisableValidationContext: jest.fn(),
            mockEnableValidationContext: jest.fn(),
            mockLoadDefaultProfile: jest.fn(),
        };

        newMocks.ussSessionNode = createUSSSessionNode(newMocks.session, newMocks.imperativeProfile);

        // Profile instance mocks
        newMocks.mockProfileInstance = createInstanceOfProfile(newMocks.imperativeProfile, newMocks.session);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.mockProfileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        newMocks.mockLoadDefaultProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.mockProfileInstance.getDefaultProfile = newMocks.mockLoadDefaultProfile;
        newMocks.mockProfileInstance.enableValidationContext = newMocks.mockEnableValidationContext;
        newMocks.mockProfileInstance.disableValidationContext = newMocks.mockDisableValidationContext;
        newMocks.mockProfileInstance.validProfile = ValidProfileEnum.VALID;
        Object.defineProperty(Profiles, "getInstance", { value: jest.fn().mockReturnValue(newMocks.mockProfileInstance), configurable: true });

        return newMocks;
    }
    it("Tests if addSession works properly", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.testSession, null);
        globalMocks.testTree.mSessionNodes.push(testSessionNode);
        await globalMocks.testTree.addSession("testSessionNode");

        const foundNode = globalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });

    it("Tests if addSession causes the validation settings to be reset", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.testSession, null);
        globalMocks.testTree.mSessionNodes.push(testSessionNode);

        await globalMocks.testTree.addSession("testSessionNode");

        expect(globalMocks.mockResetValidationSettings).toBeCalledTimes(1);
    });

    it("tests that session is added properly from history", async () => {
        await createGlobalMocks();
        const blockMocks = await createBlockMocks();

        const testTree = new USSTree();

        // Force mHistory to contain the name of the test session
        await testTree.addSession(blockMocks.imperativeProfile.name, "zosmf");

        // Make sure session nodes array is empty before running the test
        testTree.mSessionNodes.pop();

        await testTree.addSession();

        expect(testTree.mSessionNodes[1].getSession()).toEqual(blockMocks.ussSessionNode.getSession());
    });

    it("tests that validation settings are reset for a session added from history", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks();

        const testTree = new USSTree();

        // Force mHistory to contain the name of the test session
        await testTree.addSession(blockMocks.imperativeProfile.name, "zosmf");

        // Make sure session nodes array is empty before running the test
        testTree.mSessionNodes.pop();

        await testTree.addSession();

        expect(globalMocks.mockResetValidationSettings).toBeCalled();
    });
});

describe("USSTree Unit Tests - Function USSTree.hideSession()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testTree2: new USSTree(),
            testSessionNode: new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                null, globalMocks.testSession, null),
            startLength: null
        };
        const ussSessionTestNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
        newMocks.testTree2.mSessionNodes.push(ussSessionTestNode);
        newMocks.testTree2.mSessionNodes.push(newMocks.testSessionNode);
        newMocks.startLength = newMocks.testTree2.mSessionNodes.length;

        return newMocks;
    }

    it("Tests that hideSession works properly", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.testTree2.hideSession(blockMocks.testTree2.mSessionNodes[blockMocks.startLength - 1]);
        expect(blockMocks.testTree2.mSessionNodes.length).toEqual(blockMocks.startLength - 1);
    });
});

describe("USSTree Unit Tests - Function USSTree.filterPrompt()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            theia: false,
            qpValue: "",
            qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
        };
        Object.defineProperty(globals, "ISTHEIA", { get: () => newMocks.theia });
        newMocks.resolveQuickPickHelper.mockImplementation(
            () => Promise.resolve(newMocks.qpItem)
        );
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
            })
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

    it("Tests that filter() works properly when user enters path with Unverified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({name: globalMocks.testProfile.name, status: "unverified"}),
                    validProfile: ValidProfileEnum.UNVERIFIED
                };
            })
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
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
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
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works correctly for favorited search nodes with credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const sessionWithCred = createISession();
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(sessionWithCred);
        const dsNode = new ZoweUSSNode(
            "/u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionWithCred, null, false, "ussTestSess2");
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
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode(
            "/u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionNoCred, null, false, "ussTestSess2");
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

        const treeGetChildren = jest.spyOn(globalMocks.testTree, "getChildren").mockImplementationOnce(
            () => Promise.resolve([globalMocks.testTree.mSessionNodes[1]])
        );
        const sessionGetChildren = jest.spyOn(globalMocks.testTree.mSessionNodes[1], "getChildren").mockImplementationOnce(
            () => Promise.resolve(globalMocks.testTree.mSessionNodes[1].children)
        );

        const loadedItems = await globalMocks.testTree.getAllLoadedItems();
        expect(loadedItems).toStrictEqual([file, folder]);
    });
});

describe("USSTree Unit Tests - Function USSTree.findFavoritedNode()", () => {
    it("Testing that findFavoritedNode() returns the favorite of a non-favorited node", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testUSSNode.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null,
            globalMocks.testSession, null, false, globalMocks.testProfile.name);
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);

        const foundNode = await globalMocks.testTree.findFavoritedNode(globalMocks.testUSSNode);

        expect(foundNode).toStrictEqual(ussFavNode);
    });
    it("Tests that findFavoritedNode() does not error when there is no favorite or matching profile node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const node = createUSSNode(globalMocks.testSession, globalMocks.testProfile);

        expect(() => {globalMocks.testTree.findFavoritedNode(node);}).not.toThrow();
    });
});

describe("USSTree Unit Tests - Function USSTree.findNonFavoritedNode()", () => {
    it("Testing that findNonFavoritedNode() returns the non-favorite from a favorite node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussFavNode = createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile);
        const ussFavNodeParent = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null,
            globalMocks.testSession, null, false, globalMocks.testProfile.name);
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);

        const nonFaveNode = await globalMocks.testTree.findNonFavoritedNode(ussFavNode);
        expect(nonFaveNode).toStrictEqual(globalMocks.testUSSNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.saveSearch()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            folder: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testTree.mSessionNodes[1], null, "/"),
            file: null,
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
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
        const ussFavNodeParent = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null,
            globalMocks.testSession, null, false, globalMocks.testProfile.name);
        ussFavNodeParent.children.push(ussFavNode);
        globalMocks.testTree.mFavorites.push(ussFavNodeParent);

        const newMocks = {
            ussFavNode,
            ussFavNodeParent
        };

        return newMocks;
    }

    it("Tests that USSTree.rename() is executed successfully for non-favorited node that is also in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        globalMocks.testUSSNode.fullPath = globalMocks.testUSSNode.fullPath + "/usstest";
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const renameNode = jest.spyOn(globalMocks.testUSSNode, "rename");
        const removeFavorite = jest.spyOn(globalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalMocks.testTree, "addFavorite");
        renameNode.mockResolvedValue(false);

        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(globalMocks.testUSSNode);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for non-favorited node with no Favorite equivalent", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        globalMocks.testTree.mFavorites = [];
        globalMocks.testUSSNode.fullPath = globalMocks.testUSSNode.fullPath + "/usstest";
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const renameNode = jest.spyOn(globalMocks.testUSSNode, "rename");
        const removeFavorite = jest.spyOn(globalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalMocks.testTree, "addFavorite");
        renameNode.mockResolvedValue(false);

        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(globalMocks.testUSSNode);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(0);
        expect(addFavorite.mock.calls.length).toBe(0);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        globalMocks.testTree.mSessionNodes[1].children.push(globalMocks.testUSSNode);
        const removeFavorite = jest.spyOn(globalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalMocks.testTree, "addFavorite");
        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(blockMocks.ussFavNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file, when tree is not expanded", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const removeFavorite = jest.spyOn(globalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalMocks.testTree, "addFavorite");
        globalMocks.showInputBox.mockReturnValueOnce("new name");

        await globalMocks.testTree.rename(blockMocks.ussFavNode);

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
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
            // tslint:disable-next-line:no-empty
        } catch (err) {
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
        spyOn(globalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await globalMocks.testTree.openItemFromPath("/a/b/c.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(globalMocks.testTree.getSearchHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        const globalMocks = await createGlobalMocks();

        spyOn(globalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const fileHistorySpy = jest.spyOn(globalMocks.testTree, "removeFileHistory");

        await globalMocks.testTree.openItemFromPath("/d.txt", globalMocks.testTree.mSessionNodes[1]);
        expect(fileHistorySpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    it("Tests if addSession works properly", async () => {
        const globalMocks = await createGlobalMocks();

        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.testSession, null);
        globalMocks.testTree.mSessionNodes.push(testSessionNode);
        globalMocks.testTree.addSession("testSessionNode");

        const foundNode = globalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.getChildren()", () => {
    it("Tests that getChildren() returns valid list of elements", async () => {
        const globalMocks = await createGlobalMocks();

        const rootChildren = await globalMocks.testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, false),
            new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.testSession,
                            "/", false, globalMocks.testProfile.name)
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

        const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mSessionNodes[1], null, "test");
        globalMocks.testTree.mSessionNodes[1].children.push(testDir);
        const mockApiResponseItems = {
            items: [{
                mode: "d",
                mSessionName: "sestest",
                name: "testDir"
            }]
        };
        const mockApiResponseWithItems = createFileResponse(mockApiResponseItems);
        globalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);
        const sessChildren = await globalMocks.testTree.getChildren(globalMocks.testTree.mSessionNodes[1]);
        const sampleChildren: ZoweUSSNode[] = [testDir];

        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<favorite>", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testTree.mFavorites.push(new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
            globalMocks.testTree.mSessionNodes[0], null, null));
        const favChildren = await globalMocks.testTree.getChildren(globalMocks.testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, globalMocks.testTree.mSessionNodes[0], null, null)
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
            items: [{
                mode: "f",
                mSessionName: "sestest",
                name: "myFile.txt"
            }]
        };
        const mockApiResponseWithItems = createFileResponse(mockApiResponseItems);
        globalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);

        const dirChildren = await globalMocks.testTree.getChildren(directory);
        expect(dirChildren[0].label).toEqual(sampleChildren[0].label);
    });
    it("Testing that getChildren() gets profile-loaded favorites for profile node in Favorites section", async () => {
        const globalMocks = await createGlobalMocks();
        const log = Logger.getAppLogger();
        const favProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, null, undefined, undefined);
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy= jest.spyOn(globalMocks.testTree, "loadProfilesForFavorites");

        await globalMocks.testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.loadProfilesForFavorites", () => {
    function createBlockMocks(globalMocks) {
        const log = Logger.getAppLogger();
        const ussApi = createUssApi(globalMocks.testProfile);
        bindUssApi(ussApi);

        return {
            log,
            ussApi
        };
    }

    it("Tests that loaded profile and session values are added to the profile grouping node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, null, null, false, undefined, undefined, undefined);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, globalMocks.testSession, null, false, "sestest", undefined, globalMocks.testProfile);

        // Mock successful loading of profile/session
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        return globalMocks.testProfile;
                    }),
                };
            })
        });
        Object.defineProperty(blockMocks.ussApi, "getSession", {
            value: jest.fn(() => {
                return globalMocks.testSession;
            })
        });

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavProfileNode = globalMocks.testTree.mFavorites[0];

        expect(resultFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Tests that error is handled if profile not successfully loaded for profile grouping node in Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode("badTestProfile", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, null, null, false, undefined, undefined, undefined);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        throw new Error();
                    }),
                };
            })
        });

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);

        expect(errorHandlingSpy).toBeCalledTimes(1);
    });
    it("Tests that favorite nodes with pre-existing profile/session values continue using those values", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, globalMocks.testSession, null, false, "sestest", undefined, globalMocks.testProfile);
        const favDirNode = new ZoweUSSNode("favDir", vscode.TreeItemCollapsibleState.Collapsed, favProfileNode,
            globalMocks.testSession, "", false, "sestest", null, globalMocks.testProfile);
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode("favDir", vscode.TreeItemCollapsibleState.Collapsed, favProfileNode,
        globalMocks.testSession, "", false, "sestest", null, globalMocks.testProfile);

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
    it("Tests that loaded profile/session from profile node in Favorites gets passed to child favorites without profile/session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testTree.mFavoriteSession, globalMocks.testSession, null, false, "sestest", undefined, globalMocks.testProfile);
        // Leave mParent parameter undefined for favDirNode and expectedFavDirNode to test undefined profile/session condition
        const favDirNode = new ZoweUSSNode("favDir", vscode.TreeItemCollapsibleState.Collapsed,
            null, null, "", false, "sestest", null, globalMocks.testProfile);
        favProfileNode.children.push(favDirNode);
        globalMocks.testTree.mFavorites.push(favProfileNode);
        const expectedFavDirNode = new ZoweUSSNode("favDir", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.testSession, "", false, "sestest", null, globalMocks.testProfile);

        await globalMocks.testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavDirNode = globalMocks.testTree.mFavorites[0].children[0];

        expect(resultFavDirNode).toEqual(expectedFavDirNode);
    });
});

describe("USSTree Unit Tests - Function USSTree.editSession()", () => {
    const profileLoad: IProfileLoaded = {
        name: "fake",
        profile: {
            host: "fake",
            port: 999,
            user: "fake",
            password: "fake",
            rejectUnauthorize: false
        },
        type: "zosmf",
        failNotFound: true,
        message: "fake"
    };
    // const profilesForValidation = {status: "active", name: "fake", session: globalMocks};
    /*************************************************************************************************************
     * Test the editSession command
     *************************************************************************************************************/
    it("Test the editSession command ", async () => {
        const globalMocks = await createGlobalMocks();
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, globalMocks.testSession, null);
        const checkSession = jest.spyOn(globalMocks.testTree, "editSession");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    editSession: jest.fn(() => {
                        return profileLoad;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            })
        });
        globalMocks.testTree.editSession(testSessionNode);
        expect(checkSession).toHaveBeenCalled();
    });

    /*************************************************************************************************************
     * Test the editSession command with inactive profiles
     *************************************************************************************************************/
    it("Test the editSession command ", async () => {
        const globalMocks = await createGlobalMocks();
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, globalMocks.testSession, globalMocks.testProfile.name);
        const checkSession = jest.spyOn(globalMocks.testTree, "editSession");
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    editSession: jest.fn(() => {
                        return profileLoad;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return {status: "inactive", name: globalMocks.testProfile.name};
                    }),
                    profilesForValidation: [{status: "inactive", name:globalMocks.testProfile.name}],
                    validateProfiles: jest.fn(),
                };
            })
        });
        globalMocks.testTree.editSession(testSessionNode);
        expect(checkSession).toHaveBeenCalled();
    });
});
