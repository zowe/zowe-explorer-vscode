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

import * as ussNodeActions from "../../../src/uss/actions";
import { createUSSTree, createUSSNode, createFavoriteUSSNode } from "../../../__mocks__/mockCreators/uss";
import { createIProfile, createISession, createTreeView, createTextDocument, createFileResponse } from "../../../__mocks__/mockCreators/shared";
import { ValidProfileEnum, Profiles } from "../../../src/Profiles";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../../../src/globals";
import * as sharedUtils from "../../../src/shared/utils";
import * as zowe from "@zowe/cli";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as isbinaryfile from "isbinaryfile";

function createGlobalMocks() {
    const globalMocks = {
        showQuickPick: jest.fn(),
        showInputBox: jest.fn(),
        Create: jest.fn(),
        ussFile: jest.fn(),
        uss: jest.fn(),
        List: jest.fn(),
        showOpenDialog: jest.fn(),
        Download: jest.fn(),
        executeCommand: jest.fn(),
        openTextDocument: jest.fn(),
        withProgress: jest.fn(),
        writeText: jest.fn(),
        fileList: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        createTreeView: jest.fn(),
        fileToUSSFile: jest.fn(),
        Upload: jest.fn(),
        isBinaryFileSync: jest.fn(),
        concatChildNodes: jest.fn(),
        showTextDocument: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        Utilities: jest.fn(),
        isFileTagBinOrAscii: jest.fn(),
        theia: false,
        testSession: createISession(),
        testProfile: createIProfile(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
    };

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    // Mock the logger
    globals.defineGlobals("/test/path/");
    // tslint:disable-next-line: no-object-literal-type-assertion
    const extensionMock = jest.fn(() => ({
        subscriptions: [],
        extensionPath: path.join(__dirname, "..", "..")
    } as vscode.ExtensionContext));
    const mock = new extensionMock();
    const profilesForValidation = {status: "active", name: "fake"};
    globals.initLogger(mock);

    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(zowe, "Create", { value: globalMocks.Create, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", { value: globalMocks.showWarningMessage, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(sharedUtils, "concatChildNodes", { value: globalMocks.concatChildNodes, configurable: true });
    Object.defineProperty(globalMocks.Create, "uss", { value: globalMocks.uss, configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: globalMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: globalMocks.openTextDocument, configurable: true });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", { value: globalMocks.fileToUSSFile, configurable: true });
    Object.defineProperty(zowe, "Download", { value: globalMocks.Download, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", { value: globalMocks.showTextDocument, configurable: true });
    Object.defineProperty(globalMocks.Download, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "isFileTagBinOrAscii", { value: globalMocks.isFileTagBinOrAscii, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: globalMocks.showErrorMessage, configurable: true });
    Object.defineProperty(globalMocks.List, "fileList", { value: globalMocks.fileList, configurable: true });
    Object.defineProperty(zowe, "Upload", { value: globalMocks.Upload, configurable: true });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", { value: globalMocks.fileToUSSFile, configurable: true });
    Object.defineProperty(isbinaryfile, "isBinaryFileSync", { value: globalMocks.isBinaryFileSync, configurable: true });
    Object.defineProperty(vscode.env.clipboard, "writeText", { value: globalMocks.writeText, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => globalMocks.theia, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile
            };
        })
    });

    return globalMocks;
}

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                     [newMocks.ussNode], createTreeView());

        return newMocks;
    }

    it("Tests if createUSSNode is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showQuickPick.mockResolvedValueOnce("File");
        globalMocks.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(blockMocks.testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });
});

describe("USS Action Unit Tests - Function createUSSNode", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                     [newMocks.ussNode], createTreeView());

        return newMocks;
    }

    it("Tests that createUSSNode is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.showInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        spyOn(ussNodeActions, "refreshAllUSS");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder", isTopLevel);
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - Function refreshAllUSS", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                     [newMocks.ussNode], createTreeView());

        return newMocks;
    }

    it("Tests that refreshAllUSS() is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const profilesForValidation = {status: "active", name: "fake"};

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: globalMocks.mockLoadNamedProfile,
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    getProfiles: jest.fn(() => {
                        return [{name: globalMocks.testProfile.name, profile: globalMocks.testProfile},
                                {name: globalMocks.testProfile.name, profile: globalMocks.testProfile}];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    refresh: jest.fn(),
                };
            })
        });
        const spy = jest.spyOn(ussNodeActions, "refreshAllUSS");

        ussNodeActions.refreshAllUSS(blockMocks.testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function copyPath", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };

        return newMocks;
    }

    it("should copy the node's full path to the system clipboard", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.theia = false;
        await ussNodeActions.copyPath(blockMocks.ussNode);
        expect(globalMocks.writeText).toBeCalledWith(blockMocks.ussNode.fullPath);
    });

    it("should not copy the node's full path to the system clipboard if theia", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.theia = false;
        globalMocks.theia = true;

        await ussNodeActions.copyPath(blockMocks.ussNode);
        expect(globalMocks.writeText).not.toBeCalled();
    });
});

