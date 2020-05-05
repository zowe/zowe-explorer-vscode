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

async function generateEnvironmentalMocks() {
    const environmentalMocks = {
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
        response: generateFileResponse({etag: "123"}),
        ussApi: null
    };

    environmentalMocks.profileOps = generateInstanceOfProfile(environmentalMocks.profileOne);
    environmentalMocks.ussApi = ZoweExplorerApiRegister.getUssApi(environmentalMocks.profileOne);
    environmentalMocks.mockLoadNamedProfile.mockReturnValue(environmentalMocks.profileOne);
    environmentalMocks.getUssApiMock.mockReturnValue(environmentalMocks.ussApi);
    ZoweExplorerApiRegister.getUssApi = environmentalMocks.getUssApiMock.bind(ZoweExplorerApiRegister);

    Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: environmentalMocks.onDidSaveTextDocument, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: environmentalMocks.getConfiguration, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: environmentalMocks.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: environmentalMocks.showQuickPick, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: environmentalMocks.openTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: environmentalMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: environmentalMocks.showTextDocument, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: environmentalMocks.showErrorMessage, configurable: true });
    Object.defineProperty(environmentalMocks.Utilities, "isFileTagBinOrAscii", { value: environmentalMocks.isFileTagBinOrAscii, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: environmentalMocks.showInputBox, configurable: true });
    Object.defineProperty(zowe, "ZosmfSession", { value: environmentalMocks.ZosmfSession, configurable: true });
    Object.defineProperty(environmentalMocks.ZosmfSession, "createBasicZosmfSession",
        { value: environmentalMocks.createBasicZosmfSession, configurable: true });
    Object.defineProperty(zowe, "Download", { value: environmentalMocks.Download, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: environmentalMocks.Utilities, configurable: true });
    Object.defineProperty(environmentalMocks.Download, "ussFile", { value: environmentalMocks.ussFile, configurable: true });
    Object.defineProperty(zowe, "Delete", { value: environmentalMocks.Delete, configurable: true });
    Object.defineProperty(fs, "existsSync", { value: environmentalMocks.existsSync, configurable: true });
    Object.defineProperty(environmentalMocks.Delete, "ussFile", { value: environmentalMocks.ussFile, configurable: true });
    Object.defineProperty(Profiles, "createInstance", { value: jest.fn(() => environmentalMocks.profileOps), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => environmentalMocks.profileOps), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: environmentalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: environmentalMocks.withProgress, configurable: true });

    return environmentalMocks;
}

describe("ZoweUSSNode Unit Tests - Initialization of class", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        environmentalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Checks that the ZoweUSSNode structure matches the snapshot", async () => {
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            environmentalMocks.session, null, false, environmentalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const testDir = new ZoweUSSNode(
            "testDir", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, false, environmentalMocks.profileOne.name, undefined);
        const testFile = new ZoweUSSNode(
            "testFile", vscode.TreeItemCollapsibleState.None, testDir, null, null, false, environmentalMocks.profileOne.name, undefined);
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
            "/u", vscode.TreeItemCollapsibleState.None, null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name, undefined);
        testNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeDefined();
        expect(testNode.getSession()).toBeDefined();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getSession()", () => {
    let environmentalMocks;

    beforeEach(async () => { environmentalMocks = await generateEnvironmentalMocks(); });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that node.getSession() returns the proper environmentalMocks.session", async () => {
        // Creating a rootNode
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            environmentalMocks.session, null, false, environmentalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const subNode = new ZoweUSSNode(globals.DS_PDS_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed,
            rootNode, null, null, false, environmentalMocks.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, environmentalMocks.profileOne.name, undefined);

        const returnedSession = child.getSession();
        expect(returnedSession).toBeDefined();
        expect(returnedSession).toStrictEqual(environmentalMocks.session);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.refreshUSS()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            node: null,
            testUSSTree: null,
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                environmentalMocks.session, null, null, environmentalMocks.profileOne.name, "123"),
            ussNodeFav: new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded,
                null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name)
        };

        newMocks.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.ussNode.fullPath = "/u/myuser";
        newMocks.node = new ZoweUSSNode("test-node", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.node.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.node.fullPath = "/u/myuser";
        newMocks.testUSSTree = generateUSSTree([newMocks.ussNodeFav], [newMocks.ussNode], generateTreeView());
        newMocks.ussNodeFav.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
        newMocks.ussNodeFav.fullPath = "/u/myuser/usstest";
        newMocks.ussNodeFav.tooltip = "/u/myuser/usstest";
        environmentalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        Object.defineProperty(newMocks.node, "isDirtyInEditor", { get: environmentalMocks.isDirtyInEditor });
        Object.defineProperty(newMocks.node, "openedDocumentInstance", { get: environmentalMocks.openedDocumentInstance });

        return newMocks;
    }

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user didn't cancel file save", async () => {
        environmentalMocks.ussFile.mockResolvedValue(environmentalMocks.response);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(1);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(2);
        expect(environmentalMocks.executeCommand.mock.calls.length).toBe(2);
        expect(blockMocks.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly for dirty file state, when user cancelled file save", async () => {
        environmentalMocks.ussFile.mockResolvedValueOnce(environmentalMocks.response);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(true);

        await blockMocks.node.refreshUSS();

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(0);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(false);
    });

    it("Tests that node.refreshUSS() works correctly for not dirty file state", async () => {
        environmentalMocks.ussFile.mockResolvedValueOnce(environmentalMocks.response);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(false);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(1);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(0);
        expect(environmentalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(true);
    });

    it("Tests that node.refreshUSS() works correctly with exception thrown in process", async () => {
        environmentalMocks.ussFile.mockRejectedValueOnce(Error(""));
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(true);
        environmentalMocks.isDirtyInEditor.mockReturnValueOnce(false);

        await blockMocks.node.refreshUSS();

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(1);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.executeCommand.mock.calls.length).toBe(1);
        expect(blockMocks.node.downloaded).toBe(false);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getEtag()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that getEtag() returns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setEtag()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that setEtag() assigns a value", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name, "123");
        expect(rootNode.getEtag() === "123");
        rootNode.setEtag("ABC");
        expect(rootNode.getEtag() === "ABC");
    });
});

