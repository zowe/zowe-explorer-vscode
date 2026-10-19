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
import type { Configuration } from "../../../../src/webviews/src/config-editor/types";
import { createEditorStore } from "../../../../src/webviews/src/config-editor/store/editorStore";

function makeEditor() {
    const team: Configuration = {
        configPath: "/mock/team.json",
        secure: [],
        properties: { profiles: { base: { type: "base", properties: { host: "original" } } }, defaults: { base: "base" } },
    };
    const store = createEditorStore({ postMessage: vi.fn() });
    store.setState({ configurations: [team], selectedTab: 0, selectedProfileKey: "base" });
    return { store, team };
}

describe("editorStore", () => {
    it("keeps search and type filters isolated between editor instances", () => {
        const first = createEditorStore();
        const second = createEditorStore();
        first.getState().setProfileSearchTerm("nested");
        first.getState().setProfileFilterType("zosmf");

        expect(first.getState()).toMatchObject({ profileSearchTerm: "nested", profileFilterType: "zosmf" });
        expect(second.getState()).toMatchObject({ profileSearchTerm: "", profileFilterType: null });
    });

    it("clears search without losing the active type filter", () => {
        const store = createEditorStore();
        store.getState().setProfileSearchTerm("nested");
        store.getState().setProfileFilterType("zosmf");
        store.getState().setProfileSearchTerm("");

        expect(store.getState()).toMatchObject({ profileSearchTerm: "", profileFilterType: "zosmf" });
    });

    it("supports existing React-style updater callbacks using the latest state", () => {
        const store = createEditorStore();
        const { setProfileSearchTerm, setProfileFilterType } = store.getState();
        setProfileSearchTerm("nested");
        setProfileSearchTerm((previous) => `${previous}.child1`);
        setProfileFilterType("zosmf");
        setProfileFilterType((previous) => (previous === "zosmf" ? "ssh" : null));

        expect(store.getState()).toMatchObject({ profileSearchTerm: "nested.child1", profileFilterType: "ssh" });
    });

    it("lets existing refresh handlers reset filters through stable actions", () => {
        const store = createEditorStore();
        const { setProfileSearchTerm, setProfileFilterType } = store.getState();
        setProfileSearchTerm("nested");
        setProfileFilterType("zosmf");
        setProfileSearchTerm("");
        setProfileFilterType(null);

        expect(store.getState()).toMatchObject({ profileSearchTerm: "", profileFilterType: null });
        expect(store.getState().setProfileSearchTerm).toBe(setProfileSearchTerm);
        expect(store.getState().setProfileFilterType).toBe(setProfileFilterType);
    });
    it("publishes a compound edit once and restores every edited field with undo/redo", () => {
        const { store, team } = makeEditor();
        const notified = vi.fn();
        store.subscribe(notified);
        store.getState().transaction(() => {
            store
                .getState()
                .setPendingChanges({ [team.configPath]: { "profiles.base.properties.host": { value: "changed", path: ["host"], profile: "base" } } });
            store.getState().setPendingDefaults({ [team.configPath]: { base: { value: "other", path: ["defaults", "base"] } } });
        });
        expect(notified).toHaveBeenCalledTimes(1);
        expect(store.getState().undoStack).toHaveLength(1);
        store.getState().undo();
        expect(store.getState()).toMatchObject({ pendingChanges: {}, pendingDefaults: {} });
        store.getState().redo();
        expect(store.getState().pendingChanges[team.configPath]["profiles.base.properties.host"].value).toBe("changed");
        expect(store.getState().pendingDefaults[team.configPath].base.value).toBe("other");
    });

    it("discards an interrupted transaction without notifying subscribers", () => {
        const { store } = makeEditor();
        const before = store.getState();
        const notified = vi.fn();
        store.subscribe(notified);
        expect(() =>
            store.getState().transaction(() => {
                store.getState().setPendingDefaults({ file: { base: { value: "changed", path: ["base"] } } });
                throw new Error("interrupted edit");
            })
        ).toThrow("interrupted edit");
        expect(store.getState()).toBe(before);
        expect(notified).not.toHaveBeenCalled();
    });

    it("reads the latest configuration even when an action was retained before loading it", () => {
        const store = createEditorStore();
        const change = store.getState().handleChange;
        const { team } = makeEditor();
        store.setState({ configurations: [team], selectedTab: 0, selectedProfileKey: "base" });
        change("profiles.base.properties.host", "changed");
        expect(store.getState().pendingChanges[team.configPath]["profiles.base.properties.host"].value).toBe("changed");
        change("profiles.base.properties.host", "original");
        expect(store.getState().hasPendingChanges()).toBe(false);
    });

    it("persists preferences through the host without creating undo entries", () => {
        const { store } = makeEditor();
        store.getState().setViewModeWithStorage("flat");
        expect(store.getState().configEditorSettings.viewMode).toBe("flat");
        expect(store.getState().vscodeApi.postMessage).toHaveBeenCalledWith({
            command: "SET_LOCAL_STORAGE_VALUE",
            key: "zowe.configEditor.settings",
            value: expect.objectContaining({ viewMode: "flat" }),
        });
        expect(store.getState().undoStack).toHaveLength(0);
    });

    it("renames a profile and its defaults as one undoable operation", () => {
        const { store, team } = makeEditor();
        expect(store.getState().handleRenameProfile("base", "renamed")).toBe(true);
        expect(store.getState().selectedProfileKey).toBe("renamed");
        expect(store.getState().renames[team.configPath]).toMatchObject({ base: "renamed" });
        expect(store.getState().pendingDefaults[team.configPath].base.value).toBe("renamed");
        expect(store.getState().undoStack).toHaveLength(1);
        store.getState().undo();
        expect(store.getState()).toMatchObject({ renames: {}, pendingDefaults: {} });
    });

    it.each(["base", "base.child"])("keeps %s selected when its profile tree is moved", (selectedProfile) => {
        const { store, team } = makeEditor();
        team.properties.profiles.base.profiles = { child: { type: "zosmf", properties: { host: "child-host" } } };
        team.properties.profiles.target = { type: "base", properties: {} };
        store.getState().handleProfileSelection(selectedProfile);
        const notified = vi.fn();
        store.subscribe(notified);

        expect(store.getState().handleRenameProfile("base", "target.base", true)).toBe(true);
        expect(notified).toHaveBeenCalledTimes(1);
        expect(store.getState().selectedProfileKey).toBe(`target.${selectedProfile}`);
        expect(store.getState().selectedProfilesByConfig[team.configPath]).toBe(`target.${selectedProfile}`);
        expect(store.getState().expandedNodesByConfig[team.configPath].has("target")).toBe(true);
    });

    it("creates a wizard profile with one history entry and resets the wizard session", () => {
        const { store, team } = makeEditor();
        store.setState({
            wizardModalOpen: true,
            wizardProfileName: "created",
            wizardSelectedType: "base",
            wizardProperties: [{ key: "host", value: "wizard-host" }],
        });
        store.getState().handleWizardCreateProfile();
        expect(store.getState()).toMatchObject({ wizardModalOpen: false, wizardProfileName: "", selectedProfileKey: "created" });
        expect(store.getState().pendingChanges[team.configPath]["profiles.created.properties.host"].value).toBe("wizard-host");
        expect(store.getState().undoStack).toHaveLength(1);
        store.getState().undo();
        expect(store.getState().pendingChanges).toEqual({});
    });

    it("requests and cancels profile deletion without edits, then confirms it as one undoable action", () => {
        const { store, team } = makeEditor();
        store.getState().handleProfileSelection("base");
        const { handleDeleteProfile, confirmDeleteProfile, setPendingProfileDeletion } = store.getState();

        handleDeleteProfile("base");
        expect(store.getState().pendingProfileDeletion).toBe("base");
        expect(store.getState().hasPendingChanges()).toBe(false);
        expect(store.getState().undoStack).toHaveLength(0);

        setPendingProfileDeletion(null);
        expect(store.getState().pendingProfileDeletion).toBeNull();
        expect(store.getState().hasPendingChanges()).toBe(false);

        handleDeleteProfile("base");
        const notified = vi.fn();
        store.subscribe(notified);
        confirmDeleteProfile("base");
        expect(notified).toHaveBeenCalledTimes(1);
        expect(store.getState()).toMatchObject({ pendingProfileDeletion: null, selectedProfileKey: null });
        expect(store.getState().deletions[team.configPath]).toEqual(["profiles.base"]);
        expect(store.getState().pendingDefaults[team.configPath].base.value).toBe("");
        expect(store.getState().undoStack).toHaveLength(1);

        store.getState().undo();
        expect(store.getState()).toMatchObject({ deletions: {}, pendingDefaults: {} });
        expect(store.getState().hasPendingChanges()).toBe(false);
    });

    it("retains immutable deletion snapshots so undo restores preexisting draft edits", () => {
        const { store, team } = makeEditor();
        const pendingChanges = { [team.configPath]: { "profiles.base.properties.host": { value: "edited", path: ["host"], profile: "base" } } };
        const deletions = { [team.configPath]: ["profiles.old"] };
        store.setState({ pendingChanges, deletions });
        store.getState().confirmDeleteProfile("base");
        expect(deletions[team.configPath]).toEqual(["profiles.old"]);
        expect(pendingChanges[team.configPath]["profiles.base.properties.host"].value).toBe("edited");
        store.getState().undo();
        expect(store.getState().pendingChanges).toEqual(pendingChanges);
        expect(store.getState().deletions).toEqual(deletions);
    });

    it("cuts and pastes across files atomically, including source defaults and undo", () => {
        const { store, team } = makeEditor();
        team.properties = {
            profiles: {
                container: {
                    type: "base",
                    properties: { host: "parent-host" },
                    profiles: { leaf: { type: "zosmf", properties: { host: "leaf-host" } } },
                },
            },
            defaults: { base: "container", zosmf: "container.leaf" },
        };
        const user: Configuration = {
            configPath: "/mock/user.json",
            secure: [],
            properties: { profiles: { target: { type: "base", properties: {} } }, defaults: {} },
        };
        store.setState({ configurations: [team, user], selectedProfileKey: "container" });
        store.getState().copyProfile("container", true);
        expect(store.getState().undoStack).toHaveLength(0);
        store.getState().handleTabChange(1);
        const notified = vi.fn();
        store.subscribe(notified);
        store.getState().pasteProfile("target");
        expect(notified).toHaveBeenCalledTimes(1);
        expect(store.getState().pendingChanges[user.configPath]["profiles.target.profiles.container.profiles.leaf.properties.host"].value).toBe(
            "leaf-host"
        );
        expect(store.getState().deletions[team.configPath]).toContain("profiles.container");
        expect(store.getState().pendingDefaults[team.configPath].zosmf.value).toBe("");
        expect(store.getState().profileClipboard).toBeNull();
        expect(store.getState().undoStack).toHaveLength(1);
        store.getState().undo();
        expect(store.getState()).toMatchObject({ pendingChanges: {}, pendingDefaults: {}, deletions: {} });
        expect(team.properties.profiles.container.profiles.leaf.properties.host).toBe("leaf-host");
    });

    it("submits the latest draft while retaining its edits and history until acknowledged", () => {
        const { store, team } = makeEditor();
        store.getState().handleChange("profiles.base.properties.host", "changed");
        const pendingChanges = store.getState().pendingChanges;
        const undoStack = store.getState().undoStack;
        const save = store.getState().handleSave;
        save();
        expect(store.getState().vscodeApi.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                command: "SAVE_CHANGES",
                saveRequestId: 1,
                changes: expect.arrayContaining([expect.objectContaining({ configPath: team.configPath, value: "changed" })]),
            })
        );
        expect(store.getState()).toMatchObject({ isSaving: true, saveModalOpen: true, pendingSaveRequestId: 1 });
        expect(store.getState().pendingChanges).toBe(pendingChanges);
        expect(store.getState().undoStack).toBe(undoStack);
        save();
        store.getState().handleRefresh();
        store.getState().undo();
        store.getState().handleChange("profiles.base.properties.host", "edit while saving");
        expect(store.getState().vscodeApi.postMessage).toHaveBeenCalledTimes(1);
        expect(store.getState().pendingChanges).toBe(pendingChanges);
        expect(store.getState().undoStack).toBe(undoStack);
    });
});
