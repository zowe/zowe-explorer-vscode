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
import { createEditorStore, type EditorStoreState } from "../../../../src/webviews/src/config-editor/store/editorStore";
import { selectFlattenedDefaults } from "../../../../src/webviews/src/config-editor/store/selectors";
import type { Configuration } from "../../../../src/webviews/src/config-editor/types";
import {
    handleConfigurationsMessage,
    handleInitialSelectionMessage,
    handleMergedPropertiesMessage,
    handleMessage,
} from "../../../../src/webviews/src/config-editor/handlers/messageHandlers";

function makeStore(overrides: Partial<EditorStoreState> = {}) {
    const store = createEditorStore({ postMessage: vi.fn() });
    store.setState(overrides);
    return store;
}

const team: Configuration = { configPath: "/mock/team.json", properties: { profiles: {}, defaults: { base: "team-base" } }, secure: [] };
const user: Configuration = { configPath: "/mock/user.json", properties: { profiles: {}, defaults: { base: "user-base" } }, secure: [] };

describe("webviewMessageHandlers", () => {
    afterEach(() => vi.useRealTimers());
    describe("configuration refresh and selection", () => {
        it.each([
            { name: "removing the layer before the selected file", previous: [user, team], contents: [team], selected: 1, expected: 0 },
            { name: "reordering layers", previous: [user, team], contents: [team, user], selected: 1, expected: 0 },
            { name: "removing the selected file", previous: [user, team], contents: [team], selected: 0, expected: 0 },
            { name: "adding a layer", previous: [team], contents: [user, team], selected: 0, expected: 0 },
            { name: "removing all layers", previous: [team], contents: [], selected: 0, expected: null },
        ])("selects a valid layer after $name", ({ previous, contents, selected, expected }) => {
            const store = makeStore({ configurations: previous, selectedTab: selected });
            handleConfigurationsMessage({ contents }, store);
            expect(store.getState().selectedTab).toBe(expected);
            if (contents.length)
                expect(selectFlattenedDefaults(store.getState())).toEqual({
                    base: { value: contents[expected!].properties.defaults.base, path: ["defaults", "base"] },
                });
        });
        it("restores the saved file after its index changes", () => {
            const store = makeStore({ configurations: [user, team], selectedTab: 1, pendingSaveSelection: { tab: 1, profile: "team-base" } });
            handleConfigurationsMessage({ contents: [team] }, store);
            expect(store.getState()).toMatchObject({ selectedTab: 0, selectedProfileKey: "team-base", pendingSaveSelection: null });
        });
        it("does not restore an obsolete index after a fast refresh response", () => {
            vi.useFakeTimers();
            const store = makeStore({ configurations: [user, team], selectedTab: 1 });
            vi.mocked(store.getState().vscodeApi.postMessage).mockImplementation((message) => {
                if ("command" in message && message.command === "GET_PROFILES") handleConfigurationsMessage({ contents: [team] }, store);
            });
            store.getState().handleRefresh();
            vi.runAllTimers();
            expect(store.getState().selectedTab).toBe(0);
        });
        it("derives defaults paths with their defaults prefix", () => {
            const store = makeStore();
            handleConfigurationsMessage(
                { contents: [{ ...team, properties: { profiles: {}, defaults: { zosmf: "my_zosmf", nested: { sub: "val" } } } }] },
                store
            );
            expect(selectFlattenedDefaults(store.getState())).toMatchObject({
                zosmf: { path: ["defaults", "zosmf"] },
                "nested.sub": { path: ["defaults", "nested", "sub"] },
            });
        });
    });
    describe("tutorial visibility", () => {
        it("leaves existing tutorial state alone when the message omits tutorialSeen", () => {
            const store = makeStore({ tutorialSeen: true });
            handleConfigurationsMessage({ contents: [] }, store);
            expect(store.getState()).toMatchObject({ tutorialSeen: true, showTutorial: false });
        });
        it("records an already-seen tutorial without opening it", () => {
            const store = makeStore();
            handleConfigurationsMessage({ contents: [], tutorialSeen: true }, store);
            expect(store.getState()).toMatchObject({ tutorialSeen: true, showTutorial: false });
        });
        it("opens the tutorial on first use", () => {
            const store = makeStore();
            handleConfigurationsMessage({ contents: [], tutorialSeen: false }, store);
            expect(store.getState()).toMatchObject({ tutorialSeen: false, showTutorial: true });
        });
        it("does not reopen the tutorial when another configuration is created", () => {
            const store = makeStore({ configurations: [team], tutorialSeen: true });
            handleConfigurationsMessage({ contents: [user, team], tutorialSeen: true }, store);
            expect(store.getState().showTutorial).toBe(false);
        });
    });
    describe("initial selection and highlights", () => {
        it("highlights the profile card when no property was requested", () => {
            const store = makeStore({ configurations: [team] });
            handleInitialSelectionMessage({ profileName: "zosmf", configPath: team.configPath }, store);
            expect(store.getState()).toMatchObject({ highlightProfileCard: true, highlightPropertyKey: null });
        });
        it("highlights the requested property", () => {
            const store = makeStore({ configurations: [team] });
            handleInitialSelectionMessage({ profileName: "zosmf", configPath: team.configPath, propertyKey: "host" }, store);
            expect(store.getState()).toMatchObject({ highlightProfileCard: false, highlightPropertyKey: "host" });
        });
        it("retains a property highlight even if the configuration is unavailable", () => {
            const store = makeStore();
            handleInitialSelectionMessage({ profileName: "zosmf", configPath: team.configPath, propertyKey: "port" }, store);
            expect(store.getState()).toMatchObject({ highlightProfileCard: false, highlightPropertyKey: "port", selectedTab: null });
        });
        it("selects the requested file and profile", () => {
            const store = makeStore({ configurations: [team] });
            handleInitialSelectionMessage({ profileName: "myprof", configPath: team.configPath }, store);
            expect(store.getState()).toMatchObject({
                selectedTab: 0,
                selectedProfileKey: "myprof",
                selectedProfilesByConfig: { [team.configPath]: "myprof" },
            });
        });
        it("normalizes Windows path separators", () => {
            const store = makeStore({ configurations: [{ ...team, configPath: "C:\\Users\\user\\team.json" }] });
            handleInitialSelectionMessage({ profileName: "zosmf", configPath: "C:/Users/user/team.json" }, store);
            expect(store.getState()).toMatchObject({ selectedTab: 0, highlightProfileCard: true });
        });
        it("leaves selection alone when the requested file is unavailable", () => {
            const store = makeStore({ configurations: [team] });
            handleInitialSelectionMessage({ profileName: "zosmf", configPath: "/other/team.json" }, store);
            expect(store.getState()).toMatchObject({ selectedTab: null, selectedProfileKey: null, highlightProfileCard: false });
        });
    });
    describe("async response guards", () => {
        it("publishes current wizard validation results without adding undo history", () => {
            const store = makeStore({ validationRequestSeq: 2 });
            const validations: boolean[] = [];
            store.subscribe((state, previous) => {
                if (state.wizardProfileNameValidation !== previous.wizardProfileNameValidation) {
                    validations.push(state.wizardProfileNameValidation.isValid);
                }
            });
            for (const isValid of [false, true]) {
                handleMessage({ data: { command: "PROFILE_NAME_VALIDATION_RESULT", requestSeq: 2, isValid } } as MessageEvent, store);
            }
            expect(validations).toEqual([false, true]);
            expect(store.getState().undoStack).toHaveLength(0);
        });
        it("ignores stale merged-property responses and accepts the current one", () => {
            const store = makeStore({ mergedPropertiesRequestSeq: 2 });
            handleMergedPropertiesMessage({ mergedPropertiesRequestSeq: 1, mergedArgs: [{ argName: "host", argValue: "stale" }] }, store);
            expect(store.getState().mergedProperties).toBeNull();
            handleMergedPropertiesMessage({ mergedPropertiesRequestSeq: 2, mergedArgs: [{ argName: "host", argValue: "current" }] }, store);
            expect(store.getState().mergedProperties?.host.value).toBe("current");
        });
        it("ignores wizard validation responses from a canceled session", () => {
            const store = makeStore({ validationRequestSeq: 2 });
            store.getState().handleWizardCancel();
            handleMessage({ data: { command: "PROFILE_NAME_VALIDATION_RESULT", requestSeq: 2, isValid: false } } as MessageEvent, store);
            expect(store.getState().wizardProfileNameValidation.isValid).toBe(true);
        });
    });
    describe("file-picker history", () => {
        it("records the chosen file as one edit and discards obsolete redo entries", () => {
            const key = "profiles.demo.properties.certFile";
            const store = makeStore({
                configurations: [{ ...team, properties: { profiles: { demo: { type: "base", properties: { certFile: "original.pem" } } } } }],
                selectedTab: 0,
                selectedProfileKey: "demo",
            });
            store.getState().handleChange(key, "typed.pem");
            store.getState().undo();
            expect(store.getState().redoStack).toHaveLength(1);
            const notified = vi.fn();
            store.subscribe(notified);

            handleMessage({ data: { command: "FILE_SELECTED", source: "editor", fullKey: key, filePath: "chosen.pem" } } as MessageEvent, store);
            expect(notified).toHaveBeenCalledTimes(1);
            expect(store.getState().pendingChanges[team.configPath][key].value).toBe("chosen.pem");
            expect(store.getState().undoStack).toHaveLength(1);
            expect(store.getState().redoStack).toHaveLength(0);
            store.getState().undo();
            expect(store.getState().pendingChanges).toEqual({});
            store.getState().redo();
            expect(store.getState().pendingChanges[team.configPath][key].value).toBe("chosen.pem");
        });

        it("does not record a file choice in the add-property modal as a draft edit", () => {
            const store = makeStore();
            handleMessage(
                { data: { command: "FILE_SELECTED", source: "editor", isNewProperty: true, filePath: "chosen.pem" } } as MessageEvent,
                store
            );
            expect(store.getState().newProfileValue).toBe("chosen.pem");
            expect(store.getState().pendingChanges).toEqual({});
            expect(store.getState().undoStack).toHaveLength(0);
        });
    });
});
