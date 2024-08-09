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

import { Disposable, FilePermission, FileType, TextEditor, Uri } from "vscode";
import { BaseProvider, DirEntry, FileEntry, Gui, UssDirectory, UssFile, ZoweScheme } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/configuration/Profiles";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { USSFileStructure } from "../../../../src/trees/uss/USSFileStructure";

const testProfile = createIProfile();
const testProfileB = { ...createIProfile(), name: "sestest2", profile: { ...testProfile.profile, host: "fake2" } };

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    conflictFile: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFile.txt", query: "conflict=true" }),
    file: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFile.txt" }),
    folder: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFolder" }),
    session: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest" }),
};

const testEntries = {
    file: {
        name: "aFile.txt",
        conflictData: {
            contents: new Uint8Array([4, 5, 6]),
            etag: undefined,
            size: 3,
        },
        data: new Uint8Array([1, 2, 3]),
        etag: "A123SEEMINGLY456RANDOM789ETAG",
        metadata: {
            profile: testProfile,
            path: "/aFile.txt",
        },
        mtime: 0,
        type: FileType.File,
        wasAccessed: true,
    } as FileEntry,
    folder: {
        name: "aFolder",
        entries: new Map(),
        metadata: {
            profile: testProfile,
            path: "/aFolder",
        },
        type: FileType.Directory,
        wasAccessed: false,
    } as DirEntry,
    session: {
        name: "sestest",
        entries: new Map(),
        metadata: {
            profile: testProfile,
            path: "/",
        },
        size: 0,
        type: FileType.Directory,
        wasAccessed: false,
    } as DirEntry,
};

describe("stat", () => {
    const lookupMock = jest.spyOn((UssFSProvider as any).prototype, "lookup");

    it("returns a file entry", async () => {
        lookupMock.mockReturnValueOnce(testEntries.file);
        const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValueOnce({
            success: true,
            apiResponse: {
                items: [{ name: testEntries.file.name }],
            },
            commandResponse: "",
        });
        await expect(UssFSProvider.instance.stat(testUris.file)).resolves.toStrictEqual(testEntries.file);
        expect(lookupMock).toHaveBeenCalledWith(testUris.file, false);
        expect(listFilesMock).toHaveBeenCalled();
        listFilesMock.mockRestore();
    });
    it("returns a file as 'read-only' when query has conflict parameter", async () => {
        lookupMock.mockReturnValueOnce(testEntries.file);
        await expect(UssFSProvider.instance.stat(testUris.conflictFile)).resolves.toStrictEqual({
            ...testEntries.file,
            permissions: FilePermission.Readonly,
        });
        expect(lookupMock).toHaveBeenCalledWith(testUris.conflictFile, false);
    });
});

describe("move", () => {
    const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");
    const newUri = testUris.file.with({ path: "/sestest/aFile2.txt" });

    it("returns true if it successfully moved a valid, old URI to the new URI", async () => {
        getInfoFromUriMock
            .mockReturnValueOnce({
                // info for new URI
                path: "/aFile2.txt",
                profile: testProfile,
            })
            .mockReturnValueOnce({
                // info about old URI
                path: "/aFile.txt",
                profile: testProfile,
            });
        const moveStub = jest.fn();
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            move: moveStub,
        } as any);
        const relocateEntryMock = jest.spyOn((UssFSProvider as any).prototype, "_relocateEntry").mockResolvedValueOnce(undefined);
        expect(await UssFSProvider.instance.move(testUris.file, newUri)).toBe(true);
        expect(getInfoFromUriMock).toHaveBeenCalledTimes(2);
        expect(moveStub).toHaveBeenCalledWith("/aFile.txt", "/aFile2.txt");
        expect(relocateEntryMock).toHaveBeenCalledWith(testUris.file, newUri, "/aFile2.txt");
    });
    it("returns false if the 'move' API is not implemented", async () => {
        getInfoFromUriMock.mockReturnValueOnce({
            // info for new URI
            path: "/aFile2.txt",
            profile: testProfile,
        });
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({} as any);
        const errorMsgMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        expect(await UssFSProvider.instance.move(testUris.file, newUri)).toBe(false);
        expect(errorMsgMock).toHaveBeenCalledWith("The 'move' function is not implemented for this USS API.");
    });
});

