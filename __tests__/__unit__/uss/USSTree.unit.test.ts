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
import { Logger } from "@zowe/imperative";
import * as utils from "../../../src/utils";
import { generateIProfile, generateISession, generateISessionWithoutCredentials, generateFileResponse } from "../../../__mocks__/generators/shared";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { generateUSSNode, generateFavoriteUSSNode, addSessionNode } from "../../../__mocks__/generators/uss";
import { getIconByNode } from "../../../src/generators/icons";

async function declareGlobals() {
    const globalVariables = {
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
        ZosmfSession: jest.fn(),
        createBasicZosmfSession: jest.fn(),
        withProgress: jest.fn(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        testProfile: generateIProfile(),
        testSession: generateISession(),
        testResponse: generateFileResponse({items: []}),
        testUSSNode: null,
        testTree: null
    };

    globalVariables.testUSSNode = generateUSSNode(globalVariables.testSession, globalVariables.testProfile);
    globalVariables.testTree = addSessionNode(new USSTree(), globalVariables.testSession, globalVariables.testProfile);
    globalVariables.withProgress.mockImplementation((progLocation, callback) => callback());
    globalVariables.withProgress.mockReturnValue(globalVariables.testResponse);
    globalVariables.getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
    globalVariables.mockLoadNamedProfile.mockReturnValue(globalVariables.testProfile);
    globalVariables.mockDefaultProfile.mockReturnValue(globalVariables.testProfile);
    globalVariables.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });

    Object.defineProperty(vscode.window, "createTreeView", { value: globalVariables.createTreeView, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalVariables.executeCommand, configurable: true });
    Object.defineProperty(globalVariables.Utilities, "renameUSSFile", { value: globalVariables.renameUSSFile, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalVariables.showQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: globalVariables.showInformationMessage, configurable: true });
    Object.defineProperty(globalVariables.ZosmfSession, "createBasicZosmfSession",
        { value: globalVariables.createBasicZosmfSession, configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalVariables.ZosmfSession, configurable: true });
    Object.defineProperty(globalVariables.filters, "getFilters", { value: globalVariables.getFilters, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: globalVariables.createQuickPick, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalVariables.Utilities, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: globalVariables.showErrorMessage, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalVariables.getConfiguration, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalVariables.showInputBox, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", {value: globalVariables.ProgressLocation});
    Object.defineProperty(vscode.window, "withProgress", {value: globalVariables.withProgress});
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [globalVariables.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: globalVariables.mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
                loadNamedProfile: globalVariables.mockLoadNamedProfile
            };
        })
    });

    return globalVariables;
}

describe("USSTree Unit Tests - Function USSTree.initialize()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that initialize() is executed successfully", async () => {
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, globalVariables.testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, globalVariables.testSession, "",
                false, "test"),
        ];

        expectedUSSFavorites.forEach((node) => node.contextValue += globals.FAV_SUFFIX);
        expectedUSSFavorites.forEach((node) => {
            if (node.contextValue !== globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX) {
                node.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [node] };
            }
        });
        expect(testTree1.mFavorites[0].fullPath).toEqual("/u/aDir");
        expect(testTree1.mFavorites[1].label).toEqual("[test]: myFile.txt");
    });
});

