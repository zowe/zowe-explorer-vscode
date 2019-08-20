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

import * as zowe from "@brightside/core";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
// tslint:disable-next-line:no-implicit-dependencies
import * as expect from "expect";
import * as vscode from "vscode";
import { ZoweNode } from "../../src/ZoweNode";
import * as testConst from "../../resources/testProfileData";

declare var it: any;

describe("ZoweNode Integration Tests", async () => {
    const TIMEOUT = 120000;
    chai.use(chaiAsPromised);
    // Uses loaded profile to create a zosmf session with brightside
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessNode = new ZoweNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null, session);
    sessNode.contextValue = "session";
    sessNode.dirty = true;
    const pattern = testConst.normalPattern.toUpperCase();
    sessNode.pattern = pattern + ".PUBLIC";

    /*************************************************************************************************************
     * Creates an ZoweNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweNode is defined", async () => {
        // Tests empty PO node
        const emptyPONode = new ZoweNode(pattern + ".TCLASSIC", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);

        expect(emptyPONode.label).toBeDefined();
        expect(emptyPONode.collapsibleState).toBeDefined();
        expect(emptyPONode.mParent).toBeDefined();

        // Tests PS node
        const PSNode = new ZoweNode(pattern + ".TPS", vscode.TreeItemCollapsibleState.None, sessNode, null);

        expect(PSNode.label).toBeDefined();
        expect(PSNode.collapsibleState).toBeDefined();
        expect(PSNode.mParent).toBeDefined();
    });

    /*************************************************************************************************************
     * Checks that the ZoweNode constructor works as expected when the label parameter is the empty string
     *************************************************************************************************************/
    it("Testing that the ZoweNode constructor works as expected when the label parameter is the empty string", async () => {
        // The ZoweNode should still be constructed, and should not throw an error.
        const edgeNode = new ZoweNode("", vscode.TreeItemCollapsibleState.None, sessNode, null);

        expect(edgeNode.label).toBeDefined();
        expect(edgeNode.collapsibleState).toBeDefined();
        expect(edgeNode.mParent).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweNode[]>", async () => {
        let sessChildren;
        try {
            sessChildren = await sessNode.getChildren();
        }
        catch (err) {
            throw (err);
        }

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweNode[] = [
            new ZoweNode(pattern + ".PUBLIC.BIN", vscode.TreeItemCollapsibleState.None, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TCLASSIC", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweNode(pattern + ".PUBLIC.TPS", vscode.TreeItemCollapsibleState.None, sessNode, null)
        ];

        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        // tslint:disable-next-line:no-magic-numbers
        sampleChildren[3].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[3]] };

        // Checking that the rootChildren are what they are expected to be
        expect(sessChildren).toEqual(sampleChildren);
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getChildren() returns the expected value when passed an ZoweNode with all null parameters
     *************************************************************************************************************/
    it("Testing that getChildren works as expected on the null value", async () => {
        const expectChai = chai.expect;
        chai.use(chaiAsPromised);

        // The method should throw an error.
        const nullNode = new ZoweNode(null, null, null, null);
        nullNode.contextValue = "pds";
        nullNode.dirty = true;
        await expectChai(nullNode.getChildren()).to.eventually.be.rejectedWith("Invalid node");
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getChildren() returns the expected value when passed an ZoweNode with all undefined parameters
     *************************************************************************************************************/
    it("Testing that getChildren works as expected on an undefined value", async () => {
        const expectChai = chai.expect;
        chai.use(chaiAsPromised);

        // The method should throw an error.
        const undefinedNode = new ZoweNode(undefined, undefined, undefined, undefined);
        undefinedNode.contextValue = "pds";
        undefinedNode.dirty = true;
        // tslint:disable-next-line:max-line-length
        await expectChai(undefinedNode.getChildren()).to.eventually.be.rejectedWith("Invalid node");

    }).timeout(TIMEOUT);

    /*************************************************************************************************************
    * Checks that getChildren() returns the expected value when passed a PS node
    *************************************************************************************************************/
    it("Testing that getChildren works as expected on a PS node", async () => {
        // The method should return an empty array.
        const PSNode = new ZoweNode(pattern + ".TPS", vscode.TreeItemCollapsibleState.None, sessNode, null);
        let PSNodeChildren;
        try {
            PSNodeChildren = await PSNode.getChildren();
        }
        catch (err) {
            throw (err);
        }

        expect(PSNodeChildren).toEqual([]);

    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getSession() returns the expected value
     *************************************************************************************************************/
    it("Testing that getSession() works as expected", async () => {
        const PDSNode = new ZoweNode(pattern + ".TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
        const PSNode = new ZoweNode(pattern + ".TPS", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const MemNode = new ZoweNode(pattern + ".TPDS(TCHILD1)", vscode.TreeItemCollapsibleState.None, PDSNode, null);

        expect(sessNode.getSession()).toEqual(session);
        expect(PDSNode.getSession()).toEqual(session);
        expect(PSNode.getSession()).toEqual(session);
        expect(MemNode.getSession()).toEqual(session);

    }).timeout(TIMEOUT);
});
