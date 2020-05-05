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

async function generateEnvironmentalMocks() {
    const environmentalMocks = {
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

    environmentalMocks.testUSSNode = generateUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile);
    environmentalMocks.testTree = addSessionNode(new USSTree(), environmentalMocks.testSession, environmentalMocks.testProfile);
    environmentalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    environmentalMocks.withProgress.mockReturnValue(environmentalMocks.testResponse);
    environmentalMocks.getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
    environmentalMocks.mockLoadNamedProfile.mockReturnValue(environmentalMocks.testProfile);
    environmentalMocks.mockDefaultProfile.mockReturnValue(environmentalMocks.testProfile);
    environmentalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });

    Object.defineProperty(vscode.window, "createTreeView", { value: environmentalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: environmentalMocks.executeCommand, configurable: true });
    Object.defineProperty(environmentalMocks.Utilities, "renameUSSFile", { value: environmentalMocks.renameUSSFile, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: environmentalMocks.showQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: environmentalMocks.showInformationMessage, configurable: true });
    Object.defineProperty(environmentalMocks.ZosmfSession, "createBasicZosmfSession",
        { value: environmentalMocks.createBasicZosmfSession, configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: environmentalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(environmentalMocks.filters, "getFilters", { value: environmentalMocks.getFilters, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: environmentalMocks.createQuickPick, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: environmentalMocks.Utilities, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: environmentalMocks.showErrorMessage, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: environmentalMocks.getConfiguration, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: environmentalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", {value: environmentalMocks.ProgressLocation});
    Object.defineProperty(vscode.window, "withProgress", {value: environmentalMocks.withProgress});
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [environmentalMocks.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: environmentalMocks.mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
                loadNamedProfile: environmentalMocks.mockLoadNamedProfile
            };
        })
    });

    return environmentalMocks;
}

describe("USSTree Unit Tests - Function USSTree.initialize()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that initialize() is executed successfully", async () => {
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, environmentalMocks.testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, environmentalMocks.testSession, "",
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
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if initializeUSSTree() is executed successfully", async () => {
        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, environmentalMocks.testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, environmentalMocks.testSession, "",
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
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        environmentalMocks.testUSSNode.label = "";
        environmentalMocks.testUSSNode.shortLabel = "";
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that USSTree.rename() is executed successfully", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");

        await environmentalMocks.testTree.rename(environmentalMocks.testUSSNode);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(environmentalMocks.renameUSSFile.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(environmentalMocks.testTree, "refreshElement");
        environmentalMocks.showInputBox.mockReturnValueOnce("");

        await environmentalMocks.testTree.rename(environmentalMocks.testUSSNode);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(environmentalMocks.renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");
        environmentalMocks.renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await environmentalMocks.testTree.rename(environmentalMocks.testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile);
        environmentalMocks.testTree.mFavorites.push(ussFavNode);
        const removeFavorite = jest.spyOn(environmentalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(environmentalMocks.testTree, "addFavorite");
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");

        await environmentalMocks.testTree.rename(ussFavNode);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(environmentalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        environmentalMocks.testTree.addRecall("testHistory");
        expect(environmentalMocks.testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that removeRecall() is executed successfully", async () => {
        environmentalMocks.testTree.removeRecall("testHistory");
        expect(environmentalMocks.testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            childFile: null,
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, "/")
        };
        newMocks.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newMocks.parentDir, null, "/parent");
        newMocks.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        environmentalMocks.testTree.mFavorites = [];

        return newMocks;
    }

    it("Tests that addFavorite() works for directories", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.childFile);
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
                                     environmentalMocks.testTree.mSessionNodes[1], null, "/")
        };
        environmentalMocks.testTree.mFavorites = [];

        return newMocks;
    }

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.testDir.fullPath);

        await environmentalMocks.testTree.removeFavorite(environmentalMocks.testTree.mFavorites[0]);
        expect(environmentalMocks.testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        environmentalMocks.withProgress.mockReturnValue(environmentalMocks.testResponse);
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[0], null, "/a/b");
        spyOn(environmentalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await environmentalMocks.testTree.openItemFromPath("/a/b/c.txt", environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(environmentalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(environmentalMocks.testTree, "removeRecall");

        await environmentalMocks.testTree.openItemFromPath("/d.txt", environmentalMocks.testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, environmentalMocks.testSession, null);
        environmentalMocks.testTree.mSessionNodes.push(testSessionNode);
        environmentalMocks.testTree.addSession("testSessionNode");

        const foundNode = environmentalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            testTree2: addSessionNode(new USSTree(), environmentalMocks.testSession, environmentalMocks.testProfile),
            testSessionNode: new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                null, environmentalMocks.testSession, null),
            startLength: null
        };
        newMocks.startLength = blockMocks.testTree2.mSessionNodes.length;
        newMocks.testTree2.mSessionNodes.push(blockMocks.testSessionNode);

        return newMocks;
    }

    it("Tests that deleteSession works properly", async () => {
        blockMocks.testTree2.addSession("ussTestSess2");
        blockMocks.testTree2.mSessionNodes[blockMocks.startLength].contextValue = globals.USS_SESSION_CONTEXT;

        blockMocks.testTree2.deleteSession(blockMocks.testTree2.mSessionNodes[blockMocks.startLength]);
        expect(blockMocks.testTree2.mSessionNodes.length).toEqual(blockMocks.startLength);
    });
});

