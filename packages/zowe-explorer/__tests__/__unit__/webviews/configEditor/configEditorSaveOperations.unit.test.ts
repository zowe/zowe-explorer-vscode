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
import { createEditorConfig } from "../../../__mocks__/mockCreators/configEditor";
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
vi.mock("@zowe/zowe-explorer-api", () => ({ ZoweVsCodeExtension: {}, ProfilesCache: {}, FileManagement: {} }));
vi.mock("vscode", () => ({
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

    it("rejects an unavailable credential before deleting the source", async () => {
        const { store, config, saved, commit, configs, save } = setup();
        store.getState().copyProfile("base", true);
        store.getState().handleTabChange(1);
        store.getState().pasteProfile(null);
        config.delete("profiles.base.properties.password");
        await expect(commit()).rejects.toThrow("source credential is unavailable");
        expect(save).not.toHaveBeenCalled();
        expect(saved.get(configs[0].configPath)?.profiles.base).toBeDefined();
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

    it("rejects external changes before writing", async () => {
        const { store, commit, save } = setup();
        store.getState().handleChange("profiles.base.properties.host", "edited");
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("external edit"));
        await expect(commit()).rejects.toThrow("changed outside");
        expect(save).not.toHaveBeenCalled();
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
