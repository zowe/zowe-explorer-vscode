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
    buildClipboardChanges,
    clearCutProfileDefaults,
    collectClipboardProfiles,
    getUniqueProfileKey,
    removeCutProfileChanges,
} from "../../../../src/webviews/src/config-editor/utils/profileClipboard";
import type { Configuration, PendingChangesMap, ProfileClipboard } from "../../../../src/webviews/src/config-editor/types";

describe("profileClipboard", () => {
    const configPath = "/source";
    const configurations: Configuration[] = [
        {
            configPath,
            secure: [],
            properties: {
                profiles: {
                    parent: {
                        type: "zosmf",
                        description: "custom field",
                        properties: { host: "old", password: "secret", options: { timeout: 10 } },
                        secure: ["password"],
                        profiles: { child: { properties: { port: 443 } } },
                    },
                    unrelated: { properties: { host: "other" } },
                },
            },
        },
    ];
    const pendingChanges: PendingChangesMap = {
        [configPath]: {
            "profiles.parent.properties.host": { value: "new", profile: "parent", path: ["host"] },
            "profiles.parent.properties.options.timeout": { value: 20, profile: "parent", path: ["options", "timeout"] },
            "profiles.parent.profiles.newChild.properties.user": { value: "user", profile: "parent.newChild", path: ["user"], secure: true },
        },
    };
    const collect = () =>
        collectClipboardProfiles({
            profileKey: "parent",
            profileKeys: ["parent", "parent.child", "unrelated"],
            pendingProfiles: { "parent.newChild": {} },
            getProfileType: (key) => (key === "parent" ? "zosmf" : null),
            selectedTab: 0,
            configurations,
            pendingChanges,
            renames: {},
        });

    it("captures saved and pending descendants without mutating saved nested values", () => {
        const profiles = collect();
        expect(Object.keys(profiles)).toEqual(["parent", "parent.child", "parent.newChild"]);
        expect(profiles.parent).toMatchObject({
            properties: { host: "new", options: { timeout: 20 } },
            secure: ["password"],
            customFields: { description: "custom field" },
        });
        expect(profiles["parent.newChild"].secure).toEqual(["user"]);
        expect(configurations[0].properties.profiles.parent.properties.options.timeout).toBe(10);
        profiles.parent.properties.host = "clipboard edit";
        expect(pendingChanges[configPath]["profiles.parent.properties.host"].value).toBe("new");
    });

    it("rebases types, properties, secure arrays and custom fields without sharing clipboard values", () => {
        const profiles = collect();
        const changes = buildClipboardChanges(profiles, "parent", "target.copy");
        expect(changes["profiles.target.profiles.copy.type"]).toEqual({ value: "zosmf", path: ["type"], profile: "target.copy" });
        expect(changes["profiles.target.profiles.copy.properties.password"]).toMatchObject({ value: "secret", secure: true, profile: "target.copy" });
        expect(changes["profiles.target.profiles.copy.secure"].value).toEqual(["password"]);
        expect(changes["profiles.target.profiles.copy.description"].value).toBe("custom field");
        expect(changes["profiles.target.profiles.copy.profiles.newChild.properties.user"]).toMatchObject({
            secure: true,
            profile: "target.copy.newChild",
        });
        expect(changes["profiles.target.profiles.copy.properties.options"].value).not.toBe(profiles.parent.properties.options);
    });

    it("finds the first free numeric suffix", () => {
        expect(getUniqueProfileKey("parent_copy", ["parent_copy", "parent_copy_1", "parent_copy_3"])).toBe("parent_copy_2");
        expect(getUniqueProfileKey("free", [])).toBe("free");
    });

    it("cleans only the cut subtree's source edits and defaults, preserving existing state", () => {
        const clipboard: ProfileClipboard = { type: "cut", sourceKey: "parent", configPath, profiles: collect() };
        const edits: PendingChangesMap = {
            ...pendingChanges,
            [configPath]: { ...pendingChanges[configPath], unrelated: { value: "keep", profile: "parentOther", path: [] } },
            "/target": { target: { value: "keep", profile: "target", path: [] } },
        };
        const next = removeCutProfileChanges(edits, clipboard);
        expect(Object.keys(next[configPath])).toEqual(["unrelated"]);
        expect(next["/target"]).toBe(edits["/target"]);
        expect(Object.keys(edits[configPath])).toHaveLength(4);
        const defaults = { [configPath]: { child: { value: "parent.child", path: ["child"] }, other: { value: "parentOther", path: ["other"] } } };
        expect(clearCutProfileDefaults(defaults, { zosmf: "parent", other: "parentOther", invalidDefault: 123 }, clipboard)[configPath]).toEqual({
            child: { value: "", path: ["child"] },
            zosmf: { value: "", path: ["zosmf"] },
            other: defaults[configPath].other,
        });
        expect(defaults[configPath].child.value).toBe("parent.child");
    });
});
