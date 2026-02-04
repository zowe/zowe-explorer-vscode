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

jest.mock("@vscode/l10n", () => ({ t: (msg: string) => msg }));

import {
    getSortOrderDisplayName,
    getProfileSortOrderDisplayName,
    getNestedProperty,
} from "../../../../src/webviews/src/config-editor/utils/generalUtils";

describe("generalUtils", () => {
    describe("getSortOrderDisplayName", () => {
        it("returns localized label for alphabetical", () => {
            expect(getSortOrderDisplayName("alphabetical")).toBe("Alphabetical");
        });
        it("returns localized label for merged-first", () => {
            expect(getSortOrderDisplayName("merged-first")).toBe("Merged First");
        });
        it("returns localized label for non-merged-first", () => {
            expect(getSortOrderDisplayName("non-merged-first")).toBe("Merged Last");
        });
        it("returns sortOrder for unknown", () => {
            expect(getSortOrderDisplayName("custom" as any)).toBe("custom");
        });
    });

    describe("getProfileSortOrderDisplayName", () => {
        it("returns localized label for natural", () => {
            expect(getProfileSortOrderDisplayName("natural")).toBe("Natural");
        });
        it("returns localized label for alphabetical", () => {
            expect(getProfileSortOrderDisplayName("alphabetical")).toBe("Alphabetical");
        });
        it("returns localized label for reverse-alphabetical", () => {
            expect(getProfileSortOrderDisplayName("reverse-alphabetical")).toBe("Reverse Alphabetical");
        });
        it("returns localized label for type and defaults", () => {
            expect(getProfileSortOrderDisplayName("type")).toBe("By Type");
            expect(getProfileSortOrderDisplayName("defaults")).toBe("By Defaults");
        });
        it("returns sortOrder for unknown", () => {
            expect(getProfileSortOrderDisplayName("custom" as any)).toBe("custom");
        });
    });

    describe("getNestedProperty", () => {
        it("returns value at path", () => {
            const obj = { a: { b: { c: 1 } } };
            expect(getNestedProperty(obj, ["a", "b", "c"])).toBe(1);
        });
        it("returns undefined when segment missing", () => {
            const obj = { a: {} };
            expect(getNestedProperty(obj, ["a", "b"])).toBeUndefined();
        });
        it("returns undefined when obj is null", () => {
            expect(getNestedProperty(null, ["a"])).toBeUndefined();
        });
        it("returns top-level property", () => {
            const obj = { x: 42 };
            expect(getNestedProperty(obj, ["x"])).toBe(42);
        });
    });
});