describe("USSTree Unit Tests - Function initializeUSSTree()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if initializeUSSTree() is executed successfully", async () => {
        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, globalVariables.testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, globalVariables.testSession, "",
                false, "test"),
        ];

        expectedUSSFavorites.forEach((node) => node.contextValue += globals.FAV_SUFFIX);
        expectedUSSFavorites.forEach((node) => {
            if (node.contextValue !== globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX) {
                node.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [node] };
            }
        });

        const testTree1 = await createUSSTree(Logger.getAppLogger());
        expect(testTree1.mFavorites.length).toBe(2);
        expect(testTree1.mFavorites[0].fullPath).toEqual("/u/aDir");
        expect(testTree1.mFavorites[1].label).toEqual("[test]: myFile.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.rename()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        globalVariables.testUSSNode.label = "";
        globalVariables.testUSSNode.shortLabel = "";
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that USSTree.rename() is executed successfully", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("new name");

        await globalVariables.testTree.rename(globalVariables.testUSSNode);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalVariables.renameUSSFile.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(globalVariables.testTree, "refreshElement");
        globalVariables.showInputBox.mockReturnValueOnce("");

        await globalVariables.testTree.rename(globalVariables.testUSSNode);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalVariables.renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("new name");
        globalVariables.renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await globalVariables.testTree.rename(globalVariables.testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile);
        globalVariables.testTree.mFavorites.push(ussFavNode);
        const removeFavorite = jest.spyOn(globalVariables.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalVariables.testTree, "addFavorite");
        globalVariables.showInputBox.mockReturnValueOnce("new name");

        await globalVariables.testTree.rename(ussFavNode);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalVariables.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        globalVariables.testTree.addRecall("testHistory");
        expect(globalVariables.testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that removeRecall() is executed successfully", async () => {
        globalVariables.testTree.removeRecall("testHistory");
        expect(globalVariables.testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            childFile: null,
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, "/")
        };
        newVariables.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newVariables.parentDir, null, "/parent");
        newVariables.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        globalVariables.testTree.mFavorites = [];

        return newVariables;
    }

    it("Tests that addFavorite() works for directories", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.childFile);
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
                                     globalVariables.testTree.mSessionNodes[1], null, "/")
        };
        globalVariables.testTree.mFavorites = [];

        return newVariables;
    }

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.testDir.fullPath);

        await globalVariables.testTree.removeFavorite(globalVariables.testTree.mFavorites[0]);
        expect(globalVariables.testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        globalVariables.withProgress.mockReturnValue(globalVariables.testResponse);
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[0], null, "/a/b");
        spyOn(globalVariables.testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await globalVariables.testTree.openItemFromPath("/a/b/c.txt", globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(globalVariables.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(globalVariables.testTree, "removeRecall");

        await globalVariables.testTree.openItemFromPath("/d.txt", globalVariables.testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, globalVariables.testSession, null);
        globalVariables.testTree.mSessionNodes.push(testSessionNode);
        globalVariables.testTree.addSession("testSessionNode");

        const foundNode = globalVariables.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            testTree2: addSessionNode(new USSTree(), globalVariables.testSession, globalVariables.testProfile),
            testSessionNode: new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.testSession, null),
            startLength: null
        };
        newVariables.startLength = blockVariables.testTree2.mSessionNodes.length;
        newVariables.testTree2.mSessionNodes.push(blockVariables.testSessionNode);

        return newVariables;
    }

    it("Tests that deleteSession works properly", async () => {
        blockVariables.testTree2.addSession("ussTestSess2");
        blockVariables.testTree2.mSessionNodes[blockVariables.startLength].contextValue = globals.USS_SESSION_CONTEXT;

        blockVariables.testTree2.deleteSession(blockVariables.testTree2.mSessionNodes[blockVariables.startLength]);
        expect(blockVariables.testTree2.mSessionNodes.length).toEqual(blockVariables.startLength);
    });
});

