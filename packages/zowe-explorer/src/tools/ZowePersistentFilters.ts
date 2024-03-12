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
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "./ZoweLogger";
import { ZoweLocalStorage } from "./ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";

/**
 * Standard history and favorite persistance handling routines
 *
 * @export
 * @class PersistentFilters
 */
export class ZowePersistentFilters {
    private static readonly favorites: string = "favorites";
    private static readonly searchHistory: string = "searchHistory";
    private static readonly fileHistory: string = "fileHistory";
    private static readonly sessions: string = "sessions";
    private static readonly encodingHistory: string = "encodingHistory";

    public schema: PersistenceSchemaEnum;
    private mSearchHistory: string[] = [];
    private mFileHistory: string[] = [];
    private mSessions: string[] = [];
    private mEncodingHistory: string[] = [];

    public constructor(
        schema: PersistenceSchemaEnum,
        private maxSearchHistory = Constants.MAX_SEARCH_HISTORY,
        private maxFileHistory = Constants.MAX_FILE_HISTORY
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

    public addEncodingHistory(criteria: string): void {
        if (criteria) {
            criteria = criteria.toUpperCase();
            // Remove any entries that match
            this.mEncodingHistory = this.mEncodingHistory.filter((element) => {
                return element.trim() !== criteria.trim();
            });

            // Add value to front of stack
            this.mEncodingHistory.unshift(criteria);

            this.updateEncodingHistory();
        }
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

    public readFavorites(): string[] {
        ZoweLogger.trace("PersistentFilters.readFavorites called.");
        const localStorageSchema = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (localStorageSchema) {
            return localStorageSchema[ZowePersistentFilters.favorites] as string[];
        }
        return [];
    }

    public getEncodingHistory(): string[] {
        return this.mEncodingHistory;
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

    public removeEncodingHistory(name: string): void {
        const index = this.mEncodingHistory.findIndex((encodingHistoryItem) => {
            return encodingHistoryItem.includes(name);
        });
        if (index >= 0) {
            this.mEncodingHistory.splice(index, 1);
        }
        this.updateEncodingHistory();
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

    public resetEncodingHistory(): void {
        this.mEncodingHistory = [];
        this.updateEncodingHistory();
    }

    /*********************************************************************************************************************************************/
    /* Update functions, for updating the settings.json file in VSCode
    /*********************************************************************************************************************************************/

    public updateFavorites(favorites: string[]): void {
        ZoweLogger.trace("PersistentFilters.updateFavorites called.");
        const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (settings.persistence) {
            settings.favorites = favorites;
            ZoweLocalStorage.setValue<Definitions.ZowePersistentFilter>(this.schema, settings);
        }
    }

    private updateSearchHistory(): void {
        ZoweLogger.trace("PersistentFilters.updateSearchHistory called.");
        const settings = { ...ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema) };
        if (settings.persistence) {
            settings.searchHistory = this.mSearchHistory;
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

    private initialize(): void {
        ZoweLogger.trace("PersistentFilters.initialize called.");
        const settings = ZoweLocalStorage.getValue<Definitions.ZowePersistentFilter>(this.schema);
        if (settings) {
            this.mSearchHistory = settings[ZowePersistentFilters.searchHistory] ?? [];
            this.mSessions = settings[ZowePersistentFilters.sessions] ?? [];
            this.mFileHistory = settings[ZowePersistentFilters.fileHistory] ?? [];
            this.mEncodingHistory = settings[ZowePersistentFilters.encodingHistory] ?? [];
        }
        this.updateSearchHistory();
        this.updateSessions();
        this.updateFileHistory();
        this.updateEncodingHistory();
    }
}
