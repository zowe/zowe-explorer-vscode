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
    getEffectiveProfileKeys,
    planProfileRename,
    resolveProfileDestination,
} from "../../../../src/webviews/src/config-editor/utils/profileConflicts";
import { getOriginalProfileKeyWithNested, getRenamedProfileKeyWithNested } from "../../../../src/webviews/src/config-editor/utils/profileRenames";

describe("profile conflicts", () => {
    it("preserves independent identities when another profile reuses a vacated name", () => {
        const renames = { "/mock/team.json": planProfileRename({ a: "x" }, "b", "b", "a") };
        expect(renames["/mock/team.json"]).toEqual({ a: "x", b: "a" });
        expect(getRenamedProfileKeyWithNested("b.child", "/mock/team.json", renames)).toBe("a.child");
        expect(getOriginalProfileKeyWithNested("x.child", "/mock/team.json", renames)).toBe("a.child");
        expect(getOriginalProfileKeyWithNested("a.child", "/mock/team.json", renames)).toBe("b.child");
    });

    it("moves independently renamed children with their effective parent and supports cancellation", () => {
        const moved = planProfileRename({ a: "group.a", b: "group.a.b" }, "a", "group.a", "other.a");
        expect(moved).toEqual({ a: "other.a", b: "other.a.b" });
        expect(planProfileRename(moved, "a", "other.a", "a")).toEqual({ b: "a.b" });
    });

    it("resolves saved keys once and keeps pending profiles in their displayed namespace", () => {
        expect(getEffectiveProfileKeys(["a", "a.child", "b"], ["a.new"], { a: "x", b: "a" }, ["profiles.a.profiles.new"])).toEqual([
            "x",
            "x.child",
            "a",
        ]);
    });

    it.each(["reject", "suffix"] as const)("treats a move to the same location as a no-op with %s policy", (onConflict) => {
        expect(resolveProfileDestination({ proposedKey: "group.a", sourceKey: "group.a", profileKeys: ["group.a"], onConflict })).toEqual({
            status: "noop",
            key: "group.a",
        });
    });

    it("uses the same case-insensitive conflict check for manual names and automatic suffixes", () => {
        const params = { proposedKey: "group.a", profileKeys: ["group.A", "group.a_1", "group.A_2.child"] };
        expect(resolveProfileDestination({ ...params, onConflict: "reject" }).status).toBe("conflict");
        expect(resolveProfileDestination({ ...params, onConflict: "suffix" })).toEqual({ status: "ready", key: "group.a_3" });
    });

    it("permits a case-only rename of the same profile", () => {
        expect(resolveProfileDestination({ proposedKey: "A", sourceKey: "a", profileKeys: ["a", "a.child"], onConflict: "reject" })).toEqual({
            status: "ready",
            key: "A",
        });
    });

    it.each(["a.child", "a.__proto__", "a..child"])("rejects the invalid move to %s", (proposedKey) => {
        expect(resolveProfileDestination({ proposedKey, sourceKey: "a", profileKeys: ["a"], onConflict: "suffix" }).status).toBe("conflict");
    });
});
