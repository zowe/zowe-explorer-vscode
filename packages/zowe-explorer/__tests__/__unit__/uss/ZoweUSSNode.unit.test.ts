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

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { BaseProvider, Gui, Validation } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { UssFileType, UssFileUtils } from "../../../src/uss/FileStructure";
import {
    createISession,
    createISessionWithoutCredentials,
    createIProfile,
    createFileResponse,
    createTreeView,
    createInstanceOfProfile,
    createValidIProfile,
} from "../../../__mocks__/mockCreators/shared";
import { createUSSTree } from "../../../__mocks__/mockCreators/uss";
import * as fs from "fs";
import * as path from "path";
import * as globals from "../../../src/globals";
import * as ussUtils from "../../../src/uss/utils";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { UssFSProvider } from "../../../src/uss/UssFSProvider";

jest.mock("fs");

async function createGlobalMocks() {
    const globalMocks = {
        ussFile: jest.fn(),
        Download: jest.fn(),
        mockIsDirtyInEditor: jest.fn(),
        mockTextDocument: { fileName: `/test/path/temp/_U_/sestest/test/node`, isDirty: true },
        mockTextDocuments: [],
        openedDocumentInstance: jest.fn(),
        onDidSaveTextDocument: jest.fn(),
        showErrorMessage: jest.fn(),
        mockShowTextDocument: jest.fn(),
        showInformationMessage: jest.fn(),
        getConfiguration: jest.fn(),
        downloadUSSFile: jest.fn(),
        setStatusBarMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        showInputBox: jest.fn(),
        mockExecuteCommand: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        showQuickPick: jest.fn(),
        isFileTagBinOrAscii: jest.fn(),
        Delete: jest.fn(),
        Utilities: jest.fn(),
        withProgress: jest.fn(),
        createSessCfgFromArgs: jest.fn(),
        ZosmfSession: jest.fn(),
        getUssApiMock: jest.fn(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        session: createISession(),
        profileOne: createIProfile(),
        profileOps: null,
        response: createFileResponse({ etag: "123" }),
        ussApi: null,
        mockShowWarningMessage: jest.fn(),
        fileExistsCaseSensitveSync: jest.fn(),
        readText: jest.fn(),
        fileToUSSFile: jest.fn(),
        basePath: jest.fn(),
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
        loggerError: jest.spyOn(globals.ZoweLogger, "error").mockImplementation(),
    };

    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);

    globalMocks.mockTextDocuments.push(globalMocks.mockTextDocument);
    globalMocks.profileOps = createInstanceOfProfile(globalMocks.profileOne);
    Object.defineProperty(globalMocks.profileOps, "loadNamedProfile", {
        value: jest.fn(),
    });
    globalMocks.ussApi = ZoweExplorerApiRegister.getUssApi(globalMocks.profileOne);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.profileOne);
    globalMocks.getUssApiMock.mockReturnValue(globalMocks.ussApi);
    ZoweExplorerApiRegister.getUssApi = globalMocks.getUssApiMock.bind(ZoweExplorerApiRegister);

    Object.defineProperty(Gui, "setStatusBarMessage", {
        value: globalMocks.setStatusBarMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", {
        value: globalMocks.onDidSaveTextDocument,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "textDocuments", {
        value: globalMocks.mockTextDocuments,
        configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
        value: globalMocks.mockExecuteCommand,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });

    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.showInformationMessage,
        configurable: true,
    });
    Object.defineProperty(Gui, "showTextDocument", {
        value: globalMocks.mockShowTextDocument,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: globalMocks.showErrorMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(globalMocks.Utilities, "isFileTagBinOrAscii", {
        value: globalMocks.isFileTagBinOrAscii,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        configurable: true,
    });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(globalMocks.ZosmfSession, "createSessCfgFromArgs", {
        value: globalMocks.createSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(zowe, "Download", { value: globalMocks.Download, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(globalMocks.Download, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(zowe, "Delete", { value: globalMocks.Delete, configurable: true });
    Object.defineProperty(globalMocks.Delete, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(Profiles, "createInstance", {
        value: jest.fn(() => globalMocks.profileOps),
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.profileOps),
        configurable: true,
    });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(ussUtils, "fileExistsCaseSensitveSync", {
        value: globalMocks.fileExistsCaseSensitveSync,
        configurable: true,
    });
    Object.defineProperty(vscode.env.clipboard, "readText", { value: globalMocks.readText, configurable: true });
    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
    return globalMocks;
}

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode({
            label: "testDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        const testFile = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testDir,
            profile: globalMocks.profileOne,
        });
        testFile.contextValue = globals.USS_TEXT_FILE_CONTEXT;
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
        const testNode = new ZoweUSSNode({
            label: "/u",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeUndefined();
        expect(testNode.getSession()).toBeDefined();
    });

    it("Tests that creating a new binary USS node initializes all methods and properties", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        const testNode = new ZoweUSSNode({
            label: "/u",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeUndefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    it("Tests that node.getSession() returns the proper globalMocks.session", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a rootNode
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        const child = new ZoweUSSNode({
            label: "child",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: subNode,
            profile: globalMocks.profileOne,
        });

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
            putUSSPayload: jest.fn().mockResolvedValue(`{"stdout":[""]}`),
            ussNode: new ZoweUSSNode({
                label: "usstest",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
            }),
            ussNodeFav: new ZoweUSSNode({
                label: "[sestest]: usstest",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
            }),
            fetchFileAtUri: jest.fn(),
        };

        jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockImplementation(newMocks.fetchFileAtUri);

        newMocks.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.ussNode.fullPath = "/u/myuser";
        newMocks.node = new ZoweUSSNode({
            label: "test-node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: newMocks.ussNode,
            parentPath: "/",
        });
        newMocks.node.fullPath = "/u/myuser";
        newMocks.testUSSTree = createUSSTree([newMocks.ussNodeFav], [newMocks.ussNode], createTreeView());
        newMocks.ussNodeFav.contextValue = globals.USS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
        newMocks.ussNodeFav.fullPath = "/u/myuser/usstest";
        newMocks.ussNodeFav.tooltip = "/u/myuser/usstest";
        globalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        Object.defineProperty(newMocks.node, "isDirtyInEditor", { get: globalMocks.mockIsDirtyInEditor });
        Object.defineProperty(newMocks.node, "openedDocumentInstance", { get: globalMocks.openedDocumentInstance });
        Object.defineProperty(globalMocks.Utilities, "putUSSPayload", {
            value: newMocks.putUSSPayload,
            configurable: true,
        });

        return newMocks;
    }

    it("Tests that node.refreshUSS() works correctly", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.ussFile.mockResolvedValue(globalMocks.response);

        await blockMocks.node.refreshUSS();

        expect(blockMocks.fetchFileAtUri.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.fetchFileAtUri.mockRejectedValueOnce(Error(""));
        await blockMocks.node.refreshUSS();

        expect(blockMocks.fetchFileAtUri.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() throws an error when context value is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const badContextValueParent = new ZoweUSSNode({
            label: "test-parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussNode,
            parentPath: "/",
        });
        badContextValueParent.contextValue = globals.DS_PDS_CONTEXT;
        const childNode = new ZoweUSSNode({
            label: "test-node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: badContextValueParent,
            parentPath: "/",
        });
        const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage");

        await expect(childNode.refreshUSS()).rejects.toThrow();
        expect(showErrorMessageSpy).toBeCalledTimes(1);
    });
    it("Tests that node.refreshUSS() works correctly for files under directories", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.ussNode.contextValue = globals.USS_DIR_CONTEXT;
        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.mockIsDirtyInEditor.mockReturnValueOnce(false);
        globalMocks.mockIsDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(blockMocks.fetchFileAtUri.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });
    it("Tests that node.refreshUSS() works correctly for favorited files/directories", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.ussNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        globalMocks.ussFile.mockResolvedValueOnce(globalMocks.response);
        globalMocks.mockIsDirtyInEditor.mockReturnValueOnce(false);
        globalMocks.mockIsDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(blockMocks.fetchFileAtUri.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    it("Tests that getEtag() returns a value", async () => {
        const globalMocks = await createGlobalMocks();

        const rootNode = new ZoweUSSNode({
            label: "gappy",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    it("Tests that setEtag() assigns a value", async () => {
        const globalMocks = await createGlobalMocks();

        const rootNode = new ZoweUSSNode({
            label: "gappy",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.rename()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            ussDir: new ZoweUSSNode({
                label: "usstest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
                parentPath: "/u/user",
            }),
            providerSpy: jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({
                ds: { addSingleSession: jest.fn(), mSessionNodes: [], refresh: jest.fn() } as any,
                uss: { addSingleSession: jest.fn(), mSessionNodes: [], refresh: jest.fn() } as any,
                job: { addSingleSession: jest.fn(), mSessionNodes: [], refresh: jest.fn() } as any,
            }),
            renameSpy: jest.spyOn(UssFSProvider.instance, "rename").mockImplementation(),
        };
        newMocks.ussDir.contextValue = globals.USS_DIR_CONTEXT;
        return newMocks;
    }
    it("Tests that rename updates and refreshes the UI components of the node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const newFullPath = "/u/user/newName";
        await blockMocks.ussDir.rename(newFullPath);

        // Expect renamed node's labels to be updated with newName
        expect(blockMocks.ussDir.fullPath).toEqual(newFullPath);
        expect(blockMocks.ussDir.shortLabel).toEqual("newName");
        expect(blockMocks.ussDir.label).toEqual("newName");
        expect(blockMocks.ussDir.tooltip).toEqual(newFullPath);

        // Expect node to be refreshed in UI after rename
        expect(blockMocks.providerSpy).toBeCalled();
        blockMocks.providerSpy.mockClear();
    });
    it("Tests that rename updates and refreshes the UI components of any loaded children for a node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        // Child dir of blockMocks.ussDir
        const ussSubDir = new ZoweUSSNode({
            label: "ussSubDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussDir,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/u/user/ussDir",
        });
        ussSubDir.contextValue = globals.USS_DIR_CONTEXT;
        blockMocks.ussDir.children.push(ussSubDir);
        // ussSubDir child file
        const ussSubDirChild = new ZoweUSSNode({
            label: "ussChildFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: ussSubDir,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/u/user/ussDir/ussSubDir",
        });
        ussSubDirChild.contextValue = globals.USS_TEXT_FILE_CONTEXT;
        ussSubDirChild.shortLabel = "ussSubDirChild/ussChildFile";
        ussSubDir.children.push(ussSubDirChild);

        const newFullPath = "/u/user/newName";
        await blockMocks.ussDir.rename(newFullPath);

        // Expect renamed ussDir's subdirectory's short labels to be updated with newName
        expect(ussSubDir.fullPath).toContain(newFullPath);
        expect(ussSubDir.tooltip).toContain(newFullPath);

        // Expect ussDir's nested file's short labels to be updated with newName
        const updatedChild = blockMocks.ussDir.children;
        expect(updatedChild[0].fullPath).toContain(newFullPath);
        expect(updatedChild[0].tooltip).toContain(newFullPath);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.reopen()", () => {
    it("Tests that reopen works for a file with closed tab", async () => {
        const globalMocks = await createGlobalMocks();
        const hasClosedTab = true;
        const ussFile = new ZoweUSSNode({
            label: "usstest",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        ussFile.contextValue = globals.USS_TEXT_FILE_CONTEXT;
        const vscodeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");

        await ussFile.reopen(hasClosedTab);

        expect(vscodeCommandSpy.mock.calls[0][0]).toEqual("zowe.uss.ZoweUSSNode.open");
        expect(vscodeCommandSpy.mock.calls[0][1]).toEqual(ussFile);
        vscodeCommandSpy.mockClear();
    });

    it("Tests that reopen() opens a file if asked to refresh a closed file", async () => {
        const globalMocks = await createGlobalMocks();

        const vscodeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");

        const rootNode = new ZoweUSSNode({
            label: "gappy",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_TEXT_FILE_CONTEXT;

        await rootNode.reopen(true);

        expect(vscodeCommandSpy).toHaveBeenCalledWith("zowe.uss.ZoweUSSNode.open", rootNode);
        vscodeCommandSpy.mockClear();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEncoding()", () => {
    it("sets encoding to binary", () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "binary" });
        expect(node.binary).toEqual(true);
        expect(node.encoding).toBeUndefined();
        expect(node.tooltip).toContain("Encoding: Binary");
        expect(node.contextValue).toEqual(globals.USS_BINARY_FILE_CONTEXT);
        expect(JSON.stringify(node.iconPath)).toContain("document-binary.svg");
    });

    it("sets encoding to text", () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "text" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeNull();
        expect(node.tooltip).not.toContain("Encoding:");
        expect(node.contextValue).toEqual(globals.USS_TEXT_FILE_CONTEXT);
    });

    it("sets encoding to other codepage", () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "other", codepage: "IBM-1047" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toEqual("IBM-1047");
        expect(node.tooltip).toContain("Encoding: IBM-1047");
    });

    it("sets encoding for favorite node", () => {
        const parentNode = new ZoweUSSNode({
            label: "favoriteTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        });
        parentNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode });
        node.setEncoding({ kind: "text" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeNull();
        expect(node.contextValue).toEqual(globals.USS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX);
    });

    it("resets encoding to undefined", () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding(undefined as any);
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeUndefined();
    });

    it("fails to set encoding for session node", () => {
        const node = new ZoweUSSNode({
            label: "sessionTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        });
        node.contextValue = globals.USS_SESSION_CONTEXT;
        expect(node.setEncoding.bind(node)).toThrowError("Cannot set encoding for node with context ussSession");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.deleteUSSNode()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            ussNode: null,
            testUSSTree: null,
            mParent: new ZoweUSSNode({
                label: "parentNode",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
            }),
            fspDelete: jest.spyOn(UssFSProvider.instance, "delete").mockImplementation(),
        };

        newMocks.ussNode = new ZoweUSSNode({
            label: "usstest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: newMocks.mParent,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
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
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "", false);
        expect(blockMocks.testUSSTree.refresh).toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user did not verify", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "", true);
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user cancelled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce(undefined);
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "", true);
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if an error thrown", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Delete");
        globalMocks.ussFile.mockImplementationOnce(() => {
            throw Error("testError");
        });

        try {
            await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "", false);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            rootNode: new ZoweUSSNode({
                label: "/u",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
            }),
            childNode: null,
            testCombinedProfile: createValidIProfile(),
        };
        newMocks.childNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "root",
        });
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
            new ZoweUSSNode({
                label: "aDir",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: blockMocks.rootNode,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
                parentPath: "/u",
            }),
            new ZoweUSSNode({
                label: "myFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: blockMocks.rootNode,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
                parentPath: "/u",
            }),
        ];
        sampleChildren[1].command = {
            command: "zowe.uss.ZoweUSSNode.open",
            title: "Open",
            arguments: [sampleChildren[1]],
        };
        blockMocks.rootNode.children.push(sampleChildren[0]);

        const rootChildren = await blockMocks.rootNode.getChildren();
        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");
    });

    it("Tests that node.getChildren() returns no children if none exist", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const nodeNoChildren = new ZoweUSSNode({
            label: "aDir",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.rootNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/u",
        });
        nodeNoChildren.dirty = false;

        const rootChildren = await nodeNoChildren.getChildren();
        expect(rootChildren.length).toBe(0);
    });

    it("Tests that only children with parent paths matching the current fullPath are returned as existing children", async () => {
        // This tests functionality that prevents children of previous searches from appearing in new searches with different filepaths,
        // especially if file or folder names (labels) are shared between the different filepaths.
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const oldPath = "/u/oldUser";
        const newPath = "/u/newUser";

        const parentNode = new ZoweUSSNode({
            label: "newUser",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.rootNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/u",
        });

        // Creating structure of files and directorie
        // Label of each child must match names of items returned by mock fileList() in packages/zowe-explorer/__mocks__/@zowe/cli.ts
        const oldUserChildren: ZoweUSSNode[] = [
            new ZoweUSSNode({
                label: "aDir",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
                parentPath: oldPath,
            }),
            new ZoweUSSNode({
                label: "myFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
                parentPath: oldPath,
            }),
        ];
        parentNode.children = oldUserChildren;
        parentNode.dirty = true;

        const newChildren = await parentNode.getChildren();
        expect(newChildren[0].fullPath).not.toContain(oldPath);
        expect(newChildren[1].fullPath).not.toContain(oldPath);
        expect(newChildren[0].fullPath).toContain(newPath);
        expect(newChildren[1].fullPath).toContain(newPath);
    });

    it("Tests that error is thrown when node label is blank", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.rootNode.label = "";
        blockMocks.rootNode.dirty = true;

        // eslint-disable-next-line zowe-explorer/no-floating-promises
        expect(blockMocks.rootNode.getChildren()).rejects.toEqual(Error("Invalid node"));
    });

    it(
        "Tests that when zowe.List. causes an error on the zowe call, " + "node.getChildren() throws an error and the catch block is reached",
        async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = await createBlockMocks(globalMocks);

            blockMocks.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockMocks.childNode.fullPath = "Throw Error";
            blockMocks.childNode.dirty = true;
            blockMocks.childNode.profile = globalMocks.profileOne;
            jest.spyOn(UssFSProvider.instance, "listFiles").mockImplementation(() => {
                throw new Error("Throwing an error to check error handling for unit tests!");
            });

            await blockMocks.childNode.getChildren();
            expect(globalMocks.showErrorMessage.mock.calls.length).toEqual(1);
            expect(globalMocks.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!"
            );
        }
    );

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
            putUSSPayload: jest.fn().mockResolvedValue(`{"stdout":[""]}`),
            ussNode: new ZoweUSSNode({
                label: "usstest",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                session: globalMocks.session,
                profile: globalMocks.profileOne,
            }),
            initializeFileOpening: jest.spyOn(ZoweUSSNode.prototype, "initializeFileOpening").mockImplementation(),
        };
        newMocks.testUSSTree = createUSSTree([], [newMocks.ussNode], createTreeView());
        newMocks.dsNode = new ZoweUSSNode({
            label: "testSess",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: newMocks.ussNode,
            session: createISessionWithoutCredentials(),
        });

        newMocks.testUSSTree.getTreeView.mockReturnValue(createTreeView());
        globalMocks.createSessCfgFromArgs.mockReturnValue(globalMocks.session);
        globalMocks.ussFile.mockReturnValue(globalMocks.response);
        globalMocks.withProgress.mockReturnValue(globalMocks.response);
        globalMocks.showInputBox.mockReturnValue("fake");
        globals.defineGlobals("/test/path/");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    getDefaultProfile: globalMocks.mockLoadNamedProfile,
                    promptCredentials: jest.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    validProfile: Validation.ValidationType.VALID,
                    checkCurrentProfile: jest.fn(() => {
                        return globalMocks.profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getProfiles: jest.fn(() => {
                        return [
                            { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                            { name: globalMocks.profileOne.name, profile: globalMocks.profileOne },
                        ];
                    }),
                    refresh: jest.fn(),
                };
            }),
        });
        Object.defineProperty(globalMocks.Utilities, "putUSSPayload", {
            value: newMocks.putUSSPayload,
            configurable: true,
        });

        const mockUssApi = ZoweExplorerApiRegister.getUssApi(globalMocks.testProfile);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        jest.spyOn(mockUssApi, "isFileTagBinOrAscii").mockResolvedValueOnce(true);

        return newMocks;
    }

    it("Tests that node.openUSS() is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const node = new ZoweUSSNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.ussNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/",
        });

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.setStatusBarMessage).toBeCalledWith("$(sync~spin) Downloading USS file...");

        // Tests that correct URI is passed to initializeFileOpening
        expect(blockMocks.initializeFileOpening).toHaveBeenCalledWith(node.resourceUri);
    });

    it("Tests that node.openUSS() is executed successfully with Unverified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: globalMocks.profileOne.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });

        const node = new ZoweUSSNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.ussNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/",
        });

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(globalMocks.setStatusBarMessage).toBeCalledWith("$(sync~spin) Downloading USS file...");
        // Tests that correct URI is passed to initializeFileOpening
        expect(blockMocks.initializeFileOpening).toHaveBeenCalledWith(node.resourceUri);
    });

    it("Tests that node.openUSS() fails when an error is thrown", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const parent = new ZoweUSSNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussNode,
            profile: globalMocks.profileOne,
            parentPath: "/",
        });
        const child = new ZoweUSSNode({
            label: "child",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: parent,
            profile: globalMocks.profileOne,
            parentPath: "/parent",
        });
        blockMocks.initializeFileOpening.mockRejectedValueOnce(Error("Failed to open USS file"));

        try {
            await child.openUSS(false, true, blockMocks.testUSSTree);
        } catch (err) {
            // Prevent exception from failing test
        }
        expect(globalMocks.loggerError).toHaveBeenCalled();
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        // Set up mock favorite globalMocks.session
        const favoriteSession = new ZoweUSSNode({
            label: "Favorites",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up profile grouping node (directly under Favorites)
        const favProfileNode = new ZoweUSSNode({
            label: globalMocks.profileOne.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favoriteSession,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        // Set up favorited nodes (directly under profile grouping node)
        const favoriteFile = new ZoweUSSNode({
            label: "favFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
            parentPath: "/",
        });
        favoriteFile.contextValue = globals.USS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, blockMocks.testUSSTree);
        expect(blockMocks.initializeFileOpening.mock.calls.length).toBe(1);
        expect(blockMocks.initializeFileOpening).toHaveBeenCalledWith(favoriteFile.resourceUri);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        // Set up mock favorite globalMocks.session
        const favoriteSession = new ZoweUSSNode({
            label: "Favorites",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode({
            label: "favParent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favoriteSession,
            profile: globalMocks.profileOne,
            parentPath: "/",
        });
        favoriteParent.contextValue = globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweUSSNode({
            label: "favChild",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favoriteParent,
            profile: globalMocks.profileOne,
            parentPath: "/favDir",
        });
        child.contextValue = globals.USS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, blockMocks.testUSSTree);
        expect(blockMocks.initializeFileOpening).toHaveBeenCalledWith(favoriteFile.resourceUri);
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.isFileTagBinOrAscii.mockResolvedValue(true);

        const node = new ZoweUSSNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.ussNode,
            session: globalMocks.session,
            profile: blockMocks.ussNode.getProfile(),
            parentPath: "/",
        });

        // Make sure correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(blockMocks.initializeFileOpening).toHaveBeenCalledWith(favoriteFile.resourceUri);
        expect(globalMocks.setStatusBarMessage).toHaveBeenCalledWith("$(sync~spin) Downloading USS file...");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const badParent = new ZoweUSSNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussNode,
        });
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode({ label: "brat", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: badParent });

        try {
            await brat.openUSS(false, true, blockMocks.testUSSTree);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(blockMocks.fetchFileAtUri.mock.calls.length).toBe(0);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(2);
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(globalMocks.showErrorMessage.mock.calls[1][0]).toBe("Error: open() called from invalid node.");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.isDirtyInEditor()", () => {
    it("Tests that node.isDirtyInEditor() returns true if the file is open", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/node";

        const isDirty = testNode.isDirtyInEditor;
        expect(isDirty).toBeTruthy();
    });

    it("Tests that node.isDirtyInEditor() returns false if the file is not open", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.mockTextDocuments.pop();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/node";

        const isDirty = testNode.isDirtyInEditor;
        expect(isDirty).toBeFalsy();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openedDocumentInstance()", () => {
    it("Tests that node.openedDocumentInstance() returns the document if it is open", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/node";

        const returnedDoc = testNode.openedDocumentInstance;
        expect(returnedDoc).toEqual(globalMocks.mockTextDocument);
    });

    it("Tests that node.openedDocumentInstance() returns null if the file is not open", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.mockTextDocuments.pop();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/node";

        const returnedDoc = testNode.openedDocumentInstance;
        expect(returnedDoc).toBeNull();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.initializeFileOpening()", () => {
    it("Tests that node.initializeFileOpening() successfully handles USS files", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
            parentPath: "/test/",
        });

        await testNode.initializeFileOpening(testNode.resourceUri);
        expect(globalMocks.mockExecuteCommand).toHaveBeenCalledWith("vscode.open", testNode.resourceUri);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.pasteUssTree()", () => {
    function createIProfileFakeEncoding(): zowe.imperative.IProfileLoaded {
        return {
            name: "fakeProfile",
            profile: {
                host: "fake",
                port: 999,
                user: undefined,
                password: undefined,
                rejectUnauthorize: false,
                encoding: "fake",
            },
            type: "zosmf",
            message: "",
            failNotFound: false,
        };
    }
    function createBlockMocks(globalMocks: any) {
        globalMocks.mockLoadNamedProfile.mockReturnValue(createIProfileFakeEncoding());
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    getDefaultProfile: globalMocks.mockLoadNamedProfile,
                    promptCredentials: jest.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    validProfile: Validation.ValidationType.VALID,
                    checkCurrentProfile: jest.fn(() => {
                        return newMocks.profile;
                    }),
                    validateProfiles: jest.fn(),
                    getProfiles: jest.fn(() => {
                        return [
                            { name: createIProfileFakeEncoding().name, profile: createIProfileFakeEncoding().profile },
                            { name: createIProfileFakeEncoding().name, profile: createIProfileFakeEncoding().profile },
                        ];
                    }),
                    refresh: jest.fn(),
                };
            }),
        });

        const testNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: createIProfileFakeEncoding(),
        });

        const newMocks = {
            profile: createIProfileFakeEncoding(),
            fileResponse: createFileResponse({
                items: [{ name: "testFile" }, { name: "testFile2" }, { name: "testFile3" }],
            }),
            fileRespWithFolder: createFileResponse({
                items: [{ name: "testFolder" }],
            }),
            fileResponseSame: createFileResponse({
                items: [{ name: "file" }, { name: "file2" }],
            }),
            fileResponseEmpty: {
                success: true,
                commandResponse: "",
                apiResponse: undefined,
            },
            mockUssApi: ZoweExplorerApiRegister.getUssApi(createIProfileFakeEncoding()),
            getUssApiMock: jest.fn(),
            testNode: testNode,
            pasteSpy: jest.spyOn(testNode, "paste"),
        };

        newMocks.testNode.fullPath = "/users/temp/test";
        newMocks.getUssApiMock.mockReturnValue(newMocks.mockUssApi);
        ZoweExplorerApiRegister.getUssApi = newMocks.getUssApiMock.bind(ZoweExplorerApiRegister);
        globalMocks.readText.mockResolvedValue(
            JSON.stringify({
                children: [
                    {
                        ussPath: "/path/testFile",
                        type: UssFileType.File,
                    },
                    {
                        ussPath: "/path/testFile2",
                        type: UssFileType.File,
                    },
                    {
                        ussPath: "/path/testFile3",
                        type: UssFileType.File,
                    },
                ],
            })
        );
        globalMocks.basePath.mockResolvedValue("/temp");
        return newMocks;
    }

    it("Tests node.pasteUssTree() reads clipboard contents and uploads files successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        blockMocks.pasteSpy.mockClear();

        jest.spyOn(blockMocks.mockUssApi, "fileList").mockResolvedValue(blockMocks.fileResponse);
        jest.spyOn(blockMocks.mockUssApi, "putContent").mockResolvedValue(blockMocks.fileResponse);
        jest.spyOn(blockMocks.mockUssApi, "uploadDirectory").mockResolvedValue(blockMocks.fileResponse);
        const mockCopyApi = jest.spyOn(blockMocks.mockUssApi, "copy").mockResolvedValue(Buffer.from(""));

        // Scenario 1: multiple files, pasting within same session (use new copy API)
        const mockToSameSession = jest.spyOn(UssFileUtils, "toSameSession").mockReturnValue(true);
        await blockMocks.testNode.pasteUssTree();
        expect(blockMocks.pasteSpy).toHaveBeenCalledTimes(3);
        expect(mockCopyApi).toHaveBeenCalledTimes(3);

        blockMocks.pasteSpy.mockClear();
        mockCopyApi.mockClear();

        // Scenario 2: copying multiple files between two sessions (should fallback to create/putContent APIs)
        mockToSameSession.mockReturnValue(false);
        await blockMocks.testNode.pasteUssTree();
        expect(blockMocks.pasteSpy).toHaveBeenCalledTimes(3);
        expect(blockMocks.mockUssApi.putContent).toHaveBeenCalledTimes(3);

        // Scenario 3: a directory, pasting within same session
        globalMocks.readText.mockResolvedValue(
            JSON.stringify({
                children: [
                    {
                        ussPath: "/path/folder1",
                        type: UssFileType.Directory,
                    },
                ],
            })
        );

        mockToSameSession.mockReturnValue(true);
        jest.spyOn(blockMocks.mockUssApi, "fileList").mockResolvedValueOnce(blockMocks.fileRespWithFolder);
        jest.spyOn(blockMocks.mockUssApi, "putContent").mockResolvedValueOnce(blockMocks.fileRespWithFolder);
        blockMocks.pasteSpy.mockClear();

        await blockMocks.testNode.pasteUssTree();
        // Only one paste operation is needed, copy API handles recursion out-of-the-box
        expect(blockMocks.pasteSpy).toHaveBeenCalledTimes(1);
        expect(mockCopyApi).toHaveBeenCalledTimes(1);
    });

    it("Tests node.pasteUssTree() reads clipboard contents finds same file name on destination directory", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(blockMocks.mockUssApi, "fileList").mockResolvedValueOnce(blockMocks.fileResponseSame);
        jest.spyOn(blockMocks.mockUssApi, "putContent").mockResolvedValueOnce(blockMocks.fileResponseSame);
        jest.spyOn(blockMocks.mockUssApi, "uploadDirectory").mockResolvedValueOnce(blockMocks.fileResponseSame);

        await blockMocks.testNode.pasteUssTree();
    });

    it("Tests node.pasteUssTree() could not retrieve fileList api response", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(blockMocks.mockUssApi, "fileList").mockResolvedValueOnce(blockMocks.fileResponseEmpty);
        jest.spyOn(blockMocks.mockUssApi, "putContent").mockResolvedValueOnce(blockMocks.fileResponseSame);
        jest.spyOn(blockMocks.mockUssApi, "uploadDirectory").mockResolvedValueOnce(blockMocks.fileResponseSame);

        await blockMocks.testNode.pasteUssTree();
    });
    it("Tests util disposeClipboardContents function correctly free clipboardContents", async () => {
        vscode.env.clipboard.writeText("test");
        ussUtils.disposeClipboardContents();
        expect(vscode.env.clipboard.readText()).toEqual(Promise.resolve({}));
    });
    it("Tests node.pasteUssTree() reads clipboard contents and returns early if nothing is in the clipboard", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.readText.mockResolvedValueOnce("");

        const fileListSpy = jest.spyOn(blockMocks.mockUssApi, "fileList");
        fileListSpy.mockClear();
        const pasteSpy = jest.spyOn(blockMocks.testNode, "paste");

        expect(await blockMocks.testNode.pasteUssTree()).toEqual(undefined);
        expect(pasteSpy).not.toHaveBeenCalled();
    });

    it("Tests node.pasteUssTree() reads clipboard contents and fails to upload directory & file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        jest.spyOn(blockMocks.mockUssApi, "fileList").mockResolvedValueOnce(blockMocks.fileResponse);
        jest.spyOn(blockMocks.mockUssApi, "putContent").mockResolvedValueOnce(blockMocks.fileResponse);
        jest.spyOn(blockMocks.mockUssApi, "uploadDirectory").mockRejectedValueOnce(blockMocks.fileResponse);

        await blockMocks.testNode.pasteUssTree();
    });
});
