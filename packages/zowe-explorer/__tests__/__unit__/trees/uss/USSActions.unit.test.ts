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

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as isbinaryfile from "isbinaryfile";
import * as fs from "fs";
import * as vscode from "vscode";
import * as path from "path";
import { createUSSTree, createUSSNode, createFavoriteUSSNode } from "../../../__mocks__/mockCreators/uss";
import {
    createIProfile,
    createISession,
    createTreeView,
    createTextDocument,
    createFileResponse,
    createValidIProfile,
} from "../../../__mocks__/mockCreators/shared";
import { createUssApi, bindUssApi } from "../../../__mocks__/mockCreators/api";
import { Constants } from "../../../../src/configuration/Constants";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { Gui, Validation, imperative } from "@zowe/zowe-explorer-api";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { USSActions } from "../../../../src/trees/uss/USSActions";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ZoweUSSNode } from "../../../../src/trees/uss/ZoweUSSNode";
import { USSFileStructure } from "../../../../src/trees/uss/USSFileStructure";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { IZoweTree } from "../../../../../zowe-explorer-api/src/tree/IZoweTree";
import { IZoweUSSTreeNode } from "../../../../../zowe-explorer-api/src/tree";
import { USSAttributeView } from "../../../../src/trees/uss/USSAttributeView";
import { mocked } from "../../../__mocks__/mockUtils";
import { USSTree } from "../../../../src/trees/uss/USSTree";