describe("USSTree Unit Tests - Function USSTree.filterPrompt()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            theia: false,
            qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
        };
        Object.defineProperty(globals, "ISTHEIA", { get: () => newVariables.theia });
        newVariables.resolveQuickPickHelper.mockImplementation(
            () => Promise.resolve(newVariables.qpItem)
        );
        globalVariables.createQuickPick.mockReturnValue({
            placeholder: "Select a filter",
            activeItems: [newVariables.qpItem],
            ignoreFocusOut: true,
            items: [newVariables.qpItem],
            value: "",
            show: jest.fn(()=>{
                return {};
            }),
            hide: jest.fn(()=>{
                return {};
            }),
            onDidAccept: jest.fn(()=>{
                return {};
            })
        });

        return blockVariables;
    }

    it("Tests that filter() works properly when user enters path", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("/U/HARRY");

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("Tests that filter() exits when user cancels out of input field", async () => {
        globalVariables.showInputBox.mockReturnValueOnce(undefined);

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works on a file", async () => {
        blockVariables.qpItem = new utils.FilterItem("/U/HLQ/STUFF");

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mSessionNodes[1].fullPath).toEqual("/U/HLQ/STUFF");
    });

    it("Tests that filter() exits when user cancels the input path box", async () => {
        blockVariables.qpItem = undefined;

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works when new path is specified (Theia)", async () => {
        blockVariables.theia = true;
        globalVariables.showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        globalVariables.showInputBox.mockReturnValueOnce("/u/myFiles");

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");
    });

    it("Tests that filter() exits when user cancels the input path box (Theia)", async () => {
        blockVariables.theia = true;
        globalVariables.showQuickPick.mockReturnValueOnce("\uFF0B " + "Create a new filter");
        globalVariables.showInputBox.mockReturnValueOnce(undefined);

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works with a file (Theia)", async () => {
        blockVariables.theia = true;
        globalVariables.showQuickPick.mockReturnValueOnce(new utils.FilterDescriptor("/u/thisFile"));

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");
    });

    it("Tests that filter() exits when no selection made (Theia)", async () => {
        blockVariables.theia = true;
        globalVariables.showQuickPick.mockReturnValueOnce(undefined);

        await globalVariables.testTree.filterPrompt(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works correctly for favorites", async () => {
        const sessionNoCred = generateISessionWithoutCredentials();
        globalVariables.createBasicZosmfSession.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode(
            "[ussTestSess2]: /u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionNoCred, null, false, "ussTestSess2");
        dsNode.mProfileName = "ussTestSess2";
        dsNode.getSession().ISession.user = "";
        dsNode.getSession().ISession.password = "";
        dsNode.getSession().ISession.base64EncodedAuth = "";
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        globalVariables.testTree.mSessionNodes.push(dsNode);

        await globalVariables.testTree.filterPrompt(dsNode);
        globalVariables.testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) { expect(sessionNode.fullPath).toEqual("/u/myFile.txt"); }
        });
    });
});

describe("USSTree Unit Tests - Function USSTree.searchInLoadedItems()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Testing that searchInLoadedItems() returns the correct array", async () => {
        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
        globalVariables.testTree.mSessionNodes[1].children = [folder];
        folder.children.push(file);

        const treeGetChildren = jest.spyOn(globalVariables.testTree, "getChildren").mockImplementationOnce(
            () => Promise.resolve([globalVariables.testTree.mSessionNodes[1]])
        );
        const sessionGetChildren = jest.spyOn(globalVariables.testTree.mSessionNodes[1], "getChildren").mockImplementationOnce(
            () => Promise.resolve(globalVariables.testTree.mSessionNodes[1].children)
        );

        const loadedItems = await globalVariables.testTree.searchInLoadedItems();
        expect(loadedItems).toStrictEqual([file, folder]);
    });
});

describe("USSTree Unit Tests - Function USSTree.saveSearch()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            folder: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, "/"),
            file: null,
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
        };
        globalVariables.testTree.mFavorites = [];
        newVariables.file = new ZoweUSSNode("abcd", vscode.TreeItemCollapsibleState.None, newVariables.folder, null, "/parent");
        newVariables.file.contextValue = globals.USS_SESSION_CONTEXT;

        return newVariables;
    }

    it("Testing that saveSearch() works properly for a folder", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.folder);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.file);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        globalVariables.testTree.mSessionNodes[1].fullPath = "/z1234";
        await globalVariables.testTree.saveSearch(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a session", async () => {
        globalVariables.testTree.mSessionNodes[1].fullPath = "/z1234";
        await globalVariables.testTree.saveSearch(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly on the same session, different path", async () => {
        globalVariables.testTree.mSessionNodes[1].fullPath = "/a1234";
        await globalVariables.testTree.saveSearch(globalVariables.testTree.mSessionNodes[1]);
        globalVariables.testTree.mSessionNodes[1].fullPath = "/r1234";
        await globalVariables.testTree.saveSearch(globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.mFavorites.length).toEqual(2);
    });
});

