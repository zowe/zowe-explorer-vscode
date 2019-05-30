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
jest.mock("../src/ProfileLoader");
import { Session } from "@brightside/imperative";
import * as vscode from "vscode";
import { USSTree } from "../src/USSTree";
import { ZoweUSSNode } from "../src/ZoweUSSNode";

import * as profileLoader from "../src/ProfileLoader";

describe("Unit Tests (Jest)", async () => {
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
            return [{ name: "profile1" }, { name: "profile2" }]
        })
    });
    Object.defineProperty(profileLoader, "loadDefaultProfile", {
        value: jest.fn(() => {
            return { name: "defaultprofile" };
        })
    });

    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value:
            jest.fn(()=>{
                return {
                    get: jest.fn(()=>{
                        return {};
                    })
                };
            })
    });

    const testTree = new USSTree();
    testTree.mSessionNodes.push(new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Collapsed, null, session, null));
    testTree.mSessionNodes[1].contextValue = "uss_session";
    testTree.mSessionNodes[1].fullPath = "test";
    /*************************************************************************************************************
     * Creates an ZoweUSSNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode is defined", async () => {
        const testNode = new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.None, null, session, null);
        testNode.contextValue = "uss_session";

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.mLabel).toBeDefined();
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
            new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Collapsed, null, session, null),
        ];
        sessNode[0].contextValue = "favorite";
        sessNode[1].contextValue = "uss_session";
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

        // Waiting until we populate rootChildren with what getChildren return
        const sessChildren = await testTree.getChildren(testTree.mSessionNodes[1]);
        // Creating fake datasets and uss members to test
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null, null),
        ];

        // Checking that the rootChildren are what they are expected to be
        expect(sessChildren[0].mLabel).toEqual(sampleChildren[0].mLabel);
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

        // Waiting until we populate rootChildren with what getChildren return
        const dirChildren = await testTree.getChildren(directory);
        // Creating fake directory and files to test
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, directory, null, null),
        ];
        sampleChildren[0].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[0]] };

        // Checking that the rootChildren are what they are expected to be
        expect(dirChildren[1].mLabel).toEqual(sampleChildren[0].mLabel);
        //expect(dirChildren[1].command).toEqual("zowe.uss.ZoweUSSNode.open");
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
        testTree.addSession();

        testTree.addSession("fake");
    });

    /*************************************************************************************************************
     * Testing that addUSSFavorite works properly
     *************************************************************************************************************/
    it("Testing that addUSSFavorite works properly", async () => {
        testTree.mFavorites = [];
        const parentDir = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null, "/");
        const childFile = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.Collapsed,
            parentDir, null, "/parent");
        
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
});
