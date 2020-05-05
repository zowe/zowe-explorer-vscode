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

async function generateEnvironmentalMocks() {
    const environmentalMocks = {
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

    environmentalMocks.mockLoadNamedProfile.mockReturnValue(environmentalMocks.testProfile);
    // Mock the logger
    globals.defineGlobals("/test/path/");
    // tslint:disable-next-line: no-object-literal-type-assertion
    const extensionMock = jest.fn(() => ({
        subscriptions: [],
        extensionPath: path.join(__dirname, "..", "..")
    } as vscode.ExtensionContext));
    const mock = new extensionMock();
    globals.initLogger(mock);

    Object.defineProperty(vscode.window, "showInputBox", { value: environmentalMocks.showInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: environmentalMocks.showQuickPick, configurable: true });
    Object.defineProperty(zowe, "Create", { value: environmentalMocks.Create, configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", { value: environmentalMocks.showWarningMessage, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: environmentalMocks.withProgress, configurable: true });
    Object.defineProperty(sharedUtils, "concatChildNodes", { value: environmentalMocks.concatChildNodes, configurable: true });
    Object.defineProperty(environmentalMocks.Create, "uss", { value: environmentalMocks.uss, configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: environmentalMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: environmentalMocks.openTextDocument, configurable: true });
    Object.defineProperty(environmentalMocks.Upload, "fileToUSSFile", { value: environmentalMocks.fileToUSSFile, configurable: true });
    Object.defineProperty(zowe, "Download", { value: environmentalMocks.Download, configurable: true });
    Object.defineProperty(environmentalMocks.Download, "ussFile", { value: environmentalMocks.ussFile, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: environmentalMocks.showErrorMessage, configurable: true });
    Object.defineProperty(environmentalMocks.List, "fileList", { value: environmentalMocks.fileList, configurable: true });
    Object.defineProperty(zowe, "Upload", { value: environmentalMocks.Upload, configurable: true });
    Object.defineProperty(environmentalMocks.Upload, "fileToUSSFile", { value: environmentalMocks.fileToUSSFile, configurable: true });
    Object.defineProperty(isbinaryfile, "isBinaryFileSync", { value: environmentalMocks.isBinaryFileSync, configurable: true });
    Object.defineProperty(vscode.env.clipboard, "writeText", { value: environmentalMocks.writeText, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => environmentalMocks.theia, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: environmentalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
                loadNamedProfile: environmentalMocks.mockLoadNamedProfile
            };
        })
    });

    return environmentalMocks;
}

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests if createUSSNode is executed successfully", async () => {
        environmentalMocks.showQuickPick.mockResolvedValueOnce("File");
        environmentalMocks.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(blockMocks.testUSSTree.refreshAll).toHaveBeenCalled();
        expect(blockMocks.testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });
});

describe("USS Action Unit Tests - Function createUSSNode", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests that createUSSNode is executed successfully", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        spyOn(ussNodeActions, "refreshAllUSS");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder", isTopLevel);
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - Function refreshAllUSS", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            testUSSTree: null,
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());

        return newVariables;
    }

    it("Tests that refreshAllUSS() is executed successfully", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: environmentalMocks.mockLoadNamedProfile,
                    loadNamedProfile: environmentalMocks.mockLoadNamedProfile,
                    usesSecurity: true,
                    getProfiles: jest.fn(() => {
                        return [{name: environmentalMocks.testProfile.name, profile: environmentalMocks.testProfile},
                                {name: environmentalMocks.testProfile.name, profile: environmentalMocks.testProfile}];
                    }),
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
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        environmentalMocks.theia = false;
        blockMocks = await generateBlockMocks();
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };

        return newVariables;
    }

    it("should copy the node's full path to the system clipboard", async () => {
        await ussNodeActions.copyPath(blockMocks.ussNode);
        expect(environmentalMocks.writeText).toBeCalledWith(blockMocks.ussNode.fullPath);
    });

    it("should not copy the node's full path to the system clipboard if theia", async () => {
        environmentalMocks.theia = true;

        await ussNodeActions.copyPath(blockMocks.ussNode);
        expect(environmentalMocks.writeText).not.toBeCalled();
    });
});

