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
import { Constants } from "./Constants";

interface IExtTextEditor extends vscode.TextEditor {
    id: string;
}

export class Workspace {
    /**
     * Opens the next tab in editor with given delay
     */
    private static openNextTab(delay: number): Promise<void> {
        return new Promise<void>((resolve) => {
            vscode.commands.executeCommand("workbench.action.nextEditor");
            setTimeout(() => resolve(), delay);
        });
    }

    private static fileWasSaved = false;

    public static setFileSaved(status: boolean): void {
        Workspace.fileWasSaved = status;
    }

    public static async awaitForDocumentBeingSaved(): Promise<void> {
        Workspace.fileWasSaved = false;
        return new Promise<void>((resolve) => {
            let count = 0;
            const saveWaitIntervalId = setInterval(() => {
                if (Constants.WORKSPACE_UTIL_FILE_SAVE_MAX_ITERATION_COUNT > count) {
                    count++;
                    if (Workspace.fileWasSaved) {
                        Workspace.fileWasSaved = false;
                        clearInterval(saveWaitIntervalId);
                        resolve();
                    }
                } else {
                    clearInterval(saveWaitIntervalId);
                    resolve();
                }
            }, Constants.WORKSPACE_UTIL_FILE_SAVE_INTERVAL);
        });
    }

    /**
     * Checks if file is opened using iteration through tabs
     * This kind of method is caused by incompleteness of VSCode API, which allows to check only buffered status of files
     * There's an issue on GitHub for such feature: https://github.com/Microsoft/vscode/issues/15178 let's track it
     * Idea of the approach was borrowed from the another extension: https://github.com/eamodio/vscode-restore-editors/blob/master/src/documentManager.ts
     * Also notice that timer delay as well as iteration through opened tabs can cause side-effects on slow machines
     */
    public static async checkTextFileIsOpened(path: string): Promise<boolean> {
        const openedWindows = [] as IExtTextEditor[];

        let emptySelectedCountInTheRow = 0;
        let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

        // The idea of the condition is we can meet binary files opened, which have no text editor
        // So we should set some maximum occurrences point and get out of the loop
        while (
            emptySelectedCountInTheRow < Constants.WORKSPACE_UTIL_MAX_EMPTY_WINDOWS_IN_THE_ROW &&
            !openedWindows.some((window) => selectedEditor && window.id === selectedEditor.id)
        ) {
            if (selectedEditor) {
                emptySelectedCountInTheRow = 0;
                openedWindows.push(selectedEditor);
            } else {
                emptySelectedCountInTheRow++;
            }

            await Workspace.openNextTab(Constants.WORKSPACE_UTIL_TAB_SWITCH_DELAY);
            selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
        }

        return openedWindows.some((window) => window.document.fileName === path);
    }

    /**
     * Closes opened file tab using iteration through the tabs
     * This kind of method is caused by incompleteness of VSCode API, which allows to close only currently selected editor
     * For us it means we need to select editor first, which is again not possible via existing VSCode APIs
     */
    public static async closeOpenedTextFile(path: string): Promise<boolean> {
        const openedWindows = [] as IExtTextEditor[];

        let emptySelectedCountInTheRow = 0;
        let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

        // The idea of the condition is we can meet binary files opened, which have no text editor
        // So we should set some maximum occurrences point and get out of the loop
        while (
            emptySelectedCountInTheRow < Constants.WORKSPACE_UTIL_MAX_EMPTY_WINDOWS_IN_THE_ROW &&
            !openedWindows.some((window) => selectedEditor && window.id === selectedEditor.id)
        ) {
            if (selectedEditor) {
                emptySelectedCountInTheRow = 0;
                openedWindows.push(selectedEditor);
            } else {
                emptySelectedCountInTheRow++;
            }

            await Workspace.openNextTab(Constants.WORKSPACE_UTIL_TAB_SWITCH_DELAY);
            selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

            if (selectedEditor && selectedEditor.document.fileName === path) {
                const isDirty = selectedEditor.document.isDirty;
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                if (isDirty) {
                    await Workspace.awaitForDocumentBeingSaved();
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Mark a text document as dirty (unsaved) if contents failed to upload.
     * Based on https://stackoverflow.com/questions/74224108
     */
    public static async markDocumentUnsaved(document: vscode.TextDocument): Promise<void> {
        const edits = new vscode.WorkspaceEdit();
        edits.insert(document.uri, new vscode.Position(0, 0), " ");
        await vscode.workspace.applyEdit(edits);

        const edits2 = new vscode.WorkspaceEdit();
        edits2.delete(document.uri, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)));
        await vscode.workspace.applyEdit(edits2);
    }
}