jest.mock("../../../../src/tools/ZoweLogger");
jest.mock("fs");

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
        showInformationMessage: jest.fn(),
        fileList: jest.fn(),
        setStatusBarMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        createTreeView: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        fileToUSSFile: jest.fn(),
        Upload: jest.fn(),
        isBinaryFileSync: jest.fn(),
        concatChildNodes: jest.fn(),
        showTextDocument: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        Utilities: jest.fn(),
        isFileTagBinOrAscii: jest.fn(),
        testSession: createISession(),
        testProfile: createValidIProfile(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    const profilesForValidation = { status: "active", name: "fake" };

    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);
    Object.defineProperty(Gui, "setStatusBarMessage", { value: globalMocks.setStatusBarMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: globalMocks.showInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.showQuickPick, configurable: true });
    Object.defineProperty(zosfiles, "Create", { value: globalMocks.Create, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.executeCommand, configurable: true });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.showWarningMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(SharedUtils, "concatChildNodes", { value: globalMocks.concatChildNodes, configurable: true });
    Object.defineProperty(globalMocks.Create, "uss", { value: globalMocks.uss, configurable: true });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: globalMocks.showOpenDialog, configurable: true });
    Object.defineProperty(vscode.workspace, "openTextDocument", {
        value: globalMocks.openTextDocument,
        configurable: true,
    });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", {
        value: globalMocks.fileToUSSFile,
        configurable: true,
    });
    Object.defineProperty(zosfiles, "Download", { value: globalMocks.Download, configurable: true });
    Object.defineProperty(vscode.window, "showTextDocument", {
        value: globalMocks.showTextDocument,
        configurable: true,
    });
    Object.defineProperty(globalMocks.Download, "ussFile", { value: globalMocks.ussFile, configurable: true });
    Object.defineProperty(globalMocks.Utilities, "renameUSSFile", {
        value: globalMocks.renameUSSFile,
        configurable: true,
    });
    Object.defineProperty(zosfiles, "Utilities", { value: globalMocks.Utilities, configurable: true });
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
    Object.defineProperty(zosfiles, "Upload", { value: globalMocks.Upload, configurable: true });
    Object.defineProperty(globalMocks.Upload, "fileToUSSFile", {
        value: globalMocks.fileToUSSFile,
        configurable: true,
    });
    Object.defineProperty(isbinaryfile, "isBinaryFileSync", {
        value: globalMocks.isBinaryFileSync,
        configurable: true,
    });
    Object.defineProperty(vscode.env.clipboard, "writeText", { value: globalMocks.writeText, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.workspace, "applyEdit", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
                type: "zosmf",
                validProfile: Validation.ValidationType.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
            };
        }),
    });
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

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    function createBlockMocks(globalMocks) {
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

    it("Tests if createUSSNode is executed successfully with Unverified profile", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockResolvedValueOnce({
                        name: globalMocks.testProfile.name,
                        status: "unverified",
                    }),
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        const refreshAllMock = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
        const createApiMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementation();

        await USSActions.createUSSNode(blockMocks.ussNode.getParent(), blockMocks.testUSSTree, "directory");
        expect(refreshAllMock).toHaveBeenCalled();
        expect(createApiMock).toHaveBeenCalled();
        expect(blockMocks.testUSSTree.refreshElement).not.toHaveBeenCalled();
        createApiMock.mockRestore();
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("");

        await USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(blockMocks.testUSSTree.refresh).not.toHaveBeenCalled();
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode is executed successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testProfile = createIProfile();
        const ussApi = ZoweExplorerApiRegister.getUssApi(testProfile);
        const getUssApiMock = jest.fn().mockReturnValue(ussApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        const createSpy = jest.spyOn(ussApi, "create");

        blockMocks.ussNode.contextValue = Constants.USS_BINARY_FILE_CONTEXT;
        blockMocks.ussNode.fullPath = "/test/path";

        globalMocks.mockShowInputBox.mockReturnValueOnce("testFile");
        jest.spyOn(blockMocks.testTreeView, "reveal").mockReturnValueOnce(new Promise((resolve) => resolve(null)));

        jest.spyOn(blockMocks.ussNode, "getChildren").mockResolvedValueOnce([]);

        await USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(createSpy).toHaveBeenCalledWith("/test/path/testFile", "file");
    });

    it("Tests that createUSSNode refreshes the equivalent node (favorite/non-favorite)", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testProfile = createIProfile();
        const ussApi = ZoweExplorerApiRegister.getUssApi(testProfile);
        const getUssApiMock = jest.fn().mockReturnValue(ussApi);
        ZoweExplorerApiRegister.getUssApi = getUssApiMock.bind(ZoweExplorerApiRegister);
        const createSpy = jest.spyOn(ussApi, "create");

        blockMocks.ussNode.contextValue = Constants.USS_BINARY_FILE_CONTEXT;
        blockMocks.ussNode.fullPath = "/test/path";

        globalMocks.mockShowInputBox.mockReturnValueOnce("testFile");
        jest.spyOn(blockMocks.testTreeView, "reveal").mockReturnValueOnce(new Promise((resolve) => resolve(null)));
        const refreshElemSpy = jest.spyOn(blockMocks.testUSSTree as unknown as any, "refreshElement");
        jest.spyOn(blockMocks.testUSSTree as unknown as any, "findEquivalentNode").mockReturnValueOnce(blockMocks.ussNode);

        jest.spyOn(blockMocks.ussNode, "getChildren").mockResolvedValueOnce([]);

        await USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        expect(createSpy).toHaveBeenCalledWith("/test/path/testFile", "file");
        expect(refreshElemSpy).toHaveBeenCalled();
    });

    it("Tests that createUSSNode fails if an error is thrown", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const ussApi = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockImplementationOnce(() => {
            throw Error("Test error");
        });
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");

        let testError;
        try {
            await USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "file");
        } catch (err) {
            testError = err;
        }

        expect(testError?.message).toEqual("Test error");
        ussApi.mockRestore();
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        const refreshAllSpy = jest.spyOn(SharedActions, "refreshAll");
        refreshAllSpy.mockRestore();

        await USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder");
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
        expect(refreshAllSpy).not.toHaveBeenCalled();
    });

    it("Tests that the error is handled if createUSSNode is unsuccessful", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling");

        // Simulate unsuccessful api call
        const createMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementationOnce(async (ussPath, type, mode) => {
            throw new Error();
        });

        await expect(USSActions.createUSSNode(blockMocks.ussNode, blockMocks.testUSSTree, "folder")).rejects.toThrow();
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
        createMock.mockRestore();
    });
});

