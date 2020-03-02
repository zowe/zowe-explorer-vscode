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
jest.mock("Session");
import { Session, IProfileLoaded, Logger } from "@zowe/imperative";
import * as vscode from "vscode";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";
import * as utils from "../../src/utils";
import * as extension from "../../src/extension";
import { Profiles } from "../../src/Profiles";

describe("Unit Tests (Jest)", () => {
    Object.defineProperty(vscode.commands, "executeCommand", {value: jest.fn()});
    // Globals
    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
    const profileOne: IProfileLoaded = {
        name: "aProfile",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: false
    };

    const showErrorMessage = jest.fn();
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});

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
        const mockLoadNamedProfile = jest.fn();
        mockLoadNamedProfile.mockReturnValue(profileOne);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    getDefaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    Profiles.createInstance(Logger.getAppLogger());

    /*************************************************************************************************************
     * Checks that the ZoweUSSNode structure is the same as the snapshot
     *************************************************************************************************************/
    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, profileOne.name, undefined);
        testFile.contextValue = extension.DS_TEXT_FILE_CONTEXT;
        expect(JSON.stringify(rootNode.iconPath)).toContain("folder-closed.svg");
        expect(JSON.stringify(testDir.iconPath)).toContain("folder-closed.svg");
        expect(JSON.stringify(testFile.iconPath)).toContain("document.svg");
        rootNode.iconPath = "Ref: 'folder.svg'";
        testDir.iconPath = "Ref: 'folder.svg'";
        testFile.iconPath = "Ref: 'document.svg'";
        await expect(testFile).toMatchSnapshot();
    });

    /*************************************************************************************************************
     * Creates a ZoweUSSNode and checks that its childs are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweUSSNode is defined", async () => {
        const testNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.None, null, session, null, false, profileOne.name, undefined);
        testNode.contextValue = extension.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweUSSNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweUSSNode[]>", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.USS_DIR_CONTEXT;
        rootNode.dirty = true;

        // Creating structure of files and directories
        const elementChildren = {};
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, session, "/u", false, profileOne.name, undefined),
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, rootNode, session, "/u", false, profileOne.name, undefined),

        ];
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [sampleChildren[1]] };

        let rootChildren = await rootNode.getChildren();
        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");

        rootChildren[0].dirty = false;
        await rootChildren[0].getChildren();
        expect(rootChildren[0].children.length).toBe(0);

        // Check that error is thrown when label is blank
        const errorNode = new ZoweUSSNode(
            "", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        errorNode.dirty = true;
        await expect(errorNode.getChildren()).rejects.toEqual(Error("Invalid node"));

        // Check that label is different when label contains a []
        const rootNode2 = new ZoweUSSNode(
            "root[test]", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode2.dirty = true;
        rootChildren = await rootNode2.getChildren();
    });

    /*************************************************************************************************************
     * Checks that the catch block is reached when an error is thrown
     *************************************************************************************************************/
    it("Checks that when bright.List. causes an error on the zowe call, " +
        "it throws an error and the catch block is reached", async () => {
            // Creating a rootNode
            const rootNode = new ZoweUSSNode(
                "toot", vscode.TreeItemCollapsibleState.Collapsed, null, session, "root", false, profileOne.name, undefined);
            rootNode.contextValue = extension.USS_SESSION_CONTEXT;
            rootNode.fullPath = "Throw Error";
            rootNode.dirty = true;
            await rootNode.getChildren();
            expect(showErrorMessage.mock.calls.length).toEqual(1);
            expect(showErrorMessage.mock.calls[0][0]).toEqual("Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    /*************************************************************************************************************
     * Checks that returning an unsuccessful response results in an error being thrown and caught
     *************************************************************************************************************/
    it("Checks that when bright.List returns an unsuccessful response, " +
        "it throws an error and the catch block is reached", async () => {
            // Creating a rootNode
            const rootNode = new ZoweUSSNode(
                "toot", vscode.TreeItemCollapsibleState.Collapsed, null, session, "root", false, profileOne.name, undefined);
            rootNode.contextValue = extension.USS_SESSION_CONTEXT;
            rootNode.dirty = true;
            const subNode = new ZoweUSSNode(
                "Response Fail", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;
            await subNode.getChildren();
            expect(showErrorMessage.mock.calls.length).toEqual(1);
            expect(showErrorMessage.mock.calls[0][0]).toEqual("Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    /*************************************************************************************************************
     * Checks that passing a session node that is not dirty ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node that is not dirty the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.USS_SESSION_CONTEXT;
        rootNode.dirty = false;
        await expect(await rootNode.getChildren()).toEqual([]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.USS_SESSION_CONTEXT;
        await expect(await rootNode.getChildren()).toEqual([]);
    });

    /*************************************************************************************************************
     * Checks that when getSession() is called on a memeber it returns the proper session
     *************************************************************************************************************/
    it("Checks that a child can reach its session properly", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(
            extension.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);
        await expect(child.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Checks that setBinary works
     *************************************************************************************************************/
    it("Checks that set Binary works", async () => {
        const rootNode = new ZoweUSSNode(
            extension.FAVORITE_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = extension.FAVORITE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);

        child.setBinary(true);
        expect(child.contextValue).toEqual(extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX);
        expect(JSON.stringify(child.iconPath)).toContain("document-binary.svg");
        child.setBinary(false);
        expect(child.contextValue).toEqual(extension.DS_TEXT_FILE_CONTEXT);
        subNode.setBinary(true);
        expect(subNode.contextValue).toEqual(extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX);
        subNode.setBinary(false);
        expect(subNode.contextValue).toEqual(extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX);
    });

    /*************************************************************************************************************
     * Checks that labelHack works
     *************************************************************************************************************/
    it("Checks that labelHack subtley alters the label", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        expect(rootNode.label === "gappy");
        utils.labelHack(rootNode);
        expect(rootNode.label === "gappy ");
        utils.labelHack(rootNode);
        expect(rootNode.label === "gappy");
    });

    /*************************************************************************************************************
     * Checks that getEtag() returns a value
     *************************************************************************************************************/
    it("Checks that getEtag() returns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });

    /*************************************************************************************************************
     * Checks that setEtag() assigns a value
     *************************************************************************************************************/
    it("Checks that setEtag() assigns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});
