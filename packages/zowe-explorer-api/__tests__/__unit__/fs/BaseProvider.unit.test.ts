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
import { BaseProvider, DirEntry, FileEntry } from "../../../src/fs";
import { Gui } from "../../../src/globals";
import isEqual from "lodash.isequal";
import { mocked } from "../../../__mocks__/mockUtils";

jest.mock("lodash.isequal", () => ({
    default: jest.fn().mockReturnValue(false),
}));

function getGlobalMocks() {
    return {
        testFileUri: vscode.Uri.from({ scheme: "zowe-uss", path: "/file.txt" }),
        testFolderUri: vscode.Uri.from({ scheme: "zowe-uss", path: "/folder" }),
        fileFsEntry: {
            name: "file.txt",
            data: new Uint8Array([1, 2, 3]),
            wasAccessed: true,
            type: vscode.FileType.File,
        },
        folderFsEntry: {
            name: "folder",
            entries: new Map(),
            wasAccessed: true,
            type: vscode.FileType.Directory,
        },
    };
}
const globalMocks = getGlobalMocks();

describe("diffOverwrite", () => {
    function getBlockMocks() {
        return {
            lookupAsFileMock: jest.spyOn((BaseProvider as any).prototype, "_lookupAsFile"),
            writeFileMock: jest.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(),
        };
    }

    it("calls writeFile if URI exists in the file system", async () => {
        const blockMocks = getBlockMocks();
        const fsEntry = {
            name: "test.txt",
            data: new Uint8Array([1, 2, 3]),
            conflictData: {
                contents: new Uint8Array([4, 5, 6]),
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        blockMocks.lookupAsFileMock.mockResolvedValueOnce(fsEntry);

        const prov = new (BaseProvider as any)();
        await prov.diffOverwrite(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).toHaveBeenCalledWith(
            globalMocks.testFileUri.with({
                query: "forceUpload=true",
            }),
            fsEntry.data
        );
        blockMocks.writeFileMock.mockClear();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for test.txt");
        expect(fsEntry.conflictData).toBeNull();
    });

    it("returns early if the URI is not present in the file system", async () => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupAsFileMock.mockResolvedValueOnce(undefined);
        const prov = new (BaseProvider as any)();
        await prov.diffOverwrite(globalMocks.testFileUri);
        expect(blockMocks.lookupAsFileMock).toHaveBeenCalledWith(globalMocks.testFileUri);
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
    });
});

describe("diffUseRemote", () => {
    function getBlockMocks() {
        return {
            lookupAsFileMock: jest.spyOn((BaseProvider as any).prototype, "_lookupAsFile"),
            writeFileMock: jest.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(),
        };
    }

    it("calls writeFile if the final data is different from the conflict data", async () => {
        const blockMocks = getBlockMocks();
        const conflictArr = new Uint8Array([4, 5, 6]);
        const fsEntry = {
            name: "test.txt",
            data: new Uint8Array([1, 2, 3]),
            conflictData: {
                contents: conflictArr,
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        blockMocks.lookupAsFileMock.mockResolvedValue(fsEntry);

        const prov = new (BaseProvider as any)();
        await prov.diffUseRemote(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).toHaveBeenCalledWith(
            globalMocks.testFileUri.with({
                query: "forceUpload=true",
            }),
            conflictArr
        );
        blockMocks.writeFileMock.mockClear();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for test.txt");
        expect(fsEntry.conflictData).toBeNull();
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.closeActiveEditor");
    });

    it("does not call writeFile if the final data is the same as the conflict data", async () => {
        const blockMocks = getBlockMocks();
        const fsEntry = {
            name: "test.txt",
            data: new Uint8Array([1, 2, 3]),
            conflictData: {
                contents: new Uint8Array([1, 2, 3]),
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        blockMocks.lookupAsFileMock.mockResolvedValue(fsEntry);
        mocked(isEqual).mockReturnValueOnce(true);

        const prov = new (BaseProvider as any)();
        await prov.diffUseRemote(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for test.txt");
        expect(fsEntry.conflictData).toBeNull();
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.closeActiveEditor");
    });

    it("returns early if the URI is not present in the file system", async () => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupAsFileMock.mockResolvedValueOnce(undefined);
        const prov = new (BaseProvider as any)();
        await prov.diffUseRemote(globalMocks.testFileUri);
        expect(blockMocks.lookupAsFileMock).toHaveBeenCalledWith(globalMocks.testFileUri);
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
    });
});

describe("exists", () => {
    function getBlockMocks() {
        return {
            lookupMock: jest.spyOn((BaseProvider as any).prototype, "_lookup").mockImplementation(),
        };
    }

    afterAll(() => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupMock.mockRestore();
    });

    it("returns false when a URI does not exist in the provider", () => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupMock.mockReturnValueOnce({
            name: "file.txt",
            metadata: {
                profile: { name: "aProfile" } as any,
                path: "/some/path",
            },
            type: vscode.FileType.File,
            wasAccessed: true,
        });
        const prov: BaseProvider = new (BaseProvider as any)();
        expect(prov.exists(globalMocks.testFileUri)).toBe(true);
        expect(blockMocks.lookupMock).toHaveBeenCalledWith(globalMocks.testFileUri, true);
    });

    it("returns true when a URI exists in the provider", () => {
        const blockMocks = getBlockMocks();
        const prov: BaseProvider = new (BaseProvider as any)();
        expect(prov.exists(globalMocks.testFileUri)).toBe(false);
        expect(blockMocks.lookupMock).toHaveBeenCalledWith(globalMocks.testFileUri, true);
    });
});

describe("removeEntry", () => {
    it("returns true if it successfully removed an entry", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", { ...globalMocks.fileFsEntry });

        expect(prov.removeEntry(globalMocks.testFileUri)).toBe(true);
    });

    it("returns false if it couldn't find the entry", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");

        expect(prov.removeEntry(globalMocks.testFileUri)).toBe(false);
    });
});

describe("cacheOpenedUri", () => {
    it("caches the URI for later use", () => {
        const prov = new (BaseProvider as any)();
        prov.cacheOpenedUri(globalMocks.testFileUri);
        expect(prov.openedUris).toContain(globalMocks.testFileUri);
    });
});

describe("invalidateFileAtUri", () => {
    it("returns true if it was able to invalidate the URI", () => {
        const fileEntry = { ...globalMocks.fileFsEntry };
        jest.spyOn((BaseProvider as any).prototype, "_lookup").mockReturnValueOnce(fileEntry);
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", fileEntry);
        expect(prov.invalidateFileAtUri(globalMocks.testFileUri)).toBe(true);
    });

    it("returns false if the entry is not a file or undefined", () => {
        // case 1: folder
        const folderEntry = { ...globalMocks.folderFsEntry };
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", folderEntry);
        expect(prov.invalidateFileAtUri(globalMocks.testFolderUri)).toBe(false);

        // case 2: undefined
        expect(prov.invalidateFileAtUri(globalMocks.testFileUri)).toBe(false);
    });
});

describe("invalidateDirAtUri", () => {
    it("returns true if it was able to invalidate the URI", () => {
        const folderEntry = { ...globalMocks.folderFsEntry };
        jest.spyOn((BaseProvider as any).prototype, "_lookup").mockReturnValueOnce(folderEntry);
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", folderEntry);
        expect(prov.invalidateDirAtUri(globalMocks.testFolderUri)).toBe(true);
        expect(folderEntry.entries.size).toBe(0);
    });

    it("returns false if the entry is not a folder or undefined", () => {
        // case 1: file
        const fileEntry = { ...globalMocks.fileFsEntry };
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", fileEntry);
        expect(prov.invalidateDirAtUri(globalMocks.testFileUri)).toBe(false);

        // case 2: undefined
        expect(prov.invalidateDirAtUri(globalMocks.testFolderUri)).toBe(false);
    });
});

describe("_updateResourceInEditor", () => {
    it("executes vscode.open and workbench.action.files.revert commands", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", {
            name: "file.txt",
            data: new Uint8Array([1, 2, 3]),
            wasAccessed: true,
            type: vscode.FileType.File,
        });
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        await prov._updateResourceInEditor(globalMocks.testFileUri);
        expect(executeCommandMock).toHaveBeenCalledWith("vscode.open", globalMocks.testFileUri);
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.files.revert");
    });

    it("returns early if the provided URI is not a file entry", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");

        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        executeCommandMock.mockClear();
        await prov._updateResourceInEditor(globalMocks.testFolderUri);
        expect(executeCommandMock).not.toHaveBeenCalled();
    });
});

describe("_lookupAsDirectory", () => {
    it("returns a directory entry", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", { ...globalMocks.folderFsEntry });
        const entry = prov._lookupAsDirectory(globalMocks.testFolderUri);
        expect(entry).toStrictEqual(globalMocks.folderFsEntry);
    });
});

xdescribe("_lookupParentDirectory", () => {});
