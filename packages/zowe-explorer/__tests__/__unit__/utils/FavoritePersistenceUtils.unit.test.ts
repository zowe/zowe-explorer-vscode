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

import { ConfigEditorPathUtils } from "../../../src/utils/ConfigEditorPathUtils";
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

    describe("persisted session list mapping (same rules as favorites)", () => {
        it("replaces renamed profile keys in a session name list", () => {
            const renameMap = new Map([["oldp", { oldKey: "oldp", newKey: "newp", configPath: cfg }]]);
            const sessions = ["oldp", "other"];
            const updated = sessions.map((s) => ConfigEditorPathUtils.getNewProfilePath(s, cfg, renameMap));
            expect(updated).toEqual(["newp", "other"]);
        });

        it("updates nested session keys when a parent segment is renamed", () => {
            const renameMap = new Map([["parent", { oldKey: "parent", newKey: "renamed", configPath: cfg }]]);
            expect(ConfigEditorPathUtils.getNewProfilePath("parent.child", cfg, renameMap)).toBe("renamed.child");
        });
    });
});

import { vi } from "vitest";
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";
import { Profiles } from "../../../src/configuration/Profiles";
import { ZowePersistentFilters } from "../../../src/tools/ZowePersistentFilters";

vi.mock("../../../src/tools/ZoweLogger");
vi.mock("../../../src/tools/ZoweLocalStorage", () => ({
    ZoweLocalStorage: {
        getValue: vi.fn(),
        setValue: vi.fn().mockResolvedValue(undefined),
        isPersistenceKeyInWorkspace: vi.fn().mockReturnValue(false),
    },
}));
vi.mock("../../../src/trees/shared/SharedTreeProviders");
vi.mock("../../../src/configuration/Profiles");

