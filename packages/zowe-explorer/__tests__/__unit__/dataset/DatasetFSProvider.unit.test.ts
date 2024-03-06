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

import { Disposable, FileType, TextEditor, Uri } from "vscode";
import { DatasetFSProvider } from "../../../src/dataset/DatasetFSProvider";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { DirEntry, FileEntry, FilterEntry } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { MockedProperty } from "../../../__mocks__/mockUtils";

const testProfile = createIProfile();
const testEntries = {
    ps: {
        name: "USER.DATA.PS",
        data: new Uint8Array(),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PS",
        },
        type: FileType.File,
    } as FileEntry,
    pds: {
        name: "USER.DATA.PDS",
        entries: new Map(),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PDS",
        },
        type: FileType.Directory,
    } as DirEntry,
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
    ps: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PS" }),
    pds: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS" }),
    pdsMember: Uri.from({ scheme: "zowe-ds", path: "/sestest/USER.DATA.PDS/MEMBER1" }),
    session: Uri.from({ scheme: "zowe-ds", path: "/sestest" }),
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
            mockSessionEntry.filter["pattern"] = "USER.*";
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
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.readDirectory(testUris.session)).toStrictEqual([
                ["USER.DATA.DS", FileType.File],
                ["USER.DATA.PDS", FileType.Directory],
                ["USER.DATA.MIGRATED", FileType.File],
                ["USER.DATA.DS2", FileType.File],
            ]);
            expect(mockMvsApi.dataSetsMatchingPattern).toHaveBeenCalledWith([mockSessionEntry.filter["pattern"]]);
            _lookupAsDirectoryMock.mockRestore();
            mvsApiMock.mockRestore();
        });

        it("calls dataSet if dataSetsMatchingPattern API is unavailable", async () => {
            const mockSessionEntry = { ...testEntries.session, filter: {}, metadata: { profile: testProfile, path: "/" } };
            mockSessionEntry.filter["pattern"] = "USER.*";
            const mockMvsApi = {
                dataSet: jest.fn().mockResolvedValueOnce({
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
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.readDirectory(testUris.session)).toStrictEqual([
                ["USER.DATA.DS", FileType.File],
                ["USER.DATA.PDS", FileType.Directory],
                ["USER.DATA.MIGRATED", FileType.File],
                ["USER.DATA.DS2", FileType.File],
            ]);
            expect(mockMvsApi.dataSet).toHaveBeenCalledWith(mockSessionEntry.filter["pattern"]);
            _lookupAsDirectoryMock.mockRestore();
            mvsApiMock.mockRestore();
        });
    });

    describe("PDS entry", () => {
        it("calls allMembers to fetch the members of a PDS", async () => {
            const mockPdsEntry = { ...testEntries.pds, metadata: { ...testEntries.pds.metadata } };
            const mockMvsApi = {
                allMembers: jest.fn().mockResolvedValueOnce({
                    apiResponse: {
                        items: [{ member: "MEMB1" }, { member: "MEMB2" }, { member: "MEMB3" }, { member: "MEMB4" }],
                    },
                }),
            };
            const _lookupAsDirectoryMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(mockPdsEntry);
            const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
            expect(await DatasetFSProvider.instance.readDirectory(testUris.pds)).toStrictEqual([
                ["MEMB1", FileType.File],
                ["MEMB2", FileType.File],
                ["MEMB3", FileType.File],
                ["MEMB4", FileType.File],
            ]);
            expect(mockMvsApi.allMembers).toHaveBeenCalledWith(testEntries.pds.name);
            _lookupAsDirectoryMock.mockRestore();
            mvsApiMock.mockRestore();
        });
    });
});
describe("fetchDatasetAtUri", () => {
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockResolvedValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps);
        expect(fakePo.data.toString()).toStrictEqual(contents.toString());
        expect(fakePo.etag).toBe("123ANETAG");

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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockResolvedValueOnce(fakePo);
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps, {} as TextEditor);
        expect(fakePo.data.toString()).toStrictEqual(contents.toString());
        expect(fakePo.etag).toBe("123ANETAG");

        lookupAsFileMock.mockRestore();
        mvsApiMock.mockRestore();
        _updateResourceInEditorMock.mockRestore();
    });
});
describe("readFile", () => {
    it("throws an error if the entry does not have a profile", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockResolvedValueOnce({ ...testEntries.ps, metadata: { profile: null } });

        await expect(DatasetFSProvider.instance.readFile(testUris.ps)).rejects.toThrow("file not found");
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        _lookupAsFileMock.mockRestore();
    });

    it("calls fetchDatasetAtUri if the entry has not yet been accessed", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockResolvedValueOnce({ ...testEntries.ps, wasAccessed: false });
        const _getInfoFromUriMock = jest.spyOn(DatasetFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce({
            profile: testProfile,
            path: "/USER.DATA.PS",
        });
        const fetchDatasetAtUriMock = jest.spyOn(DatasetFSProvider.instance, "fetchDatasetAtUri").mockImplementation();

        await DatasetFSProvider.instance.readFile(testUris.ps);
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        expect(fetchDatasetAtUriMock).toHaveBeenCalled();
        fetchDatasetAtUriMock.mockRestore();
        _getInfoFromUriMock.mockRestore();
    });

    it("returns the data for an entry", async () => {
        const fakePs = { ...testEntries.ps, wasAccessed: true, data: new Uint8Array([1, 2, 3]) };
        const _lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockResolvedValueOnce(fakePs);
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

xdescribe("writeFile", () => {});

describe("watch", () => {
    it("returns an empty Disposable object", () => {
        expect(DatasetFSProvider.instance.watch(testUris.pds, { recursive: false, excludes: [] })).toStrictEqual(new Disposable(() => {}));
    });
});
describe("stat", () => {
    it("returns the result of the 'lookup' function", () => {
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockImplementation();
        DatasetFSProvider.instance.stat(testUris.ps);
        expect(lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        lookupMock.mockRestore();
    });
});
describe("updateFilterForUri", () => {
    it("returns early if the entry is not a FilterEntry", () => {
        const fakeEntry = { ...testEntries.ps };
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(fakeEntry);
        DatasetFSProvider.instance.updateFilterForUri(testUris.ps, "SOME.PATTERN.*");
        expect(fakeEntry).not.toHaveProperty("filter");
        _lookupMock.mockRestore();
    });

    it("updates the filter on a FilterEntry", () => {
        const fakeEntry = { ...testEntries.session };
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(fakeEntry);
        DatasetFSProvider.instance.updateFilterForUri(testUris.session, "SOME.PATTERN.*");
        expect(fakeEntry.filter).toStrictEqual({ pattern: "SOME.PATTERN.*" });
        _lookupMock.mockRestore();
    });
});

xdescribe("delete", () => {});
xdescribe("rename", () => {});
