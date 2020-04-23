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

<<<<<<< HEAD
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

const mockLoadNamedProfile = jest.fn();
const mockDefaultProfile = jest.fn();
const executeCommand = jest.fn();
const Utilities = jest.fn();
const showQuickPick = jest.fn();
const renameUSSFile = jest.fn();
const showInformationMessage = jest.fn();
const showErrorMessage = jest.fn();
const showInputBox = jest.fn();
const filters = jest.fn();
const getFilters = jest.fn();
const createTreeView = jest.fn();
const createQuickPick = jest.fn();
const getConfiguration = jest.fn();
const ZosmfSession = jest.fn();
const createBasicZosmfSession = jest.fn();

Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});
Object.defineProperty(Utilities, "renameUSSFile", { value: renameUSSFile });
Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession });
Object.defineProperty(zowe, "ZosmfSession", { value: ZosmfSession });
Object.defineProperty(filters, "getFilters", { value: getFilters });
Object.defineProperty(vscode.window, "createQuickPick", {value: createQuickPick});
Object.defineProperty(zowe, "Utilities", { value: Utilities });
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});

const testProfile = generateIProfile();
const testSession = generateISession();
const testResponse = generateFileResponse({items: []});

getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
mockLoadNamedProfile.mockReturnValue(testProfile);
mockDefaultProfile.mockReturnValue(testProfile);
getConfiguration.mockReturnValue({
    get: (setting: string) => [
        "[test]: /u/aDir{directory}",
        "[test]: /u/myFile.txt{textFile}",
    ],
    update: jest.fn(()=>{
        return {};
    })
});
const ProgressLocation = jest.fn().mockImplementation(() => {
    return {
        Notification: 15
    };
});
Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
const withProgress = jest.fn().mockImplementation((progLocation, callback) => {
    return callback();
});
Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
withProgress.mockReturnValue(testResponse);
Object.defineProperty(Profiles, "getInstance", {
    value: jest.fn(() => {
        return {
            allProfiles: [testProfile, { name: "firstName" }, { name: "secondName" }],
            getDefaultProfile: mockDefaultProfile,
            validProfile: ValidProfileEnum.VALID,
            checkCurrentProfile: jest.fn(),
            loadNamedProfile: mockLoadNamedProfile
        };
    })
});
const testUSSNode = generateUSSNode(testSession, testProfile);
let testTree = addSessionNode(new USSTree(), testSession, testProfile);

