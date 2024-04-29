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

import * as globals from "./globals";
import { PersistenceSchemaEnum, Types } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./utils/ZoweLogger";
import { ZoweLocalStorage } from "./utils/ZoweLocalStorage";

export type PersistentFilter = {
    persistence: boolean;
    favorites: string[];
    history: string[];
    sessions: string[];
    searchHistory: string[];
    fileHistory: string[];
    templates: Types.DataSetAllocTemplate[];
};

/**
 * Standard history and favorite persistance handling routines
 *
 * @export
 * @class PersistentFilters
 */
export class PersistentFilters {
    private static readonly favorites: string = "favorites";
    private static readonly searchHistory: string = "searchHistory";
    private static readonly fileHistory: string = "fileHistory";
    private static readonly sessions: string = "sessions";

    public schema: PersistenceSchemaEnum;
    private mSearchHistory: string[] = [];
    private mFileHistory: string[] = [];
    private mSessions: string[] = [];
    private mDsTemplates: Types.DataSetAllocTemplate[] = [];

    public constructor(
        schema: PersistenceSchemaEnum,
        private maxSearchHistory = globals.MAX_SEARCH_HISTORY,
        private maxFileHistory = globals.MAX_FILE_HISTORY
    ) {
        ZoweLogger.trace("PersistentFilters.constructor called.");
        this.schema = schema;
        this.initialize();
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
     */
    public addSearchHistory(criteria: string): void {
        ZoweLogger.trace("PersistentFilters.addSearchHistory called.");
        if (criteria) {
            // Remove any entries that match
            this.mSearchHistory = this.mSearchHistory.filter((element) => {
                return element.trim() !== criteria.trim();
            });

            // Add value to front of stack
            this.mSearchHistory.unshift(criteria);

            // If list getting too large remove last entry
            if (this.mSearchHistory.length > this.maxSearchHistory) {
                this.mSearchHistory.pop();
            }
            this.updateSearchHistory();
        }
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

    public addDsTemplateHistory(criteria: Types.DataSetAllocTemplate): void {
        if (criteria) {
            let newTemplateName: string;
            Object.entries(criteria).forEach(([key]) => {
                newTemplateName = key;
            });
            // Remove any entries that match
            this.mDsTemplates = this.mDsTemplates.filter((template) => {
                let historyName: string;
                Object.entries(template).forEach(([key]) => {
                    historyName = key;
                });
                return historyName !== newTemplateName;
            });
            // Add value to front of stack
            this.mDsTemplates.unshift(criteria);
            this.updateDsTemplateHistory();
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

    /*********************************************************************************************************************************************/
    /* Get/read functions, for returning the values stored in the persistent arrays
    /*********************************************************************************************************************************************/

    public getSearchHistory(): string[] {
        ZoweLogger.trace("PersistentFilters.getSearchHistory called.");
        return this.mSearchHistory;
    }

    public getSessions(): string[] {
        ZoweLogger.trace("PersistentFilters.getSessions called.");
        return this.mSessions;
    }

    public getFileHistory(): string[] {
        ZoweLogger.trace("PersistentFilters.getFileHistory called.");
        return this.mFileHistory;
    }

    public getDsTemplates(): Types.DataSetAllocTemplate[] {
        const dsTemplateLines: Types.DataSetAllocTemplate[] =
            // See https://github.com/zowe/vscode-extension-for-zowe/issues/2770
            ZoweLocalStorage.getValue<PersistentFilter>(this.schema).templates ?? [];
        if (dsTemplateLines.length !== this.mDsTemplates.length) {
            this.mDsTemplates = dsTemplateLines;
        }
        return this.mDsTemplates;
    }

    public readFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<PersistentFilter>(this.schema);
        if (localStorageSchema) {
            return localStorageSchema[PersistentFilters.favorites] as string[];
        }
        return [];
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
        const index = this.mSearchHistory.findIndex((searchHistoryItem) => {
            return searchHistoryItem.includes(name);
        });
        if (index >= 0) {
            this.mSearchHistory.splice(index, 1);
        }
        return this.updateSearchHistory();
    }

    /*********************************************************************************************************************************************/
    /* Reset functions, for resetting the persistent array to empty (in the extension and in settings.json)
    /*********************************************************************************************************************************************/

    public resetSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.resetSearchHistory called.");
        this.mSearchHistory = [];
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

    public resetDsTemplateHistory(): void {
        this.mDsTemplates = [];
        this.updateDsTemplateHistory();
    }

    /*********************************************************************************************************************************************/
    /* Update functions, for updating the settings.json file in VSCode
    /*********************************************************************************************************************************************/

    public updateFavorites(favorites: string[]): void {
        ZoweLogger.trace("PersistentFilters.updateFavorites called.");
        const settings = ZoweLocalStorage.getValue<PersistentFilter>(this.schema);
        if (settings.persistence) {
            settings.favorites = favorites;
            ZoweLocalStorage.setValue<PersistentFilter>(this.schema, settings);
        }
    }

    private updateSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateSearchHistory called.");
        const settings = { ...ZoweLocalStorage.getValue<PersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.searchHistory = this.mSearchHistory;
            ZoweLocalStorage.setValue<PersistentFilter>(this.schema, settings);
        }
    }

    private updateSessions(): void {
        ZoweLogger.trace("PersistentFilters.updateSessions called.");
        const settings = { ...ZoweLocalStorage.getValue<PersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.sessions = this.mSessions;
            ZoweLocalStorage.setValue<PersistentFilter>(this.schema, settings);
        }
    }

    private updateFileHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateFileHistory called.");
        const settings = { ...ZoweLocalStorage.getValue<PersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.fileHistory = this.mFileHistory;
            ZoweLocalStorage.setValue<PersistentFilter>(this.schema, settings);
        }
    }

    private updateDsTemplateHistory(): void {
        // settings are read-only, so make a clone
        const settings: any = { ...ZoweLocalStorage.getValue<PersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.templates = this.mDsTemplates;
            ZoweLocalStorage.setValue<PersistentFilter>(this.schema, settings);
        }
    }

    private initialize(): void {
        ZoweLogger.trace("PersistentFilters.initialize called.");
        const settings = ZoweLocalStorage.getValue<PersistentFilter>(this.schema);
        if (settings) {
            this.mSearchHistory = settings[PersistentFilters.searchHistory] ?? [];
            this.mSessions = settings[PersistentFilters.sessions] ?? [];
            this.mFileHistory = settings[PersistentFilters.fileHistory] ?? [];
        }
        this.updateFileHistory();
        this.updateSearchHistory();
        this.updateSessions();
    }
}
