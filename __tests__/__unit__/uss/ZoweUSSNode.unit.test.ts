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

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { generateISession, generateISessionWithoutCredentials, generateIProfile,
    generateFileResponse, generateTreeView, generateInstanceOfProfile } from "../../../__mocks__/generators/shared";
import { generateUSSTree } from "../../../__mocks__/generators/uss";
import * as fs from "fs";
import * as path from "path";
import * as globals from "../../../src/globals";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";

// Globals
const session = generateISession();
const profileOne: imperative.IProfileLoaded = generateIProfile();
const profileOps = generateInstanceOfProfile(profileOne);
const response: zowe.IZosFilesResponse = generateFileResponse();
const ussApi = ZoweExplorerApiRegister.getUssApi(profileOne);

// Mocks
const mocked = (fn: any): jest.Mock => fn;
const withProgress = jest.fn();
const ProgressLocation = jest.fn().mockImplementation(() => {
    return {
        Notification: 15
    };
});

Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn() });
Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn() });
Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn() });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn() });
Object.defineProperty(vscode.window, "withProgress", { value: withProgress });
Object.defineProperty(zowe, "ZosmfSession", { value: jest.fn() });
Object.defineProperty(zowe, "Download", { value: jest.fn() });
Object.defineProperty(zowe, "Delete", { value: jest.fn() });
Object.defineProperty(zowe, "Utilities", {value: jest.fn()});
Object.defineProperty(zowe.Download, "ussFile", { value: jest.fn() });
Object.defineProperty(zowe.Delete, "ussFile", { value: jest.fn() });
Object.defineProperty(zowe.Utilities, "isFileTagBinOrAscii", { value: jest.fn() });
Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: jest.fn() });
Object.defineProperty(fs, "existsSync", { value: jest.fn() });
Object.defineProperty(Profiles, "createInstance", { value: jest.fn(() => profileOps) });
Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => profileOps) });
Object.defineProperty(Profiles, "loadNamedPrfile", { value: jest.fn(() => profileOne) });
Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
Object.defineProperty(ZoweExplorerApiRegister, "getUssApi", { value: jest.fn(() => ussApi) });

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    beforeEach(() => {
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, profileOne.name, undefined);
        testFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        expect(JSON.stringify(rootNode.iconPath)).toContain("folder-closed.svg");
        expect(JSON.stringify(testDir.iconPath)).toContain("folder-closed.svg");
        expect(JSON.stringify(testFile.iconPath)).toContain("document.svg");
        rootNode.iconPath = "Ref: 'folder.svg'";
        testDir.iconPath = "Ref: 'folder.svg'";
        testFile.iconPath = "Ref: 'document.svg'";
        expect(testFile).toMatchSnapshot();
    });

    it("Tests that creating a new USS node initializes all methods and properties", async () => {
        const testNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.None, null, session, null, false, profileOne.name, undefined);
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node.getSession() returns the proper session", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(
            globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);

        const returnedSession = child.getSession();
        expect(returnedSession).toBeDefined();
        expect(returnedSession).toStrictEqual(session);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name, "123");
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    let node;
    const isDirtyInEditor = jest.fn();
    const openedDocumentInstance = jest.fn();

    // USS favorited node definition
    const ussNodeFav = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    ussNodeFav.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
    ussNodeFav.fullPath = "/u/myuser/usstest";
    ussNodeFav.tooltip = "/u/myuser/usstest";

    beforeEach(() => {
        node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        node.contextValue = globals.USS_SESSION_CONTEXT;
        node.fullPath = "/u/myuser";
        Object.defineProperty(node, "isDirtyInEditor", { get: isDirtyInEditor });
        Object.defineProperty(node, "openedDocumentInstance", { get: openedDocumentInstance });
        mocked(zowe.Download.ussFile).mockResolvedValue(response);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user didn't cancel file save", async () => {
        isDirtyInEditor.mockReturnValueOnce(true);
        isDirtyInEditor.mockReturnValueOnce(false);

        await node.refreshUSS();
        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(2);
        expect(mocked(vscode.commands.executeCommand).mock.calls.length).toBe(2);
        expect(mocked(node.downloaded)).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user cancelled file save", async () => {
        isDirtyInEditor.mockReturnValue(true);

        await node.refreshUSS();
        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(0);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.commands.executeCommand).mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() works correctly for not dirty file state", async () => {
        isDirtyInEditor.mockReturnValue(false);

        await node.refreshUSS();
        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(0);
        expect(mocked(vscode.commands.executeCommand).mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        mocked(zowe.Download.ussFile).mockRejectedValue(Error(""));
        isDirtyInEditor.mockReturnValueOnce(true);
        isDirtyInEditor.mockReturnValueOnce(false);

        await node.refreshUSS();
        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.commands.executeCommand).mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(false);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that getEtag() returns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that setEtag() assigns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setBinary()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node.setBinary() works", async () => {
        const rootNode = new ZoweUSSNode(
            globals.FAVORITE_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = globals.FAVORITE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);

        child.setBinary(true);
        expect(child.contextValue).toEqual(globals.DS_BINARY_FILE_CONTEXT);
        expect(JSON.stringify(child.iconPath)).toContain("document-binary.svg");
        child.setBinary(false);
        expect(child.contextValue).toEqual(globals.DS_TEXT_FILE_CONTEXT);
        subNode.setBinary(true);
        expect(subNode.contextValue).toEqual(globals.DS_BINARY_FILE_CONTEXT + globals.FAV_SUFFIX);
        subNode.setBinary(false);
        expect(subNode.contextValue).toEqual(globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.deleteUSSNode()", () => {
    // USS node definition
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profileOne.name);
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    const testUSSTree = generateUSSTree([], [ussNode], generateTreeView());

    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node is deleted if user verified", async () => {
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).toHaveBeenCalled();
    });
    it("Tests that node is not deleted if user did not verify", async () => {
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("No");
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
    it("Tests that node is not deleted if user cancelled", async () => {
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
    it("Tests that node is not deleted if an error thrown", async () => {
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        mocked(zowe.Delete.ussFile).mockImplementationOnce(() => { throw (Error("testError")); });

        try {
            await ussNode.deleteUSSNode(testUSSTree, "");
            // tslint:disable-next-line:no-empty
        } catch (err) { }

        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    let rootNode;
    let childNode;

    beforeEach(() => {
        mocked(vscode.window.showErrorMessage).mockReset();
        rootNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        childNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, "root", false, profileOne.name, undefined);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node.getChildren() returns the correct Thenable<ZoweUSSNode[]>", async () => {
        rootNode.contextValue = globals.USS_DIR_CONTEXT;
        rootNode.dirty = true;

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, session, "/u", false, profileOne.name, undefined),
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, rootNode, session, "/u", false, profileOne.name, undefined),
        ];
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [sampleChildren[1]] };

        const rootChildren = await rootNode.getChildren();

        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");
    });

    it("Tests that node.getChildren() returns no children if none exist", async () => {
        const nodeNoChildren = new ZoweUSSNode(
            "aDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, session, "/u", false, profileOne.name, undefined);
        nodeNoChildren.dirty = false;

        const rootChildren = await nodeNoChildren.getChildren();
        expect(rootChildren.length).toBe(0);
    });

    it("Tests that error is thrown when node label is blank", async () => {
        rootNode.label = "";
        rootNode.dirty = true;

        expect(rootNode.getChildren()).rejects.toEqual(Error("Invalid node"));
    });

    it("Tests that when bright.List. causes an error on the zowe call, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            childNode.contextValue = globals.USS_SESSION_CONTEXT;
            childNode.fullPath = "Throw Error";
            childNode.dirty = true;

            await childNode.getChildren();
            expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toEqual(1);
            expect(mocked(vscode.window.showErrorMessage).mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when bright.List returns an unsuccessful response, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            childNode.contextValue = globals.USS_SESSION_CONTEXT;
            childNode.dirty = true;
            const subNode = new ZoweUSSNode(
                "Response Fail", vscode.TreeItemCollapsibleState.Collapsed, childNode, null, null, false, profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;

            await subNode.getChildren();
            expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toEqual(1);
            expect(mocked(vscode.window.showErrorMessage).mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when passing a session node that is not dirty the node.getChildren() method is exited early", async () => {
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = false;

        expect(await rootNode.getChildren()).toEqual([]);
    });

    it("Tests that when passing a session node with no hlq the node.getChildren() method is exited early", async () => {
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(await rootNode.getChildren()).toEqual([]);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openUSS()", () => {
    let ussNode;
    let dsNode;
    const testUSSTree = generateUSSTree([], [ussNode], generateTreeView());
    globals.defineGlobals("/test/path/");

    testUSSTree.getTreeView.mockReturnValue(generateTreeView());
    mocked(zowe.ZosmfSession.createBasicZosmfSession).mockReturnValue(session);

    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                usesSecurity: true,
                validProfile: ValidProfileEnum.VALID,
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                getDefaultProfile: jest.fn(),
                loadNamedProfile: jest.fn(() => profileOne),
                checkCurrentProfile: jest.fn(),
                refresh: jest.fn(),
                promptCredentials: jest.fn(()=> ["fake", "fake", "fake"]),
                getProfiles: jest.fn(() => {
                    return [{name: profileOne.name, profile: profileOne}, {name: profileOne.name, profile: profileOne}];
                }),
            };
        })
    });

    beforeEach(() => {
        withProgress.mockReturnValue(response);
        mocked(zowe.Download.ussFile).mockReturnValue(response);
        mocked(vscode.window.showInputBox).mockReturnValue("fake");
        mocked(vscode.workspace.openTextDocument).mockResolvedValue("test.doc");

        ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name);
        dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, generateISessionWithoutCredentials(), null);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("Tests that node.openUSS() is executed successfully", async () => {
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, session, "/", false, profileOne.name);

        const isBinSpy = jest.spyOn(ussApi, "isFileTagBinOrAscii");
        mocked(fs.existsSync).mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, testUSSTree);
        expect(mocked(fs.existsSync).mock.calls.length).toBe(1);
        expect(mocked(fs.existsSync).mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(mocked(zowe.Utilities.isFileTagBinOrAscii).mock.calls.length).toBe(1);
        expect(mocked(zowe.Utilities.isFileTagBinOrAscii).mock.calls[0][0]).toBe(session);
        expect(mocked(zowe.Utilities.isFileTagBinOrAscii).mock.calls[0][1]).toBe(node.fullPath);
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        withProgress(jest.fn());
        expect(mocked(vscode.workspace.openTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.workspace.openTextDocument).mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showTextDocument).mock.calls[0][0]).toBe("test.doc");
    });

    it ("Tests that node.openUSS() fails when an error is thrown", async () => {
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/", false, profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent", false, profileOne.name);

        mocked(fs.existsSync).mockReturnValue("exists");
        mocked(vscode.window.showTextDocument).mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(0);
        expect(mocked(vscode.workspace.openTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.workspace.openTextDocument).mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showErrorMessage).mock.calls[0][0]).toBe("testError Error: testError");
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None, favoriteSession, session, "/", false, profileOne.name);
        favoriteFile.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, testUSSTree);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
                               false, profileOne.name);
        favoriteParent.contextValue = globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweUSSNode("favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, profileOne.name);
        child.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, testUSSTree);
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        mocked(vscode.window.showTextDocument).mockReset();
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        mocked(zowe.Utilities.isFileTagBinOrAscii).mockReturnValue(true);
        mocked(fs.existsSync).mockReturnValue(null);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, session, "/", false, ussNode.getProfileName());

        // Make sure correct file is downloaded
        await node.openUSS(false, true, testUSSTree);
        expect(mocked(fs.existsSync).mock.calls.length).toBe(1);
        expect(mocked(fs.existsSync).mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Make sure correct file is displayed in the editor
        withProgress(jest.fn());
        expect(mocked(vscode.workspace.openTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.workspace.openTextDocument).mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(mocked(vscode.window.showTextDocument).mock.calls.length).toBe(1);
        expect(mocked(vscode.window.showTextDocument).mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const badParent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, null);
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badParent, null, null);

        try {
            await brat.openUSS(false, true, testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(mocked(zowe.Download.ussFile).mock.calls.length).toBe(0);
        expect(mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(2);
        expect(mocked(vscode.window.showErrorMessage).mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(mocked(vscode.window.showErrorMessage).mock.calls[1][0]).toBe("open() called from invalid node. Error: open() called from invalid node.");
    });
});
