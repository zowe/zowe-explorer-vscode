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
import { FAVORITE_CONTEXT, DS_BINARY_FILE_CONTEXT, DS_TEXT_FILE_CONTEXT, FAV_SUFFIX, USS_SESSION_CONTEXT, USS_DIR_CONTEXT } from "../../../src/globals";

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
const executeCommand = jest.fn();
const mockLoadNamedProfile = jest.fn();
const showQuickPick = jest.fn();
const mockUSSRefresh = jest.fn();
const mockAddZoweSession = jest.fn();
const mockRemoveRecall = jest.fn();
const mockCheckCurrentProfile = jest.fn();
const mockUSSRefreshElement = jest.fn();
const mockGetUSSChildren = jest.fn();
const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockInitializeFavorites = jest.fn();
const Delete = jest.fn();

Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: onDidSaveTextDocument });
Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand });
Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: openTextDocument });
Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
Object.defineProperty(vscode.window, "showTextDocument", { value: showTextDocument });
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(zowe, "Download", { value: Download });
Object.defineProperty(Download, "ussFile", { value: ussFile });
Object.defineProperty(zowe, "Delete", { value: Delete });
Object.defineProperty(Delete, "ussFile", { value: ussFile });
Object.defineProperty(Profiles, "getInstance", {
    value: jest.fn(() => {
        return profileOps;
    })
});
const profileOps = {
    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
    defaultProfile: { name: "firstName" },
    getDefaultProfile: mockLoadNamedProfile,
    loadNamedProfile: mockLoadNamedProfile,
    validProfile: ValidProfileEnum.VALID,
    checkCurrentProfile: jest.fn(),
    usesSecurity: jest.fn().mockReturnValue(true)
};
const session = new imperative.Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});
const profileOne: imperative.IProfileLoaded = {
    name: "sestest",
    profile: {
        user: undefined,
        password: undefined
    },
    type: "zosmf",
    message: "",
    failNotFound: false
};
mockLoadNamedProfile.mockReturnValue(profileOne);

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    const response: zowe.IZosFilesResponse = {
        success: true,
        commandResponse: null,
        apiResponse: {
            etag: "132"
        }
    };
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, null, profileOne.name, "123");
    ussNode.contextValue = USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";
    let node;

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

describe("ZoweUSSNode Unit Tests - Function node.deleteUSSNode()", () => {
    // USS node definition
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profileOne.name);
    ussNode.contextValue = USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";

    // USS favorited node definition
    const ussNodeFav = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    mParent.contextValue = FAVORITE_CONTEXT;
    ussNodeFav.contextValue = DS_TEXT_FILE_CONTEXT + FAV_SUFFIX;
    ussNodeFav.fullPath = "/u/myuser/usstest";
    ussNodeFav.tooltip = "/u/myuser/usstest";

    // USS tree definition
    const testUSSTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            mFavorites: [ussNodeFav],
            addSession: mockAddZoweSession,
            refresh: mockUSSRefresh,
            refreshAll: mockUSSRefresh,
            removeRecall: mockRemoveRecall,
            checkCurrentProfile: mockCheckCurrentProfile,
            refreshElement: mockUSSRefreshElement,
            getChildren: mockGetUSSChildren,
            addFavorite: mockAddFavorite,
            removeFavorite: mockRemoveFavorite,
            initializeUSSFavorites: mockInitializeFavorites
        };
    })();
    testUSSTree.mSessionNodes = [];
    testUSSTree.mSessionNodes.push(ussNode);

    beforeEach(() => {
        showErrorMessage.mockReset();
        showQuickPick.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
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
