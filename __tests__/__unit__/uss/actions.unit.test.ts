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

const showQuickPick = jest.fn();
const showInputBox = jest.fn();
const Create = jest.fn();
const ussFile = jest.fn();
const uss = jest.fn();
const List = jest.fn();
const showOpenDialog = jest.fn();
const Download = jest.fn();
const openTextDocument = jest.fn();
const withProgress = jest.fn();
const writeText = jest.fn();
const fileList = jest.fn();
const showWarningMessage = jest.fn();
const showErrorMessage = jest.fn();
const fileToUSSFile = jest.fn();
const Upload = jest.fn();
const isBinaryFileSync = jest.fn();
const concatChildNodes = jest.fn();

Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
Object.defineProperty(zowe, "Create", { value: Create });
Object.defineProperty(vscode.window, "showWarningMessage", {value: showWarningMessage});
Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
Object.defineProperty(sharedUtils, "concatChildNodes", {value: concatChildNodes});
Object.defineProperty(Create, "uss", { value: uss });
Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
Object.defineProperty(zowe, "Download", {value: Download});
Object.defineProperty(Download, "ussFile", {value: ussFile});
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(List, "fileList", {value: fileList});
Object.defineProperty(zowe, "Upload", {value: Upload});
Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
Object.defineProperty(isbinaryfile, "isBinaryFileSync", {value: isBinaryFileSync});
Object.defineProperty(vscode.env.clipboard, "writeText", {value: writeText});
let theia = false;
Object.defineProperty(globals, "ISTHEIA", {get: () => theia});
const ProgressLocation = jest.fn().mockImplementation(() => {
    return {
        Notification: 15
    };
});
Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});

const testSession = generateISession();
const testProfile = generateIProfile();

const mockLoadNamedProfile = jest.fn();
mockLoadNamedProfile.mockReturnValue(testProfile);
Object.defineProperty(Profiles, "getInstance", {
    value: jest.fn(() => {
        return {
            allProfiles: [{name: "firstName"}, {name: "secondName"}],
            defaultProfile: {name: "firstName"},
            type: "zosmf",
            validProfile: ValidProfileEnum.VALID,
            checkCurrentProfile: jest.fn(),
            loadNamedProfile: mockLoadNamedProfile
        };
    })
});

// Mock the logger
globals.defineGlobals("/test/path/");
// tslint:disable-next-line: no-object-literal-type-assertion
const extensionMock = jest.fn(() => ({
    subscriptions: [],
    extensionPath: path.join(__dirname, "..", "..")
} as vscode.ExtensionContext));
const mock = new extensionMock();
globals.initLogger(mock);

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    let ussNode;
    let testUSSTree;

    beforeEach(() => {
        ussNode = generateUSSNode(testSession, generateIProfile());
        testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests if createUSSNode is executed successfully", async () => {
        showQuickPick.mockResolvedValueOnce("File");
        showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(ussNode, testUSSTree);
        expect(testUSSTree.refreshAll).toHaveBeenCalled();
        expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });
});

