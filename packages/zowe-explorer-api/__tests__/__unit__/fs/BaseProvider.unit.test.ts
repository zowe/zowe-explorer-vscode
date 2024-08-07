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
import { BaseProvider, ConflictViewSelection, DirEntry, FileEntry, ZoweScheme } from "../../../src/fs";
import { Gui } from "../../../src/globals";
import { MockedProperty } from "../../../__mocks__/mockUtils";

function getGlobalMocks(): { [key: string]: any } {
    return {
        testFileUri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/file.txt" }),
        testFolderUri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/folder" }),
        fileFsEntry: {
            name: "file.txt",
            conflictData: null,
            data: new Uint8Array([1, 2, 3]),
            metadata: {
                path: "/file.txt",
            },
            wasAccessed: true,
            type: vscode.FileType.File,
        },
        folderFsEntry: {
            name: "folder",
            metadata: {
                path: "/folder",
            },
            entries: new Map(),
            wasAccessed: true,
            type: vscode.FileType.Directory,
        },
    };
}
const globalMocks = getGlobalMocks();

describe("diffOverwrite", () => {
    function getBlockMocks(): { [key: string]: jest.SpyInstance<any> } {
        return {
            lookupAsFileMock: jest.spyOn((BaseProvider as any).prototype, "_lookupAsFile"),
            writeFileMock: jest.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(),
        };
    }

    it("calls writeFile if URI exists in the file system", async () => {
        const blockMocks = getBlockMocks();
        const fsEntry = {
            ...globalMocks.fileFsEntry,
            conflictData: {
                contents: new Uint8Array([4, 5, 6]),
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        blockMocks.lookupAsFileMock.mockReturnValueOnce(fsEntry);

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
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
        expect(fsEntry.conflictData).toBeNull();
    });

    it("returns early if the URI is not present in the file system", async () => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupAsFileMock.mockReturnValueOnce(undefined);
        const prov = new (BaseProvider as any)();
        await prov.diffOverwrite(globalMocks.testFileUri);
        expect(blockMocks.lookupAsFileMock).toHaveBeenCalledWith(globalMocks.testFileUri);
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
    });
});

describe("diffUseRemote", () => {
    function getBlockMocks(prov): { [key: string]: jest.SpyInstance<any> } {
        return {
            lookupAsFileMock: jest.spyOn(prov, "_lookupAsFile"),
            writeFileMock: jest.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(),
        };
    }

    it("calls writeFile if the final data is different from the conflict data", async () => {
        const conflictArr = new Uint8Array([4, 5, 6]);
        const fsEntry = {
            ...globalMocks.fileFsEntry,
            conflictData: {
                contents: conflictArr,
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce(undefined);

        const prov = new (BaseProvider as any)();
        const blockMocks = getBlockMocks(prov);
        blockMocks.lookupAsFileMock.mockReturnValueOnce(fsEntry);
        await prov.diffUseRemote(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).toHaveBeenCalledWith(
            globalMocks.testFileUri.with({
                query: "forceUpload=true",
            }),
            conflictArr
        );
        blockMocks.writeFileMock.mockClear();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
        expect(fsEntry.conflictData).toBeNull();
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.closeActiveEditor");
    });

    it("does not call writeFile if the final data is the same as the conflict data", async () => {
        const fsEntry = {
            ...globalMocks.fileFsEntry,
            conflictData: {
                contents: new Uint8Array([1, 2, 3]),
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce(undefined);

        const prov = new (BaseProvider as any)();
        const blockMocks = getBlockMocks(prov);
        blockMocks.lookupAsFileMock.mockReturnValueOnce(fsEntry);
        await prov.diffUseRemote(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
        expect(fsEntry.conflictData).toBeNull();
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.closeActiveEditor");
    });

    it("returns early if the URI is not present in the file system", async () => {
        const prov = new (BaseProvider as any)();
        const blockMocks = getBlockMocks(prov);
        blockMocks.lookupAsFileMock.mockReturnValueOnce(undefined);
        await prov.diffUseRemote(globalMocks.testFileUri);
        expect(blockMocks.lookupAsFileMock).toHaveBeenCalledWith(globalMocks.testFileUri);
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
    });
});

describe("exists", () => {
    function getBlockMocks(): { [key: string]: jest.SpyInstance<any> } {
        return {
            lookupMock: jest.spyOn((BaseProvider as any).prototype, "lookup"),
        };
    }

    afterAll(() => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupMock.mockRestore();
    });

    it("returns false when a URI does not exist in the provider", () => {
        const blockMocks = getBlockMocks();
        blockMocks.lookupMock.mockReturnValueOnce({ ...globalMocks.fileFsEntry });
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

describe("getEncodingForFile", () => {
    it("gets the encoding for a file entry", () => {
        const prov = new (BaseProvider as any)();
        const fileEntry = { ...globalMocks.fileFsEntry, encoding: { kind: "text" } };
        const _lookupAsFileMock = jest.spyOn(prov, "lookup").mockReturnValueOnce(fileEntry);
        expect(prov.getEncodingForFile(globalMocks.testFileUri)).toStrictEqual({ kind: "text" });
        _lookupAsFileMock.mockRestore();
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

    it("returns early if it could not find the parent directory of the item to remove", () => {
        const parentDirMock = jest.spyOn(BaseProvider.prototype as any, "_lookupParentDirectory").mockReturnValue(undefined);
        const prov = new (BaseProvider as any)();
        expect(prov.removeEntry(globalMocks.testFileUri)).toBe(false);
        parentDirMock.mockRestore();
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
        jest.spyOn((BaseProvider as any).prototype, "lookup").mockReturnValueOnce(fileEntry);
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
        jest.spyOn((BaseProvider as any).prototype, "lookup").mockReturnValueOnce(folderEntry);
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

describe("setEncodingForFile", () => {
    it("sets the encoding for a file entry", () => {
        const prov = new (BaseProvider as any)();
        const fileEntry = { ...globalMocks.fileFsEntry, encoding: undefined };
        const _lookupAsFileMock = jest.spyOn(prov, "lookup").mockReturnValueOnce(fileEntry);
        prov.setEncodingForFile(globalMocks.testFileUri, { kind: "text" });
        expect(fileEntry.encoding).toStrictEqual({ kind: "text" });
        _lookupAsFileMock.mockRestore();
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
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
        await prov._updateResourceInEditor(globalMocks.testFileUri);
        expect(executeCommandMock).toHaveBeenCalledWith("vscode.open", globalMocks.testFileUri);
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.files.revert");
    });

    it("returns early if the provided URI is not a file entry", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");

        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand").mockClear();
        await prov._updateResourceInEditor(globalMocks.testFolderUri);
        expect(executeCommandSpy).not.toHaveBeenCalled();
    });
});

describe("lookup", () => {
    it("returns a valid file entry if it exists in the file system", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", { ...globalMocks.fileFsEntry });
        const entry = prov.lookup(globalMocks.testFileUri);
        expect(entry).toStrictEqual(globalMocks.fileFsEntry);
    });

    it("returns a valid folder entry if it exists in the file system", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", { ...globalMocks.folderFsEntry });
        const entry = prov.lookup(globalMocks.testFolderUri);
        expect(entry).toStrictEqual(globalMocks.folderFsEntry);
    });
});

describe("_lookupAsDirectory", () => {
    it("returns a valid entry if it exists in the file system", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", { ...globalMocks.folderFsEntry });
        const entry = prov._lookupAsDirectory(globalMocks.testFolderUri);
        expect(entry).toStrictEqual(globalMocks.folderFsEntry);
    });

    it("throws an error if the provided URI is a file", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", { ...globalMocks.fileFsEntry });
        expect((): unknown => prov._lookupAsDirectory(globalMocks.testFileUri)).toThrow("file not a directory");
    });
});

describe("_lookupAsFile", () => {
    it("returns a valid entry if it exists in the file system", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        const fileEntry = new FileEntry(globalMocks.fileFsEntry.name);
        prov.root.entries.set("file.txt", fileEntry);
        expect(prov._lookupAsFile(globalMocks.testFileUri)).toBe(fileEntry);
    });

    it("throws an error if the provided URI is a directory", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", globalMocks.folderFsEntry);
        expect((): any => prov._lookupAsFile(globalMocks.testFolderUri)).toThrow("file is a directory");
    });
});

describe("_lookupParentDirectory", () => {
    it("calls lookupAsDirectory for a given URI", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", { ...globalMocks.folderFsEntry });

        const lookupAsDirSpy = jest.spyOn((BaseProvider as any).prototype, "_lookupAsDirectory");
        expect(prov._lookupParentDirectory(globalMocks.testFolderUri)).toBe(prov.root);
        expect(lookupAsDirSpy).toHaveBeenCalledWith(
            vscode.Uri.from({
                scheme: ZoweScheme.USS,
                path: "/",
            }),
            false
        );
    });
});

describe("_updateChildPaths", () => {
    it("updates the paths for all child entries", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        const relocatedFolder = { ...globalMocks.folderFsEntry };
        const relocatedFile = { ...globalMocks.fileFsEntry };
        prov.root.entries.set("folder", relocatedFolder);
        prov.root.entries.set("file.txt", relocatedFile);
        prov.root.metadata = {
            path: "/root/",
        };
        prov._updateChildPaths(prov.root);
        expect(relocatedFile.metadata.path).toBe("/root/file.txt");
        expect(relocatedFolder.metadata.path).toBe("/root/folder");
    });
});

describe("_getDeleteInfo", () => {
    it("returns the correct deletion info for a URI", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", globalMocks.folderFsEntry);
        expect(prov._getDeleteInfo(globalMocks.testFolderUri)).toStrictEqual({
            entryToDelete: globalMocks.folderFsEntry,
            parent: prov.root,
            parentUri: vscode.Uri.from({
                scheme: ZoweScheme.USS,
                path: "/",
            }),
        });
    });

    it("throws an error if given an invalid URI", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        expect((): unknown => prov._getDeleteInfo(globalMocks.testFolderUri)).toThrow("file not found");
    });
});

describe("_createFile", () => {
    it("successfully creates a file entry", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.metadata = {
            profile: { name: "testProfile" } as any,
            path: "/",
        };

        const entry = await prov._createFile(globalMocks.testFileUri);
        expect(entry.metadata.path).toBe(globalMocks.testFileUri.path);
    });

    it("throws an error if the file already exists and overwrite is true", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.metadata = {
            profile: { name: "testProfile" } as any,
            path: "/",
        };

        const entry = await prov._createFile(globalMocks.testFileUri);
        expect(entry.metadata.path).toBe(globalMocks.testFileUri.path);

        try {
            await prov._createFile(globalMocks.testFileUri, { overwrite: true });
        } catch (err) {
            expect(err.message).toBe("file exists");
        }
    });

    it("throws an error if a folder already exists with the same URI", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.metadata = {
            profile: { name: "testProfile" } as any,
            path: "/",
        };
        const dirEntry = new DirEntry("file.txt");
        dirEntry.metadata = {
            ...prov.root.metadata,
            path: "/file.txt",
        };
        prov.root.entries.set("file.txt", dirEntry);
        jest.spyOn((BaseProvider as any).prototype, "_lookupParentDirectory").mockReturnValueOnce(prov.root);
        expect((): unknown => prov._createFile(globalMocks.testFileUri)).toThrow("file is a directory");
    });
});

describe("_fireSoon", () => {
    jest.useFakeTimers();

    it("adds to bufferedEvents and calls setTimeout", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        jest.spyOn(global, "setTimeout");
        prov._fireSoon({
            type: vscode.FileChangeType.Deleted,
            uri: globalMocks.testFileUri,
        });
        expect(prov._bufferedEvents.length).toBe(1);
        expect(setTimeout).toHaveBeenCalled();
    });

    it("calls clearTimeout if fireSoonHandle is defined", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        jest.spyOn(global, "setTimeout");
        jest.spyOn(global, "clearTimeout");
        prov._fireSoon({
            type: vscode.FileChangeType.Deleted,
            uri: globalMocks.testFileUri,
        });
        expect(prov._bufferedEvents.length).toBe(1);
        expect(setTimeout).toHaveBeenCalled();

        prov._fireSoon({
            type: vscode.FileChangeType.Created,
            uri: globalMocks.testFileUri,
        });
        expect(clearTimeout).toHaveBeenCalled();
    });
});

