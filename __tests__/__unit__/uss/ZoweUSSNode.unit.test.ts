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
import { generateSession, generateSessionNoCredentials, generateProfile, generateFileResponse, generateTreeView, generateInstanceOfProfile } from "../../../__mocks__/generators/shared";
import { generateUSSTree } from "../../../__mocks__/generators/uss";
import * as fs from "fs";
import * as path from "path";
import { FAVORITE_CONTEXT, DS_BINARY_FILE_CONTEXT, DS_TEXT_FILE_CONTEXT, FAV_SUFFIX, USS_SESSION_CONTEXT,
    USS_DIR_CONTEXT, USS_DIR, defineGlobals, DS_PDS_CONTEXT } from "../../../src/globals";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";

const ussFile = jest.fn();
const Download = jest.fn();
const isDirtyInEditor = jest.fn();
const openedDocumentInstance = jest.fn();
const onDidSaveTextDocument = jest.fn();
const showErrorMessage = jest.fn();
const openTextDocument = jest.fn();
const showTextDocument = jest.fn();
const showInformationMessage = jest.fn();
const getConfiguration = jest.fn();
const downloadUSSFile = jest.fn();
const showInputBox = jest.fn();
const executeCommand = jest.fn();
const mockLoadNamedProfile = jest.fn();
const showQuickPick = jest.fn();
const isFileTagBinOrAscii = jest.fn();
const existsSync = jest.fn();
const Delete = jest.fn();
const Utilities = jest.fn();
const withProgress = jest.fn();
const createBasicZosmfSession = jest.fn();
const ZosmfSession = jest.fn();
const getUssApiMock = jest.fn();

Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: onDidSaveTextDocument });
Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand });
Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: openTextDocument });
Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
Object.defineProperty(vscode.window, "showTextDocument", { value: showTextDocument });
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(Utilities, "isFileTagBinOrAscii", {value: isFileTagBinOrAscii});
Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
Object.defineProperty(zowe, "ZosmfSession", {value: ZosmfSession});
Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {value: createBasicZosmfSession});
Object.defineProperty(zowe, "Download", { value: Download });
Object.defineProperty(zowe, "Utilities", {value: Utilities});
Object.defineProperty(Download, "ussFile", { value: ussFile });
Object.defineProperty(zowe, "Delete", { value: Delete });
Object.defineProperty(fs, "existsSync", {value: existsSync});
Object.defineProperty(Delete, "ussFile", { value: ussFile });
Object.defineProperty(Profiles, "createInstance", {
    value: jest.fn(() => {
        return profileOps;
    })
});
Object.defineProperty(Profiles, "getInstance", {
    value: jest.fn(() => {
        return profileOps;
    })
});
const ProgressLocation = jest.fn().mockImplementation(() => {
    return {
        Notification: 15
    };
});
Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
Object.defineProperty(vscode.window, "withProgress", {value: withProgress});