describe("USS Action Unit Tests - Function createUSSNode", () => {
    const ussNode = generateUSSNode(testSession, generateIProfile());
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());

    beforeEach(() => {
        showInputBox.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that createUSSNode is executed successfully", async () => {
        showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
        expect(testUSSTree.refreshElement).toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        showInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        showInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        spyOn(ussNodeActions, "refreshAllUSS");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "folder", isTopLevel);
        expect(testUSSTree.refreshElement).toHaveBeenCalled();
        expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - Function refreshAllUSS", () => {
    const ussNode = generateUSSNode(testSession, generateIProfile());
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());

    beforeEach(() => {
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that refreshAllUSS() is executed successfully", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: mockLoadNamedProfile,
                    loadNamedProfile: mockLoadNamedProfile,
                    usesSecurity: true,
                    getProfiles: jest.fn(() => {
                        return [{name: testProfile.name, profile: testProfile}, {name: testProfile.name, profile: testProfile}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });
        const spy = jest.spyOn(ussNodeActions, "refreshAllUSS");

        ussNodeActions.refreshAllUSS(testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function copyPath", () => {
    const ussNode = generateUSSNode(testSession, generateIProfile());

    beforeEach(() => {
        writeText.mockReset();
    });
    afterEach(() => {
        theia = false;
        jest.clearAllMocks();
    });

    it("should copy the node's full path to the system clipboard", async () => {
        await ussNodeActions.copyPath(ussNode);
        expect(writeText).toBeCalledWith(ussNode.fullPath);
    });

    it("should not copy the node's full path to the system clipboard if theia", async () => {
        theia = true;

        await ussNodeActions.copyPath(ussNode);
        expect(writeText).not.toBeCalled();
    });
});

describe("USS Action Unit Tests - Function saveUSSFile", () => {
    let mockGetEtag;

    const ussNode = generateUSSNode(testSession, generateIProfile());
    // ussNode.mProfileName = "usstest";
    // ussNode.dirty = true;
    const node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, ussNode, null, "/");
    ussNode.children.push(node);

    const testResponse = generateFileResponse({items: []});
    const testDoc = generateTextDocument(path.join(globals.USS_DIR, "usstest", "/u/myuser/testFile"));
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());

    beforeEach(() => {
        mockGetEtag = jest.spyOn(node, "getEtag").mockImplementation(() => "123");
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
        fileToUSSFile.mockResolvedValue(testResponse);
        concatChildNodes.mockReturnValue([ussNode.children[0]]);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Testing that saveUSSFile is executed successfully", async () => {
        testResponse.apiResponse.items = [{name: "testFile", mode: "-rwxrwx"}];
        testResponse.success = true;

        fileList.mockResolvedValueOnce(testResponse);
        withProgress.mockReturnValueOnce(testResponse);
        testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, ussNode, null, "/"), testSession]);

        await ussNodeActions.saveUSSFile(testDoc, testUSSTree);
        expect(concatChildNodes.mock.calls.length).toBe(1);
        expect(mockGetEtag).toBeCalledTimes(1);
        expect(mockGetEtag).toReturnWith("123");
    });

    it("Tests that saveUSSFile fails when save fails", async () => {
        testResponse.success = false;
        testResponse.commandResponse = "Save failed";

        withProgress.mockReturnValueOnce(testResponse);

        await ussNodeActions.saveUSSFile(testDoc, testUSSTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Save failed");
    });

    it("Tests that saveUSSFile fails when error occurs", async () => {
        withProgress.mockRejectedValueOnce(Error("Test Error"));

        await ussNodeActions.saveUSSFile(testDoc, testUSSTree);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Test Error Error: Test Error");
    });

    it("Tests that saveUSSFile fails when HTTP error occurs", async () => {
        const downloadResponse = generateFileResponse({etag: ""});
        testResponse.success = false;
        testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";

        withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        ussFile.mockResolvedValueOnce(downloadResponse);

        try {
            await ussNodeActions.saveUSSFile(testDoc, testUSSTree);
        } catch (e) { expect(e.message).toBe("vscode.Position is not a constructor"); }
        expect(showWarningMessage.mock.calls[0][0]).toBe("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    const ussNode = generateUSSNode(testSession, generateIProfile());
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());
    const testDoc = generateTextDocument(path.normalize("/sestest/tmp/foo.txt"));

    beforeEach(() => {
        openTextDocument.mockResolvedValue(testDoc);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that uploadDialog() works for non-binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.txt"};
        showOpenDialog.mockReturnValue([fileUri]);
        isBinaryFileSync.mockReturnValueOnce(false);

        await ussNodeActions.uploadDialog(ussNode, testUSSTree);
        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() works for binary file", async () => {
        const fileUri = {fsPath: "/tmp/foo.zip"};
        showOpenDialog.mockReturnValue([fileUri]);
        isBinaryFileSync.mockReturnValueOnce(true);

        await ussNodeActions.uploadDialog(ussNode, testUSSTree);
        expect(showOpenDialog).toBeCalled();
        expect(testUSSTree.refresh).toBeCalled();
    });

    it("Tests that uploadDialog() throws an error successfully", async () => {
        showInputBox.mockReturnValueOnce("new name");
        fileToUSSFile.mockImplementationOnce(() => {
            throw (Error("testError"));
        });
        const fileUri = {fsPath: "/tmp/foo.txt"};
        showOpenDialog.mockReturnValue([fileUri]);
        isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await ussNodeActions.uploadDialog(ussNode, testUSSTree);
            // tslint:disable-next-line:no-empty
        } catch (err) { }
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });
});
