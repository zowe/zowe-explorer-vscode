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

import { createEditorStore } from "../../../../src/webviews/src/config-editor/store/editorStore";
import {
    selectCanOpenProfileInFile,
    selectFlattenedConfig,
    selectFlattenedDefaults,
} from "../../../../src/webviews/src/config-editor/store/selectors";
import type { Configuration } from "../../../../src/webviews/src/config-editor/types";

describe("config editor selectors", () => {
    const configuration = (host: string): Configuration => ({
        configPath: "/mock/team.json",
        secure: [],
        properties: { profiles: { base: { type: "base", properties: { host } } }, defaults: { base: "base" } },
    });

    it("reuses flattened data across draft edits and returns fresh data after reload", () => {
        const store = createEditorStore();
        store.setState({ configurations: [configuration("original")], selectedTab: 0, selectedProfileKey: "base" });
        const profiles = selectFlattenedConfig(store.getState());
        const defaults = selectFlattenedDefaults(store.getState());
        store.getState().handleChange("profiles.base.properties.host", "edited");
        expect(selectFlattenedConfig(store.getState())).toBe(profiles);
        expect(selectFlattenedDefaults(store.getState())).toBe(defaults);

        store.getState().setConfigurations([configuration("reloaded")]);
        expect(selectFlattenedConfig(store.getState())).not.toBe(profiles);
        expect(selectFlattenedConfig(store.getState())["base.properties.host"].value).toBe("reloaded");
        expect(selectFlattenedDefaults(store.getState())).not.toBe(defaults);
        expect(selectFlattenedDefaults(store.getState()).base.path).toEqual(["defaults", "base"]);
    });

    it("keeps caches separate across files and editor instances even with identical paths", () => {
        const first = createEditorStore();
        const second = createEditorStore();
        first.setState({ configurations: [configuration("first"), configuration("other-layer")], selectedTab: 0 });
        second.setState({ configurations: [configuration("second")], selectedTab: 0 });
        const initial = selectFlattenedConfig(first.getState());
        expect(selectFlattenedConfig(second.getState())["base.properties.host"].value).toBe("second");
        first.getState().setSelectedTab(1);
        expect(selectFlattenedConfig(first.getState())["base.properties.host"].value).toBe("other-layer");
        first.getState().setSelectedTab(0);
        expect(selectFlattenedConfig(first.getState())).toBe(initial);
    });

    it("does not traverse unrelated profiles again for successive property actions", () => {
        let reads = 0;
        const config = configuration("original");
        config.properties.profiles.other = {
            get properties() {
                reads++;
                return { host: "other" };
            },
        };
        const store = createEditorStore();
        store.setState({ configurations: [config], selectedTab: 0, selectedProfileKey: "base" });
        store.getState().handleDeleteProperty("profiles.base.properties.host");
        expect(reads).toBe(1);
        store.getState().handleDeleteProperty("profiles.base.type");
        expect(reads).toBe(1);
    });

    it("allows saved profiles with property edits and disables new profiles until saved", () => {
        const store = createEditorStore();
        store.setState({ configurations: [configuration("original")], selectedTab: 0, selectedProfileKey: "base" });
        store.getState().handleChange("profiles.base.properties.host", "edited");
        expect(selectCanOpenProfileInFile(store.getState())).toBe(true);
        store.setState({ wizardProfileName: "newProfile", wizardSelectedType: "base", wizardProperties: [] });
        store.getState().handleWizardCreateProfile();
        store.getState().setSelectedProfileKey("newProfile");
        expect(selectCanOpenProfileInFile(store.getState())).toBe(false);
        const savedConfig = configuration("original");
        savedConfig.properties.profiles.newProfile = { type: "base" };
        store.setState({ configurations: [savedConfig], pendingChanges: {} });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(true);
    });

    it.each(["renamed", "renamed.child"])("disables a pending renamed path %s and enables it after saving", (profileKey) => {
        const config = configuration("original");
        config.properties.profiles.base.profiles = { child: {} };
        const store = createEditorStore();
        store.setState({
            configurations: [config],
            selectedTab: 0,
            selectedProfileKey: profileKey,
            renames: { [config.configPath]: { base: "renamed" } },
        });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(false);
        config.properties.profiles.renamed = config.properties.profiles.base;
        delete config.properties.profiles.base;
        store.setState({ configurations: [{ ...config }], renames: {} });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(true);
    });

    it("disables moved and deleted paths even when their old locations exist on disk", () => {
        const store = createEditorStore();
        const config = configuration("original");
        store.setState({
            configurations: [config],
            selectedTab: 0,
            selectedProfileKey: "base",
            renames: { [config.configPath]: { base: "group.base" } },
        });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(false);
        store.setState({ renames: {}, deletions: { [config.configPath]: ["profiles.base"] } });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(false);
        store.setState({ deletions: {}, isSaving: true });
        expect(selectCanOpenProfileInFile(store.getState())).toBe(false);
    });
});
