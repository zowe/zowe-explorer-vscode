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
import { UssFile, UssDirectory, FilterEntry, ZoweScheme, FsAbstractUtils } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { AuthHandler } from "@zowe/zowe-explorer-api";
import { Mock } from "vitest";

const testProfile = createIProfile();
const testEntries = {
    session: {
        ...new FilterEntry("sestest"),
        metadata: {
            profile: testProfile,
            path: "/",
        },
    },
    folder: {
        ...new UssDirectory("folderName"),
        metadata: {
            profile: testProfile,
            path: "/u/myuser/folderName",
        },
    } as UssDirectory,
};

const testUris = {
    session: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest" }),
    folder: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/u/myuser/folderName" }),
    file: Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/u/myuser/folderName/file.txt" }),
};

describe("UssFSProvider File System Notifications", () => {
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
            slashAfterProfilePos: testUris.file.path.indexOf("/", 1),
            profileName: "sestest",
            profile: testProfile,
        });
        UssFSProvider.instance.requestCache.clear();
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
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            UssFSProvider.instance.createDirectory(testUris.folder);

            expect(fakeSessionEntry.entries.has("folderName")).toBe(true);
        });

        it("should not fire event if directory already exists", () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map() };
            fakeSessionEntry.entries.set("folderName", testEntries.folder);
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            const fireSoonSpy = vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            UssFSProvider.instance.createDirectory(testUris.folder);

            expect(fireSoonSpy).not.toHaveBeenCalled();
        });

        it("should update parent mtime and size when creating new directory", () => {
            const fakeSessionEntry = { ...testEntries.session, entries: new Map(), mtime: 0, size: 0 };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeSessionEntry);
            vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const beforeCreate = Date.now();
            UssFSProvider.instance.createDirectory(testUris.folder);
            const afterCreate = Date.now();

            expect(fakeSessionEntry.mtime).toBeGreaterThanOrEqual(beforeCreate);
            expect(fakeSessionEntry.mtime).toBeLessThanOrEqual(afterCreate);
            expect(fakeSessionEntry.size).toBe(1);
        });
    });

    describe("writeFile - New Entry Creation", () => {
        it("should fire Created event when creating a new file entry", async () => {
            const fakeFolderEntry = { ...testEntries.folder, entries: new Map() };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeFolderEntry);
            vi.spyOn(UssFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            const fireSoonSpy = vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3]);
            await UssFSProvider.instance.writeFile(testUris.file, content, { create: true, overwrite: false });

            // Should fire Created event for new entry
            const createdCalls = fireSoonSpy.mock.calls.filter((call) =>
                Array.isArray(call[0]) ? call[0].some((e) => e?.type === FileChangeType.Created) : call[0]?.type === FileChangeType.Created
            );
            expect(createdCalls.length).toBeGreaterThan(0);
        });

        it("should still upload an empty file on creation to ensure the remote file exists", async () => {
            const fakeFolderEntry = { ...testEntries.folder, entries: new Map() };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeFolderEntry);
            const uploadEntrySpy = vi.spyOn(UssFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array(); // Empty
            await UssFSProvider.instance.writeFile(testUris.file, content, { create: true, overwrite: false });

            expect(uploadEntrySpy).toHaveBeenCalledWith(expect.anything(), content, expect.objectContaining({ forceUpload: false }));
        });
    });

    describe("writeFile - Existing Entry Updates", () => {
        it("should fire Changed event after write to existing entry", async () => {
            const existingEntry = new UssFile("file.txt");
            existingEntry.metadata = {
                profile: testProfile,
                path: "/u/myuser/folderName/file.txt",
            };
            existingEntry.data = new Uint8Array();
            existingEntry.wasAccessed = true;

            const fakeFolderEntry = { ...testEntries.folder, entries: new Map([["file.txt", existingEntry]]) };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeFolderEntry);
            vi.spyOn(UssFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            const fireSoonSpy = vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([4, 5, 6]);
            await UssFSProvider.instance.writeFile(testUris.file, content, { create: false, overwrite: true });

            // Should fire Changed event for existing entry
            const changedCalls = fireSoonSpy.mock.calls.filter((call) =>
                Array.isArray(call[0]) ? call[0].some((e) => e?.type === FileChangeType.Changed) : call[0]?.type === FileChangeType.Changed
            );
            expect(changedCalls.length).toBeGreaterThan(0);
        });

        it("should update entry properties after successful write", async () => {
            const existingEntry = new UssFile("file.txt");
            existingEntry.metadata = {
                profile: testProfile,
                path: "/u/myuser/folderName/file.txt",
            };
            existingEntry.data = new Uint8Array();
            existingEntry.mtime = 0;
            existingEntry.size = 0;
            existingEntry.wasAccessed = true;

            const fakeFolderEntry = { ...testEntries.folder, entries: new Map([["file.txt", existingEntry]]) };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeFolderEntry);
            vi.spyOn(UssFSProvider.instance as any, "uploadEntry").mockResolvedValue({
                apiResponse: { etag: "NEWTAG" },
            });
            vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const content = new Uint8Array([1, 2, 3, 4, 5]);
            await UssFSProvider.instance.writeFile(testUris.file, content, { create: false, overwrite: true });

            expect(existingEntry.data).toEqual(content);
            expect(existingEntry.size).toBe(5);
            expect(existingEntry.mtime).toBeGreaterThan(0);
            expect(existingEntry.etag).toBe("NEWTAG");
        });
    });

    describe("writeFile - Diff View", () => {
        it("should handle diff view writes without API calls", async () => {
            const existingEntry = new UssFile("file.txt");
            existingEntry.metadata = {
                profile: testProfile,
                path: "/u/myuser/folderName/file.txt",
            };
            existingEntry.data = new Uint8Array();
            existingEntry.wasAccessed = true;

            const fakeFolderEntry = { ...testEntries.folder, entries: new Map([["file.txt", existingEntry]]) };
            vi.spyOn(UssFSProvider.instance as any, "lookupParentDirectory").mockReturnValue(fakeFolderEntry);
            const uploadEntrySpy = vi.spyOn(UssFSProvider.instance as any, "uploadEntry");
            vi.spyOn(UssFSProvider.instance as any, "fireSoon");

            const diffUri = testUris.file.with({ query: "inDiff=true" });
            const content = new Uint8Array([1, 2, 3]);
            await UssFSProvider.instance.writeFile(diffUri, content, { create: false, overwrite: true });

            expect(uploadEntrySpy).not.toHaveBeenCalled();
            expect(existingEntry.inDiffView).toBe(true);
            expect(existingEntry.data).toEqual(content);
        });
    });

    describe("fireSoon - parent directory notifications", () => {
        const bufferedEvents = (): vscode.FileChangeEvent[] => (UssFSProvider.instance as any)._bufferedEvents;

        beforeEach(() => {
            bufferedEvents().length = 0;
        });

        it.each([
            ["created", FileChangeType.Created],
            ["deleted", FileChangeType.Deleted],
        ])("fires a Changed event on the parent directory when an entry is %s", (_label, type) => {
            UssFSProvider.instance.fireSoon({ type, uri: testUris.file });

            const events = bufferedEvents();
            expect(events).toHaveLength(2);
            expect(events[0]).toMatchObject({ type, uri: testUris.file });
            expect(events[1].type).toBe(FileChangeType.Changed);
            expect(events[1].uri.path).toBe(testUris.folder.path);
            expect(events[1].uri.scheme).toBe(ZoweScheme.USS);
        });

        it("reports the parent directory once when several of its entries change", () => {
            const otherFile = testUris.folder.with({ path: `${testUris.folder.path}/other.txt` });
            UssFSProvider.instance.fireSoon({ type: FileChangeType.Created, uri: testUris.file }, { type: FileChangeType.Deleted, uri: otherFile });

            const changedEvents = bufferedEvents().filter((event) => event.type === FileChangeType.Changed);
            expect(changedEvents).toHaveLength(1);
            expect(changedEvents[0].uri.path).toBe(testUris.folder.path);
        });

        it("does not duplicate a parent event the caller already included", () => {
            // `delete` reports the parent itself, so the override must not add a second Changed event.
            UssFSProvider.instance.fireSoon(
                { type: FileChangeType.Changed, uri: testUris.folder },
                { type: FileChangeType.Deleted, uri: testUris.file }
            );

            expect(bufferedEvents().filter((event) => event.type === FileChangeType.Changed)).toHaveLength(1);
        });

        it("does not add a parent event for a Changed event on a file", () => {
            UssFSProvider.instance.fireSoon({ type: FileChangeType.Changed, uri: testUris.file });

            expect(bufferedEvents()).toEqual([{ type: FileChangeType.Changed, uri: testUris.file }]);
        });

        it("does not add a parent event for a profile root", () => {
            UssFSProvider.instance.fireSoon({ type: FileChangeType.Created, uri: testUris.session });

            expect(bufferedEvents()).toHaveLength(1);
        });
    });

    describe("fetchEntries - remote change notifications", () => {
        const DEBOUNCE_FLUSH_MS = 25;

        const uriInfo = (): any => ({
            isRoot: false,
            slashAfterProfilePos: testUris.folder.path.indexOf("/", 1),
            profileName: "sestest",
            profile: testProfile,
        });

        /** Builds a directory entry whose cache is already populated with the given file names. */
        const cachedDirectory = (...fileNames: string[]): UssDirectory => {
            const directory = new UssDirectory("folderName");
            directory.metadata = testEntries.folder.metadata;
            for (const name of fileNames) {
                const file = new UssFile(name);
                file.metadata = { ...directory.metadata, path: `${directory.metadata.path}/${name}` };
                directory.entries.set(name, file);
            }
            return directory;
        };

        /**
         * Mocks the next `listFiles` response.
         * @param items File names to return, or `undefined` to simulate a response carrying no item array
         */
        const mockListing = (items?: string[], success = true): Mock => {
            const listFiles = vi.fn().mockResolvedValue({
                success,
                apiResponse: items != null ? { items: items.map((name) => ({ name })) } : {},
                commandResponse: "",
            });
            vi.spyOn(UssFSProvider.instance, "listFiles").mockImplementation(listFiles as any);
            return listFiles;
        };

        /**
         * Lists the directory and returns every event `onDidChangeFile` emitted while doing so. The
         * events are copied as the batch arrives, since `fireSoon` empties its buffer in place.
         */
        const refresh = async (directory: UssDirectory): Promise<vscode.FileChangeEvent[]> => {
            vi.spyOn(UssFSProvider.instance, "exists").mockReturnValue(true);
            vi.spyOn(UssFSProvider.instance as any, "lookup").mockReturnValue(directory);

            const emitted: vscode.FileChangeEvent[] = [];
            const subscription = UssFSProvider.instance.onDidChangeFile((events) => emitted.push(...events));
            try {
                await (UssFSProvider.instance as any).fetchEntries(testUris.folder, uriInfo());
                await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_FLUSH_MS));
            } finally {
                subscription.dispose();
            }
            return emitted;
        };

        const eventsOfType = (events: vscode.FileChangeEvent[], type: vscode.FileChangeType): string[] =>
            events.filter((event) => event.type === type).map((event) => event.uri.path);

        beforeEach(() => {
            const provider = UssFSProvider.instance as any;
            clearTimeout(provider._fireSoonHandle);
            provider._fireSoonHandle = undefined;
            provider._bufferedEvents.length = 0;

            vi.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValue({
                getCommonApi: () => ({ getSession: () => ({ ISession: {} }) }),
                registeredApiTypes: () => ["zosmf"],
            } as any);
            vi.spyOn(ProfilesUtils, "hasNoAuthType").mockReturnValue(false);
            vi.spyOn(AuthUtils, "ensureAuthNotCancelled").mockImplementation((() => undefined) as any);
            vi.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);
            vi.spyOn(AuthHandler, "isProfileLocked").mockReturnValue(false);
        });

        it("emits Created for a file added since the last listing, and Changed for its directory", async () => {
            mockListing(["file.txt", "newFile.txt"]);

            const events = await refresh(cachedDirectory("file.txt"));

            expect(eventsOfType(events, FileChangeType.Created)).toEqual(["/sestest/u/myuser/folderName/newFile.txt"]);
            expect(eventsOfType(events, FileChangeType.Changed)).toEqual(["/sestest/u/myuser/folderName"]);
            expect(eventsOfType(events, FileChangeType.Deleted)).toEqual([]);
        });

        it("emits Deleted for a cached entry missing from the listing, and Changed for its directory", async () => {
            mockListing(["file.txt"]);

            const events = await refresh(cachedDirectory("file.txt", "goneFile.txt"));

            expect(eventsOfType(events, FileChangeType.Deleted)).toEqual(["/sestest/u/myuser/folderName/goneFile.txt"]);
            expect(eventsOfType(events, FileChangeType.Changed)).toEqual(["/sestest/u/myuser/folderName"]);
            expect(eventsOfType(events, FileChangeType.Created)).toEqual([]);
        });

        it("drops entries that disappeared remotely from the cache", async () => {
            mockListing(["file.txt"]);
            const directory = cachedDirectory("file.txt", "goneFile.txt");

            await refresh(directory);

            expect(directory.entries.has("goneFile.txt")).toBe(false);
            expect([...directory.entries.keys()]).toEqual(["file.txt"]);
        });

        it("emits nothing when consecutive listings return the same entries", async () => {
            mockListing(["file.txt"]);
            const directory = cachedDirectory("file.txt");

            expect(await refresh(directory)).toEqual([]);
            expect(await refresh(directory)).toEqual([]);
        });

        it("keeps the cache and emits nothing when the listing carries no item array", async () => {
            mockListing(undefined, false);
            const directory = cachedDirectory("file.txt", "other.txt");

            expect(await refresh(directory)).toEqual([]);
            expect([...directory.entries.keys()]).toEqual(["file.txt", "other.txt"]);
        });

        it("emits nothing for an initial listing, so an empty cache is not reported as mass creation", async () => {
            mockListing(["file.txt", "other.txt"]);
            const directory = cachedDirectory();

            expect(await refresh(directory)).toEqual([]);
            expect([...directory.entries.keys()]).toEqual(["file.txt", "other.txt"]);
        });
    });
});
