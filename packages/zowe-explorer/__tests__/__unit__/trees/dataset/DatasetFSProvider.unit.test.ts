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
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import {
    DirEntry,
    DsEntry,
    DsEntryMetadata,
    FileEntry,
    FilterEntry,
    FsAbstractUtils,
    FsDatasetsUtils,
    Gui,
    PdsEntry,
    ZoweExplorerApiType,
    ZoweScheme,
} from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { Profiles } from "../../../../src/configuration/Profiles";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import * as path from "path";
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
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSessionEntry);
        DatasetFSProvider.instance.createDirectory(testUris.pds);
        expect(fakeSessionEntry.entries.has("USER.DATA.PDS")).toBe(true);
    });
});

describe("readDirectory", () => {
    describe("filter entry (session)", () => {
        it("calls dataSetsMatchingPattern when reading directories if it exists", async () => {
            const mockSessionEntry = { ...testEntries.session, filter: {}, metadata: { profile: testProfile, path: "/" } };
            const mockMvsApi = {
                dataSetsMatchingPattern: jest.fn().mockResolvedValueOnce({
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
            const _lookupAsDirectoryMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(mockSessionEntry);
            const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: true,
                slashAfterProfilePos: testUris.session.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.pds.metadata.profile,
            });
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.readDirectory(testUris.session.with({ query: "pattern=USER.*" }))).toStrictEqual([
                ["USER.DATA.DS", FileType.File],
                ["USER.DATA.PDS", FileType.Directory],
                ["USER.DATA.MIGRATED", FileType.File],
                ["USER.DATA.DS2", FileType.File],
            ]);
            expect(mockMvsApi.dataSetsMatchingPattern).toHaveBeenCalledWith(["USER.*"]);
            _lookupAsDirectoryMock.mockRestore();
            mvsApiMock.mockRestore();
            getInfoForUriMock.mockRestore();
        });

        it("calls dataSet if dataSetsMatchingPattern API is unavailable", async () => {
            const mockSessionEntry = { ...testEntries.session, filter: {}, metadata: { profile: testProfile, path: "/" } };
            const mockMvsApi = {
                dataSet: jest.fn().mockResolvedValueOnce({
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
            const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: true,
                slashAfterProfilePos: testUris.session.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.pds.metadata.profile,
            });
            const _lookupAsDirectoryMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(mockSessionEntry);
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.readDirectory(testUris.session.with({ query: "pattern=USER.*" }))).toStrictEqual([
                ["USER.DATA.DS", FileType.File],
                ["USER.DATA.PDS", FileType.Directory],
                ["USER.DATA.MIGRATED", FileType.File],
                ["USER.DATA.DS2", FileType.File],
            ]);
            expect(mockMvsApi.dataSet).toHaveBeenCalledWith("USER.*");
            _lookupAsDirectoryMock.mockRestore();
            mvsApiMock.mockRestore();
            getInfoForUriMock.mockRestore();
        });
    });

    it("throws an error if lookup returns a non-filesystem error", async () => {
        const _lookupAsDirectoryMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockRejectedValueOnce(new Error());
        await expect(DatasetFSProvider.instance.readDirectory).rejects.toThrow();
        _lookupAsDirectoryMock.mockRestore();
    });

    describe("PDS entry", () => {
        it("calls allMembers to fetch the members of a PDS", async () => {
            const mockPdsEntry = { ...testEntries.pds, metadata: { ...testEntries.pds.metadata } };
            const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: false,
                slashAfterProfilePos: testUris.pds.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.pds.metadata.profile,
            });
            const _lookupAsDirectoryMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(mockPdsEntry);
            const fetchDatasetMock = jest.spyOn(DatasetFSProvider.instance as any, "fetchDataset").mockImplementation(async () => {
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
            _lookupAsDirectoryMock.mockRestore();
            fetchDatasetMock.mockRestore();
            getInfoForUriMock.mockRestore();
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps);
        expect(fakePo.data?.toString()).toStrictEqual(contents.toString());
        expect(fakePo.etag).toBe("123ANETAG");

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { isConflict: true });
        expect(fakePo.conflictData?.contents.toString()).toStrictEqual(contents.toString());
        expect(fakePo.conflictData?.etag).toBe("123ANETAG");
        expect(fakePo.conflictData?.size).toBe(contents.length);

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
    });

    it("returns null if API call fails", async () => {
        const mockMvsApi = {
            getContents: jest.fn().mockRejectedValue(new Error("unknown API error")),
        };
        const fakePo = { ...testEntries.ps };
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        expect(await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { isConflict: true })).toBe(null);

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, { editor: {} as TextEditor, isConflict: false });
        expect(fakePo.data?.toString()).toStrictEqual(contents.toString());
        expect(fakePo.etag).toBe("123ANETAG");
        expect(_updateResourceInEditorMock).toHaveBeenCalledWith(testUris.ps);

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
        _updateResourceInEditorMock.mockRestore();
    });
});
describe("readFile", () => {
    it("throws an error if the entry does not have a profile", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.ps, metadata: { profile: undefined } });

        let err;
        try {
            await DatasetFSProvider.instance.readFile(testUris.ps);
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileNotFound");
        }
        expect(err).toBeDefined();
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        _lookupAsFileMock.mockRestore();
    });

    it("throws an error if the entry does not exist and the URI is actually a directory", async () => {
        const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementationOnce((uri) => {
            throw FileSystemError.FileNotFound(uri as Uri);
        });
        const lookupParentDir = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(null);
        const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValue(testEntries.pds);

        let err;
        try {
            await DatasetFSProvider.instance.readFile(testUris.ps);
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileIsADirectory");
        }
        expect(err).toBeDefined();
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        _lookupAsFileMock.mockRestore();
        lookupParentDir.mockRestore();
        fetchDatasetAtUriMock.mockRestore();
    });

    it("calls _handleError and throws error if an unknown error occurred during lookup", async () => {
        const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementationOnce((uri) => {
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
        _lookupAsFileMock.mockRestore();
        _handleErrorMock.mockRestore();
    });

    it("calls fetchDatasetAtUri if the entry has not yet been accessed", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.ps, wasAccessed: false });
        const _getInfoFromUriMock = jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/USER.DATA.PS",
        });
        const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValueOnce(new DsEntry("USER.DATA.PS"));

        await DatasetFSProvider.instance.readFile(testUris.ps);
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        expect(fetchDatasetAtUriMock).toHaveBeenCalled();
        fetchDatasetAtUriMock.mockRestore();
        _getInfoFromUriMock.mockRestore();
    });

    it("calls fetchDatasetAtUri if entry does not exist locally", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockImplementationOnce(() => {
                throw FileSystemError.FileNotFound(testUris.pdsMember);
            })
            .mockReturnValue(testEntries.pdsMember);
        const fetchDatasetAtUriMock = jest
            .spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri")
            .mockResolvedValueOnce(new DsEntry("USER.DATA.PDS(MEMBER)"));
        const _getInfoFromUriMock = jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/USER.DATA.PS",
        });

        await DatasetFSProvider.instance.readFile(testUris.pdsMember);
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.pdsMember);
        expect(fetchDatasetAtUriMock).toHaveBeenCalledWith(testUris.pdsMember, { isConflict: false });
        _getInfoFromUriMock.mockRestore();
        fetchDatasetAtUriMock.mockRestore();
    });

    it("throws error if parent exists and file cannot be found", async () => {
        const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockImplementationOnce(() => {
            throw FileSystemError.FileNotFound(testUris.pdsMember);
        });
        const _getInfoFromUriMock = jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/USER.DATA.PS",
        });
        const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockResolvedValueOnce(null);
        await expect(DatasetFSProvider.instance.readFile(testUris.pdsMember)).rejects.toThrow();
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.pdsMember);
        expect(fetchDatasetAtUriMock).toHaveBeenCalledWith(testUris.pdsMember, { isConflict: false });

        _getInfoFromUriMock.mockRestore();
        _lookupAsFileMock.mockRestore();
        fetchDatasetAtUriMock.mockRestore();
    });

    it("returns the data for an entry", async () => {
        const fakePs = { ...testEntries.ps, wasAccessed: true, data: new Uint8Array([1, 2, 3]) };
        const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePs);
        const _getInfoFromUriMock = jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/USER.DATA.PS",
        });

        expect(await DatasetFSProvider.instance.readFile(testUris.ps)).toBe(fakePs.data);
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        _getInfoFromUriMock.mockRestore();
        _lookupAsFileMock.mockRestore();
    });
});