describe("USSTree Unit Tests - Function USSTree.filterPrompt()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            theia: false,
            qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
        };
        Object.defineProperty(globals, "ISTHEIA", { get: () => newMocks.theia });
        newMocks.resolveQuickPickHelper.mockImplementation(
            () => Promise.resolve(newMocks.qpItem)
        );
        environmentalMocks.createQuickPick.mockReturnValue({
            placeholder: "Select a filter",
            activeItems: [newMocks.qpItem],
            ignoreFocusOut: true,
            items: [newMocks.qpItem],
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

        return blockMocks;
    }

    it("Tests that filter() works properly when user enters path", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("/U/HARRY");

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("Tests that filter() exits when user cancels out of input field", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce(undefined);

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works on a file", async () => {
        blockMocks.qpItem = new utils.FilterItem("/U/HLQ/STUFF");

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/U/HLQ/STUFF");
    });

    it("Tests that filter() exits when user cancels the input path box", async () => {
        blockMocks.qpItem = undefined;

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works when new path is specified (Theia)", async () => {
        blockMocks.theia = true;
        environmentalMocks.showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        environmentalMocks.showInputBox.mockReturnValueOnce("/u/myFiles");

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");
    });

    it("Tests that filter() exits when user cancels the input path box (Theia)", async () => {
        blockMocks.theia = true;
        environmentalMocks.showQuickPick.mockReturnValueOnce("\uFF0B " + "Create a new filter");
        environmentalMocks.showInputBox.mockReturnValueOnce(undefined);

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works with a file (Theia)", async () => {
        blockMocks.theia = true;
        environmentalMocks.showQuickPick.mockReturnValueOnce(new utils.FilterDescriptor("/u/thisFile"));

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");
    });

    it("Tests that filter() exits when no selection made (Theia)", async () => {
        blockMocks.theia = true;
        environmentalMocks.showQuickPick.mockReturnValueOnce(undefined);

        await environmentalMocks.testTree.filterPrompt(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works correctly for favorites", async () => {
        const sessionNoCred = generateISessionWithoutCredentials();
        environmentalMocks.createBasicZosmfSession.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode(
            "[ussTestSess2]: /u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionNoCred, null, false, "ussTestSess2");
        dsNode.mProfileName = "ussTestSess2";
        dsNode.getSession().ISession.user = "";
        dsNode.getSession().ISession.password = "";
        dsNode.getSession().ISession.base64EncodedAuth = "";
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        environmentalMocks.testTree.mSessionNodes.push(dsNode);

        await environmentalMocks.testTree.filterPrompt(dsNode);
        environmentalMocks.testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) { expect(sessionNode.fullPath).toEqual("/u/myFile.txt"); }
        });
    });
});

describe("USSTree Unit Tests - Function USSTree.searchInLoadedItems()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Testing that searchInLoadedItems() returns the correct array", async () => {
        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
        environmentalMocks.testTree.mSessionNodes[1].children = [folder];
        folder.children.push(file);

        const treeGetChildren = jest.spyOn(environmentalMocks.testTree, "getChildren").mockImplementationOnce(
            () => Promise.resolve([environmentalMocks.testTree.mSessionNodes[1]])
        );
        const sessionGetChildren = jest.spyOn(environmentalMocks.testTree.mSessionNodes[1], "getChildren").mockImplementationOnce(
            () => Promise.resolve(environmentalMocks.testTree.mSessionNodes[1].children)
        );

        const loadedItems = await environmentalMocks.testTree.searchInLoadedItems();
        expect(loadedItems).toStrictEqual([file, folder]);
    });
});

