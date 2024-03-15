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

import { DirEntry, FileEntry, FilterEntry, findDocMatchingUri, getInfoForUri, isDirectoryEntry, isFileEntry, isFilterEntry } from "../../../../src";
import { MockedProperty } from "../../../../__mocks__/mockUtils";
import * as vscode from "vscode";

const fakeUri = vscode.Uri.from({ scheme: "zowe-uss", path: "/test.lpar/file.txt" });

describe("getInfoForUri", () => {
    it("returns the correct info for an inner URI", () => {
        expect(getInfoForUri(fakeUri)).toStrictEqual({
            isRoot: false,
            slashAfterProfilePos: fakeUri.path.indexOf("/", 1),
            profileName: "test.lpar",
            profile: null,
        });
    });

    it("returns the correct info for a root URI", () => {
        expect(getInfoForUri(vscode.Uri.from({ scheme: "zowe-uss", path: "/test.lpar" }))).toStrictEqual({
            isRoot: true,
            slashAfterProfilePos: -1,
            profileName: "test.lpar",
            profile: null,
        });
    });
});

describe("findDocMatchingUri", () => {
    it("returns a TextDocument if found", () => {
        const fakeDoc = { uri: fakeUri };
        const mockedTextDocs = new MockedProperty(vscode.workspace, "textDocuments", undefined, [fakeDoc]);
        expect(findDocMatchingUri(fakeUri)).toBe(fakeDoc);
        mockedTextDocs[Symbol.dispose]();
    });

    it("returns undefined if not found", () => {
        const mockedTextDocs = new MockedProperty(vscode.workspace, "textDocuments", undefined, []);
        expect(findDocMatchingUri(fakeUri)).toBeUndefined();
        mockedTextDocs[Symbol.dispose]();
    });
});

describe("isDirectoryEntry", () => {
    it("returns true if value is a DirEntry", () => {
        const dirEntry = new DirEntry("testFolder");
        expect(isDirectoryEntry(dirEntry)).toBe(true);
    });

    it("returns false if value is not a SpoolEntry", () => {
        const file = new FileEntry("test");
        expect(isDirectoryEntry(file)).toBe(false);
    });
});

describe("isFileEntry", () => {
    it("returns true if value is a FileEntry", () => {
        const file = new FileEntry("test");
        expect(isFileEntry(file)).toBe(true);
    });

    it("returns false if value is not a FileEntry", () => {
        const dirEntry = new DirEntry("testFolder");
        expect(isFileEntry(dirEntry)).toBe(false);
    });
});

describe("isFilterEntry", () => {
    it("returns true if value is a FilterEntry", () => {
        const filterEntry = new FilterEntry("testFilter");
        expect(isFilterEntry(filterEntry)).toBe(true);
    });

    it("returns false if value is not a FilterEntry", () => {
        const file = new FileEntry("test");
        expect(isFilterEntry(file)).toBe(false);
    });
});
