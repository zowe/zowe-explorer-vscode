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
import { ZoweUSSNode } from "../../src/ZoweUSSNode";
import * as testConst from "../../resources/testProfileData";

declare var it: any;

describe("ZoweUSSNode Integration Tests", async () => {
    const TIMEOUT = 120000;
    chai.use(chaiAsPromised);
    // Uses loaded profile to create a zosmf session with brightside
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessNode = new ZoweUSSNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null, session,null);
    sessNode.contextValue = "uss_session";
    sessNode.dirty = true;
    const path = testConst.ussPattern;
    sessNode.fullPath = path + "/group";

    /*************************************************************************************************************
     * Creates an ZoweUSSNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode is defined", async () => {
        // Tests empty node
        const emptyPONode = new ZoweUSSNode(path + "/aDir4", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null);

        expect(emptyPONode.label).toBeDefined();
        expect(emptyPONode.collapsibleState).toBeDefined();
        // sexpect(emptyPONode.getParent()).toBeDefined();

        // Tests PS node
        const PSNode = new ZoweUSSNode(path + "/aFile3.txt", vscode.TreeItemCollapsibleState.None, sessNode, null, null);

        expect(PSNode.label).toBeDefined();
        expect(PSNode.collapsibleState).toBeDefined();
        // expect(PSNode.getParent()).toBeDefined();
    });

    /*************************************************************************************************************
     * Checks that the ZoweUSSNode constructor works as expected when the label parameter is the empty string
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode constructor works as expected when the label parameter is the empty string", async () => {
        // The ZoweUSSNode should still be constructed, and should not throw an error.
        const edgeNode = new ZoweUSSNode("", vscode.TreeItemCollapsibleState.None, sessNode, null, null);

        expect(edgeNode.label).toBeDefined();
        expect(edgeNode.collapsibleState).toBeDefined();
        // expect(edgeNode.mParent).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweUSSNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweUSSNode[]>", async () => {
        let sessChildren;
        try {
            sessChildren = await sessNode.getChildren();
        }
        catch (err) {
            throw (err);
        }

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode(path + "/group/aDir3", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir4", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir5", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
            new ZoweUSSNode(path + "/group/aDir6", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null),
        ];

        sampleChildren[0].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[0]] };
        // tslint:disable-next-line:no-magic-numbers
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[1]] };

        // Checking that the rootChildren are what they are expected to be
// tslint:disable-next-line: no-magic-numbers
        expect(sessChildren.length).toBe(4);
        expect(sessChildren[0].label).toBe("aDir3");
        expect(sessChildren[1].label).toBe("aDir4");
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getChildren() returns the expected value when passed an ZoweUSSNode with all null parameters
     *************************************************************************************************************/
    it("Testing that getChildren works as expected on the null value", async () => {
        const expectChai = chai.expect;
        chai.use(chaiAsPromised);

        // The method should throw an error.
        const nullNode = new ZoweUSSNode(null, null, null, null, null);
        nullNode.contextValue = "pds";
        nullNode.dirty = true;
        await expectChai(nullNode.getChildren()).to.eventually.be.rejectedWith("Invalid node");
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getChildren() returns the expected value when passed an ZoweUSSNode with undefined parameters
     *************************************************************************************************************/
    it("Testing that getChildren works as expected on an undefined value", async () => {
        const expectChai = chai.expect;
        chai.use(chaiAsPromised);

        // The method should throw an error.
        const undefinedNode = new ZoweUSSNode(undefined, undefined, undefined, undefined, undefined);
        undefinedNode.contextValue = "pds";
        undefinedNode.dirty = true;
        // tslint:disable-next-line:max-line-length
        await expectChai(undefinedNode.getChildren()).to.eventually.be.rejectedWith("Invalid node");

    }).timeout(TIMEOUT);

    /*************************************************************************************************************
    * Checks that getChildren() returns the expected value when passed an empty directory
    *************************************************************************************************************/
    it("Testing that getChildren works as expected on an empty directory", async () => {
        // The method should return an empty array.
        const PSNode = new ZoweUSSNode(path + "/aDir6", vscode.TreeItemCollapsibleState.None, sessNode, null, null);
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
        const dir1 = new ZoweUSSNode(path + "./aDir5", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null, null);
        const dir2 = new ZoweUSSNode(path + "/aDir6", vscode.TreeItemCollapsibleState.None, sessNode, null, null);
        const file1 = new ZoweUSSNode(path + "/aDir5/aFile4.txt", vscode.TreeItemCollapsibleState.None, dir1, null, null);

        expect(sessNode.getSession()).toEqual(session);
        expect(dir1.getSession()).toEqual(session);
        expect(dir2.getSession()).toEqual(session);
        expect(file1.getSession()).toEqual(session);

    }).timeout(TIMEOUT);
});
