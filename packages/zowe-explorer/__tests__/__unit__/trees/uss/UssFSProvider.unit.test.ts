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

import { Disposable, FilePermission, FileSystemError, FileType, TextEditor, Uri, workspace } from "vscode";
import {
    AuthHandler,
    BaseProvider,
    DirEntry,
    FileEntry,
    FsAbstractUtils,
    Gui,
    UssDirectory,
    UssFile,
    ZoweExplorerApiType,
    ZoweScheme,
    imperative,
    ZoweVsCodeExtension,
    FeatureFlags,
} from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/configuration/Profiles";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { USSFileStructure } from "../../../../src/trees/uss/USSFileStructure";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import * as vscode from "vscode";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";

const testProfile = createIProfile();

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    conflictFile: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFile.txt", query: "conflict=true" }),
    file: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFile.txt" }),
    folder: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFolder" }),
    innerFile: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFolder/innerFile.txt" }),
    session: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest" }),
};

const fileEntry = new UssFile("aFile.txt");
fileEntry.conflictData = {
    contents: new Uint8Array([4, 5, 6]),
    etag: undefined,
    size: 3,
};
fileEntry.data = new Uint8Array([1, 2, 3]);
fileEntry.etag = "A123SEEMINGLY456RANDOM789ETAG";
fileEntry.metadata = {
    profile: testProfile,
    path: "/aFile.txt",
};
fileEntry.mtime = 0;
fileEntry.type = FileType.File;
fileEntry.wasAccessed = true;

