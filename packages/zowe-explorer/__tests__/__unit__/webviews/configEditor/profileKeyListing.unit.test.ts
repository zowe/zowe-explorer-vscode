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

import { getVisibleProfileKeys } from "../../../../src/webviews/src/config-editor/utils/profileKeyListing";
import { createEditorStore } from "../../../../src/webviews/src/config-editor/store/editorStore";
import type { ProfileMap, RenamesMap, DeletionsMap, ProfileSortOrder } from "../../../../src/webviews/src/config-editor/types";
import { vi } from "vitest";

const configPath = "/mock/team.json";
const profiles: ProfileMap = {
    zebra: { type: "base", profiles: { leaf: { type: "zosmf" } } },
    alpha: { type: "zosmf" },
};
const visible = (pendingProfiles: ProfileMap = {}, renames: RenamesMap = {}, deletions: DeletionsMap = {}, sortOrder: ProfileSortOrder = "natural") =>
    getVisibleProfileKeys({ profiles, pendingProfiles, configPath, renames, deletions, sortOrder });

describe("effective profile keys", () => {
    it("keeps disk order, deduplicates edited profiles, and appends new profiles", () => {
        expect(visible({ alpha: {}, newProfile: {} })).toEqual(["zebra", "zebra.leaf", "alpha", "newProfile"]);
    });

    it("uses renamed keys once for both saved and pending profiles", () => {
        expect(visible({ zebra: {}, renamed: {} }, { [configPath]: { zebra: "renamed" } })).toEqual(["renamed", "renamed.leaf", "alpha"]);
    });

    it("retains a child moved out of a deleted parent", () => {
        expect(visible({ extracted: {} }, { [configPath]: { "zebra.leaf": "extracted" } }, { [configPath]: ["profiles.zebra"] })).toEqual([
            "extracted",
            "alpha",
        ]);
    });

    it("does not hide profiles when only a property is deleted", () => {
        expect(visible({}, {}, { [configPath]: ["profiles.zebra.properties.host"] })).toEqual(["zebra", "zebra.leaf", "alpha"]);
    });

    it("keeps unsaved parent placeholders and their moved children", () => {
        expect(visible({ group: {} }, { [configPath]: { zebra: "group.zebra" } })).toEqual(["group.zebra", "group.zebra.leaf", "alpha", "group"]);
    });

    it("sorts siblings while preserving their tree structure", () => {
        expect(visible({}, {}, {}, "alphabetical")).toEqual(["alpha", "zebra", "zebra.leaf"]);
    });

    it("offers the same effective names in the parent selector", () => {
        const store = createEditorStore({ postMessage: vi.fn() });
        const renames = { [configPath]: { "zebra.leaf": "extracted" } };
        const deletions = { [configPath]: ["profiles.zebra"] };
        store.setState({ configurations: [{ configPath, properties: { profiles }, secure: [] }], selectedTab: 0, renames, deletions });
        expect(store.getState().getAvailableProfiles()).toEqual(["root", ...visible({}, renames, deletions)]);
    });
});
