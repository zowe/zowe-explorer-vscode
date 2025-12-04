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
import { Gui, Validation, imperative, ZoweExplorerApiType, MessageSeverity } from "@zowe/zowe-explorer-api";
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
import { USSUtils } from "../../../../src/trees/uss/USSUtils";
import { mocked } from "../../../__mocks__/mockUtils";
import { USSTree } from "../../../../src/trees/uss/USSTree";
import { LocalFileManagement } from "../../../../src/management/LocalFileManagement";

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
        showMessage: jest.fn(),
        infoMessage: jest.fn(),
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
    Object.defineProperty(Gui, "showMessage", { value: globalMocks.showMessage, configurable: true });
    Object.defineProperty(Gui, "infoMessage", { value: globalMocks.infoMessage, configurable: true });
    Object.defineProperty(globalMocks.Download, "ussDir", { value: jest.fn(), configurable: true });
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
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

    return globalMocks;
}

describe("USS Action Unit Tests - Function createUSSNode", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: undefined as unknown as USSTree,
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

    it("should prompt the user for a location if one is not set on the node", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockResolvedValueOnce("/u/myuser/");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("folderName");
        const refreshProviderMock = jest.spyOn(SharedActions, "refreshProvider").mockImplementation();
        const createApiMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementation();
        blockMocks.ussNode.getParent().fullPath = "";

        await USSActions.createUSSNode(blockMocks.ussNode.getParent(), blockMocks.testUSSTree, "directory");
        expect(createApiMock).toHaveBeenCalledWith("/u/myuser/folderName", "directory");
        expect(refreshProviderMock).toHaveBeenCalled();
        createApiMock.mockRestore();
    });

    it("returns early if a location was never provided", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);
        const createApiMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementation();
        blockMocks.ussNode.getParent().fullPath = "";

        await USSActions.createUSSNode(blockMocks.ussNode.getParent(), blockMocks.testUSSTree, "directory");
        expect(createApiMock).not.toHaveBeenCalled();
        createApiMock.mockRestore();
    });

    it("handles trailing slashes in the location", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockResolvedValueOnce("/u/myuser/aDir/");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("testFile.txt");
        const createApiMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementation();
        const refreshProviderMock = jest.spyOn(SharedActions, "refreshProvider").mockImplementation();
        blockMocks.ussNode.getParent().fullPath = "";

        await USSActions.createUSSNode(blockMocks.ussNode.getParent(), blockMocks.testUSSTree, "file");
        expect(createApiMock).toHaveBeenCalledWith("/u/myuser/aDir/testFile.txt", "file");
        expect(refreshProviderMock).toHaveBeenCalled();
        createApiMock.mockRestore();
        refreshProviderMock.mockRestore();
    });

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
                    loadNamedProfile: globalMocks.mockLoadNamedProfile,
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        globalMocks.mockShowInputBox.mockReturnValueOnce("USSFolder");
        const refreshProviderMock = jest.spyOn(SharedActions, "refreshProvider").mockImplementation();
        const createApiMock = jest.spyOn(blockMocks.ussApi, "create").mockImplementation();

        await USSActions.createUSSNode(blockMocks.ussNode.getParent(), blockMocks.testUSSTree, "directory");
        expect(refreshProviderMock).toHaveBeenCalled();
        expect(createApiMock).toHaveBeenCalled();
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalled();
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
        expect(globalMocks.showMessage.mock.calls.map((call) => call[0])).toEqual(["Operation cancelled"]);
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