describe("listFiles", () => {
    it("throws an error when called with a URI with an empty path", async () => {
        await expect(
            UssFSProvider.instance.listFiles(
                testProfile,
                Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "",
                })
            )
        ).rejects.toThrow("Could not list USS files: Empty path provided in URI");
    });
    it("removes '.', '..', and '...' from IZosFilesResponse items when successful", async () => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            fileList: jest.fn().mockResolvedValueOnce({
                success: true,
                commandResponse: "",
                apiResponse: {
                    items: [{ name: "." }, { name: ".." }, { name: "..." }, { name: "test.txt" }],
                },
            }),
        } as any);
        expect(await UssFSProvider.instance.listFiles(testProfile, testUris.folder)).toStrictEqual({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ name: "test.txt" }],
            },
        });
    });
    it("properly returns an unsuccessful response", async () => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            fileList: jest.fn().mockResolvedValueOnce({
                success: false,
                commandResponse: "",
                apiResponse: {},
            }),
        } as any);
        expect(await UssFSProvider.instance.listFiles(testProfile, testUris.folder)).toStrictEqual({
            success: false,
            commandResponse: "",
            apiResponse: {
                items: [],
            },
        });
    });
});

describe("readDirectory", () => {
    it("returns the correct list of entries inside a folder", async () => {
        const lookupAsDirMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsDirectory").mockReturnValueOnce(testEntries.folder);
        const remoteLookupForResourceMock = jest.spyOn(UssFSProvider.instance, "remoteLookupForResource").mockImplementation(async () => {
            testEntries.folder.entries.set("test.txt", new FileEntry("test.txt"));
            testEntries.folder.entries.set("innerFolder", new DirEntry("innerFolder"));

            return testEntries.folder as UssDirectory;
        });

        expect(await UssFSProvider.instance.readDirectory(testUris.folder)).toStrictEqual([
            ["test.txt", FileType.File],
            ["innerFolder", FileType.Directory],
        ]);
        lookupAsDirMock.mockRestore();
        remoteLookupForResourceMock.mockRestore();
    });
});

describe("fetchFileAtUri", () => {
    it("calls getContents to get the data for a file entry", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
        const exampleData = "hello world!";
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockImplementation();
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            getContents: jest.fn().mockImplementationOnce((filePath, opts) => {
                opts.stream.write(exampleData);
                return {
                    apiResponse: {
                        etag: "123abc",
                    },
                };
            }),
        } as any);

        await UssFSProvider.instance.fetchFileAtUri(testUris.file);

        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
        expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
        expect(fileEntry.data?.toString()).toBe(exampleData);
        expect(fileEntry.etag).toBe("123abc");
        expect(fileEntry.data?.byteLength).toBe(exampleData.length);
        autoDetectEncodingMock.mockRestore();
    });
    it("assigns conflictData if the 'isConflict' option is specified", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
        const exampleData = "<remote data>";
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockImplementation();
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            getContents: jest.fn().mockImplementationOnce((filePath, opts) => {
                opts.stream.write(exampleData);
                return {
                    apiResponse: {
                        etag: "321cba",
                    },
                };
            }),
        } as any);

        await UssFSProvider.instance.fetchFileAtUri(testUris.file, { isConflict: true });

        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
        expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
        expect(fileEntry.conflictData?.contents.toString()).toBe(exampleData);
        expect(fileEntry.conflictData?.etag).toBe("321cba");
        expect(fileEntry.conflictData?.contents.byteLength).toBe(exampleData.length);
        autoDetectEncodingMock.mockRestore();
    });
    it("calls '_updateResourceInEditor' if the 'editor' option is specified", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockImplementation();
        const exampleData = "hello world!";
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            getContents: jest.fn().mockImplementationOnce((filePath, opts) => {
                opts.stream.write(exampleData);
                return {
                    apiResponse: {
                        etag: "123abc",
                    },
                };
            }),
        } as any);

        const _updateResourceInEditorMock = jest.spyOn((UssFSProvider as any).prototype, "_updateResourceInEditor").mockResolvedValueOnce(undefined);
        await UssFSProvider.instance.fetchFileAtUri(testUris.file, { editor: {} as TextEditor });

        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
        expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
        expect(fileEntry.data?.toString()).toBe(exampleData);
        expect(fileEntry.etag).toBe("123abc");
        expect(fileEntry.data?.byteLength).toBe(exampleData.length);
        expect(_updateResourceInEditorMock).toHaveBeenCalledWith(testUris.file);
        autoDetectEncodingMock.mockRestore();
    });
});

