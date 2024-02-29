import { Disposable, FilePermission, FileSystemError, FileType, TextEditor, Uri } from "vscode";
import { UssFSProvider } from "../../../../src/uss/UssFSProvider";
import { createIProfile } from "../../../../__mocks__/mockCreators/shared";
import { ZoweExplorerApiRegister } from "../../../../src/ZoweExplorerApiRegister";
import { BaseProvider, BufferBuilder, DirEntry, FileEntry, Gui, imperative } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/Profiles";
import { UssFileType } from "../../../../src/uss/FileStructure";

const testProfile = createIProfile();

const testUris = {
    conflictFile: Uri.from({ scheme: "zowe-uss", path: "/sestest/aFile.txt", query: "conflict=true" }),
    file: Uri.from({ scheme: "zowe-uss", path: "/sestest/aFile.txt" }),
    folder: Uri.from({ scheme: "zowe-uss", path: "/sestest/aFolder" }),
    session: Uri.from({ scheme: "zowe-uss", path: "/sestest" }),
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
        etag: undefined,
        metadata: {
            profile: { name: "sestest" } as any,
            path: "/sestest/aFile.txt",
        },
        wasAccessed: false,
    } as FileEntry,
    folder: {
        name: "aFolder",
        entries: new Map(),
        metadata: {
            profile: { name: "sestest" } as any,
            path: "/sestest/aFolder",
        },
        wasAccessed: false,
    } as DirEntry,
    session: {
        name: "sestest",
        entries: new Map(),
        metadata: {
            profile: { name: "sestest" } as any,
            path: "/sestest",
        },
        size: 0,
        wasAccessed: false,
    } as DirEntry,
};

describe("stat", () => {
    const lookupMock = jest.spyOn((UssFSProvider as any).prototype, "_lookup");

    it("returns a file entry", () => {
        lookupMock.mockReturnValueOnce(testEntries.file);
        expect(UssFSProvider.instance.stat(testUris.file)).toStrictEqual(testEntries.file);
        expect(lookupMock).toHaveBeenCalledWith(testUris.file, false);
    });
    it("returns a file as 'read-only' when query has conflict parameter", () => {
        lookupMock.mockReturnValueOnce(testEntries.file);
        expect(UssFSProvider.instance.stat(testUris.conflictFile)).toStrictEqual({ ...testEntries.file, permissions: FilePermission.Readonly });
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
        try {
            await UssFSProvider.instance.listFiles(
                testProfile,
                Uri.from({
                    scheme: "zowe-uss",
                    path: "",
                })
            );
            fail("listFiles should throw an error when the URI has an empty path");
        } catch (err) {
            expect(err).toHaveProperty("message");
            expect(err.message).toBe("Could not list USS files: Empty path provided in URI");
        }
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
        const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [
                    { name: "test.txt", mode: "-rwxrwxrwx" },
                    { name: "innerFolder", mode: "drwxrwxrwx" },
                ],
            },
        });

        expect(await UssFSProvider.instance.readDirectory(testUris.folder)).toStrictEqual([
            ["test.txt", FileType.File],
            ["innerFolder", FileType.Directory],
        ]);
    });
});

describe("fetchFileAtUri", () => {
    it("calls getContents to get the data for a file entry", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockResolvedValueOnce(fileEntry);
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

        await UssFSProvider.instance.fetchFileAtUri(testUris.file);

        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
        expect(fileEntry.data.toString()).toBe(exampleData);
        expect(fileEntry.etag).toBe("123abc");
        expect(fileEntry.data.byteLength).toBe(exampleData.length);
    });
    it("assigns conflictData if the 'isConflict' option is specified", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockResolvedValueOnce(fileEntry);
        const exampleData = "<remote data>";
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
        expect(fileEntry.conflictData?.contents.toString()).toBe(exampleData);
        expect(fileEntry.conflictData?.etag).toBe("321cba");
        expect(fileEntry.conflictData?.contents.byteLength).toBe(exampleData.length);
    });
    it("calls '_updateResourceInEditor' if the 'editor' option is specified", async () => {
        const fileEntry = { ...testEntries.file };
        const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockResolvedValueOnce(fileEntry);
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
        expect(fileEntry.data.toString()).toBe(exampleData);
        expect(fileEntry.etag).toBe("123abc");
        expect(fileEntry.data.byteLength).toBe(exampleData.length);
        expect(_updateResourceInEditorMock).toHaveBeenCalledWith(testUris.file);
    });
});

