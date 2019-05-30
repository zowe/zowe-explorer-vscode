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

jest.mock("vscode");
jest.mock("fs");
jest.mock("Session");
jest.mock("@brightside/core");
jest.mock("@brightside/imperative");
jest.mock("../src/ProfileLoader");
import * as vscode from "vscode";
import { DatasetTree } from "../src/DatasetTree";
import { ZoweNode } from "../src/ZoweNode";
import { Session } from "@brightside/imperative";

import * as profileLoader from "../src/ProfileLoader";

describe("DatasetTree Unit Tests", async () => {
    // Globals
    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        port: 443,
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
    const testTree = new DatasetTree();
    testTree.mSessionNodes.push(new ZoweNode("testSess", vscode.TreeItemCollapsibleState.Collapsed, null, session));
    testTree.mSessionNodes[1].contextValue = "session";
    testTree.mSessionNodes[1].pattern = "test";

    /*************************************************************************************************************
     * Creates a datasetTree and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the dataset tree is defined", async () => {
        expect(testTree.mSessionNodes).toBeDefined();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     *************************************************************************************************************/
    it("Testing the getTreeItem method", async () => {
        const sampleElement = new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None,
            null, null);
        expect(testTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
    });

    /*************************************************************************************************************
     * Creates sample list of ZoweNodes and checks that datasetTree.getChildren() returns correct array of children
     *************************************************************************************************************/
    it("Tests that getChildren returns valid list of elements", async () => {
        // Waiting until we populate rootChildren with what getChildren return
        const rootChildren = await testTree.getChildren();
        // Creating a rootNode
        const sessNode = [
            new ZoweNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, null),
            new ZoweNode("testSess", vscode.TreeItemCollapsibleState.Collapsed, null, session),
        ];
        sessNode[0].contextValue = "favorite";
        sessNode[1].contextValue = "session";
        sessNode[1].pattern = "test";

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
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweNode
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweNode when called on a non-rootNode ZoweNode", async () => {
        // Creating fake datasets and dataset members to test
        const sampleChild1: ZoweNode = new ZoweNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.None,
            testTree.mSessionNodes[0], session);
        const parent1 = testTree.getParent(sampleChild1);

        // Creating fake datasets and dataset members to test
        const sampleChild2: ZoweNode = new ZoweNode("BRTVS99.PUBLIC.TEST", vscode.TreeItemCollapsibleState.None,
            sampleChild1, null);
        const parent2 = testTree.getParent(sampleChild2);

        // The first expect expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(testTree.getParent(testTree.mSessionNodes[0])).toBe(null);
        expect(parent1).toBe(testTree.mSessionNodes[0]);
        expect(parent2).toBe(sampleChild1);

    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweNodes when called and passed an element of type ZoweNode<session>", async () => {

        // Waiting until we populate rootChildren with what getChildren return
        const sessChildren = await testTree.getChildren(testTree.mSessionNodes[1]);
        // Creating fake datasets and dataset members to test
        const sampleChildren: ZoweNode[] = [
            new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[1], null),
            new ZoweNode("BRTVS99.CA11.SPFTEMP0.CNTL", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null),
            new ZoweNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null),
        ];

        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };

        // Checking that the rootChildren are what they are expected to be
        expect(sessChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweNodes when called and passed an element of type ZoweNode<favorite>", async () => {

        // Waiting until we populate rootChildren with what getChildren return
        testTree.mFavorites.push(new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null));
        const favChildren = await testTree.getChildren(testTree.mSessionNodes[0]);
        // Creating fake datasets and dataset members to test
        const sampleChildren: ZoweNode[] = [
            new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, testTree.mSessionNodes[0], null)
        ];

        // Checking that the rootChildren are what they are expected to be
        expect(favChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Tests that getChildren() method returns an array of all child nodes of passed ZoweNode
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct ZoweNodes when called and passed an element of type ZoweNode<pds>", async () => {
        const pds = new ZoweNode("BRTVS99.PUBLIC", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[1], null);

        // Waiting until we populate rootChildren with what getChildren return
        const pdsChildren = await testTree.getChildren(pds);
        // Creating fake datasets and dataset members to test
        const sampleChildren: ZoweNode[] = [
            new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, pds, null),
            new ZoweNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.None, pds, null),
        ];

        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[1]] };

        // Checking that the rootChildren are what they are expected to be
        expect(pdsChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Tests that the DatasetTree refresh function exists and doesn't error
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
     * Testing that addFavorite works properly
     *************************************************************************************************************/
    it("Testing that addFavorite works properly", async () => {
        testTree.mFavorites = [];
        const parent = new ZoweNode("Parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null);
        const member = new ZoweNode("Child", vscode.TreeItemCollapsibleState.None,
            parent, null);

        await testTree.addFavorite(member);

        // Check adding duplicates
        const pds = new ZoweNode("Parent", vscode.TreeItemCollapsibleState.Collapsed,
            testTree.mSessionNodes[1], null);

        await testTree.addFavorite(pds);

        // Check adding ps
        const ps = new ZoweNode("Dataset", vscode.TreeItemCollapsibleState.None,
            testTree.mSessionNodes[1], null);

        testTree.addFavorite(ps);

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
        testTree.removeFavorite(testTree.mFavorites[0]);
        testTree.removeFavorite(testTree.mFavorites[0]);

        expect(testTree.mFavorites).toEqual([]);
    });
});