describe("fetchEncodingForUri", () => {
    it("returns the correct encoding for a URI", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockImplementation((entry) => {
            entry.encoding = { kind: "text" };
            return Promise.resolve();
        });
        await UssFSProvider.instance.fetchEncodingForUri(testUris.file);

        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
        expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
        expect(fileEntry.encoding).toStrictEqual({ kind: "text" });
        autoDetectEncodingMock.mockRestore();
    });
});

describe("autoDetectEncoding", () => {
    const getTagMock = jest.fn();
    let mockUssApi;

    beforeEach(() => {
        mockUssApi = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue({
            getTag: getTagMock.mockClear(),
        } as any);
    });

    it("sets encoding if file tagged as binary", async () => {
        getTagMock.mockResolvedValueOnce("binary");
        const testEntry = new UssFile("testFile");
        testEntry.metadata = {
            path: "/testFile",
            profile: testProfile,
        };
        await UssFSProvider.instance.autoDetectEncoding(testEntry);
        expect(getTagMock).toHaveBeenCalledTimes(1);
        expect(testEntry.encoding).toStrictEqual({ kind: "binary" });
    });

    it("sets encoding if file tagged as binary - old API", async () => {
        const isFileTagBinOrAsciiMock = jest.fn().mockResolvedValueOnce(true);
        mockUssApi.mockReturnValueOnce({
            isFileTagBinOrAscii: isFileTagBinOrAsciiMock,
        } as any);
        const testEntry = new UssFile("testFile");
        testEntry.metadata = {
            path: "/testFile",
            profile: testProfile,
        };
        await UssFSProvider.instance.autoDetectEncoding(testEntry);
        expect(testEntry.encoding?.kind).toBe("binary");
        expect(isFileTagBinOrAsciiMock).toHaveBeenCalledTimes(1);
    });

    it("sets encoding if file tagged as EBCDIC", async () => {
        getTagMock.mockResolvedValueOnce("IBM-1047");
        const testEntry = new UssFile("testFile");
        testEntry.metadata = {
            path: "/testFile",
            profile: testProfile,
        };
        await UssFSProvider.instance.autoDetectEncoding(testEntry);
        expect(testEntry.encoding).toStrictEqual({
            kind: "other",
            codepage: "IBM-1047",
        });
        expect(getTagMock).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if file is untagged", async () => {
        getTagMock.mockResolvedValueOnce("untagged");
        const testEntry = new UssFile("testFile");
        testEntry.metadata = {
            path: "/testFile",
            profile: testProfile,
        };
        await UssFSProvider.instance.autoDetectEncoding(testEntry);
        expect(testEntry.encoding).toBe(undefined);
        expect(getTagMock).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if already defined on node", async () => {
        const testEntry = new UssFile("testFile");
        testEntry.metadata = {
            path: "/testFile",
            profile: testProfile,
        };
        testEntry.encoding = { kind: "binary" };
        await UssFSProvider.instance.autoDetectEncoding(testEntry);
        expect(testEntry.encoding.kind).toBe("binary");
        expect(getTagMock).toHaveBeenCalledTimes(0);
    });
});

describe("readFile", () => {
    const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile");
    const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");

    it("throws an error when trying to read a file that doesn't have a profile registered", async () => {
        lookupAsFileMock.mockReturnValueOnce(testEntries.file);
        getInfoFromUriMock.mockReturnValueOnce({
            profile: null,
            path: "/aFile.txt",
        });

        let err;
        try {
            await UssFSProvider.instance.readFile(testUris.file);
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileNotFound");
        }
        expect(err).toBeDefined();
    });

    it("returns data for a file", async () => {
        lookupAsFileMock.mockReturnValueOnce(testEntries.file);
        getInfoFromUriMock.mockReturnValueOnce({
            profile: testProfile,
            path: "/aFile.txt",
        });
        const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(undefined);
        expect((await UssFSProvider.instance.readFile(testUris.file)).toString()).toStrictEqual([1, 2, 3].toString());
        fetchFileAtUriMock.mockRestore();
    });

    it("returns conflict data for a file with the conflict query parameter", async () => {
        lookupAsFileMock.mockReturnValueOnce(testEntries.file);
        getInfoFromUriMock.mockReturnValueOnce({
            profile: testProfile,
            path: "/aFile.txt",
        });
        const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(undefined);

        expect(
            (
                await UssFSProvider.instance.readFile(
                    testUris.file.with({
                        query: "conflict=true",
                    })
                )
            ).toString()
        ).toStrictEqual([4, 5, 6].toString());
        expect(fetchFileAtUriMock).toHaveBeenCalled();
        fetchFileAtUriMock.mockRestore();
    });
});

