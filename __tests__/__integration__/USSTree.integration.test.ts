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
import * as chai from "chai";
import * as sinon from "sinon";
import * as chaiAsPromised from "chai-as-promised";
// tslint:disable-next-line:no-implicit-dependencies
import * as expect from "expect";
import * as vscode from "vscode";
import * as testConst from "../../resources/testProfileData";
import { USSTree } from "../../src/USSTree";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";

declare var it: any;

describe("USSTree Integration Tests", async () => {
    const TIMEOUT = 120000;

    chai.use(chaiAsPromised);
    // Uses loaded profile to create a zosmf session with brightside
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessNode = new ZoweUSSNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null, session, null);
    sessNode.contextValue = "uss_session";
    const path = testConst.ussPattern;
    sessNode.fullPath = path;
    const testTree = new USSTree();
    testTree.mSessionNodes.splice(-1, 0, sessNode);
    let sandbox;

    beforeEach(async function() {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
    });

    afterEach(async function() {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    const oldSettings = vscode.workspace.getConfiguration("Zowe-USS-Persistent-Favorites");

    after(async () => {
        await vscode.workspace.getConfiguration().update("Zowe-USS-Persistent-Favorites", oldSettings, vscode.ConfigurationTarget.Global);
    });


    /*************************************************************************************************************
     * Creates a USSTree and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Tests that the directory tree is defined", async () => {
        expect(testTree.mOnDidChangeTreeData).toBeDefined();
        expect(testTree.mSessionNodes).toBeDefined();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     *************************************************************************************************************/
    it("Tests the getTreeItem method", async () => {
        const sampleElement = new ZoweUSSNode("testValue", vscode.TreeItemCollapsibleState.None, null, null, null);
        chai.expect(testTree.getTreeItem(sampleElement)).to.be.instanceOf(vscode.TreeItem);
    });
    /*************************************************************************************************************
     * Creates sample list of ZoweUSSNodes and checks that USS
     * Tree.getChildren() returns correct array of children
     *************************************************************************************************************/
    it("Tests that getChildren returns valid list of elements", async () => {
        // Waiting until we populate rootChildren with what getChildren returns
        const rootChildren = await testTree.getChildren();
        rootChildren[0].dirty = true;
        const sessChildren1 = await testTree.getChildren(rootChildren[0]);
        sessChildren1[3].dirty = true;
        const sessChildren2 = await testTree.getChildren(sessChildren1[3]);
        sessChildren2[2].dirty = true;
        const dirChildren = await testTree.getChildren(sessChildren2[2]);

        const sampleRChildren: ZoweUSSNode[] = [
            new ZoweUSSNode(path + "/group/aDir3", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir4", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir5", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir6", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
        ];

        sampleRChildren[0].command = {command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleRChildren[0]]};
        sampleRChildren[3].command = {command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleRChildren[3]]};

        const samplePChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("/aFile4.txt", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null, null),
            new ZoweUSSNode("/aFile5.txt", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null, null),
        ];

        samplePChildren[0].command = {command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [samplePChildren[0]]};
        samplePChildren[1].command = {command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [samplePChildren[1]]};
        sampleRChildren[2].children = samplePChildren;

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(testTree.mSessionNodes);
        expect(sessChildren2.length).toEqual(sampleRChildren.length);
        expect(dirChildren.length).toBe(2);
        expect(dirChildren[0].label).toBe("aFile4.txt");
        expect(dirChildren[0].mParent.tooltip).toContain("/group/aDir5");
        expect(dirChildren[0].tooltip).toContain("/group/aDir5/aFile4.txt");
        expect(dirChildren[1].label).toBe("aFile5.txt");
        expect(dirChildren[1].tooltip).toContain("/group/aDir5/aFile5.txt");

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
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweUSSNode
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweUSSNode when called on a non-rootNode ZoweUSSNode", async () => {
        // Creating structure of files and folders under profile
        const sampleChild1: ZoweUSSNode = new ZoweUSSNode(path + "/aDir5", vscode.TreeItemCollapsibleState.None, sessNode, null, null);

        const parent1 = testTree.getParent(sampleChild1);

        // It's expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(parent1).toBe(sessNode);

        const sampleChild2: ZoweUSSNode = new ZoweUSSNode(path + "/aDir5/aFile4.txt",
            vscode.TreeItemCollapsibleState.None, sampleChild1, null, null);
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
});