describe("_handleConflict", () => {
    it("returns 'ConflictViewSelection.UserDismissed' when user dismisses conflict prompt", async () => {
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        const prov = new (BaseProvider as any)();
        expect(await prov._handleConflict(globalMocks.testFileUri, globalMocks.fileFsEntry)).toBe(ConflictViewSelection.UserDismissed);
    });

    it("returns 'ConflictViewSelection.Compare' when user selects 'Compare'", async () => {
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Compare");
        const prov = new (BaseProvider as any)();
        const onDidCloseTextDocMock = jest.spyOn(vscode.workspace, "onDidCloseTextDocument");
        const executeCmdMock = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce(undefined);
        expect(await prov._handleConflict(globalMocks.testFileUri, globalMocks.fileFsEntry)).toBe(ConflictViewSelection.Compare);
        expect(onDidCloseTextDocMock).toHaveBeenCalled();
        expect(executeCmdMock).toHaveBeenCalledWith(
            "vscode.diff",
            globalMocks.testFileUri.with({
                query: "conflict=true",
            }),
            globalMocks.testFileUri.with({
                query: "inDiff=true",
            }),
            "file.txt (Remote) ↔ file.txt"
        );
        executeCmdMock.mockRestore();
    });

    it("returns 'ConflictViewSelection.Overwrite' when user selects 'Overwrite'", async () => {
        jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Overwrite");
        const prov = new (BaseProvider as any)();
        const diffOverwriteMock = jest.spyOn(prov, "diffOverwrite").mockImplementation();
        expect(await prov._handleConflict(globalMocks.testFileUri, globalMocks.fileFsEntry)).toBe(ConflictViewSelection.Overwrite);
        expect(diffOverwriteMock).toHaveBeenCalledWith(globalMocks.testFileUri);
    });
});

