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

import * as vscode from "vscode";
import * as api from "@zowe/zowe-explorer-api";
import * as globals from "./globals";
import { SettingsConfig } from "./utils/SettingsConfig";

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
    private static readonly templates: string = "templates";

    public schema: string;
    private mSearchHistory: string[] = [];
    private mFileHistory: string[] = [];
    private mSessions: string[] = [];
    private mDsTemplates: api.DataSetAllocTemplate[] = [];

    public constructor(schema: string, private maxSearchHistory = globals.MAX_SEARCH_HISTORY, private maxFileHistory = globals.MAX_FILE_HISTORY) {
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

    public addDsTemplateHistory(criteria: api.DataSetAllocTemplate): void {
        if (criteria) {
            let newTemplateName: string;
            Object.entries(criteria).forEach(([key, value]) => {
                newTemplateName = key;
            });
            // Remove any entries that match
            this.mDsTemplates = this.mDsTemplates.filter((template) => {
                let historyName: string;
                Object.entries(template).forEach(([key1, value]) => {
                    historyName = key1;
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

    public getDsTemplates(): api.DataSetAllocTemplate[] {
        const dsTemplateLines: api.DataSetAllocTemplate[] = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.templates);
        if (dsTemplateLines.length !== this.mDsTemplates.length) {
            this.mDsTemplates = dsTemplateLines;
        }
        return this.mDsTemplates;
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

    public removeSession(name: string): void {
        // Remove any entries that match
        this.mSessions = this.mSessions.filter((element) => {
            return element.trim() !== name.trim();
        });
        this.updateSessions();
    }

    /**
     * @param name - Should be in format "[session]: DATASET.QUALIFIERS" or "[session]: /file/path", as appropriate
     */
    public removeFileHistory(name: string): Thenable<void> {
        const index = this.mFileHistory.findIndex((fileHistoryItem) => {
            return fileHistoryItem.includes(name.toUpperCase());
        });
        if (index >= 0) {
            this.mFileHistory.splice(index, 1);
        }
        return this.updateFileHistory();
    }

    /*********************************************************************************************************************************************/
    /* Reset functions, for resetting the persistent array to empty (in the extension and in settings.json)
    /*********************************************************************************************************************************************/

    public resetSearchHistory(): void {
        this.mSearchHistory = [];
        this.updateSearchHistory();
    }

    public resetSessions(): void {
        this.mSessions = [];
        this.updateSessions();
    }

    public resetFileHistory(): void {
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

    public updateFavorites(favorites: string[]): Thenable<void> {
        // settings are read-only, so were cloned
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.favorites = favorites;
            return SettingsConfig.setDirectValue(this.schema, settings);
        }
    }

    private updateSearchHistory(): Thenable<void> {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.searchHistory = this.mSearchHistory;
            return SettingsConfig.setDirectValue(this.schema, settings);
        }
    }

    private updateSessions(): Thenable<void> {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.sessions = this.mSessions;
            return SettingsConfig.setDirectValue(this.schema, settings);
        }
    }

    private updateFileHistory(): Thenable<void> {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.fileHistory = this.mFileHistory;
            return SettingsConfig.setDirectValue(this.schema, settings);
        }
    }

    private updateDsTemplateHistory(): void {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.templates = this.mDsTemplates;
            SettingsConfig.setDirectValue(this.schema, settings);
        }
    }

    private initialize(): void {
        let searchHistoryLines: string[];
        let sessionLines: string[];
        let fileHistoryLines: string[];
        let dsTemplateLines: api.DataSetAllocTemplate[];
        if (vscode.workspace.getConfiguration(this.schema)) {
            searchHistoryLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.searchHistory);
            sessionLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.sessions);
            fileHistoryLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.fileHistory);
            dsTemplateLines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.templates);
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
        if (dsTemplateLines) {
            this.mDsTemplates = dsTemplateLines;
        } else {
            this.resetDsTemplateHistory();
        }
    }
}
