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

// tslint:disable:no-magic-numbers
import * as zowe from "@brightside/core";
import { Logger } from "@brightside/imperative";
// tslint:disable-next-line:no-implicit-dependencies
import * as expect from "expect";
import * as vscode from "vscode";
import { DatasetTree } from "../../src/DatasetTree";
import { ZoweNode } from "../../src/ZoweNode";
import * as testConst from "../../resources/testProfileData";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as extension from "../../src/extension";
declare var it: any;

describe("DatasetTree Integration Tests", async () => {
    const TIMEOUT = 120000;

    chai.use(chaiAsPromised);
    // Uses loaded profile to create a zosmf session with brightside
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessNode = new ZoweNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null, session);
    sessNode.contextValue = extension.DS_SESSION_CONTEXT;
    const pattern = testConst.normalPattern.toUpperCase();
    sessNode.pattern = pattern + ".PUBLIC";
    const testTree = new DatasetTree();
    testTree.mSessionNodes.splice(-1, 0, sessNode);
    const oldSettings = vscode.workspace.getConfiguration("Zowe-Persistent-Favorites");

    after(async () => {
        await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites", oldSettings, vscode.ConfigurationTarget.Global);
    });

    /*************************************************************************************************************
     * Creates a datasetTree and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Tests that the dataset tree is defined", async () => {
        expect(testTree.mOnDidChangeTreeData).toBeDefined();
        expect(testTree.mSessionNodes).toBeDefined();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     *************************************************************************************************************/
    it("Tests the getTreeItem method", async () => {
        const sampleElement = new ZoweNode("testValue", vscode.TreeItemCollapsibleState.None, null, null);
        chai.expect(testTree.getTreeItem(sampleElement)).to.be.instanceOf(vscode.TreeItem);
    });
    /*************************************************************************************************************
     * Creates sample list of ZoweNodes and checks that datasetTree.getChildren() returns correct array of children
     *************************************************************************************************************/
    it("Tests that getChildren returns valid list of elements", async () => {
        // Waiting until we populate rootChildren with what getChildren returns
        const rootChildren = await testTree.getChildren();
        rootChildren[0].dirty = true;
        const sessChildren = await testTree.getChildren(rootChildren[0]);
        sessChildren[2].dirty = true;
        const PDSChildren = await testTree.getChildren(sessChildren[2]);

        const sampleRChildren: ZoweNode[] = [
            new ZoweNode(pattern + ".PUBLIC.BIN", vscode.TreeItemCollapsibleState.None, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TCLASSIC", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TPS", vscode.TreeItemCollapsibleState.None, sessNode, null),
        ];

        sampleRChildren[0].command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleRChildren[0]]};
        sampleRChildren[3].command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleRChildren[3]]};

        const samplePChildren: ZoweNode[] = [
            new ZoweNode("TCHILD1", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null),
            new ZoweNode("TCHILD2", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null),
        ];

        samplePChildren[0].command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [samplePChildren[0]]};
        samplePChildren[1].command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [samplePChildren[1]]};
        sampleRChildren[2].children = samplePChildren;

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(testTree.mSessionNodes);
        expect(sessChildren).toEqual(sampleRChildren);
        expect(PDSChildren).toEqual(samplePChildren);

    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Testing refresh
     *************************************************************************************************************/
    it("Tests refresh", async () => {
        let eventFired = false;

        const listener = () => {
            eventFired = true;
        };

        // start listening
        const subscription = testTree.mOnDidChangeTreeData.event(listener);
        await testTree.refresh();

        expect(eventFired).toBe(true);

        subscription.dispose(); // stop listening
    }).timeout(TIMEOUT);

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
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Creates a child with a rootNode as parent and checks that a getParent() call returns null.
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweNode
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweNode when called on a non-rootNode ZoweNode", async () => {
        // Creating structure of files and folders under BRTVS99 profile
        const sampleChild1: ZoweNode = new ZoweNode(pattern + ".TPDS", vscode.TreeItemCollapsibleState.None, sessNode, null);

        const parent1 = testTree.getParent(sampleChild1);

        // It's expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(parent1).toBe(sessNode);

        const sampleChild2: ZoweNode = new ZoweNode(pattern + ".TPDS(TCHILD1)",
            vscode.TreeItemCollapsibleState.None, sampleChild1, null);
        const parent2 = testTree.getParent(sampleChild2);

        expect(parent2).toBe(sampleChild1);
    });

    /*************************************************************************************************************
     * Tests the deleteSession() function
     *************************************************************************************************************/
    it("Tests the deleteSession() function", async () => {
        const len = testTree.mSessionNodes.length;
        testTree.deleteSession(sessNode);
        expect(testTree.mSessionNodes.length).toEqual(len - 1);
    });

    /*************************************************************************************************************
     * Tests the deleteSession() function
     *************************************************************************************************************/
    it("Tests the addSession() function by adding a default, deleting, then adding a passed session", async () => {
        const len = testTree.mSessionNodes.length;
        const log = new Logger(undefined);
        await testTree.addSession(log);
        expect(testTree.mSessionNodes.length).toEqual(len + 1);
        testTree.deleteSession(testTree.mSessionNodes[len]);
        await testTree.addSession(testConst.profile.name);
        expect(testTree.mSessionNodes.length).toEqual(len + 1);
    }).timeout(TIMEOUT);

    describe("addFavorite()", () => {
        it("should add the selected data set to the treeView", async () => {
            const favoriteNode = new ZoweNode(pattern + ".TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
            const len = testTree.mFavorites.length;
            await testTree.addFavorite(favoriteNode);
            const filtered = testTree.mFavorites.filter((temp) => temp.label ===
                `[${favoriteNode.getSessionNode().label}]: ${favoriteNode.label}`);
            expect(filtered.length).toEqual(1);
            expect(filtered[0].label).toContain(pattern + ".TPDS");
            // TODO confirm in settings.json too
            testTree.mFavorites = [];
        });

        it("should add a favorite search", async () => {
            await testTree.addFavorite(sessNode);
            const filtered = testTree.mFavorites.filter((temp) => temp.label === `[${sessNode.label}]: ${sessNode.pattern}`);
            expect(filtered.length).toEqual(1);
            expect(filtered[0].label).toContain(`[${sessNode.label}]: ${sessNode.pattern}`);
            testTree.mFavorites = [];
        });
    });

    describe("removeFavorite()", () => {
        it("should remove the selected favorite data set from the treeView", () => {
            const favoriteNode = new ZoweNode(pattern + ".TPDS",
                vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
            testTree.addFavorite(favoriteNode);
            const len = testTree.mFavorites.length;
            testTree.removeFavorite(testTree.mFavorites[len - 1]);
            expect(testTree.mFavorites.length).toEqual(len - 1);
        });

        it("should remove the selected favorite search from the treeView", () => {
            testTree.addFavorite(sessNode);
            const len = testTree.mFavorites.length;
            testTree.removeFavorite(testTree.mFavorites[len - 1]);
            expect(testTree.mFavorites.length).toEqual(len - 1);
        });
    });
});

