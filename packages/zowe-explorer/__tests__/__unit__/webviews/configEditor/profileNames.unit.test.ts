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

import {
    isValidProfileNamePath,
    isValidProfileNameSegment,
    sanitizeProfileNamePath,
    sanitizeProfileNameSegment,
} from "../../../../src/webviews/src/config-editor/utils/profileNames";

describe("profileNames", () => {
    describe("sanitizeProfileNameSegment", () => {
        it("keeps hyphens, underscores, letters and digits", () => {
            expect(sanitizeProfileNameSegment("my-test_profile1")).toBe("my-test_profile1");
        });
        it("strips dots, since they denote nesting rather than being part of a name", () => {
            expect(sanitizeProfileNameSegment("bad.name")).toBe("badname");
        });
        it("strips spaces and other punctuation that arrive via paste", () => {
            expect(sanitizeProfileNameSegment("bad name.x!")).toBe("badnamex");
        });
        it("strips non-ASCII characters", () => {
            expect(sanitizeProfileNameSegment("süd-lpar")).toBe("sd-lpar");
        });
    });

    describe("sanitizeProfileNamePath", () => {
        it("preserves dots so a full path survives", () => {
            expect(sanitizeProfileNamePath("lpar1.my-zosmf")).toBe("lpar1.my-zosmf");
        });
        it("still strips disallowed characters", () => {
            expect(sanitizeProfileNamePath("lpar 1.zos!mf")).toBe("lpar1.zosmf");
        });
    });

    describe("isValidProfileNameSegment", () => {
        it("accepts a hyphenated name", () => {
            expect(isValidProfileNameSegment("my-profile")).toBe(true);
        });
        it("rejects an empty name", () => {
            expect(isValidProfileNameSegment("")).toBe(false);
        });
        it("rejects a dotted name", () => {
            expect(isValidProfileNameSegment("a.b")).toBe(false);
        });
        it.each(["__proto__", "constructor", "prototype"])("rejects the reserved name %s", (name) => {
            expect(isValidProfileNameSegment(name)).toBe(false);
        });
    });

    describe("isValidProfileNamePath", () => {
        it("accepts dot-separated valid segments", () => {
            expect(isValidProfileNamePath("lpar1.my-zosmf")).toBe(true);
        });
        it("rejects leading, trailing and consecutive dots", () => {
            expect(isValidProfileNamePath(".lpar1")).toBe(false);
            expect(isValidProfileNamePath("lpar1.")).toBe(false);
            expect(isValidProfileNamePath("lpar1..zosmf")).toBe(false);
        });
        it("rejects a path containing a reserved segment", () => {
            expect(isValidProfileNamePath("lpar1.__proto__")).toBe(false);
        });
    });
});
