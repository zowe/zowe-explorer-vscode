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

jest.mock("fs");

import * as zowe from "@zowe/cli";
import { Gui, IZoweTree, IZoweUSSTreeNode, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import * as ussNodeActions from "../../../src/uss/actions";
import { UssFileTree, UssFileType, UssFileUtils } from "../../../src/uss/FileStructure";
import { createUSSTree, createUSSNode, createFavoriteUSSNode } from "../../../__mocks__/mockCreators/uss";
import {
    createIProfile,
    createISession,
    createTreeView,
    createTextDocument,
    createFileResponse,
    createValidIProfile,
} from "../../../__mocks__/mockCreators/shared";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../../../src/globals";
import * as sharedUtils from "../../../src/shared/utils";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as isbinaryfile from "isbinaryfile";
import * as fs from "fs";
import { createUssApi, bindUssApi } from "../../../__mocks__/mockCreators/api";
import * as refreshActions from "../../../src/shared/refresh";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import * as wsUtils from "../../../src/utils/workspace";
import * as context from "../../../src/shared/context";
import { AttributeView } from "../../../src/uss/AttributeView";

function createGlobalMocks() {
    const globalMocks = {
        renameUSSFile: jest.fn(),
        showQuickPick: jest.fn(),
        mockShowInputBox: jest.fn(),
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
        setStatusBarMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
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
        testProfile: createValidIProfile(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
    };

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globals.defineGlobals("");
    const profilesForValidation = { status: "active", name: "fake" };

    Object.defineProperty(Gui, "setStatusBarMessage", { value: globalMocks.setStatusBarMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(zowe, "Create", { value: globalMocks.Create, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.showWarningMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(sharedUtils, "concatChildNodes", { value: globalMocks.concatChildNodes, configurable: true });
    Object.defineProperty(globalMocks.Create, "uss", { value: globalMocks.uss, configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: globalMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", {
        value: globalMocks.openTextDocument,
        configurable: true,
    });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", {
        value: globalMocks.fileToUSSFile,
        configurable: true,
    });
    Object.defineProperty(zowe, "Download", { value: globalMocks.Download, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", {
        value: globalMocks.showTextDocument,
        configurable: true,
    });
    Object.defineProperty(globalMocks.Download, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "renameUSSFile", {
        value: globalMocks.renameUSSFile,
        configurable: true,
    });
    Object.defineProperty(zowe, "Utilities", { value: globalMocks.Utilities, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "isFileTagBinOrAscii", {
        value: globalMocks.isFileTagBinOrAscii,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: globalMocks.showErrorMessage,
        configurable: true,
    });
    Object.defineProperty(globalMocks.List, "fileList", { value: globalMocks.fileList, configurable: true });
    Object.defineProperty(zowe, "Upload", { value: globalMocks.Upload, configurable: true });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", {
        value: globalMocks.fileToUSSFile,
        configurable: true,
    });
    Object.defineProperty(isbinaryfile, "isBinaryFileSync", {
        value: globalMocks.isBinaryFileSync,
        configurable: true,
    });
    Object.defineProperty(vscode.env.clipboard, "writeText", { value: globalMocks.writeText, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => globalMocks.theia, configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.workspace, "applyEdit", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
            };
        }),
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    return globalMocks;
}
// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            testTreeView: createTreeView(),
            mockCheckCurrentProfile: jest.fn(),
            ussApi: createUssApi(globalMocks.testProfile),
        };
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            newMocks.testTreeView
        );
        bindUssApi(newMocks.ussApi);

        return newMocks;
    }

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValue("USSFolder");
        jest.spyOn(blockMocks.ussNode, "getChildren").mockResolvedValueOnce([]);
        const isTopLevel = false;
        jest.spyOn(refreshActions, "refreshAll");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder", isTopLevel);
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(refreshActions.refreshAll).not.toHaveBeenCalled();
    });

    it("Tests if createUSSNode is executed successfully with Unverified profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: globalMocks.testProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        globalMocks.showQuickPick.mockResolvedValueOnce("File");
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(blockMocks.ussNode.getParent(), blockMocks.testUSSTree);
        expect(blockMocks.testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const testProfile = createIProfile();
        const ussApi = ZoweExplorerApiRegister.getUssApi(testProfile);
        const getUssApiMock = jest.fn().mockReturnValue(ussApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        const createSpy = jest.spyOn(ussApi, "create");

        blockMocks.ussNode.contextValue = globals.DS_BINARY_FILE_CONTEXT;
        blockMocks.ussNode.fullPath = "/test/path";

        globalMocks.mockShowInputBox.mockReturnValueOnce("testFile");
        jest.spyOn(blockMocks.testTreeView, "reveal").mockReturnValueOnce(new Promise((resolve) => resolve(null)));

        jest.spyOn(blockMocks.ussNode, "getChildren").mockResolvedValueOnce([]);

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(createSpy).toBeCalledWith("/test/path/testFile", "file");
    });

    it("Tests that createUSSNode fails if an error is thrown", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const getUssApiSpy = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockImplementationOnce(() => {
            throw Error("Test error");
        });
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");

        let testError;
        try {
            await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        } catch (err) {
            testError = err;
        }

        expect(testError?.message).toEqual("Test error");
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        jest.spyOn(blockMocks.ussNode, "getChildren").mockResolvedValueOnce([]);
        const isTopLevel = false;
        jest.spyOn(refreshActions, "refreshAll");

        await ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder", isTopLevel);
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(refreshActions.refreshAll).not.toHaveBeenCalled();
    });

    it("Tests that the error is handled if createUSSNode is unsuccessful", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        // Simulate unsuccessful api call
        Object.defineProperty(blockMocks.ussApi, "create", {
            value: jest.fn(() => {
                throw new Error();
            }),
        });

        await expect(ussNodeActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder", isTopLevel)).rejects.toThrow();
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function refreshUSSInTree", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );

        return newMocks;
    }
    it("should make the call to refresh the specified node within the USS tree", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await ussNodeActions.refreshUSSInTree(blockMocks.ussNode, blockMocks.testUSSTree);

        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });
});