describe("USS Action Unit Tests - Function refreshUSSInTree", () => {
    function createBlockMocks(globalMocks) {
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
        const blockMocks = createBlockMocks(globalMocks);

        await USSActions.refreshUSSInTree(blockMocks.ussNode, blockMocks.testUSSTree);

        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });
});

describe("USS Action Unit Tests - Function deleteFromDisk", () => {
    it("should call unlink if file exists", () => {
        (fs.existsSync as any) = jest.fn<ReturnType<typeof fs.existsSync>, Parameters<typeof fs.existsSync>>((_filePath: string) => {
            return true;
        });
        (fs.unlinkSync as any) = jest.fn<ReturnType<typeof fs.unlinkSync>, Parameters<typeof fs.unlinkSync>>((_filePath: string) => {
            // do nothing
        });

        USSActions.deleteFromDisk(null, "some/where/that/exists");

        expect(fs.existsSync).toHaveBeenCalledTimes(1);
        expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it("should call not unlink if file doesn't exist", () => {
        (fs.existsSync as any) = jest.fn<ReturnType<typeof fs.existsSync>, Parameters<typeof fs.existsSync>>((_filePath: string) => {
            return false;
        });
        (fs.unlinkSync as any) = jest.fn<ReturnType<typeof fs.unlinkSync>, Parameters<typeof fs.unlinkSync>>((_filePath: string) => {
            // do nothing
        });

        USSActions.deleteFromDisk(null, "some/where/that/does/not/exist");

        expect(fs.existsSync).toHaveBeenCalledTimes(1);
        expect(fs.unlinkSync).toHaveBeenCalledTimes(0);
    });

    it("should catch the error when thrown", () => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "unlinkSync").mockImplementation(() => {
            throw new Error();
        });
        const warnSpy = jest.spyOn(ZoweLogger, "warn");
        warnSpy.mockRestore();
        USSActions.deleteFromDisk(null, "some/where/that/does/not/exist");
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - Function copyPath", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };

        return newMocks;
    }

    it("should copy the node's full path to the system clipboard", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        await USSActions.copyPath(blockMocks.ussNode);
        expect(globalMocks.writeText).toHaveBeenCalledWith(blockMocks.ussNode.fullPath);
    });
});

describe("USS Action Unit Tests - Functions uploadDialog & uploadFile", () => {
    function createBlockMocks(globalMocks) {
        Object.defineProperty(vscode.window, "withProgress", {
            value: jest.fn().mockImplementation((progLocation, callback) => {
                const progress = {
                    report: jest.fn(),
                };
                const token = {
                    isCancellationRequested: false,
                    onCancellationRequested: jest.fn(),
                };
                return callback(progress, token);
            }),
            configurable: true,
        });
        const newMocks = {
            node: null,
            mockGetEtag: null,
            testUSSTree: null,
            testResponse: createFileResponse({ items: [] }),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
        };

        newMocks.node = new ZoweUSSNode({
            label: "u/myuser/testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: newMocks.ussNode,
            parentPath: "/",
        });
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
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        const fileUri = { fsPath: "/tmp/foo.txt" };
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);

        await USSActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree, false);
        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(globalMocks.openTextDocument).toHaveBeenCalled();
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });

    it("Tests that uploadDialog() works for binary file", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        const fileUri = { fsPath: "/tmp/foo.zip" };
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);

        await USSActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree, true);
        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });

    it("shouldn't call upload dialog and not upload file if selection is empty", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        globalMocks.showOpenDialog.mockReturnValue(undefined);
        await USSActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree, true);
        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(globalMocks.showInformationMessage.mock.calls.map((call) => call[0])).toEqual(["Operation Cancelled"]);
    });

    it("Tests that uploadDialog() throws an error successfully", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.openTextDocument.mockResolvedValue(blockMocks.testDoc);
        globalMocks.mockShowInputBox.mockReturnValueOnce("new name");
        globalMocks.fileToUSSFile.mockImplementationOnce(() => {
            throw Error("testError");
        });
        const fileUri = { fsPath: "/tmp/foo.txt" };
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        globalMocks.isBinaryFileSync.mockReturnValueOnce(false);

        try {
            await USSActions.uploadDialog(blockMocks.ussNode, blockMocks.testUSSTree, false);
        } catch (err) {
            // prevent exception from failing test
        }
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });
});