describe("USSTree Unit Tests - Function USSTree.initialize()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that initialize() is executed successfully", async () => {
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        expect(testTree1.mSessionNodes).toBeDefined();
        expect(testTree1.mFavorites.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, testSession, "",
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
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests if initializeUSSTree() is executed successfully", async () => {
        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, testSession, "",
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
    beforeEach(() => {
        testUSSNode.label = "";
        testUSSNode.shortLabel = "";
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that USSTree.rename() is executed successfully", async () => {
        showInputBox.mockReturnValueOnce("new name");

        await testTree.rename(testUSSNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(testTree, "refreshElement");
        showInputBox.mockReturnValueOnce("");

        await testTree.rename(testUSSNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        showInputBox.mockReturnValueOnce("new name");
        renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await testTree.rename(testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(testSession, testProfile);
        testTree.mFavorites.push(ussFavNode);
        const removeFavorite = jest.spyOn(testTree, "removeFavorite");
        const addFavorite = jest.spyOn(testTree, "addFavorite");
        showInputBox.mockReturnValueOnce("new name");

        await testTree.rename(ussFavNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        testTree.addRecall("testHistory");
        expect(testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that removeRecall() is executed successfully", async () => {
        testTree.removeRecall("testHistory");
        expect(testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    const parentDir = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null, "/");
    const childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None,
            parentDir, null, "/parent");
    childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;

    beforeEach(() => {
        testTree.mFavorites = [];
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that addFavorite() works for directories", async () => {
        await testTree.addFavorite(parentDir);
        expect(testTree.mFavorites[0].fullPath).toEqual(parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await testTree.addFavorite(childFile);
        expect(testTree.mFavorites[0].fullPath).toEqual(childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await testTree.addFavorite(parentDir);
        await testTree.addFavorite(parentDir);
        expect(testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
    testTree.mSessionNodes[1], null, "/");

    beforeEach(async () => {
        testTree.mFavorites = [];
        await testTree.addFavorite(testDir);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(testTree.mFavorites[0].fullPath).toEqual(testDir.fullPath);

        await testTree.removeFavorite(testTree.mFavorites[0]);
        expect(testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], null, "/a/b");

    beforeEach(async () => {
        withProgress.mockReturnValue(testResponse);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        spyOn(testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await testTree.openItemFromPath("/a/b/c.txt", testTree.mSessionNodes[1]);
        expect(testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(testTree, "removeRecall");

        await testTree.openItemFromPath("/d.txt", testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null);
        testTree.mSessionNodes.push(testSessionNode);
        testTree.addSession("testSessionNode");

        const foundNode = testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    const testTree2 = addSessionNode(new USSTree(), testSession, testProfile);
    const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null);
    testTree2.mSessionNodes.push(testSessionNode);
    const startLength = testTree2.mSessionNodes.length;

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that deleteSession works properly", async () => {
        testTree2.addSession("ussTestSess2");
        testTree2.mSessionNodes[startLength].contextValue = globals.USS_SESSION_CONTEXT;

        testTree2.deleteSession(testTree2.mSessionNodes[startLength]);
        expect(testTree2.mSessionNodes.length).toEqual(startLength);
    });
});

describe("USSTree Unit Tests - Function USSTree.filterPrompt()", () => {
    let theia;
    Object.defineProperty(globals, "ISTHEIA", { get: () => theia });
    let qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");
    const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
        () => Promise.resolve(qpItem)
    );
    createQuickPick.mockReturnValue({
        placeholder: "Select a filter",
        activeItems: [qpItem],
        ignoreFocusOut: true,
        items: [qpItem],
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

    afterEach(() => {
        theia = false;
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that filter() works properly when user enters path", async () => {
        showInputBox.mockReturnValueOnce("/U/HARRY");

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/U/HARRY");
    });

    it("Tests that filter() exits when user cancels out of input field", async () => {
        showInputBox.mockReturnValueOnce(undefined);

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works on a file", async () => {
        qpItem = new utils.FilterItem("/U/HLQ/STUFF");

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/U/HLQ/STUFF");
    });

    it("Tests that filter() exits when user cancels the input path box", async () => {
        qpItem = undefined;

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works when new path is specified (Theia)", async () => {
        theia = true;
        showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        showInputBox.mockReturnValueOnce("/u/myFiles");

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");
    });

    it("Tests that filter() exits when user cancels the input path box (Theia)", async () => {
        theia = true;
        showQuickPick.mockReturnValueOnce("\uFF0B " + "Create a new filter");
        showInputBox.mockReturnValueOnce(undefined);

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");
    });

    it("Tests that filter() works with a file (Theia)", async () => {
        theia = true;
        showQuickPick.mockReturnValueOnce(new utils.FilterDescriptor("/u/thisFile"));

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");
    });

    it("Tests that filter() exits when no selection made (Theia)", async () => {
        theia = true;
        showQuickPick.mockReturnValueOnce(undefined);

        await testTree.filterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Tests that filter() works correctly for favorites", async () => {
        const sessionNoCred = generateISessionWithoutCredentials();
        createBasicZosmfSession.mockReturnValue(sessionNoCred);
        const dsNode = new ZoweUSSNode(
            "[ussTestSess2]: /u/myFile.txt", vscode.TreeItemCollapsibleState.Expanded, null, sessionNoCred, null, false, "ussTestSess2");
        dsNode.mProfileName = "ussTestSess2";
        dsNode.getSession().ISession.user = "";
        dsNode.getSession().ISession.password = "";
        dsNode.getSession().ISession.base64EncodedAuth = "";
        dsNode.contextValue = globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        testTree.mSessionNodes.push(dsNode);

        await testTree.filterPrompt(dsNode);
        testTree.mSessionNodes.forEach((sessionNode) => {
            if (sessionNode === dsNode) { expect(sessionNode.fullPath).toEqual("/u/myFile.txt"); }
        });
    });
});

describe("USSTree Unit Tests - Function USSTree.searchInLoadedItems()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Testing that searchInLoadedItems() returns the correct array", async () => {
        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
        testTree.mSessionNodes[1].children = [folder];
        folder.children.push(file);

        const treeGetChildren = jest.spyOn(testTree, "getChildren").mockImplementationOnce(
            () => Promise.resolve([testTree.mSessionNodes[1]])
        );
        const sessionGetChildren = jest.spyOn(testTree.mSessionNodes[1], "getChildren").mockImplementationOnce(
            () => Promise.resolve(testTree.mSessionNodes[1].children)
        );

        const loadedItems = await testTree.searchInLoadedItems();
        expect(loadedItems).toStrictEqual([file, folder]);
    });
});

describe("USSTree Unit Tests - Function USSTree.saveSearch()", () => {
    const folder = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
        testTree.mSessionNodes[1], null, "/");
    const file = new ZoweUSSNode("abcd", vscode.TreeItemCollapsibleState.None,
        folder, null, "/parent");
    file.contextValue = globals.USS_SESSION_CONTEXT;

    beforeEach(async () => {
        testTree.mFavorites = [];
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Testing that saveSearch() works properly for a folder", async () => {
        await testTree.addFavorite(folder);
        expect(testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        await testTree.addFavorite(file);
        expect(testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a file", async () => {
        testTree.mSessionNodes[1].fullPath = "/z1234";
        await testTree.saveSearch(testTree.mSessionNodes[1]);
        expect(testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly for a session", async () => {
        testTree.mSessionNodes[1].fullPath = "/z1234";
        await testTree.saveSearch(testTree.mSessionNodes[1]);
        expect(testTree.mFavorites.length).toEqual(1);
    });

    it("Testing that saveSearch() works properly on the same session, different path", async () => {
        testTree.mSessionNodes[1].fullPath = "/a1234";
        await testTree.saveSearch(testTree.mSessionNodes[1]);
        testTree.mSessionNodes[1].fullPath = "/r1234";
        await testTree.saveSearch(testTree.mSessionNodes[1]);
        expect(testTree.mFavorites.length).toEqual(2);
    });
});

describe("USSTree Unit Tests - Function USSTree.getChildren()", () => {
    beforeEach(async () => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
        const refreshSpy = jest.spyOn(testTree, "refreshElement");
        showInputBox.mockReturnValueOnce("");

        await testTree.rename(testUSSNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(0);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("Tests that USSTree.rename() fails when error is thrown", async () => {
        showInputBox.mockReturnValueOnce("new name");
        renameUSSFile.mockRejectedValueOnce(Error("testError"));

        try {
            await testTree.rename(testUSSNode);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() is executed successfully for a favorited USS file", async () => {
        const ussFavNode = generateFavoriteUSSNode(testSession, testProfile);
        const removeFavorite = jest.spyOn(testTree, "removeFavorite");
        const addFavorite = jest.spyOn(testTree, "addFavorite");
        showInputBox.mockReturnValueOnce("new name");

        await testTree.rename(ussFavNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        testTree.addRecall("testHistory");
        expect(testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that removeRecall() is executed successfully", async () => {
        testTree.removeRecall("testHistory");
        expect(testTree.getRecall().includes("testHistory")).toEqual(false);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addFavorite()", () => {
    const parentDir = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null, "/");
    const childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None,
            parentDir, null, "/parent");
    childFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;

    beforeEach(() => {
        testTree.mFavorites = [];
=======
describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {

    beforeEach(() => {
>>>>>>> WIP
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

<<<<<<< HEAD
    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that addFavorite() works for directories", async () => {
        await testTree.addFavorite(parentDir);
        expect(testTree.mFavorites[0].fullPath).toEqual(parentDir.fullPath);
    });

    it("Tests that addFavorite() works for files", async () => {
        await testTree.addFavorite(childFile);
        expect(testTree.mFavorites[0].fullPath).toEqual(childFile.fullPath);
    });

    it("Tests that addFavorite() doesn't add duplicates", async () => {
        await testTree.addFavorite(parentDir);
        await testTree.addFavorite(parentDir);
        expect(testTree.mFavorites.length).toEqual(1);
    });
});

describe("USSTree Unit Tests - Function USSTree.removeFavorite()", () => {
    const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed,
    testTree.mSessionNodes[1], null, "/");

    beforeEach(async () => {
        testTree.mFavorites = [];
        await testTree.addFavorite(testDir);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(testTree.mFavorites[0].fullPath).toEqual(testDir.fullPath);

        await testTree.removeFavorite(testTree.mFavorites[0]);
        expect(testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], null, "/a/b");

    beforeEach(async () => {
        withProgress.mockReturnValue(testResponse);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that openItemFromPath opens a USS file in the tree", async () => {
        spyOn(testTree, "getChildren").and.returnValue(Promise.resolve([file]));

        await testTree.openItemFromPath("/a/b/c.txt", testTree.mSessionNodes[1]);
        expect(testTree.getHistory().includes("[sestest]: /a/b/c.txt")).toBe(true);
    });

    it("Tests that openItemFromPath fails when the node no longer exists", async () => {
        spyOn(testTree, "getChildren").and.returnValue(Promise.resolve([]));
        const recallSpy = jest.spyOn(testTree, "removeRecall");

        await testTree.openItemFromPath("/d.txt", testTree.mSessionNodes[1]);
        expect(recallSpy).toBeCalledWith("[sestest]: /d.txt");
    });
});

describe("USSTree Unit Tests - Function USSTree.addSession()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests if addSession works properly", async () => {
        const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null);
        testTree.mSessionNodes.push(testSessionNode);
        testTree.addSession("testSessionNode");

        const foundNode = testTree.mSessionNodes.includes(testSessionNode);
        expect(foundNode).toEqual(true);
    });
});

describe("USSTree Unit Tests - Function USSTree.deleteSession()", () => {
    const testTree2 = addSessionNode(new USSTree(), testSession, testProfile);
    const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null);
    testTree2.mSessionNodes.push(testSessionNode);
    const startLength = testTree2.mSessionNodes.length;

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testTree = addSessionNode(new USSTree(), testSession, testProfile);
    });

    it("Tests that getChildren() returns valid list of elements", async () => {
        const rootChildren = await testTree.getChildren();
        // Creating rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, false),
            new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null, false, testProfile.name)
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
        const testDir = new ZoweUSSNode("testDir", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, "test");
        testTree.mSessionNodes[1].children.push(testDir);
        const mockApiResponseItems = {
            items: [{
                mode: "d",
                mSessionName: "sestest",
                name: "testDir"
            }]
        };
        const mockApiResponseWithItems = generateFileResponse(mockApiResponseItems);
        withProgress.mockReturnValue(mockApiResponseWithItems);
        const sessChildren = await testTree.getChildren(testTree.mSessionNodes[1]);
        const sampleChildren: ZoweUSSNode[] = [testDir];

        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<favorite>", async () => {
        testTree.mFavorites.push(new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null, null));
        const favChildren = await testTree.getChildren(testTree.mSessionNodes[0]);
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null, null)
        ];

        expect(favChildren).toEqual(sampleChildren);
    });

    it("Testing that getChildren() returns correct ZoweUSSNodes when passed element of type ZoweUSSNode<directory>", async () => {
        const directory = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, null);
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
        withProgress.mockReturnValue(mockApiResponseWithItems);

        const dirChildren = await testTree.getChildren(directory);
        expect(dirChildren[0].label).toEqual(sampleChildren[0].label);
    });
});
=======
    it("Tests if deleteSession is executed successfully", async () => {

    });
});
>>>>>>> WIP
