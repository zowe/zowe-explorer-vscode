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
import { generateUSSTree, generateUSSNode, generateFavoriteUSSNode } from "../../../__mocks__/generators/uss";
import { generateIProfile, generateISession, generateTreeView, generateTextDocument, generateFileResponse } from "../../../__mocks__/generators/shared";
import { ValidProfileEnum, Profiles } from "../../../src/Profiles";
import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../../../src/globals";
import * as sharedUtils from "../../../src/shared/utils";
import * as zowe from "@zowe/cli";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as isbinaryfile from "isbinaryfile";

async function declareGlobals() {
    const globalVariables = {
        showQuickPick: jest.fn(),
        showInputBox: jest.fn(),
        Create: jest.fn(),
        ussFile: jest.fn(),
        uss: jest.fn(),
        List: jest.fn(),
        showOpenDialog: jest.fn(),
        Download: jest.fn(),
        openTextDocument: jest.fn(),
        withProgress: jest.fn(),
        writeText: jest.fn(),
        fileList: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        fileToUSSFile: jest.fn(),
        Upload: jest.fn(),
        isBinaryFileSync: jest.fn(),
        concatChildNodes: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        theia: false,
        testSession: generateISession(),
        testProfile: generateIProfile(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
    };

    globalVariables.mockLoadNamedProfile.mockReturnValue(globalVariables.testProfile);
    // Mock the logger
    globals.defineGlobals("/test/path/");
    // tslint:disable-next-line: no-object-literal-type-assertion
    const extensionMock = jest.fn(() => ({
        subscriptions: [],
        extensionPath: path.join(__dirname, "..", "..")
    } as vscode.ExtensionContext));
    const mock = new extensionMock();
    globals.initLogger(mock);

    Object.defineProperty(vscode.window, "showInputBox", { value: globalVariables.showInputBox });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalVariables.showQuickPick });
    Object.defineProperty(zowe, "Create", { value: globalVariables.Create });
    Object.defineProperty(vscode.window, "showWarningMessage", {value: globalVariables.showWarningMessage});
    Object.defineProperty(vscode.window, "withProgress", {value: globalVariables.withProgress});
    Object.defineProperty(sharedUtils, "concatChildNodes", {value: globalVariables.concatChildNodes});
    Object.defineProperty(globalVariables.Create, "uss", { value: globalVariables.uss });
    Object.defineProperty(vscode.window, "showOpenDialog", {value: globalVariables.showOpenDialog});
    Object.defineProperty(vscode.workspace, "openTextDocument", {value: globalVariables.openTextDocument});
    Object.defineProperty(globalVariables.Upload, "fileToUSSFile", {value: globalVariables.fileToUSSFile});
    Object.defineProperty(zowe, "Download", {value: globalVariables.Download});
    Object.defineProperty(globalVariables.Download, "ussFile", {value: globalVariables.ussFile});
    Object.defineProperty(vscode.window, "showErrorMessage", {value: globalVariables.showErrorMessage});
    Object.defineProperty(globalVariables.List, "fileList", {value: globalVariables.fileList});
    Object.defineProperty(zowe, "Upload", {value: globalVariables.Upload});
    Object.defineProperty(globalVariables.Upload, "fileToUSSFile", {value: globalVariables.fileToUSSFile});
    Object.defineProperty(isbinaryfile, "isBinaryFileSync", {value: globalVariables.isBinaryFileSync});
    Object.defineProperty(vscode.env.clipboard, "writeText", {value: globalVariables.writeText});
    Object.defineProperty(globals, "ISTHEIA", {get: () => globalVariables.theia});
    Object.defineProperty(vscode, "ProgressLocation", {value: globalVariables.ProgressLocation});
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
                loadNamedProfile: globalVariables.mockLoadNamedProfile
            };
        })
    });

    return globalVariables;
}

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await defineBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests if createUSSNode is executed successfully", async () => {
        globalVariables.showQuickPick.mockResolvedValueOnce("File");
        globalVariables.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(blockVariables.ussNode, blockVariables.testUSSTree);
        expect(blockVariables.testUSSTree.refreshAll).toHaveBeenCalled();
        expect(blockVariables.testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
    });
});

