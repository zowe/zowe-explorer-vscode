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
import { DirEntry, DsEntry, FileEntry, FilterEntry, Gui, PdsEntry, ZoweScheme } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { MockedProperty } from "../../../__mocks__/mockUtils";

const testProfile = createIProfile();
const testEntries = {
    ps: {
        ...new DsEntry("USER.DATA.PS"),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PS",
        },
        etag: "OLDETAG",
    } as DsEntry,
    pds: {
        ...new PdsEntry("USER.DATA.PDS"),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PDS",
        },
    } as PdsEntry,
    pdsMember: {
        ...new DsEntry("MEMBER1"),
        metadata: {
            profile: testProfile,
            path: "/USER.DATA.PDS/MEMBER1",
        },
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
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
        const lookupAsFileMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(fakePo);
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
            .mockReturnValueOnce({ ...testEntries.ps, metadata: { profile: null } });

        await expect(DatasetFSProvider.instance.readFile(testUris.ps)).rejects.toThrow("file not found");
        expect(_lookupAsFileMock).toHaveBeenCalledWith(testUris.ps);
        _lookupAsFileMock.mockRestore();
    });

    it("calls fetchDatasetAtUri if the entry has not yet been accessed", async () => {
        const _lookupAsFileMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.ps, wasAccessed: false });
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
            getContents: jest.fn().mockResolvedValueOnce({
                apiResponse: {
                    etag: "NEWETAG",
                },
            }),
            uploadFromBuffer: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const statusMsgMock = jest.spyOn(Gui, "setStatusBarMessage");
        const psEntry = { ...testEntries.ps, metadata: testEntries.ps.metadata } as DsEntry;
        const sessionEntry = { ...testEntries.session };
        sessionEntry.entries.set("USER.DATA.PS", psEntry);
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(sessionEntry);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(psEntry);
        const newContents = new Uint8Array([3, 6, 9]);
        await DatasetFSProvider.instance.writeFile(testUris.ps, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.ps);
        expect(statusMsgMock).toHaveBeenCalledWith("$(sync~spin) Saving data set...");
        expect(mockMvsApi.uploadFromBuffer).toHaveBeenCalledWith(Buffer.from(newContents), testEntries.ps.name, {
            etag: testEntries.ps.etag,
            returnEtag: true,
        });
        expect(psEntry.etag).toBe("NEWETAG");
        expect(psEntry.data).toBe(newContents);
        mvsApiMock.mockRestore();
        lookupMock.mockRestore();
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
        expect(psEntry.data.length).toBe(0);
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
        expect(psEntry.data.length).toBe(0);
        expect(psEntry.inDiffView).toBe(true);
    });

    it("throws an error if entry doesn't exist and 'create' option is false", async () => {
        await expect(DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: false, overwrite: true })).rejects.toThrow(
            "file not found"
        );
    });

    it("throws an error if entry exists and 'overwrite' option is false", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.ps, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        await expect(DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false })).rejects.toThrow(
            "file exists"
        );
        lookupParentDirMock.mockRestore();
    });

    it("throws an error if the given URI is an existing PDS", async () => {
        const session = {
            ...testEntries.session,
            entries: new Map([[testEntries.ps.name, { ...testEntries.pds }]]),
        };
        const lookupParentDirMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(session);
        await expect(DatasetFSProvider.instance.writeFile(testUris.ps, new Uint8Array([]), { create: true, overwrite: false })).rejects.toThrow(
            "file is a directory"
        );
        lookupParentDirMock.mockRestore();
    });
});

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

