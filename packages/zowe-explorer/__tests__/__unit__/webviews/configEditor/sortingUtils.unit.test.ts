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

import { sortProfilesAtLevel } from "../../../../src/webviews/src/config-editor/utils/sortingUtils";

describe("sortingUtils", () => {
    describe("sortProfilesAtLevel", () => {
        it("returns same order for natural", () => {
            const keys = ["c", "a", "b"];
            expect(sortProfilesAtLevel(keys, "natural")).toEqual(["c", "a", "b"]);
        });
        it("returns same order when profileSortOrder is null", () => {
            const keys = ["x", "y"];
            expect(sortProfilesAtLevel(keys, null)).toEqual(["x", "y"]);
        });
        it("sorts alphabetically at top level", () => {
            const keys = ["c", "a", "b"];
            expect(sortProfilesAtLevel(keys, "alphabetical")).toEqual(["a", "b", "c"]);
        });
        it("sorts reverse-alphabetically at top level", () => {
            const keys = ["a", "c", "b"];
            expect(sortProfilesAtLevel(keys, "reverse-alphabetical")).toEqual(["c", "b", "a"]);
        });
        it("sorts nested profiles alphabetically when parent included", () => {
            const keys = ["parent", "parent.c", "parent.a", "parent.b"];
            const result = sortProfilesAtLevel(keys, "alphabetical");
            expect(result[0]).toBe("parent");
            expect(result.slice(1)).toEqual(["parent.a", "parent.b", "parent.c"]);
        });
        it("preserves parent-then-children order", () => {
            const keys = ["b", "a", "a.nested"];
            const result = sortProfilesAtLevel(keys, "alphabetical");
            const aIdx = result.indexOf("a");
            const aNestedIdx = result.indexOf("a.nested");
            expect(aIdx).toBeLessThan(aNestedIdx);
        });
        it("type and defaults keep natural order", () => {
            const keys = ["z", "a"];
            expect(sortProfilesAtLevel(keys, "type")).toEqual(["z", "a"]);
            expect(sortProfilesAtLevel(keys, "defaults")).toEqual(["z", "a"]);
        });
    });
});