describe("ZoweUSSNode Unit Tests - Function node.setBinary()", () => {
    let environmentalMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    it("Tests that node.setBinary() works", async () => {
        const rootNode = new ZoweUSSNode(globals.FAVORITE_CONTEXT, vscode.TreeItemCollapsibleState.Collapsed, null,
            environmentalMocks.session, null, false, environmentalMocks.profileOne.name, undefined);
        rootNode.contextValue = globals.FAVORITE_CONTEXT;
        const subNode = new ZoweUSSNode(
            "binaryFile", vscode.TreeItemCollapsibleState.Collapsed, rootNode, null, null, true, environmentalMocks.profileOne.name, undefined);
        const child = new ZoweUSSNode(
            "child", vscode.TreeItemCollapsibleState.None, subNode, null, null, false, environmentalMocks.profileOne.name, undefined);

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
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            ussNode: null,
            testUSSTree: null,
            mParent: new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, environmentalMocks.session,
                null, false, environmentalMocks.profileOne.name)
        };

        newMocks.ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded,
            newMocks.mParent, environmentalMocks.session, null, false, environmentalMocks.profileOne.name);
        newMocks.ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        newMocks.ussNode.fullPath = "/u/myuser";
        newMocks.testUSSTree = generateUSSTree([], [newMocks.ussNode], generateTreeView());
        environmentalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newMocks;
    }

    it("Tests that node is deleted if user verified", async () => {
        environmentalMocks.showQuickPick.mockResolvedValueOnce("Yes");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user did not verify", async () => {
        environmentalMocks.showQuickPick.mockResolvedValueOnce("No");
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if user cancelled", async () => {
        environmentalMocks.showQuickPick.mockResolvedValueOnce(undefined);
        await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });

    it("Tests that node is not deleted if an error thrown", async () => {
        environmentalMocks.showQuickPick.mockResolvedValueOnce("Yes");
        environmentalMocks.ussFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });

        try {
            await blockMocks.ussNode.deleteUSSNode(blockMocks.testUSSTree, "");
            // tslint:disable-next-line:no-empty
        } catch (err) { }

        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
    });
});

