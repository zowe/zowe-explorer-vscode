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
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";
import { LocalStorageKey, ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { IZoweTreeOpts } from "../../../src/shared/IZoweTreeOpts";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";

describe("LocalFileManagement Unit Tests", () => {
    function createBlockMocks() {
        const newMocks = {
            diagnosticsSet: jest.fn(),
            diagnosticsDelete: jest.fn(),
            storageGet: jest.fn(),
            storageUpdate: jest.fn(),
        };

        Object.defineProperty(LocalFileManagement, "recoveryDiagnostics", {
            value: {
                has: jest.fn().mockReturnValue(true),
                set: newMocks.diagnosticsSet,
                delete: newMocks.diagnosticsDelete,
            },
            configurable: true,
        });
        const mockGlobalState = { get: newMocks.storageGet, update: newMocks.storageUpdate, keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);

        return newMocks;
    }

    it("should add and remove diagnostic for recovered file", () => {
        const blockMocks = createBlockMocks();
        const fakeDocument: vscode.TextDocument = {
            lineAt: jest.fn().mockReturnValue({ range: { start: 0, end: 100 } }),
            uri: vscode.Uri.parse("file:///abc.txt"),
        } as any;
        const treeOpts: IZoweTreeOpts = {
            label: fakeDocument.uri.fsPath,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: { name: "lpar1_zosmf" } as any,
        };
        LocalFileManagement.addRecoveredFile(fakeDocument, treeOpts);
        expect(blockMocks.diagnosticsSet).toHaveBeenCalledTimes(1);
        expect(LocalFileManagement.recoveredFileCount).toBe(1);
        LocalFileManagement.removeRecoveredFile(fakeDocument);
        expect(blockMocks.diagnosticsDelete).toHaveBeenCalledTimes(1);
        expect(LocalFileManagement.recoveredFileCount).toBe(0);
    });

    it("should load file info for dataset node", () => {
        const blockMocks = createBlockMocks();
        const dsNode = new ZoweDatasetNode({
            label: "member",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: { name: "lpar1_zosmf" } as any,
        });
        const openFiles: Record<string, IZoweTreeNode> = {};
        blockMocks.storageGet.mockReturnValueOnce({
            "file:///abc.txt": {
                binary: false,
                encoding: "IBM-1047",
                etag: "fakeEtag",
            },
        });
        jest.spyOn(TreeProviders, "ds", "get").mockReturnValue({ openFiles } as any);
        LocalFileManagement.loadFileInfo(dsNode, "file:///abc.txt");
        expect(dsNode.encoding).toBe("IBM-1047");
        expect(dsNode.getEtag()).toBe("fakeEtag");
        expect(openFiles["file:///abc.txt"]).toEqual(dsNode);
    });

    it("should load file info for USS node", () => {
        const blockMocks = createBlockMocks();
        const ussNode = new ZoweUSSNode({
            label: "abc.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: { name: "lpar1_zosmf" } as any,
        });
        const openFiles: Record<string, IZoweTreeNode> = {};
        blockMocks.storageGet.mockReturnValueOnce({
            "file:///abc.txt": {
                binary: true,
                encoding: undefined,
                etag: "fakeEtag",
            },
        });
        jest.spyOn(TreeProviders, "uss", "get").mockReturnValue({ openFiles } as any);
        LocalFileManagement.loadFileInfo(ussNode, "file:///abc.txt");
        expect(ussNode.binary).toBe(true);
        expect(ussNode.getEtag()).toBe("fakeEtag");
        expect(openFiles["file:///abc.txt"]).toEqual(ussNode);
    });

    it("should store file info for dataset node", () => {
        const blockMocks = createBlockMocks();
        const dsNode = new ZoweDatasetNode({
            label: "member",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: { name: "lpar1_zosmf" } as any,
        });
        dsNode.setEncoding({ kind: "text" });
        dsNode.setEtag("fakeEtag");
        jest.spyOn(dsNode, "getDsDocumentFilePath").mockReturnValue("file:///abc.txt");
        LocalFileManagement.storeFileInfo(dsNode);
        expect(blockMocks.storageUpdate).toHaveBeenLastCalledWith(LocalStorageKey.FILE_INFO_CACHE, {
            "file:///abc.txt": {
                binary: false,
                encoding: null,
                etag: "fakeEtag",
            },
        });
    });

    it("should store file info for USS node", () => {
        const blockMocks = createBlockMocks();
        const ussNode = new ZoweUSSNode({
            label: "abc.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: { name: "lpar1_zosmf" } as any,
        });
        ussNode.setEncoding({ kind: "binary" });
        ussNode.setEtag("fakeEtag");
        jest.spyOn(ussNode, "getUSSDocumentFilePath").mockReturnValue("file:///abc.txt");
        LocalFileManagement.storeFileInfo(ussNode);
        expect(blockMocks.storageUpdate).toHaveBeenLastCalledWith(LocalStorageKey.FILE_INFO_CACHE, {
            "file:///abc.txt": {
                binary: true,
                encoding: undefined,
                etag: "fakeEtag",
            },
        });
    });

    it("should delete file info associated with filename", () => {
        const blockMocks = createBlockMocks();
        blockMocks.storageGet.mockReturnValueOnce({
            "file:///abc.txt": {
                binary: false,
                encoding: "IBM-1047",
                etag: "fakeEtag",
            },
            "file:///def.txt": {
                binary: true,
                encoding: undefined,
                etag: "fakeEtag",
            },
        });
        LocalFileManagement.deleteFileInfo("file:///abc.txt");
        expect(blockMocks.storageUpdate).toHaveBeenCalledTimes(1);
        expect(Object.keys(blockMocks.storageUpdate.mock.calls[0][1])).toEqual(["file:///def.txt"]);
    });
});