describe("USS Action Unit Tests - function uploadFile", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            node: null,
            testUSSTree: null,
            getMvsApiMock: jest.fn(),
            testResponse: createFileResponse({ etag: "132" }),
            testDoc: createTextDocument(path.normalize("/sestest/tmp/foo.txt")),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            mvsApi: ZoweExplorerApiRegister.getMvsApi(globalMocks.testProfile),
        };

        newMocks.node = new ZoweUSSNode({
            label: "u/myuser/testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: newMocks.ussNode,
            parentPath: "/",
        });
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

    it("Tests upload file works with new API method", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (_profile: imperative.IProfileLoaded) => {
                return {
                    putContent,
                };
            }
        );

        await USSActions.uploadFile(blockMocks.ussNode, { fileName: "madeup" } as any);
        expect(ZoweExplorerApiRegister.getUssApi(null).putContent).toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - copy file / directory", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null as unknown as USSTree,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            testTreeView: createTreeView(),
            mockCheckCurrentProfile: jest.fn(),
            ussApi: createUssApi(globalMocks.testProfile),
            ussNodes: [] as IZoweUSSTreeNode[],
        };

        const parentNode = new ZoweUSSNode({
            label: "profile",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
        });
        newMocks.ussNodes.push(
            new ZoweUSSNode({
                label: "testFile",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode,
                parentPath: "/u/myuser",
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
            })
        );
        newMocks.ussNodes.push(
            new ZoweUSSNode({
                label: "testDirectory",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode,
                parentPath: "/u/myuser",
                contextOverride: Constants.USS_DIR_CONTEXT,
            })
        );

        newMocks.ussNodes[0].getChildren = jest.fn().mockResolvedValue([]);
        newMocks.ussNodes[1].getChildren = jest.fn().mockResolvedValue([]);
        newMocks.ussNodes[0].refreshUSS = jest.fn().mockResolvedValue(undefined);
        newMocks.ussNodes[1].refreshUSS = jest.fn().mockResolvedValue(undefined);

        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            newMocks.testTreeView
        );

        return newMocks;
    }

    it("Copy file(s), Directory(s) paths into clipboard", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const getEncodingForFileMock = jest.spyOn(ZoweUSSNode.prototype, "getEncoding").mockReturnValue(undefined as any);
        const fileStructure = JSON.stringify(await USSActions.ussFileStructure(blockMocks.ussNodes));
        await USSActions.copyUssFilesToClipboard(blockMocks.ussNodes);

        expect(globalMocks.writeText).toHaveBeenCalledWith(fileStructure);
        getEncodingForFileMock.mockRestore();
    });

    it("Has the proper responses for toSameSession in UssFileUtils", () => {
        // Test toSameSession where one of the files has a diff LPAR
        let isSameSession = USSFileStructure.UssFileUtils.toSameSession(
            {
                localUri: vscode.Uri.file("C:/some/local/path"),
                ussPath: "/z/SOMEUSER/path",
                baseName: "<ROOT>",
                children: [],
                sessionName: "session1",
                type: USSFileStructure.UssFileType.Directory,
            },
            "diffSessionLPAR"
        );
        expect(isSameSession).toBe(false);

        // Test toSameSession where the LPAR is the same, and the file node has no children
        isSameSession = USSFileStructure.UssFileUtils.toSameSession(
            {
                localUri: vscode.Uri.file("C:/some/local/path"),
                ussPath: "/z/SOMEUSER/path",
                baseName: "<ROOT>",
                children: [],
                sessionName: "session1",
                type: USSFileStructure.UssFileType.Directory,
            },
            "session1"
        );
        expect(isSameSession).toBe(true);
    });

    it("paste calls relevant function in FileSystemProvider", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const rootTree: USSFileStructure.UssFileTree = {
            children: [],
            baseName: blockMocks.ussNodes[1].getLabel() as string,
            ussPath: "/",
            sessionName: blockMocks.ussNode.getLabel() as string,
            type: USSFileStructure.UssFileType.Directory,
            localUri: blockMocks.ussNodes[1].resourceUri,
        };

        const copySpy = jest.spyOn(UssFSProvider.instance, "copy").mockImplementation();
        await blockMocks.ussNodes[1].paste(blockMocks.ussNodes[1].resourceUri, { tree: rootTree, api: { copy: jest.fn(), fileList: jest.fn() } });
        expect(copySpy).toHaveBeenCalled();
    });

    it("paste throws an error if required APIs are not available", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const rootTree: USSFileStructure.UssFileTree = {
            children: [],
            baseName: blockMocks.ussNodes[1].getLabel() as string,
            ussPath: "/",
            sessionName: blockMocks.ussNode.getLabel() as string,
            type: USSFileStructure.UssFileType.Directory,
        };

        const originalFileList = blockMocks.ussApi.fileList;
        blockMocks.ussApi.copy = blockMocks.ussApi.fileList = undefined;
        try {
            await blockMocks.ussNodes[1].paste(blockMocks.ussNodes[1].resourceUri, { tree: rootTree, api: blockMocks.ussApi });
        } catch (err) {
            expect(err).toBeDefined();
            expect(err.message).toBe("Required API functions for pasting (fileList and copy/uploadFromBuffer) were not found.");
        }

        // Test for uploadFromBuffer also being undefined
        blockMocks.ussApi.fileList = originalFileList;
        blockMocks.ussApi.copy = jest.fn();
        blockMocks.ussApi.uploadFromBuffer = undefined;
        try {
            await blockMocks.ussNodes[1].paste(blockMocks.ussNodes[1].resourceUri, { tree: rootTree, api: blockMocks.ussApi });
        } catch (err) {
            expect(err).toBeDefined();
            expect(err.message).toBe("Required API functions for pasting (fileList and copy/uploadFromBuffer) were not found.");
        }
    });

    it("tests refreshChildNodesDirectory executed successfully with empty directory", async () => {
        jest.clearAllMocks();
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        await USSActions.refreshChildNodesDirectory(blockMocks.ussNodes[1]);
        expect(blockMocks.ussNodes[1].getChildren).toHaveBeenCalledTimes(1);
        expect(blockMocks.ussNodes[1].refreshUSS).toHaveBeenCalledTimes(0);
    });

    it("tests refreshChildNodesDirectory executed successfully with file", async () => {
        jest.clearAllMocks();
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        await USSActions.refreshChildNodesDirectory(blockMocks.ussNodes[0]);
        expect(blockMocks.ussNodes[0].refreshUSS).toHaveBeenCalledTimes(1);
    });
    it("tests refreshChildNodesDirectory executed successfully on a node with a child", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const node = new ZoweUSSNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentPath: "/",
            contextOverride: Constants.USS_DIR_CONTEXT,
        });
        node.getChildren = jest.fn().mockResolvedValueOnce([blockMocks.ussNodes[0]]);
        await USSActions.refreshChildNodesDirectory(node);

        expect(blockMocks.ussNodes[0].refreshUSS).toHaveBeenCalledTimes(1);
    });

    it("tests copyUssFiles executed successfully via context menu with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        await USSActions.copyUssFiles(blockMocks.ussNode, null, blockMocks.testUSSTree);
        expect(SharedUtils.getSelectedNodeList(blockMocks.ussNode, null)).toEqual([blockMocks.ussNode]);
    });
    it("tests copyUssFiles executed successfully via quick keys with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        await USSActions.copyUssFiles(null, null, blockMocks.testUSSTree);
        expect(SharedUtils.getSelectedNodeList(blockMocks.ussNode, null)).toEqual([blockMocks.ussNode]);
    });

    it("tests pasteUss executed successfully with selected nodes", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        await USSActions.pasteUss(blockMocks.testUSSTree, blockMocks.ussNodes[0]);
        expect(SharedUtils.getSelectedNodeList(blockMocks.ussNode, null)).toEqual([blockMocks.ussNode]);
    });
    it("tests pasteUss executed successfully with one node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const parent = blockMocks.testUSSTree.getTreeView();
        parent.selection = blockMocks.ussNodes[0];
        jest.spyOn(USSActions, "copyUssFilesToClipboard").mockResolvedValueOnce();
        await USSActions.pasteUss(blockMocks.testUSSTree, blockMocks.ussNodes[0]);
        expect(SharedUtils.getSelectedNodeList(blockMocks.ussNode, null)).toEqual([blockMocks.ussNode]);
    });
    it("tests pasteUss returns early if APIs are not supported", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testNode = blockMocks.ussNodes[0];
        testNode.copyUssFile = testNode.pasteUssTree = null;
        const infoMessageSpy = jest.spyOn(Gui, "infoMessage");
        await USSActions.pasteUss(blockMocks.testUSSTree, testNode);
        expect(infoMessageSpy).toHaveBeenCalledWith("The paste operation is not supported for this node.");
        infoMessageSpy.mockRestore();
    });
});

