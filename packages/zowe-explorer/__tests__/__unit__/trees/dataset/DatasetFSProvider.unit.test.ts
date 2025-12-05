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

import { Disposable, FilePermission, FileSystemError, FileType, TextEditor, Uri } from "vscode";
import * as vscode from "vscode";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import {
    AuthHandler,
    DirEntry,
    DsEntry,
    DsEntryMetadata,
    FileEntry,
    FilterEntry,
    FsAbstractUtils,
    FsDatasetsUtils,
    Gui,
    imperative,
    PdsEntry,
    Types,
    ZoweExplorerApiType,
    ZoweScheme,
    ZoweVsCodeExtension,
} from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { Profiles } from "../../../../src/configuration/Profiles";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import * as path from "path";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";
import { DeferredPromise } from "@zowe/imperative";

const dayjs = require("dayjs");

const testProfile = createIProfile();
const testEntries = {
    ps: {
        ...new DsEntry("USER.DATA.PS", false),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PS",
        }),
        etag: "OLDETAG",
        isMember: false,
    } as DsEntry,
    pds: {
        ...new PdsEntry("USER.DATA.PDS"),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PDS",
        }),
    } as PdsEntry,
    pdsMember: {
        ...new DsEntry("MEMBER1", true),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PDS/MEMBER1",
        }),
        isMember: true,
    } as DsEntry,
    vsam: {
        ...new DsEntry("USER.DATA.PS", false),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PS",
        }),
        isMember: false,
        stats: { vol: "*VSAM*" } as unknown as Types.DatasetStats,
    } as DsEntry,
    session: {
        ...new FilterEntry("sestest"),
        metadata: {
            profile: testProfile,
            path: "/",
        },
    },
};

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    ps: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PS" }),
    pds: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS" }),
    pdsMember: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS/MEMBER1" }),
    session: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest" }),
};

