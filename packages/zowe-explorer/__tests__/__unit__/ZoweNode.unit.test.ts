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
jest.mock("@zowe/imperative");
jest.mock("@zowe/cli");
jest.mock("Session");
import * as vscode from "vscode";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { Session, IProfileLoaded } from "@zowe/imperative";
import { List } from "@zowe/cli";
import { DS_PDS_CONTEXT, DS_SESSION_CONTEXT, INFORMATION_CONTEXT, DS_MEMBER_CONTEXT,
    DS_MIGRATED_FILE_CONTEXT, DS_DS_CONTEXT, VSAM_CONTEXT } from "../../src/globals";

describe("Unit Tests (Jest)", () => {
    // Globals
    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
    const profileOne: IProfileLoaded = { name: "profile1", profile: {}, type: "zosmf", message: "", failNotFound: false };
    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15
        };
    });

    const withProgress = jest.fn().mockImplementation((progLocation, callback) => {
        return callback();
    });

    Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
    Object.defineProperty(vscode.window, "withProgress", {value: withProgress});

    beforeEach(() => {
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });

    const showErrorMessage = jest.fn();
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});

    afterEach(() => {
        jest.resetAllMocks();
    });

    /*************************************************************************************************************
     * Creates an ZoweDatasetNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweDatasetNode is defined", async () => {
        const testNode = new ZoweDatasetNode("BRTVS99", vscode.TreeItemCollapsibleState.None, null, session);
        testNode.contextValue = DS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweDatasetNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweDatasetNode[]>", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        rootNode.dirty = true;
        rootNode.contextValue = DS_SESSION_CONTEXT;
        rootNode.pattern = "SAMPLE, SAMPLE.PUBLIC, SAMPLE";
        let rootChildren = await rootNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode("BRTVS99", vscode.TreeItemCollapsibleState.None, rootNode, null, undefined, undefined, profileOne),
            new ZoweDatasetNode("BRTVS99.CA10", vscode.TreeItemCollapsibleState.None, rootNode, null, DS_MIGRATED_FILE_CONTEXT,
                undefined, profileOne),
            new ZoweDatasetNode("BRTVS99.CA11.SPFTEMP0.CNTL", vscode.TreeItemCollapsibleState.Collapsed,
                                rootNode, null, undefined, undefined, profileOne),
            new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, undefined, undefined, profileOne),
            new ZoweDatasetNode("BRTVS99.VS1", vscode.TreeItemCollapsibleState.None, rootNode, null, VSAM_CONTEXT, undefined, profileOne)
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
        const errorNode = new ZoweDatasetNode("", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        errorNode.dirty = true;
        await expect(errorNode.getChildren()).rejects.toEqual(Error("Invalid node"));

        // Check that label is different when label contains a []
        const rootNode2 = new ZoweDatasetNode("root[test]", vscode.TreeItemCollapsibleState.Collapsed,
                                            null, session, undefined, undefined, profileOne);
        rootNode2.dirty = true;
        rootChildren = await rootNode2.getChildren();
    });

    /*************************************************************************************************************
     * Creates sample ZoweDatasetNode list and checks that getChildren() returns the correct array for a PO
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweDatasetNode[]> for a PO", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.None, null, session, undefined, undefined, profileOne);
        rootNode.contextValue = DS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const subNode = new ZoweDatasetNode("sub", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, undefined, undefined, profileOne);
        subNode.dirty = true;
        const subChildren = await subNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode("BRTVS99", vscode.TreeItemCollapsibleState.None, subNode, null, undefined, undefined, profileOne),
            new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.None, subNode, null, undefined, undefined, profileOne),
        ];

        sampleChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleChildren[1]] };
        // Checking that the rootChildren are what they are expected to be
        expect(subChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Checks that the catch block is reached when an error is thrown
     *************************************************************************************************************/
    it("Checks that when bright.List.dataSet/allMembers() causes an error on the zowe call, " +
        "it throws an error and the catch block is reached", async () => {

            showErrorMessage.mockReset();
            // Creating a rootNode
            const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
            rootNode.contextValue = DS_SESSION_CONTEXT;
            rootNode.pattern = "THROW ERROR";
            rootNode.dirty = true;
            await rootNode.getChildren();
            expect(showErrorMessage.mock.calls.length).toEqual(2);
            expect(showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from zowe.List Error: Throwing an error to check error handling for unit tests!");
        });

    /*************************************************************************************************************
     * Checks that returning an unsuccessful response results in an error being thrown and caught
     *************************************************************************************************************/
    it("Checks that when bright.List.dataSet/allMembers() returns an unsuccessful response, " +
        "it throws an error and the catch block is reached", async () => {
            // Creating a rootNode
            const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session,
                undefined, undefined, profileOne);
            rootNode.contextValue = DS_SESSION_CONTEXT;
            rootNode.dirty = true;
            const subNode = new ZoweDatasetNode("Response Fail", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null,
                undefined, undefined, profileOne);
            subNode.dirty = true;
            await expect(subNode.getChildren()).rejects.toThrow("The response from Zowe CLI was not successful");
        });

    /*************************************************************************************************************
     * Checks that passing a session node that is not dirty ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node that is not dirty the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        const infoChild = new ZoweDatasetNode("Use the search button to display datasets", vscode.TreeItemCollapsibleState.None, rootNode, null,
            INFORMATION_CONTEXT, undefined, profileOne);
        rootNode.contextValue = DS_SESSION_CONTEXT;
        rootNode.dirty = false;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        const infoChild = new ZoweDatasetNode("Use the search button to display datasets", vscode.TreeItemCollapsibleState.None, rootNode, null,
            INFORMATION_CONTEXT, undefined, profileOne);
        rootNode.contextValue = DS_SESSION_CONTEXT;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that when getSession() is called on a memeber it returns the proper session
     *************************************************************************************************************/
    it("Checks that a member can reach its session properly", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        rootNode.contextValue = DS_SESSION_CONTEXT;
        const subNode = new ZoweDatasetNode(DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null,
            undefined, undefined, profileOne);
        const member = new ZoweDatasetNode(DS_MEMBER_CONTEXT, vscode.TreeItemCollapsibleState.None, subNode, null,
            undefined, undefined, profileOne);
        await expect(member.getSession()).toBeDefined();
    });
    /*************************************************************************************************************
     * Tests that certain types can't have children
     *************************************************************************************************************/
    it("Testing that certain types can't have children", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        rootNode.dirty = true;
        rootNode.contextValue = DS_DS_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = DS_MEMBER_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = INFORMATION_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
    });
    /*************************************************************************************************************
     * Tests that we shouldn't be updating children
     *************************************************************************************************************/
    it("Tests that we shouldn't be updating children", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);
        rootNode.children = [new ZoweDatasetNode("onestep", vscode.TreeItemCollapsibleState.Collapsed,
                                                 null, session, undefined, undefined, profileOne)];
        rootNode.dirty = false;
        rootNode.contextValue = DS_PDS_CONTEXT;
        expect((await rootNode.getChildren())[0].label).toEqual("onestep");
    });

    /*************************************************************************************************************
     * Run with a favorite
     *************************************************************************************************************/
    it("Testing Run with a favorite", async () => {
        // Creating a rootNode
        const pds = new ZoweDatasetNode("[root]: something", vscode.TreeItemCollapsibleState.Collapsed,
                                         null, session, undefined, undefined, profileOne);
        pds.dirty = true;
        pds.contextValue = DS_PDS_CONTEXT;
        expect((await pds.getChildren())[0].label).toEqual("BRTVS99");
    });

    /*************************************************************************************************************
     * No values returned
     *************************************************************************************************************/
    it("Testing what happens when response is zero", async () => {
        // Creating a rootNode
        const pds = new ZoweDatasetNode("[root]: something", vscode.TreeItemCollapsibleState.Collapsed,
                                         null, session, undefined, undefined, profileOne);
        pds.dirty = true;
        pds.contextValue = DS_PDS_CONTEXT;
        const allMembers = jest.fn();
        allMembers.mockImplementationOnce(() => {
            return {
                success: true,
                apiResponse: {
                    items: [
                    ]
                }
            };
        });
        Object.defineProperty(List, "allMembers", {value: allMembers});
        expect((await pds.getChildren())[0].label).toEqual("No datasets found");
    });

});
