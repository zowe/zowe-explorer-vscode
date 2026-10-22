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

import { hasPendingRename, buildFormattedPendingChanges } from "../../../../src/webviews/src/config-editor/utils/renameUtils";

describe("renameUtils", () => {
    describe("hasPendingRename", () => {
        it("returns false when no configPath", () => {
            expect(hasPendingRename("p1", "", {})).toBe(false);
        });
        it("returns true when profileKey is a newKey in renames", () => {
            const renames = { "/c": { orig: "p1" } };
            expect(hasPendingRename("p1", "/c", renames)).toBe(true);
        });
        it("returns false when profileKey not in renames", () => {
            expect(hasPendingRename("p1", "/c", { "/c": {} })).toBe(false);
        });
    });

    describe("buildFormattedPendingChanges", () => {
        it("includes defaultsChanges with empty value when default is cleared", () => {
            const result = buildFormattedPendingChanges({
                pendingChanges: {},
                deletions: {},
                pendingDefaults: {
                    "/mock/config.json": {
                        zosmf: { value: "", path: ["defaults", "zosmf"] },
                    },
                },
                defaultsDeletions: {},
                renames: {},
            });

            expect(result.defaultsChanges).toEqual([
                {
                    key: "zosmf",
                    value: "",
                    path: ["defaults", "zosmf"],
                    configPath: "/mock/config.json",
                    secure: false,
                },
            ]);
        });
    });
});