describe("writeFile", () => {
    it("updates a PS in the FSP and remote system", async () => {
        const mockMvsApi = {
            uploadFromBuffer: jest.fn().mockResolvedValueOnce({
                apiResponse: {
                    etag: "NEWETAG",
                },
            }),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
        const sessionEntry = { ...testEntries.session };
        sessionEntry.entries.set("USER.DATA.PS", psEntry);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(sessionEntry);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(psEntry);
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
        mvsApiMock.mockRestore();
        lookupMock.mockRestore();
    });

    it("calls _handleConflict when there is an e-tag error", async () => {
        const mockMvsApi = {
            uploadFromBuffer: jest.fn().mockRejectedValueOnce(new Error("Rest API failure with HTTP(S) status 412")),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
        const sessionEntry = { ...testEntries.session };
        sessionEntry.entries.set("USER.DATA.PS", psEntry);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(sessionEntry);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(psEntry);
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
        handleConflictMock.mockRestore();
        mvsApiMock.mockRestore();
        lookupMock.mockRestore();
    });

    it("calls _handleError when there is an API error", async () => {
        const mockMvsApi = {
            uploadFromBuffer: jest.fn().mockRejectedValueOnce(new Error("Rest API failure")),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
        const sessionEntry = { ...testEntries.session };
        sessionEntry.entries.set("USER.DATA.PS", psEntry);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(sessionEntry);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(psEntry);
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
        handleErrorMock.mockRestore();
        mvsApiMock.mockRestore();
        lookupMock.mockRestore();
    });

    it("upload changes to a remote DS even if its not yet in the FSP", async () => {
        const mockMvsApi = {
            uploadFromBuffer: jest.fn().mockResolvedValueOnce({
                apiResponse: {
                    etag: "NEWETAG",
                },
            }),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const session = {
            ...testEntries.session,
            entries: new Map(),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
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
        mvsApiMock.mockRestore();
    });

    it("updates an empty, unaccessed PS entry in the FSP without sending data", async () => {
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce({} as any);
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.ps, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        const newContents = new Uint8Array([]);
        await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
        const psEntry = session.entries.get(testEntries.ps.name)!;
        expect(psEntry.data?.length).toBe(0);
        mvsApiMock.mockRestore();
    });

    it("updates a PS without uploading when open in the diff view", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.ps }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        const newContents = new Uint8Array([]);
        await DatasetFSProvider.instance.writeFile(
            testUris.ps.with({
                query: "inDiff=true",
            }),
            newContents,
            { create: false, overwrite: true }
        );

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
        const psEntry = session.entries.get("USER.DATA.PS")!;
        expect(psEntry.data?.length).toBe(0);
        expect(psEntry.inDiffView).toBe(true);
    });

    it("throws an error if entry doesn't exist and 'create' option is false", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map(),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        let err;
        try {
            await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: false, overwrite: true });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileNotFound");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });

    it("throws an error if entry exists and 'overwrite' option is false", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.ps, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        let err;
        try {
            await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileExists");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });

    it("throws an error if the given URI is an existing PDS", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.pds }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        let err;
        try {
            await DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileIsADirectory");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });
});

describe("watch", () => {
    it("returns an empty Disposable object", () => {
        expect(DatasetFSProvider.instance.watch(testUris.pds, { recursive: false, excludes: [] })).toStrictEqual(new Disposable(() => {}));
    });
});
describe("stat", () => {
    it("returns the result of the 'lookup' function", async () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
        const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
            isRoot: false,
            slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
            profileName: "sestest",
            profile: testEntries.ps.metadata.profile,
        });
        await DatasetFSProvider.instance.stat(testUris.ps);
        expect(lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        lookupMock.mockRestore();
        getInfoForUriMock.mockRestore();
    });
    it("returns readonly if the URI is in the conflict view", async () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
        const conflictUri = testUris.ps.with({ query: "conflict=true" });
        const res = await DatasetFSProvider.instance.stat(conflictUri);
        expect(res.permissions).toBe(FilePermission.Readonly);
        expect(lookupMock).toHaveBeenCalledWith(conflictUri, false);
        lookupMock.mockRestore();
    });
    it("returns a file as-is when query has inDiff parameter", async () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(testEntries.ps);
        await expect(DatasetFSProvider.instance.stat(testUris.ps.with({ query: "inDiff=true" }))).resolves.toStrictEqual(testEntries.ps);
        expect(lookupMock).toHaveBeenCalledWith(testUris.ps.with({ query: "inDiff=true" }), false);
    });
    it("calls lookup for a profile URI", async () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.session);
        const res = await DatasetFSProvider.instance.stat(testUris.session);
        expect(lookupMock).toHaveBeenCalledWith(testUris.session, false);
        expect(res).toBe(testEntries.session);
        lookupMock.mockRestore();
    });
    it("attempts to fetch the resource if fetch=true is provided", async () => {
        const remoteLookupForResourceMock = jest.spyOn(DatasetFSProvider.instance as any, "remoteLookupForResource").mockReturnValue(testEntries.ps);
        const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
            isRoot: false,
            slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
            profileName: "sestest",
            profile: testEntries.ps.metadata.profile,
        });
        const uriWithFetchQuery = testUris.ps.with({ query: "fetch=true" });
        await DatasetFSProvider.instance.stat(uriWithFetchQuery);
        expect(remoteLookupForResourceMock).toHaveBeenCalledWith(uriWithFetchQuery);
        remoteLookupForResourceMock.mockRestore();
        getInfoForUriMock.mockRestore();
    });

    it("calls dataSet for PS and invalidates its data if mtime is newer", async () => {
        const fakePs = Object.assign(Object.create(Object.getPrototypeOf(testEntries.ps)), testEntries.ps);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePs);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValue(testEntries.session);
        const dataSetMock = jest.fn().mockResolvedValue({
            success: true,
            apiResponse: {
                items: [{ name: "USER.DATA.PS", dsorg: "PS" }],
            },
            commandResponse: "",
        });
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
            dataSet: dataSetMock,
        } as any);
        const res = await DatasetFSProvider.instance.stat(testUris.ps);
        expect(lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        expect(dataSetMock).toHaveBeenCalledWith(path.posix.basename(testEntries.ps.metadata.extensionRemovedFromPath()), { attributes: true });
        expect(res).toStrictEqual({ ...fakePs });
        expect(fakePs.wasAccessed).toBe(false);
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
        mvsApiMock.mockRestore();
    });

    it("calls allMembers for a PDS member and invalidates its data if mtime is newer", async () => {
        const fakePdsMember = Object.assign(Object.create(Object.getPrototypeOf(testEntries.pdsMember)), testEntries.pdsMember);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(fakePdsMember);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValue(testEntries.pds);
        const allMembersMock = jest.fn().mockResolvedValue({
            success: true,
            apiResponse: {
                items: [{ member: "MEMBER1", m4date: "2024-08-08", mtime: "12", msec: "30" }],
            },
            commandResponse: "",
        });
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
            allMembers: allMembersMock,
        } as any);
        const res = await DatasetFSProvider.instance.stat(testUris.pdsMember);
        expect(lookupMock).toHaveBeenCalledWith(testUris.pdsMember, false);
        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.pdsMember);
        expect(allMembersMock).toHaveBeenCalledWith("USER.DATA.PDS", { attributes: true });
        expect(res).toStrictEqual({ ...fakePdsMember, mtime: dayjs("2024-08-08 12:30").valueOf() });
        expect(fakePdsMember.wasAccessed).toBe(false);
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
        mvsApiMock.mockRestore();
    });

    describe("error handling", () => {
        it("API response was unsuccessful for remote lookup", async () => {
            const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);
            const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.ps.metadata.profile,
            });
            const exampleError = new Error("Response unsuccessful");
            const dataSetMock = jest.fn().mockRejectedValue(exampleError);
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                dataSet: dataSetMock,
            } as any);
            await expect(DatasetFSProvider.instance.stat(testUris.ps)).rejects.toThrow();
            mvsApiMock.mockRestore();
            getInfoForUriMock.mockRestore();
            lookupMock.mockRestore();
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
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
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
        mvsApiMock.mockRestore();
    });
    it("calls handleProfileAuthOnError in the case of an API error", async () => {
        const allMembersMock = jest.fn().mockRejectedValue(new Error("API error"));
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
            allMembers: allMembersMock,
        } as any);
        const handleProfileAuthOnErrorMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation();
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
        handleProfileAuthOnErrorMock.mockRestore();
        mvsApiMock.mockRestore();
    });
});

