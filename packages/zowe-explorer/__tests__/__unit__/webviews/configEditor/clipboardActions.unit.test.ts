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
import type { Configuration, PendingChange, ProfileSchemaMap } from "../../../../src/webviews/src/config-editor/types";
import { createEditorStore } from "../../../../src/webviews/src/config-editor/store/editorStore";

const CREDENTIALS = ["user", "password", "tokenType", "tokenValue", "tokenExpiration", "certFile", "certKeyFile", "certAccount", "privateKey"];
const configPath = "/mock/team.json";

// Mirrors the secure lists in zowe.schema.json: tokenType/tokenExpiration are intentionally not schema-secure.
const propertySchema: ProfileSchemaMap = {
    rse: {
        host: { type: "string", secure: false },
        port: { type: "number", secure: false },
        user: { type: "string", secure: true },
        password: { type: "string", secure: true },
        tokenType: { type: "string", secure: false },
        tokenValue: { type: "string", secure: true },
        tokenExpiration: { type: "string", secure: false },
    },
    ssh: {
        host: { type: "string", secure: false },
        privateKey: { type: "string", secure: false },
        keyPassphrase: { type: "string", secure: true },
    },
    tso: { account: { type: "string", secure: false } },
};

function makeEditor(options: { withSchema?: boolean } = {}) {
    const { withSchema = true } = options;
    const config: Configuration = {
        configPath,
        secure: [],
        properties: {
            profiles: {
                rseProf: {
                    type: "rse",
                    properties: { host: "example.com", port: 6800, encoding: "IBM-1047" },
                    secure: ["user", "password", "tokenValue"],
                    profiles: {
                        child: { type: "rse", properties: { host: "child.example.com" }, secure: ["password"] },
                    },
                },
                sshProf: { type: "ssh", properties: { host: "ssh.example.com", privateKey: "/key", keyPassphrase: "plain" } },
                tsoProf: { type: "tso", properties: { account: "ACCT" } },
                plain: { properties: { host: "untyped", password: "plain-text" } },
                group: { profiles: {} },
            },
            defaults: { rse: "rseProf" },
        },
    };
    const store = createEditorStore({ postMessage: vi.fn() });
    store.setState({
        configurations: [config],
        selectedTab: 0,
        selectedProfileKey: "rseProf",
        schemaValidations: withSchema ? { [configPath]: { propertySchema, validDefaults: ["rse", "ssh", "tso"] } } : {},
    });
    return { store, config };
}

type Store = ReturnType<typeof makeEditor>["store"];

const draftOf = (store: Store, profile: string): Record<string, PendingChange> =>
    Object.fromEntries(Object.entries(store.getState().pendingChanges[configPath] ?? {}).filter(([, change]) => change.profile === profile));
const draftProps = (store: Store, profile: string) =>
    Object.fromEntries(
        Object.values(draftOf(store, profile))
            .filter((change) => change.secure !== undefined && change.path.length === 1 && change.path[0] !== "secure")
            .map((change) => [change.path[0], change.value])
    );
const draftKeys = (store: Store, profile: string) => Object.keys(draftOf(store, profile));
const hasCredential = (store: Store, profile: string) =>
    draftKeys(store, profile).some((key) => CREDENTIALS.some((name) => key.endsWith(`.${name}`)));
const hasSecureField = (store: Store, profile: string) => draftKeys(store, profile).some((key) => key.endsWith(".secure"));