const session = generateSession();
const profileOne: imperative.IProfileLoaded = generateProfile();
mockLoadNamedProfile.mockReturnValue(profileOne);
const profileOps = generateInstanceOfProfile(profileOne);
const response: zowe.IZosFilesResponse = generateFileResponse();
const ussApi = ZoweExplorerApiRegister.getUssApi(profileOne);
getUssApiMock.mockReturnValue(ussApi);
ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    beforeEach(() => {
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, profileOne.name, undefined);
        testFile.contextValue = DS_TEXT_FILE_CONTEXT;
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
        testNode.contextValue = USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node.getSession() returns the proper session", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(
            DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);

        const returnedSession = child.getSession();
        expect(returnedSession).toBeDefined();
        expect(returnedSession).toStrictEqual(session);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name, "123");
    ussNode.contextValue = USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    let node;

    // USS favorited node definition
    const ussNodeFav = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    ussNodeFav.contextValue = DS_TEXT_FILE_CONTEXT + FAV_SUFFIX;
    ussNodeFav.fullPath = "/u/myuser/usstest";
    ussNodeFav.tooltip = "/u/myuser/usstest";

    const testUSSTree = generateUSSTree([ussNodeFav], [ussNode], generateTreeView());

    beforeEach(() => {
        showErrorMessage.mockReset();
        showTextDocument.mockReset();
        ussFile.mockReset();
        executeCommand.mockReset();
        isDirtyInEditor.mockReset();
        openedDocumentInstance.mockReset();
        node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
        node.contextValue = USS_SESSION_CONTEXT;
        node.fullPath = "/u/myuser";
        Object.defineProperty(node, "isDirtyInEditor", {
            get: isDirtyInEditor
        });
        Object.defineProperty(node, "openedDocumentInstance", {
            get: openedDocumentInstance
        });
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user didn't cancel file save", async () => {
        ussFile.mockResolvedValue(response);
        isDirtyInEditor.mockReturnValueOnce(true);
        isDirtyInEditor.mockReturnValueOnce(false);

        await node.refreshUSS();

        expect(ussFile.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(2);
        expect(executeCommand.mock.calls.length).toBe(2);
        expect(node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user cancelled file save", async () => {
        ussFile.mockResolvedValueOnce(response);
        isDirtyInEditor.mockReturnValueOnce(true);
        isDirtyInEditor.mockReturnValueOnce(true);

        await node.refreshUSS();

        expect(ussFile.mock.calls.length).toBe(0);
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(executeCommand.mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() works correctly for not dirty file state", async () => {
        ussFile.mockResolvedValueOnce(response);
        isDirtyInEditor.mockReturnValueOnce(false);
        isDirtyInEditor.mockReturnValueOnce(false);

        await node.refreshUSS();

        expect(ussFile.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(0);
        expect(executeCommand.mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        ussFile.mockRejectedValueOnce(Error(""));
        isDirtyInEditor.mockReturnValueOnce(true);
        isDirtyInEditor.mockReturnValueOnce(false);

        await node.refreshUSS();

        expect(ussFile.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(executeCommand.mock.calls.length).toBe(1);
        expect(node.downloaded).toBe(false);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that getEtag() returns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    afterAll(() => {
        jest.clearAllMocks();
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
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node.setBinary() works", async () => {
        const rootNode = new ZoweUSSNode(
            FAVORITE_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        rootNode.contextValue = FAVORITE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, profileOne.name, undefined);

        child.setBinary(true);
        expect(child.contextValue).toEqual(DS_BINARY_FILE_CONTEXT);
        expect(JSON.stringify(child.iconPath)).toContain("document-binary.svg");
        child.setBinary(false);
        expect(child.contextValue).toEqual(DS_TEXT_FILE_CONTEXT);
        subNode.setBinary(true);
        expect(subNode.contextValue).toEqual(DS_BINARY_FILE_CONTEXT + FAV_SUFFIX);
        subNode.setBinary(false);
        expect(subNode.contextValue).toEqual(DS_TEXT_FILE_CONTEXT + FAV_SUFFIX);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.deleteUSSNode()", () => {
    // USS node definition
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profileOne.name);
    ussNode.contextValue = USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    const testUSSTree = generateUSSTree([], [ussNode], generateTreeView());

    beforeEach(() => {
        showErrorMessage.mockReset();
        showQuickPick.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node is deleted if user verified", async () => {
        showQuickPick.mockResolvedValueOnce("Yes");
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).toHaveBeenCalled();
    });
    it("Tests that node is not deleted if user did not verify", async () => {
        showQuickPick.mockResolvedValueOnce("No");
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
    it("Tests that node is not deleted if user cancelled", async () => {
        showQuickPick.mockResolvedValueOnce(undefined);
        await ussNode.deleteUSSNode(testUSSTree, "");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
    it("Tests that node is not deleted if an error thrown", async () => {
        showQuickPick.mockResolvedValueOnce("Yes");
        ussFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await ussNode.deleteUSSNode(testUSSTree, "");
            // tslint:disable-next-line:no-empty
        } catch (err) { }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    let rootNode;
    let childNode;

    beforeEach(() => {
        showErrorMessage.mockReset();
        rootNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        childNode = new ZoweUSSNode(
            "root", vscode.TreeItemCollapsibleState.Collapsed, null, session, "root", false, profileOne.name, undefined);
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node.getChildren() returns the correct Thenable<ZoweUSSNode[]>", async () => {
        rootNode.contextValue = USS_DIR_CONTEXT;
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

    // CAN ANYONE EXPLAIN WHAT THIS IS SUPPOSED TO TEST???
    // It is from ZoweUSSNode.unit.test.ts, line 150
    //
    // it("Tests that label is different when label contains a []", async () => {
    //     const rootNode2 = new ZoweUSSNode(
    //         "root[test]", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
    //     rootNode2.dirty = true;
    //     let rootChildren = await rootNode2.getChildren();
    // });

    it("Tests that when bright.List. causes an error on the zowe call, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            childNode.contextValue = USS_SESSION_CONTEXT;
            childNode.fullPath = "Throw Error";
            childNode.dirty = true;

            await childNode.getChildren();

            expect(showErrorMessage.mock.calls.length).toEqual(1);
            expect(showErrorMessage.mock.calls[0][0]).toEqual("Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when bright.List returns an unsuccessful response, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            childNode.contextValue = USS_SESSION_CONTEXT;
            childNode.dirty = true;
            const subNode = new ZoweUSSNode(
                "Response Fail", vscode.TreeItemCollapsibleState.Collapsed, childNode, null, null, false, profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;

            await subNode.getChildren();

            expect(showErrorMessage.mock.calls.length).toEqual(1);
            expect(showErrorMessage.mock.calls[0][0]).toEqual("Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when passing a session node that is not dirty the node.getChildren() method is exited early", async () => {
        rootNode.contextValue = USS_SESSION_CONTEXT;
        rootNode.dirty = false;

        expect(await rootNode.getChildren()).toEqual([]);
    });

    it("Tests that when passing a session node with no hlq the node.getChildren() method is exited early", async () => {
        rootNode.contextValue = USS_SESSION_CONTEXT;

        expect(await rootNode.getChildren()).toEqual([]);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openUSS()", () => {
    let ussNode;
    let dsNode;
    const testUSSTree = generateUSSTree([], [ussNode], generateTreeView());
    defineGlobals("/test/path/");

    testUSSTree.getTreeView.mockReturnValue(generateTreeView());
    createBasicZosmfSession.mockReturnValue(session);

    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                getDefaultProfile: mockLoadNamedProfile,
                promptCredentials: jest.fn(()=> {
                    return ["fake", "fake", "fake"];
                }),
                loadNamedProfile: mockLoadNamedProfile,
                usesSecurity: true,
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
                getProfiles: jest.fn(() => {
                    return [{name: profileOne.name, profile: profileOne}, {name: profileOne.name, profile: profileOne}];
                }),
                refresh: jest.fn(),
            };
        })
    });

    beforeEach(() => {
        ussFile.mockReset();
        openTextDocument.mockReset();
        showTextDocument.mockReset();
        showErrorMessage.mockReset();
        existsSync.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();

        ussFile.mockReturnValue(response);
        withProgress.mockReturnValue(response);
        openTextDocument.mockResolvedValue("test.doc");
        showInputBox.mockReturnValue("fake");

        ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name, "123");
        dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, ussNode, generateSessionNoCredentials(), null);
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that node.openUSS() is executed successfully", async () => {
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, session, "/", false, profileOne.name);

        const isBinSpy = jest.spyOn(ussApi, "isFileTagBinOrAscii");
        existsSync.mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, testUSSTree);
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(isFileTagBinOrAscii.mock.calls[0][0]).toBe(session);
        expect(isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        withProgress(downloadUSSFile);
        expect(withProgress).toBeCalledWith(downloadUSSFile);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");

        // WHY IS THIS BLOCK HERE??
        //      No test run on this block...
        // await node2.openUSS(false, true, testUSSTree);

        // ussFile.mockReset();
        // openTextDocument.mockReset();
        // showTextDocument.mockReset();
        // existsSync.mockReset();

        // WHY IS THIS BLOCK HERE??
        //      No test run on this block...
        // const node2 = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.None, ussNode, null, null);
        // const child2 = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, node2, null, null);
        // try {
        //     await child2.openUSS(false, true, testUSSTree);
        // // tslint:disable-next-line: no-empty
        // } catch (err) { }
    });

    it ("Tests that node.openUSS() fails when an error is thrown", async () => {
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, "/", false, profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent", false, profileOne.name);

        existsSync.mockReturnValue("exists");
        showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(ussFile.mock.calls.length).toBe(0);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("testError Error: testError");
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name);
        favoriteSession.contextValue = FAVORITE_CONTEXT;

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None, favoriteSession, session, "/", false, profileOne.name);
        favoriteFile.contextValue = DS_TEXT_FILE_CONTEXT + FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, testUSSTree);
        expect(showTextDocument.mock.calls.length).toBe(1);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        // Set up mock favorite session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name);
        favoriteSession.contextValue = FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
                               false, profileOne.name);
        favoriteParent.contextValue = USS_DIR_CONTEXT + FAV_SUFFIX;
        const child = new ZoweUSSNode("favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, profileOne.name);
        child.contextValue = DS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, testUSSTree);
        expect(showTextDocument.mock.calls.length).toBe(1);
        showTextDocument.mockReset();
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        isFileTagBinOrAscii.mockReturnValue(true);
        existsSync.mockReturnValue(null);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, ussNode, session, "/", false, ussNode.getProfileName());

        // Make sure correct file is downloaded
        await node.openUSS(false, true, testUSSTree);
        expect(existsSync.mock.calls.length).toBe(1);
        expect(existsSync.mock.calls[0][0]).toBe(path.join(USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Make sure correct file is displayed in the editor
        withProgress(downloadUSSFile);
        expect(openTextDocument.mock.calls.length).toBe(1);
        expect(openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(showTextDocument.mock.calls.length).toBe(1);
        expect(showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const badParent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, ussNode, null, null);
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badParent, null, null);

        try {
            await brat.openUSS(false, true, testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(ussFile.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(2);
        expect(showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node. Error: open() called from invalid node.");
    });

    // THE FOLLOWING TESTS SHOULD BE REMOVED
    //     ...Because the credentials prompt has been moved into Profiles function checkCurrentProfile(),
    //     which is tested in the Profiles.unit.test.ts folder

    // it("Tests that node.openUSS() credentials prompt is executed successfully", async () => {
    //     dsNode.contextValue = USS_SESSION_CONTEXT;
    //     Object.defineProperty(Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 promptCredentials: jest.fn(()=> {
    //                     return ["fake", "fake", "fake"];
    //                 }),
    //                 loadNamedProfile: mockLoadNamedProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 checkCurrentProfile: jest.fn(),
    //             };
    //         })
    //     });

    //     await dsNode.openUSS(false, true, testUSSTree);
    //     expect(openTextDocument.mock.calls.length).toBe(1);
    //     expect(showTextDocument.mock.calls.length).toBe(1);
    // });

    // it("Tests that node.openUSS() credentials prompt works with favorites", async () => {
    //     dsNode.contextValue = USS_DIR_CONTEXT + FAV_SUFFIX;
    //     Object.defineProperty(Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 promptCredentials: jest.fn(()=> {
    //                     return ["fake", "fake", "fake"];
    //                 }),
    //                 loadNamedProfile: mockLoadNamedProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 checkCurrentProfile: jest.fn(),
    //             };
    //         })
    //     });

    //     await dsNode.openUSS(false, true, testUSSTree);
    //     expect(openTextDocument.mock.calls.length).toBe(1);
    //     expect(showTextDocument.mock.calls.length).toBe(1);
    // });

    // it("Tests that node.openUSS() credentials prompt for favorites ends in error", async () => {
    //     dsNode.contextValue = USS_DIR_CONTEXT + FAV_SUFFIX;
    //     Object.defineProperty(Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 validProfile: ValidProfileEnum.INVALID,
    //                 checkCurrentProfile: jest.fn(),
    //                 promptCredentials: jest.fn(()=> {
    //                     return [undefined, undefined, undefined];
    //                 }),
    //                 loadNamedProfile: mockLoadNamedProfile
    //             };
    //         })
    //     });

    //     const spyopenUSS = jest.spyOn(dsNode, "openUSS");
    //     await dsNode.openUSS(false, true, testUSSTree);
    //     expect(Profiles.getInstance().validProfile).toBe(ValidProfileEnum.INVALID);
    // });

    // it("Tests that node.openUSS() credentials prompt ends in error", async () => {
    //     dsNode.contextValue = USS_SESSION_CONTEXT;
    //     Object.defineProperty(Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 validProfile: ValidProfileEnum.INVALID,
    //                 checkCurrentProfile: jest.fn(),
    //                 loadNamedProfile: mockLoadNamedProfile
    //             };
    //         })
    //     });

    //     await dsNode.openUSS(false, true, testUSSTree);
    //     expect(Profiles.getInstance().validProfile).toBe(ValidProfileEnum.INVALID);
    // });
});
