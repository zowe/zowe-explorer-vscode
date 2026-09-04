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

import { imperative, IZoweDatasetTreeNode, PersistenceSchemaEnum, Sorting } from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "./ZoweLogger";
import { ZoweLocalStorage } from "./ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";
import { SettingsConfig } from "../configuration/SettingsConfig";

/**
 * Standard history and favorite persistance handling routines
 *
 * @export
 * @class PersistentFilters
 */
export class ZowePersistentFilters {
    private static readonly favorites: string = "favorites";
    private static readonly vsamFavorites: string = "vsamFavorites";
    private static readonly memberFavorites: string = "memberFavorites";
    private static readonly migratedFavorites: string = "migratedFavorites";
    private static readonly searchHistory: string = "searchHistory";
    private static readonly searchHistoryByGroup: string = "searchHistoryByGroup";
    private static readonly searchedKeywordHistory: string = "searchedKeywordHistory";
    private static readonly fileHistory: string = "fileHistory";
    private static readonly sessions: string = "sessions";
    private static readonly encodingHistory: string = "encodingHistory";
    private static readonly sortSettings: string = "sortSettings";

    public schema: PersistenceSchemaEnum;
    private mSearchHistory: string[] = [];
    private mSearchHistoryByGroup: Record<string, string[]> = {};
    private mFileHistory: string[] = [];
    private mSessions: string[] = [];
    private mEncodingHistory: string[] = [];
    private mSearchedKeywordHistory: string[] = [];
    private mSortSettings: { [criteria: string]: Sorting.NodeSort } = {};

    public constructor(
        schema: PersistenceSchemaEnum,
        private maxSearchHistory = ZowePersistentFilters.resolveMaxSearchHistory(),
        private maxFileHistory = Constants.MAX_FILE_HISTORY
    ) {
        ZoweLogger.trace("PersistentFilters.constructor called.");
        this.schema = schema;
        this.initialize();
    }

    /**
     * Reads the `zowe.settings.maxSearchHistory` setting, falling back to `Constants.MAX_SEARCH_HISTORY`
     * if the setting is unset or not a valid positive number (a malformed value must never silently cap
     * history at 0 and wipe every entry on the next add).
     */
    private static resolveMaxSearchHistory(): number {
        const configured = SettingsConfig.getDirectValue<number>(Constants.SETTINGS_MAX_SEARCH_HISTORY, Constants.MAX_SEARCH_HISTORY);
        return typeof configured === "number" && configured > 0 ? configured : Constants.MAX_SEARCH_HISTORY;
    }

