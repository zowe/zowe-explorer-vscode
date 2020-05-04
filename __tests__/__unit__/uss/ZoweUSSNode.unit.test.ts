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
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { generateISession, generateISessionWithoutCredentials, generateIProfile,
    generateFileResponse, generateTreeView, generateInstanceOfProfile } from "../../../__mocks__/generators/shared";
import { generateUSSTree } from "../../../__mocks__/generators/uss";
import * as fs from "fs";
import * as path from "path";
import * as globals from "../../../src/globals";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";

async function declareGlobals() {
    const globalVariables = {
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
        session: generateISession(),
        profileOne: generateIProfile(),
        profileOps: null,
        response: generateFileResponse(),
        ussApi: null
    };

    globalVariables.profileOps = generateInstanceOfProfile(globalVariables.profileOne);
    globalVariables.ussApi = ZoweExplorerApiRegister.getUssApi(globalVariables.profileOne);
    globalVariables.mockLoadNamedProfile.mockReturnValue(globalVariables.profileOne);
    globalVariables.getUssApiMock.mockReturnValue(globalVariables.ussApi);
    ZoweExplorerApiRegister.getUssApi = globalVariables.getUssApiMock.bind(ZoweExplorerApiRegister);

    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: globalVariables.onDidSaveTextDocument, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalVariables.getConfiguration, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalVariables.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalVariables.showQuickPick, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: globalVariables.openTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: globalVariables.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: globalVariables.showTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: globalVariables.showErrorMessage, configurable: true });
    Object.defineProperty(globalVariables.Utilities, "isFileTagBinOrAscii", { value: globalVariables.isFileTagBinOrAscii, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalVariables.showInputBox, configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: globalVariables.ZosmfSession, configurable: true });
    Object.defineProperty(globalVariables.ZosmfSession, "createBasicZosmfSession",
        { value: globalVariables.createBasicZosmfSession, configurable: true });
    Object.defineProperty(zowe, "Download", { value: globalVariables.Download, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalVariables.Utilities, configurable: true });
    Object.defineProperty(globalVariables.Download, "ussFile", { value: globalVariables.ussFile, configurable: true });
    Object.defineProperty(zowe, "Delete", { value: globalVariables.Delete, configurable: true });
    Object.defineProperty(fs, "existsSync", { value: globalVariables.existsSync, configurable: true });
    Object.defineProperty(globalVariables.Delete, "ussFile", { value: globalVariables.ussFile, configurable: true });
    Object.defineProperty(Profiles, "createInstance", { value: jest.fn(() => globalVariables.profileOps), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => globalVariables.profileOps), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalVariables.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalVariables.withProgress, configurable: true });

    return globalVariables;
}

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        globalVariables.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalVariables.session, null, false, globalVariables.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, globalVariables.profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, globalVariables.profileOne.name, undefined);
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
            "/u", vscode.TreeItemCollapsibleState.None, null, globalVariables.session, null, false, globalVariables.profileOne.name, undefined);
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    let globalVariables;

    beforeEach(async () => { globalVariables = await declareGlobals(); });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that node.getSession() returns the proper globalVariables.session", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalVariables.session, null, false, globalVariables.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed,
            rootNode, null, null, false, globalVariables.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, globalVariables.profileOne.name, undefined);

        const returnedSession = child.getSession();
        expect(returnedSession).toBeDefined();
        expect(returnedSession).toStrictEqual(globalVariables.session);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            node: null,
            testUSSTree: null,
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                globalVariables.session, null, null, globalVariables.profileOne.name, "123"),
            ussNodeFav: new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded,
                null, globalVariables.session, null, false, globalVariables.profileOne.name)
        };

        newVariables.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newVariables.ussNode.fullPath = "/u/myuser";
        newVariables.node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, newVariables.ussNode, null, "/");
        newVariables.node.contextValue = globals.USS_SESSION_CONTEXT;
        newVariables.node.fullPath = "/u/myuser";
        newVariables.testUSSTree = generateUSSTree([newVariables.ussNodeFav], [newVariables.ussNode], generateTreeView());
        newVariables.ussNodeFav.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
        newVariables.ussNodeFav.fullPath = "/u/myuser/usstest";
        newVariables.ussNodeFav.tooltip = "/u/myuser/usstest";
        globalVariables.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        Object.defineProperty(newVariables.node, "isDirtyInEditor", { get: globalVariables.isDirtyInEditor });
        Object.defineProperty(newVariables.node, "openedDocumentInstance", { get: globalVariables.openedDocumentInstance });

        return newVariables;
    }

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user didn't cancel file save", async () => {
        globalVariables.ussFile.mockResolvedValue(globalVariables.response);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(true);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(false);

        await blockVariables.node.refreshUSS();

        expect(globalVariables.ussFile.mock.calls.length).toBe(1);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(2);
        expect(globalVariables.executeCommand.mock.calls.length).toBe(2);
        expect(blockVariables.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user cancelled file save", async () => {
        globalVariables.ussFile.mockResolvedValueOnce(globalVariables.response);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(true);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(true);

        await blockVariables.node.refreshUSS();

        expect(globalVariables.ussFile.mock.calls.length).toBe(0);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.executeCommand.mock.calls.length).toBe(1);
        expect(blockVariables.node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() works correctly for not dirty file state", async () => {
        globalVariables.ussFile.mockResolvedValueOnce(globalVariables.response);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(false);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(false);

        await blockVariables.node.refreshUSS();

        expect(globalVariables.ussFile.mock.calls.length).toBe(1);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(0);
        expect(globalVariables.executeCommand.mock.calls.length).toBe(1);
        expect(blockVariables.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        globalVariables.ussFile.mockRejectedValueOnce(Error(""));
        globalVariables.isDirtyInEditor.mockReturnValueOnce(true);
        globalVariables.isDirtyInEditor.mockReturnValueOnce(false);

        await blockVariables.node.refreshUSS();

        expect(globalVariables.ussFile.mock.calls.length).toBe(1);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.executeCommand.mock.calls.length).toBe(1);
        expect(blockVariables.node.downloaded).toBe(false);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that getEtag() returns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.session, null, false, globalVariables.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that setEtag() assigns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.session, null, false, globalVariables.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setBinary()", () => {
    let globalVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that node.setBinary() works", async () => {
        const rootNode = new ZoweUSSNode(globals.FAVORITE_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, null,
            globalVariables.session, null, false, globalVariables.profileOne.name, undefined);
        rootNode.contextValue = globals.FAVORITE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, globalVariables.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, globalVariables.profileOne.name, undefined);

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
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            ussNode: null,
            testUSSTree: null,
            mParent: new ZoweUSSNode(
                "parentNode", vscode.TreeItemCollapsibleState.Expanded, null, globalVariables.session, null, false, globalVariables.profileOne.name)
        };

        newVariables.ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded,
            newVariables.mParent, globalVariables.session, null, false, globalVariables.profileOne.name);
        newVariables.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newVariables.ussNode.fullPath = "/u/myuser";
        newVariables.testUSSTree = generateUSSTree([], [newVariables.ussNode], generateTreeView());
        globalVariables.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newVariables;
    }

    it("Tests that node is deleted if user verified", async () => {
        globalVariables.showQuickPick.mockResolvedValueOnce("Yes");
        await blockVariables.ussNode.deleteUSSNode(blockVariables.testUSSTree, "");
        expect(blockVariables.testUSSTree.refresh).toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user did not verify", async () => {
        globalVariables.showQuickPick.mockResolvedValueOnce("No");
        await blockVariables.ussNode.deleteUSSNode(blockVariables.testUSSTree, "");
        expect(blockVariables.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user cancelled", async () => {
        globalVariables.showQuickPick.mockResolvedValueOnce(undefined);
        await blockVariables.ussNode.deleteUSSNode(blockVariables.testUSSTree, "");
        expect(blockVariables.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if an error thrown", async () => {
        globalVariables.showQuickPick.mockResolvedValueOnce("Yes");
        globalVariables.ussFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await blockVariables.ussNode.deleteUSSNode(blockVariables.testUSSTree, "");
            // tslint:disable-next-line:no-empty
        } catch (err) { }

        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
        expect(blockVariables.testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            rootNode: new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.session,
                null, false, globalVariables.profileOne.name, undefined),
            childNode: null
        };
        newVariables.childNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            globalVariables.session, "root", false, globalVariables.profileOne.name, undefined);
        globalVariables.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newVariables;
    }

    it("Tests that node.getChildren() returns the correct Thenable<ZoweUSSNode[]>", async () => {
        blockVariables.rootNode.contextValue = globals.USS_DIR_CONTEXT;
        blockVariables.rootNode.dirty = true;

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockVariables.rootNode,
                globalVariables.session, "/u", false, globalVariables.profileOne.name, undefined),
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, blockVariables.rootNode,
                globalVariables.session, "/u", false, globalVariables.profileOne.name, undefined),
        ];
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [sampleChildren[1]] };
        blockVariables.rootNode.children.push(sampleChildren[0]);

        const rootChildren = await blockVariables.rootNode.getChildren();
        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");
    });

    it("Tests that node.getChildren() returns no children if none exist", async () => {
        const nodeNoChildren = new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockVariables.rootNode,
            globalVariables.session, "/u", false, globalVariables.profileOne.name, undefined);
        nodeNoChildren.dirty = false;

        const rootChildren = await nodeNoChildren.getChildren();
        expect(rootChildren.length).toBe(0);
    });

    it("Tests that error is thrown when node label is blank", async () => {
        blockVariables.rootNode.label = "";
        blockVariables.rootNode.dirty = true;

        expect(blockVariables.rootNode.getChildren()).rejects.toEqual(Error("Invalid node"));
    });

    it("Tests that when bright.List. causes an error on the zowe call, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            blockVariables.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockVariables.childNode.fullPath = "Throw Error";
            blockVariables.childNode.dirty = true;

            await blockVariables.childNode.getChildren();
            expect(globalVariables.showErrorMessage.mock.calls.length).toEqual(1);
            expect(globalVariables.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when bright.List returns an unsuccessful response, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            blockVariables.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockVariables.childNode.dirty = true;
            const subNode = new ZoweUSSNode("Response Fail", vscode.TreeItemCollapsibleState.Collapsed,
                blockVariables.childNode, null, null, false, globalVariables.profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;

            await subNode.getChildren();
            expect(globalVariables.showErrorMessage.mock.calls.length).toEqual(1);
            expect(globalVariables.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when passing a globalVariables.session node that is not dirty the node.getChildren() method is exited early", async () => {
        blockVariables.rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        blockVariables.rootNode.dirty = false;

        expect(await blockVariables.rootNode.getChildren()).toEqual([]);
    });

    it("Tests that when passing a globalVariables.session node with no hlq the node.getChildren() method is exited early", async () => {
        blockVariables.rootNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(await blockVariables.rootNode.getChildren()).toEqual([]);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openUSS()", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await declareBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function declareBlockVariables() {
        const newVariables = {
            testUSSTree: null,
            dsNode: null,
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                globalVariables.session, null, null, globalVariables.profileOne.name, "123")
        };

        newVariables.testUSSTree = generateUSSTree([], [newVariables.ussNode], generateTreeView());
        newVariables.dsNode = new ZoweUSSNode(
            "testSess", vscode.TreeItemCollapsibleState.Expanded, newVariables.ussNode, generateISessionWithoutCredentials(), null);

        newVariables.testUSSTree.getTreeView.mockReturnValue(generateTreeView());
        globalVariables.createBasicZosmfSession.mockReturnValue(globalVariables.session);
        globalVariables.ussFile.mockReturnValue(globalVariables.response);
        globalVariables.withProgress.mockReturnValue(globalVariables.response);
        globalVariables.openTextDocument.mockResolvedValue("test.doc");
        globalVariables.showInputBox.mockReturnValue("fake");
        globals.defineGlobals("/test/path/");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: globalVariables.mockLoadNamedProfile,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: globalVariables.mockLoadNamedProfile,
                    usesSecurity: true,
                    validProfile: ValidProfileEnum.VALID,
                    checkCurrentProfile: jest.fn(),
                    getProfiles: jest.fn(() => {
                        return [{name: globalVariables.profileOne.name, profile: globalVariables.profileOne},
                                {name: globalVariables.profileOne.name, profile: globalVariables.profileOne}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });

        return newVariables;
    }

    it("Tests that node.openUSS() is executed successfully", async () => {
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockVariables.ussNode,
            globalVariables.session, "/", false, globalVariables.profileOne.name);

        const isBinSpy = jest.spyOn(globalVariables.ussApi, "isFileTagBinOrAscii");
        globalVariables.existsSync.mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockVariables.testUSSTree);
        expect(globalVariables.existsSync.mock.calls.length).toBe(1);
        expect(globalVariables.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(globalVariables.isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(globalVariables.isFileTagBinOrAscii.mock.calls[0][0]).toBe(globalVariables.session);
        expect(globalVariables.isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(globalVariables.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        globalVariables.withProgress(globalVariables.downloadUSSFile);
        expect(globalVariables.withProgress).toBeCalledWith(globalVariables.downloadUSSFile);
        expect(globalVariables.openTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it ("Tests that node.openUSS() fails when an error is thrown", async () => {
        const parent = new ZoweUSSNode(
            "parent", vscode.TreeItemCollapsibleState.Collapsed, blockVariables.ussNode, null, "/", false, globalVariables.profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent, null, "/parent", false, globalVariables.profileOne.name);

        globalVariables.existsSync.mockReturnValue("exists");
        globalVariables.showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, blockVariables.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(globalVariables.ussFile.mock.calls.length).toBe(0);
        expect(globalVariables.openTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.openTextDocument.mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showErrorMessage.mock.calls[0][0]).toBe("testError Error: testError");
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        // Set up mock favorite globalVariables.session
        const favoriteSession = new ZoweUSSNode(
            "Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.session, null, false, globalVariables.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode(
            "favFile", vscode.TreeItemCollapsibleState.None, favoriteSession, globalVariables.session, "/", false, globalVariables.profileOne.name);
        favoriteFile.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, blockVariables.testUSSTree);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        // Set up mock favorite globalVariables.session
        const favoriteSession = new ZoweUSSNode(
            "Favorites", vscode.TreeItemCollapsibleState.Collapsed, null, globalVariables.session, null, false, globalVariables.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
                               false, globalVariables.profileOne.name);
        favoriteParent.contextValue = globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweUSSNode(
            "favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, globalVariables.profileOne.name);
        child.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, blockVariables.testUSSTree);
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        globalVariables.showTextDocument.mockReset();
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        globalVariables.isFileTagBinOrAscii.mockReturnValue(true);
        globalVariables.existsSync.mockReturnValue(null);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockVariables.ussNode,
            globalVariables.session, "/", false, blockVariables.ussNode.getProfileName());

        // Make sure correct file is downloaded
        await node.openUSS(false, true, blockVariables.testUSSTree);
        expect(globalVariables.existsSync.mock.calls.length).toBe(1);
        expect(globalVariables.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(globalVariables.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Make sure correct file is displayed in the editor
        globalVariables.withProgress(globalVariables.downloadUSSFile);
        expect(globalVariables.openTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(globalVariables.showTextDocument.mock.calls.length).toBe(1);
        expect(globalVariables.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const badParent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockVariables.ussNode, null, null);
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badParent, null, null);

        try {
            await brat.openUSS(false, true, blockVariables.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(globalVariables.ussFile.mock.calls.length).toBe(0);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(2);
        expect(globalVariables.showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(globalVariables.showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node. Error: open() called from invalid node.");
    });
});
