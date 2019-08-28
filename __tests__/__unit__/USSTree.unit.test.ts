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

// tslint:disable:no-shadowed-variable
jest.mock("vscode");
jest.mock("@brightside/imperative");
jest.mock("@brightside/core/lib/zosfiles/src/api/methods/list/doc/IListOptions");
jest.mock("Session");
jest.mock("../../src/ProfileLoader");
import { Session, Logger } from "@brightside/imperative";
import * as vscode from "vscode";
import { USSTree, createUSSTree } from "../../src/USSTree";
import * as utils from "../../src/utils";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";

import * as profileLoader from "../../src/ProfileLoader";


describe("Unit Tests (Jest)", () => {
    // Globals
    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });

    Object.defineProperty(profileLoader, "loadNamedProfile", {
        value: jest.fn((name: string) => {
            return { name };
        })
    });
    Object.defineProperty(profileLoader, "loadAllProfiles", {
        value: jest.fn(() => {
            return [{ name: "profile1" }, { name: "profile2" }];
        })
    });
    Object.defineProperty(profileLoader, "loadDefaultProfile", {
        value: jest.fn(() => {
            return { name: "defaultprofile" };
        })
    });
    const getConfiguration = jest.fn();
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });
    // Filter prompt
    const showInformationMessage = jest.fn();
    const showInputBox = jest.fn();
    const showQuickPick = jest.fn();
    const filters = jest.fn();
    const getFilters = jest.fn();
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(filters, "getFilters", { value: getFilters });
    getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);

    const testTree = new USSTree();
    testTree.mSessionNodes.push(new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, session, null));
    testTree.mSessionNodes[1].contextValue = "uss_session";
    testTree.mSessionNodes[1].fullPath = "test";
    testTree.mSessionNodes[1].iconPath = utils.applyIcons(testTree.mSessionNodes[1]);

    afterEach(async () => {
        getConfiguration.mockClear();
    });

    /*************************************************************************************************************
     * Creates an ZoweUSSNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode is defined", async () => {
        const testNode = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.None, null, session, null);
        testNode.contextValue = "uss_session";

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.mParent).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates a ussTree and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the uss tree is defined", async () => {
        expect(testTree.mSessionNodes).toBeDefined();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     *************************************************************************************************************/
    it("Testing the getTreeItem method", async () => {
        const sampleElement = new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
            null, null, null);
        expect(testTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
    });

    /*************************************************************************************************************
     * Creates sample list of ZoweUSSNodes and checks that ussTree.getChildren() returns correct array of children
     *************************************************************************************************************/
    it("Tests that getChildren returns valid list of elements", async () => {
        // Waiting until we populate rootChildren with what getChildren return
        const rootChildren = await testTree.getChildren();
        // Creating a rootNode
        const sessNode = [
            new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null, null),
            new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, session, null),
        ];
        sessNode[0].contextValue = "favorite";
        sessNode[0].iconPath = utils.applyIcons(sessNode[0]);
        sessNode[1].contextValue = "uss_session";
        sessNode[1].iconPath = utils.applyIcons(sessNode[0]);
        sessNode[1].fullPath = "test";

        // Checking that the rootChildren are what they are expected to be
        expect(sessNode).toEqual(rootChildren);
    });

    /*************************************************************************************************************
     * Creates a rootNode and checks that a getParent() call returns null
     *************************************************************************************************************/
    it("Tests that getParent returns null when called on a rootNode", async () => {
        // Waiting until we populate rootChildren with what getChildren() returns
        const rootChildren = await testTree.getChildren();
        const parent = testTree.getParent(rootChildren[0]);
        // We expect parent to equal null because when we call getParent() on the rootNode
        // It should return null rather than itself
        expect(parent).toEqual(null);
    });

    /*************************************************************************************************************
     * Creates a child with a rootNode as parent and checks that a getParent() call returns null.
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweUSSNode
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweUSSNode when called on a non-rootNode ZoweUSSNode", async () => {
        // Creating fake directories and uss members to test
        const sampleChild1: ZoweUSSNode = new ZoweUSSNode("/u/myUser/zowe1", vscode.TreeItemCollapsibleState.None,
            testTree.mSessionNodes[0], session, null);
        const parent1 = testTree.getParent(sampleChild1);

        // Creating fake directories and uss members to test
        const sampleChild2: ZoweUSSNode = new ZoweUSSNode("/u/myUser/zowe2", vscode.TreeItemCollapsibleState.None,
            sampleChild1, null, null);
        const parent2 = testTree.getParent(sampleChild2);

        // The first expect expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(testTree.getParent(testTree.mSessionNodes[0])).toBe(null);
        expect(parent1).toBe(testTree.mSessionNodes[0]);
        expect(parent2).toBe(sampleChild1);

    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweUSSNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweUSSNodes when called and passed an element of type ZoweUSSNode<session>", async () => {
        testTree.mSessionNodes[1].dirty = true;
        // Waiting until we populate rootChildren with what getChildren return
        const sessChildren = await testTree.getChildren(testTree.mSessionNodes[1]);
        // Creating fake datasets and uss members to test
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, null),
        ];

        // Checking that the rootChildren are what they are expected to be
        expect(sessChildren[0].label).toEqual(sampleChildren[0].label);
    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweUSSNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweUSSNodes when called and passed an element of type ZoweUSSNode<favorite>", async () => {

        // Waiting until we populate rootChildren with what getChildren return
        testTree.mFavorites.push(new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null, null));
        const favChildren = await testTree.getChildren(testTree.mSessionNodes[0]);
        // Creating fake datasets and uss members to test
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null, null)
        ];

        // Checking that the rootChildren are what they are expected to be
        expect(favChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweUSSNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweUSSNodes when called and passed an element of type ZoweUSSNode<directory>", async () => {
        const directory = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, null);
        directory.dirty = true;
        // Waiting until we populate rootChildren with what getChildren return
        const dirChildren = await testTree.getChildren(directory);
        // Creating fake directory and files to test
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, directory, null, null),
        ];
        sampleChildren[0].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[0]] };

        // Checking that the rootChildren are what they are expected to be
        expect(dirChildren[1].label).toEqual(sampleChildren[0].label);
        // expect(dirChildren[1].command).toEqual("zowe.uss.ZoweUSSNode.open");
    });

    /*************************************************************************************************************
     * Tests that the USSTree refresh function exists and doesn't error
     *************************************************************************************************************/
    it("Calling the refresh button ", async () => {
        await testTree.refresh();
    });

    /*************************************************************************************************************
     * Test the addSession command
     *************************************************************************************************************/
    it("Test the addSession command ", async () => {
        const log = new Logger(undefined);

        testTree.addSession(log);

        testTree.addSession(log, "fake");
    });

    /*************************************************************************************************************
     * Testing that addUSSFavorite works properly
     *************************************************************************************************************/
    it("Testing that addUSSFavorite works properly", async () => {
        testTree.mFavorites = [];
        const parentDir = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null, "/");
        const childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None,
            parentDir, null, "/parent");
        childFile.contextValue = "textFile";

        // Check adding directory
        await testTree.addUSSFavorite(parentDir);
        // Check adding duplicates
        await testTree.addUSSFavorite(parentDir);
        // Check adding file
        await testTree.addUSSFavorite(childFile);

        expect(testTree.mFavorites.length).toEqual(2);
    });

    /*************************************************************************************************************
     * Testing that deleteSession works properly
     *************************************************************************************************************/
    it("Testing that deleteSession works properly", async () => {
        testTree.deleteSession(testTree.mSessionNodes[1]);
    });

    /*************************************************************************************************************
     * Testing that removeFavorite works properly
     *************************************************************************************************************/
    it("Testing that removeFavorite works properly", async () => {
        testTree.removeUSSFavorite(testTree.mFavorites[0]);
        testTree.removeUSSFavorite(testTree.mFavorites[0]);

        expect(testTree.mFavorites).toEqual([]);
    });

    /*************************************************************************************************************
     * Testing that expand tree is executed successfully
     *************************************************************************************************************/
    it("Testing that expand tree is executed successfully", async () => {
        const refresh = jest.fn();
        Object.defineProperty(testTree, "refresh", {value: refresh});
        refresh.mockReset();
        const folder = new ZoweUSSNode("/u/myuser", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], session, null);
        folder.contextValue = "directory";
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
        await testTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder.svg");
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
    });

    it("initialize USSTree is executed successfully", async () => {
        // const testUSSTree = new USSTree();
        // createBasicZosmfSession.mockReturnValue(session);
        spyOn(utils, "getSession").and.returnValue(session);
        const testTree1 = await createUSSTree(Logger.getAppLogger());
        expect(testTree1.mFavorites.length).toBe(2);

        const expectedUSSFavorites: ZoweUSSNode[] = [
            new ZoweUSSNode("/u/aDir", vscode.TreeItemCollapsibleState.Collapsed, undefined, session, "",
                false, "test"),
            new ZoweUSSNode("/u/myFile.txt", vscode.TreeItemCollapsibleState.None, undefined, session, "",
                false, "test"),
        ];

        expectedUSSFavorites.map((node) => node.contextValue += "f");
        expectedUSSFavorites.forEach((node) => {
            if (node.contextValue !== "directoryf") {
                node.command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [node] };
            }
        });
        expect(testTree1.mFavorites[0].fullPath).toEqual("/u/aDir");
        expect(testTree1.mFavorites[1].label).toEqual("[test]: myFile.txt");
    });

    /*************************************************************************************************************
     * USS Filter prompts
     *************************************************************************************************************/
    it("Testing that user filter prompts are executed successfully", async () => {
        showInformationMessage.mockReset();
        showQuickPick.mockReset();
        showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        showInputBox.mockReset();
        showInputBox.mockReturnValueOnce("/u/myFiles");

        // Assert choosing the new filter specification followed by a path
        await testTree.ussFilterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/u/myFiles");

        // Assert edge condition user cancels the input path box
        showInformationMessage.mockReset();
        showQuickPick.mockReturnValueOnce(" -- Specify Filter -- ");
        showInputBox.mockReturnValueOnce(undefined);
        await testTree.ussFilterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("You must enter a path.");

        showQuickPick.mockReset();
        showQuickPick.mockReturnValueOnce("/u/thisFile");
        await testTree.ussFilterPrompt(testTree.mSessionNodes[1]);
        expect(testTree.mSessionNodes[1].fullPath).toEqual("/u/thisFile");

        showInformationMessage.mockReset();
        showQuickPick.mockReset();
        showQuickPick.mockReturnValueOnce(undefined);
        await testTree.ussFilterPrompt(testTree.mSessionNodes[1]);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });
    /*************************************************************************************************************
     * Testing the onDidConfiguration
     *************************************************************************************************************/
    it("Testing the onDidConfiguration", async () => {
        getConfiguration.mockReturnValue({
            get: (setting: string) => [
                "[test]: /u/aDir{directory}",
                "[test]: /u/myFile.txt{textFile}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        const mockAffects = jest.fn();
        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: mockAffects
            };
        });
        const e = new Event();
        mockAffects.mockReturnValue(true);

        const enums = jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3
            };
        });
        Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
        await testTree.onDidChangeConfiguration(e);
        expect(getConfiguration.mock.calls.length).toBe(2);
    });
});
