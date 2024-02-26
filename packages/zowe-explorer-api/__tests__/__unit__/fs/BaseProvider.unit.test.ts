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
import { BaseProvider, DirEntry } from "../../../src/fs";
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

describe("buildTreeForUri", () => {
    it("builds the full file tree (and the entry itself) for a given URI", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.metadata = {
            profile: { name: "testProfile" } as any,
            path: "/",
        };

        const fsEntry = await prov.buildTreeForUri(
            vscode.Uri.from({
                scheme: "zowe-uss",
                path: "/a/b/c/d.txt",
            })
        );
        expect(fsEntry.name).toBe("d.txt");
    });
});

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
            ...globalMocks.fileFsEntry,
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
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
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
            ...globalMocks.fileFsEntry,
            conflictData: {
                contents: conflictArr,
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        blockMocks.lookupAsFileMock.mockResolvedValueOnce(fsEntry);

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
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
        expect(fsEntry.conflictData).toBeNull();
        expect(executeCommandMock).toHaveBeenCalledWith("workbench.action.closeActiveEditor");
    });

    it("does not call writeFile if the final data is the same as the conflict data", async () => {
        const blockMocks = getBlockMocks();
        const fsEntry = {
            ...globalMocks.fileFsEntry,
            conflictData: {
                contents: new Uint8Array([1, 2, 3]),
                etag: undefined,
                size: 3,
            },
        };
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        const executeCommandMock = jest.spyOn(vscode.commands, "executeCommand").mockImplementation();
        blockMocks.lookupAsFileMock.mockResolvedValueOnce(fsEntry);
        mocked(isEqual).mockReturnValueOnce(true);

        const prov = new (BaseProvider as any)();
        await prov.diffUseRemote(globalMocks.testFileUri);

        expect(blockMocks.lookupAsFileMock).toHaveBeenCalled();
        expect(blockMocks.writeFileMock).not.toHaveBeenCalled();
        expect(statusBarMsgMock.mock.calls[0][0]).toBe("$(check) Overwrite applied for file.txt");
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
            lookupMock: jest.spyOn((BaseProvider as any).prototype, "_lookup"),
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
        try {
            prov._lookupAsDirectory(globalMocks.testFileUri);
            fail("_lookupAsDirectory did not throw an error when provided a file URI.");
        } catch (err) {
            expect(err.message).toBe("file not a directory");
        }
    });
});

describe("_lookupAsFile", () => {
    it("returns a valid entry if it exists in the file system", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("file.txt", globalMocks.fileFsEntry);
        expect(await prov._lookupAsFile(globalMocks.testFileUri)).toStrictEqual(globalMocks.fileFsEntry);
    });

    it("throws an error if the provided URI is a directory", async () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        prov.root.entries.set("folder", globalMocks.folderFsEntry);
        await expect(prov._lookupAsFile(globalMocks.testFileUri)).rejects.toThrow("file is a directory");
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
                scheme: "zowe-uss",
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
        expect(relocatedFolder.metadata.path).toBe("/root/folder/");
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
                scheme: "zowe-uss",
                path: "/",
            }),
        });
    });

    it("throws an error if given an invalid URI", () => {
        const prov = new (BaseProvider as any)();
        prov.root = new DirEntry("");
        try {
            prov._getDeleteInfo(globalMocks.testFolderUri);
            fail("_getDeleteInfo should throw an error when provided an invalid URI.");
        } catch (err) {
            expect(err.message).toBe("file not found");
        }
    });
});
