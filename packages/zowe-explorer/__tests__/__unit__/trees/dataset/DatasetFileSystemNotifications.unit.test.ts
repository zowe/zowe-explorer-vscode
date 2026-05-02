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
import { vi } from "vitest";

import { FileChangeType, Uri } from "vscode";
import * as vscode from "vscode";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { DsEntry, DsEntryMetadata, FilterEntry, PdsEntry, ZoweScheme, FsAbstractUtils } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";

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

        it("should not upload empty file on creation", async () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            vi.spyOn(DatasetFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const uploadEntrySpy = vi.spyOn(DatasetFSProvider.instance as any, "uploadEntry");
            vi.spyOn(DatasetFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array(); // Empty
            await DatasetFSProvider.instance.writeFile(testUris.ps, content, { create: true, overwrite: false });

            expect(uploadEntrySpy).not.toHaveBeenCalled();
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
});
