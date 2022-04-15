/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import * as globals from "./globals";

/**
 * Standard history and favorite persistance handling routines
 *
 * @export
 * @class PersistentFilters
 */
export class PersistentFilters {
    /**
     * Retrieves a generic setting either in user or workspace.
     * <pre>{@code
     *  PersistentFilters.getDirectValue("zowe.commands.alwaysEdit") as boolean;
     * }</pre>
     * @param key - string. The attribute value that needs retrieving
     */
    public static getDirectValue(key: string): string | boolean | undefined {
        const settings: any = { ...vscode.workspace.getConfiguration() };
        return settings.get(key);
    }
    private static readonly favorites: string = "favorites";
    private static readonly searchHistory: string = "searchHistory";
    private static readonly fileHistory: string = "fileHistory";
    private static readonly sessions: string = "sessions";

    public schema: string;
    private mSearchHistory: string[] = [];
    private mFileHistory: string[] = [];
    private mSessions: string[] = [];

    constructor(
        schema: string,
        private maxSearchHistory = globals.MAX_SEARCH_HISTORY,
        private maxFileHistory = globals.MAX_FILE_HISTORY
    ) {
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
    public async addSearchHistory(criteria: string) {
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
    public async addFileHistory(criteria: string) {
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
    public async addSession(criteria: string) {
        // Remove any entries that match
        this.mSessions = this.mSessions.filter((element) => {
            return element.trim() !== criteria.trim();
        });
        this.mSessions.push(criteria);

        // Use standard sorting
        this.mSessions.sort();
        this.updateSessions();
    }

    /*********************************************************************************************************************************************/
    /* Get/read functions, for returning the values stored in the persistent arrays
    /*********************************************************************************************************************************************/

    public getSearchHistory(): string[] {
        return this.mSearchHistory;
    }

    public getSessions(): string[] {
        return this.mSessions;
    }

    public getFileHistory(): string[] {
        return this.mFileHistory;
    }

    public readFavorites(): string[] {
        if (vscode.workspace.getConfiguration(this.schema)) {
            return vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.favorites);
        }
        return [];
    }

    /*********************************************************************************************************************************************/
    /* Remove functions, for removing one item from the persistent arrays
    /*********************************************************************************************************************************************/

    public async removeSession(name: string) {
        // Remove any entries that match
        this.mSessions = this.mSessions.filter((element) => {
            return element.trim() !== name.trim();
        });
        this.updateSessions();
    }

    /**
     * @param name - Should be in format "[session]: DATASET.QUALIFIERS" or "[session]: /file/path", as appropriate
     */
    public async removeFileHistory(name: string) {
        const index = this.mFileHistory.findIndex((fileHistoryItem) => {
            return fileHistoryItem.includes(name.toUpperCase());
        });
        if (index >= 0) {
            this.mFileHistory.splice(index, 1);
        }
        await this.updateFileHistory();
    }

    /*********************************************************************************************************************************************/
    /* Reset functions, for resetting the persistent array to empty (in the extension and in settings.json)
    /*********************************************************************************************************************************************/

    public async resetSearchHistory() {
        this.mSearchHistory = [];
        this.updateSearchHistory();
    }

    public async resetSessions() {
        this.mSessions = [];
        this.updateSessions();
    }

    public async resetFileHistory() {
        this.mFileHistory = [];
        this.updateFileHistory();
    }

    /*********************************************************************************************************************************************/
    /* Update functions, for updating the settings.json file in VSCode
    /*********************************************************************************************************************************************/

    public async updateFavorites(favorites: string[]) {
        // settings are read-only, so were cloned
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.favorites = favorites;
            await vscode.workspace.getConfiguration().update(this.schema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    private async updateSearchHistory() {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.searchHistory = this.mSearchHistory;
            await vscode.workspace.getConfiguration().update(this.schema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    private async updateSessions() {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.sessions = this.mSessions;
            await vscode.workspace.getConfiguration().update(this.schema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    private async updateFileHistory() {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.fileHistory = this.mFileHistory;
            await vscode.workspace.getConfiguration().update(this.schema, settings, vscode.ConfigurationTarget.Global);
        }
    }

    private async initialize() {
        let searchHistoryLines: string[];
        let sessionLines: string[];
        let fileHistoryLines: string[];
        if (vscode.workspace.getConfiguration(this.schema)) {
            searchHistoryLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.searchHistory);
            sessionLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.sessions);
            fileHistoryLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.fileHistory);
        }
        if (searchHistoryLines) {
            this.mSearchHistory = searchHistoryLines;
        } else {
            this.resetSearchHistory();
        }
        if (sessionLines) {
            this.mSessions = sessionLines;
        } else {
            this.resetSessions();
        }
        if (fileHistoryLines) {
            this.mFileHistory = fileHistoryLines;
        } else {
            this.resetFileHistory();
        }
    }
}
