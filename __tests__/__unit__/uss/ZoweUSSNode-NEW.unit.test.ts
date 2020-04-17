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
import * as globals from "../../../src/globals";
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { FAVORITE_CONTEXT, DS_BINARY_FILE_CONTEXT, DS_TEXT_FILE_CONTEXT, FAV_SUFFIX } from "../../../src/globals";

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
let mockLoadNamedProfile = jest.fn();
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
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
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
        node.contextValue = globals.USS_SESSION_CONTEXT;
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
    ussNode.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode.fullPath = "/u/myuser";

    // USS favorited node definition
    const ussNodeFav = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    mParent.contextValue = globals.FAVORITE_CONTEXT;
    ussNodeFav.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
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
    })

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
        } catch (err) { 
            let a = "help";
        }

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
    });
});