describe("USS Action Unit Tests - Function deleteFromDisk", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );

        return newMocks;
    }

    it("should call unlink if file exists", () => {
        (fs.existsSync as any) = jest.fn<ReturnType<typeof fs.existsSync>, Parameters<typeof fs.existsSync>>((filePath: string) => {
            return true;
        });
        (fs.unlinkSync as any) = jest.fn<ReturnType<typeof fs.unlinkSync>, Parameters<typeof fs.unlinkSync>>((filePath: string) => {
            // do nothing
        });

        ussNodeActions.deleteFromDisk(null, "some/where/that/exists");

        expect(fs.existsSync).toBeCalledTimes(1);
        expect(fs.unlinkSync).toBeCalledTimes(1);
    });

    it("should call not unlink if file doesn't exist", () => {
        (fs.existsSync as any) = jest.fn<ReturnType<typeof fs.existsSync>, Parameters<typeof fs.existsSync>>((filePath: string) => {
            return false;
        });
        (fs.unlinkSync as any) = jest.fn<ReturnType<typeof fs.unlinkSync>, Parameters<typeof fs.unlinkSync>>((filePath: string) => {
            // do nothing
        });

        ussNodeActions.deleteFromDisk(null, "some/where/that/does/not/exist");

        expect(fs.existsSync).toBeCalledTimes(1);
        expect(fs.unlinkSync).toBeCalledTimes(0);
    });

    it("should catch the error when thrown", () => {
        const globalsLogWarnSpy = jest.fn();
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "unlinkSync").mockImplementation(() => {
            throw new Error();
        });
        Object.defineProperty(ZoweLogger, "warn", {
            value: globalsLogWarnSpy,
        });
        ussNodeActions.deleteFromDisk(null, "some/where/that/does/not/exist");
        expect(globalsLogWarnSpy).toBeCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function copyPath", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
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
            testResponse: createFileResponse({ items: [] }),
            testDoc: createTextDocument(path.join(globals.USS_DIR, "usstest", "u", "myuser", "testFile")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
        newMocks.mockGetEtag = jest.spyOn(newMocks.node, "getEtag").mockImplementation(() => "123");

        return newMocks;
    }

    it("Testing that saveUSSFile is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        blockMocks.testResponse.apiResponse.items = [{ name: "testFile", mode: "-rwxrwx" }];
        blockMocks.testResponse.success = true;

        globalMocks.fileList.mockResolvedValueOnce(blockMocks.testResponse);
        globalMocks.withProgress.mockReturnValueOnce(blockMocks.testResponse);
        blockMocks.testUSSTree.getChildren.mockReturnValueOnce([
            new ZoweUSSNode("testFile", vscode.TreeItemCollapsibleState.None, blockMocks.ussNode, null, "/"),
            globalMocks.testSession,
        ]);

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
        expect(mocked(vscode.workspace.applyEdit)).toHaveBeenCalledTimes(2);
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
        expect(globalMocks.showErrorMessage.mock.calls[0][0]).toBe("Error: Test Error");
        expect(mocked(vscode.workspace.applyEdit)).toHaveBeenCalledTimes(2);
    });

    it("Tests that saveUSSFile fails when HTTP error occurs", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        globalMocks.fileToUSSFile.mockResolvedValue(blockMocks.testResponse);
        globalMocks.concatChildNodes.mockReturnValue([blockMocks.ussNode.children[0]]);
        const downloadResponse = createFileResponse({ etag: "" });
        blockMocks.testResponse.success = false;
        blockMocks.testResponse.commandResponse = "Rest API failure with HTTP(S) status 412";

        globalMocks.withProgress.mockRejectedValueOnce(Error("Rest API failure with HTTP(S) status 412"));
        globalMocks.ussFile.mockResolvedValueOnce(downloadResponse);
        Object.defineProperty(wsUtils, "markDocumentUnsaved", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(context, "isTypeUssTreeNode", {
            value: jest.fn().mockReturnValueOnce(true),
            configurable: true,
        });
        const logSpy = jest.spyOn(ZoweLogger, "warn");
        const commandSpy = jest.spyOn(vscode.commands, "executeCommand");

        try {
            await ussNodeActions.saveUSSFile(blockMocks.testDoc, blockMocks.testUSSTree);
        } catch (e) {
            expect(e.message).toBe("vscode.Position is not a constructor");
        }
        expect(logSpy).toBeCalledWith("Remote file has changed. Presenting with way to resolve file.");
        expect(commandSpy).toBeCalledWith("workbench.files.action.compareWithSaved");
        logSpy.mockClear();
        commandSpy.mockClear();
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: createFileResponse({ items: [] }),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
        newMocks.mockGetEtag = jest.spyOn(newMocks.node, "getEtag").mockImplementation(() => "123");

        return newMocks;
    }

    it("Tests that uploadDialog() works for non-binary file", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        const fileUri = { fsPath: "/tmp/foo.txt" };
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
        const fileUri = { fsPath: "/tmp/foo.zip" };
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
        globalMocks.mockShowInputBox.mockReturnValueOnce("new name");
        globalMocks.fileToUSSFile.mockImplementationOnce(() => {
            throw Error("testError");
        });
        const fileUri = { fsPath: "/tmp/foo.txt" };
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        globalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await ussNodeActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree);
        } catch (err) {
            // prevent exception from failing test
        }
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
            mvsApi: ZoweExplorerApiRegister.getMvsApi(globalMocks.testProfile),
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
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