describe("writeFile", () => {
    it("updates a file in the FSP and remote system", async () => {
        const mockUssApi = {
            uploadFromBuffer: jest.fn().mockResolvedValueOnce({
                apiResponse: {
                    etag: "NEWETAG",
                },
            }),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const folder = {
            ...testEntries.folder,
            entries: new Map([[testEntries.file.name, { ...testEntries.file }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const newContents = new Uint8Array([3, 6, 9]);
        await UssFSProvider.instance.writeFile(testUris.file, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
        expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving USS file...");
        expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.file.metadata.path, {
            binary: false,
            encoding: undefined,
            etag: testEntries.file.etag,
            returnEtag: true,
        });
        const fileEntry = folder.entries.get("aFile.txt")!;
        expect(fileEntry.etag).toBe("NEWETAG");
        expect(fileEntry.data).toBe(newContents);
        ussApiMock.mockRestore();
    });

    it("throws an error when there is an error unrelated to etag", async () => {
        const mockUssApi = {
            uploadFromBuffer: jest.fn().mockRejectedValueOnce(new Error("Unknown error on remote system")),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const folder = {
            ...testEntries.folder,
            entries: new Map([[testEntries.file.name, { ...testEntries.file }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValue(undefined);
        const newContents = new Uint8Array([3, 6, 9]);
        await expect(UssFSProvider.instance.writeFile(testUris.file, newContents, { create: false, overwrite: true })).rejects.toThrow(
            "Unknown error on remote system"
        );

        lookupParentDirMock.mockRestore();
        ussApiMock.mockRestore();
        autoDetectEncodingMock.mockRestore();
    });

    it("calls _handleConflict when there is an etag error", async () => {
        const mockUssApi = {
            uploadFromBuffer: jest.fn().mockRejectedValueOnce(new Error("Rest API failure with HTTP(S) status 412")),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const folder = {
            ...testEntries.folder,
            entries: new Map([[testEntries.file.name, { ...testEntries.file }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValue(undefined);
        const newContents = new Uint8Array([3, 6, 9]);
        const handleConflictMock = jest.spyOn(UssFSProvider.instance as any, "_handleConflict").mockImplementation();
        await UssFSProvider.instance.writeFile(testUris.file, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
        expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving USS file...");
        expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.file.metadata.path, {
            binary: false,
            encoding: undefined,
            etag: testEntries.file.etag,
            returnEtag: true,
        });
        expect(handleConflictMock).toHaveBeenCalled();
        handleConflictMock.mockRestore();
        ussApiMock.mockRestore();
        autoDetectEncodingMock.mockRestore();
    });

    it("upload changes to a remote file even if its not yet in the FSP", async () => {
        const mockUssApi = {
            uploadFromBuffer: jest.fn().mockResolvedValueOnce({
                apiResponse: {
                    etag: "NEWETAG",
                },
            }),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const folder = {
            ...testEntries.session,
            entries: new Map(),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValue(undefined);
        const newContents = new Uint8Array([3, 6, 9]);
        await UssFSProvider.instance.writeFile(testUris.file, newContents, { create: true, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
        expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving USS file...");
        expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.file.metadata.path, {
            binary: false,
            encoding: undefined,
            etag: undefined,
            returnEtag: true,
        });
        const fileEntry = folder.entries.get("aFile.txt")!;
        expect(fileEntry.etag).toBe("NEWETAG");
        expect(fileEntry.data).toBe(newContents);
        ussApiMock.mockRestore();
        autoDetectEncodingMock.mockRestore();
    });

    it("updates an empty, unaccessed file entry in the FSP without sending data", async () => {
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({} as any);
        const folder = {
            ...testEntries.folder,
            entries: new Map([[testEntries.file.name, { ...testEntries.file, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const newContents = new Uint8Array([]);
        await UssFSProvider.instance.writeFile(testUris.file, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
        const fileEntry = folder.entries.get("aFile.txt")!;
        expect(fileEntry.data?.length).toBe(0);
        ussApiMock.mockRestore();
    });

    it("updates a file when open in the diff view", async () => {
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi");
        const folder = {
            ...testEntries.folder,
            entries: new Map([[testEntries.file.name, { ...testEntries.file, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(folder);
        const newContents = new Uint8Array([]);
        await UssFSProvider.instance.writeFile(
            testUris.file.with({
                query: "inDiff=true",
            }),
            newContents,
            { create: false, overwrite: true }
        );

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
        const fileEntry = folder.entries.get("aFile.txt")!;
        expect(fileEntry.data?.length).toBe(0);
        expect(fileEntry.inDiffView).toBe(true);
        expect(ussApiMock).not.toHaveBeenCalled();
    });

    it("throws an error if entry doesn't exist and 'create' option is false", async () => {
        let err;
        try {
            await UssFSProvider.instance.writeFile(testUris.file, new Uint8Array([]), { create: false, overwrite: true });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileNotFound");
        }
        expect(err).toBeDefined();
    });

    it("throws an error if entry exists and 'overwrite' option is false", async () => {
        const rootFolder = {
            ...testEntries.session,
            entries: new Map([[testEntries.file.name, { ...testEntries.file, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(rootFolder);
        let err;
        try {
            await UssFSProvider.instance.writeFile(testUris.file, new Uint8Array([]), { create: true, overwrite: false });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileExists");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });

    it("throws an error if the given URI is a directory", async () => {
        const rootFolder = {
            ...testEntries.session,
            entries: new Map([[testEntries.folder.name, { ...testEntries.folder }]]),
        };
        const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(rootFolder);
        let err;
        try {
            await UssFSProvider.instance.writeFile(testUris.folder, new Uint8Array([]), { create: true, overwrite: false });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileIsADirectory");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });
});

describe("makeEmptyFileWithEncoding", () => {
    it("creates an empty file in the provider with the given encoding", () => {
        const fakeSession = { ...testEntries.session };
        const parentDirMock = jest.spyOn(UssFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSession);
        expect(UssFSProvider.instance.makeEmptyFileWithEncoding(testUris.file, { kind: "binary" }));
        expect(fakeSession.entries.has(testEntries.file.name)).toBe(true);
        parentDirMock.mockRestore();
    });
});

describe("rename", () => {
    it("throws an error if entry exists and 'overwrite' is false", async () => {
        const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValueOnce({ ...testEntries.file });
        await expect(
            UssFSProvider.instance.rename(testUris.file, testUris.file.with({ path: "/sestest/aFile2.txt" }), { overwrite: false })
        ).rejects.toThrow("Rename failed: aFile2.txt already exists in /");

        lookupMock.mockRestore();
    });

    it("renames a file entry in the FSP and remote system", async () => {
        const mockUssApi = {
            rename: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValueOnce({ ...testEntries.file });
        const fileEntry = { ...testEntries.file, metadata: { ...testEntries.file.metadata } };
        const sessionEntry = {
            ...testEntries.session,
            entries: new Map([[testEntries.file.name, fileEntry]]),
        };
        (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);

        await UssFSProvider.instance.rename(testUris.file, testUris.file.with({ path: "/sestest/aFile2.txt" }), { overwrite: true });
        expect(mockUssApi.rename).toHaveBeenCalledWith("/aFile.txt", "/aFile2.txt");
        expect(fileEntry.metadata.path).toBe("/aFile2.txt");
        expect(sessionEntry.entries.has("aFile2.txt")).toBe(true);

        lookupMock.mockRestore();
        ussApiMock.mockRestore();
    });

    it("renames a folder entry in the FSP and remote system, updating child paths", async () => {
        const mockUssApi = {
            rename: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValueOnce({ ...testEntries.folder });
        const updChildPathsMock = jest.spyOn(UssFSProvider.instance as any, "_updateChildPaths").mockResolvedValueOnce(undefined);
        const folderEntry = { ...testEntries.folder, metadata: { ...testEntries.folder.metadata } };
        const sessionEntry = {
            ...testEntries.session,
            entries: new Map([[testEntries.folder.name, folderEntry]]),
        };
        (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);

        await UssFSProvider.instance.rename(testUris.folder, testUris.folder.with({ path: "/sestest/aFolder2" }), { overwrite: true });
        expect(mockUssApi.rename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
        expect(folderEntry.metadata.path).toBe("/aFolder2");
        expect(sessionEntry.entries.has("aFolder2")).toBe(true);
        expect(updChildPathsMock).toHaveBeenCalledWith(folderEntry);

        lookupMock.mockRestore();
        ussApiMock.mockRestore();
        updChildPathsMock.mockRestore();
    });

    it("displays an error message when renaming fails on the remote system", async () => {
        const mockUssApi = {
            rename: jest.fn().mockRejectedValueOnce(new Error("could not upload file")),
        };
        const errMsgSpy = jest.spyOn(Gui, "errorMessage");
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
        const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValueOnce({ ...testEntries.folder });
        const folderEntry = { ...testEntries.folder, metadata: { ...testEntries.folder.metadata } };
        const sessionEntry = {
            ...testEntries.session,
            entries: new Map([[testEntries.folder.name, folderEntry]]),
        };
        (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);

        await UssFSProvider.instance.rename(testUris.folder, testUris.folder.with({ path: "/sestest/aFolder2" }), { overwrite: true });
        expect(mockUssApi.rename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
        expect(folderEntry.metadata.path).toBe("/aFolder");
        expect(sessionEntry.entries.has("aFolder2")).toBe(false);
        expect(errMsgSpy).toHaveBeenCalledWith("Renaming /aFolder failed due to API error: could not upload file");

        lookupMock.mockRestore();
        ussApiMock.mockRestore();
    });
});

describe("delete", () => {
    it("successfully deletes an entry", async () => {
        testEntries.session.entries.set("aFile.txt", testEntries.file);
        testEntries.session.size = 1;
        const getDelInfoMock = jest.spyOn((BaseProvider as any).prototype, "_getDeleteInfo").mockReturnValueOnce({
            entryToDelete: testEntries.file,
            parent: testEntries.session,
            parentUri: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest" }),
        });
        const deleteMock = jest.fn().mockResolvedValueOnce(undefined);
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            delete: deleteMock,
        } as any);
        expect(await UssFSProvider.instance.delete(testUris.file, { recursive: false })).toBe(undefined);
        expect(getDelInfoMock).toHaveBeenCalledWith(testUris.file);
        expect(deleteMock).toHaveBeenCalledWith(testEntries.file.metadata.path, false);
        expect(testEntries.session.entries.has("aFile.txt")).toBe(false);
        expect(testEntries.session.size).toBe(0);
    });
    it("displays an error message if it fails to delete the entry from the remote system", async () => {
        const sesEntry = { ...testEntries.session };
        sesEntry.entries.set("aFile.txt", testEntries.file);
        sesEntry.size = 1;
        const getDelInfoMock = jest.spyOn((BaseProvider as any).prototype, "_getDeleteInfo").mockReturnValueOnce({
            entryToDelete: testEntries.file,
            parent: sesEntry,
            parentUri: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest" }),
        });
        const errorMsgMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        const deleteMock = jest.fn().mockRejectedValueOnce(new Error("insufficient permissions"));
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            delete: deleteMock,
        } as any);
        await UssFSProvider.instance.delete(testUris.file, { recursive: false });
        expect(getDelInfoMock).toHaveBeenCalledWith(testUris.file);
        expect(deleteMock).toHaveBeenCalledWith(testEntries.file.metadata.path, false);
        expect(errorMsgMock).toHaveBeenCalledWith("Deleting /aFile.txt failed due to API error: insufficient permissions");
        expect(sesEntry.entries.has("aFile.txt")).toBe(true);
        expect(sesEntry.size).toBe(1);
    });
});

describe("copy", () => {
    const copyTreeMock = jest.spyOn((UssFSProvider as any).prototype, "copyTree");
    it("returns early if the source URI does not have a file tree in its query", async () => {
        await UssFSProvider.instance.copy(
            testUris.file,
            testUris.file.with({
                path: "/sestest/aFile2.txt",
            }),
            { overwrite: true }
        );
        expect(copyTreeMock).not.toHaveBeenCalled();
    });

    it("calls copyTree with the given URIs and options", async () => {
        copyTreeMock.mockResolvedValueOnce(undefined);
        const fileTree = {
            localUri: testUris.file,
            ussPath: "/aFile.txt",
            baseName: "aFile.txt",
            binary: false,
            children: [],
            sessionName: "sestest",
            type: USSFileStructure.UssFileType.File,
        };
        const uriWithTree = testUris.file.with({
            query: `tree=${encodeURIComponent(JSON.stringify(fileTree))}`,
        });
        const destUri = testUris.file.with({
            path: "/sestest/aFile2.txt",
        });
        await UssFSProvider.instance.copy(uriWithTree, destUri, { overwrite: true });
        expect(copyTreeMock).toHaveBeenCalledWith(uriWithTree, destUri, { overwrite: true, tree: fileTree });
    });

    afterAll(() => {
        copyTreeMock.mockRestore();
    });
});

describe("buildFileName", () => {
    it("returns a file name without copy suffix if no collisions are found", () => {
        expect(
            (UssFSProvider.instance as any).buildFileName(
                [
                    {
                        name: "apple.txt",
                    },
                    {
                        name: "orange.txt",
                    },
                    {
                        name: "banana.txt",
                    },
                    {
                        name: "strawberry.txt",
                    },
                ],
                "pear.txt"
            )
        ).toBe("pear.txt");
    });
    it("returns a file name with copy suffix if collisions are found", () => {
        expect(
            (UssFSProvider.instance as any).buildFileName(
                [
                    {
                        name: "apple.txt",
                    },
                    {
                        name: "orange.txt",
                    },
                    {
                        name: "pear.txt",
                    },
                    {
                        name: "strawberry.txt",
                    },
                ],
                "pear.txt"
            )
        ).toBe("pear (1).txt");
    });
    it("returns a file name with '(2)' suffix if more collisions are found after adding copy suffix", () => {
        expect(
            (UssFSProvider.instance as any).buildFileName(
                [
                    {
                        name: "apple.txt",
                    },
                    {
                        name: "orange.txt",
                    },
                    {
                        name: "pear.txt",
                    },
                    {
                        name: "pear (1).txt",
                    },
                ],
                "pear.txt"
            )
        ).toBe("pear (2).txt");
    });
});

describe("copyTree", () => {
    describe("copying a file tree - same profiles (copy API)", () => {
        it("with naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/bFile.txt",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/aFile.txt",
                });
            const mockUssApi = {
                copy: jest.fn(),
                create: jest.fn(),
                fileList: jest.fn().mockResolvedValueOnce({
                    apiResponse: {
                        items: [{ name: "bFile.txt" }],
                    },
                }),
                uploadFromBuffer: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            await (UssFSProvider.instance as any).copyTree(
                testUris.file,
                testUris.file.with({
                    path: "/sestest/bFile.txt",
                }),
                { tree: { type: USSFileStructure.UssFileType.File } }
            );
            expect(mockUssApi.copy).toHaveBeenCalledWith("/bFile (1).txt", {
                from: "/aFile.txt",
                recursive: false,
                overwrite: true,
            });
            getInfoFromUri.mockRestore();
        });

        it("without naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/bFile.txt",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/aFile.txt",
                });
            const mockUssApi = {
                copy: jest.fn(),
                create: jest.fn(),
                fileList: jest.fn().mockResolvedValueOnce({
                    apiResponse: {
                        items: [{ name: "aFile.txt" }],
                    },
                }),
                uploadFromBuffer: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            await (UssFSProvider.instance as any).copyTree(
                testUris.file,
                testUris.file.with({
                    path: "/sestest/bFile.txt",
                }),
                { tree: { type: USSFileStructure.UssFileType.File } }
            );
            expect(mockUssApi.copy).toHaveBeenCalledWith("/bFile.txt", {
                from: "/aFile.txt",
                recursive: false,
                overwrite: true,
            });
            getInfoFromUri.mockRestore();
        });
    });

    describe("copying - different profiles", () => {
        it("file: with naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfileB,
                    path: "/aFile.txt",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/aFile.txt",
                });
            const mockUssApi = {
                copy: jest.fn(),
                create: jest.fn(),
                fileList: jest.fn().mockResolvedValueOnce({
                    apiResponse: {
                        items: [{ name: "bFile.txt" }],
                    },
                }),
                uploadFromBuffer: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            jest.spyOn((UssFSProvider as any).instance, "lookup").mockReturnValueOnce(testEntries.file);
            jest.spyOn((UssFSProvider as any).instance, "readFile").mockResolvedValueOnce(testEntries.file.data);
            await (UssFSProvider.instance as any).copyTree(
                testUris.file,
                testUris.file.with({
                    path: "/sestest2/bFile.txt",
                }),
                { tree: { type: USSFileStructure.UssFileType.File } }
            );
            expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(testEntries.file.data ?? []), "/aFile.txt");
            getInfoFromUri.mockRestore();
        });
        it("file: without naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfileB,
                    path: "/aFile.txt",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/aFile.txt",
                });
            const mockUssApi = {
                copy: jest.fn(),
                create: jest.fn(),
                fileList: jest.fn().mockResolvedValueOnce({
                    apiResponse: {
                        items: [{ name: "aFile.txt" }],
                    },
                }),
                uploadFromBuffer: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            jest.spyOn((UssFSProvider as any).instance, "lookup").mockReturnValueOnce(testEntries.file);
            jest.spyOn((UssFSProvider as any).instance, "readFile").mockResolvedValueOnce(testEntries.file.data);
            await (UssFSProvider.instance as any).copyTree(
                testUris.file,
                testUris.file.with({
                    path: "/sestest2/aFile.txt",
                }),
                { tree: { type: USSFileStructure.UssFileType.File } }
            );
            expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(testEntries.file.data ?? []), "/aFile (1).txt");
            getInfoFromUri.mockRestore();
        });
        it("folder", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfileB,
                    path: "/aFolder",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/aFolder",
                });
            const mockUssApi = {
                create: jest.fn(),
                fileList: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [{ name: "aFile.txt" }],
                    },
                }),
                uploadFromBuffer: jest.fn(),
            };
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(mockUssApi as any);

            const copyTreeSpy = jest.spyOn(UssFSProvider.instance as any, "copyTree");
            const fileInPathTree = {
                baseName: "someFile.txt",
                localUri: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFolder/someFile.txt" }),
                type: USSFileStructure.UssFileType.File,
            };
            const ussFileTree = {
                type: USSFileStructure.UssFileType.Directory,
                children: [fileInPathTree],
            };
            await (UssFSProvider.instance as any).copyTree(
                testUris.folder,
                testUris.folder.with({
                    path: "/sestest2/aFolder",
                }),
                { tree: ussFileTree }
            );
            expect(mockUssApi.create).toHaveBeenCalledWith("/aFolder", "directory");
            expect(copyTreeSpy).toHaveBeenCalledTimes(2);
            getInfoFromUri.mockRestore();
            ussApiMock.mockRestore();
        });
    });
});

describe("createDirectory", () => {
    it("creates a session directory with the given URI", () => {
        const root = (UssFSProvider.instance as any).root;
        root.entries.clear();
        const oldSize: number = root.size;
        const getInfoFromUri = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/",
        });
        UssFSProvider.instance.createDirectory(testUris.session);
        expect(root.entries.has("sestest")).toBe(true);
        expect(root.size).toBe(oldSize + 1);
        getInfoFromUri.mockRestore();
    });

    it("creates an inner directory with the given URI", () => {
        const root = (UssFSProvider.instance as any).root;
        const sesEntry = new DirEntry("sestest");
        sesEntry.metadata = {
            profile: testProfile,
            path: "/",
        };
        root.entries.set("sestest", sesEntry);
        const oldSize: number = sesEntry.size;
        UssFSProvider.instance.createDirectory(testUris.folder);
        expect(sesEntry.entries.has("aFolder")).toBe(true);
        expect(sesEntry.size).toBe(oldSize + 1);
    });
});

describe("watch", () => {
    it("returns a new, empty Disposable object", () => {
        expect(UssFSProvider.instance.watch(testUris.file)).toStrictEqual(new Disposable(() => {}));
    });
});

describe("_getInfoFromUri", () => {
    it("returns the correct info for a given URI when ProfilesCache is available", () => {
        jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
            loadNamedProfile: jest.fn().mockReturnValueOnce(testProfile),
        } as any);
        expect((UssFSProvider.instance as any)._getInfoFromUri(testUris.file)).toStrictEqual({
            profile: testProfile,
            path: "/aFile.txt",
        });
    });
});