    /**
     * Re-reads `zowe.settings.maxSearchHistory` and trims the ungrouped list and every group down to the
     * new limit. `maxSearchHistory` is otherwise only resolved once, at construction time, so callers whose
     * persistence instance lives for the life of the extension (the ds/uss/job tree providers) need to call
     * this from their configuration-change handler for a lowered limit to actually shrink existing history.
     */
    public updateMaxSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateMaxSearchHistory called.");
        this.maxSearchHistory = ZowePersistentFilters.resolveMaxSearchHistory();
        this.mSearchHistory = this.mSearchHistory.slice(0, this.maxSearchHistory);
        for (const groupKey of Object.keys(this.mSearchHistoryByGroup)) {
            this.mSearchHistoryByGroup[groupKey] = this.mSearchHistoryByGroup[groupKey].slice(0, this.maxSearchHistory);
        }
        this.updateSearchHistory();
    }

    /**
     * Resolves the history "group" that a profile's search/filter history should be stored under.
     *
     * Grouping is opt-in via the `zowe.settings.historyGroupByHost` setting. When disabled (the default),
     * `undefined` is returned so all profiles continue to share a single history list, matching existing behavior.
     *
     * When enabled, a profile's explicit `historyGroup` property always wins (useful when host-string matching
     * can't tell that two profiles point at the same system, e.g. an IP address vs. a hostname). Otherwise the
     * profile's `host` is used - never `port`, since z/OSMF, SSH, and FTP profiles on the same LPAR commonly use
     * different ports and should still share history.
     */
    public static resolveGroupKey(profile?: imperative.IProfileLoaded | imperative.IProfile): string | undefined {
        if (!SettingsConfig.getDirectValue<boolean>(Constants.SETTINGS_HISTORY_GROUP_BY_HOST, false)) {
            return undefined;
        }
        const profAttrs: imperative.IProfile = (profile as imperative.IProfileLoaded)?.profile ?? (profile as imperative.IProfile);
        const historyGroup = profAttrs?.historyGroup as string | undefined;
        if (historyGroup?.trim()) {
            return historyGroup.trim().toLowerCase();
        }
        const host = profAttrs?.host as string | undefined;
        return host?.trim() ? host.trim().toLowerCase() : undefined;
    }

    /*********************************************************************************************************************************************/
    /* Add functions, for adding items to the persistent settings
    /*********************************************************************************************************************************************/

    /**
     * Adds one line of search history to the local store and
     * updates persistent store. The store contains a
     * maximum number of entries as described by `maxSearchHistory`
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * Once the maximum capacity has been reached the last entry is popped off
     *
     * @param {string} criteria - a line of search criteria
     * @param {imperative.IProfileLoaded} [profile] - the profile the search was performed against, used to
     * resolve which history group the entry belongs to when grouping is enabled
     */
    public addSearchHistory(criteria: string, profile?: imperative.IProfileLoaded): void {
        ZoweLogger.trace("PersistentFilters.addSearchHistory called.");
        if (criteria) {
            // The ungrouped list is always kept up to date, even while grouping is enabled: it is the only
            // shape older Zowe Explorer versions can read, so a user who downgrades keeps their history.
            this.mSearchHistory = this.pushHistoryEntry(this.mSearchHistory, criteria);

            const groupKey = ZowePersistentFilters.resolveGroupKey(profile);
            if (groupKey) {
                this.mSearchHistoryByGroup[groupKey] = this.pushHistoryEntry(this.mSearchHistoryByGroup[groupKey] ?? [], criteria);
            }
            this.updateSearchHistory();
        }
    }

    /**
     * Applies one entry to a most-recently-used list: drops any existing match, pushes the entry to the
     * front, and trims the list back down to `maxSearchHistory`.
     */
    private pushHistoryEntry(list: string[], criteria: string): string[] {
        const updated = list.filter((element) => {
            return element.trim() !== criteria.trim();
        });
        updated.unshift(criteria);
        while (updated.length > this.maxSearchHistory) {
            updated.pop();
        }
        return updated;
    }

    /**
     * Adds the name of one recently-edited file to the local store and
     * updates persistent store. The store contains a
     * maximum number of entries as described by `maxFileHistory`
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * Once the maximum capacity has been reached the last entry is popped off
     *
     * @param {string} criteria - a line of search criteria
     */
    public addFileHistory(criteria: string): void {
        ZoweLogger.trace("PersistentFilters.addFileHistory called.");
        if (criteria) {
            criteria = criteria.toUpperCase();
            // Remove any entries that match
            this.mFileHistory = this.mFileHistory.filter((element) => {
                return element.trim() !== criteria.trim();
            });

            // Add value to front of stack
            this.mFileHistory.unshift(criteria);

            // If list getting too large remove last entry
            if (this.mFileHistory.length > this.maxFileHistory) {
                this.mFileHistory.pop();
            }
            this.updateFileHistory();
        }
    }

    /**
     * Adds one line of session history to the local store and
     * updates persistent store.
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * @param {string} criteria - a session name
     */
    public addSession(criteria: string): void {
        ZoweLogger.trace("PersistentFilters.addSession called.");
        // Remove any entries that match
        this.mSessions = this.mSessions.filter((element) => {
            return element.trim() !== criteria.trim();
        });
        this.mSessions.push(criteria);

        // Use standard sorting
        this.mSessions.sort((a, b) => a.localeCompare(b));
        this.updateSessions();
    }

    /**
     * Adds one line of searched keywords to the local store and
     * updates persistent store. The store contains a
     * maximum number of entries as described by `maxSearchHistory`
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * Once the maximum capacity has been reached the last entry is popped off
     *
     * @param {string} criteria - a line of search criteria
     */
    public addSearchedKeywordHistory(criteria: string): void {
        ZoweLogger.trace("PersistentFilters.addSearchedKeywordHistory called.");
        if (criteria) {
            // Remove any entries that match
            this.mSearchedKeywordHistory = this.mSearchedKeywordHistory.filter((element) => {
                return element.trim() !== criteria.trim();
            });

            // Add value to front of stack
            this.mSearchedKeywordHistory.unshift(criteria);

            // If list getting too large remove last entry
            if (this.mSearchedKeywordHistory.length > this.maxFileHistory) {
                this.mSearchedKeywordHistory.pop();
            }
            this.updateSearchedKeywordHistory();
        }
    }

    /**
     * Adds sort settings for a dataset to the local store and
     * updates persistent store.
     *
     * @param {IZoweDatasetTreeNode} node - dataset node
     * @param {Sorting.NodeSort} setting - sort setting
     */
    public addSortSetting(node: IZoweDatasetTreeNode, setting: Sorting.NodeSort): void {
        ZoweLogger.trace("PersistentFilters.addSortSettings called.");
        const criteria = `${node.getProfileName()}-${node.label as string}`;
        this.mSortSettings[criteria] = setting;
        this.updateSortSettings();
    }

    /*********************************************************************************************************************************************/
    /* Get/read functions, for returning the values stored in the persistent arrays
    /*********************************************************************************************************************************************/

    /**
     * @param {imperative.IProfileLoaded} [profile] - when provided and grouping is enabled, returns only the
     * entries for this profile's group, falling back to the ungrouped list while that group has no entries of
     * its own (so history carries over when grouping is first switched on). When omitted, returns every known
     * entry across the ungrouped list and all groups (used by the "manage history" view).
     */
    public getSearchHistory(profile?: imperative.IProfileLoaded): string[] {
        ZoweLogger.trace("PersistentFilters.getSearchHistory called.");
        if (profile) {
            const groupKey = ZowePersistentFilters.resolveGroupKey(profile);
            const group = groupKey ? this.mSearchHistoryByGroup[groupKey] : undefined;
            return group?.length ? group : this.mSearchHistory;
        }
        const allEntries = [...this.mSearchHistory];
        for (const entry of Object.values(this.mSearchHistoryByGroup).flat()) {
            if (!allEntries.some((element) => element.trim() === entry.trim())) {
                allEntries.push(entry);
            }
        }
        return allEntries;
    }

    public getSessions(): string[] {
        ZoweLogger.trace("PersistentFilters.getSessions called.");
        return this.mSessions;
    }

    public getFileHistory(): string[] {
        ZoweLogger.trace("PersistentFilters.getFileHistory called.");
        return this.mFileHistory;
    }

    public getSearchedKeywordHistory(): string[] {
        ZoweLogger.trace("PersistentFilters.getSearchedKeywordHistory called.");
        return this.mSearchedKeywordHistory;
    }

    public readFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (localStorageSchema) {
            return (localStorageSchema[ZowePersistentFilters.favorites] as string[]) || [];
        }
        return [];
    }

    public readVsamFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readVsamFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (localStorageSchema) {
            return (localStorageSchema[ZowePersistentFilters.vsamFavorites] as string[]) || [];
        }
        return [];
    }

    public readMemberFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readMemberFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (localStorageSchema) {
            return (localStorageSchema[ZowePersistentFilters.memberFavorites] as string[]) || [];
        }
        return [];
    }

    public readMigratedFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readMigratedFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (localStorageSchema) {
            return (localStorageSchema[ZowePersistentFilters.migratedFavorites] as string[]) || [];
        }
        return [];
    }

    public getSortSetting(node: IZoweDatasetTreeNode): Sorting.NodeSort | undefined {
        ZoweLogger.trace("PersistentFilters.getSortSettings called.");
        const criteria = `${node.getProfileName()}-${node.label as string}`;
        return this.mSortSettings[criteria];
    }
    /*********************************************************************************************************************************************/
    /* Remove functions, for removing one item from the persistent arrays
    /*********************************************************************************************************************************************/

    public removeSession(name: string): void {
        ZoweLogger.trace("PersistentFilters.removeSession called.");
        // Remove any entries that match
        this.mSessions = this.mSessions.filter((element) => {
            return element.trim() !== name.trim();
        });
        this.updateSessions();
    }

    /**
     * @param name - Should be in format "[session]: DATASET.QUALIFIERS" or "[session]: /file/path", as appropriate
     */
    public removeFileHistory(name: string): void {
        const index = this.mFileHistory.findIndex((fileHistoryItem) => {
            return fileHistoryItem.includes(name.toUpperCase());
        });
        if (index >= 0) {
            this.mFileHistory.splice(index, 1);
        }
        return this.updateFileHistory();
    }

    public removeSearchHistory(name: string): void {
        for (const list of [this.mSearchHistory, ...Object.values(this.mSearchHistoryByGroup)]) {
            const index = list.findIndex((searchHistoryItem) => {
                return searchHistoryItem.includes(name);
            });
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
        return this.updateSearchHistory();
    }

    public removeEncodingHistory(name: string): void {
        const index = this.mEncodingHistory.findIndex((encodingHistoryItem) => {
            return encodingHistoryItem.includes(name);
        });
        if (index >= 0) {
            this.mEncodingHistory.splice(index, 1);
        }
        this.updateEncodingHistory();
    }

    public removeSearchedKeywordHistory(name: string): void {
        const index = this.mSearchedKeywordHistory.findIndex((keyword) => {
            return keyword.includes(name);
        });
        if (index >= 0) {
            this.mSearchedKeywordHistory.splice(index, 1);
        }
        this.updateSearchedKeywordHistory();
    }

    /*********************************************************************************************************************************************/
    /* Reset functions, for resetting the persistent array to empty (in the extension and in settings.json)
    /*********************************************************************************************************************************************/

    public resetSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.resetSearchHistory called.");
        this.mSearchHistory = [];
        this.mSearchHistoryByGroup = {};
        this.updateSearchHistory();
    }

    public resetSessions(): void {
        ZoweLogger.trace("PersistentFilters.resetSessions called.");
        this.mSessions = [];
        this.updateSessions();
    }

    public resetFileHistory(): void {
        ZoweLogger.trace("PersistentFilters.resetFileHistory called.");
        this.mFileHistory = [];
        this.updateFileHistory();
    }

    public resetEncodingHistory(): void {
        this.mEncodingHistory = [];
        this.updateEncodingHistory();
    }

    public resetSearchedKeywordHistory(): void {
        this.mSearchedKeywordHistory = [];
        this.updateSearchedKeywordHistory();
    }

    /*********************************************************************************************************************************************/
    /* Update functions, for updating the settings.json file in VSCode
    /*********************************************************************************************************************************************/

    public updateFavorites(options: {
        favorites: string[];
        vsamFavorites?: string[];
        memberFavorites?: string[];
        migratedFavorites?: string[];
    }): void {
        ZoweLogger.trace("PersistentFilters.updateFavorites called.");
        const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (settings.persistence) {
            settings.favorites = options.favorites;
            if (options.vsamFavorites !== undefined) {
                settings.vsamFavorites = options.vsamFavorites;
            }
            if (options.memberFavorites !== undefined) {
                settings.memberFavorites = options.memberFavorites;
            }
            if (options.migratedFavorites !== undefined) {
                settings.migratedFavorites = options.migratedFavorites;
            }
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateSearchHistory called.");
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.searchHistory = this.mSearchHistory;
            settings.searchHistoryByGroup = this.mSearchHistoryByGroup;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateSessions(): void {
        ZoweLogger.trace("PersistentFilters.updateSessions called.");
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.sessions = this.mSessions;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateFileHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateFileHistory called.");
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.fileHistory = this.mFileHistory;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateEncodingHistory(): void {
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.encodingHistory = this.mEncodingHistory;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateSearchedKeywordHistory(): void {
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.searchedKeywordHistory = this.mSearchedKeywordHistory;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateSortSettings(): void {
        ZoweLogger.trace("PersistentFilters.updateSortSettings called.");
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.sortSettings = this.mSortSettings;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private initialize(): void {
        ZoweLogger.trace("PersistentFilters.initialize called.");
        const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (settings) {
            const rawSearchHistory = settings[ZowePersistentFilters.searchHistory];
            const rawSearchHistoryByGroup = settings[ZowePersistentFilters.searchHistoryByGroup];
            if (Array.isArray(rawSearchHistory) || rawSearchHistory == null) {
                this.mSearchHistory = rawSearchHistory ?? [];
                this.mSearchHistoryByGroup = rawSearchHistoryByGroup ?? {};
            } else {
                // Pre-release builds stored the grouped map under `searchHistory` itself, which older Zowe
                // Explorer versions cannot read. Move it to its own key and rebuild the ungrouped list.
                this.mSearchHistoryByGroup = rawSearchHistoryByGroup ?? rawSearchHistory;
                this.mSearchHistory = [...new Set(Object.values(this.mSearchHistoryByGroup).flat())].slice(0, this.maxSearchHistory);
            }
            this.mSessions = settings[ZowePersistentFilters.sessions] ?? [];
            this.mFileHistory = settings[ZowePersistentFilters.fileHistory] ?? [];
            this.mEncodingHistory = settings[ZowePersistentFilters.encodingHistory] ?? [];
            this.mSearchedKeywordHistory = settings[ZowePersistentFilters.searchedKeywordHistory] ?? [];
            this.mSortSettings = settings[ZowePersistentFilters.sortSettings] ?? {};
        }
        this.updateSearchHistory();
        this.updateSessions();
        this.updateFileHistory();
        this.updateEncodingHistory();
        this.updateSearchedKeywordHistory();
        this.updateSortSettings();
    }
}
