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

import { DirEntry, FileEntry, FilterEntry, ProfilesCache, ZoweScheme, imperative } from "../../../../src";
import { MockedProperty } from "../../../../__mocks__/mockUtils";
import * as vscode from "vscode";
import { FsAbstractUtils } from "../../../../src/fs/utils/FsAbstractUtils";

const fakeUri = vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/test.lpar/file.txt" });

describe("getInfoForUri", () => {
    it("returns the correct info for an inner URI", () => {
        expect(FsAbstractUtils.getInfoForUri(fakeUri)).toStrictEqual({
            isRoot: false,
            slashAfterProfilePos: fakeUri.path.indexOf("/", 1),
            profileName: "test.lpar",
            profile: null,
        });
    });

    it("returns the correct info for a root URI", () => {
        expect(FsAbstractUtils.getInfoForUri(vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/test.lpar" }))).toStrictEqual({
            isRoot: true,
            slashAfterProfilePos: -1,
            profileName: "test.lpar",
            profile: null,
        });
    });

    it("returns profile properties for URI with valid profile when profiles cache is provided", () => {
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
        const fakeProfile: Partial<imperative.IProfileLoaded> = {
            name: "test.lpar",
            type: "zosmf",
            profile: { port: 443 },
        };
        jest.spyOn(profilesCache, "loadNamedProfile").mockReturnValue(fakeProfile as imperative.IProfileLoaded);
        expect(FsAbstractUtils.getInfoForUri(fakeUri, profilesCache)).toStrictEqual({
            isRoot: false,
            slashAfterProfilePos: fakeUri.path.indexOf("/", 1),
            profileName: "test.lpar",
            profile: fakeProfile,
        });
    });

    it("throws error for URI with invalid profile when profiles cache is provided", () => {
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
        expect(() => FsAbstractUtils.getInfoForUri(fakeUri, profilesCache)).toThrow("Could not find profile named: test.lpar");
    });
});

describe("findDocMatchingUri", () => {
    it("returns a TextDocument if found", () => {
        const fakeDoc = { uri: fakeUri };
        const mockedTextDocs = new MockedProperty(vscode.workspace, "textDocuments", undefined, [fakeDoc]);
        expect(FsAbstractUtils.findDocMatchingUri(fakeUri)).toBe(fakeDoc);
        mockedTextDocs[Symbol.dispose]();
    });

    it("returns undefined if not found", () => {
        const mockedTextDocs = new MockedProperty(vscode.workspace, "textDocuments", undefined, []);
        expect(FsAbstractUtils.findDocMatchingUri(fakeUri)).toBeUndefined();
        mockedTextDocs[Symbol.dispose]();
    });
});

describe("isDirectoryEntry", () => {
    it("returns true if value is a DirEntry", () => {
        const dirEntry = new DirEntry("testFolder");
        expect(FsAbstractUtils.isDirectoryEntry(dirEntry)).toBe(true);
    });

    it("returns false if value is not a DirEntry", () => {
        const file = new FileEntry("test");
        expect(FsAbstractUtils.isDirectoryEntry(file)).toBe(false);
    });
});

describe("isFileEntry", () => {
    it("returns true if value is a FileEntry", () => {
        const file = new FileEntry("test");
        expect(FsAbstractUtils.isFileEntry(file)).toBe(true);
    });

    it("returns false if value is not a FileEntry", () => {
        const dirEntry = new DirEntry("testFolder");
        expect(FsAbstractUtils.isFileEntry(dirEntry)).toBe(false);
    });
});

describe("isFilterEntry", () => {
    it("returns true if value is a FilterEntry", () => {
        const filterEntry = new FilterEntry("testFilter");
        expect(FsAbstractUtils.isFilterEntry(filterEntry)).toBe(true);
    });

    it("returns false if value is not a FilterEntry", () => {
        const file = new FileEntry("test");
        expect(FsAbstractUtils.isFilterEntry(file)).toBe(false);
    });
});

describe("getApiOrThrowUnavailable", () => {
    const profile: imperative.IProfileLoaded = { name: "test", type: "custom", profile: {} } as imperative.IProfileLoaded;

    it("returns the API when registered and getter succeeds", () => {
        const api = FsAbstractUtils.getApiOrThrowUnavailable(profile, () => ({ test: true }), { apiName: "Test API", registeredTypes: ["custom"] });
        expect(api).toEqual({ test: true });
    });

    it("throws FileSystemError.Unavailable when profile type is not registered", () => {
        expect(() => FsAbstractUtils.getApiOrThrowUnavailable(profile, () => ({ test: true }), { apiName: "Test API", registeredTypes: [] })).toThrow(
            vscode.FileSystemError
        );
    });

    it("throws FileSystemError.Unavailable when getter throws a non-existing error", () => {
        expect(() =>
            FsAbstractUtils.getApiOrThrowUnavailable(
                profile,
                () => {
                    throw new Error("Internal error: Tried to call a non-existing Test API");
                },
                { apiName: "Test API", registeredTypes: ["custom"] }
            )
        ).toThrow(vscode.FileSystemError);
    });

    it("rethrows other errors from the getter", () => {
        const expected = new Error("unexpected");
        expect(() =>
            FsAbstractUtils.getApiOrThrowUnavailable(
                profile,
                () => {
                    throw expected;
                },
                { apiName: "Test API", registeredTypes: ["custom"] }
            )
        ).toThrow(expected);
    });
});
