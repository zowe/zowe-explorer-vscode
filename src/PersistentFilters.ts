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

    public schema: string;
    public mHistory: string[] = [];

    private maxHistory = 5;

    constructor(schema: string) {
        this.schema = schema;
        this.initializeHistory();
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
        // Remove any entries that match
        this.mHistory = this.mHistory.filter( (element) => {
            return element.trim() !== criteria.trim();
        });

        // Add value to frontof stack
        this.mHistory.unshift(criteria);

        // If list getting too large remove last entry
        if (this.mHistory.length > this.maxHistory) {
            this.mHistory.pop();
        }
        this.updateHistory();
    }

    public getHistory() {
        return this.mHistory;
    }

    public async reset() {
        this.mHistory = [];
        this.updateHistory();
    }

    /**
     * Initializes the history section by reading from a file
     *
     */
    private async initializeHistory() {
        let lines: string[];
        if (vscode.workspace.getConfiguration(this.schema)) {
            lines = vscode.workspace.getConfiguration(this.schema).get(PersistentFilters.history);
        }
        if (lines) {
            this.mHistory = lines;
        } else {
            this.reset();
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
}
