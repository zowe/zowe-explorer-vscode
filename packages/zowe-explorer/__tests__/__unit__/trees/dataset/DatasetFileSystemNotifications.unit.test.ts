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

import { FileChangeType, Uri } from "vscode";
import * as vscode from "vscode";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { DsEntry, DsEntryMetadata, FilterEntry, PdsEntry, ZoweScheme, FsAbstractUtils } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";

const testProfile = createIProfile();
const testEntries = {
    session: {
        ...new FilterEntry("sestest"),
        metadata: {
            profile: testProfile,
            path: "/",
        },
    },
    pds: {
        ...new PdsEntry("USER.DATA.PDS"),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PDS",
        }),
    } as PdsEntry,
};

const testUris = {
    session: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest" }),
    pds: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS" }),
    ps: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PS" }),
    pdsMember: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS/MEMBER1" }),
};

describe("DatasetFSProvider File System Notifications", () => {
    let mockedProperty: MockedProperty;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockedProperty = new MockedProperty(Profiles, "getInstance", {
            value: vi.fn().mockReturnValue({
                loadNamedProfile: vi.fn().mockReturnValue(testProfile),
                allProfiles: [],
                getProfileFromConfig: vi.fn(),
            } as any),
        });
        vi.spyOn(ProfilesUtils, "awaitExtenderType").mockImplementation((() => undefined) as any);
        vi.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
            allMembers: vi.fn().mockResolvedValue({ success: false, apiResponse: { items: [] } }),
            dataSet: vi.fn().mockResolvedValue({ success: false, apiResponse: { items: [] } }),
        } as any);
        vi.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
            isRoot: false,
            slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
            profileName: "sestest",
            profile: testProfile,
        });
        DatasetFSProvider.instance.requestCache.clear();
        Object.defineProperty(vscode.window, "visibleTextEditors", {
            get: () => [],
            configurable: true,
        });
    });

    afterEach(() => {
        mockedProperty?.[Symbol.dispose]();
    });

    afterAll(() => {
        delete (vscode.window as any).visibleTextEditors;
    });

    describe("createDirectory", () => {
        it("should create directory entry in parent", () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            DatasetFSProvider.instance.createDirectory(testUris.pds);

            expect(fakeSessionEntry.entries.has("USER.DATA.PDS")).toBe(true);
        });

        it("should not fire event if directory already exists", () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            fakeSessionEntry.entries.set("USER.DATA.PDS", testEntries.pds);
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const fireSoonSpy = vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            DatasetFSProvider.instance.createDirectory(testUris.pds);

            expect(fireSoonSpy).not.toHaveBeenCalled();
        });

        it("should update parent mtime and size when creating new directory", () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map(), mtime: 0, size: 0 };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const beforeCreate = Date.now();
            DatasetFSProvider.instance.createDirectory(testUris.pds);
            const afterCreate = Date.now();

            expect(fakeSessionEntry.mtime).toBeGreaterThanOrEqual(beforeCreate);
            expect(fakeSessionEntry.mtime).toBeLessThanOrEqual(afterCreate);
            expect(fakeSessionEntry.size).toBe(1);
        });
    });

    describe("writeFile - New Entry Creation", () => {
        it("should fire Created event when creating a new PS entry", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            const fireSoonSpy = vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: false });

            // Should fire Created event for new entry
            const createdCalls = fireSoonSpy.mock.calls.filter((call) =>
                Array.isArray(call[0]) ? call[0].some((e) => e?.type === FileChangeType.Created) : call[0]?.type === FileChangeType.Created
            );
            expect(createdCalls.length).toBeGreaterThan(0);
        });

        it("should create new DsEntry as PDS member when creating in PDS", async () => {
            const fakePdsEntry = { ...testEntries.pds, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakePdsEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await DatasetFSProvider.instance.writeFile(testUris.pdsMember, content, { create: true, overwrite: false });

            const memberEntry = fakePdsEntry.entries.get("MEMBER1") as DsEntry;
            expect(memberEntry).toBeDefined();
            expect(memberEntry.isMember).toBe(true);
        });

        it("should still upload an empty file on creation to ensure the remote data set exists", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const uploadEntrySpy = vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array(); // Empty
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: false });

            expect(uploadEntrySpy).toHaveBeenCalled();
        });
    });

    describe("writeFile - Remote existence check (overwrite: false)", () => {
        it("should throw FileExists when a new PS entry already exists remotely", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const dataSetMock = vi.fn().mockResolvedValue({ success: true, apiResponse: { items: [{ dsname: "USER.DATA.PS" }] } });
            vi.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: vi.fn(),
                dataSet: dataSetMock,
            } as any);
            const uploadEntrySpy = vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry");
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await expect(DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: false })).rejects.toThrow(
                vscode.FileSystemError.FileExists(testUris.ps).message
            );

            expect(dataSetMock).toHaveBeenCalledWith("USER.DATA.PS");
            expect(uploadEntrySpy).not.toHaveBeenCalled();
            expect(fakeSessionEntry.entries.has("USER.DATA.PS")).toBe(false);
        });

        it("should throw FileExists when a new PDS member already exists remotely", async () => {
            const fakePdsEntry = { ...testEntries.pds, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakePdsEntry);
            const allMembersMock = vi.fn().mockResolvedValue({ success: true, apiResponse: { items: [{ member: "MEMBER1" }] } });
            vi.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: allMembersMock,
                dataSet: vi.fn(),
            } as any);
            const uploadEntrySpy = vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry");
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await expect(DatasetFSProvider.instance.writeFile(testUris.pdsMember, content, { create: true, overwrite: false })).rejects.toThrow(
                vscode.FileSystemError.FileExists(testUris.pdsMember).message
            );

            expect(allMembersMock).toHaveBeenCalledWith("USER.DATA.PDS");
            expect(uploadEntrySpy).not.toHaveBeenCalled();
            expect(fakePdsEntry.entries.has("MEMBER1")).toBe(false);
        });

        it("should proceed with creation when the entry does not exist remotely", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const dataSetMock = vi.fn().mockResolvedValue({ success: true, apiResponse: { items: [] } });
            vi.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: vi.fn(),
                dataSet: dataSetMock,
            } as any);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: false });

            expect(dataSetMock).toHaveBeenCalledWith("USER.DATA.PS");
            expect(fakeSessionEntry.entries.has("USER.DATA.PS")).toBe(true);
        });

        it("should not perform a remote existence check when overwrite is true", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const dataSetMock = vi.fn();
            const allMembersMock = vi.fn();
            vi.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
                allMembers: allMembersMock,
                dataSet: dataSetMock,
            } as any);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: true });

            expect(dataSetMock).not.toHaveBeenCalled();
            expect(allMembersMock).not.toHaveBeenCalled();
        });
    });

    describe("writeFile - Existing Entry Updates", () => {
        it("should fire Changed event after write to existing entry", async () => {
            const existingEntry = new DsEntry("USER.DATA.PS", false);
            existingEntry.metadata = new DsEntryMetadata({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });
            existingEntry.data = new Uint8Array();
            existingEntry.wasAccessed = true;

            const fakeSessionEntry = { ...testEntries.session, entries: new Map([["USER.DATA.PS", existingEntry]]) };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            const fireSoonSpy = vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([4, 5, 6]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: false, overwrite: true });

            // Should fire Changed event for existing entry
            const changedCalls = fireSoonSpy.mock.calls.filter((call) =>
                Array.isArray(call[0]) ? call[0].some((e) => e?.type === FileChangeType.Changed) : call[0]?.type === FileChangeType.Changed
            );
            expect(changedCalls.length).toBeGreaterThan(0);
        });

        it("should update entry properties after successful write", async () => {
            const existingEntry = new DsEntry("USER.DATA.PS", false);
            existingEntry.metadata = new DsEntryMetadata({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });
            existingEntry.data = new Uint8Array();
            existingEntry.mtime = 0;
            existingEntry.size = 0;
            existingEntry.wasAccessed = true;

            const fakeSessionEntry = { ...testEntries.session, entries: new Map([["USER.DATA.PS", existingEntry]]) };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3, 4, 5]);
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: false, overwrite: true });

            expect(existingEntry.data).toEqual(content);
            expect(existingEntry.size).toBe(5);
            expect(existingEntry.mtime).toBeGreaterThan(0);
            expect(existingEntry.etag).toBe("NEWTAG");
        });
    });

    describe("writeFile - Diff View", () => {
        it("should handle diff view writes without API calls", async () => {
            const existingEntry = new DsEntry("USER.DATA.PS", false);
            existingEntry.metadata = new DsEntryMetadata({
                profile: testProfile,
                path: "/USER.DATA.PS",
            });
            existingEntry.data = new Uint8Array();
            existingEntry.wasAccessed = true;

            const fakeSessionEntry = { ...testEntries.session, entries: new Map([["USER.DATA.PS", existingEntry]]) };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const uploadEntrySpy = vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry");
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const diffUri = testUris.ps.with({ query: "inDiff=true" });
            const content = new Uint8Array([1, 2, 3]);
            await DatasetFSProvider.instance.writeFile(diffUri, content, { create: false, overwrite: true });

            expect(uploadEntrySpy).not.toHaveBeenCalled();
            expect(existingEntry.inDiffView).toBe(true);
            expect(existingEntry.data).toEqual(content);
        });
    });

    describe("fireSoon - parent PDS notifications", () => {
        const bufferedEvents = (): vscode.FileChangeEvent[] => (DatasetFSProvider.instance as any)._bufferedEvents;

        beforeEach(() => {
            bufferedEvents().length = 0;
        });

        it.each([
            ["created", FileChangeType.Created],
            ["deleted", FileChangeType.Deleted],
        ])("fires a Changed event on the parent PDS when a member is %s", (_label, type) => {
            DatasetFSProvider.instance.fireSoon({ type, uri: testUris.pdsMember });

            const events = bufferedEvents();
            expect(events).toHaveLength(2);
            expect(events[0]).toMatchObject({ type, uri: testUris.pdsMember });
            expect(events[1].type).toBe(FileChangeType.Changed);
            expect(events[1].uri.path).toBe(testUris.pds.path);
            expect(events[1].uri.scheme).toBe(ZoweScheme.DS);
        });

        it("reports the parent PDS once when several of its members change", () => {
            const otherMember = testUris.pds.with({ path: `${testUris.pds.path}/MEMBER2` });
            DatasetFSProvider.instance.fireSoon(
                { type: FileChangeType.Created, uri: testUris.pdsMember },
                { type: FileChangeType.Deleted, uri: otherMember }
            );

            const changedEvents = bufferedEvents().filter((event) => event.type === FileChangeType.Changed);
            expect(changedEvents).toHaveLength(1);
            expect(changedEvents[0].uri.path).toBe(testUris.pds.path);
        });

        it("does not report the parent PDS again if it is already queued in the batch", () => {
            DatasetFSProvider.instance.fireSoon({ type: FileChangeType.Created, uri: testUris.pdsMember });
            DatasetFSProvider.instance.fireSoon({ type: FileChangeType.Deleted, uri: testUris.pdsMember });

            expect(bufferedEvents().filter((event) => event.type === FileChangeType.Changed)).toHaveLength(1);
        });

        it("does not add a parent event for a Changed event on a member", () => {
            DatasetFSProvider.instance.fireSoon({ type: FileChangeType.Changed, uri: testUris.pdsMember });

            expect(bufferedEvents()).toEqual([{ type: FileChangeType.Changed, uri: testUris.pdsMember }]);
        });

        it.each([
            ["a sequential data set", "ps"],
            ["a PDS", "pds"],
        ])("does not add a parent event for %s", (_label, uriKey) => {
            DatasetFSProvider.instance.fireSoon({ type: FileChangeType.Created, uri: testUris[uriKey] });

            expect(bufferedEvents()).toHaveLength(1);
        });
    });
});