describe("delete", () => {
    it("successfully deletes a PS entry", async () => {
        const fakePs = { ...testEntries.ps };
        const fakeSession = { ...testEntries.session, entries: new Map() };
        fakeSession.entries.set("USER.DATA.PS", fakePs);
        const mockMvsApi = {
            deleteDataSet: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(fakePs);
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
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(fakePdsMember);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakePds);

        await DatasetFSProvider.instance.delete(testUris.pdsMember, { recursive: false });
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(`${fakePds.name}(${fakePdsMember.name})`, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.pdsMember, false);
        expect(_fireSoonMock).toHaveBeenCalled();

        expect(fakePds.entries.has(fakePdsMember.name)).toBe(false);
        mvsApiMock.mockRestore();
    });

    it("throws an error if it could not delete an entry", async () => {
        const fakePs = { ...testEntries.ps };
        const fakeSession = { ...testEntries.session, entries: new Map() };
        fakeSession.entries.set("USER.DATA.PS", fakePs);
        const mockMvsApi = {
            deleteDataSet: jest.fn().mockRejectedValueOnce(new Error("Data set does not exist on remote")),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(fakePs);
        const _fireSoonMock = jest.spyOn(DatasetFSProvider.instance as any, "_fireSoon").mockImplementation();
        const errorMsgMock = jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSession);

        await DatasetFSProvider.instance.delete(testUris.ps, { recursive: false });
        expect(mockMvsApi.deleteDataSet).toHaveBeenCalledWith(fakePs.name, { responseTimeout: undefined });
        expect(_lookupMock).toHaveBeenCalledWith(testUris.ps, false);
        expect(_fireSoonMock).toHaveBeenCalled();
        expect(errorMsgMock).toHaveBeenCalledWith("Deleting /USER.DATA.PS failed due to API error: Data set does not exist on remote");
        expect(fakeSession.entries.has(fakePs.name)).toBe(true);
        mvsApiMock.mockRestore();
        errorMsgMock.mockRestore();
    });
});

describe("rename", () => {
    it("renames a PS", async () => {
        const oldPs = { ...testEntries.ps };
        const mockMvsApi = {
            renameDataSetMember: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookup")
            .mockImplementation((uri): DirEntry | FileEntry => ((uri as Uri).path.includes("USER.DATA.PS2") ? (null as any) : oldPs));
        const _lookupParentDirectoryMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: true });
        expect(mockMvsApi.renameDataSetMember).toHaveBeenCalledWith("", "USER.DATA.PS", "USER.DATA.PS2");
        _lookupMock.mockRestore();
        mvsApiMock.mockRestore();
        _lookupParentDirectoryMock.mockRestore();
    });

    it("renames a PDS", async () => {
        const oldPds = new PdsEntry("USER.DATA.PDS");
        oldPds.metadata = testEntries.pds.metadata;
        const mockMvsApi = {
            renameDataSet: jest.fn(),
        };
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce(mockMvsApi as any);
        const _lookupMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookup")
            .mockImplementation((uri): DirEntry | FileEntry => ((uri as Uri).path.includes("USER.DATA.PDS2") ? (undefined as any) : oldPds));
        const _lookupParentDirectoryMock = jest
            .spyOn(DatasetFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await DatasetFSProvider.instance.rename(testUris.pds, testUris.pds.with({ path: "/USER.DATA.PDS2" }), { overwrite: true });
        expect(mockMvsApi.renameDataSet).toHaveBeenCalledWith("USER.DATA.PDS", "USER.DATA.PDS2");
        _lookupMock.mockRestore();
        mvsApiMock.mockRestore();
        _lookupParentDirectoryMock.mockRestore();
    });

    it("throws an error if 'overwrite' is false and the entry already exists", async () => {
        const newPs = { ...testEntries.ps, name: "USER.DATA.PS2" };
        const _lookupMock = jest.spyOn(DatasetFSProvider.instance as any, "_lookup").mockReturnValueOnce(newPs);
        await expect(
            DatasetFSProvider.instance.rename(testUris.ps, testUris.ps.with({ path: "/USER.DATA.PS2" }), { overwrite: false })
        ).rejects.toThrow("file exists");
        _lookupMock.mockRestore();
    });
});
