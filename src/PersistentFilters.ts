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

/**
 * Standard history and favorite persistance handling routines
 *
 * @export
 * @class PersistentFilters
 */
export class PersistentFilters {
    private static readonly favorites: string = "favorites";
    private static readonly history: string = "history";
    private static readonly sessions: string = "sessions";

    public schema: string;
    private mHistory: string[] = [];
    private mSessions: string[] = [];

    constructor(schema: string, private maxHistory = 5) {
        this.schema = schema;
        this.initialize();
    }

    public readFavorites(): string[] {
        if (vscode.workspace.getConfiguration(this.schema)) {
            return vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.favorites);
        }
        return [];
    }

    public async updateFavorites(favorites: string[]) {
        // settings are read-only, so were cloned
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.favorites = favorites;
            await vscode.workspace.getConfiguration().update(this.schema, settings, vscode.ConfigurationTarget.Global);
        }
    }
    /**
     * Adds one line of history to the local store and
     * updates persistent store. The store contains a
     * maximum number of entries as described by `maxHistory`
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * Once the maximum capacity has been reached the last entry is popped off
     *
     * @param {string} criteria - a line of search criteria
     */
    public async addHistory(criteria: string) {
        if (criteria) {
            // Remove any entries that match
            this.mHistory = this.mHistory.filter( (element) => {
                return element.trim() !== criteria.trim();
            });

            // Add value to front of stack
            this.mHistory.unshift(criteria);

            // If list getting too large remove last entry
            if (this.mHistory.length > this.maxHistory) {
                this.mHistory.pop();
            }
            this.updateHistory();
        }
    }

    public getHistory() {
        return this.mHistory;
    }

    public async resetHistory() {
        this.mHistory = [];
        this.updateHistory();
    }
    /**
     * Adds one line of history to the local store and
     * updates persistent store.
     *
     * If the entry matches a previous entry it is removed from the list
     * at that position in the stack.
     *
     * @param {string} criteria - a session name
     */
    public async addSession(criteria: string) {
        // Remove any entries that match
        this.mSessions = this.mSessions.filter( (element) => {
            return element.trim() !== criteria.trim();
        });
        this.mSessions.push(criteria);

        // Use standard sorting
        this.mSessions.sort();
        this.updateSessions();
    }
    public async removeSession(criteria: string) {
        // Remove any entries that match
        this.mSessions = this.mSessions.filter( (element) => {
            return element.trim() !== criteria.trim();
        });
        this.updateSessions();
    }
    public getSessions() {
        return this.mSessions;
    }

    public async resetSessions() {
        this.mSessions = [];
        this.updateSessions();
    }

    /**
     * Initializes the history and sessions sections by reading from a file
     */
    private async initialize() {
        let lines: string[];
        if (vscode.workspace.getConfiguration(this.schema)) {
            lines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.history);
        }
        if (lines) {
            this.mHistory = lines;
        } else {
            this.resetHistory();
        }
        if (vscode.workspace.getConfiguration(this.schema)) {
            lines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.sessions);
        }
        if (lines) {
            this.mSessions = lines;
        } else {
            this.resetSessions();
        }
    }

    private async updateHistory() {
        // settings are read-only, so make a clone
        const settings: any = { ...vscode.workspace.getConfiguration(this.schema) };
        if (settings.persistence) {
            settings.history = this.mHistory;
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
}
