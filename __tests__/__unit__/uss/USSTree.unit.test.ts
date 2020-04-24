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
import { generateIProfile, generateISession } from "../../../__mocks__/generators/shared";
import { FAV_SUFFIX, USS_DIR_CONTEXT, DS_TEXT_FILE_CONTEXT, USS_SESSION_CONTEXT } from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { generateUSSNode, generateFavoriteUSSNode, addSessionNode } from "../../../__mocks__/generators/uss";
import { getIconByNode } from "../../../src/generators/icons";

const mockLoadNamedProfile = jest.fn();
const mockDefaultProfile = jest.fn();
const executeCommand = jest.fn();
const Utilities = jest.fn();
const renameUSSFile = jest.fn();
const showErrorMessage = jest.fn();
const showInputBox = jest.fn();
const createTreeView = jest.fn();
const getConfiguration = jest.fn();

Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});
Object.defineProperty(Utilities, "renameUSSFile", { value: renameUSSFile });
Object.defineProperty(zowe, "Utilities", { value: Utilities });
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});

const testProfile = generateIProfile();
const testSession = generateISession();

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

describe("USSTree Unit Tests - Function initializeUSSTree()", () => {
    beforeEach(() => {});

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests if initializeUSSTree() is executed successfully", async () => {
        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, testSession, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, testSession, "",
                false, "test"),
        ];

        expectedUSSFavorites.forEach((node) => node.contextValue += FAV_SUFFIX);
        expectedUSSFavorites.forEach((node) => {
            if (node.contextValue !== USS_DIR_CONTEXT + FAV_SUFFIX) {
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
    const ussFavNode = generateFavoriteUSSNode(testSession, testProfile);
    const refreshSpy = jest.spyOn(testTree, "refreshElement");
    const removeFavorite = jest.spyOn(testTree, "removeFavorite");
    const addFavorite = jest.spyOn(testTree, "addFavorite");

    beforeEach(() => {
        testUSSNode.label = "";
        testUSSNode.shortLabel = "";
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that USSTree.rename() is executed successfully", async () => {
        showInputBox.mockReturnValueOnce("new name");

        await testTree.rename(testUSSNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(1);
    });

    it("Tests that USSTree.rename() exits when blank input is provided", async () => {
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
        showInputBox.mockReturnValueOnce("new name");

        await testTree.rename(ussFavNode);
        expect(showErrorMessage.mock.calls.length).toBe(0);
        expect(renameUSSFile.mock.calls.length).toBe(1);
        expect(removeFavorite.mock.calls.length).toBe(1);
        expect(addFavorite.mock.calls.length).toBe(1);
    });
});

describe("USSTree Unit Tests - Functions USSTree.addRecall() & USSTree.getRecall()", () => {
    beforeEach(() => {});

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that addRecall() & getRecall() are executed successfully", async () => {
        testTree.addRecall("testHistory");
        expect(testTree.getRecall()[0]).toEqual("testHistory");
    });
});

describe("USSTree Unit Tests - Functions USSTree.removeRecall()", () => {
    beforeEach(() => {});

    afterEach(() => {
        jest.clearAllMocks();
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
    childFile.contextValue = DS_TEXT_FILE_CONTEXT;

    beforeEach(() => {
        testTree.mFavorites = [];
    });

    afterEach(() => {
        jest.clearAllMocks();
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

    it("Tests that removeFavorite() works properly", async () => {
        // Checking that favorites are set successfully before test
        expect(testTree.mFavorites[0].fullPath).toEqual(testDir.fullPath);

        await testTree.removeFavorite(testTree.mFavorites[0]);
        expect(testTree.mFavorites).toEqual([]);
    });
});

describe("USSTree Unit Tests - Function USSTree.openItemFromPath()", () => {
    const file = new ZoweUSSNode("c.txt", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], null, "/a/b");

    beforeEach(async () => {});

    afterEach(() => {
        jest.clearAllMocks();
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
    const testSessionNode = new ZoweUSSNode("testSessionNode", vscode.TreeItemCollapsibleState.Collapsed, null, testSession, null);
    testTree.mSessionNodes.push(testSessionNode);

    beforeEach(async () => {});

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests if addSession works properly", async () => {
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

    beforeEach(async () => {});

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that deleteSession works properly", async () => {
        testTree2.addSession("ussTestSess2");
        testTree2.mSessionNodes[startLength].contextValue = USS_SESSION_CONTEXT;

        testTree2.deleteSession(testTree2.mSessionNodes[startLength]);
        expect(testTree2.mSessionNodes.length).toEqual(startLength);
    });
});