const testEntries = {
    file: fileEntry,
    innerFile: new UssFile("innerFile.txt"),
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
describe("UssFSProvider", () => {
    let mockedProperty: MockedProperty;
    beforeEach(() => {
        mockedProperty = new MockedProperty(Profiles, "getInstance", {
            value: jest.fn().mockReturnValue({
                loadNamedProfile: jest.fn().mockReturnValue(testProfile),
                allProfiles: [],
                getProfileFromConfig: jest.fn(),
            } as any),
        });
        jest.spyOn(ProfilesUtils, "awaitExtenderType").mockImplementation();
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
        });
    });

    afterAll(() => {
        mockedProperty[Symbol.dispose]();
    });

    describe("stat", () => {
        let lookupMock: jest.SpyInstance;
        beforeEach(() => {
            lookupMock = jest.spyOn((UssFSProvider as any).prototype, "lookup");
            jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
                getCommonApi: () => ({
                    getSession: () => createISession(),
                }),
            } as any);
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("returns a file entry", async () => {
            const unaccessedFile = new UssFile(testEntries.file.name);
            Object.assign(unaccessedFile, testEntries.file, { wasAccessed: false });

            lookupMock.mockReturnValue(unaccessedFile);

            const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValueOnce({
                success: true,
                apiResponse: {
                    items: [{ name: testEntries.file.name }],
                },
                commandResponse: "",
            });
            const statUri = testUris.file.with({ query: "fetch=true" });
            const result = (await UssFSProvider.instance.stat(statUri)) as any;
            expect(result.name).toBe(testEntries.file.name);
            expect(result.wasAccessed).toBe(false);
            expect(result.type).toBe(FileType.File);

            expect(lookupMock).toHaveBeenCalledWith(statUri, true);
            expect(listFilesMock).toHaveBeenCalled();
        });

        it("updates a file entry with new modification time and resets wasAccessed flag", async () => {
            const fakeFile = new UssFile(testEntries.file.name);
            Object.assign(fakeFile, testEntries.file);

            lookupMock.mockReturnValue(fakeFile);
            const newMtime = Date.now();
            const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValueOnce({
                success: true,
                apiResponse: {
                    items: [{ name: fakeFile.name, mtime: newMtime }],
                },
                commandResponse: "",
            });

            const statUri = testUris.file.with({ query: "fetch=true" });
            await expect(UssFSProvider.instance.stat(statUri)).resolves.toStrictEqual(fakeFile);
            // fetchEntries uses lookup(uri, true) internally
            expect(lookupMock).toHaveBeenCalledWith(statUri, true);
            expect(fakeFile.mtime).toBe(newMtime);
            expect(fakeFile.wasAccessed).toBe(false);
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
        it("returns a file as-is when query has inDiff parameter", async () => {
            lookupMock.mockReturnValueOnce(testEntries.file);
            const statUri = testUris.file.with({ query: "inDiff=true" });
            await expect(UssFSProvider.instance.stat(statUri)).resolves.toStrictEqual(testEntries.file);
            expect(lookupMock).toHaveBeenCalledWith(statUri, false);
        });

        it("looks up the resource before loading profile which may fail", async () => {
            const lookupMock = jest.spyOn((UssFSProvider as any).prototype, "lookup").mockReturnValueOnce(testEntries.file);
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockImplementationOnce(() => {
                throw new Error("invalid profile");
            });
            await expect(UssFSProvider.instance.stat(testUris.file)).rejects.toThrow("invalid profile");
            expect(lookupMock).toHaveBeenCalledWith(testUris.file, false);
        });

        describe("request caching", () => {
            let statSpy: jest.SpyInstance;

            beforeEach(() => {
                jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValue(testEntries.file);
                jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                    isRoot: false,
                    slashAfterProfilePos: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFile1.txt" }).path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testEntries.file.metadata.profile,
                });
                statSpy = jest.spyOn(UssFSProvider.instance as any, "statImplementation");
                (UssFSProvider.instance as any).requestCache.clear();
            });
            afterEach(() => {
                jest.restoreAllMocks();
            });
            it("should handle subsequent identical FS calls - should return the promise of the original request", async () => {
                const testUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file22.txt", query: "fetch=true" });

                const call1 = UssFSProvider.instance.stat(testUri);
                const call2 = UssFSProvider.instance.stat(testUri);
                let [callResult1, callResult2] = await Promise.all([call1, call2]);

                expect(statSpy).toHaveBeenCalledWith(testUri);
                expect(callResult1).toStrictEqual(callResult2);
            });

            it("should handle subsequent identical FS calls - 100 calls - should return the promise of the original request", async () => {
                const testUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file33.txt", query: "fetch=true" });

                statSpy.mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 100 });

                const promises = Array.from({ length: 100 }, () => UssFSProvider.instance.stat(testUri));
                const results = await Promise.all(promises);

                expect(statSpy).toHaveBeenCalledWith(testUri);

                const firstResult = results[0];
                results.forEach((result) => {
                    expect(result).toStrictEqual(firstResult);
                });
            });

            it("should handle subsequent FS calls - ignore falsy flags - should return the promise of the original request", async () => {
                const testUriFetchFalse = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file44.txt", query: "fetch=false" });
                const testUriNoQuery = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file44.txt" });

                const call1 = UssFSProvider.instance.stat(testUriFetchFalse);
                const call2 = UssFSProvider.instance.stat(testUriNoQuery);
                let [callResult1, callResult2] = await Promise.all([call1, call2]);

                expect(statSpy).toHaveBeenCalledWith(testUriFetchFalse);
                expect(callResult1).toStrictEqual(callResult2);
            });

            it("should handle subsequent FS calls - trailing slash - should return the promise of the original request", async () => {
                const testUriTrailingSlash = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/dir5/" });
                const testUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/dir5" });

                const call1 = UssFSProvider.instance.stat(testUriTrailingSlash);
                const call2 = UssFSProvider.instance.stat(testUri);
                let [callResult1, callResult2] = await Promise.all([call1, call2]);

                expect(statSpy).toHaveBeenCalledWith(testUriTrailingSlash);
                expect(callResult1).toStrictEqual(callResult2);
            });
            it("should handle subsequent FS calls - different query parameters - should trigger distinct requests", async () => {
                const pathStr = "/sestest/usr/test/file_diff_params.txt";
                const fetchUri = Uri.from({ scheme: ZoweScheme.USS, path: pathStr, query: "fetch=true" });
                const conflictUri = Uri.from({ scheme: ZoweScheme.USS, path: pathStr, query: "conflict=true" });

                const fetchEntry = new UssFile("file_diff_params.txt");
                fetchEntry.metadata = { ...testEntries.file.metadata, path: "/usr/test/file_diff_params.txt" };
                fetchEntry.size = 111;
                const remoteSpy = jest.spyOn(UssFSProvider.instance, "remoteLookupForResource").mockResolvedValue(fetchEntry);

                const conflictEntry = new UssFile("file_diff_params.txt");
                conflictEntry.metadata = { ...testEntries.file.metadata, path: "/usr/test/file_diff_params.txt" };
                conflictEntry.size = 999;
                lookupMock.mockReturnValue(conflictEntry);

                const statSpy = jest.spyOn(UssFSProvider.instance as any, "statImplementation");
                statSpy.mockRestore();

                const [res1, res2] = await Promise.all([UssFSProvider.instance.stat(fetchUri), UssFSProvider.instance.stat(conflictUri)]);

                expect(remoteSpy).toHaveBeenCalledWith(fetchUri);
                expect(lookupMock).toHaveBeenCalledWith(conflictUri, false);

                expect((res1 as any).size).toBe(111);
                expect((res2 as any).size).toBe(999);
                expect(res1).not.toStrictEqual(res2);

                remoteSpy.mockRestore();
            });

            it("should handle subsequent FS calls - distinct files in same directory - should trigger distinct requests", async () => {
                const testUriFile1 = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file123.txt", query: "fetch=true" });
                const testUriFile2 = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/file234.txt", query: "fetch=true" });

                statSpy
                    .mockImplementationOnce(async (uri) => {
                        return uri.path.endsWith("file123.txt") ? { type: 1, size: 100 } : { type: 1, size: 200 };
                    })
                    .mockImplementationOnce(async (uri) => {
                        return uri.path.endsWith("file123.txt") ? { type: 1, size: 100 } : { type: 1, size: 200 };
                    });

                const call1 = UssFSProvider.instance.stat(testUriFile1);
                const call2 = UssFSProvider.instance.stat(testUriFile2);

                let [callResult1, callResult2] = await Promise.all([call1, call2]);

                expect(statSpy).toHaveBeenCalledWith(testUriFile1);
                expect(statSpy).toHaveBeenCalledWith(testUriFile2);
                expect(callResult1).not.toStrictEqual(callResult2);
                expect((callResult1 as any).size).toBe(100);
                expect((callResult2 as any).size).toBe(200);
            });
        });

        it("reuses parent directory fetch for child file request", async () => {
            const childUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/aFolder/childFile.txt", query: "fetch=true" });
            const parentPath = "/sestest/aFolder";

            const cacheHasSpy = jest.spyOn((UssFSProvider.instance as any).requestCache, "has");

            const dummyParent = new UssFile("dummy");
            dummyParent.metadata = {
                path: parentPath,
                profile: testEntries.file.metadata.profile,
            };
            const parentPromise = Promise.resolve(dummyParent);

            cacheHasSpy.mockImplementation((key) => {
                if (typeof key === "string" && key.includes(parentPath)) {
                    return true;
                }
                return false;
            });

            const cacheGetSpy = jest.spyOn((UssFSProvider.instance as any).requestCache, "get").mockReturnValue(parentPromise);

            const childEntry = new UssFile("childFile.txt");
            childEntry.metadata = { path: "/sestest/aFolder/childFile.txt", profile: testEntries.file.metadata.profile };
            lookupMock.mockReturnValue(childEntry);

            const statSpy = jest.spyOn(UssFSProvider.instance as any, "statImplementation");

            const result = await UssFSProvider.instance.stat(childUri);

            expect(cacheHasSpy).toHaveBeenCalledWith(expect.stringContaining(parentPath));
            expect(statSpy).not.toHaveBeenCalled();
            expect(result).toBe(childEntry);

            statSpy.mockRestore();
            cacheHasSpy.mockRestore();
            cacheGetSpy.mockRestore();
        });

        it("should make a system call if fetchByDefault is enabled and the entry is not in the cache", async () => {
            jest.spyOn(FeatureFlags, "get").mockReturnValue(true);

            const fetchUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/usr/test/newfileFetchBD.txt" });
            const mockFile = {
                ...testEntries.file,
                metadata: {
                    ...testEntries.file.metadata,
                    path: "/usr/test/newfileFetchBD.txt",
                },
            };
            const remoteLookupForResourceSpy = jest.spyOn(UssFSProvider.instance, "remoteLookupForResource").mockResolvedValue(mockFile);

            const cacheResourceSpy = jest.spyOn(UssFSProvider.instance as any, "lookupWithCache");
            const lookupSpy = jest.spyOn(UssFSProvider.instance, "lookup");

            await UssFSProvider.instance.stat(fetchUri);

            expect(cacheResourceSpy).toHaveBeenCalledWith(fetchUri);
            expect(lookupSpy).toHaveBeenCalledWith(fetchUri);
            expect(remoteLookupForResourceSpy).toHaveBeenCalledWith(fetchUri);
        });
    });

    describe("move", () => {
        it("returns true if it successfully moved a valid, old URI to the new URI", async () => {
            const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");
            const newUri = testUris.file.with({ path: "/sestest/aFile2.txt" });
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
            const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");
            const newUri = testUris.file.with({ path: "/sestest/aFile2.txt" });
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
        it("throws an error if the API request failed", async () => {
            const getInfoFromUriMock = jest.spyOn((UssFSProvider as any).prototype, "_getInfoFromUri");
            const newUri = testUris.file.with({ path: "/sestest/aFile2.txt" });
            getInfoFromUriMock.mockReturnValueOnce({
                // info for new URI
                path: "/aFile2.txt",
                profile: testProfile,
            });
            const move = jest.fn().mockRejectedValue(new Error("error during move"));
            const handleErrorMock = jest.spyOn(UssFSProvider.instance as any, "_handleError").mockImplementation();
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({ move } as any);
            await expect(UssFSProvider.instance.move(testUris.file, newUri)).rejects.toThrow();
            expect(handleErrorMock).toHaveBeenCalled();
            handleErrorMock.mockRestore();
        });
    });

    describe("listFiles", () => {
        it("removes '.', '..', and '...' from IZosFilesResponse items when successful", async () => {
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
                fileList: jest.fn().mockResolvedValueOnce({
                    success: true,
                    commandResponse: "",
                    apiResponse: {
                        items: [
                            { name: ".", mode: "drwxrwxrwx" },
                            { name: "..", mode: "drwxrwxrwx" },
                            { name: "...", mode: "drwxrwxrwx" },
                            { name: "test.txt", mode: "-rwxrwxrwx" },
                        ],
                    },
                }),
            } as any);
            expect(await UssFSProvider.instance.listFiles(testProfile, testUris.folder)).toStrictEqual({
                success: true,
                commandResponse: "",
                apiResponse: {
                    items: [{ name: "test.txt", mode: "-rwxrwxrwx" }],
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
        it("returns an unsuccessful response if an error occurred", async () => {
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
                fileList: jest.fn().mockRejectedValue(new Error("error listing files")),
            } as any);
            await expect(UssFSProvider.instance.listFiles(testProfile, testUris.folder)).rejects.toThrow();
        });
    });

    describe("fetchEntries", () => {
        describe("file", () => {
            it("existing URI", async () => {
                const existsMock = jest.spyOn(UssFSProvider.instance, "exists").mockReturnValue(true);
                const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValue(testEntries.file);
                const listFilesSpy = jest.spyOn(UssFSProvider.instance, "listFiles");
                await expect(
                    (UssFSProvider.instance as any).fetchEntries(testUris.file, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.file.path.indexOf("/", 1),
                        profile: testProfile,
                        profileName: testProfile.name,
                    })
                ).resolves.toBe(testEntries.file);
                expect(existsMock).toHaveBeenCalledWith(testUris.file);
                expect(lookupMock).toHaveBeenCalledWith(testUris.file, true);
                expect(listFilesSpy).not.toHaveBeenCalled();
                existsMock.mockRestore();
                lookupMock.mockRestore();
            });
            it("non-existent URI", async () => {
                const existsMock = jest.spyOn(UssFSProvider.instance, "exists").mockReturnValueOnce(false);
                const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValueOnce(null);
                const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValue({
                    success: true,
                    apiResponse: {
                        items: [{ name: testEntries.innerFile.name, mode: "-rwxrwxrwx" }],
                    },
                    commandResponse: "",
                });
                const lookupParentDirMock = jest
                    .spyOn(UssFSProvider.instance as any, "lookupParentDirectory")
                    .mockReturnValueOnce(null)
                    .mockReturnValueOnce({ ...testEntries.folder, entries: new Map() });
                const createDirMock = jest.spyOn(workspace.fs, "createDirectory").mockImplementation();
                await expect(
                    (UssFSProvider.instance as any).fetchEntries(testUris.innerFile, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.innerFile.path.indexOf("/", 1),
                        profile: testProfile,
                        profileName: testProfile.name,
                    })
                ).resolves.not.toThrow();
                expect(existsMock).toHaveBeenCalledWith(testUris.innerFile);
                expect(lookupMock).toHaveBeenCalledWith(testUris.innerFile, true);
                expect(listFilesMock).toHaveBeenCalled();
                existsMock.mockRestore();
                lookupMock.mockRestore();
                listFilesMock.mockRestore();
                lookupParentDirMock.mockRestore();
                createDirMock.mockRestore();
            });
        });
        describe("folder", () => {
            it("existing URI", async () => {
                const fakeFolder = Object.assign(Object.create(Object.getPrototypeOf(testEntries.folder)), testEntries.folder);
                fakeFolder.entries = new Map();
                const existsMock = jest.spyOn(UssFSProvider.instance, "exists").mockReturnValue(true);
                const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValue(fakeFolder);
                const listFilesMock = jest.spyOn(UssFSProvider.instance, "listFiles").mockResolvedValue({
                    success: true,
                    apiResponse: {
                        items: [{ name: testEntries.file.name }],
                    },
                    commandResponse: "",
                });
                await expect(
                    (UssFSProvider.instance as any).fetchEntries(testUris.folder, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.folder.path.indexOf("/", 1),
                        profile: testProfile,
                        profileName: testProfile.name,
                    })
                ).resolves.toBe(fakeFolder);
                expect(existsMock).toHaveBeenCalledWith(testUris.folder);
                expect(lookupMock).toHaveBeenCalledWith(testUris.folder, true);
                expect(listFilesMock).toHaveBeenCalledTimes(1);
                existsMock.mockRestore();
                lookupMock.mockRestore();
                listFilesMock.mockRestore();
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
        let mockedProfilesProp: MockedProperty;
        beforeAll(() => {
            mockedProfilesProp = new MockedProperty(
                Profiles,
                "getInstance",
                undefined,
                jest.fn().mockReturnValue({
                    loadNamedProfile: jest.fn(() => {
                        return testProfile;
                    }),
                })
            );
        });
        afterAll(() => {
            mockedProfilesProp[Symbol.dispose]();
        });
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
        it("returns early if it failed to fetch contents", async () => {
            const fileEntry = { ...testEntries.file };
            const _fireSoonSpy = jest.spyOn((UssFSProvider as any).prototype, "_fireSoon");
            const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
            const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValueOnce(undefined);
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
                getContents: jest.fn().mockRejectedValue(new Error("error retrieving contents")),
            } as any);

            await UssFSProvider.instance.fetchFileAtUri(testUris.file);
            expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
            expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
            expect(_fireSoonSpy).not.toHaveBeenCalled();
            autoDetectEncodingMock.mockRestore();
        });
        it("calls getContents to get the data for a file entry with encoding", async () => {
            const fileEntry = { ...testEntries.file };
            const lookupAsFileMock = jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
            const exampleData = "hello world!";
            const getContentsMock = jest.fn().mockImplementationOnce((filePath, opts) => {
                opts.stream.write(exampleData);
                return {
                    apiResponse: {
                        etag: "123abc",
                    },
                };
            });
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi")
                .mockReturnValueOnce({
                    getTag: jest.fn().mockResolvedValueOnce("binary"),
                } as any)
                .mockReturnValueOnce({ getContents: getContentsMock } as any);

            await UssFSProvider.instance.fetchFileAtUri(testUris.file);

            expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
            expect(fileEntry.data?.toString()).toBe(exampleData);
            expect(fileEntry.encoding).toEqual({ kind: "binary" });
            expect(getContentsMock).toHaveBeenCalledWith("/aFile.txt", expect.objectContaining({ binary: true }));
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

            const _updateResourceInEditorMock = jest
                .spyOn((UssFSProvider as any).prototype, "_updateResourceInEditor")
                .mockResolvedValueOnce(undefined);
            await UssFSProvider.instance.fetchFileAtUri(testUris.file, { editor: {} as TextEditor });

            expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.file);
            expect(autoDetectEncodingMock).toHaveBeenCalledWith(fileEntry);
            expect(fileEntry.data?.toString()).toBe(exampleData);
            expect(fileEntry.etag).toBe("123abc");
            expect(fileEntry.data?.byteLength).toBe(exampleData.length);
            expect(_updateResourceInEditorMock).toHaveBeenCalledWith(testUris.file);
            autoDetectEncodingMock.mockRestore();
        });
        it("returns null when an error that is not 401 is encountered", async () => {
            const fileEntry = { ...testEntries.file };
            jest.spyOn((UssFSProvider as any).prototype, "_lookupAsFile").mockReturnValueOnce(fileEntry);
            const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockImplementation();
            const error404 = new imperative.ImperativeError({
                msg: "Username or password are not valid or expired",
                errorCode: `${imperative.RestConstants.HTTP_STATUS_404}`,
            });
            const loggerErrorSpy = jest.spyOn(ZoweLogger, "error");
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
                getContents: jest.fn().mockRejectedValue(error404),
            } as any);

            const result = await UssFSProvider.instance.fetchFileAtUri(testUris.file);

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                "[UssFSProvider] fetchFileAtUri failed due to an error. Details: \nUsername or password are not valid or expired"
            );
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
            jest.spyOn(AuthHandler, "lockProfile").mockImplementation();
            jest.spyOn(AuthHandler, "unlockProfile").mockImplementation();
            mockUssApi = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue({
                getTag: getTagMock.mockClear(),
            } as any);
        });

        it("throws error if getTag call fails", async () => {
            getTagMock.mockRejectedValueOnce(new Error("error fetching tag"));
            const testEntry = new UssFile("testFile");
            testEntry.metadata = {
                path: "/testFile",
                profile: testProfile,
            };
            await expect(UssFSProvider.instance.autoDetectEncoding(testEntry)).rejects.toThrow();
            expect(getTagMock).toHaveBeenCalledTimes(1);
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
        const getInfoFromUriMock = jest.spyOn(UssFSProvider.instance as any, "_getInfoFromUri");

        it("throws an error when trying to read a file that doesn't have a profile registered", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
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

        it("throws an error if an error was encountered during lookup and the code is not FileNotFound", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile").mockImplementation((uri) => {
                throw FileSystemError.FileIsADirectory(uri as Uri);
            });
            let err;
            try {
                await UssFSProvider.instance.readFile(testUris.file);
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileIsADirectory");
            }
            expect(err).toBeDefined();
            lookupAsFileMock.mockRestore();
        });

        it("throws an error if an error was encountered during lookup and parent dir exists", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile").mockImplementationOnce((uri) => {
                throw FileSystemError.FileNotFound(uri as Uri);
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(testEntries.folder);

            let err;
            try {
                await UssFSProvider.instance.readFile(testUris.innerFile);
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileNotFound");
            }
            expect(err).toBeDefined();
            lookupAsFileMock.mockRestore();
            lookupParentDirMock.mockRestore();
        });

        it("throws an error if an error was encountered during lookup and parent dir doesn't exist, but URI is a directory", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile").mockImplementationOnce((uri) => {
                throw FileSystemError.FileNotFound(uri as Uri);
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(null);
            const remoteLookupForResource = jest
                .spyOn(UssFSProvider.instance, "remoteLookupForResource")
                .mockResolvedValueOnce(testEntries.folder as any);

            let err;
            try {
                await UssFSProvider.instance.readFile(testUris.innerFile);
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileIsADirectory");
            }
            expect(err).toBeDefined();
            lookupAsFileMock.mockRestore();
            lookupParentDirMock.mockRestore();
            remoteLookupForResource.mockRestore();
        });

        it("returns data for a file", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
            lookupAsFileMock.mockReturnValue({ ...testEntries.file, wasAccessed: true });
            getInfoFromUriMock.mockReturnValueOnce({
                profile: testProfile,
                path: "/aFile.txt",
            });
            const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(undefined);
            expect((await UssFSProvider.instance.readFile(testUris.file)).toString()).toStrictEqual([1, 2, 3].toString());
            fetchFileAtUriMock.mockRestore();
            lookupAsFileMock.mockRestore();
        });

        it("returns conflict data for a file with the conflict query parameter", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
            lookupAsFileMock.mockReturnValue(testEntries.file);
            getInfoFromUriMock.mockReturnValue({
                profile: testProfile,
                path: "/aFile.txt",
            });
            const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(testEntries.file);

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
            lookupAsFileMock.mockRestore();
            getInfoFromUriMock.mockRestore();
        });

        it("should properly await the profile deferred promise - existing promise", async () => {
            const mockAllProfiles = [
                { name: "sestest", type: "ssh" },
                { name: "profile1", type: "zosmf" },
                { name: "profile2", type: "zosmf" },
            ];

            // Create a mock instance of Profiles
            const mockProfilesInstance = {
                allProfiles: mockAllProfiles,
            };

            // Mock Profiles.getInstance to return the mock instance
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce(mockProfilesInstance as any);

            const resolveProfile = jest.fn();
            const profilePromise = {
                promise: new Promise<void>((resolve) => {
                    resolveProfile.mockImplementation(resolve);
                    setTimeout(resolve, 50);
                }),
            };

            ProfilesUtils.extenderProfileReady.set(testProfile.name || "mockProfile", profilePromise as any);

            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
            lookupAsFileMock.mockReturnValue(testEntries.file);

            getInfoFromUriMock.mockReturnValue({
                profile: testProfile,
                path: "/aFile.txt",
            });
            jest.spyOn(UssFSProvider.instance as any, "fetchFileAtUri").mockReturnValueOnce(testEntries.file);

            const shortTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for profile")), 100));

            await UssFSProvider.instance.readFile(
                testUris.file.with({
                    query: "conflict=true",
                })
            );

            await expect(Promise.race([profilePromise.promise, shortTimeout])).resolves.toBeUndefined();
        });

        it("should properly await the profile deferred promise - no existing promise", async () => {
            jest.spyOn(ProfilesUtils.extenderProfileReady, "get").mockReturnValueOnce(undefined);
            const mockAllProfiles = [
                { name: "sestest", type: "ssh" },
                { name: "profile1", type: "zosmf" },
                { name: "profile2", type: "zosmf" },
            ];

            // Create a mock instance of Profiles
            const mockProfilesInstance = {
                allProfiles: mockAllProfiles,
            };

            // Mock Profiles.getInstance to return the mock instance
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce(mockProfilesInstance as any);

            const resolveProfile = jest.fn();
            const profilePromise = {
                mStatus: "pending",
                resolve: jest.fn(),
                reject: jest.fn(),
                status: "pending",
                promise: new Promise<void>((resolve) => {
                    resolveProfile.mockImplementation(resolve);
                    setTimeout(resolve, 50);
                }),
            };
            jest.spyOn(ProfilesUtils.extenderProfileReady, "get").mockReturnValueOnce(profilePromise as any);
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
            lookupAsFileMock.mockReturnValue(testEntries.file);

            getInfoFromUriMock.mockReturnValue({
                profile: testProfile,
                path: "/aFile.txt",
            });
            jest.spyOn(UssFSProvider.instance as any, "fetchFileAtUri").mockReturnValueOnce(testEntries.file);

            const shortTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for profile")), 100));

            await UssFSProvider.instance.readFile(
                testUris.file.with({
                    query: "conflict=true",
                })
            );

            await expect(Promise.race([profilePromise.promise, shortTimeout])).resolves.toBeUndefined();
        });

        it("throws FileNotFound error when fetchFileAtUri returns null", async () => {
            const lookupAsFileMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile");
            lookupAsFileMock.mockReturnValue({ ...testEntries.file, wasAccessed: false });
            getInfoFromUriMock.mockReturnValue({
                profile: testProfile,
                path: "/aFile.txt",
            });
            const fetchFileAtUriMock = jest.spyOn(UssFSProvider.instance, "fetchFileAtUri").mockResolvedValueOnce(null);

            let err;
            try {
                await UssFSProvider.instance.readFile(testUris.file);
            } catch (error) {
                err = error;
                expect(err).toBeInstanceOf(FileSystemError);
                expect((err as FileSystemError).code).toBe("FileNotFound");
            }
            expect(err).toBeDefined();
            expect(fetchFileAtUriMock).toHaveBeenCalled();
            fetchFileAtUriMock.mockRestore();
            lookupAsFileMock.mockRestore();
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
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

        it("throws an error when an unknown API error occurs", async () => {
            const mockUssApi = {
                uploadFromBuffer: jest.fn().mockRejectedValueOnce(new Error("Rest API failure")),
            };
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
            const folder = {
                ...testEntries.folder,
                entries: new Map([[testEntries.file.name, { ...testEntries.file }]]),
            };
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
            const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValue(undefined);
            const newContents = new Uint8Array([3, 6, 9]);
            const handleConflictMock = jest.spyOn(UssFSProvider.instance as any, "_handleConflict").mockImplementation();
            const _handleErrorMock = jest.spyOn(UssFSProvider.instance as any, "_handleError").mockImplementation();
            await expect(UssFSProvider.instance.writeFile(testUris.file, newContents, { create: false, overwrite: true })).rejects.toThrow();

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.file);
            expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving USS file...");
            expect(mockUssApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.file.metadata.path, {
                binary: false,
                encoding: undefined,
                etag: testEntries.file.etag,
                returnEtag: true,
            });
            expect(handleConflictMock).not.toHaveBeenCalled();
            expect(_handleErrorMock).toHaveBeenCalled();
            handleConflictMock.mockRestore();
            _handleErrorMock.mockRestore();
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(folder);
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
            const emptyFolder = {
                ...testEntries.folder,
                entries: new Map(),
                metadata: { ...testEntries.folder.metadata },
            };
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(emptyFolder);

            let err;
            try {
                await UssFSProvider.instance.writeFile(testUris.file, new Uint8Array([]), { create: false, overwrite: true });
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileNotFound");
            }
            expect(err).toBeDefined();
            lookupParentDirMock.mockRestore();
        });

        it("throws an error if entry exists and 'overwrite' option is false", async () => {
            const rootFolder = {
                ...testEntries.session,
                entries: new Map([[testEntries.file.name, { ...testEntries.file, wasAccessed: false }]]),
            };
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(rootFolder);
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
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(rootFolder);
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
            const parentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(fakeSession);
            expect(UssFSProvider.instance.makeEmptyFileWithEncoding(testUris.file, { kind: "binary" }));
            expect(fakeSession.entries.has(testEntries.file.name)).toBe(true);
            parentDirMock.mockRestore();
        });
    });

    describe("rename", () => {
        it("renames a file entry in the FSP and remote system", async () => {
            const mockUssApi = {
                rename: jest.fn(),
            };
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            const fileEntry = { ...testEntries.file, metadata: { ...testEntries.file.metadata } };
            const sessionEntry = {
                ...testEntries.session,
                entries: new Map([[testEntries.file.name, fileEntry]]),
            };
            (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);
            const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockImplementation((uri: any) => {
                return sessionEntry.entries.get("aFile.txt");
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);

            await UssFSProvider.instance.rename(testUris.file, testUris.file.with({ path: "/sestest/aFile2.txt" }), { overwrite: true });
            expect(mockUssApi.rename).toHaveBeenCalledWith("/aFile.txt", "/aFile2.txt");
            expect(fileEntry.metadata.path).toBe("/aFile2.txt");
            expect(sessionEntry.entries.has("aFile2.txt")).toBe(true);

            lookupMock.mockRestore();
            lookupParentDirMock.mockRestore();
            ussApiMock.mockRestore();
        });

        it("renames a folder entry in the FSP and remote system, updating child paths", async () => {
            const mockUssApi = {
                rename: jest.fn(),
            };
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            const folderEntry = { ...testEntries.folder, metadata: { ...testEntries.folder.metadata } };
            const sessionEntry = {
                ...testEntries.session,
                entries: new Map([[testEntries.folder.name, folderEntry]]),
            };
            (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);
            const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockImplementation((uri: any) => {
                return sessionEntry.entries.get("aFolder");
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
            const updChildPathsMock = jest.spyOn(UssFSProvider.instance as any, "_updateChildPaths").mockResolvedValueOnce(undefined);

            await UssFSProvider.instance.rename(testUris.folder, testUris.folder.with({ path: "/sestest/aFolder2" }), { overwrite: true });
            expect(mockUssApi.rename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
            expect(folderEntry.metadata.path).toBe("/aFolder2");
            expect(sessionEntry.entries.has("aFolder2")).toBe(true);
            expect(updChildPathsMock).toHaveBeenCalledWith(folderEntry);

            lookupMock.mockRestore();
            lookupParentDirMock.mockRestore();
            ussApiMock.mockRestore();
            updChildPathsMock.mockRestore();
        });

        it("displays an error message when renaming fails on the remote system", async () => {
            const mockUssApi = {
                rename: jest.fn().mockRejectedValueOnce(new Error("could not upload file")),
            };
            const errMsgSpy = jest.spyOn(Gui, "errorMessage");
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(mockUssApi as any);
            const folderEntry = { ...testEntries.folder, metadata: { ...testEntries.folder.metadata } };
            const sessionEntry = {
                ...testEntries.session,
                entries: new Map([[testEntries.folder.name, folderEntry]]),
            };
            (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);
            const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockImplementation((uri: any) => {
                return sessionEntry.entries.get("aFolder");
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);

            await expect(
                UssFSProvider.instance.rename(testUris.folder, testUris.folder.with({ path: "/sestest/aFolder2" }), { overwrite: true })
            ).rejects.toThrow();
            expect(mockUssApi.rename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
            expect(folderEntry.metadata.path).toBe("/aFolder");
            expect(sessionEntry.entries.has("aFolder2")).toBe(false);
            expect(errMsgSpy).toHaveBeenCalledWith("Failed to rename /aFolder: could not upload file", {
                items: ["Retry", "Show log", "Troubleshoot"],
            });

            lookupMock.mockRestore();
            lookupParentDirMock.mockRestore();
            ussApiMock.mockRestore();
        });

        it("retries rename if FileExists error and listFiles throws 404", async () => {
            const fileExistsError = Object.assign(vscode.FileSystemError.FileExists("file exists"), { code: "FileExists" });

            const mockUssApiRename = jest.fn().mockRejectedValueOnce(fileExistsError).mockResolvedValueOnce({ success: true });

            const mockUssApi = { rename: mockUssApiRename };
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(mockUssApi as any);

            const folderEntry = {
                ...testEntries.folder,
                entries: new Map(),
                metadata: { ...testEntries.folder.metadata },
            };

            const sessionEntry = {
                ...testEntries.session,
                entries: new Map([[testEntries.folder.name, folderEntry]]),
            };
            (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);

            const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockImplementation((uri: any) => {
                return sessionEntry.entries.get("aFolder");
            });
            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);

            const listFilesMock = jest.spyOn(UssFSProvider.instance as any, "listFiles").mockRejectedValue({
                name: "Error",
                errorCode: 404,
            });

            const oldUri = testUris.folder;
            const newUri = testUris.folder.with({ path: "/sestest/aFolder2" });

            await UssFSProvider.instance.rename(oldUri, newUri, { overwrite: true });

            expect(mockUssApiRename).toHaveBeenCalledTimes(2);
            expect(mockUssApiRename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
            expect(sessionEntry.entries.has("aFolder")).toBe(false);
            expect(sessionEntry.entries.has("aFolder2")).toBe(true);

            listFilesMock.mockRestore();
            lookupMock.mockRestore();
            lookupParentDirMock.mockRestore();
        });
        it("displays error message if FileExists error occurs and listFiles fails", async () => {
            const fileExistsError = Object.assign(vscode.FileSystemError.FileExists("File already exists"), { code: "FileExists" });

            const mockUssApi = {
                rename: jest.fn().mockRejectedValueOnce(fileExistsError),
            };

            const errMsgSpy = jest.spyOn(Gui, "errorMessage");
            const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(mockUssApi as any);
            const listFilesMock = jest.spyOn(UssFSProvider.instance as any, "listFiles").mockResolvedValueOnce({ success: false });

            const folderEntry = {
                ...testEntries.folder,
                entries: new Map(),
                metadata: { ...testEntries.folder.metadata },
            };

            const sessionEntry = {
                ...testEntries.session,
                entries: new Map([[testEntries.folder.name, folderEntry]]),
            };

            (UssFSProvider.instance as any).root.entries.set("sestest", sessionEntry);

            const lookupMock = jest.spyOn(UssFSProvider.instance as any, "lookup").mockImplementation((uri: any) => {
                return sessionEntry.entries.get("aFolder");
            });

            const lookupParentDirMock = jest.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);

            await UssFSProvider.instance.rename(testUris.folder, testUris.folder.with({ path: "/sestest/aFolder2" }), { overwrite: true });

            expect(mockUssApi.rename).toHaveBeenCalledWith("/aFolder", "/aFolder2");
            expect(errMsgSpy).toHaveBeenCalledWith("File already exists");

            lookupMock.mockRestore();
            lookupParentDirMock.mockRestore();
            listFilesMock.mockRestore();
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
            const exampleError = new Error("insufficient permissions");
            const deleteMock = jest.fn().mockRejectedValueOnce(exampleError);
            jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({
                delete: deleteMock,
            } as any);
            const handleErrorMock = jest.spyOn((BaseProvider as any).prototype, "_handleError");
            await expect(UssFSProvider.instance.delete(testUris.file, { recursive: false })).rejects.toThrow();
            expect(getDelInfoMock).toHaveBeenCalledWith(testUris.file);
            expect(deleteMock).toHaveBeenCalledWith(testEntries.file.metadata.path, false);
            expect(handleErrorMock).toHaveBeenCalledWith(
                exampleError,
                expect.objectContaining({
                    additionalContext: "Failed to delete /aFile.txt",
                    apiType: ZoweExplorerApiType.Uss,
                    profileType: testEntries.file.metadata.profile.type,
                })
            );
            expect(sesEntry.entries.has("aFile.txt")).toBe(true);
            expect(sesEntry.size).toBe(1);
        });
    });

    describe("copy", () => {
        it("returns early if the source URI does not have a file tree in its query", async () => {
            const copyTreeMock = jest.spyOn((UssFSProvider as any).prototype, "copyTree");
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
            const copyTreeMock = jest.spyOn((UssFSProvider as any).prototype, "copyTree");
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
            const copyTreeMock = jest.spyOn((UssFSProvider as any).prototype, "copyTree");
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
        const getBlockMocks = (hasCopy: boolean = false) => {
            const fileList = jest.fn();
            const copy = jest.fn();
            const create = jest.fn();
            const uploadFromBuffer = jest.fn();
            const ussApi = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue(
                hasCopy
                    ? {
                          fileList,
                          copy,
                          create,
                          uploadFromBuffer,
                      }
                    : ({ fileList, create, uploadFromBuffer } as any)
            );
            const getInfoFromUri = jest.spyOn(UssFSProvider.instance as any, "_getInfoFromUri");

            return {
                profile: createIProfile(),
                profile2: { ...createIProfile(), name: "sestest2" },
                getInfoFromUri,
                ussApi,
                apiFuncs: {
                    fileList,
                    copy,
                    create,
                    uploadFromBuffer,
                },
            };
        };
        it("throws error if file list for destination path was unsuccessful", async () => {
            const blockMocks = getBlockMocks();
            const sourceUri = Uri.from({
                scheme: ZoweScheme.USS,
                path: "/sestest/folderA/file",
            });
            const destUri = Uri.from({
                scheme: ZoweScheme.USS,
                path: "/sestest/folderB",
            });
            blockMocks.apiFuncs.fileList.mockReturnValueOnce({
                success: false,
                errorMessage: "Unknown server-side error",
            });
            await expect((UssFSProvider.instance as any).copyTree(sourceUri, destUri)).rejects.toThrow(
                "Error fetching destination /folderB for paste action: Unknown server-side error"
            );
        });
        describe("same profiles", () => {
            it("copies a file into a destination folder - no collisions", async () => {
                const blockMocks = getBlockMocks(true);
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/file",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/file",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/file",
                        baseName: "file",
                        sessionName: "lpar.zosmf",
                        type: USSFileStructure.UssFileType.File,
                    },
                });
                expect(blockMocks.apiFuncs.copy).toHaveBeenCalledWith("/folderB/file", {
                    from: "/folderA/file",
                    recursive: false,
                    overwrite: true,
                });
            });
            it("copies a file into a destination folder - collision", async () => {
                const blockMocks = getBlockMocks(true);
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/file",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/file",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [{ name: "file" }] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/file",
                        baseName: "file",
                        sessionName: "lpar.zosmf",
                        type: USSFileStructure.UssFileType.File,
                    },
                });
                expect(blockMocks.apiFuncs.copy).toHaveBeenCalledWith("/folderB/file (1)", {
                    from: "/folderA/file",
                    recursive: false,
                    overwrite: true,
                });
            });
            it("copies a folder into a destination folder - no collisions", async () => {
                const blockMocks = getBlockMocks(true);
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/innerFolder",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/innerFolder",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/innerFolder",
                        sessionName: "lpar.zosmf",
                        type: USSFileStructure.UssFileType.Directory,
                    },
                });
                expect(blockMocks.apiFuncs.copy).toHaveBeenCalledWith("/folderB/innerFolder", {
                    from: "/folderA/innerFolder",
                    recursive: true,
                    overwrite: true,
                });
            });
            it("copies a folder into a destination folder - collision", async () => {
                const blockMocks = getBlockMocks(true);
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/innerFolder",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/innerFolder",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [{ name: "innerFolder" }] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/innerFolder",
                        sessionName: "lpar.zosmf",
                        type: USSFileStructure.UssFileType.Directory,
                    },
                });
                expect(blockMocks.apiFuncs.copy).toHaveBeenCalledWith("/folderB/innerFolder (1)", {
                    from: "/folderA/innerFolder",
                    recursive: true,
                    overwrite: true,
                });
            });
        });
        describe("different profiles", () => {
            it("copies a file into a destination folder - collision", async () => {
                const blockMocks = getBlockMocks();
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/file",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest2/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile2,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/file",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [{ name: "file" }] } });
                const lookupMock = jest.spyOn(UssFSProvider.instance, "lookup").mockReturnValue({
                    name: "file",
                    type: FileType.File,
                    metadata: {
                        path: "/sestest/folderA/file",
                        profile: blockMocks.profile,
                    },
                    wasAccessed: false,
                    data: new Uint8Array(),
                    ctime: 0,
                    mtime: 0,
                    size: 0,
                });
                const readFileMock = jest.spyOn(UssFSProvider.instance, "readFile").mockResolvedValue(new Uint8Array([1, 2, 3]));
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/file",
                        baseName: "file",
                        sessionName: "sestest",
                        type: USSFileStructure.UssFileType.File,
                    },
                });
                expect(lookupMock).toHaveBeenCalledWith(sourceUri);
                expect(readFileMock).toHaveBeenCalledWith(sourceUri);
                lookupMock.mockRestore();
                readFileMock.mockRestore();
            });
            it("copies a folder into a destination folder - collision", async () => {
                const blockMocks = getBlockMocks();
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/innerFolder",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest2/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile2,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/innerFolder",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [{ name: "innerFolder" }] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/innerFolder",
                        sessionName: "lpar.zosmf",
                        type: USSFileStructure.UssFileType.Directory,
                    },
                });
                expect(blockMocks.apiFuncs.create).toHaveBeenCalledWith("/folderB/innerFolder (1)", "directory");
            });
            it("copies a folder into a destination folder - no collision", async () => {
                const blockMocks = getBlockMocks();
                const sourceUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest/folderA/innerFolder",
                });
                const destUri = Uri.from({
                    scheme: ZoweScheme.USS,
                    path: "/sestest2/folderB",
                });
                blockMocks.getInfoFromUri
                    .mockReturnValueOnce({
                        profile: blockMocks.profile2,
                        path: "/folderB",
                    })
                    .mockReturnValueOnce({
                        profile: blockMocks.profile,
                        path: "/folderA/innerFolder",
                    });
                blockMocks.apiFuncs.fileList.mockResolvedValueOnce({ success: true, apiResponse: { items: [] } });
                await (UssFSProvider.instance as any).copyTree(sourceUri, destUri, {
                    overwrite: true,
                    tree: {
                        localUri: sourceUri,
                        ussPath: "/folderA/innerFolder",
                        sessionName: "sestest",
                        type: USSFileStructure.UssFileType.Directory,
                    },
                });
                expect(blockMocks.apiFuncs.create).toHaveBeenCalledWith("/folderB/innerFolder", "directory");
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
            expect(UssFSProvider.instance.watch(testUris.file)).toBeInstanceOf(Disposable);
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

    describe("Expected behavior for functions w/ profile locks", () => {
        let isProfileLockedMock;
        let warnLoggerSpy;

        beforeEach(() => {
            isProfileLockedMock = jest.spyOn(AuthHandler, "isProfileLocked");
            warnLoggerSpy = jest.spyOn(ZoweLogger, "warn").mockImplementation();
        });

        afterEach(() => {
            isProfileLockedMock.mockRestore();
            warnLoggerSpy.mockRestore();
        });

        describe("listFiles", () => {
            it("returns early without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                isProfileLockedMock.mockReturnValueOnce(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockResolvedValueOnce(undefined);
                const ussApiMock = {
                    fileList: jest.fn(),
                } as any;

                const getUssApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(ussApiMock);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);

                const result = await UssFSProvider.instance.listFiles(testProfile, testUris.file);

                expect(ensureAuthNotCancelledMock).toHaveBeenCalled();
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(result.success).toBe(false);
                expect(result.commandResponse).toContain("Profile is locked");
                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(ussApiMock.fileList).not.toHaveBeenCalled();

                waitForUnlockMock.mockRestore();
                getUssApiMock.mockRestore();
            });

            it("makes API calls when profile is not locked", async () => {
                const resolveProfile = jest.fn();
                const profilePromise = {
                    mStatus: "pending",
                    resolve: jest.fn(),
                    reject: jest.fn(),
                    status: "pending",
                    promise: new Promise<void>((resolve) => {
                        resolveProfile.mockImplementation(resolve);
                        setTimeout(resolve, 50);
                    }),
                };
                jest.spyOn(ProfilesUtils.extenderProfileReady, "get").mockReturnValueOnce(profilePromise as any);
                isProfileLockedMock.mockReturnValueOnce(false);
                const ussApiMock = {
                    fileList: jest.fn().mockResolvedValueOnce({
                        success: true,
                        apiResponse: { items: [] },
                    }),
                } as any;

                const getUssApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce(ussApiMock);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);

                const loadProfileMock = jest.spyOn(Profiles.getInstance(), "loadNamedProfile").mockReturnValueOnce(testProfile);

                await UssFSProvider.instance.listFiles(testProfile, testUris.file);

                expect(waitForUnlockMock).toHaveBeenCalledTimes(2);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(ussApiMock.fileList).toHaveBeenCalled();

                waitForUnlockMock.mockRestore();
                getUssApiMock.mockRestore();
                loadProfileMock.mockRestore();
            });
        });

        describe("fetchFileAtUri", () => {
            it("returns early without making API calls when profile is locked", async () => {
                const file = new UssFile("testFile");
                file.metadata = { profile: testProfile, path: "/testFile" };

                const lookupMock = jest.spyOn(UssFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(file);
                const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValueOnce(undefined);
                const getContentsMock = jest.fn().mockResolvedValueOnce({});
                const getUssApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({ getContents: getContentsMock } as any);

                isProfileLockedMock.mockReturnValueOnce(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockResolvedValueOnce(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);

                await UssFSProvider.instance.fetchFileAtUri(testUris.file);

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(getContentsMock).not.toHaveBeenCalled();

                lookupMock.mockRestore();
                autoDetectEncodingMock.mockRestore();
                getUssApiMock.mockRestore();
                waitForUnlockMock.mockRestore();
            });
        });

        describe("fetchEntries", () => {
            it("returns entry (if present) without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                const existsMock = jest.spyOn(UssFSProvider.instance, "exists").mockReturnValueOnce(true);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
                const lookupMock = jest.spyOn(UssFSProvider.instance, "lookup").mockReturnValueOnce(testEntries.file);

                isProfileLockedMock.mockReturnValueOnce(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);

                await (UssFSProvider.instance as any).fetchEntries(testUris.file, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.file.path.indexOf("/", 1),
                    profile: testProfile,
                    profileName: testProfile.name,
                });

                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(existsMock).toHaveBeenCalledTimes(1);
                expect(existsMock).toHaveBeenCalledWith(testUris.file);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledTimes(1);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(lookupMock).toHaveBeenCalledTimes(1);
                expect(lookupMock).toHaveBeenCalledWith(testUris.file, false);

                existsMock.mockRestore();
                lookupMock.mockRestore();
                waitForUnlockMock.mockRestore();
            });

            it("throws error if entry does not exist and profile is locked and user cancelled last auth prompt", async () => {
                const existsMock = jest.spyOn(UssFSProvider.instance, "exists").mockReturnValueOnce(false);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);
                const lookupSpy = jest.spyOn(UssFSProvider.instance, "lookup");

                isProfileLockedMock.mockReturnValueOnce(true);

                await expect(
                    (UssFSProvider.instance as any).fetchEntries(testUris.file, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.file.path.indexOf("/", 1),
                        profile: testProfile,
                        profileName: testProfile.name,
                    })
                ).rejects.toThrow(FileSystemError.FileNotFound(testUris.file));

                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(existsMock).toHaveBeenCalledTimes(1);
                expect(existsMock).toHaveBeenCalledWith(testUris.file);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledTimes(1);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(lookupSpy).not.toHaveBeenCalled();

                existsMock.mockRestore();
                waitForUnlockMock.mockRestore();
            });
        });

        describe("delete", () => {
            it("returns early without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                const getDeleteInfoMock = jest
                    .spyOn(UssFSProvider.instance as any, "_getDeleteInfo")
                    .mockClear()
                    .mockReturnValueOnce({
                        entryToDelete: testEntries.file,
                        parent: testEntries.session,
                        parentUri: testUris.session,
                    });
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
                const loadNamedProfileSpy = jest.spyOn(Profiles.prototype, "loadNamedProfile");

                isProfileLockedMock.mockReturnValueOnce(true);

                await UssFSProvider.instance.delete(testUris.file, { recursive: false });
                expect(getDeleteInfoMock).toHaveBeenCalledTimes(1);
                expect(getDeleteInfoMock).toHaveBeenCalledWith(testUris.file);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledTimes(1);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(loadNamedProfileSpy).not.toHaveBeenCalled();
            });
        });

        describe("stat", () => {
            describe("stat", () => {
                it("returns early without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                    const file = new UssFile("testFile");
                    file.metadata = { profile: testProfile, path: "/testFile" };

                    const lookupMock = jest.spyOn(UssFSProvider.instance, "lookup").mockReturnValue(file);
                    const listFilesSpy = jest.spyOn(UssFSProvider.instance, "listFiles");

                    isProfileLockedMock.mockReturnValue(true);

                    const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);
                    const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);

                    await UssFSProvider.instance.stat(testUris.file.with({ query: "fetch=true" }));

                    expect(ensureAuthNotCancelledMock).toHaveBeenCalled();
                    expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                    expect(waitForUnlockMock).toHaveBeenCalledWith(file.metadata.profile);
                    expect(isProfileLockedMock).toHaveBeenCalledWith(file.metadata.profile);
                    expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                    expect(listFilesSpy).not.toHaveBeenCalled();

                    lookupMock.mockRestore();
                    waitForUnlockMock.mockRestore();
                });
            });
        });

        describe("autoDetectEncoding", () => {
            it("returns early without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                const file = new UssFile("testFile");
                file.metadata = { profile: testProfile, path: "/testFile" };

                const getTagMock = jest.fn().mockResolvedValueOnce("binary");
                const getUssApiMock = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValueOnce({ getTag: getTagMock } as any);

                isProfileLockedMock.mockReturnValueOnce(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);

                await UssFSProvider.instance.autoDetectEncoding(file);

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledTimes(1);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(getTagMock).not.toHaveBeenCalled();

                getUssApiMock.mockRestore();
                waitForUnlockMock.mockRestore();
            });
        });

        describe("uploadEntry", () => {
            it("throws error without making API calls when profile is locked and user cancelled last auth prompt", async () => {
                const file = new UssFile("testFile");
                file.metadata = { profile: testProfile, path: "/testFile" };
                const content = new Uint8Array([1, 2, 3]);

                const uploadFromBufferMock = jest.fn().mockResolvedValueOnce({});
                const getUssApiMock = jest
                    .spyOn(ZoweExplorerApiRegister, "getUssApi")
                    .mockReturnValueOnce({ uploadFromBuffer: uploadFromBufferMock } as any);
                const autoDetectEncodingMock = jest.spyOn(UssFSProvider.instance, "autoDetectEncoding").mockResolvedValueOnce(undefined);

                isProfileLockedMock.mockReturnValueOnce(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockClear().mockResolvedValueOnce(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
                const setStatusBarMessageMock = jest.spyOn(Gui, "setStatusBarMessage").mockReturnValueOnce({ dispose: jest.fn() });

                await expect((UssFSProvider.instance as any).uploadEntry(file, content)).rejects.toThrow();

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledTimes(1);
                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
                expect(waitForUnlockMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(file.metadata.profile);
                expect(warnLoggerSpy).toHaveBeenCalledWith("[UssFSProvider] Profile sestest is locked, waiting for authentication");
                expect(uploadFromBufferMock).not.toHaveBeenCalled();

                getUssApiMock.mockRestore();
                autoDetectEncodingMock.mockRestore();
                waitForUnlockMock.mockRestore();
                setStatusBarMessageMock.mockRestore();
            });
        });
    });
});
