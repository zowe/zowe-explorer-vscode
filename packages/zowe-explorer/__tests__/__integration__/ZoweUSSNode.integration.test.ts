/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { imperative } from "@zowe/zowe-explorer-api";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as expect from "expect";
import * as vscode from "vscode";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as testConst from "../../resources/testProfileData";
import { DS_PDS_CONTEXT, USS_SESSION_CONTEXT } from "../../src/globals";

declare let it: any;

const testProfile: imperative.IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false,
};

describe("ZoweUSSNode Integration Tests", async () => {
    const TIMEOUT = 120000;
    chai.use(chaiAsPromised);

    // Uses loaded profile to create a zosmf session with Zowe
    const cmdArgs: imperative.ICommandArguments = {
        $0: "zowe",
        _: [""],
        host: testProfile.profile.host,
        port: testProfile.profile.port,
        basePath: testProfile.profile.basePath,
        rejectUnauthorized: testProfile.profile.rejectUnauthorized,
        user: testProfile.profile.user,
        password: testProfile.profile.password,
    };
    const sessCfg = zosmf.ZosmfSession.createSessCfgFromArgs(cmdArgs);
    imperative.ConnectionPropsForSessCfg.resolveSessCfgProps(sessCfg, cmdArgs);
    const session = new imperative.Session(sessCfg);
    const sessNode = new ZoweUSSNode({
        label: testConst.profile.name,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session,
        profile: testConst.profile.profile,
    });
    sessNode.contextValue = USS_SESSION_CONTEXT;
    sessNode.dirty = true;
    const path = testConst.ussPattern;
    sessNode.fullPath = path + "/group";

    /*************************************************************************************************************
     * Creates an ZoweUSSNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode is defined", async () => {
        // Tests empty node
        const emptyPONode = new ZoweUSSNode({
            label: path + "/aDir4",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessNode,
        });

        expect(emptyPONode.label).toBeDefined();
        expect(emptyPONode.collapsibleState).toBeDefined();

        // Tests PS node
        const PSNode = new ZoweUSSNode({ label: path + "/aFile3.txt", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: sessNode });

        expect(PSNode.label).toBeDefined();
        expect(PSNode.collapsibleState).toBeDefined();
    });

    /*************************************************************************************************************
     * Checks that the ZoweUSSNode constructor works as expected when the label parameter is the empty string
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode constructor works as expected when the label parameter is the empty string", async () => {
        // The ZoweUSSNode should still be constructed, and should not throw an error.
        const edgeNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: sessNode });

        expect(edgeNode.label).toBeDefined();
        expect(edgeNode.collapsibleState).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweUSSNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweUSSNode[]>", async () => {
        const sessChildren = await sessNode.getChildren();

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode({ label: path + "/group/aDir3", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, parentNode: sessNode }),
            new ZoweUSSNode({ label: path + "/group/aDir4", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, parentNode: sessNode }),
            new ZoweUSSNode({ label: path + "/group/aDir5", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, parentNode: sessNode }),
            new ZoweUSSNode({ label: path + "/group/aDir6", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, parentNode: sessNode }),
        ];

        sampleChildren[0].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "", arguments: [sampleChildren[1]] };

        // Checking that the rootChildren are what they are expected to be
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
        const nullNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        nullNode.contextValue = DS_PDS_CONTEXT;
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
        const undefinedNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        undefinedNode.contextValue = DS_PDS_CONTEXT;
        undefinedNode.dirty = true;
        await expectChai(undefinedNode.getChildren()).to.eventually.be.rejectedWith("Invalid node");
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getChildren() returns the expected value when passed an empty directory
     *************************************************************************************************************/
    it("Testing that getChildren works as expected on an empty directory", async () => {
        // The method should return an empty array.
        const PSNode = new ZoweUSSNode({ label: path + "/aDir6", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: sessNode });
        const PSNodeChildren = await PSNode.getChildren();
        expect(PSNodeChildren).toEqual([]);
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Checks that getSession() returns the expected value
     *************************************************************************************************************/
    it("Testing that getSession() works as expected", async () => {
        const dir1 = new ZoweUSSNode({ label: path + "./aDir5", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, parentNode: sessNode });
        const dir2 = new ZoweUSSNode({ label: path + "/aDir6", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: sessNode });
        const file1 = new ZoweUSSNode({
            label: path + "/aDir5/aFile4.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: dir1,
        });

        expect(sessNode.getSession()).toEqual(session);
        expect(dir1.getSession()).toEqual(session);
        expect(dir2.getSession()).toEqual(session);
        expect(file1.getSession()).toEqual(session);
    }).timeout(TIMEOUT);
});