describe("fetchEntriesForProfile", () => {
    it("calls _handleError in the case of an API error", async () => {
        const dataSetsMatchingPattern = jest.fn().mockRejectedValue(new Error("API error"));
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
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
        _handleErrorMock.mockRestore();
        mvsApiMock.mockRestore();
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
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                    dataSet: dataSetMock,
                } as any);
                try {
                    await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                        isRoot: false,
                        slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                        profileName: "sestest",
                        profile: testProfile,
                    });
                    // Fail test if above expression doesn't throw anything.
                    expect(true).toBe(false);
                } catch (e) {
                    expect(e.message).toBe(testUris.ps.toString(true));
                }
                expect(dataSetMock).toHaveBeenCalled();
                mvsApiMock.mockRestore();
            });

            it("non-existent URI", async () => {
                const dataSetMock = jest.fn().mockResolvedValue({
                    success: true,
                    apiResponse: {
                        items: [{ name: "USER.DATA.PS" }],
                    },
                    commandResponse: "",
                });
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                    dataSet: dataSetMock,
                } as any);
                await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                });
                expect(dataSetMock).toHaveBeenCalled();
                mvsApiMock.mockRestore();
            });

            it("existing URI", async () => {
                const fakePs = Object.assign(Object.create(Object.getPrototypeOf(testEntries.ps)), testEntries.ps);
                const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValue(fakePs);
                const writeFileSpy = jest.spyOn(DatasetFSProvider.instance as any, "writeFile");
                await (DatasetFSProvider.instance as any).fetchDataset(testUris.ps, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                });
                expect(writeFileSpy).not.toHaveBeenCalled();
                lookupMock.mockRestore();
                writeFileSpy.mockRestore();
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
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                    dataSet: dataSetMock,
                } as any);
                const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup");
                lookupMock.mockImplementation(() => {
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
                lookupMock.mockRestore();
                mvsApiMock.mockRestore();
            });
            it("non-existent URI", async () => {
                const dataSetMock = jest.fn().mockResolvedValue({
                    success: true,
                    apiResponse: {
                        items: [{ name: "USER.DATA.PDS", dsorg: "PO" }],
                    },
                    commandResponse: "",
                });
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
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
                lookupMock.mockRestore();
                lookupDirMock.mockRestore();
                createDirMock.mockRestore();
                mvsApiMock.mockRestore();
                fetchEntriesForDatasetMock.mockRestore();
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
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
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
                mvsApiMock.mockRestore();
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
                const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                    allMembers: allMembersMock,
                } as any);
                await (DatasetFSProvider.instance as any).fetchDataset(testUris.pdsMember, {
                    isRoot: false,
                    slashAfterProfilePos: testUris.pdsMember.path.indexOf("/", 1),
                    profileName: "sestest",
                    profile: testProfile,
                });
                expect(allMembersMock).toHaveBeenCalledWith("USER.DATA.PDS");
                mvsApiMock.mockRestore();
            });
        });
    });
    it("calls _handleError whenever an unknown filesystem error occurs", async () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockImplementation(() => {
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
        lookupMock.mockRestore();
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
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(fakePs);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSession);

        await DatasetFSProvider.instance.delete(testUris.ps, { recursive: false });
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePs.name, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        expect(_fireSoonMock).toHaveBeenCalled();

        expect(fakeSession.entries.has(fakePs.name)).toBe(false);
        mvsApiMock.mockRestore();
    });

    it("successfully deletes a PDS member", async () => {
        const fakePdsMember = { ...testEntries.pdsMember };
        const fakePds = new PdsEntry("USER.DATA.PDS");
        fakePds.entries.set("MEMBER1", fakePdsMember);
        const mockMvsApi = {
            deleteDataSet: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(fakePdsMember);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakePds);

        await DatasetFSProvider.instance.delete(testUris.pdsMember, { recursive: false });
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(`${fakePds.name}(${fakePdsMember.name})`, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.pdsMember, false);
        expect(_fireSoonMock).toHaveBeenCalled();

        expect(fakePds.entries.has(fakePdsMember.name)).toBe(false);
        mvsApiMock.mockRestore();
    });

    it("successfully deletes a PDS", async () => {
        const fakePds = { ...testEntries.pds };
        const mockMvsApi = {
            deleteDataSet: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(fakePds);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        const isPdsEntry = jest.spyOn(FsDatasetsUtils, "isPdsEntry").mockReturnValueOnce(true);
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce({ ...testEntries.session });

        await DatasetFSProvider.instance.delete(testUris.pds, { recursive: false });
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePds.name, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.pds, false);
        expect(_fireSoonMock).toHaveBeenCalled();

        mvsApiMock.mockRestore();
        isPdsEntry.mockRestore();
    });

    it("throws an error if it could not delete an entry", async () => {
        const fakePs = { ...testEntries.ps };
        const fakeSession = { ...testEntries.session, entries: new Map() };
        fakeSession.entries.set("USER.DATA.PS", fakePs);

        const sampleError = new Error("Data set does not exist on remote");
        const mockMvsApi = {
            deleteDataSet: jest.fn().mockRejectedValueOnce(sampleError),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(fakePs);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        const handleErrorMock = jest.spyOn(DatasetFSProvider.instance as any, "_handleError").mockResolvedValue(undefined);
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSession);

        await expect(DatasetFSProvider.instance.delete(testUris.ps, { recursive: false })).rejects.toThrow();
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePs.name, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        expect(_fireSoonMock).toHaveBeenCalled();
        expect(handleErrorMock).toHaveBeenCalledWith(
            sampleError,
            expect.objectContaining({
                additionalContext: "Failed to delete /USER.DATA.PS",
                apiType: ZoweExplorerApiType.Mvs,
                profileType: "zosmf",
            })
        );
        expect(fakeSession.entries.has(fakePs.name)).toBe(true);
        mvsApiMock.mockRestore();
    });
});