describe("readFile", () => {
    const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile");
    const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");

    it("throws an error when trying to read a file that doesn't have a profile registered", async () => {
        lookupAsFileMock.mockResolvedValueOnce(testEntries.file);
        getInfoFromUriMock.mockReturnValueOnce({
            profile: null,
            path: "/aFile.txt",
        });

        try {
            await UssFSProvider.instance.readFile(testUris.file);
            fail("readFile should fail when trying to read a file with an unregistered profile");
        } catch (err) {
            expect(err).toBeDefined();
            expect(err).toBeInstanceOf(FileSystemError);
            expect(err.message).toBe("file not found");
        }
    });

    it("returns data for a file", async () => {
        lookupAsFileMock.mockResolvedValueOnce(testEntries.file);
        getInfoFromUriMock.mockReturnValueOnce({
            profile: testProfile,
            path: "/aFile.txt",
        });
        const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(undefined);
        expect((await UssFSProvider.instance.readFile(testUris.file)).toString()).toStrictEqual([1, 2, 3].toString());
        fetchFileAtUriMock.mockRestore();
    });

    it("returns conflict data for a file with the conflict query parameter", async () => {
        lookupAsFileMock.mockResolvedValueOnce(testEntries.file);
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

xdescribe("writeFile", () => {});

xdescribe("rename", () => {});

describe("delete", () => {
    it("successfully deletes an entry", async () => {
        testEntries.session.entries.set("aFile.txt", testEntries.file);
        testEntries.session.size = 1;
        const getDelInfoMock = jest.spyOn((BaseProvider as any).prototype, "_getDeleteInfo").mockReturnValueOnce({
            entryToDelete: testEntries.file,
            parent: testEntries.session,
            parentUri: Uri.from({ scheme: "zowe-uss", path: "/sestest" }),
        });
        const deleteMock = jest.fn().mockResolvedValueOnce(undefined);
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            delete: deleteMock,
        } as any);
        expect(await UssFSProvider.instance.delete(testUris.file, { recursive: false })).toBe(undefined);
        expect(getDelInfoMock).toHaveBeenCalledWith(testUris.file);
        expect(deleteMock).toHaveBeenCalledWith(testUris.file.path, false);
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
            parentUri: Uri.from({ scheme: "zowe-uss", path: "/sestest" }),
        });
        const errorMsgMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        const deleteMock = jest.fn().mockRejectedValueOnce(new Error("insufficient permissions"));
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
            delete: deleteMock,
        } as any);
        await UssFSProvider.instance.delete(testUris.file, { recursive: false });
        expect(getDelInfoMock).toHaveBeenCalledWith(testUris.file);
        expect(deleteMock).toHaveBeenCalledWith(testUris.file.path, false);
        expect(errorMsgMock).toHaveBeenCalledWith("Deleting /sestest/aFile.txt failed due to API error: insufficient permissions");
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
            type: UssFileType.File,
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
    describe("copying a file tree - same profile", () => {
        it("with naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/bFile.txt",
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
                { tree: { type: UssFileType.File } }
            );
            expect(mockUssApi.copy).toHaveBeenCalledWith("/bFile (1).txt", {
                from: "/bFile.txt",
                recursive: false,
                overwrite: true,
            });
        });

        xit("without naming collisions", async () => {
            const getInfoFromUri = jest
                .spyOn((UssFSProvider as any).prototype, "_getInfoFromUri")
                // destination info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/",
                })
                // source info
                .mockReturnValueOnce({
                    profile: testProfile,
                    path: "/cFile.txt",
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
                { tree: { type: UssFileType.File } }
            );
            expect(mockUssApi.copy).toHaveBeenCalledWith("/cFile.txt", {
                from: "/bFile.txt",
                recursive: false,
                overwrite: true,
            });
        });
    });
});

describe("createDirectory", () => {
    it("creates a session directory with the given URI", () => {
        const root = (UssFSProvider.instance as any).root;
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
    it("returns the correct info for a given URI when ProfilesCache is not available", () => {
        expect((UssFSProvider.instance as any)._getInfoFromUri(testUris.file)).toStrictEqual({
            profile: null,
            path: "/aFile.txt",
        });
    });
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