describe("USS Action Unit Tests - function deleteUSSFilesPrompt", () => {
    it("should return true", async () => {
        const nodes = [createUSSNode(createISession(), createIProfile())];
        jest.spyOn(Gui, "warningMessage").mockReturnValue(Promise.resolve("Cancel"));
        await expect(USSActions.deleteUSSFilesPrompt(nodes)).resolves.toEqual(true);
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
        await expect(USSActions.refreshDirectory(testNode, testUSSTree)).resolves.not.toThrow();
        expect(refreshElementSpy).toHaveBeenCalledTimes(1);
        expect(refreshElementSpy).toHaveBeenCalledWith(testNode);
    });

    it("should call errorHandling when error is thrown", async () => {
        jest.spyOn(testNode, "getChildren").mockImplementation(() => {
            throw new Error();
        });
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        await expect(USSActions.refreshDirectory(testNode, testUSSTree)).resolves.not.toThrow();
        expect(errorHandlingSpy).toHaveBeenCalledTimes(1);
    });
});

describe("USS Action Unit Tests - function editAttributes", () => {
    it("makes an instance of AttributeView", () => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            updateAttributes: jest.fn(),
        } as any);
        const view = USSActions.editAttributes(
            {
                extensionPath: "/a/b/c",
            } as any,
            {} as IZoweTree<IZoweUSSTreeNode>,
            { label: "some/node", getProfile: jest.fn() } as unknown as IZoweUSSTreeNode
        );
        expect(view).toBeInstanceOf(USSAttributeView);
    });
});

describe("USS Action Unit Tests - function copyRelativePath", () => {
    it("copies the correct path for a USS file", async () => {
        const dir = createUSSNode(createISession(), createIProfile());
        const textFile = new ZoweUSSNode({
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            label: "file.txt",
            parentNode: dir,
            parentPath: dir.fullPath,
        });
        textFile.fullPath = path.posix.join(dir.fullPath, "file.txt");
        await USSActions.copyRelativePath(textFile);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("usstest/file.txt");
    });

    it("copies the correct path for a USS directory", async () => {
        const testNode = createUSSNode(createISession(), createIProfile());
        await USSActions.copyRelativePath(testNode);
        expect(mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith("usstest");
    });
});