describe("USS Action Unit Tests - function uploadFile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            testUSSTree: null,
            getMvsApiMock: jest.fn(),
            testResponse: createFileResponse({ etag: "132" }),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            mvsApi: ZoweExplorerApiRegister.getMvsApi(globalMocks.testProfile),
        };

        newMocks.node = new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, newMocks.ussNode, null, "/");
        newMocks.ussNode.children.push(newMocks.node);
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
        globalMocks.ussFile.mockResolvedValueOnce(newMocks.testResponse);
        globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
        newMocks.getMvsApiMock.mockReturnValue(newMocks.mvsApi);
        ZoweExplorerApiRegister.getMvsApi = newMocks.getMvsApiMock.bind(ZoweExplorerApiRegister);

        return newMocks;
    }

    it("Tests upload file works with old API method", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const putContents = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: zowe.imperative.IProfileLoaded) => {
                return {
                    putContents,
                };
            }
        );

        await ussNodeActions.uploadFile(blockMocks.ussNode, { fileName: "madeup" } as any);
        expect(ZoweExplorerApiRegister.getUssApi(null).putContents).toBeCalled();
    });

    it("Tests upload file works with new API method", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: zowe.imperative.IProfileLoaded) => {
                return {
                    putContent,
                };
            }
        );

        await ussNodeActions.uploadFile(blockMocks.ussNode, { fileName: "madeup" } as any);
        expect(ZoweExplorerApiRegister.getUssApi(null).putContent).toBeCalled();
    });
});