describe("USS Action Unit Tests - Function saveUSSFile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: createFileResponse({items: []}),
            testDoc: createTextDocument(path.join(globals.USS_DIR, "usstest", "/u/myuser/testFile")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                    [newMocks.ussNode], createTreeView());
        newMocks.mockGetEtag = jest.spyOn(newMocks.node, "getEtag").mockImplementation(() => "123");

        return newMocks;
    }

    it("Testing that saveUSSFile is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        blockMocks.testResponse.apiResponse.items = [{name: "testFile", mode: "-rwxrwx"}];
        blockMocks.testResponse.success = true;

        globalMocks.fileList.mockResolvedValueOnce(blockMocks.testResponse);
        globalMocks.withProgress.mockReturnValueOnce(blockMocks.testResponse);
        blockMocks.testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode, null, "/"), globalMocks.testSession]);

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(globalMocks.concatChildNodes.mock.calls.length).toBe(1);
        expect(blockMocks.mockGetEtag).toBeCalledTimes(1);
        expect(blockMocks.mockGetEtag).toReturnWith("123");
    });

    it("Tests that saveUSSFile fails when save fails", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        blockMocks.testResponse.success = false;
        blockMocks.testResponse.commandResponse = "Save failed";

        globalMocks.withProgress.mockReturnValueOnce(blockMocks.testResponse);

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("Save failed");
    });

    it("Tests that saveUSSFile fails when error occurs", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        globalMocks.withProgress.mockRejectedValueOnce(Error("Test Error"));

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("Test Error Error: Test Error");
    });

    it("Tests that saveUSSFile fails when HTTP error occurs", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        const downloadResponse = createFileResponse({etag: ""});
        blockMocks.testResponse.success = false;
        blockMocks.testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";

        globalMocks.withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        globalMocks.ussFile.mockResolvedValueOnce(downloadResponse);

        try {
            await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        } catch (e) { expect(e.message).toBe("vscode.Position is not a constructor"); }
        expect(globalMocks.showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: createFileResponse({items: []}),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile())
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                     [newMocks.ussNode], createTreeView());
        newMocks.mockGetEtag = jest.spyOn(newMocks.node, "getEtag").mockImplementation(() => "123");

        return newMocks;
    }

    it("Tests that uploadDialog() works for non-binary file", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        const fileUri = {fsPath: "/tmp/foo.txt"};
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        globalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(globalMocks.showOpenDialog).toBeCalled();
        expect(globalMocks.openTextDocument).toBeCalled();
        expect(blockMocks.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() works for binary file", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        const fileUri = {fsPath: "/tmp/foo.zip"};
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        globalMocks.isBinaryFileSync.mockReturnValueOnce(true);

        await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(globalMocks.showOpenDialog).toBeCalled();
        expect(blockMocks.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() throws an error successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        globalMocks.showInputBox.mockReturnValueOnce("new name");
        globalMocks.fileToUSSFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });
        const fileUri = {fsPath: "/tmp/foo.txt"};
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        globalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });
});

describe("USS Action Unit Tests - Function changeFileType", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            testUSSTree: null,
            getMvsApiMock: jest.fn(),
            testResponse: createFileResponse({ etag: "132" }),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            mvsApi: ZoweExplorerApiRegister.getMvsApi(globalMocks.testProfile)
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree([createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
                                                     [newMocks.ussNode], createTreeView());
        globalMocks.ussFile.mockResolvedValueOnce(newMocks.testResponse);
        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        newMocks.getMvsApiMock.mockReturnValue(newMocks.mvsApi);
        ZoweExplorerApiRegister.getMvsApi = newMocks.getMvsApiMock.bind(ZoweExplorerApiRegister);

        return newMocks;
    }

    it("Tests that changeFileType() runs successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const node = new ZoweUSSNode("node", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode, null, null);

        node.binary = true;
        node.contextValue = globals.DS_BINARY_FILE_CONTEXT;
        node.getSessionNode().binaryFiles[node.fullPath] = true;
        expect(node.binary).toBeTruthy();
        await ussNodeActions.changeFileType(node, false, blockMocks.testUSSTree);
        expect(node.binary).toBeFalsy();
    });
});