describe("USS Action Unit Tests - Function saveUSSFile", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
        environmentalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        environmentalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        environmentalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: generateFileResponse({items: []}),
            testDoc: generateTextDocument(path.join(globals.USS_DIR, "usstest", "/u/myuser/testFile")),
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };

        newVariables.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newVariables.ussNode, null, "/");
        newVariables.ussNode.children.push(newVariables.node);
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile)],
                                                    [newVariables.ussNode], generateTreeView());
        newVariables.mockGetEtag = jest.spyOn(newVariables.node, "getEtag").mockImplementation(() => "123");

        return newVariables;
    }

    it("Testing that saveUSSFile is executed successfully", async () => {
        blockMocks.testResponse.apiResponse.items = [{name: "testFile", mode: "-rwxrwx"}];
        blockMocks.testResponse.success = true;

        environmentalMocks.fileList.mockResolvedValueOnce(blockMocks.testResponse);
        environmentalMocks.withProgress.mockReturnValueOnce(blockMocks.testResponse);
        blockMocks.testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode, null, "/"), environmentalMocks.testSession]);

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(environmentalMocks.concatChildNodes.mock.calls.length).toBe(1);
        expect(blockMocks.mockGetEtag).toBeCalledTimes(1);
        expect(blockMocks.mockGetEtag).toReturnWith("123");
    });

    it("Tests that saveUSSFile fails when save fails", async () => {
        blockMocks.testResponse.success = false;
        blockMocks.testResponse.commandResponse = "Save failed";

        environmentalMocks.withProgress.mockReturnValueOnce(blockMocks.testResponse);

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toBe("Save failed");
    });

    it("Tests that saveUSSFile fails when error occurs", async () => {
        environmentalMocks.withProgress.mockRejectedValueOnce(Error("Test Error"));

        await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
        expect(environmentalMocks.showErrorMessage.mock.calls[0][0]).toBe("Test Error Error: Test Error");
    });

    it("Tests that saveUSSFile fails when HTTP error occurs", async () => {
        const downloadResponse = generateFileResponse({etag: ""});
        blockMocks.testResponse.success = false;
        blockMocks.testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";

        environmentalMocks.withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        environmentalMocks.ussFile.mockResolvedValueOnce(downloadResponse);

        try {
            await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        } catch (e) { expect(e.message).toBe("vscode.Position is not a constructor"); }
        expect(environmentalMocks.showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    let environmentalMocks;
    let blockMocks;

    beforeEach(async () => {
        environmentalMocks = await generateEnvironmentalMocks();
        blockMocks = await generateBlockMocks();
        environmentalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
    });
    afterEach(() => { jest.clearAllMocks(); });

    async function generateBlockMocks() {
        const newVariables = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: generateFileResponse({items: []}),
            testDoc: generateTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: generateUSSNode(environmentalMocks.testSession, generateIProfile())
        };

        newVariables.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newVariables.ussNode, null, "/");
        newVariables.ussNode.children.push(newVariables.node);
        newVariables.testUSSTree = generateUSSTree([generateFavoriteUSSNode(environmentalMocks.testSession, environmentalMocks.testProfile)],
                                                     [newVariables.ussNode], generateTreeView());
        newVariables.mockGetEtag = jest.spyOn(newVariables.node, "getEtag").mockImplementation(() => "123");

        return newVariables;
    }

    it("Tests that uploadDialog() works for non-binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.txt"};
        environmentalMocks.showOpenDialog.mockReturnValue([fileUri]);
        environmentalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(environmentalMocks.showOpenDialog).toBeCalled();
        expect(environmentalMocks.openTextDocument).toBeCalled();
        expect(blockMocks.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() works for binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.zip"};
        environmentalMocks.showOpenDialog.mockReturnValue([fileUri]);
        environmentalMocks.isBinaryFileSync.mockReturnValueOnce(true);

        await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(environmentalMocks.showOpenDialog).toBeCalled();
        expect(blockMocks.testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() throws an error successfully", async () => {
        environmentalMocks.showInputBox.mockReturnValueOnce("new name");
        environmentalMocks.fileToUSSFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });
        const fileUri = {fsPath: "/tmp/foo.txt"};
        environmentalMocks.showOpenDialog.mockReturnValue([fileUri]);
        environmentalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(environmentalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });
});
