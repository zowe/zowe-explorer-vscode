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

import { mapProfilePath, splitProfilePath, applyRenameChainToProfileName } from "../../../../src/webviews/src/config-editor/utils/profilePaths";
import { profileKeyToPath } from "../../../../src/webviews/src/config-editor/utils/configUtils";

describe("profileKeyToPath", () => {
    it.each([
        ["base", ["profiles", "base"]],
        ["base.child.leaf", ["profiles", "base", "profiles", "child", "profiles", "leaf"]],
        ["profiles.type", ["profiles", "profiles", "profiles", "type"]],
    ])("builds the JSON path for %s without discarding name segments", (key, path) => {
        expect(profileKeyToPath(key as string)).toEqual(path);
    });
});

describe("profile paths", () => {
    it("preserves profile names that resemble JSON field names", () => {
        const path = ["profiles", "properties", "profiles", "type", "secure", "password"];
        expect(splitProfilePath(path)).toEqual({ profileKey: "properties.type", suffix: ["secure", "password"] });
        expect(mapProfilePath(path, () => "renamed.child")).toEqual(["profiles", "renamed", "profiles", "child", "secure", "password"]);
        expect(path).toEqual(["profiles", "properties", "profiles", "type", "secure", "password"]);
    });

    it("leaves property-only paths and properties containing profiles untouched", () => {
        expect(mapProfilePath(["properties", "host"], () => "renamed")).toEqual(["properties", "host"]);
        expect(mapProfilePath("profiles.base.properties.profiles.host", () => "renamed")).toBe("profiles.renamed.properties.profiles.host");
    });

    it("resolves each original identity once even when another profile reuses its name", () => {
        const renames = Array.from({ length: 15 }, (_, index) => ({
            originalKey: `p${index}`,
            newKey: `p${index + 1}`,
            configPath: "/mock/team.json",
        }));
        expect(applyRenameChainToProfileName("p0.child", renames)).toBe("p1.child");
        expect(applyRenameChainToProfileName("a", [{ originalKey: "a", newKey: "a.child", configPath: "/mock/team.json" }])).toBe("a.child");
        expect(
            applyRenameChainToProfileName("a", [
                { originalKey: "a", newKey: "b", configPath: "/mock/team.json" },
                { originalKey: "b", newKey: "a", configPath: "/mock/team.json" },
            ])
        ).toBe("b");
    });

    it("retains the original array when no rename applies", () => {
        const path = ["profiles", "base", "type"];
        expect(mapProfilePath(path, (key) => key)).toBe(path);
    });
});