describe("USSTree Unit Tests - Function USSTree.getChildren()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(globalVariables.testTree, "refreshElement");
        globalVariables.showInputBox.mockReturnValueOnce("");

        await globalVariables.testTree.rename(globalVariables.testUSSNode);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalVariables.renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("new name");
        globalVariables.renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await globalVariables.testTree.rename(globalVariables.testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile);
        const removeFavorite = jest.spyOn(globalVariables.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(globalVariables.testTree, "addFavorite");
        globalVariables.showInputBox.mockReturnValueOnce("new name");

        await globalVariables.testTree.rename(ussFavNode);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
        expect(globalVariables.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        globalVariables.testTree.addRecall("testHistory");
        expect(globalVariables.testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that removeRecall() is executed successfully", async () => {
        globalVariables.testTree.removeRecall("testHistory");
        expect(globalVariables.testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, "/"),
            childFile: null,
        };
        newVariables.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        newVariables.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newVariables.parentDir, null, "/parent");
        globalVariables.testTree.mFavorites = [];

        return newVariables;
    }

    it("Tests that addFavorite() works for directories", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.childFile);
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        await globalVariables.testTree.addFavorite(blockVariables.parentDir);
        expect(globalVariables.testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, "/"),
        };
        globalVariables.testTree.mFavorites = [];
        await globalVariables.testTree.addFavorite(blockVariables.testDir);

        return newVariables;
    }

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(globalVariables.testTree.mFavorites[0].fullPath).toEqual(blockVariables.testDir.fullPath);

        await globalVariables.testTree.removeFavorite(globalVariables.testTree.mFavorites[0]);
        expect(globalVariables.testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[0], null, "/a/b");
        spyOn(globalVariables.testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await globalVariables.testTree.openItemFromPath("/a/b/c.txt", globalVariables.testTree.mSessionNodes[1]);
        expect(globalVariables.testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(globalVariables.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(globalVariables.testTree, "removeRecall");

        await globalVariables.testTree.openItemFromPath("/d.txt", globalVariables.testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, globalVariables.testSession, null);
        globalVariables.testTree.mSessionNodes.push(testSessionNode);
        globalVariables.testTree.addSession("testSessionNode");

        const foundNode = globalVariables.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that getChildren() returns valid list of elements", async () => {
        const rootChildren = await globalVariables.testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, false),
            new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.testSession,
                            null, false, globalVariables.testProfile.name)
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
        expect(JSON.stringify(sessNode[0].iconPath)).toContain("folder-root-favorite-closed.svg");
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<session>", async () => {
        const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
                                        globalVariables.testTree.mSessionNodes[1], null, "test");
        globalVariables.testTree.mSessionNodes[1].children.push(testDir);
        const mockApiResponseItems = {
            items: [{
                mode: "d",
                mSessionName: "sestest",
                name: "testDir"
            }]
        };
        const mockApiResponseWithItems = generateFileResponse(mockApiResponseItems);
        globalVariables.withProgress.mockReturnValue(mockApiResponseWithItems);
        const sessChildren = await globalVariables.testTree.getChildren(globalVariables.testTree.mSessionNodes[1]);
        const sampleChildren: ZoweUSSNode[] = [testDir];

        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<favorite>", async () => {
        globalVariables.testTree.mFavorites.push(new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
                                                 globalVariables.testTree.mSessionNodes[0], null, null));
        const favChildren = await globalVariables.testTree.getChildren(globalVariables.testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, globalVariables.testTree.mSessionNodes[0], null, null)
        ];

        expect(favChildren).toEqual(sampleChildren);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<directory>", async () => {
        const directory = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, globalVariables.testTree.mSessionNodes[1], null, null);
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
        const mockApiResponseWithItems = generateFileResponse(mockApiResponseItems);
        globalVariables.withProgress.mockReturnValue(mockApiResponseWithItems);

        const dirChildren = await globalVariables.testTree.getChildren(directory);
        expect(dirChildren[0].label).toEqual(sampleChildren[0].label);
    });
});