describe("USS Action Unit Tests - copy file / directory", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            nodes: null,
            treeNodes: null,
        };

        newMocks.nodes = [
            new ZoweUSSNode("u/myuser/testFile", vscode.TreeItemCollapsibleState.None, null, globalMocks.testSession, "/"),
            new ZoweUSSNode("u/myuser/testDirectory", vscode.TreeItemCollapsibleState.None, null, globalMocks.testSession, "/"),
        ];

        newMocks.nodes[0].contextValue = globals.DS_TEXT_FILE_CONTEXT;
        newMocks.nodes[1].contextValue = globals.USS_DIR_CONTEXT;
        newMocks.nodes[0].refreshUSS = jest.fn().mockResolvedValueOnce(newMocks.nodes[0]);
        newMocks.nodes[1].refreshUSS = jest.fn().mockResolvedValueOnce(newMocks.nodes[1]);
        newMocks.nodes[1].getParent = jest.fn().mockResolvedValueOnce(undefined);
        newMocks.nodes[0].getParent = jest.fn().mockResolvedValueOnce(undefined);
        newMocks.nodes[1].getChildren = jest.fn().mockResolvedValueOnce([]);
        newMocks.nodes[0].getChildren = jest.fn().mockResolvedValueOnce([]);
        newMocks.nodes[1].getProfile = jest.fn().mockResolvedValueOnce({ name: "test" });
        newMocks.nodes[0].getProfile = jest.fn().mockResolvedValueOnce({ name: "test" });

        newMocks.treeNodes = {
            testUSSTree: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            testTreeView: createTreeView(),
            mockCheckCurrentProfile: jest.fn(),
            ussApi: createUssApi(globalMocks.testProfile),
            ussNodes: null,
        };

        newMocks.treeNodes.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.treeNodes.ussNode],
            newMocks.treeNodes.testTreeView
        );

        return newMocks;
    }

    it("Copy file(s), Directory(s) paths into clipboard", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const fileStructure = JSON.stringify(await ussNodeActions.ussFileStructure(blockMocks.nodes));
        await ussNodeActions.copyUssFilesToClipboard(blockMocks.nodes);

        expect(globalMocks.writeText).toBeCalledWith(fileStructure);
    });

    it("Has the proper responses for toSameSession in UssFileUtils", async () => {
        // Test toSameSession where one of the files has a diff LPAR
        let isSameSession = UssFileUtils.toSameSession(
            {
                localPath: "C:/some/local/path",
                ussPath: "/z/SOMEUSER/path",
                baseName: "<ROOT>",
                children: [],
                sessionName: "session1",
                type: UssFileType.Directory,
            },
            "diffSessionLPAR"
        );
        expect(isSameSession).toBe(false);

        // Test toSameSession where the LPAR is the same, and the file node has no children
        isSameSession = UssFileUtils.toSameSession(
            {
                localPath: "C:/some/local/path",
                ussPath: "/z/SOMEUSER/path",
                baseName: "<ROOT>",
                children: [],
                sessionName: "session1",
                type: UssFileType.Directory,
            },
            "session1"
        );
        expect(isSameSession).toBe(true);
    });

    it("paste calls relevant USS API functions", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const rootTree: UssFileTree = {
            children: [],
            baseName: blockMocks.nodes[1].getLabel() as string,
            ussPath: "",
            sessionName: blockMocks.treeNodes.ussNode.getLabel() as string,
            type: UssFileType.Directory,
        };
        blockMocks.treeNodes.ussApi.fileList = jest.fn().mockResolvedValue({
            apiResponse: {
                items: [blockMocks.nodes[0].getLabel() as string, blockMocks.nodes[1].getLabel() as string],
            },
        });
        blockMocks.treeNodes.ussApi.copy = jest.fn();
        await blockMocks.nodes[1].paste(rootTree.sessionName, rootTree.ussPath, { tree: rootTree, api: blockMocks.treeNodes.ussApi });
        expect(blockMocks.treeNodes.ussApi.fileList).toHaveBeenCalled();
        expect(blockMocks.treeNodes.ussApi.copy).toHaveBeenCalledWith(`/${blockMocks.nodes[1].getLabel()}`, {
            from: "",
            recursive: true,
        });
    });

    it("paste throws an error if required APIs are not available", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const rootTree: UssFileTree = {
            children: [],
            baseName: blockMocks.nodes[1].getLabel() as string,
            ussPath: "",
            sessionName: blockMocks.treeNodes.ussNode.getLabel() as string,
            type: UssFileType.Directory,
        };

        const originalFileList = blockMocks.treeNodes.ussApi.fileList;
        blockMocks.treeNodes.ussApi.copy = blockMocks.treeNodes.ussApi.fileList = undefined;
        try {
            await blockMocks.nodes[1].paste(rootTree.sessionName, rootTree.ussPath, { tree: rootTree, api: blockMocks.treeNodes.ussApi });
        } catch (err) {
            expect(err).toBeDefined();
            expect(err.message).toBe("Required API functions for pasting (fileList, copy and/or putContent) were not found.");
        }

        // Test for putContent also being undefined
        blockMocks.treeNodes.ussApi.fileList = originalFileList;
        blockMocks.treeNodes.ussApi.putContent = undefined;
        try {
            await blockMocks.nodes[1].paste(rootTree.sessionName, rootTree.ussPath, { tree: rootTree, api: blockMocks.treeNodes.ussApi });
        } catch (err) {
            expect(err).toBeDefined();
            expect(err.message).toBe("Required API functions for pasting (fileList, copy and/or putContent) were not found.");
        }
    });

    it("tests refreshChildNodesDirectory executed successfully with empty directory", async () => {
        jest.clearAllMocks();
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        await ussNodeActions.refreshChildNodesDirectory(blockMocks.nodes[0]);
        blockMocks.nodes[0].refreshUSS = jest.fn().mockResolvedValueOnce(blockMocks.nodes[0]);
        expect(blockMocks.nodes[0].refreshUSS).toBeCalledTimes(0);
    });

    it("tests refreshChildNodesDirectory executed successfully with file", async () => {
        jest.clearAllMocks();
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        await ussNodeActions.refreshChildNodesDirectory(blockMocks.nodes[0]);
        blockMocks.nodes[1].refreshUSS = jest.fn().mockResolvedValueOnce(blockMocks.nodes[1]);
        expect(blockMocks.nodes[1].refreshUSS).toBeCalledTimes(0);
    });
    it("tests refreshChildNodesDirectory executed successfully on a node with a child", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const node = new ZoweUSSNode("parent", vscode.TreeItemCollapsibleState.Collapsed, null, null, "/");
        node.getChildren = jest.fn().mockResolvedValueOnce([blockMocks.nodes[0]]);
        await ussNodeActions.refreshChildNodesDirectory(node);

        expect(blockMocks.nodes[0].refreshUSS).toBeCalledTimes(1);
    });

    it("tests copyUssFiles executed successfully via context menu with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        await ussNodeActions.copyUssFiles(blockMocks.treeNodes.ussNode, blockMocks.treeNodes.ussNodes, blockMocks.treeNodes.testUSSTree);
        expect(sharedUtils.getSelectedNodeList(blockMocks.treeNodes.ussNode, blockMocks.treeNodes.ussNodes)).toEqual([blockMocks.treeNodes.ussNode]);
    });
    it("tests copyUssFiles executed successfully via quick keys with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        await ussNodeActions.copyUssFiles(null, null, blockMocks.treeNodes.testUSSTree);
        expect(sharedUtils.getSelectedNodeList(blockMocks.treeNodes.ussNode, blockMocks.treeNodes.ussNodes)).toEqual([blockMocks.treeNodes.ussNode]);
    });

    it("tests pasteUssFile executed successfully with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const parent = blockMocks.treeNodes.testUSSTree.getTreeView();
        parent.selection = blockMocks.nodes[0];
        await ussNodeActions.pasteUssFile(blockMocks.treeNodes.testUSSTree, undefined);
        expect(sharedUtils.getSelectedNodeList(blockMocks.treeNodes.ussNode, blockMocks.treeNodes.ussNodes)).toEqual([blockMocks.treeNodes.ussNode]);
    });
    it("tests pasteUssFile executed successfully with one node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const parent = blockMocks.treeNodes.testUSSTree.getTreeView();
        parent.selection = blockMocks.nodes[0];
        jest.spyOn(ussNodeActions, "copyUssFilesToClipboard").mockResolvedValueOnce();
        await ussNodeActions.pasteUssFile(blockMocks.treeNodes.testUSSTree, blockMocks.nodes[0]);
        expect(sharedUtils.getSelectedNodeList(blockMocks.treeNodes.ussNode, blockMocks.treeNodes.ussNodes)).toEqual([blockMocks.treeNodes.ussNode]);
    });
});