describe("ZoweUSSNode Unit Tests - Function node.getChildren()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            rootNode: new ZoweUSSNode("/u", vscode.TreeItemCollapsibleState.Collapsed, null, environmentalMocks.session,
                null, false, environmentalMocks.profileOne.name, undefined),
            childNode: null
        };
        newMocks.childNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null,
            environmentalMocks.session, "root", false, environmentalMocks.profileOne.name, undefined);
        environmentalMocks.withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });

        return newMocks;
    }

    it("Tests that node.getChildren() returns the correct Thenable<ZoweUSSNode[]>", async () => {
        blockMocks.rootNode.contextValue = globals.USS_DIR_CONTEXT;
        blockMocks.rootNode.dirty = true;

        // Creating structure of files and directories
        const sampleChildren: ZoweUSSNode[] = [
            new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.rootNode,
                environmentalMocks.session, "/u", false, environmentalMocks.profileOne.name, undefined),
            new ZoweUSSNode("myFile.txt", vscode.TreeItemCollapsibleState.None, blockMocks.rootNode,
                environmentalMocks.session, "/u", false, environmentalMocks.profileOne.name, undefined),
        ];
        sampleChildren[1].command = { command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [sampleChildren[1]] };
        blockMocks.rootNode.children.push(sampleChildren[0]);

        const rootChildren = await blockMocks.rootNode.getChildren();
        expect(rootChildren.length).toBe(2);
        expect(rootChildren[0].label).toBe("aDir");
        expect(rootChildren[1].label).toBe("myFile.txt");
    });

    it("Tests that node.getChildren() returns no children if none exist", async () => {
        const nodeNoChildren = new ZoweUSSNode("aDir", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.rootNode,
            environmentalMocks.session, "/u", false, environmentalMocks.profileOne.name, undefined);
        nodeNoChildren.dirty = false;

        const rootChildren = await nodeNoChildren.getChildren();
        expect(rootChildren.length).toBe(0);
    });

    it("Tests that error is thrown when node label is blank", async () => {
        blockMocks.rootNode.label = "";
        blockMocks.rootNode.dirty = true;

        expect(blockMocks.rootNode.getChildren()).rejects.toEqual(Error("Invalid node"));
    });

    it("Tests that when bright.List. causes an error on the zowe call, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            blockMocks.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockMocks.childNode.fullPath = "Throw Error";
            blockMocks.childNode.dirty = true;

            await blockMocks.childNode.getChildren();
            expect(environmentalMocks.showErrorMessage.mock.calls.length).toEqual(1);
            expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when bright.List returns an unsuccessful response, " +
        "node.getChildren() throws an error and the catch block is reached", async () => {
            blockMocks.childNode.contextValue = globals.USS_SESSION_CONTEXT;
            blockMocks.childNode.dirty = true;
            const subNode = new ZoweUSSNode("Response Fail", vscode.TreeItemCollapsibleState.Collapsed,
                blockMocks.childNode, null, null, false, environmentalMocks.profileOne.name, undefined);
            subNode.fullPath = "THROW ERROR";
            subNode.dirty = true;

            await subNode.getChildren();
            expect(environmentalMocks.showErrorMessage.mock.calls.length).toEqual(1);
            expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toEqual(
                "Retrieving response from uss-file-list Error: Throwing an error to check error handling for unit tests!");
        });

    it("Tests that when passing a environmentalMocks.session node that is not dirty the node.getChildren() method is exited early", async () => {
        blockMocks.rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        blockMocks.rootNode.dirty = false;

        expect(await blockMocks.rootNode.getChildren()).toEqual([]);
    });

    it("Tests that when passing a environmentalMocks.session node with no hlq the node.getChildren() method is exited early", async () => {
        blockMocks.rootNode.contextValue = globals.USS_SESSION_CONTEXT;

        expect(await blockMocks.rootNode.getChildren()).toEqual([]);
    });
});