describe("USS Action Unit Tests - Function createUSSNode", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await defineBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests that createUSSNode is executed successfully", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNode(blockVariables.ussNode, blockVariables.testUSSTree, "file");
        expect(blockVariables.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(blockVariables.ussNode, blockVariables.testUSSTree, "file");
        expect(blockVariables.testUSSTree.refresh).not.toHaveBeenCalled();
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        spyOn(ussNodeActions, "refreshAllUSS");

        await ussNodeActions.createUSSNode(blockVariables.ussNode, blockVariables.testUSSTree, "folder", isTopLevel);
        expect(blockVariables.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - Function refreshAllUSS", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await defineBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests that refreshAllUSS() is executed successfully", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: globalVariables.mockLoadNamedProfile,
                    loadNamedProfile: globalVariables.mockLoadNamedProfile,
                    usesSecurity: true,
                    getProfiles: jest.fn(() => {
                        return [{name: globalVariables.testProfile.name, profile: globalVariables.testProfile},
                                {name: globalVariables.testProfile.name, profile: globalVariables.testProfile}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });
        const spy = jest.spyOn(ussNodeActions, "refreshAllUSS");

        ussNodeActions.refreshAllUSS(blockVariables.testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function copyPath", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        globalVariables.theia = false;
        blockVariables = await defineBlockVariables();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };

        return newVariables;
    }

    it("should copy the node's full path to the system clipboard", async () => {
        await ussNodeActions.copyPath(blockVariables.ussNode);
        expect(globalVariables.writeText).toBeCalledWith(blockVariables.ussNode.fullPath);
    });

    it("should not copy the node's full path to the system clipboard if theia", async () => {
        globalVariables.theia = true;

        await ussNodeActions.copyPath(blockVariables.ussNode);
        expect(globalVariables.writeText).not.toBeCalled();
    });
});

describe("USS Action Unit Tests - Function saveUSSFile", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await defineBlockVariables();
        globalVariables.withProgress.mockImplementation((progLocation, callback) => callback());
        globalVariables.fileToUSSFile.mockResolvedValue(blockVariables.testResponse);
        globalVariables.concatChildNodes.mockReturnValue([blockVariables.ussNode.children[0]]);
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: generateFileResponse({items: []}),
            testDoc: generateTextDocument(path.join(globals.USS_DIR, "usstest", "/u/myuser/testFile")),
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };

        newVariables.mockGetEtag = jest.spyOn(newVariables.node, "getEtag").mockImplementation(() => "123");
        newVariables.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newVariables.ussNode, null, "/");
        newVariables.ussNode.children.push(newVariables.node);
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile)],
                                                    [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Testing that saveUSSFile is executed successfully", async () => {
        blockVariables.testResponse.apiResponse.items = [{name: "testFile", mode: "-rwxrwx"}];
        blockVariables.testResponse.success = true;

        globalVariables.fileList.mockResolvedValueOnce(blockVariables.testResponse);
        globalVariables.withProgress.mockReturnValueOnce(blockVariables.testResponse);
        blockVariables.testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, blockVariables.ussNode, null, "/"), globalVariables.testSession]);

        await ussNodeActions.saveUSSFile(blockVariables.testDoc, blockVariables.testUSSTree);
        expect(globalVariables.concatChildNodes.mock.calls.length).toBe(1);
        expect(blockVariables.mockGetEtag).toBeCalledTimes(1);
        expect(blockVariables.mockGetEtag).toReturnWith("123");
    });

    it("Tests that saveUSSFile fails when save fails", async () => {
        blockVariables.testResponse.success = false;
        blockVariables.testResponse.commandResponse = "Save failed";

        globalVariables.withProgress.mockReturnValueOnce(blockVariables.testResponse);

        await ussNodeActions.saveUSSFile(blockVariables.testDoc, blockVariables.testUSSTree);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showErrorMessage.mock.calls[0][0]).toBe("Save failed");
    });

    it("Tests that saveUSSFile fails when error occurs", async () => {
        globalVariables.withProgress.mockRejectedValueOnce(Error("Test Error"));

        await ussNodeActions.saveUSSFile(blockVariables.testDoc, blockVariables.testUSSTree);
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
        expect(globalVariables.showErrorMessage.mock.calls[0][0]).toBe("Test Error Error: Test Error");
    });

    it("Tests that saveUSSFile fails when HTTP error occurs", async () => {
        const downloadResponse = generateFileResponse({etag: ""});
        blockVariables.testResponse.success = false;
        blockVariables.testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";

        globalVariables.withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        globalVariables.ussFile.mockResolvedValueOnce(downloadResponse);

        try {
            await ussNodeActions.saveUSSFile(blockVariables.testDoc, blockVariables.testUSSTree);
        } catch (e) { expect(e.message).toBe("vscode.Position is not a constructor"); }
        expect(globalVariables.showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    let globalVariables;
    let blockVariables;

    beforeEach(async () => {
        globalVariables = await declareGlobals();
        blockVariables = await defineBlockVariables();
        globalVariables.openTextDocument.mockResolvedValue(blockVariables.testDoc);
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function defineBlockVariables() {
        const newVariables = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: generateFileResponse({items: []}),
            testDoc: generateTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: generateUSSNode(globalVariables.testSession, generateIProfile())
        };

        newVariables.mockGetEtag = jest.spyOn(newVariables.node, "getEtag").mockImplementation(() => "123");
        newVariables.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newVariables.ussNode, null, "/");
        newVariables.ussNode.children.push(newVariables.node);
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(globalVariables.testSession, globalVariables.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests that uploadDialog() works for non-binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.txt"};
        globalVariables.showOpenDialog.mockReturnValue([fileUri]);
        globalVariables.isBinaryFileSync.mockReturnValueOnce(false);

        await ussNodeActions.uploadDialog(blockVariables.ussNode, blockVariables.testUSSTree);
        expect(globalVariables.showOpenDialog).toBeCalled();
        expect(globalVariables.openTextDocument).toBeCalled();
        expect(blockVariables.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() works for binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.zip"};
        globalVariables.showOpenDialog.mockReturnValue([fileUri]);
        globalVariables.isBinaryFileSync.mockReturnValueOnce(true);

        await ussNodeActions.uploadDialog(blockVariables.ussNode, blockVariables.testUSSTree);
        expect(globalVariables.showOpenDialog).toBeCalled();
        expect(blockVariables.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() throws an error successfully", async () => {
        globalVariables.showInputBox.mockReturnValueOnce("new name");
        globalVariables.fileToUSSFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });
        const fileUri = {fsPath: "/tmp/foo.txt"};
        globalVariables.showOpenDialog.mockReturnValue([fileUri]);
        globalVariables.isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await ussNodeActions.uploadDialog(blockVariables.ussNode, blockVariables.testUSSTree);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(globalVariables.showErrorMessage.mock.calls.length).toBe(1);
    });
});
