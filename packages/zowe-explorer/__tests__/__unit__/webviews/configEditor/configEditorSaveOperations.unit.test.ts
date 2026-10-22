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
import * as vscode from "vscode";
import type { IConfigLayer } from "@zowe/imperative";
import { Gui } from "@zowe/zowe-explorer-api";
import { createEditorConfig } from "../../../__mocks__/mockCreators/configEditor";
import { ConfigEditorProfileOperations } from "../../../../src/utils/ConfigEditorProfileOperations";
import { ConfigEditorSaveOperations } from "../../../../src/utils/ConfigEditorSaveOperations";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigChangeHandlers } from "../../../../src/utils/ConfigChangeHandlers";
import { createEditorStore } from "../../../../src/webviews/src/config-editor/store/editorStore";
import type { SaveChangesMessage } from "../../../../src/utils/ConfigTypes";

vi.mock("../../../../src/configuration/Profiles", () => ({ Profiles: { getInstance: () => ({ refresh: vi.fn() }) } }));
vi.mock("../../../../src/utils/FavoritePersistenceUtils", () => ({
    FavoritePersistenceUtils: {
        applyProfileRenameToStoredTreePersistence: vi.fn(),
        fireAndForgetExplorerTreeRebuildAfterRename: vi.fn(),
    },
}));
vi.mock("@zowe/zowe-explorer-api", () => ({ Gui: { warningMessage: vi.fn() }, ZoweVsCodeExtension: {}, ProfilesCache: {}, FileManagement: {} }));
vi.mock("vscode", () => ({
    l10n: { t: (message: string) => message },
    workspace: { fs: { readFile: vi.fn(), writeFile: vi.fn() }, textDocuments: [] },
    Uri: { file: (fsPath: string) => ({ fsPath }) },
}));

function setup() {
    const layers: IConfigLayer[] = [
        {
            path: "/mock/team.json",
            user: false,
            global: false,
            exists: true,
            properties: {
                profiles: {
                    base: {
                        type: "base",
                        properties: { host: "original", password: "synthetic-credential" },
                        secure: ["password"],
                        profiles: { leaf: { type: "zosmf", properties: { host: "child" } } },
                    },
                },
                defaults: { base: "base", zosmf: "base.leaf" },
            },
        },
        { path: "/mock/user.json", user: true, global: false, exists: true, properties: { profiles: {}, defaults: {} } },
    ];
    const memory = createEditorConfig(layers);
    const bytes = Buffer.from("synthetic file revision");
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(bytes);
    vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue(undefined);
    vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue(memory.profileInfo);
    const configs = layers.map((layer) => {
        const properties = structuredClone(layer.properties);
        ConfigUtils.processProfilesRecursively(properties.profiles);
        return { configPath: layer.path, properties, secure: [], revision: ConfigEditorSaveOperations.revision(bytes) };
    });
    const store = createEditorStore({ postMessage: vi.fn() });
    store.setState({ configurations: configs, selectedTab: 0, selectedProfileKey: "base" });
    const payload = (): SaveChangesMessage =>
        ({
            command: "SAVE_CHANGES",
            ...store.getState().formatPendingChanges(),
            revisions: Object.fromEntries(configs.map((config) => [config.configPath, config.revision])),
        }) as SaveChangesMessage;
    const save = () => new ConfigEditorSaveOperations().save(payload(), async () => true);
    return { ...memory, store, configs, payload, commit: save };
}