describe("USS Action Unit Tests - upload with encoding", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            withProgress: jest.spyOn(vscode.window, "withProgress").mockImplementation((progLocation, callback) => {
                const progress = { report: jest.fn() };
                const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
                return callback(progress, token);
            }),
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            testUSSTree: null as unknown as USSTree,
        };
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
        return newMocks;
    }

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("uploadDialogWithEncoding returns early if node is not a directory", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const infoMessageSpy = jest.spyOn(Gui, "infoMessage");
        const fileNode = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
            parentNode: blockMocks.ussNode,
            parentPath: blockMocks.ussNode.fullPath,
        });
        await USSActions.uploadDialogWithEncoding(fileNode, blockMocks.testUSSTree);
        expect(infoMessageSpy).toHaveBeenCalledWith("This action is only supported for USS directories.");
    });

    it("uploadDialogWithEncoding returns early if promptForUploadEncoding returns falsy value", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        jest.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValueOnce(undefined);
        const showOpenDialogSpy = jest.spyOn(Gui, "showOpenDialog");
        await USSActions.uploadDialogWithEncoding(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(showOpenDialogSpy).not.toHaveBeenCalled();
    });

    it("uploadDialogWithEncoding returns early if showOpenDialog returns falsy value", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const showProgressSpy = jest.spyOn(Gui, "withProgress");
        const showOpenDialogSpy = jest.spyOn(Gui, "showOpenDialog");
        const promptForUploadEncodingMock = jest.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValueOnce({ kind: "binary" });
        await USSActions.uploadDialogWithEncoding(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(showOpenDialogSpy).toHaveBeenCalled();
        expect(showProgressSpy).not.toHaveBeenCalled();
        expect(promptForUploadEncodingMock).toHaveBeenCalled();
        expect(promptForUploadEncodingMock).toHaveBeenCalledWith(blockMocks.ussNode.getProfile(), blockMocks.ussNode.fullPath);
    });

    it("uploadDialogWithEncoding uploads as binary when binary is selected", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        jest.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValue({ kind: "binary" } as any);
        const fileUri = { fsPath: "/tmp/foo.zip" } as any;
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        const uploadBinarySpy = jest.spyOn(USSActions, "uploadBinaryFile").mockResolvedValue();

        await USSActions.uploadDialogWithEncoding(blockMocks.ussNode, blockMocks.testUSSTree);

        expect(SharedUtils.promptForUploadEncoding).toHaveBeenCalled();
        expect(globalMocks.showOpenDialog).toHaveBeenCalled();
        expect(uploadBinarySpy).toHaveBeenCalledWith(blockMocks.ussNode, fileUri.fsPath);
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });

    it("uploadDialogWithEncoding uploads as text/other when a codepage is selected", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        jest.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValue({ kind: "other", codepage: "IBM-1047" } as any);
        const fileUri = { fsPath: "/tmp/foo.txt" } as any;
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        const openDoc = createTextDocument(path.normalize("/tmp/foo.txt"));
        globalMocks.openTextDocument.mockResolvedValue(openDoc);
        const uploadWithEncSpy = jest.spyOn(USSActions, "uploadFileWithEncoding").mockResolvedValue();

        await USSActions.uploadDialogWithEncoding(blockMocks.ussNode, blockMocks.testUSSTree);

        expect(SharedUtils.promptForUploadEncoding).toHaveBeenCalled();
        expect(globalMocks.openTextDocument).toHaveBeenCalled();
        expect(uploadWithEncSpy).toHaveBeenCalledWith(blockMocks.ussNode, openDoc, { kind: "other", codepage: "IBM-1047" });
        expect(blockMocks.testUSSTree.refreshElement).toHaveBeenCalledWith(blockMocks.ussNode);
    });

    it("uploadFileWithEncoding passes correct options to API for text", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(() => ({ putContent } as any));
        const doc = createTextDocument(path.normalize("/tmp/bar.txt"));

        await USSActions.uploadFileWithEncoding(blockMocks.ussNode, doc, { kind: "text" } as any);

        expect(putContent).toHaveBeenCalled();
        const options = putContent.mock.calls[0][2];
        expect(options.binary).toBe(false);
        // encoding should not be set for text
        expect(options.encoding).toBeUndefined();
    });

    it("uploadFileWithEncoding passes correct options to API for other/codepage", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(() => ({ putContent } as any));
        const doc = createTextDocument(path.normalize("/tmp/bar.txt"));

        await USSActions.uploadFileWithEncoding(blockMocks.ussNode, doc, { kind: "other", codepage: "ISO8859-1" } as any);

        const options = putContent.mock.calls[0][2];
        expect(options.binary).toBe(false);
        expect(options.encoding).toBe("ISO8859-1");
    });

    it("uploadDialogWithEncoding should handle cancellation", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        jest.spyOn(SharedUtils, "promptForUploadEncoding").mockResolvedValue({ kind: "binary" } as any);
        const fileUri = { fsPath: "/tmp/foo.zip" } as any;
        globalMocks.showOpenDialog.mockReturnValue([fileUri]);
        const uploadBinarySpy = jest.spyOn(USSActions, "uploadBinaryFile").mockResolvedValue();

        blockMocks.withProgress.mockImplementation((progLocation, callback) => {
            const progress = { report: jest.fn() };
            const token = {
                isCancellationRequested: true, // Simulate cancellation
                onCancellationRequested: jest.fn(),
            };
            return callback(progress, token);
        });

        await USSActions.uploadDialogWithEncoding(blockMocks.ussNode, blockMocks.testUSSTree);
        expect(uploadBinarySpy).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - copy file / directory", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null as unknown as USSTree,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            testTreeView: createTreeView(),
            mockCheckCurrentProfile: jest.fn(),
            ussApi:
                (createUssApi(globalMocks.testProfile) as any) ??
                ({
                    fileList: jest.fn(),
                    copy: jest.fn(),
                    uploadFromBuffer: jest.fn(),
                } as any),
            ussNodes: [] as IZoweUSSTreeNode[],
        };

        const parentNode = new ZoweUSSNode({
            label: "profile",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
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

        const apiMissingCopyMethods: any = { fileList: jest.fn() };
        try {
            await blockMocks.ussNodes[1].paste(blockMocks.ussNodes[1].resourceUri, { tree: rootTree, api: apiMissingCopyMethods });
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
            profile: globalMocks.testProfile,
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
    const globalMocks = createGlobalMocks();
    const testUSSTree = createUSSTree(
        [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
        [createUSSNode(globalMocks.testSession, createIProfile())],
        createTreeView()
    );
    it("should call deleteUSSNode with false if confirmed", async () => {
        const testNode = createUSSNode(createISession(), createIProfile());
        const nodes = [createUSSNode(createISession(), createIProfile())];
        const deleteUSSNodeSpy = jest.spyOn(ZoweUSSNode.prototype, "deleteUSSNode");
        jest.spyOn(Gui, "warningMessage").mockReturnValue(Promise.resolve("Delete"));
        testUSSTree.getTreeView = jest.fn().mockReturnValue({ selection: [] });
        await USSActions.deleteUSSFilesPrompt(testNode, nodes, testUSSTree);
        expect(deleteUSSNodeSpy).toHaveBeenCalledWith(testUSSTree, "", false);
    });
    it("should call deleteUSSNode with true if cancelled", async () => {
        const testNode = createUSSNode(createISession(), createIProfile());
        const nodes = [createUSSNode(createISession(), createIProfile())];
        const deleteUSSNodeSpy = jest.spyOn(ZoweUSSNode.prototype, "deleteUSSNode");
        jest.spyOn(Gui, "warningMessage").mockReturnValue(Promise.resolve("Cancel"));
        await USSActions.deleteUSSFilesPrompt(testNode, nodes, testUSSTree);
        expect(deleteUSSNodeSpy).toHaveBeenCalledWith(testUSSTree, "", true);
    });
    it("should call getTreeView if nodes are empty", async () => {
        const getTreeViewSpy = jest.spyOn(testUSSTree, "getTreeView");
        const deleteUSSNodeSpy = jest.spyOn(ZoweUSSNode.prototype, "deleteUSSNode");
        jest.spyOn(Gui, "warningMessage").mockReturnValue(Promise.resolve("Delete"));
        await USSActions.deleteUSSFilesPrompt(null, null, testUSSTree);
        expect(getTreeViewSpy).toHaveBeenCalled();
        expect(deleteUSSNodeSpy).toHaveBeenCalledWith(testUSSTree, "", false);
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

describe("USS Action Unit Tests - downloading functions", () => {
    let globalMocks: any;
    let mockQuickPick: any;
    let mockZoweLocalStorage: any;
    let mockShowOpenDialog: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();

        mockQuickPick = {
            title: "",
            placeholder: "",
            ignoreFocusOut: false,
            canSelectMany: false,
            items: [],
            selectedItems: [],
            onDidAccept: jest.fn(),
            onDidHide: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
        };

        jest.spyOn(Gui, "createQuickPick").mockReturnValue(mockQuickPick);
        mockShowOpenDialog = jest.spyOn(Gui, "showOpenDialog");
        mockZoweLocalStorage = jest.spyOn(ZoweLocalStorage, "getValue");
        jest.spyOn(ZoweLocalStorage, "setValue").mockResolvedValue();
        jest.spyOn(LocalFileManagement, "getDefaultUri").mockReturnValue(vscode.Uri.file("/default/path"));

        jest.spyOn(USSUtils, "zosEncodingToString").mockImplementation((encoding) => {
            if (!encoding) return "text";
            switch (encoding.kind) {
                case "binary":
                    return "binary";
                case "other":
                    return encoding.codepage;
                default:
                    return "text";
            }
        });

        jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(5);
        jest.spyOn(SharedUtils, "promptForEncoding").mockResolvedValue({ kind: "other", codepage: "IBM-1047" });
        jest.spyOn(SharedUtils, "handleDownloadResponse").mockResolvedValue();

        globalMocks.ussApi = {
            getTag: jest.fn().mockResolvedValue("untagged"),
            getContents: jest.fn().mockResolvedValue({ success: true, commandResponse: "", apiResponse: {} }),
            downloadDirectory: jest.fn().mockResolvedValue({ success: true, commandResponse: "", apiResponse: {} }),
        };
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(globalMocks.ussApi);

        jest.spyOn(AuthUtils, "errorHandling").mockImplementation();

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    const createMockNode = (): IZoweUSSTreeNode => {
        const mockNode = createUSSNode(createISession(), createIProfile()) as IZoweUSSTreeNode;
        mockNode.fullPath = "/u/test/file.txt";
        return mockNode;
    };
    describe("getUssDirFilterOptions", () => {
        let filterQuickPick: any;
        let filterShowInputBox: jest.SpyInstance;

        beforeEach(() => {
            filterQuickPick = {
                title: "",
                placeholder: "",
                ignoreFocusOut: false,
                canSelectMany: false,
                items: [],
                selectedItems: [],
                onDidAccept: jest.fn(),
                onDidHide: jest.fn(),
                show: jest.fn(),
                hide: jest.fn(),
                dispose: jest.fn(),
            };

            jest.spyOn(Gui, "createQuickPick").mockReturnValue(filterQuickPick);
            filterShowInputBox = jest.spyOn(Gui, "showInputBox");
            jest.clearAllMocks();
        });

        it("should return empty object when no filters are selected", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [];
                callback();
            });

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({});
            expect(filterQuickPick.show).toHaveBeenCalled();
            expect(filterQuickPick.dispose).toHaveBeenCalled();
        });

        it("should return null when user cancels selection", async () => {
            filterQuickPick.onDidHide.mockImplementation((callback: () => void) => {
                callback();
            });

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toBeNull();
            expect(filterQuickPick.dispose).toHaveBeenCalled();
        });

        it("should handle group filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "group", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("admin");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ group: "admin" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("group"),
                placeHolder: expect.stringContaining("admin"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle user filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "user", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("1001");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ user: "1001" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("user"),
                placeHolder: expect.stringContaining("IBMUSER"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle mtime filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "mtime", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("+7");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ mtime: "+7" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("modification time"),
                placeHolder: expect.stringContaining("+7"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle size filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "size", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("+1M");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ size: "+1M" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("size"),
                placeHolder: expect.stringContaining("+1M"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle permission filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "perm", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("755");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ perm: "755" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("permission"),
                placeHolder: expect.stringContaining("755"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle type filter input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "type", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("d");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ type: "d" });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("file type"),
                placeHolder: expect.stringContaining("c, d, f, l, p, or s"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle depth filter input as number", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "depth", inputType: "number" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("3");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ depth: 3 });
            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("depth"),
                placeHolder: expect.stringContaining("2 levels"),
                value: "",
                validateInput: expect.any(Function),
            });
        });

        it("should handle multiple filters", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [
                    { key: "user", inputType: "string" },
                    { key: "depth", inputType: "number" },
                    { key: "size", inputType: "string" },
                ];
                callback();
            });
            filterShowInputBox.mockResolvedValueOnce("IBMUSER").mockResolvedValueOnce("2").mockResolvedValueOnce("+100K");

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ user: "IBMUSER", depth: 2, size: "+100K" });
            expect(filterShowInputBox).toHaveBeenCalledTimes(3);
        });

        it("should use current filter values as initial values", async () => {
            const currentOptions = {
                group: "ibmgroup",
                mtime: "+30",
                depth: 1,
            };

            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "group", inputType: "string" }];
                callback();
            });
            filterShowInputBox.mockResolvedValue("admin");

            const result = await (USSActions as any).getUssDirFilterOptions(currentOptions);

            expect(filterShowInputBox).toHaveBeenCalledWith({
                prompt: expect.stringContaining("group"),
                placeHolder: expect.stringContaining("admin"),
                value: "ibmgroup",
                validateInput: expect.any(Function),
            });
            expect(result).toEqual({ group: "admin" });
        });

        it("should validate empty input", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "user", inputType: "string" }];
                callback();
            });

            filterShowInputBox.mockImplementation(({ validateInput: validator }: any) => {
                const result = validator("");
                return result === null ? Promise.resolve("test") : Promise.resolve(null);
            });

            await (USSActions as any).getUssDirFilterOptions();

            expect(filterShowInputBox).toHaveBeenCalled();
        });

        it("should validate numeric input for depth", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [{ key: "depth", inputType: "number" }];
                callback();
            });

            filterShowInputBox.mockImplementation(({ validateInput: validator }: any) => {
                const result = validator("abc");
                return result === null ? Promise.resolve("3") : Promise.resolve(null);
            });

            await (USSActions as any).getUssDirFilterOptions();

            expect(filterShowInputBox).toHaveBeenCalled();
        });

        it("should skip filter when input is cancelled", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [
                    { key: "user", inputType: "string" },
                    { key: "group", inputType: "string" },
                ];
                callback();
            });
            filterShowInputBox.mockResolvedValueOnce("IBMUSER").mockResolvedValueOnce(null); // cancelled

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ user: "IBMUSER" });
        });

        it("should skip filter when input is empty after trim", async () => {
            filterQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                filterQuickPick.selectedItems = [
                    { key: "user", inputType: "string" },
                    { key: "group", inputType: "string" },
                ];
                callback();
            });
            filterShowInputBox.mockResolvedValueOnce("IBMUSER").mockResolvedValueOnce("   "); // empty after trim

            const result = await (USSActions as any).getUssDirFilterOptions();

            expect(result).toEqual({ user: "IBMUSER" });
        });
    });

    it("should handle directory filter options for USS directories", async () => {
        const mockNode = createMockNode();
        const filterOptions = { user: "IBMUSER", depth: 2 };
        const getUssDirFilterOptionsSpy = jest.spyOn(USSActions as any, "getUssDirFilterOptions").mockResolvedValue(filterOptions);
        mockZoweLocalStorage.mockReturnValue({});

        const l10nSpy = jest.spyOn(vscode.l10n, "t").mockImplementation((options: any) => {
            if (typeof options === "string") return options;
            return options.message || options;
        });

        mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
            mockQuickPick.selectedItems = [{ label: "Set Filter Options" }];
            callback();
        });

        mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

        const result = await (USSActions as any).getUssDownloadOptions(mockNode, true);

        expect(getUssDirFilterOptionsSpy).toHaveBeenCalledWith({});
        expect(result.dirFilterOptions).toEqual(filterOptions);

        l10nSpy.mockRestore();
        getUssDirFilterOptionsSpy.mockRestore();
    });

    it("should handle directory encoding selection for USS directories", async () => {
        const mockNode = createMockNode();
        mockZoweLocalStorage.mockReturnValue({});

        const promptForDirectoryEncodingSpy = jest
            .spyOn(SharedUtils, "promptForDirectoryEncoding")
            .mockResolvedValue({ kind: "other", codepage: "UTF-8" });

        const l10nSpy = jest.spyOn(vscode.l10n, "t").mockImplementation((options: any) => {
            if (typeof options === "string") return options;
            return options.message || options;
        });

        mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
            mockQuickPick.selectedItems = [{ label: "Choose Encoding" }];
            callback();
        });

        mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

        const result = await (USSActions as any).getUssDownloadOptions(mockNode, true);

        expect(promptForDirectoryEncodingSpy).toHaveBeenCalledWith(mockNode.getProfile(), mockNode.fullPath, undefined);
        expect(result.dirOptions.directoryEncoding).toEqual({ kind: "other", codepage: "UTF-8" });

        l10nSpy.mockRestore();
        promptForDirectoryEncodingSpy.mockRestore();
    });

    it("should handle complex directory options combination for USS", async () => {
        const mockNode = createMockNode();
        const storedOptions = {
            dirFilterOptions: { user: "existing" },
        };
        mockZoweLocalStorage.mockReturnValue(storedOptions);
        const filterOptions = { user: "IBMUSER", group: "ibmgroup" };
        const getUssDirFilterOptionsSpy = jest.spyOn(USSActions as any, "getUssDirFilterOptions").mockResolvedValue(filterOptions);

        const l10nSpy = jest.spyOn(vscode.l10n, "t").mockImplementation((options: any) => {
            if (typeof options === "string") return options;
            return options.message || options;
        });

        mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
            mockQuickPick.selectedItems = [
                { label: "Include Hidden Files" },
                { label: "Search All Filesystems" },
                { label: "Return Symlinks" },
                { label: "Set Filter Options" },
            ];
            callback();
        });

        mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

        const result = await (USSActions as any).getUssDownloadOptions(mockNode, true);

        expect(result.dirOptions.includeHidden).toBe(true);
        expect(result.dirOptions.filesys).toBe(true);
        expect(result.dirOptions.symlinks).toBe(true);
        expect(result.dirFilterOptions).toEqual(filterOptions);

        l10nSpy.mockRestore();
        getUssDirFilterOptionsSpy.mockRestore();
    });

    describe("getUssDownloadOptions", () => {
        it("should return default options when no stored values exist for file download", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue(undefined);

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [{ label: "Generate Directory Structure", picked: true }];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/user/selected/path")]);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toEqual({
                overwrite: false,
                generateDirectory: true,
                chooseEncoding: false,
                selectedPath: vscode.Uri.file("/user/selected/path"),
                dirOptions: {
                    includeHidden: false,
                    filesys: false,
                    symlinks: false,
                    chooseFilterOptions: false,
                },
                dirFilterOptions: {},
            });
            expect(mockQuickPick.show).toHaveBeenCalled();
            expect(mockShowOpenDialog).toHaveBeenCalledWith({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: "Select Download Location",
                defaultUri: expect.any(Object),
            });
        });

        it("should return directory-specific options when downloading directories", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue(undefined);

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [
                    { label: "Overwrite", picked: true },
                    { label: "Include Hidden Files", picked: true },
                    { label: "Generate Directory Structure", picked: true },
                ];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/user/selected/path")]);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, true);

            expect(result.overwrite).toBe(true);
            expect(result.dirOptions.includeHidden).toBe(true);
            expect(result.generateDirectory).toBe(true);
        });

        it("should use stored values as initial selection", async () => {
            const mockNode = createMockNode();
            const storedOptions = {
                overwrite: true,
                generateDirectory: false,
                chooseEncoding: false,
                selectedPath: vscode.Uri.file("/stored/path"),
                dirOptions: { includeHidden: true },
            };
            mockZoweLocalStorage.mockReturnValue(storedOptions);

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [{ label: "Choose Encoding", picked: true }];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/new/path")]);
            jest.spyOn(SharedUtils, "promptForDirectoryEncoding").mockResolvedValue({ kind: "other", codepage: "IBM-1047" });

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, true);

            expect(result.chooseEncoding).toBe(true);
            expect(result.selectedPath.fsPath).toBe("/new/path");
        });

        it("should return undefined when user cancels quick pick selection", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});

            mockQuickPick.onDidHide.mockImplementation((callback: () => void) => {
                callback();
            });

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toBeUndefined();
        });

        it("should return undefined when user cancels folder selection", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue(undefined);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toBeUndefined();
        });

        it("should return undefined when user cancels encoding selection", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [{ label: "Choose Encoding", picked: true }];
                callback();
            });

            jest.spyOn(SharedUtils, "promptForEncoding").mockResolvedValue(undefined);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toBeUndefined();
        });

        it("should handle empty folder selection", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([]);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toBeUndefined();
        });

        it("should allow selecting no options (all unchecked)", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

            const result = await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(result).toEqual({
                overwrite: false,
                generateDirectory: false,
                chooseEncoding: false,
                selectedPath: vscode.Uri.file("/test/path"),
                dirOptions: {
                    includeHidden: false,
                    filesys: false,
                    symlinks: false,
                    chooseFilterOptions: false,
                },
                dirFilterOptions: {},
            });
        });

        it("should get tagged encoding for files when choosing encoding", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});
            const mockUssApi = { getTag: jest.fn().mockResolvedValue("utf-8") } as any;
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(mockUssApi);

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [{ label: "Choose Encoding", picked: true }];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

            await (USSActions as any).getUssDownloadOptions(mockNode, false);

            expect(mockUssApi.getTag).toHaveBeenCalledWith("/u/test/file.txt");
            expect(SharedUtils.promptForEncoding).toHaveBeenCalledWith(mockNode, "utf-8");
        });

        it("should not get tagged encoding for directories when choosing encoding", async () => {
            const mockNode = createMockNode();
            mockZoweLocalStorage.mockReturnValue({});
            const mockUssApi = { getTag: jest.fn().mockResolvedValue("utf-8") } as any;
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(mockUssApi);
            jest.spyOn(SharedUtils, "promptForDirectoryEncoding").mockResolvedValue(undefined);

            mockQuickPick.onDidAccept.mockImplementation((callback: () => void) => {
                mockQuickPick.selectedItems = [{ label: "Choose Encoding", picked: true }];
                callback();
            });

            mockShowOpenDialog.mockResolvedValue([vscode.Uri.file("/test/path")]);

            await (USSActions as any).getUssDownloadOptions(mockNode, true);

            expect(mockUssApi.getTag).not.toHaveBeenCalled();
            expect(SharedUtils.promptForDirectoryEncoding).toHaveBeenCalledWith(mockNode.getProfile(), mockNode.fullPath, undefined);
        });
    });

    describe("downloadUssFile", () => {
        it("should download a USS file successfully with default encoding", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback();
            });

            await USSActions.downloadUssFile(mockNode);

            expect(ZoweLogger.trace).toHaveBeenCalledWith("uss.actions.downloadUssFile called.");
            expect(globalMocks.ussApi.getContents).toHaveBeenCalledWith(
                "/u/test/file.txt",
                expect.objectContaining({
                    file: expect.stringContaining("file.txt"),
                    binary: false,
                    encoding: undefined,
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS file",
                expect.stringContaining("file.txt")
            );
        });

        it("should download a USS file with binary encoding", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                encoding: { kind: "binary" },
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback();
            });

            await USSActions.downloadUssFile(mockNode);

            expect(globalMocks.ussApi.getContents).toHaveBeenCalledWith(
                "/u/test/file.txt",
                expect.objectContaining({
                    binary: true,
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS file",
                expect.stringContaining("file.txt")
            );
        });

        it("should download a USS file with custom codepage encoding", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                encoding: { kind: "other", codepage: "IBM-1047" },
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback();
            });

            await USSActions.downloadUssFile(mockNode);

            expect(globalMocks.ussApi.getContents).toHaveBeenCalledWith(
                "/u/test/file.txt",
                expect.objectContaining({
                    binary: false,
                    encoding: "IBM-1047",
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS file",
                expect.stringContaining("file.txt")
            );
        });

        it("should download a USS file with directory structure generation", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: true,
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback();
            });

            await USSActions.downloadUssFile(mockNode);

            expect(globalMocks.ussApi.getContents).toHaveBeenCalledWith(
                "/u/test/file.txt",
                expect.objectContaining({
                    file: expect.stringMatching(/u.test.file\.txt$/),
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS file",
                expect.stringMatching(/u.test.file\.txt$/)
            );
        });

        it("should show cancellation message when download options are cancelled", async () => {
            const mockNode = createMockNode();
            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(undefined);

            await USSActions.downloadUssFile(mockNode);

            expect(globalMocks.showMessage).toHaveBeenCalledWith("Operation cancelled");
            expect(globalMocks.ussApi.getContents).not.toHaveBeenCalled();
        });

        it("should handle download errors properly", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);

            const error = new Error("Download failed");
            globalMocks.ussApi.getContents.mockRejectedValue(error);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback();
            });

            await USSActions.downloadUssFile(mockNode);

            expect(AuthUtils.errorHandling).toHaveBeenCalledWith(error, {
                apiType: ZoweExplorerApiType.Uss,
                profile: mockNode.getProfile(),
            });
        });
    });

    describe("downloadUssDirectory", () => {
        it("should download a USS directory successfully", async () => {
            const mockNode = createMockNode();
            mockNode.fullPath = "/u/test/directory";
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: true,
                dirOptions: {
                    includeHidden: false,
                    directoryEncoding: { kind: "other", codepage: "IBM-1047" },
                },
                encoding: { kind: "other", codepage: "IBM-1047" },
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(5);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: false });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(ZoweLogger.trace).toHaveBeenCalledWith("uss.actions.downloadUssDirectory called.");
            expect(USSUtils.countAllFilesRecursively).toHaveBeenCalledWith(mockNode, undefined);
            expect(ZoweExplorerApiRegister.getUssApi).toHaveBeenCalledWith(mockNode.getProfile());
            expect(globalMocks.ussApi.downloadDirectory).toHaveBeenCalledWith(
                "/u/test/directory",
                expect.objectContaining({
                    directory: "/test/download/path",
                    overwrite: true,
                    binary: false,
                    encoding: "IBM-1047",
                    includeHidden: false,
                    maxConcurrentRequests: 1,
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS directory",
                "/test/download/path"
            );
        });

        it("should download a USS directory with directory structure generation", async () => {
            const mockNode = createMockNode();
            mockNode.fullPath = "/u/test/directory";
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: true,
                overwrite: false,
                dirOptions: { includeHidden: true },
                encoding: { kind: "binary" },
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(3);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: false });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.ussApi.downloadDirectory).toHaveBeenCalledWith(
                "/u/test/directory",
                expect.objectContaining({
                    directory: expect.stringMatching(/u.test.directory$/),
                    overwrite: false,
                    includeHidden: true,
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS directory",
                expect.stringMatching(/u.test.directory$/)
            );
        });

        it("should show info message when directory contains no files", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                includeHidden: false,
                encoding: { kind: "binary" },
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(0);

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.infoMessage).toHaveBeenCalledWith("The selected directory contains no files to download.");
            expect(globalMocks.ussApi.downloadDirectory).not.toHaveBeenCalled();
        });

        it("should show warning and prompt for large directory downloads", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                dirOptions: { includeHidden: false },
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(1000);

            globalMocks.showMessage.mockResolvedValue("Yes");

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: false });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.showMessage).toHaveBeenCalledWith(
                "This directory has {0} members. Downloading a large number of files may take a long time. Do you want to continue?",
                expect.objectContaining({
                    severity: MessageSeverity.WARN,
                    items: ["Yes", "No"],
                    vsCodeOpts: { modal: true },
                })
            );
            expect(globalMocks.ussApi.downloadDirectory).toHaveBeenCalled();
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS directory",
                "/test/download/path"
            );
        });

        it("should cancel download when user chooses No for large directory", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                dirOptions: { includeHidden: false },
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(1000);

            globalMocks.showMessage.mockResolvedValue("No");

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.ussApi.downloadDirectory).not.toHaveBeenCalled();
        });

        it("should handle cancellation during download", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                dirOptions: { includeHidden: false },
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(5);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: true });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.showMessage).toHaveBeenCalledWith("Download cancelled");
            expect(globalMocks.ussApi.downloadDirectory).not.toHaveBeenCalled();
        });

        it("should show cancellation message when download options are cancelled", async () => {
            const mockNode = createMockNode();
            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(undefined);

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.showMessage).toHaveBeenCalledWith("Operation cancelled");
            expect(globalMocks.ussApi.downloadDirectory).not.toHaveBeenCalled();
        });

        it("should handle download errors properly", async () => {
            const mockNode = createMockNode();
            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                dirOptions: { includeHidden: false },
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(5);

            const error = new Error("Download failed");
            globalMocks.ussApi.downloadDirectory.mockRejectedValue(error);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: false });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(AuthUtils.errorHandling).toHaveBeenCalledWith(error, {
                apiType: ZoweExplorerApiType.Uss,
                profile: mockNode.getProfile(),
            });
        });

        it("should use profile settings for maxConcurrentRequests and responseTimeout", async () => {
            const mockNode = createMockNode();
            mockNode.getProfile = jest.fn().mockReturnValue({
                profile: {
                    encoding: "utf-8",
                    maxConcurrentRequests: 5,
                    responseTimeout: 30000,
                },
            });

            const mockDownloadOptions = {
                selectedPath: vscode.Uri.file("/test/download/path"),
                generateDirectory: false,
                overwrite: false,
                dirOptions: { includeHidden: false },
                encoding: undefined,
            };

            jest.spyOn(USSActions as any, "getUssDownloadOptions").mockResolvedValue(mockDownloadOptions);
            jest.spyOn(USSUtils, "countAllFilesRecursively").mockResolvedValue(5);

            globalMocks.withProgress.mockImplementation(async (options: any, callback: any) => {
                return await callback({ report: jest.fn() }, { isCancellationRequested: false });
            });

            await USSActions.downloadUssDirectory(mockNode);

            expect(globalMocks.ussApi.downloadDirectory).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    maxConcurrentRequests: 5,
                    responseTimeout: 30000,
                })
            );
            expect(SharedUtils.handleDownloadResponse).toHaveBeenCalledWith(
                { success: true, commandResponse: "", apiResponse: {} },
                "USS directory",
                "/test/download/path"
            );
        });
    });
});
