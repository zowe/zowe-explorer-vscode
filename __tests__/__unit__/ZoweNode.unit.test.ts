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
import * as vscode from "vscode";
import { ZoweNode } from "../../src/ZoweNode";
import { Session } from "@brightside/imperative";
import * as extension from "../../src/extension";
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

    Object.defineProperty(profileLoader, "loadNamedProfile", {value: jest.fn()});
    Object.defineProperty(profileLoader, "loadAllProfiles", {
        value: jest.fn(() => {
            return [{name: "firstName"}, {name: "secondName"}];
        })
    });
    Object.defineProperty(profileLoader, "loadDefaultProfile", {value: jest.fn()});

    afterEach(() => {
        jest.resetAllMocks();
    });
    /*************************************************************************************************************
     * Creates an ZoweNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweNode is defined", async () => {
        const testNode = new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, null, session);
        testNode.contextValue = extension.DS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.mParent).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweNode[]>", async () => {
        // Creating a rootNode
        const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        rootNode.dirty = true;
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        rootNode.pattern = "SAMPLE, SAMPLE.PUBLIC, SAMPLE";
        let rootChildren = await rootNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweNode[] = [
            new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, rootNode, null),
            new ZoweNode("BRTVS99.CA11.SPFTEMP0.CNTL", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null),
            new ZoweNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null),
        ];
        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(sampleChildren);

        rootNode.dirty = true;
        // Check the dirty and children variable have been set
        rootChildren = await rootNode.getChildren();

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(sampleChildren);

        // Check that error is thrown when label is blank
        const errorNode = new ZoweNode("", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        errorNode.dirty = true;
        await expect(errorNode.getChildren()).rejects.toEqual(Error("Invalid node"));

        // Check that label is different when label contains a []
        const rootNode2 = new ZoweNode("root[test]", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        rootNode2.dirty = true;
        rootChildren = await rootNode2.getChildren();
    });

    /*************************************************************************************************************
     * Creates sample ZoweNode list and checks that getChildren() returns the correct array for a PO
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweNode[]> for a PO", async () => {
        // Creating a rootNode
        const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.None, null, session);
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const subNode = new ZoweNode("sub", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        subNode.dirty = true;
        const subChildren = await subNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweNode[] = [
            new ZoweNode("BRTVS99", vscode.TreeItemCollapsibleState.None, subNode, null),
            new ZoweNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.None, subNode, null),
        ];

        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[1]] };
        // Checking that the rootChildren are what they are expected to be
        expect(subChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Checks that the catch block is reached when an error is thrown
     *************************************************************************************************************/
    it("Checks that when bright.List.dataSet/allMembers() causes an error on the brightside call, " +
        "it throws an error and the catch block is reached", async () => {
            // Creating a rootNode
            const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
            rootNode.contextValue = extension.DS_SESSION_CONTEXT;
            rootNode.pattern = "THROW ERROR";
            rootNode.dirty = true;
            await expect(rootNode.getChildren()).rejects.toEqual(Error("Retrieving response from zowe.List\n" +
                "Error: Throwing an error to check error handling for unit tests!\n"));
        });

    /*************************************************************************************************************
     * Checks that returning an unsuccessful response results in an error being thrown and caught
     *************************************************************************************************************/
    it("Checks that when bright.List.dataSet/allMembers() returns an unsuccessful response, " +
        "it throws an error and the catch block is reached", async () => {
            // Creating a rootNode
            const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
            rootNode.contextValue = extension.DS_SESSION_CONTEXT;
            rootNode.dirty = true;
            const subNode = new ZoweNode("Response Fail", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
            subNode.dirty = true;
            await expect(subNode.getChildren()).rejects.toEqual(Error("The response from Zowe CLI was not successful"));
        });

    /*************************************************************************************************************
     * Checks that passing a session node that is not dirty ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node that is not dirty the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        const infoChild = new ZoweNode("Use the search button to display datasets", vscode.TreeItemCollapsibleState.None, rootNode, null, true);
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        rootNode.dirty = false;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        const infoChild = new ZoweNode("Use the search button to display datasets", vscode.TreeItemCollapsibleState.None, rootNode, null, true);
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that when getSession() is called on a memeber it returns the proper session
     *************************************************************************************************************/
    it("Checks that a member can reach its session properly", async () => {
        // Creating a rootNode
        const rootNode = new ZoweNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session);
        rootNode.contextValue = extension.DS_SESSION_CONTEXT;
        const subNode = new ZoweNode(extension.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null);
        const member = new ZoweNode(extension.DS_MEMBER_CONTEXT, vscode.TreeItemCollapsibleState.None, subNode, null);
        await expect(member.getSession()).toBeDefined();
    });
});