describe("makeEmptyDsWithEncoding", () => {
    it("creates an empty data set in the provider with the given encoding", () => {
        const fakeSession = { ...testEntries.session };
        const parentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSession);
        expect(DatasetFSProvider.instance.makeEmptyDsWithEncoding(testUris.ps, { kind: "binary" }));
        expect(fakeSession.entries.has(testEntries.ps.name)).toBe(true);
        parentDirMock.mockRestore();
    });
});

describe("rename", () => {
    it("renames a PS", async () => {
        const oldPs = { ...testEntries.ps };
        const mockMvsApi = {
            renameDataSet: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest
            .spyOn(DatasetFSProvider.instance as any, "lookup")
            .mockImplementation((uri): DirEntry | FileEntry => ((uri as Uri).path.includes("USER.DATA.PS2") ? (null as any) : oldPs));
        const _lookupParentDirectoryMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session })
            .mockReturnValueOnce({ ...testEntries.session });
        await DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: true });
        expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PS", "USER.DATA.PS2");
        _lookupMock.mockRestore();
        mvsApiMock.mockRestore();
        _lookupParentDirectoryMock.mockRestore();
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
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest
            .spyOn(DatasetFSProvider.instance as any, "lookup")
            .mockImplementation((uri): DirEntry | FileEntry => ((uri as Uri).path.includes("USER.DATA.PDS2") ? (undefined as any) : oldPds));
        const _lookupParentDirectoryMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await DatasetFSProvider.instance.rename(testUris.pds, testUris.pds.with({ path: "/USER.DATA.PDS2" }), { overwrite: true });
        expect(exampleMember.metadata.path).toBe("/USER.DATA.PDS2/TESTMEM");
        expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PDS", "USER.DATA.PDS2");
        _lookupMock.mockRestore();
        mvsApiMock.mockRestore();
        _lookupParentDirectoryMock.mockRestore();
    });

    it("throws an error if 'overwrite' is false and the entry already exists", async () => {
        const newPs = { ...testEntries.ps, name: "USER.DATA.PS2" };
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValueOnce(newPs);
        await expect(
            DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: false })
        ).rejects.toThrow("Rename failed: USER.DATA.PS2 already exists");
        _lookupMock.mockRestore();
    });

    it("displays an error message when renaming fails on the remote system", async () => {
        const oldPds = new PdsEntry("USER.DATA.PDS");
        oldPds.metadata = testEntries.pds.metadata;
        const sampleError = new Error("could not upload data set");
        const mockMvsApi = {
            renameDataSet: jest.fn().mockRejectedValueOnce(sampleError),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest
            .spyOn(DatasetFSProvider.instance as any, "lookup")
            .mockImplementation((uri): DirEntry | FileEntry => ((uri as Uri).path.includes("USER.DATA.PDS2") ? (undefined as any) : oldPds));
        const _lookupParentDirectoryMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
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
        _lookupMock.mockRestore();
        mvsApiMock.mockRestore();
        _lookupParentDirectoryMock.mockRestore();
    });
});