describe("ZoweUSSNode Unit Tests - Function node.openUSS()", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newMocks = {
            testUSSTree: null,
            dsNode: null,
            ussNode: new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null,
                environmentalMocks.session, null, null, environmentalMocks.profileOne.name, "123")
        };

        newMocks.testUSSTree = generateUSSTree([], [newMocks.ussNode], generateTreeView());
        newMocks.dsNode = new ZoweUSSNode(
            "testSess", vscode.TreeItemCollapsibleState.Expanded, newMocks.ussNode, generateISessionWithoutCredentials(), null);

        newMocks.testUSSTree.getTreeView.mockReturnValue(generateTreeView());
        environmentalMocks.createBasicZosmfSession.mockReturnValue(environmentalMocks.session);
        environmentalMocks.ussFile.mockReturnValue(environmentalMocks.response);
        environmentalMocks.withProgress.mockReturnValue(environmentalMocks.response);
        environmentalMocks.openTextDocument.mockResolvedValue("test.doc");
        environmentalMocks.showInputBox.mockReturnValue("fake");
        globals.defineGlobals("/test/path/");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: environmentalMocks.mockLoadNamedProfile,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    loadNamedProfile: environmentalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    validProfile: ValidProfileEnum.VALID,
                    checkCurrentProfile: jest.fn(),
                    getProfiles: jest.fn(() => {
                        return [{name: environmentalMocks.profileOne.name, profile: environmentalMocks.profileOne},
                                {name: environmentalMocks.profileOne.name, profile: environmentalMocks.profileOne}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });

        return newMocks;
    }

    it("Tests that node.openUSS() is executed successfully", async () => {
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode,
            environmentalMocks.session, "/", false, environmentalMocks.profileOne.name);

        const isBinSpy = jest.spyOn(environmentalMocks.ussApi, "isFileTagBinOrAscii");
        environmentalMocks.existsSync.mockReturnValue(null);

        // Tests that correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(environmentalMocks.existsSync.mock.calls.length).toBe(1);
        expect(environmentalMocks.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.mProfileName + "/", node.fullPath));
        expect(environmentalMocks.isFileTagBinOrAscii.mock.calls.length).toBe(1);
        expect(environmentalMocks.isFileTagBinOrAscii.mock.calls[0][0]).toBe(environmentalMocks.session);
        expect(environmentalMocks.isFileTagBinOrAscii.mock.calls[0][1]).toBe(node.fullPath);
        expect(environmentalMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Tests that correct file is opened in editor
        environmentalMocks.withProgress(environmentalMocks.downloadUSSFile);
        expect(environmentalMocks.withProgress).toBeCalledWith(environmentalMocks.downloadUSSFile);
        expect(environmentalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it ("Tests that node.openUSS() fails when an error is thrown", async () => {
        const parent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussNode,
            null, "/", false, environmentalMocks.profileOne.name);
        const child = new ZoweUSSNode("child", vscode.TreeItemCollapsibleState.None, parent,
            null, "/parent", false, environmentalMocks.profileOne.name);

        environmentalMocks.existsSync.mockReturnValue("exists");
        environmentalMocks.showTextDocument.mockRejectedValueOnce(Error("testError"));

        try {
            await child.openUSS(false, true, blockMocks.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(0);
        expect(environmentalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.openTextDocument.mock.calls[0][0]).toBe(child.getUSSDocumentFilePath());
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toBe("testError Error: testError");
    });

    it("Tests that node.openUSS() executes successfully for favorited file", async () => {
        // Set up mock favorite environmentalMocks.session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited nodes (directly under Favorites)
        const favoriteFile = new ZoweUSSNode("favFile", vscode.TreeItemCollapsibleState.None,
            favoriteSession, environmentalMocks.session, "/", false, environmentalMocks.profileOne.name);
        favoriteFile.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;

        // For each node, make sure that code below the log.debug statement is execute
        await favoriteFile.openUSS(false, true, blockMocks.testUSSTree);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
    });

    it("Tests that node.openUSS() executes successfully for child file of favorited directory", async () => {
        // Set up mock favorite environmentalMocks.session
        const favoriteSession = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Collapsed,
            null, environmentalMocks.session, null, false, environmentalMocks.profileOne.name);
        favoriteSession.contextValue = globals.FAVORITE_CONTEXT;

        // Set up favorited directory with child file
        const favoriteParent = new ZoweUSSNode("favParent", vscode.TreeItemCollapsibleState.Collapsed, favoriteSession, null, "/",
                               false, environmentalMocks.profileOne.name);
        favoriteParent.contextValue = globals.USS_DIR_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweUSSNode(
            "favChild", vscode.TreeItemCollapsibleState.Collapsed, favoriteParent, null, "/favDir", false, environmentalMocks.profileOne.name);
        child.contextValue = globals.DS_TEXT_FILE_CONTEXT;

        await child.openUSS(false, true, blockMocks.testUSSTree);
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        environmentalMocks.showTextDocument.mockReset();
    });

    it("Tests that node.openUSS() is executed successfully when chtag says binary", async () => {
        environmentalMocks.isFileTagBinOrAscii.mockReturnValue(true);
        environmentalMocks.existsSync.mockReturnValue(null);

        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode,
            environmentalMocks.session, "/", false, blockMocks.ussNode.getProfileName());

        // Make sure correct file is downloaded
        await node.openUSS(false, true, blockMocks.testUSSTree);
        expect(environmentalMocks.existsSync.mock.calls.length).toBe(1);
        expect(environmentalMocks.existsSync.mock.calls[0][0]).toBe(path.join(globals.USS_DIR, "/" + node.getProfileName() + "/", node.fullPath));
        expect(environmentalMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Opening USS file..."
            }, expect.any(Function)
        );

        // Make sure correct file is displayed in the editor
        environmentalMocks.withProgress(environmentalMocks.downloadUSSFile);
        expect(environmentalMocks.openTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.openTextDocument.mock.calls[0][0]).toBe(node.getUSSDocumentFilePath());
        expect(environmentalMocks.showTextDocument.mock.calls.length).toBe(1);
        expect(environmentalMocks.showTextDocument.mock.calls[0][0]).toBe("test.doc");
    });

    it("Tests that node.openUSS() fails when passed an invalid node", async () => {
        const badParent = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.ussNode, null, null);
        badParent.contextValue = "turnip";
        const brat = new ZoweUSSNode("brat", vscode.TreeItemCollapsibleState.None, badParent, null, null);

        try {
            await brat.openUSS(false, true, blockMocks.testUSSTree);
        // tslint:disable-next-line: no-empty
        } catch (err) { }

        expect(environmentalMocks.ussFile.mock.calls.length).toBe(0);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(2);
        expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toBe("open() called from invalid node.");
        expect(environmentalMocks.showErrorMessage.mock.calls[1][0]).toBe("open() called from invalid node. Error: open() called from invalid node.");
    });
});