describe("clipboardActions credential guard", () => {
    describe("duplicateProfile", () => {
        it("creates the copy without user, password or token fields for an rse profile", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("rseProf");

            expect(store.getState().selectedProfileKey).toBe("rseProf_copy");
            expect(draftProps(store, "rseProf_copy")).toEqual({ host: "example.com", port: 6800, encoding: "IBM-1047" });
            expect(draftOf(store, "rseProf_copy")["profiles.rseProf_copy.type"].value).toBe("rse");
            expect(hasCredential(store, "rseProf_copy")).toBe(false);
            expect(hasSecureField(store, "rseProf_copy")).toBe(false);
        });

        it("strips credentials from descendant profiles", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("rseProf");

            expect(draftProps(store, "rseProf_copy.child")).toEqual({ host: "child.example.com" });
            expect(hasCredential(store, "rseProf_copy.child")).toBe(false);
            expect(hasSecureField(store, "rseProf_copy.child")).toBe(false);
        });

        it("drops pending edits to credential fields that are not in the secure array", () => {
            const { store } = makeEditor();
            store.getState().handleChange("profiles.rseProf.properties.tokenType", "jwtToken");
            store.getState().handleChange("profiles.rseProf.properties.tokenExpiration", "2030-01-01");
            store.getState().handleChange("profiles.rseProf.properties.host", "edited.example.com");
            store.getState().duplicateProfile("rseProf");

            expect(draftProps(store, "rseProf_copy")).toMatchObject({ host: "edited.example.com" });
            expect(hasCredential(store, "rseProf_copy")).toBe(false);
        });

        it("drops a user-flagged secure custom property", () => {
            const { store } = makeEditor();
            store.getState().setPendingChanges({
                [configPath]: {
                    "profiles.rseProf.properties.customSecret": { value: "s3cret", path: ["customSecret"], profile: "rseProf", secure: true },
                },
            });
            store.getState().duplicateProfile("rseProf");

            expect(draftKeys(store, "rseProf_copy").some((key) => key.endsWith(".customSecret"))).toBe(false);
        });

        it("drops a schema-secure property even when it is stored as plain text outside the secure array", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("sshProf");

            expect(draftProps(store, "sshProf_copy")).toEqual({ host: "ssh.example.com" });
        });

        it("falls back to the fixed credential list when no schema is loaded", () => {
            const { store } = makeEditor({ withSchema: false });
            store.getState().duplicateProfile("rseProf");
            expect(hasCredential(store, "rseProf_copy")).toBe(false);
            expect(draftProps(store, "rseProf_copy")).toEqual({ host: "example.com", port: 6800, encoding: "IBM-1047" });

            // keyPassphrase is only known through the schema, so without it the value is kept.
            store.getState().duplicateProfile("sshProf");
            expect(draftProps(store, "sshProf_copy")).toMatchObject({ keyPassphrase: "plain" });
        });

        it("drops fixed-list credentials from an untyped profile", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("plain");

            expect(draftProps(store, "plain_copy")).toEqual({ host: "untyped" });
        });

        it("copies a type with no credential properties unchanged", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("tsoProf");

            expect(draftProps(store, "tsoProf_copy")).toEqual({ account: "ACCT" });
        });

        it("leaves the source profile and its secure list untouched", () => {
            const { store, config } = makeEditor();
            const before = structuredClone(config.properties.profiles.rseProf);
            store.getState().duplicateProfile("rseProf");

            expect(config.properties.profiles.rseProf).toEqual(before);
            expect(draftKeys(store, "rseProf")).toEqual([]);
        });

        it("picks a unique name when duplicating repeatedly", () => {
            const { store } = makeEditor();
            store.getState().duplicateProfile("rseProf");
            store.getState().duplicateProfile("rseProf");

            expect(draftKeys(store, "rseProf_copy").length).toBeGreaterThan(0);
            expect(draftKeys(store, "rseProf_copy_1").length).toBeGreaterThan(0);
            expect(hasCredential(store, "rseProf_copy_1")).toBe(false);
        });

        it("does nothing when no configuration is selected", () => {
            const { store } = makeEditor();
            store.setState({ selectedTab: null });
            store.getState().duplicateProfile("rseProf");

            expect(store.getState().pendingChanges).toEqual({});
        });
    });

    describe("copyProfile", () => {
        it("stores a credential-free snapshot when copying", () => {
            const { store } = makeEditor();
            store.getState().copyProfile("rseProf", false);

            const clipboard = store.getState().profileClipboard;
            expect(clipboard.type).toBe("copy");
            expect(clipboard.profiles.rseProf.properties).toEqual({ host: "example.com", port: 6800, encoding: "IBM-1047" });
            expect(clipboard.profiles.rseProf.secure).toEqual([]);
            expect(clipboard.profiles.rseProf.secureSources).toEqual({});
            expect(clipboard.profiles["rseProf.child"].properties).toEqual({ host: "child.example.com" });
            expect(clipboard.profiles["rseProf.child"].secure).toEqual([]);
        });

        it("pastes a copied rse profile as a child without credentials", () => {
            const { store } = makeEditor();
            store.getState().copyProfile("rseProf", false);
            store.getState().pasteProfile("group");

            expect(store.getState().selectedProfileKey).toBe("group.rseProf");
            expect(draftProps(store, "group.rseProf")).toEqual({ host: "example.com", port: 6800, encoding: "IBM-1047" });
            expect(hasCredential(store, "group.rseProf")).toBe(false);
            expect(hasCredential(store, "group.rseProf.child")).toBe(false);
            expect(store.getState().profileClipboard?.type).toBe("copy");
        });

        it("pastes a copied rse profile at the root level without credentials", () => {
            const { store } = makeEditor();
            store.getState().copyProfile("rseProf", false);
            store.getState().pasteProfile(null);

            expect(store.getState().selectedProfileKey).toBe("rseProf_1");
            expect(hasCredential(store, "rseProf_1")).toBe(false);
            expect(hasSecureField(store, "rseProf_1")).toBe(false);
        });

        it("uses the schema when copying a plain-text schema-secure property", () => {
            const { store } = makeEditor();
            store.getState().copyProfile("sshProf", false);

            expect(store.getState().profileClipboard?.profiles.sshProf.properties).toEqual({ host: "ssh.example.com" });
        });

        it("keeps credentials in the clipboard when cutting, because a cut moves the profile", () => {
            const { store } = makeEditor();
            store.getState().copyProfile("rseProf", true);

            const profile = store.getState().profileClipboard.profiles.rseProf;
            expect(store.getState().profileClipboard?.type).toBe("cut");
            expect(profile.secure).toEqual(expect.arrayContaining(["user", "password", "tokenValue"]));
            expect(Object.keys(profile.properties)).toEqual(expect.arrayContaining(["user", "password", "tokenValue"]));
            expect(Object.keys(profile.secureSources ?? {})).toEqual(expect.arrayContaining(["user", "password", "tokenValue"]));
        });
    });

    describe("drag and drop", () => {
        it("keeps credentials on a profile that is moved with drag and drop", () => {
            const { store, config } = makeEditor();
            expect(store.getState().handleRenameProfile("rseProf", "group.rseProf", true)).toBe(true);

            expect(store.getState().renames[configPath]).toMatchObject({ rseProf: "group.rseProf" });
            // The move is a rename, so no copied values are written into the draft.
            expect(draftKeys(store, "group.rseProf")).toEqual([]);
            expect(config.properties.profiles.rseProf.secure).toEqual(["user", "password", "tokenValue"]);
        });
    });
});