describe("_relocateEntry", () => {
    it("returns early if the entry does not exist in the file system", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        const lookupAsDirMock = jest.spyOn(prov, "_lookupAsDirectory").mockReturnValueOnce(undefined);
        lookupAsDirMock.mockClear();

        prov._relocateEntry(
            globalMocks.testFileUri,
            globalMocks.testFileUri.with({
                path: "/file2.txt",
            }),
            "/file2.txt"
        );
        expect(lookupAsDirMock).not.toHaveBeenCalled();
    });

    it("returns early if one of the parent paths does not exist in the file system", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", { ...globalMocks.fileFsEntry });
        const writeFileMock = jest.spyOn(vscode.workspace.fs, "writeFile");
        const createDirMock = jest.spyOn(vscode.workspace.fs, "createDirectory");
        createDirMock.mockClear();
        const lookupAsDirMock = jest.spyOn(prov, "_lookupAsDirectory").mockReturnValueOnce(globalMocks.folderFsEntry).mockReturnValueOnce(undefined);
        lookupAsDirMock.mockClear();

        await prov._relocateEntry(
            globalMocks.testFileUri,
            globalMocks.testFileUri.with({
                path: "/file2.txt",
            }),
            "/file2.txt"
        );
        expect(lookupAsDirMock).toHaveBeenCalledTimes(2);
        expect(writeFileMock).not.toHaveBeenCalled();
        expect(createDirMock).not.toHaveBeenCalled();
        lookupAsDirMock.mockRestore();
    });

    it("writes new entry in the file system once relocated", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", { ...globalMocks.fileFsEntry });
        const deleteEntrySpy = jest.spyOn(prov.root.entries, "delete");
        const fireSoonSpy = jest.spyOn(prov, "_fireSoon");
        const writeFileMock = jest.spyOn(vscode.workspace.fs, "writeFile");
        const createDirMock = jest.spyOn(vscode.workspace.fs, "createDirectory");
        const reopenEditorMock = jest.spyOn(prov, "_reopenEditorForRelocatedUri").mockResolvedValueOnce(undefined);
        jest.spyOn(prov, "_lookupAsFile").mockReturnValueOnce({
            ...globalMocks.fileFsEntry,
            metadata: { ...globalMocks.fileFsEntry.metadata, path: "/file2.txt" },
        });
        createDirMock.mockClear();

        const oldUri = globalMocks.testFileUri;
        const newUri = globalMocks.testFileUri.with({
            path: "/file2.txt",
        });
        await prov._relocateEntry(oldUri, newUri, "/file2.txt");
        expect(writeFileMock).toHaveBeenCalled();
        expect(createDirMock).not.toHaveBeenCalled();
        expect(deleteEntrySpy).toHaveBeenCalledWith("file.txt");
        expect(fireSoonSpy).toHaveBeenCalledWith({ type: vscode.FileChangeType.Deleted, uri: globalMocks.testFileUri });
        expect(reopenEditorMock).toHaveBeenCalledWith(oldUri, newUri);
    });
});

describe("_reopenEditorForRelocatedUri", () => {
    it("closes the old URI and opens the new, relocated URI", async () => {
        const tab = {
            input: { uri: globalMocks.testFileUri },
            viewColumn: vscode.ViewColumn.One,
        };
        const tabGroupsMock = new MockedProperty(vscode.window.tabGroups, "all", undefined, [
            {
                isActive: true,
                tabs: [tab],
            },
        ]);
        const closeTabMock = jest.spyOn(vscode.window.tabGroups, "close").mockImplementation();
        const executeCmdMock = jest.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce(undefined);
        const oldUri = globalMocks.testFileUri;
        const newUri = globalMocks.testFileUri.with({
            path: "/file2.txt",
        });
        const prov = new (BaseProvider as any)();
        await prov._reopenEditorForRelocatedUri(oldUri, newUri);
        expect(closeTabMock).toHaveBeenCalledWith(tab);
        expect(executeCmdMock).toHaveBeenCalled();
        tabGroupsMock[Symbol.dispose]();
    });
});