describe("USSTree Unit Tests - Function USSTree.saveSearch()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            folder: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, "/"),
            file: null,
            resolveQuickPickHelper: jest.spyOn(utils, "resolveQuickPickHelper")
        };
        environmentalMocks.testTree.mFavorites = [];
        newMocks.file = new ZoweUSSNode("abcd", vscode.TreeItemCollapsibleState.None, newMocks.folder, null, "/parent");
        newMocks.file.contextValue = globals.USS_SESSION_CONTEXT;

        return newMocks;
    }

    it("Testing that saveSearch() works properly for a folder", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.folder);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.file);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        environmentalMocks.testTree.mSessionNodes[1].fullPath = "/z1234";
        await environmentalMocks.testTree.saveSearch(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a session", async () => {
        environmentalMocks.testTree.mSessionNodes[1].fullPath = "/z1234";
        await environmentalMocks.testTree.saveSearch(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly on the same session, different path", async () => {
        environmentalMocks.testTree.mSessionNodes[1].fullPath = "/a1234";
        await environmentalMocks.testTree.saveSearch(environmentalMocks.testTree.mSessionNodes[1]);
        environmentalMocks.testTree.mSessionNodes[1].fullPath = "/r1234";
        await environmentalMocks.testTree.saveSearch(environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(2);
    });
});

describe("USSTree Unit Tests - Function USSTree.getChildren()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(environmentalMocks.testTree, "refreshElement");
        environmentalMocks.showInputBox.mockReturnValueOnce("");

        await environmentalMocks.testTree.rename(environmentalMocks.testUSSNode);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(environmentalMocks.renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");
        environmentalMocks.renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await environmentalMocks.testTree.rename(environmentalMocks.testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile);
        const removeFavorite = jest.spyOn(environmentalMocks.testTree, "removeFavorite");
        const addFavorite = jest.spyOn(environmentalMocks.testTree, "addFavorite");
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");

        await environmentalMocks.testTree.rename(ussFavNode);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
        expect(environmentalMocks.renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        environmentalMocks.testTree.addRecall("testHistory");
        expect(environmentalMocks.testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that removeRecall() is executed successfully", async () => {
        environmentalMocks.testTree.removeRecall("testHistory");
        expect(environmentalMocks.testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            parentDir: new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, "/"),
            childFile: null,
        };
        newMocks.childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        newMocks.childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, newMocks.parentDir, null, "/parent");
        environmentalMocks.testTree.mFavorites = [];

        return newMocks;
    }

    it("Tests that addFavorite() works for directories", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.childFile);
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        await environmentalMocks.testTree.addFavorite(blockMocks.parentDir);
        expect(environmentalMocks.testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            testDir: new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, "/"),
        };
        environmentalMocks.testTree.mFavorites = [];
        await environmentalMocks.testTree.addFavorite(blockMocks.testDir);

        return newMocks;
    }

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(environmentalMocks.testTree.mFavorites[0].fullPath).toEqual(blockMocks.testDir.fullPath);

        await environmentalMocks.testTree.removeFavorite(environmentalMocks.testTree.mFavorites[0]);
        expect(environmentalMocks.testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[0], null, "/a/b");
        spyOn(environmentalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await environmentalMocks.testTree.openItemFromPath("/a/b/c.txt", environmentalMocks.testTree.mSessionNodes[1]);
        expect(environmentalMocks.testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(environmentalMocks.testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(environmentalMocks.testTree, "removeRecall");

        await environmentalMocks.testTree.openItemFromPath("/d.txt", environmentalMocks.testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed,
                                                null, environmentalMocks.testSession, null);
        environmentalMocks.testTree.mSessionNodes.push(testSessionNode);
        environmentalMocks.testTree.addSession("testSessionNode");

        const foundNode = environmentalMocks.testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that getChildren() returns valid list of elements", async () => {
        const rootChildren = await environmentalMocks.testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, false),
            new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, environmentalMocks.testSession,
                            null, false, environmentalMocks.testProfile.name)
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
                                        environmentalMocks.testTree.mSessionNodes[1], null, "test");
        environmentalMocks.testTree.mSessionNodes[1].children.push(testDir);
        const mockApiResponseItems = {
            items: [{
                mode: "d",
                mSessionName: "sestest",
                name: "testDir"
            }]
        };
        const mockApiResponseWithItems = generateFileResponse(mockApiResponseItems);
        environmentalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);
        const sessChildren = await environmentalMocks.testTree.getChildren(environmentalMocks.testTree.mSessionNodes[1]);
        const sampleChildren: ZoweUSSNode[] = [testDir];

        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<favorite>", async () => {
        environmentalMocks.testTree.mFavorites.push(new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
                                                 environmentalMocks.testTree.mSessionNodes[0], null, null));
        const favChildren = await environmentalMocks.testTree.getChildren(environmentalMocks.testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, environmentalMocks.testTree.mSessionNodes[0], null, null)
        ];

        expect(favChildren).toEqual(sampleChildren);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<directory>", async () => {
        const directory = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.testTree.mSessionNodes[1], null, null);
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
        environmentalMocks.withProgress.mockReturnValue(mockApiResponseWithItems);

        const dirChildren = await environmentalMocks.testTree.getChildren(directory);
        expect(dirChildren[0].label).toEqual(sampleChildren[0].label);
    });
});
