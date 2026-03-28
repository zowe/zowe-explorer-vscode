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

import { FavoritePersistenceUtils } from "../../../src/utils/FavoritePersistenceUtils";

describe("FavoritePersistenceUtils", () => {
    const cfg = "/path/zowe.config.json";

    describe("rewriteFavoriteLine", () => {
        it("updates the profile segment when the root profile is renamed", () => {
            expect(
                FavoritePersistenceUtils.rewriteFavoriteLine(`[oldprof]: HLQ.DATA{ds}`, {
                    originalKey: "oldprof",
                    newKey: "newprof",
                    configPath: cfg,
                })
            ).toBe(`[newprof]: HLQ.DATA{ds}`);
        });

        it("updates nested profile keys when a parent segment is renamed", () => {
            expect(
                FavoritePersistenceUtils.rewriteFavoriteLine(`[parent.child]: HLQ{ds}`, {
                    originalKey: "parent",
                    newKey: "renamed",
                    configPath: cfg,
                })
            ).toBe(`[renamed.child]: HLQ{ds}`);
        });

        it("leaves the line unchanged when the rename does not apply to that profile", () => {
            const line = `[other]: HLQ{ds}`;
            expect(
                FavoritePersistenceUtils.rewriteFavoriteLine(line, {
                    originalKey: "oldprof",
                    newKey: "newprof",
                    configPath: cfg,
                })
            ).toBe(line);
        });

        it("leaves malformed lines unchanged", () => {
            expect(
                FavoritePersistenceUtils.rewriteFavoriteLine("not-a-favorite", {
                    originalKey: "a",
                    newKey: "b",
                    configPath: cfg,
                })
            ).toBe("not-a-favorite");
        });
    });
});