describe("USS Action Unit Tests - function deleteUSSFilesPrompt", () => {
    it("should return true", async () => {
        const nodes = [createUSSNode(createISession(), createIProfile())];
        jest.spyOn(Gui, "warningMessage").mockReturnValue(Promise.resolve("Cancel"));
        await expect(ussNodeActions.deleteUSSFilesPrompt(nodes)).resolves.toEqual(true);
    });
});

describe("USS Action Unit Tests - function refreshDirectory", () => {
    const globalMocks = createGlobalMocks();
    const testUSSTree = createUSSTree(
        [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
        [createUSSNode(globalMocks.testSession, createIProfile())],
        createTreeView()
    );
    const testNode = createUSSNode(createISession(), createIProfile());

    it("should call refreshElement with node passed in", async () => {
        jest.spyOn(testNode, "getChildren").mockImplementation();
        const refreshElementSpy = jest.spyOn(testUSSTree, "refreshElement");
        await expect(ussNodeActions.refreshDirectory(testNode, testUSSTree)).resolves.not.toThrow();
        expect(refreshElementSpy).toBeCalledTimes(1);
        expect(refreshElementSpy).toBeCalledWith(testNode);
    });

    it("should call errorHandling when error is thrown", async () => {
        jest.spyOn(testNode, "getChildren").mockImplementation(() => {
            throw new Error();
        });
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling").mockImplementation();
        await expect(ussNodeActions.refreshDirectory(testNode, testUSSTree)).resolves.not.toThrow();
        expect(errorHandlingSpy).toBeCalledTimes(1);
    });
});

describe("USS Action Unit Tests - function editAttributes", () => {
    it("makes an instance of AttributeView", () => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            updateAttributes: jest.fn(),
        } as any);
        const view = ussNodeActions.editAttributes(
            {
                extensionPath: "/a/b/c",
            } as any,
            {} as IZoweTree<IZoweUSSTreeNode>,
            { label: "some/node", getProfile: jest.fn() } as unknown as IZoweUSSTreeNode
        );
        expect(view).toBeInstanceOf(AttributeView);
    });
});
