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

import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZowePersistentFilters } from "../../../src/tools/ZowePersistentFilters";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Constants } from "../../../src/configuration/Constants";

describe("PersistentFilters Unit Test", () => {
    Object.defineProperty(ZoweLogger, "trace", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({
                persistence: true,
                favorites: [],
                history: [],
                sessions: ["zosmf"],
                searchHistory: [],
                fileHistory: [],
                templates: [
                    {
                        MyMockTemplate: {
                            alcunit: "CYL",
                            blksize: 3130,
                            dirblk: 35,
                            dsorg: "PO",
                            lrecl: 40,
                            primary: 1,
                            recfm: "FB",
                        },
                    },
                ],
            }),
            update: vi.fn(),
            keys: () => [],
        },
        configurable: true,
    });
    describe("addSearchHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 1, 1);
            const privatePf = pf as any;
            privatePf.mSearchHistory = ["testOne"];
            pf.addSearchHistory("testTwo");
            expect(pf.getSearchHistory()).toEqual(["testTwo"]);
        });

        it("should keep all profiles in one group when grouping is disabled (default)", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            pf.addSearchHistory("fromHostA", { profile: { host: "hostA" } } as any);
            pf.addSearchHistory("fromHostB", { profile: { host: "hostB" } } as any);
            expect(pf.getSearchHistory()).toEqual(["fromHostB", "fromHostA"]);
        });

        it("should group history by host when zowe.settings.historyGroupByHost is enabled", () => {
            const settingsSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: any) => {
                if (key === Constants.SETTINGS_HISTORY_GROUP_BY_HOST) {
                    return true;
                }
                return defaultValue;
            });
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            const profileA = { profile: { host: "hostA" } } as any;
            const profileB = { profile: { host: "hostB" } } as any;
            pf.addSearchHistory("fromHostA", profileA);
            pf.addSearchHistory("fromHostB", profileB);

            expect(pf.getSearchHistory(profileA)).toEqual(["fromHostA"]);
            expect(pf.getSearchHistory(profileB)).toEqual(["fromHostB"]);
            expect(pf.getSearchHistory()).toEqual(expect.arrayContaining(["fromHostA", "fromHostB"]));
            settingsSpy.mockRestore();
        });

        it("should group by historyGroup override instead of host when set", () => {
            const settingsSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: any) => {
                if (key === Constants.SETTINGS_HISTORY_GROUP_BY_HOST) {
                    return true;
                }
                return defaultValue;
            });
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            const profileZosmf = { profile: { host: "10.1.2.3", historyGroup: "sysA" } } as any;
            const profileSsh = { profile: { host: "mvs1.company.com", historyGroup: "sysA" } } as any;
            pf.addSearchHistory("viaZosmf", profileZosmf);
            pf.addSearchHistory("viaSsh", profileSsh);

            expect(pf.getSearchHistory(profileZosmf)).toEqual(["viaSsh", "viaZosmf"]);
            expect(pf.getSearchHistory(profileSsh)).toEqual(["viaSsh", "viaZosmf"]);
            settingsSpy.mockRestore();
        });

        it("should keep the ungrouped searchHistory list up to date while grouping is enabled", () => {
            const settingsSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: any) => {
                if (key === Constants.SETTINGS_HISTORY_GROUP_BY_HOST) {
                    return true;
                }
                return defaultValue;
            });
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            pf.addSearchHistory("fromHostA", { profile: { host: "hostA" } } as any);
            pf.addSearchHistory("fromHostB", { profile: { host: "hostB" } } as any);

            // Older Zowe Explorer versions only read the flat `searchHistory` list, so it must stay populated
            expect(pf["mSearchHistory"]).toEqual(["fromHostB", "fromHostA"]);
            expect(pf["mSearchHistoryByGroup"]).toEqual({ hosta: ["fromHostA"], hostb: ["fromHostB"] });
            settingsSpy.mockRestore();
        });

        it("should fall back to the ungrouped list for a group with no entries of its own", () => {
            const settingsSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: any) => {
                if (key === Constants.SETTINGS_HISTORY_GROUP_BY_HOST) {
                    return true;
                }
                return defaultValue;
            });
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            pf["mSearchHistory"] = ["preexisting"];

            expect(pf.getSearchHistory({ profile: { host: "hostA" } } as any)).toEqual(["preexisting"]);
            settingsSpy.mockRestore();
        });
    });
    describe("updateMaxSearchHistory()", () => {
        it("should re-read the maxSearchHistory setting and trim the ungrouped list and every group to it", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 5, 5);
            pf["mSearchHistory"] = ["one", "two", "three", "four", "five"];
            pf["mSearchHistoryByGroup"] = { hostA: ["a1", "a2", "a3", "a4"] };

            const settingsSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: any) => {
                if (key === Constants.SETTINGS_MAX_SEARCH_HISTORY) {
                    return 2;
                }
                return defaultValue;
            });
            pf.updateMaxSearchHistory();
            settingsSpy.mockRestore();

            expect(pf["mSearchHistory"]).toEqual(["one", "two"]);
            expect(pf["mSearchHistoryByGroup"]).toEqual({ hostA: ["a1", "a2"] });

            // the new, lower limit must also apply going forward
            pf.addSearchHistory("six");
            expect(pf["mSearchHistory"]).toEqual(["six", "one"]);
        });
    });
    describe("addFileHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 2, 2);
            const privatePf = pf as any;
            privatePf.mFileHistory = ["TEST2.TXT", "TEST1.TXT"];
            pf.addFileHistory("TEST3.TXT");
            expect(pf.getFileHistory()).toEqual(["TEST3.TXT", "TEST2.TXT"]);
        });
    });
    describe("addSearchedKeywordHistory()", () => {
        it("should pop search keyword history if history length is larger than max length", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const privatePf = pf as any;
            privatePf.mSearchedKeywordHistory = ["testOne"];
            pf.addSearchedKeywordHistory("testTwo");
            expect(pf.getSearchedKeywordHistory()).toEqual(["testTwo"]);
        });
    });
    describe("removeSearchHistory", () => {
        it("should remove the specified item from the persistent object", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Job, 2, 2);
            pf["mSearchHistory"] = ["test1", "test2"];
            pf.removeSearchHistory("test1");
            expect(pf.getSearchHistory().length).toEqual(1);
        });

        it("should remove a matching item regardless of which group it is in", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Job, 2, 2);
            pf["mSearchHistory"] = ["test1", "test2"];
            pf["mSearchHistoryByGroup"] = { hostA: ["test1"], hostB: ["test2"] };
            pf.removeSearchHistory("test1");
            expect(pf.getSearchHistory()).toEqual(["test2"]);
        });
    });

    describe("initialize() search history", () => {
        it("should load a flat searchHistory list as the ungrouped history", () => {
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
                searchHistory: ["legacyOne", "legacyTwo"],
            } as any);
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 5, 5);
            expect(pf.getSearchHistory()).toEqual(["legacyOne", "legacyTwo"]);
            expect(pf["mSearchHistoryByGroup"]).toEqual({});
            spy.mockRestore();
        });

        it("should load both the ungrouped list and the grouped map when present", () => {
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
                searchHistory: ["flatOne"],
                searchHistoryByGroup: { hosta: ["groupedOne"] },
            } as any);
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 5, 5);
            expect(pf["mSearchHistory"]).toEqual(["flatOne"]);
            expect(pf["mSearchHistoryByGroup"]).toEqual({ hosta: ["groupedOne"] });
            expect(pf.getSearchHistory()).toEqual(["flatOne", "groupedOne"]);
            spy.mockRestore();
        });

        it("should relocate a grouped map stored under searchHistory by a pre-release build", () => {
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
                searchHistory: { hosta: ["fromHostA"], hostb: ["fromHostB"] },
            } as any);
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 5, 5);
            expect(pf["mSearchHistory"]).toEqual(["fromHostA", "fromHostB"]);
            expect(pf["mSearchHistoryByGroup"]).toEqual({ hosta: ["fromHostA"], hostb: ["fromHostB"] });
            spy.mockRestore();
        });
    });
    describe("removeSearchedKeywordHistory", () => {
        it("should remove the specified item from the persistent object", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 2, 2);
            pf["mSearchedKeywordHistory"] = ["test1", "test2"];
            pf.removeSearchedKeywordHistory("test1");
            expect(pf.getSearchedKeywordHistory().length).toEqual(1);
        });
    });

    describe("readVsamFavorites", () => {
        it("should return vsam favorites from local storage", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
                vsamFavorites: ["vsamFav1", "vsamFav2"],
            } as any);
            expect(pf.readVsamFavorites()).toEqual(["vsamFav1", "vsamFav2"]);
            spy.mockRestore();
        });

        it("should return empty array if vsamFavorites is undefined", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
            } as any);
            expect(pf.readVsamFavorites()).toEqual([]);
            spy.mockRestore();
        });
    });

    describe("readMigratedFavorites", () => {
        it("should return migrated favorites from local storage", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
                migratedFavorites: ["migrFav1", "migrFav2"],
            } as any);
            expect(pf.readMigratedFavorites()).toEqual(["migrFav1", "migrFav2"]);
            spy.mockRestore();
        });

        it("should return empty array if migratedFavorites is undefined", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const spy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
            } as any);
            expect(pf.readMigratedFavorites()).toEqual([]);
            spy.mockRestore();
        });
    });

    describe("updateFavorites", () => {
        it("should update regular, vsam and migrated favorites", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset, 1, 1);
            const getSpy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({
                persistence: true,
            } as any);
            const setSpy = vi.spyOn(ZoweLocalStorage, "setValue").mockImplementation();

            pf.updateFavorites({ favorites: ["fav1"], vsamFavorites: ["vsamFav1"], migratedFavorites: ["migrFav1"] });

            expect(setSpy).toHaveBeenCalledWith(PersistenceSchemaEnum.Dataset, {
                persistence: true,
                favorites: ["fav1"],
                vsamFavorites: ["vsamFav1"],
                migratedFavorites: ["migrFav1"],
            });

            getSpy.mockRestore();
            setSpy.mockRestore();
        });
    });
});