describe("ConfigEditorSaveOperations", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.mocked(Gui.warningMessage).mockResolvedValue(undefined);
    });

    it("redirects edits and deletions independently when layers rename the same profile", () => {
        setup();
        const row = (configPath: string) => ({
            configPath,
            profile: "base",
            key: "profiles.base.properties.host",
            path: ["profiles", "base", "properties", "host"],
            value: "new",
            secure: false,
        });
        const changes = [row("/mock/team.json"), row("/mock/user.json")];
        const result = new ConfigEditorProfileOperations().updateProfileChangesForRenames({ changes, deletions: changes }, [
            { configPath: "/mock/team.json", originalKey: "base", newKey: "team" },
            { configPath: "/mock/user.json", originalKey: "base", newKey: "user" },
        ]);
        for (const rows of [result.changes, result.deletions]) {
            expect(rows?.map((change) => [change.profile, change.key, change.path])).toEqual([
                ["team", "profiles.team.properties.host", ["profiles", "team", "properties", "host"]],
                ["user", "profiles.user.properties.host", ["profiles", "user", "properties", "host"]],
            ]);
        }
        expect(changes.map((change) => change.profile)).toEqual(["base", "base"]);
        expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
    });

    it("preserves profiles dragged beneath a newly added unsaved parent", async () => {
        const { store, saved, commit, configs } = setup();
        store.setState({ wizardProfileName: "group", wizardSelectedType: "", wizardProperties: [] });
        store.getState().handleWizardCreateProfile();
        expect(store.getState().handleRenameProfile("base", "group.base", true)).toBe(true);
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles.group.profiles?.base).toMatchObject({
            properties: { host: "original", password: "synthetic-credential" },
            profiles: { leaf: { properties: { host: "child" } } },
        });
    });

    it("cuts a renamed subtree across layers without losing properties or stored credentials", async () => {
        const { store, saved, commit, configs } = setup();
        expect(store.getState().handleRenameProfile("base", "renamed")).toBe(true);
        store.getState().copyProfile("renamed", true);
        expect(JSON.stringify(store.getState().profileClipboard)).not.toContain("synthetic-credential");
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        expect(saved.get(configs[1].configPath)?.profiles.renamed).toMatchObject({
            type: "base",
            properties: { host: "original", password: "synthetic-credential" },
            secure: ["password"],
            profiles: { leaf: { type: "zosmf", properties: { host: "child" } } },
        });
    });

    it.each(["cut", "copy"])("preserves unset secure fields in a subprofile during cross-layer %s", async (operation) => {
        const { store, config, saved, commit, configs } = setup();
        config.set("profiles.base.profiles.leaf.secure", ["password", "tokenValue"]);
        configs[0].properties.profiles.base.profiles.leaf.secure = ["password", "tokenValue"];
        store.getState().copyProfile("base", operation === "cut");
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);

        await expect(commit()).resolves.toBe(true);

        const destination = saved.get(configs[1].configPath)?.profiles.base;
        expect(destination.properties.password).toBe("synthetic-credential");
        expect(destination.profiles.leaf.secure).toEqual(["password", "tokenValue"]);
        expect(destination.profiles.leaf.properties).toEqual({ host: "child" });
        expect(saved.get(configs[0].configPath)?.profiles.base !== undefined).toBe(operation === "copy");
    });

    it("preserves an explicitly empty secure value during a cross-layer move", async () => {
        const { store, config, saved, commit, configs } = setup();
        config.set("profiles.base.properties.password", "", { secure: true });
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);

        await expect(commit()).resolves.toBe(true);

        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        expect(saved.get(configs[1].configPath)?.profiles.base).toMatchObject({ properties: { password: "" }, secure: ["password"] });
    });

    it("rejects an unavailable source profile before saving", async () => {
        const { store, config, saved, commit, configs, save } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        config.delete("profiles.base");
        await expect(commit()).rejects.toThrow("source profile is unavailable");
        expect(save).not.toHaveBeenCalled();
        expect(saved.get(configs[0].configPath)?.profiles.base).toBeDefined();
    });

    it("rejects a secure-storage load failure before deleting the source", async () => {
        const { store, config, saved, commit, configs, save } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        vi.spyOn(config.api.secure, "loadFailed", "get").mockReturnValue(true);

        await expect(commit()).rejects.toThrow("Secure storage could not be loaded");

        expect(save).not.toHaveBeenCalled();
        expect(saved.get(configs[0].configPath)?.profiles.base).toBeDefined();
    });

    it("moves the latest source edits and new descendants made after Cut", async () => {
        const { store, saved, commit, configs } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleChange("profiles.base.properties.host", "edited after cut");
        store.getState().handleChange("profiles.base.properties.password", "new synthetic credential");
        store.setState({ wizardProfileName: "newChild", wizardRootProfile: "base", wizardSelectedType: "", wizardProperties: [] });
        store.getState().handleWizardCreateProfile();
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        expect(saved.get(configs[1].configPath)?.profiles.base).toMatchObject({
            properties: { host: "edited after cut", password: "new synthetic credential" },
            secure: ["password"],
            profiles: { newChild: { properties: {} }, leaf: { type: "zosmf" } },
        });
    });

    it("follows a rename made after Cut and respects property and subtree deletions", async () => {
        const { store, saved, commit, configs } = setup();
        store.getState().copyProfile("base", true);
        expect(store.getState().handleRenameProfile("base", "renamed")).toBe(true);
        store.getState().confirmDeleteProperty("profiles.renamed.properties.host");
        store.getState().confirmDeleteProperty("profiles.renamed.properties.password", true);
        store.getState().confirmDeleteProfile("renamed.leaf");
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        const moved = saved.get(configs[1].configPath)?.profiles.renamed;
        expect(moved).toBeDefined();
        expect(moved.properties).toEqual({});
        expect(moved.profiles?.leaf).toBeUndefined();
        expect(moved.secure ?? []).not.toContain("password");
    });

    it("preserves empty grouping profiles and empty descendants when moving across layers", async () => {
        const { store, config, saved, commit, configs } = setup();
        const profiles = { empty: {}, group: { profiles: { empty: {} } } };
        config.api.layers.set({ profiles, defaults: {} });
        store.setState({ configurations: [{ ...configs[0], properties: { profiles, defaults: {} } }, configs[1]], selectedProfileKey: "empty" });
        store.getState().copyProfile("empty", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        store.getState().handleTabChange(0);
        store.getState().copyProfile("group", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        expect(saved.get(configs[1].configPath)?.profiles).toMatchObject({ empty: {}, group: { profiles: { empty: {} } } });
    });

    it("does not paste or delete a Cut source that has since been deleted", () => {
        const { store } = setup();
        store.getState().copyProfile("base", true);
        store.getState().confirmDeleteProfile("base");
        store.getState().handleTabChange(1);
        const before = store.getState();
        store.getState().pasteProfile(null);
        expect(store.getState()).toBe(before);
    });

    it("rejects a stale target path without touching the active layer", async () => {
        const { config, save } = setup();
        await expect(
            ConfigChangeHandlers.handleProfileChanges(
                [],
                [{ key: "profiles.base", value: "", path: ["profiles", "base"], configPath: "/mock/missing.json", secure: false }],
                "/mock/missing.json",
                undefined,
                config
            )
        ).rejects.toThrow("no longer exists");
        expect(config.api.layers.get().properties.profiles.base).toBeDefined();
        expect(save).not.toHaveBeenCalled();
    });

    it("cancels without writing when the external-change confirmation is dismissed", async () => {
        const { store, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("external edit"));
        await expect(commit()).resolves.toBe(false);
        expect(save).not.toHaveBeenCalled();
        expect(Gui.warningMessage).toHaveBeenCalledWith(expect.stringContaining("changed outside"), {
            items: ["Save Anyway"],
            vsCodeOpts: { modal: true },
        });
    });

    it.each(["property", "rename", "default", "autostore"])("confirms an external change before saving %s edits", async (kind) => {
        const { store, commit, save, payload } = setup();
        if (kind === "property") store.getState().handleChange("profiles.base.properties.host", "edited");
        if (kind === "rename") store.getState().handleRenameProfile("base", "renamed");
        if (kind === "default") store.getState().handleDefaultsChange("base", "base.leaf");
        if (kind === "autostore") store.getState().handleAutostoreToggle("/mock/team.json");
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("external edit"));
        vi.mocked(Gui.warningMessage).mockResolvedValue("Save Anyway");
        if (kind === "autostore") {
            await new ConfigEditorSaveOperations().save(
                { ...payload(), otherChanges: [{ type: "autostore", configPath: "/mock/team.json", value: true }] },
                async () => true
            );
        } else {
            await commit();
        }
        expect(Gui.warningMessage).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it("rejects another change made while awaiting confirmation", async () => {
        const { store, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        vi.mocked(vscode.workspace.fs.readFile)
            .mockResolvedValueOnce(Buffer.from("external edit"))
            .mockResolvedValue(Buffer.from("another external edit"));
        vi.mocked(Gui.warningMessage).mockResolvedValue("Save Anyway");
        await expect(commit()).rejects.toThrow("changed outside");
        expect(save).not.toHaveBeenCalled();
    });

    it("keeps unrelated external additions when an initial conflict is approved", async () => {
        const { store, config, saved, configs, commit } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        config.set("profiles.external", { type: "base", properties: { host: "external" } });
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("external addition"));
        vi.mocked(Gui.warningMessage).mockResolvedValue("Save Anyway");
        await commit();
        expect(saved.get(configs[0].configPath)?.profiles).toMatchObject({
            base: { properties: { host: "edited" } },
            external: { properties: { host: "external" } },
        });
    });

    it("checks each layer again and restores earlier commits when a later overwrite is declined", async () => {
        const { store, saved, commit, save, configs } = setup();
        const originals = structuredClone([...saved.entries()]);
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        const persist = save.getMockImplementation();
        save.mockImplementationOnce(async () => {
            await persist();
            vi.mocked(vscode.workspace.fs.readFile).mockImplementation(async (uri) =>
                Buffer.from(uri.fsPath === configs[0].configPath ? "external edit between commits" : "synthetic file revision")
            );
        });
        await commit();
        expect(Gui.warningMessage).toHaveBeenCalledTimes(1);
        expect([...saved.entries()]).toEqual(originals);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
    });

    it("saves a later layer changed between commits only after explicit approval", async () => {
        const { store, saved, commit, save, configs } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        const persist = save.getMockImplementation();
        save.mockImplementationOnce(async () => {
            await persist();
            vi.mocked(vscode.workspace.fs.readFile).mockImplementation(async (uri) =>
                Buffer.from(uri.fsPath === configs[0].configPath ? "external edit between commits" : "synthetic file revision")
            );
        });
        vi.mocked(Gui.warningMessage).mockResolvedValue("Save Anyway");
        await commit();
        expect(Gui.warningMessage).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledTimes(2);
        expect(saved.get(configs[0].configPath)?.profiles).toEqual({});
        expect(saved.get(configs[1].configPath)?.profiles.base).toBeDefined();
    });

    it("does not overwrite a later external edit to an earlier layer during rollback", async () => {
        const { store, commit, save, configs } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        const persist = save.getMockImplementation();
        save.mockImplementationOnce(persist).mockImplementationOnce(async () => {
            vi.mocked(vscode.workspace.fs.readFile).mockImplementation(async (uri) =>
                Buffer.from(uri.fsPath === configs[1].configPath ? "external edit after commit" : "synthetic file revision")
            );
            throw new Error("write failed");
        });
        await expect(commit()).rejects.toThrow(`could not restore these files: ${configs[1].configPath}`);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(vscode.Uri.file(configs[0].configPath), expect.any(Uint8Array));
    });

    it("does not save any layer when staging a change fails", async () => {
        const { store, config, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        vi.spyOn(config, "set").mockImplementationOnce(() => {
            throw new Error("invalid edit");
        });
        await expect(commit()).rejects.toThrow("invalid edit");
        expect(save).not.toHaveBeenCalled();
    });

    it("rejects a dirty text document instead of overwriting its contents", async () => {
        const { store, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        const documents = vscode.workspace.textDocuments as vscode.TextDocument[];
        documents.push({ uri: vscode.Uri.file("/mock/team.json"), isDirty: true } as vscode.TextDocument);
        try {
            await expect(commit()).rejects.toThrow("changed outside");
            expect(save).not.toHaveBeenCalled();
        } finally {
            documents.pop();
        }
    });

    it("does not rewrite credentials if the vault failed to load", async () => {
        const { store, config, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        vi.spyOn(config.api.secure, "loadFailed", "get").mockReturnValue(true);
        await expect(commit()).rejects.toThrow("Secure storage could not be loaded");
        expect(save).not.toHaveBeenCalled();
    });

    it("restores already committed layers when a later layer fails", async () => {
        const { store, saved, commit, save, configs } = setup();
        const originals = structuredClone([...saved.entries()]);
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        save.mockImplementationOnce(async () => {
            saved.set(configs[1].configPath, { profiles: {}, defaults: {} });
        });
        save.mockRejectedValueOnce(new Error("write failed"));
        await expect(commit()).rejects.toThrow("original configuration was restored");
        expect([...saved.entries()]).toEqual(originals);
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(2);
    });
});