describe("DatasetFSProvider", () => {
    let mockedProperty: MockedProperty;
    beforeEach(async () => {
        jest.restoreAllMocks();
        mockedProperty = new MockedProperty(Profiles, "getInstance", {
            value: jest.fn().mockReturnValue({
                loadNamedProfile: jest.fn().mockReturnValue(testProfile),
                allProfiles: [],
                getProfileFromConfig: jest.fn(),
            } as any),
        });
        jest.spyOn(ProfilesUtils, "awaitExtenderType").mockImplementation();
        DatasetFSProvider.instance.requestCache.clear();
    });

    afterAll(() => {
        mockedProperty[Symbol.dispose]();
    });

    describe("createDirectory", () => {
        it("creates a directory for a session entry", () => {
            const fakeRoot = { ...(DatasetFSProvider.instance as any).root };
            const rootMock = new MockedProperty(DatasetFSProvider.instance, "root", undefined, fakeRoot);
            DatasetFSProvider.instance.createDirectory(testUris.session);
            expect(fakeRoot.entries.has("sestest")).toBe(true);
            rootMock[Symbol.dispose]();
        });

        it("creates a directory for a PDS entry", () => {
            const fakeSessionEntry = new FilterEntry("sestest");
            fakeSessionEntry.metadata = testEntries.session.metadata;
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            DatasetFSProvider.instance.createDirectory(testUris.pds);
            expect(fakeSessionEntry.entries.has("USER.DATA.PDS")).toBe(true);
        });
    });

    describe("readDirectory", () => {
        describe("filter entry (session)", () => {
            it("calls dataSetsMatchingPattern when reading directories if it exists", async () => {
                const mockMvsApi = {
                    dataSetsMatchingPattern: jest.fn().mockResolvedValue({
                        apiResponse: [
                            { dsname: "USER.DATA.DS" },
                            { dsname: "USER.DATA.PDS", dsorg: "PO" },
                            { dsname: "USER.ZFS", dsorg: "VS" },
                            { dsname: "USER.ZFS.DATA", dsorg: "VS" },
                            { dsname: "USER.DATA.MIGRATED", migr: "yes" },
                            { dsname: "USER.DATA.DS2" },
                        ],
                    }),
                };
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
                expect(await DatasetFSProvider.instance.readDirectory(testUris.session.with({ query: "pattern=USER.*" }))).toStrictEqual([
                    ["USER.DATA.DS", FileType.File],
                    ["USER.DATA.PDS", FileType.Directory],
                    ["USER.DATA.MIGRATED", FileType.File],
                    ["USER.DATA.DS2", FileType.File],
                ]);
                expect(mockMvsApi.dataSetsMatchingPattern).toHaveBeenCalledWith(["USER.*"]);
            });

            it("calls dataSet if dataSetsMatchingPattern API is unavailable", async () => {
                const mockMvsApi = {
                    dataSet: jest.fn().mockResolvedValue({
                        apiResponse: {
                            items: [
                                { dsname: "USER.DATA.DS" },
                                { dsname: "USER.DATA.PDS", dsorg: "PO" },
                                { dsname: "USER.ZFS", dsorg: "VS" },
                                { dsname: "USER.ZFS.DATA", dsorg: "VS" },
                                { dsname: "USER.DATA.MIGRATED", migr: "yes" },
                                { dsname: "USER.DATA.DS2" },
                            ],
                        },
                    }),
                };
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
                expect(await DatasetFSProvider.instance.readDirectory(testUris.session.with({ query: "pattern=USER.*" }))).toStrictEqual([
                    ["USER.DATA.DS", FileType.File],
                    ["USER.DATA.PDS", FileType.Directory],
                    ["USER.DATA.MIGRATED", FileType.File],
                    ["USER.DATA.DS2", FileType.File],
                ]);
                expect(mockMvsApi.dataSet).toHaveBeenCalledWith("USER.*");
            });
        });

        it("throws an error if lookup returns a non-filesystem error", async () => {
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockRejectedValue(new Error());
            await expect(DatasetFSProvider.instance.readDirectory).rejects.toThrow();
        });

        describe("PDS entry", () => {
            it("calls allMembers to fetch the members of a PDS", async () => {
                const mockPdsEntry = { ...testEntries.pds, metadata: { ...testEntries.pds.metadata } };
                jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValue(mockPdsEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "fetchDataset").mockImplementation(async () => {
                    mockPdsEntry.entries.set("MEMB1", new DsEntry("MEMB1", true));
                    mockPdsEntry.entries.set("MEMB2", new DsEntry("MEMB2", true));
                    mockPdsEntry.entries.set("MEMB3", new DsEntry("MEMB3", true));
                    mockPdsEntry.entries.set("MEMB4", new DsEntry("MEMB4", true));

                    return mockPdsEntry;
                });
                expect(await DatasetFSProvider.instance.readDirectory(testUris.pds)).toStrictEqual([
                    ["MEMB1", FileType.File],
                    ["MEMB2", FileType.File],
                    ["MEMB3", FileType.File],
                    ["MEMB4", FileType.File],
                ]);
            });
        });
    });
    describe("fetchDatasetAtUri", () => {
        beforeEach(() => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        loadNamedProfile: jest.fn(() => {
                            return testProfile;
                        }),
                    };
                }),
            });
        });
        it("fetches a data set at the given URI", async () => {
            const contents = "dataset contents";
            const mockMvsApi = {
                getContents: jest.fn((dsn, opts) => {
                    opts.stream.write(contents);

                    return {
                        apiResponse: {
                            etag: "123ANETAG",
                        },
                    };
                }),
            };
            const fakePo = { ...testEntries.ps };
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(fakePo);
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps);
            expect(fakePo.data?.toString()).toStrictEqual(contents.toString());
            expect(fakePo.etag).toBe("123ANETAG");
        });

        it("fetches a data set at the given URI - conflict view", async () => {
            const contents = "dataset contents";
            const mockMvsApi = {
                getContents: jest.fn((dsn, opts) => {
                    opts.stream.write(contents);

                    return {
                        apiResponse: {
                            etag: "123ANETAG",
                        },
                    };
                }),
            };
            const fakePo = { ...testEntries.ps };
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(fakePo);
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { isConflict: true });
            expect(fakePo.conflictData?.contents.toString()).toStrictEqual(contents.toString());
            expect(fakePo.conflictData?.etag).toBe("123ANETAG");
            expect(fakePo.conflictData?.size).toBe(contents.length);
        });

        it("returns null if API call fails", async () => {
            const mockMvsApi = {
                getContents: jest.fn().mockRejectedValue(new Error("unknown API error")),
            };
            const fakePo = { ...testEntries.ps };
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(fakePo);
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { isConflict: true })).toBe(null);
        });

        it("should fetchUri info and lookup returns undefined", async () => {
            const contents = "dataset contents";
            const mockMvsApi = {
                getContents: jest.fn((dsn, opts) => {
                    opts.stream.write(contents);

                    return {
                        apiResponse: {
                            etag: "123ANETAG",
                        },
                    };
                }),
                set: jest.fn(),
            };
            const fakePo = {
                ...testEntries.ps,
                entries: {
                    set: jest.fn(),
                    get: jest.fn().mockReturnValue([]),
                },
            };
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(undefined);
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakePo);
            jest.spyOn(DatasetFSProvider.instance as any, "_updateResourceInEditor").mockImplementationOnce(() => {});
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
            expect(
                (
                    (await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { editor: {} as TextEditor, isConflict: false })) as any
                ).data.toString()
            ).toBe(contents);
            expect(fakePo.etag).toBe("OLDETAG");
        });

        it("calls _updateResourceInEditor if 'editor' is specified", async () => {
            const contents = "dataset contents";
            const mockMvsApi = {
                getContents: jest.fn((dsn, opts) => {
                    opts.stream.write(contents);

                    return {
                        apiResponse: {
                            etag: "123ANETAG",
                        },
                    };
                }),
            };
            const fakePo = { ...testEntries.ps };
            const _updateResourceInEditorMock = jest.spyOn(DatasetFSProvider.instance as any, "_updateResourceInEditor").mockImplementation();
            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(fakePo);
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { editor: {} as TextEditor, isConflict: false });
            expect(fakePo.data?.toString()).toStrictEqual(contents.toString());
            expect(fakePo.etag).toBe("123ANETAG");
            expect(_updateResourceInEditorMock).toHaveBeenCalledWith(testUris.ps);
        });
    });
    describe("readFile", () => {
        it("throws an error if the entry does not have a profile", async () => {
            const _lookupAsFileMock = jest
                .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
                .mockReturnValue({ ...testEntries.ps, metadata: { profile: undefined } });

            let err;
            try {
                await DatasetFSProvider.instance.readFile(testUris.ps);
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileNotFound");
            }
            expect(err).toBeDefined();
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        });

        it("throws an error if the entry does not exist and the URI is actually a directory", async () => {
            const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementation((uri) => {
                throw FileSystemError.FileNotFound(uri as Uri);
            });
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(null);
            jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValue(testEntries.pds);

            let err;
            try {
                await DatasetFSProvider.instance.readFile(testUris.ps);
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileIsADirectory");
            }
            expect(err).toBeDefined();
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        });

        it("calls _handleError and throws error if an unknown error occurred during lookup", async () => {
            const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementation((uri) => {
                throw Error("unknown fs error");
            });
            const _handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();

            let err;
            try {
                await DatasetFSProvider.instance.readFile(testUris.ps);
            } catch (error) {
                err = error;
                expect(err.message).toBe("unknown fs error");
            }
            expect(err).toBeDefined();
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
            expect(_handleErrorMock).toHaveBeenCalled();
        });

        it("calls fetchDatasetAtUri if the entry has not yet been accessed", async () => {
            const _lookupAsFileMock = jest
                .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
                .mockReturnValue({ ...testEntries.ps, wasAccessed: false });
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });
            const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValue(new DsEntry("USER.DATA.PS"));

            await DatasetFSProvider.instance.readFile(testUris.ps);
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
            expect(fetchDatasetAtUriMock).toHaveBeenCalled();
        });

        it("calls fetchDatasetAtUri if entry does not exist locally", async () => {
            const _lookupAsFileMock = jest
                .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
                .mockImplementation(() => {
                    throw FileSystemError.FileNotFound(testUris.pdsMember);
                })
                .mockReturnValue(testEntries.pdsMember);
            const fetchDatasetAtUriMock = jest
                .spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri")
                .mockResolvedValue(new DsEntry("USER.DATA.PDS(MEMBER)"));
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });

            await DatasetFSProvider.instance.readFile(testUris.pdsMember);
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.pdsMember);
            expect(fetchDatasetAtUriMock).toHaveBeenCalledWith(testUris.pdsMember, { isConflict: false });
        });

        it("throws error if parent exists and file cannot be found", async () => {
            const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementation(() => {
                throw FileSystemError.FileNotFound(testUris.pdsMember);
            });
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });
            const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValue(null);
            await expect(DatasetFSProvider.instance.readFile(testUris.pdsMember)).rejects.toThrow();
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.pdsMember);
            expect(fetchDatasetAtUriMock).toHaveBeenCalledWith(testUris.pdsMember, { isConflict: false });
        });

        it("returns the data for an entry", async () => {
            const fakePs = { ...testEntries.ps, wasAccessed: true, data: new Uint8Array([1, 2, 3]) };
            const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(fakePs);
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });

            expect(await DatasetFSProvider.instance.readFile(testUris.ps)).toBe(fakePs.data);
            expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        });

        it("should properly await the profile deferred promise - existing promise", async () => {
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
            });

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
            jest.spyOn(Profiles, "getInstance").mockReturnValue(mockProfilesInstance as any);

            const profilePromise = new DeferredPromise<void>();

            if (testProfile.name) {
                ProfilesUtils.extenderProfileReady.set(testProfile.name, profilePromise);
            }

            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue({
                ...testEntries.ps,
                wasAccessed: true,
                data: new Uint8Array([1, 2, 3]),
            });
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });

            const shortTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for profile")), 100));

            await DatasetFSProvider.instance.readFile(testUris.ps);

            await expect(Promise.race([profilePromise.promise, shortTimeout])).resolves.toBeUndefined();
        });

        it("should properly await the profile deferred promise - no existing promise", async () => {
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
            });
            jest.spyOn(ProfilesUtils.extenderProfileReady, "get").mockReturnValue(undefined);
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
            jest.spyOn(Profiles, "getInstance").mockReturnValue(mockProfilesInstance as any);

            const profilePromise = new DeferredPromise<void>();
            jest.spyOn(ProfilesUtils.extenderProfileReady, "get").mockReturnValue(profilePromise);

            jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue({
                ...testEntries.ps,
                wasAccessed: true,
                data: new Uint8Array([1, 2, 3]),
            });
            jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });

            const shortTimeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for profile")), 100));

            await DatasetFSProvider.instance.readFile(testUris.ps);

            await expect(Promise.race([profilePromise.promise, shortTimeout])).resolves.toBeUndefined();
        });
    });

    describe("writeFile", () => {
        const lrecl = 80;
        const dsResponseMock = {
            success: true,
            apiResponse: {
                items: [
                    {
                        dsorg: "PS",
                        id: "ZOWE",
                        lrecl,
                        recfm: "FB",
                    },
                ],
            },
        };
        it("passes binary: true to uploadFromBuffer when entry.encoding.kind is 'binary'", async () => {
            const provider = DatasetFSProvider.instance;
            const uri = testUris.pdsMember;
            const content = new Uint8Array([0x41, 0x42, 0x43]);
            const parent = { entries: new Map(), metadata: { profile: { name: "profile" }, path: "/" } };
            const binaryEntry = { ...testEntries.pdsMember, wasAccessed: true, encoding: { kind: "binary" } } as DsEntry;
            parent.entries.set("MEMBER1", binaryEntry);
            jest.spyOn(provider as any, "lookupParentDirectory").mockReturnValueOnce(parent);

            const mockMvsApi = {
                uploadFromBuffer: jest.fn().mockResolvedValue({ apiResponse: { etag: "etag" } }),
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            };

            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);

            await provider.writeFile(uri, content, { create: false, overwrite: true });

            expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(
                Buffer.from(content),
                binaryEntry.metadata.dsName,
                expect.objectContaining({
                    binary: true,
                    returnEtag: true,
                })
            );
        });

        it("updates a PS in the FSP and remote system", async () => {
            const mockMvsApi = {
                uploadFromBuffer: jest.fn().mockResolvedValue({
                    apiResponse: {
                        etag: "NEWETAG",
                    },
                }),
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
            const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
            const sessionEntry = { ...testEntries.session };
            sessionEntry.entries.set("USER.DATA.PS", psEntry);
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(psEntry);
            const newContents = new Uint8Array([3, 6, 9]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true });

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
            expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving data set...");
            expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.ps.name, {
                binary: false,
                encoding: undefined,
                etag: testEntries.ps.etag,
                returnEtag: true,
            });
            expect(psEntry.etag).toBe("NEWETAG");
            expect(psEntry.data).toBe(newContents);
        });

        it("calls _handleConflict when there is an e-tag error", async () => {
            const mockMvsApi = {
                uploadFromBuffer: jest.fn().mockRejectedValue(new Error("Rest API failure with HTTP(S) status 412")),
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
            const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
            const sessionEntry = { ...testEntries.session };
            sessionEntry.entries.set("USER.DATA.PS", psEntry);
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(psEntry);
            const handleConflictMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleConflict").mockImplementation();
            const newContents = new Uint8Array([3, 6, 9]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true });

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
            expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving data set...");
            expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.ps.name, {
                binary: false,
                encoding: undefined,
                etag: testEntries.ps.etag,
                returnEtag: true,
            });
            expect(handleConflictMock).toHaveBeenCalled();
        });

        it("calls _handleError when there is an API error", async () => {
            const mockMvsApi = {
                uploadFromBuffer: jest.fn().mockRejectedValue(new Error("Rest API failure")),
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
            const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
            const sessionEntry = { ...testEntries.session };
            sessionEntry.entries.set("USER.DATA.PS", psEntry);
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(psEntry);
            const handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();
            const newContents = new Uint8Array([3, 6, 9]);
            await expect(DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true })).rejects.toThrow();

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
            expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving data set...");
            expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.ps.name, {
                binary: false,
                encoding: undefined,
                etag: testEntries.ps.etag,
                returnEtag: true,
            });
            expect(handleErrorMock).toHaveBeenCalled();
        });

        describe("may call _handleError when there are lines longer than the LRECL", () => {
            let mockMvsApi;
            const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
            const pdsMemberEntry = { ...testEntries.pdsMember, metadata: testEntries.pdsMember.metadata } as DsEntry;
            const newContents = new Uint8Array(Array(lrecl + 1).fill(0));
            const okContents = new Uint8Array(Array(lrecl - 1).fill(0));
            const lineAt = (i: number) => ({ text: i === 1 ? okContents : newContents });
            const createOptions = { create: false, overwrite: true };
            let handleErrorMock;
            const expectInvalidLines = (msg: string, multiple?: boolean) => {
                expect(msg).toContain("This upload operation may result in data loss.");
                expect(msg).toContain("Please review the following lines:");
                if (multiple) {
                    expect(msg).toContain("1, 3, 4, 5, 6...");
                    const stack = (handleErrorMock.mock.calls[0][0] as Error).stack;
                    expect(stack).toContain("Line: 1");
                    expect(stack).toContain("Lines: 3-10");
                } else {
                    expect(msg).toContain("1");
                }
            };

            beforeEach(() => {
                mockMvsApi = {
                    uploadFromBuffer: jest.fn(),
                    dataSet: jest.fn().mockResolvedValue(dsResponseMock),
                };
                handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            });

            it("in a PS data set with one invalid line", async () => {
                const sessionEntry = { ...testEntries.session };
                sessionEntry.entries.set("USER.DATA.PS", psEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 1, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.ps, newContents, createOptions)).rejects.toThrow();

                expect(mockMvsApi.uploadFromBuffer).not.toHaveBeenCalled();
                expect(handleErrorMock).toHaveBeenCalledTimes(1);
                const msg = (handleErrorMock.mock.calls[0][0] as Error).message;
                expectInvalidLines(msg);
            });
            it("in a PS data set with multiple invalid lines", async () => {
                const sessionEntry = { ...testEntries.session };
                sessionEntry.entries.set("USER.DATA.PS", psEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 10, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.ps, newContents, createOptions)).rejects.toThrow();

                expect(mockMvsApi.uploadFromBuffer).not.toHaveBeenCalled();
                expect(handleErrorMock).toHaveBeenCalledTimes(1);
                const msg = (handleErrorMock.mock.calls[0][0] as Error).message;
                expectInvalidLines(msg, true);
            });
            it("in a PDS member with one invalid line", async () => {
                const pdsEntry = { ...testEntries.pds };
                pdsEntry.entries.set("MEMBER1", pdsMemberEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(pdsEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 1, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.pdsMember, newContents, createOptions)).rejects.toThrow();

                expect(mockMvsApi.uploadFromBuffer).not.toHaveBeenCalled();
                expect(handleErrorMock).toHaveBeenCalledTimes(1);
                const msg = (handleErrorMock.mock.calls[0][0] as Error).message;
                expectInvalidLines(msg);
            });
            it("in a PDS member with multiple invalid lines", async () => {
                const pdsEntry = { ...testEntries.pds };
                pdsEntry.entries.set("MEMBER1", pdsMemberEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(pdsEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 10, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.pdsMember, newContents, createOptions)).rejects.toThrow();

                expect(mockMvsApi.uploadFromBuffer).not.toHaveBeenCalled();
                expect(handleErrorMock).toHaveBeenCalledTimes(1);
                const msg = (handleErrorMock.mock.calls[0][0] as Error).message;
                expectInvalidLines(msg, true);
            });

            it("in a PS data set with RECFM=U with one invalid line", async () => {
                const dsResponseMock = {
                    success: true,
                    apiResponse: {
                        items: [{ name: "USER.DATA.PS", recfm: "U", blksz: 10 }],
                    },
                    commandResponse: "",
                };
                mockMvsApi = {
                    uploadFromBuffer: jest.fn(),
                    dataSet: jest.fn().mockResolvedValue(dsResponseMock),
                };
                handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);

                const sessionEntry = { ...testEntries.session };
                sessionEntry.entries.set("USER.DATA.PS", psEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 1, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.ps, newContents, createOptions)).rejects.toThrow();

                expect(mockMvsApi.uploadFromBuffer).not.toHaveBeenCalled();
                expect(handleErrorMock).toHaveBeenCalledTimes(1);
                const msg = (handleErrorMock.mock.calls[0][0] as Error).message;
                expectInvalidLines(msg);
            });
            it("but not if lrecl or blksz are not set", async () => {
                const dsResponseMock = {
                    success: true,
                    apiResponse: {
                        items: [{ name: "USER.DATA.PS" }],
                    },
                    commandResponse: "",
                };
                mockMvsApi = {
                    uploadFromBuffer: jest.fn().mockResolvedValue({
                        apiResponse: {
                            etag: "NEWETAG",
                        },
                    }),
                    dataSet: jest.fn().mockResolvedValue(dsResponseMock),
                };
                handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();
                const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);

                const sessionEntry = { ...testEntries.session };
                sessionEntry.entries.set("USER.DATA.PS", psEntry);
                jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(sessionEntry);
                jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({ lineCount: 1, lineAt } as any);

                await expect(DatasetFSProvider.instance.writeFile(testUris.ps, newContents, createOptions)).resolves.not.toThrow();

                expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalled();
                expect(handleErrorMock).not.toHaveBeenCalled();
                expect(_fireSoonMock).toHaveBeenCalled();
            });
        });

        it("upload changes to a remote DS even if its not yet in the FSP", async () => {
            const mockMvsApi = {
                uploadFromBuffer: jest.fn().mockResolvedValue({
                    apiResponse: {
                        etag: "NEWETAG",
                    },
                }),
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
            const session = {
                ...testEntries.session,
                entries: new Map(),
            };
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            const newContents = new Uint8Array([3, 6, 9]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: true, overwrite: true });

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
            expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving data set...");
            expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.ps.name, {
                binary: false,
                encoding: undefined,
                etag: undefined,
                returnEtag: true,
            });
            const psEntry = session.entries.get("USER.DATA.PS")!;
            expect(psEntry.etag).toBe("NEWETAG");
            expect(psEntry.data).toBe(newContents);
        });

        it("updates an empty, unaccessed PS entry in the FSP without sending data", async () => {
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                dataSet: jest.fn().mockResolvedValue(dsResponseMock),
            } as any);
            const session = {
                ...testEntries.session,
                entries: new Map([[testEntries.ps.name, { ...testEntries.ps, wasAccessed: false }]]),
            };
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            const newContents = new Uint8Array([]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true });

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
            const psEntry = session.entries.get(testEntries.ps.name)!;
            expect(psEntry.data?.length).toBe(0);
        });

        it("updates a PS without uploading when open in the diff view", async () => {
            const session = {
                ...testEntries.session,
                entries: new Map([[testEntries.ps.name, { ...testEntries.ps }]]),
            };
            const testUriWithDiffQuery = testUris.ps.with({ query: "inDiff=true" });
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            const newContents = new Uint8Array([]);
            await DatasetFSProvider.instance.writeFile(testUriWithDiffQuery, newContents, { create: false, overwrite: true });

            expect(lookupParentDirMock).toHaveBeenCalledWith(testUriWithDiffQuery);
            const psEntry = session.entries.get("USER.DATA.PS")!;
            expect(psEntry.data?.length).toBe(0);
            expect(psEntry.inDiffView).toBe(true);
        });

        it("throws an error if entry doesn't exist and 'create' option is false", async () => {
            const session = {
                ...testEntries.session,
                entries: new Map(),
            };
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            let err;
            try {
                await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: false, overwrite: true });
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileNotFound");
            }
            expect(err).toBeDefined();
        });

        it("throws an error if entry exists and 'overwrite' option is false", async () => {
            const session = {
                ...testEntries.session,
                entries: new Map([[testEntries.ps.name, { ...testEntries.ps, wasAccessed: false }]]),
            };
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            let err;
            try {
                await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false });
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileExists");
            }
            expect(err).toBeDefined();
        });

        it("throws an error if the given URI is an existing PDS", async () => {
            const session = {
                ...testEntries.session,
                entries: new Map([[testEntries.ps.name, { ...testEntries.pds }]]),
            };
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(session);
            let err;
            try {
                await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false });
            } catch (error) {
                err = error;
                expect(err.code).toBe("FileIsADirectory");
            }
            expect(err).toBeDefined();
        });
    });

    describe("watch", () => {
        it("returns an empty Disposable object", () => {
            expect(DatasetFSProvider.instance.watch(testUris.pds, { recursive: false, excludes: [] })).toBeInstanceOf(Disposable);
        });
    });
    describe("stat", () => {
        it("returns the result of the 'lookup' function", async () => {
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.ps.metadata.profile,
            });
            await DatasetFSProvider.instance.stat(testUris.ps);
            expect(lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        });
        it("returns readonly if the URI is in the conflict view", async () => {
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
            const conflictUri = testUris.ps.with({ query: "conflict=true" });
            const res = await DatasetFSProvider.instance.stat(conflictUri);
            expect(res.permissions).toBe(FilePermission.Readonly);
            expect(lookupMock).toHaveBeenCalledWith(conflictUri, false);
        });
        it("returns a file as-is when query has inDiff parameter", async () => {
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
            await expect(DatasetFSProvider.instance.stat(testUris.ps.with({ query: "inDiff=true" }))).resolves.toStrictEqual(testEntries.ps);
            expect(lookupMock).toHaveBeenCalledWith(testUris.ps.with({ query: "inDiff=true" }), false);
        });
        it("calls lookup for a profile URI", async () => {
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.session);
            const res = await DatasetFSProvider.instance.stat(testUris.session);
            expect(lookupMock).toHaveBeenCalledWith(testUris.session, false);
            expect(res).toBe(testEntries.session);
        });
        it("attempts to fetch the resource if fetch=true is provided", async () => {
            const remoteLookupForResourceMock = jest
                .spyOn(DatasetFSProvider.instance as any, "remoteLookupForResource")
                .mockReturnValue(testEntries.ps);
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.ps.metadata.profile,
            });
            const uriWithFetchQuery = testUris.ps.with({ query: "fetch=true" });
            await DatasetFSProvider.instance.stat(uriWithFetchQuery);
            expect(remoteLookupForResourceMock).toHaveBeenCalledWith(uriWithFetchQuery);
        });

        it("calls dataSet for PS and invalidates its data if mtime is newer", async () => {
            const fakePs = Object.assign(Object.create(Object.getPrototypeOf(testEntries.ps)), testEntries.ps);
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePs);
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(testEntries.session);
            const dataSetMock = jest.fn().mockResolvedValue({
                success: true,
                apiResponse: {
                    items: [{ name: "USER.DATA.PS", dsorg: "PS" }],
                },
                commandResponse: "",
            });
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                dataSet: dataSetMock,
            } as any);
            const res = await DatasetFSProvider.instance.stat(testUris.ps);
            expect(lookupMock).toHaveBeenCalledWith(testUris.ps, false);
            expect(dataSetMock).toHaveBeenCalledWith(path.posix.basename(testEntries.ps.metadata.extensionRemovedFromPath()), { attributes: true });
            expect(res).toStrictEqual({ ...fakePs });
            expect(fakePs.wasAccessed).toBe(false);
        });
        it("should throw an Unavailable error if the type is token and token value is undefined", async () => {
            let errorMessage;
            jest.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValue({
                getCommonApi: () => ({
                    getSession: () => {
                        return { ...createIProfile(), ISession: { type: imperative.SessConstants.AUTH_TYPE_TOKEN } };
                    },
                }),
            } as any);
            try {
                await DatasetFSProvider.instance.stat(testUris.ps.with({ query: "fetch=true" }));
            } catch (err) {
                errorMessage = `${err}`;
            }
            expect(errorMessage).toBe("Error: Profile is using token type but missing a token");
        });
        it("calls allMembers for a PDS member and invalidates its data if mtime is newer", async () => {
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
            });

            const fakePdsMember = Object.assign(Object.create(Object.getPrototypeOf(testEntries.pdsMember)), testEntries.pdsMember);
            testEntries.pds.entries.set("MEMBER1", fakePdsMember);
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePdsMember);
            const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(testEntries.pds);
            const allMembersMock = jest.fn().mockResolvedValue({
                success: true,
                apiResponse: {
                    items: [{ member: "MEMBER1", m4date: "2024-08-08", mtime: "12", msec: "30" }],
                },
                commandResponse: "",
            });
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: allMembersMock,
            } as any);
            const res = await DatasetFSProvider.instance.stat(testUris.pdsMember);
            expect(lookupMock).toHaveBeenCalledWith(testUris.pdsMember, false);
            expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.pdsMember);
            expect(allMembersMock).toHaveBeenCalledWith("USER.DATA.PDS", { attributes: true });
            expect(res).toStrictEqual({ ...fakePdsMember, mtime: dayjs("2024-08-08 12:30").valueOf() });
            expect(fakePdsMember.wasAccessed).toBe(false);
        });

        it("looks up the resource before loading profile which may fail", async () => {
            const lookupMock = jest.spyOn((DatasetFSProvider as any).prototype, "lookup").mockReturnValue(testEntries.ps);
            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockImplementation(() => {
                throw new Error("invalid profile");
            });
            await expect(DatasetFSProvider.instance.stat(testUris.ps)).rejects.toThrow("invalid profile");
            expect(lookupMock).not.toHaveBeenCalled();
        });

        describe("error handling", () => {
            it("API response was unsuccessful for remote lookup", async () => {
                jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
                jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                    isRoot: false,
                    slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testEntries.ps.metadata.profile,
                });
                const exampleError = new Error("Response unsuccessful");
                const dataSetMock = jest.fn().mockRejectedValue(exampleError);
                // jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation(() => {
                //     throw vscode.FileSystemError.Unavailable("Auth Cancelled");
                // });
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                    dataSet: dataSetMock,
                } as any);
                await expect(DatasetFSProvider.instance.stat(testUris.ps)).rejects.toThrow();
            });
        });
    });

    describe("fetchEntriesForDataset", () => {
        it("calls allMembers to get the PDS members", async () => {
            const allMembersMock = jest.fn().mockResolvedValue({
                success: true,
                apiResponse: {
                    items: ["MEMBER1", "MEMBER2", "MEMBER3"].map((m) => ({ member: m })),
                },
                commandResponse: "",
            });
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: allMembersMock,
            } as any);
            const fakePds = Object.assign(Object.create(Object.getPrototypeOf(testEntries.pds)), testEntries.pds);
            await (DatasetFSProvider.instance as any).fetchEntriesForDataset(fakePds, testUris.pds, {
                isRoot: false,
                slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testProfile,
            });
            expect(allMembersMock).toHaveBeenCalled();
        });
        it("calls handleProfileAuthOnError in the case of an API error", async () => {
            const allMembersMock = jest
                .fn()
                .mockRejectedValueOnce(
                    new imperative.ImperativeError({
                        msg: "All configured authentication methods failed",
                    })
                )
                .mockRejectedValueOnce(
                    new imperative.ImperativeError({
                        msg: "Auth Cancelled",
                    })
                );
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: allMembersMock,
            } as any);
            jest.spyOn(AuthHandler, "lockProfile").mockImplementation();

            const handleProfileAuthOnErrorMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation(async () => {
                throw vscode.FileSystemError.Unavailable("User cancelled SSO authentication");
            });
            const fakePds = Object.assign(Object.create(Object.getPrototypeOf(testEntries.pds)), testEntries.pds);
            await expect(
                (DatasetFSProvider.instance as any).fetchEntriesForDataset(fakePds, testUris.pds, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                })
            ).rejects.toThrow();
            expect(allMembersMock).toHaveBeenCalled();
            expect(handleProfileAuthOnErrorMock).toHaveBeenCalled();
        });
    });

    describe("fetchEntriesForProfile", () => {
        it("calls _handleError in the case of an API error", async () => {
            const dataSetsMatchingPattern = jest.fn().mockRejectedValue(new Error("API error"));
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                dataSetsMatchingPattern,
            } as any);
            const fakeSession = Object.assign(Object.create(Object.getPrototypeOf(testEntries.session)), testEntries.session);
            const _handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockImplementation();
            const lookupAsDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValue(fakeSession);
            await (DatasetFSProvider.instance as any).fetchEntriesForProfile(
                testUris.session,
                {
                    isRoot: true,
                    slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                },
                "PUBLIC.*"
            );
            expect(_handleErrorMock).toHaveBeenCalled();
            expect(lookupAsDirMock).toHaveBeenCalled();
        });
    });

    describe("fetchDataset", () => {
        describe("calls dataSet to verify that the data set exists on the mainframe", () => {
            describe("PS", () => {
                it("non-existent PS URI", async () => {
                    const dataSetMock = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        dataSet: dataSetMock,
                    } as any);
                    try {
                        await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                            isRoot: false,
                            slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                            profileName: "sestest",
                            profile: testProfile,
                        });
                        expect("fetchDataset should have thrown").toBe("Error");
                    } catch (e) {
                        expect(e.message).toBe(testUris.ps.toString(true));
                    }
                    expect(dataSetMock).toHaveBeenCalled();
                });

                it("non-existent URI", async () => {
                    const dataSetMock = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [{ name: "USER.DATA.PS" }],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        dataSet: dataSetMock,
                    } as any);
                    await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                        profileName: "sestest",
                        profile: testProfile,
                    });
                    expect(dataSetMock).toHaveBeenCalled();
                });

                it("existing URI", async () => {
                    const fakePs = Object.assign(Object.create(Object.getPrototypeOf(testEntries.ps)), testEntries.ps);
                    jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValue(fakePs);
                    const writeFileSpy = jest.spyOn(DatasetFSProvider.instance as any, "writeFile");
                    await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                        profileName: "sestest",
                        profile: testProfile,
                    });
                    expect(writeFileSpy).not.toHaveBeenCalled();
                });
            });

            describe("PDS", () => {
                it("non-existent PDS URI", async () => {
                    const dataSetMock = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        dataSet: dataSetMock,
                    } as any);
                    jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockImplementation(() => {
                        throw FileSystemError.FileNotFound(testUris.pds);
                    });
                    try {
                        await (DatasetFSProvider.instance as any).fetchDataset(testUris.pds, {
                            isRoot: false,
                            slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                            profileName: "sestest",
                            profile: testProfile,
                        });
                        // Fail test if above expression doesn't throw anything.
                        expect(true).toBe(false);
                    } catch (e) {
                        expect(e.message).toBe(testUris.pds.toString(true));
                    }
                });
                it("non-existent URI", async () => {
                    const dataSetMock = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [{ name: "USER.DATA.PDS", dsorg: "PO" }],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        dataSet: dataSetMock,
                    } as any);
                    const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockImplementation(() => {
                        throw FileSystemError.FileNotFound(testUris.pds);
                    });
                    const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
                    const lookupDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValue(testEntries.pds);
                    const fetchEntriesForDatasetMock = jest.spyOn(DatasetFSProvider.instance as any, "fetchEntriesForDataset").mockImplementation();
                    await (DatasetFSProvider.instance as any).fetchDataset(testUris.pds, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                        profileName: "sestest",
                        profile: testProfile,
                    });
                    expect(lookupMock).toHaveBeenCalledWith(testUris.pds, false);
                    expect(lookupDirMock).toHaveBeenCalledWith(testUris.pds, false);
                    expect(createDirMock).toHaveBeenCalledWith(testUris.pds);
                    expect(dataSetMock).toHaveBeenCalled();
                    expect(fetchEntriesForDatasetMock).toHaveBeenCalled();
                });
            });

            describe("PDS member", () => {
                it("non-existent member URI", async () => {
                    const allMembersMockNoMatch = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [
                                {
                                    member: "NOMATCH",
                                },
                            ],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        allMembers: allMembersMockNoMatch,
                    } as any);
                    try {
                        await (DatasetFSProvider.instance as any).fetchDataset(testUris.pdsMember, {
                            isRoot: false,
                            slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                            profileName: "sestest",
                            profile: testProfile,
                        });
                        // Fail test if above expression doesn't throw anything.
                        expect(true).toBe(false);
                    } catch (e) {
                        expect(e.message).toBe(testUris.pdsMember.toString(true));
                    }
                    expect(allMembersMockNoMatch).toHaveBeenCalledWith("USER.DATA.PDS");
                });
                it("existing member URI", async () => {
                    const allMembersMock = jest.fn().mockResolvedValue({
                        success: true,
                        apiResponse: {
                            items: [
                                {
                                    member: "MEMBER1",
                                },
                            ],
                        },
                        commandResponse: "",
                    });
                    jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                        allMembers: allMembersMock,
                    } as any);
                    await (DatasetFSProvider.instance as any).fetchDataset(testUris.pdsMember, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.pdsMember.path.indexOf("/", 1),
                        profileName: "sestest",
                        profile: testProfile,
                    });
                    expect(allMembersMock).toHaveBeenCalledWith("USER.DATA.PDS");
                });
            });
        });
        it("calls _handleError whenever an unknown filesystem error occurs", async () => {
            jest.spyOn(DatasetFSProvider.instance, "lookup").mockImplementation(() => {
                throw new Error("unknown fs error");
            });
            await expect(
                (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                })
            ).rejects.toThrow();
        });
    });

    describe("delete", () => {
        it("successfully deletes a PS entry", async () => {
            const fakePs = { ...testEntries.ps };
            const fakeSession = { ...testEntries.session, entries: new Map() };
            fakeSession.entries.set("USER.DATA.PS", fakePs);
            const mockMvsApi = {
                deleteDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePs);
            const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSession);

            await DatasetFSProvider.instance.delete(testUris.ps, { recursive: false });
            expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePs.name, { responseTimeout: undefined });
            expect(_lookupMock).toHaveBeenCalledWith(testUris.ps, false);
            expect(_fireSoonMock).toHaveBeenCalled();

            expect(fakeSession.entries.has(fakePs.name)).toBe(false);
        });

        it("successfully deletes a PDS member", async () => {
            const fakePdsMember = { ...testEntries.pdsMember };
            const fakePds = new PdsEntry("USER.DATA.PDS");
            fakePds.entries.set("MEMBER1", fakePdsMember);
            const mockMvsApi = {
                deleteDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePdsMember);
            const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakePds);

            await DatasetFSProvider.instance.delete(testUris.pdsMember, { recursive: false });
            expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(`${fakePds.name}(${fakePdsMember.name})`, { responseTimeout: undefined });
            expect(_lookupMock).toHaveBeenCalledWith(testUris.pdsMember, false);
            expect(_fireSoonMock).toHaveBeenCalled();

            expect(fakePds.entries.has(fakePdsMember.name)).toBe(false);
        });

        it("successfully deletes a PDS", async () => {
            const fakePds = { ...testEntries.pds };
            const mockMvsApi = {
                deleteDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePds);
            const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
            jest.spyOn(FsDatasetsUtils, "isPdsEntry").mockReturnValue(true);
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue({ ...testEntries.session });

            await DatasetFSProvider.instance.delete(testUris.pds, { recursive: false });
            expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePds.name, { responseTimeout: undefined });
            expect(_lookupMock).toHaveBeenCalledWith(testUris.pds, false);
            expect(_fireSoonMock).toHaveBeenCalled();
        });

        it("successfully deletes a VSAM", async () => {
            const fakeVsam = { ...testEntries.vsam };
            const mockMvsApi = {
                deleteDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakeVsam);
            const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
            jest.spyOn(FsDatasetsUtils, "isPdsEntry").mockReturnValue(true);
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue({ ...testEntries.session });

            await DatasetFSProvider.instance.delete(testUris.vsam, { recursive: false });
            expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakeVsam.name, { responseTimeout: undefined, volume: fakeVsam.stats.vol });
            expect(_lookupMock).toHaveBeenCalledWith(testUris.vsam, false);
            expect(_fireSoonMock).toHaveBeenCalled();
        });

        it("throws an error if it could not delete an entry", async () => {
            const fakePs = { ...testEntries.ps };
            const fakeSession = { ...testEntries.session, entries: new Map() };
            fakeSession.entries.set("USER.DATA.PS", fakePs);

            const sampleError = new Error("Data set does not exist on remote");
            const mockMvsApi = {
                deleteDataSet: jest.fn().mockRejectedValue(sampleError),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePs);
            const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
            const handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockResolvedValue(undefined);
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSession);

            await expect(DatasetFSProvider.instance.delete(testUris.ps, { recursive: false })).rejects.toThrow();
            expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePs.name, { responseTimeout: undefined });
            expect(_lookupMock).toHaveBeenCalledWith(testUris.ps, false);
            expect(_fireSoonMock).not.toHaveBeenCalled();
            expect(handleErrorMock).toHaveBeenCalledWith(
                sampleError,
                expect.objectContaining({
                    additionalContext: "Failed to delete /USER.DATA.PS",
                    apiType: ZoweExplorerApiType.Mvs,
                    profileType: "zosmf",
                })
            );
            expect(fakeSession.entries.has(fakePs.name)).toBe(true);
        });
    });

    describe("makeEmptyDsWithEncoding", () => {
        it("creates an empty data set in the provider with the given encoding", () => {
            const fakeSession = { ...testEntries.session };
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSession);
            expect(DatasetFSProvider.instance.makeEmptyDsWithEncoding(testUris.ps, { kind: "binary" }));
            expect(fakeSession.entries.has(testEntries.ps.name)).toBe(true);
        });
    });

    describe("rename", () => {
        it("renames a PS", async () => {
            const oldPs = { ...testEntries.ps };
            const mockMvsApi = {
                renameDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockImplementation((uri): DirEntry | FileEntry =>
                (uri as Uri).path.includes("USER.DATA.PS2") ? (null as any) : oldPs
            );
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory")
                .mockReturnValue({ ...testEntries.session })
                .mockReturnValue({ ...testEntries.session });
            await DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: true });
            expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PS", "USER.DATA.PS2");
        });

        it("renames a PDS", async () => {
            const oldPds = new PdsEntry("USER.DATA.PDS");
            oldPds.metadata = new DsEntryMetadata({ profile: testProfile, path: "/USER.DATA.PDS" });
            const exampleMember = new DsEntry("TESTMEM", true);
            exampleMember.metadata = new DsEntryMetadata({ profile: testProfile, path: "/USER.DATA.PDS/TESTMEM" });
            oldPds.entries.set("TESTMEM", exampleMember);
            oldPds.metadata = testEntries.pds.metadata;
            const mockMvsApi = {
                renameDataSet: jest.fn(),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockImplementation((uri): DirEntry | FileEntry =>
                (uri as Uri).path.includes("USER.DATA.PDS2") ? (undefined as any) : oldPds
            );
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue({ ...testEntries.session });
            await DatasetFSProvider.instance.rename(testUris.pds, testUris.pds.with({ path: "/USER.DATA.PDS2" }), { overwrite: true });
            expect(exampleMember.metadata.path).toBe("/USER.DATA.PDS2/TESTMEM");
            expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PDS", "USER.DATA.PDS2");
        });

        it("throws an error if 'overwrite' is false and the entry already exists", async () => {
            const newPs = { ...testEntries.ps, name: "USER.DATA.PS2" };
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(newPs);
            await expect(
                DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: false })
            ).rejects.toThrow("Rename failed: USER.DATA.PS2 already exists");
        });

        it("displays an error message when renaming fails on the remote system", async () => {
            const oldPds = new PdsEntry("USER.DATA.PDS");
            oldPds.metadata = testEntries.pds.metadata;
            const sampleError = new Error("could not upload data set");
            const mockMvsApi = {
                renameDataSet: jest.fn().mockRejectedValue(sampleError),
            };
            jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockImplementation((uri): DirEntry | FileEntry =>
                (uri as Uri).path.includes("USER.DATA.PDS2") ? (undefined as any) : oldPds
            );
            jest.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue({ ...testEntries.session });
            const handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockResolvedValue(undefined);
            await expect(
                DatasetFSProvider.instance.rename(testUris.pds, testUris.pds.with({ path: "/USER.DATA.PDS2" }), { overwrite: true })
            ).rejects.toThrow();
            expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PDS", "USER.DATA.PDS2");
            expect(handleErrorMock).toHaveBeenCalledWith(
                sampleError,
                expect.objectContaining({
                    additionalContext: "Failed to rename USER.DATA.PDS",
                    apiType: ZoweExplorerApiType.Mvs,
                    profileType: "zosmf",
                })
            );
        });
    });

    describe("Expected behavior for functions w/ profile locks", () => {
        let isProfileLockedMock;
        let warnLoggerMock;

        beforeEach(() => {
            isProfileLockedMock = jest.spyOn(AuthHandler, "isProfileLocked");
            warnLoggerMock = jest.spyOn(ZoweLogger, "warn").mockImplementation();
        });

        afterEach(() => {});

        describe("stat", () => {
            it("returns entry without API calls when profile is locked", async () => {
                const fakeEntry = { ...testEntries.ps };
                jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValue(fakeEntry);
                jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                    profile: testProfile,
                    isRoot: false,
                    slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                    profileName: "sestest",
                });

                isProfileLockedMock.mockReturnValue(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockResolvedValue(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);

                const datasetMock = jest.fn().mockResolvedValue({});
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({ dataSet: datasetMock } as any);

                const result = await DatasetFSProvider.instance.stat(testUris.ps);

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(warnLoggerMock).toHaveBeenCalledWith("[DatasetFSProvider] Profile sestest is locked, waiting for authentication");
                expect(datasetMock).not.toHaveBeenCalled();
                expect(result).toBe(fakeEntry);
            });
        });

        describe("fetchEntriesForProfile", () => {
            it("returns early without making API calls when profile is locked", async () => {
                const fakeEntry = { ...testEntries.session, entries: new Map() };
                jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValue(fakeEntry);
                const uriInfo = { profile: testProfile };

                isProfileLockedMock.mockReturnValue(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockResolvedValue(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);

                const datasetMock = jest.fn().mockResolvedValue({});
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({ dataSet: datasetMock } as any);

                const result = await (DatasetFSProvider.instance as any).fetchEntriesForProfile(testUris.session, uriInfo, "USER.*");

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(warnLoggerMock).toHaveBeenCalledWith("[DatasetFSProvider] Profile sestest is locked, waiting for authentication");
                expect(datasetMock).not.toHaveBeenCalled();
                expect(result).toBe(fakeEntry);
            });
        });

        describe("fetchDatasetAtUri", () => {
            it("returns null without making API calls when profile is locked", async () => {
                const file = new DsEntry("TEST.DS", false);
                file.metadata = new DsEntryMetadata({ profile: testProfile, path: "/TEST.DS" });

                jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValue(file);
                jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValue(file.metadata);

                isProfileLockedMock.mockReturnValue(true);
                const ensureAuthNotCancelledMock = jest.spyOn(AuthUtils, "ensureAuthNotCancelled").mockResolvedValue(undefined);
                const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);

                const getContentsMock = jest.fn().mockResolvedValue({});
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({ getContents: getContentsMock } as any);

                const result = await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps);

                expect(ensureAuthNotCancelledMock).toHaveBeenCalledWith(testProfile);
                expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile);
                expect(isProfileLockedMock).toHaveBeenCalledWith(testProfile);
                expect(warnLoggerMock).toHaveBeenCalledWith("[DatasetFSProvider] Profile sestest is locked, waiting for authentication");
                expect(getContentsMock).not.toHaveBeenCalled();
                expect(result).toBeNull();
            });
        });
    });
});