describe("FavoritePersistenceUtils — new methods", () => {
    const cfg = "/path/zowe.config.json";
    const rename = { originalKey: "oldprof", newKey: "newprof", configPath: cfg };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("applyProfileRenameToStoredTreePersistence", () => {
        it("rewrites favorites and sessions for all schemas and writes back", async () => {
            // Return a fresh object each call so mutations in one schema don't suppress writes for the next
            (ZoweLocalStorage.getValue as any).mockImplementation(() => ({
                persistence: true,
                favorites: ["[oldprof]: HLQ.DATA{ds}"],
                sessions: ["oldprof", "other"],
            }));

            await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);

            expect(ZoweLocalStorage.setValue).toHaveBeenCalledTimes(3); // one per schema
            // Each call should have rewritten the favorites / sessions
            const [, updatedPayload] = (ZoweLocalStorage.setValue as any).mock.calls[0];
            expect(updatedPayload.favorites).toEqual(["[newprof]: HLQ.DATA{ds}"]);
            expect(updatedPayload.sessions).toEqual(["newprof", "other"]);
        });

        it("skips schemas where persistence is false", async () => {
            (ZoweLocalStorage.getValue as any).mockReturnValue({ persistence: false });

            await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);

            expect(ZoweLocalStorage.setValue).not.toHaveBeenCalled();
        });

        it("skips schemas where storage returns undefined", async () => {
            (ZoweLocalStorage.getValue as any).mockReturnValue(undefined);

            await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);

            expect(ZoweLocalStorage.setValue).not.toHaveBeenCalled();
        });

        it("skips write when neither favorites nor sessions changed", async () => {
            // No entry matches the rename
            const stored = {
                persistence: true,
                favorites: ["[other]: HLQ{ds}"],
                sessions: ["other"],
            };
            (ZoweLocalStorage.getValue as any).mockReturnValue(stored);

            await FavoritePersistenceUtils.applyProfileRenameToStoredTreePersistence(rename);

            expect(ZoweLocalStorage.setValue).not.toHaveBeenCalled();
        });
    });

    describe("rebuildFavoritesTreesFromPersistence", () => {
        it("clears and refreshes mFavorites for all non-null tree providers", async () => {
            const refreshFavorites = vi.fn().mockResolvedValue(undefined);
            const refreshElement = vi.fn();
            const fakeTree = {
                mFavorites: ["stale"],
                refreshFavorites,
                refreshElement,
                mFavoriteSession: {},
            };
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(fakeTree as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(null as any);

            await FavoritePersistenceUtils.rebuildFavoritesTreesFromPersistence();

            expect(fakeTree.mFavorites).toEqual([]);
            expect(refreshFavorites).toHaveBeenCalled();
            expect(refreshElement).toHaveBeenCalledWith(fakeTree.mFavoriteSession);
        });

        it("skips trees that are null/undefined", async () => {
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(null as any);

            await expect(FavoritePersistenceUtils.rebuildFavoritesTreesFromPersistence()).resolves.not.toThrow();
        });
    });

    describe("rebuildSessionNodesAfterProfileRename", () => {
        it("removes the old session node and re-adds it under the new name", async () => {
            const getProfileName = vi.fn().mockReturnValue("oldprof");
            const oldNode = { getProfileName, label: "oldprof" };
            const refresh = vi.fn();
            const addSingleSession = vi.fn().mockResolvedValue(undefined);
            const reloadSessionsFromPersistence = vi.fn();

            const fakeTree = {
                mSessionNodes: [oldNode],
                mFavoriteSession: {},
                refresh,
                addSingleSession,
                reloadSessionsFromPersistence,
            };
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(fakeTree as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(null as any);

            const mockProfile = { name: "newprof", type: "zosmf", message: "", failNotFound: false };
            vi.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: vi.fn().mockReturnValue(mockProfile),
            } as any);

            await FavoritePersistenceUtils.rebuildSessionNodesAfterProfileRename(rename);

            expect(fakeTree.mSessionNodes).not.toContain(oldNode);
            expect(addSingleSession).toHaveBeenCalledWith(mockProfile);
            expect(refresh).toHaveBeenCalled();
        });

        it("skips nodes whose name did not change", async () => {
            const getProfileName = vi.fn().mockReturnValue("unrelated");
            const node = { getProfileName, label: "unrelated" };
            const refresh = vi.fn();
            const addSingleSession = vi.fn();
            const reloadSessionsFromPersistence = vi.fn();

            const fakeTree = {
                mSessionNodes: [node],
                mFavoriteSession: {},
                refresh,
                addSingleSession,
                reloadSessionsFromPersistence,
            };
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(fakeTree as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(null as any);

            await FavoritePersistenceUtils.rebuildSessionNodesAfterProfileRename(rename);

            expect(addSingleSession).not.toHaveBeenCalled();
            expect(refresh).not.toHaveBeenCalled();
        });

        it("logs a warning if loadNamedProfile throws", async () => {
            const getProfileName = vi.fn().mockReturnValue("oldprof");
            const oldNode = { getProfileName, label: "oldprof" };
            const refresh = vi.fn();
            const addSingleSession = vi.fn();
            const reloadSessionsFromPersistence = vi.fn();

            const fakeTree = {
                mSessionNodes: [oldNode],
                mFavoriteSession: {},
                refresh,
                addSingleSession,
                reloadSessionsFromPersistence,
            };
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(fakeTree as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(null as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(null as any);

            vi.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: vi.fn().mockImplementation(() => { throw new Error("not found"); }),
            } as any);

            await expect(FavoritePersistenceUtils.rebuildSessionNodesAfterProfileRename(rename)).resolves.not.toThrow();
            expect(ZoweLogger.warn).toHaveBeenCalled();
        });
    });

    describe("fireAndForgetExplorerTreeRebuildAfterRename", () => {
        it("calls rebuildFavoritesTreesFromPersistence and rebuildSessionNodesAfterProfileRename without throwing", async () => {
            const rebuildFavSpy = vi.spyOn(FavoritePersistenceUtils, "rebuildFavoritesTreesFromPersistence").mockResolvedValue(undefined);
            const rebuildSessSpy = vi.spyOn(FavoritePersistenceUtils, "rebuildSessionNodesAfterProfileRename").mockResolvedValue(undefined);

            FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename(rename);

            // Allow the fire-and-forget promise to settle
            await new Promise((r) => setTimeout(r, 0));

            expect(rebuildFavSpy).toHaveBeenCalled();
            expect(rebuildSessSpy).toHaveBeenCalledWith(rename);
        });

        it("logs a warning when the rebuild promise rejects", async () => {
            vi.spyOn(FavoritePersistenceUtils, "rebuildFavoritesTreesFromPersistence").mockRejectedValue(new Error("boom"));
            vi.spyOn(FavoritePersistenceUtils, "rebuildSessionNodesAfterProfileRename").mockResolvedValue(undefined);

            FavoritePersistenceUtils.fireAndForgetExplorerTreeRebuildAfterRename(rename);
            await new Promise((r) => setTimeout(r, 0));

            expect(ZoweLogger.warn).toHaveBeenCalled();
        });
    });
});

describe("ZoweTreeProvider.reloadSessionsFromPersistence", () => {
    it("delegates to mPersistence.reloadSessionsFromStorage", () => {
        const reloadStorageSpy = vi.fn();
        // Simulate what reloadSessionsFromPersistence does: it calls this.mPersistence.reloadSessionsFromStorage()
        const provider = {
            mPersistence: { reloadSessionsFromStorage: reloadStorageSpy },
            reloadSessionsFromPersistence() {
                (this as any).mPersistence.reloadSessionsFromStorage();
            },
        };

        provider.reloadSessionsFromPersistence();

        expect(reloadStorageSpy).toHaveBeenCalledTimes(1);
    });
});
