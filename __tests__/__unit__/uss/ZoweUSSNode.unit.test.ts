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
import * as ussActions from "../../../src/uss/actions";
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { createISession, createISessionWithoutCredentials, createIProfile,
    createFileResponse, createTreeView, createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";
import { createUSSTree } from "../../../__mocks__/mockCreators/uss";
import * as fs from "fs";
import * as path from "path";
import * as globals from "../../../src/globals";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";

jest.mock("fs");
jest.mock("path");

async function createGlobalMocks() {
    const globalMocks = {
        ussFile: jest.fn(),
        Download: jest.fn(),
        isDirtyInEditor: jest.fn(),
        openedDocumentInstance: jest.fn(),
        onDidSaveTextDocument: jest.fn(),
        showErrorMessage: jest.fn(),
        openTextDocument: jest.fn(),
        showTextDocument: jest.fn(),
        showInformationMessage: jest.fn(),
        getConfiguration: jest.fn(),
        downloadUSSFile: jest.fn(),
        showInputBox: jest.fn(),
        executeCommand: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        showQuickPick: jest.fn(),
        isFileTagBinOrAscii: jest.fn(),
        existsSync: jest.fn(),
        Delete: jest.fn(),
        Utilities: jest.fn(),
        withProgress: jest.fn(),
        createBasicZosmfSession: jest.fn(),
        ZosmfSession: jest.fn(),
        getUssApiMock: jest.fn(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        session: createISession(),
        profileOne: createIProfile(),
        profileOps: null,
        response: createFileResponse({etag: "123"}),
        ussApi: null
    };

    globalMocks.profileOps = createInstanceOfProfile(globalMocks.profileOne);
    globalMocks.ussApi = ZoweExplorerApiRegister.getUssApi(globalMocks.profileOne);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.profileOne);
    globalMocks.getUssApiMock.mockReturnValue(globalMocks.ussApi);
    ZoweExplorerApiRegister.getUssApi = globalMocks.getUssApiMock.bind(ZoweExplorerApiRegister);

    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: globalMocks.onDidSaveTextDocument, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalMocks.getConfiguration, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: globalMocks.openTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: globalMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: globalMocks.showTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: globalMocks.showErrorMessage, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "isFileTagBinOrAscii", { value: globalMocks.isFileTagBinOrAscii, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.ZosmfSession, "createBasicZosmfSession",
        { value: globalMocks.createBasicZosmfSession, configurable: true });
    Object.defineProperty(zowe, "Download", { value: globalMocks.Download, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(globalMocks.Download, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(zowe, "Delete", { value: globalMocks.Delete, configurable: true });
    Object.defineProperty(fs, "existsSync", { value: globalMocks.existsSync, configurable: true });
    Object.defineProperty(globalMocks.Delete, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(Profiles, "createInstance", { value: jest.fn(() => globalMocks.profileOps), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => globalMocks.profileOps), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });

    return globalMocks;
}

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalMocks.session, null, false, globalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, globalMocks.profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, globalMocks.profileOne.name, undefined);
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
        const globalMocks = await createGlobalMocks();

        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        const testNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.None, null, globalMocks.session, null, false, globalMocks.profileOne.name);
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });

    it("Tests that creating a new binary USS node initializes all methods and properties", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        const testNode = new ZoweUSSNode(
            "/u", vscode.TreeItemCollapsibleState.None, null, globalMocks.session, null, true, globalMocks.profileOne.name);
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    it("Tests that node.getSession() returns the proper globalMocks.session", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a rootNode
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalMocks.session, null, false, globalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed,
            rootNode, null, null, false, globalMocks.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, globalMocks.profileOne.name, undefined);

        const returnedSession = child.getSession();
        expect(returnedSession).toBeDefined();
        expect(returnedSession).toStrictEqual(globalMocks.session);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            testUSSTree: null,
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                globalMocks.session, null, null, globalMocks.profileOne.name, "123"),
            ussNodeFav: new ZoweUSSNode("[sestest]: usstest", vscode.TreeItemCollapsibleState.Expanded,
                null, globalMocks.session, null, false, globalMocks.profileOne.name)
        };

        newMocks.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.ussNode.fullPath = "/u/myuser";
        newMocks.node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.node.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.node.fullPath = "/u/myuser";
        newMocks.testUSSTree = createUSSTree([newMocks.ussNodeFav], [newMocks.ussNode], createTreeView());
        newMocks.ussNodeFav.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
        newMocks.ussNodeFav.fullPath = "/u/myuser/usstest";
        newMocks.ussNodeFav.tooltip = "/u/myuser/usstest";
        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        Object.defineProperty(newMocks.node, "isDirtyInEditor", { get: globalMocks.isDirtyInEditor });
        Object.defineProperty(newMocks.node, "openedDocumentInstance", { get: globalMocks.openedDocumentInstance });

        return newMocks;
    }

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user didn't cancel file save", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.ussFile.mockResolvedValue(globalMocks.response);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(2);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(2);
        expect(blockMocks.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user cancelled file save", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(true);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(0);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() works correctly for not dirty file state", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(0);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.ussFile.mockRejectedValueOnce(Error(""));
        globalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(false);
    });
    it("Tests that node.refreshUSS() throws an error when context value is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const badContextValueParent = new ZoweUSSNode("test-parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussNode, null, "/");
        badContextValueParent.contextValue = globals.DS_PDS_CONTEXT;
        const childNode = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, badContextValueParent, null, "/");
        const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage");

        await expect(childNode.refreshUSS()).rejects.toThrow();
        expect(showErrorMessageSpy).toBeCalledTimes(1);
    });
    it("Tests that node.refreshUSS() works correctly for files under directories", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.ussNode.contextValue = globals.USS_DIR_CONTEXT;
        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(0);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });
    it("Tests that node.refreshUSS() works correctly for favorited files/directories", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.ussNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);
        globalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(globalMocks.ussFile.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(0);
        expect(globalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshAndReopen()", () => {
    it("Tests that refreshAndReopen works for a folder", async () => {
        const globalMocks = await createGlobalMocks();
        const ussDir = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
            globalMocks.session, null, null, globalMocks.profileOne.name, "123");
        ussDir.contextValue = globals.USS_DIR_CONTEXT;
        const vscodeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");

        await ussDir.refreshAndReopen();

        expect(vscodeCommandSpy).toHaveBeenCalledWith("zowe.uss.refreshAll");
    });
    it("Tests that refreshAndReopen works for a file with closed tab", async () => {
        const globalMocks = await createGlobalMocks();
        const hasClosedTab = true;
        const ussFile = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.None, null,
            globalMocks.session, null, null, globalMocks.profileOne.name, "123");
        ussFile.contextValue = globals.DS_TEXT_FILE_CONTEXT;
        const vscodeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");

        await ussFile.refreshAndReopen(hasClosedTab);

        expect(vscodeCommandSpy.mock.calls[0][0]).toEqual("zowe.uss.refreshUSSInTree");
        expect(vscodeCommandSpy.mock.calls[0][1]).toEqual(ussFile);
        expect(vscodeCommandSpy.mock.calls[1][0]).toEqual("zowe.uss.ZoweUSSNode.open");
        expect(vscodeCommandSpy.mock.calls[1][1]).toEqual(ussFile);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    it("Tests that getEtag() returns a value", async () => {
        const globalMocks = await createGlobalMocks();

        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, globalMocks.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    it("Tests that setEtag() assigns a value", async () => {
        const globalMocks = await createGlobalMocks();

        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, globalMocks.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshAndReopen()", () => {
    it("Tests that refreshAndReopen() refreshes a directory", async () => {
        const globalMocks = await createGlobalMocks();

        const refreshAllSpy = jest.spyOn(vscode.commands, "executeCommand");

        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, globalMocks.profileOne.name, "123");
        rootNode.contextValue = globals.USS_DIR_CONTEXT;

        await rootNode.refreshAndReopen();

        expect(refreshAllSpy).toHaveBeenCalledWith("zowe.uss.refreshAll");
        refreshAllSpy.mockClear();
    });

    it("Tests that refreshAndReopen() refreshes a file", async () => {
        const globalMocks = await createGlobalMocks();

        const refreshAllSpy = jest.spyOn(vscode.commands, "executeCommand");

        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, globalMocks.profileOne.name, "123");
        rootNode.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await rootNode.refreshAndReopen();

        expect(refreshAllSpy).toHaveBeenCalledWith("zowe.uss.refreshUSSInTree", rootNode);
        refreshAllSpy.mockClear();
    });

    it("Tests that refreshAndReopen() opens a file if asked to refresh a closed file", async () => {
        const globalMocks = await createGlobalMocks();

        const refreshAllSpy = jest.spyOn(vscode.commands, "executeCommand");

        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, globalMocks.profileOne.name, "123");
        rootNode.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await rootNode.refreshAndReopen(true);

        expect(refreshAllSpy).toHaveBeenCalledWith("zowe.uss.ZoweUSSNode.open", rootNode);
        refreshAllSpy.mockClear();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setBinary()", () => {
    it("Tests that node.setBinary() works", async () => {
        const globalMocks = await createGlobalMocks();

        const rootNode = new ZoweUSSNode("favProfileNode", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalMocks.session, null, false, globalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, globalMocks.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, globalMocks.profileOne.name, undefined);

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
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            ussNode: null,
            testUSSTree: null,
            mParent: new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, globalMocks.session,
                null, false, globalMocks.profileOne.name)
        };

        newMocks.ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded,
            newMocks.mParent, globalMocks.session, null, false, globalMocks.profileOne.name);
        newMocks.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.ussNode.fullPath = "/u/myuser";
        newMocks.testUSSTree = createUSSTree([], [newMocks.ussNode], createTreeView());
        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newMocks;
    }

    it("Tests that node is deleted if user verified", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showQuickPick.mockResolvedValueOnce("Delete");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user did not verify", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showQuickPick.mockResolvedValueOnce("Cancel");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user cancelled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showQuickPick.mockResolvedValueOnce(undefined);
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if an error thrown", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showQuickPick.mockResolvedValueOnce("Delete");
        globalMocks.ussFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
            // tslint:disable-next-line:no-empty
        } catch (err) { }

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            rootNode: new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session,
                null, false, globalMocks.profileOne.name, undefined),
            childNode: null
        };
        newMocks.childNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalMocks.session, "root", false, globalMocks.profileOne.name, undefined);
        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newMocks;
    }

    it("Tests that node.getChildren() returns the correct Thenable<ZoweUSSNode[]>", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.rootNode.contextValue = globals.USS_DIR_CONTEXT;
        blockMocks.rootNode.dirty = true;

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.rootNode,
                globalMocks.session, "/u", false, globalMocks.profileOne.name, undefined),
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, blockMocks.rootNode,
                globalMocks.session, "/u", false, globalMocks.profileOne.name, undefined),
        ];
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [sampleChildren[1]] };
        blockMocks.rootNode.children.push(sampleChildren[0]);

        const rootChildren = await blockMocks.rootNode.getChildren();
        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");
    });

    it("Tests that node.getChildren() returns no children if none exist", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const nodeNoChildren = new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.rootNode,
            globalMocks.session, "/u", false, globalMocks.profileOne.name, undefined);
        nodeNoChildren.dirty = false;

        const rootChildren = await nodeNoChildren.getChildren();
        expect(rootChildren.length).toBe(0);
    });

    it("Tests that error is thrown when node label is blank", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.rootNode.label = "";
        blockMocks.rootNode.dirty = true;

        expect(blockMocks.rootNode.getChildren()).rejects.toEqual(Error("Invalid node"));
    });

    it("Tests that when bright.List. causes an error on the zowe call, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = await createBlockMocks(globalMocks);

            blockMocks.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockMocks.childNode.fullPath = "Throw Error";
            blockMocks.childNode.dirty = true;

            await blockMocks.childNode.getChildren();
            expect(globalMocks.showErrorMessage.mock.calls.length).toEqual(1);
            expect(globalMocks.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when bright.List returns an unsuccessful response, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = await createBlockMocks(globalMocks);

            blockMocks.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockMocks.childNode.dirty = true;
            const subNode = new ZoweUSSNode("Response Fail", vscode.TreeItemCollapsibleState.Collapsed,
                blockMocks.childNode, null, null, false, globalMocks.profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;

            await subNode.getChildren();
            expect(globalMocks.showErrorMessage.mock.calls.length).toEqual(1);
            expect(globalMocks.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when passing a globalMocks.session node that is not dirty the node.getChildren() method is exited early", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        blockMocks.rootNode.dirty = false;

        expect(await blockMocks.rootNode.getChildren()).toEqual([]);
    });

    it("Tests that when passing a globalMocks.session node with no hlq the node.getChildren() method is exited early", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.rootNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(await blockMocks.rootNode.getChildren()).toEqual([]);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openUSS()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            dsNode: null,
            mockCheckCurrentProfile: jest.fn(),
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                globalMocks.session, null, null, globalMocks.profileOne.name, "123")
        };

        newMocks.testUSSTree = createUSSTree([], [newMocks.ussNode], createTreeView());
        newMocks.dsNode = new ZoweUSSNode(
            "testSess", vscode.TreeItemCollapsibleState.Expanded, newMocks.ussNode, createISessionWithoutCredentials(), null);

        newMocks.testUSSTree.getTreeView.mockReturnValue(createTreeView());
        globalMocks.createBasicZosmfSession.mockReturnValue(globalMocks.session);
        globalMocks.ussFile.mockReturnValue(globalMocks.response);
        globalMocks.withProgress.mockReturnValue(globalMocks.response);
        globalMocks.openTextDocument.mockResolvedValue("test.doc");
        globalMocks.showInputBox.mockReturnValue("fake");
        globals.defineGlobals("/test/path/");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: globalMocks.mockLoadNamedProfile,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    validProfile: ValidProfileEnum.VALID,
                    checkCurrentProfile: jest.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getProfiles: jest.fn(() => {
                        return [{name: globalMocks.profileOne.name, profile: globalMocks.profileOne},
                                {name: globalMocks.profileOne.name, profile: globalMocks.profileOne}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });

        return newMocks;
    }

    it("Tests that node.openUSS() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode,
            globalMocks.session, "/", false, globalMocks.profileOne.name);

        const isBinSpy = jest.spyOn(globalMocks.ussApi, "isFileTagBinOrAscii");
        globalMocks.existsSync.mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.existsSync.mock.calls.length).toBe(1);
        expect(globalMocks.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(globalMocks.isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(globalMocks.isFileTagBinOrAscii.mock.calls[0][0]).toBe(globalMocks.session);
        expect(globalMocks.isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(globalMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        globalMocks.withProgress(globalMocks.downloadUSSFile);
        expect(globalMocks.withProgress).toBeCalledWith(globalMocks.downloadUSSFile);
        expect(globalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() is executed successfully with Unverified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({name: globalMocks.profileOne.name, status: "unverified"}),
                    validProfile: ValidProfileEnum.UNVERIFIED
                };
            })
        });

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode,
            globalMocks.session, "/", false, globalMocks.profileOne.name);

        const isBinSpy = jest.spyOn(globalMocks.ussApi, "isFileTagBinOrAscii");
        globalMocks.existsSync.mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.existsSync.mock.calls.length).toBe(1);
        expect(globalMocks.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(globalMocks.isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(globalMocks.isFileTagBinOrAscii.mock.calls[0][0]).toEqual(globalMocks.session);
        expect(globalMocks.isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(globalMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        globalMocks.withProgress(globalMocks.downloadUSSFile);
        expect(globalMocks.withProgress).toBeCalledWith(globalMocks.downloadUSSFile);
        expect(globalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it ("Tests that node.openUSS() fails when an error is thrown", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussNode,
            null, "/", false, globalMocks.profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent,
            null, "/parent", false, globalMocks.profileOne.name);

        globalMocks.existsSync.mockReturnValue("exists");
        globalMocks.showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, blockMocks.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(globalMocks.ussFile.mock.calls.length).toBe(0);
        expect(globalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.openTextDocument.mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("testError Error: testError");
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        // Set up mock favorite globalMocks.session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.session, null, false, globalMocks.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up profile grouping node (directly under Favorites)
        const favProfileNode = new ZoweUSSNode(globalMocks.profileOne.name, vscode.TreeItemCollapsibleState.Collapsed,
                favoriteSession, globalMocks.session, "", false, globalMocks.profileOne.name);
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        // Set up favorited nodes (directly under profile grouping node)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None,
            favProfileNode, globalMocks.session, "/", false, globalMocks.profileOne.name);
        favoriteFile.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        // Set up mock favorite globalMocks.session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            null, globalMocks.session, null, false, globalMocks.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
                               false, globalMocks.profileOne.name);
        favoriteParent.contextValue = globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweUSSNode(
            "favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, globalMocks.profileOne.name);
        child.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        globalMocks.showTextDocument.mockReset();
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isFileTagBinOrAscii.mockReturnValue(true);
        globalMocks.existsSync.mockReturnValue(null);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode,
            globalMocks.session, "/", false, blockMocks.ussNode.getProfileName());

        // Make sure correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.existsSync.mock.calls.length).toBe(1);
        expect(globalMocks.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(globalMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Make sure correct file is displayed in the editor
        globalMocks.withProgress(globalMocks.downloadUSSFile);
        expect(globalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(globalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(globalMocks.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const badParent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussNode, null, null);
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badParent, null, null);

        try {
            await brat.openUSS(false, true, blockMocks.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(globalMocks.ussFile.mock.calls.length).toBe(0);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(2);
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(globalMocks.showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node. Error: open() called from invalid node.");
    });
});
