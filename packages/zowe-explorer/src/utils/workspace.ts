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
import {
    workspaceUtilTabSwitchDelay,
    workspaceUtilMaxEmptyWindowsInTheRow,
    workspaceUtilFileSaveInterval,
    workspaceUtilFileSaveMaxIterationCount,
} from "../config/constants";

interface IExtTextEditor extends vscode.TextEditor {
    id: string;
}

/**
 * Opens the next tab in editor with given delay
 */
function openNextTab(delay: number) {
    return new Promise<void>((resolve) => {
        vscode.commands.executeCommand("workbench.action.nextEditor");
        setTimeout(() => resolve(), delay);
    });
}

let fileWasSaved = false;

export function setFileSaved(status: boolean) {
    fileWasSaved = status;
}

export async function awaitForDocumentBeingSaved() {
    fileWasSaved = false;
    return new Promise<void>((resolve) => {
        let count = 0;
        const saveWaitIntervalId = setInterval(() => {
            if (workspaceUtilFileSaveMaxIterationCount > count) {
                count++;
                if (fileWasSaved) {
                    fileWasSaved = false;
                    clearInterval(saveWaitIntervalId);
                    resolve();
                }
            } else {
                clearInterval(saveWaitIntervalId);
                resolve();
            }
        }, workspaceUtilFileSaveInterval);
    });
}

/**
 * Checks if file is opened using iteration through tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to check only buffered status of files
 * There's an issue on GitHub for such feature: https://github.com/Microsoft/vscode/issues/15178 let's track it
 * Idea of the approach was borrowed from the another extension: https://github.com/eamodio/vscode-restore-editors/blob/master/src/documentManager.ts
 * Also notice that timer delay as well as iteration through opened tabs can cause side-effects on slow machines
 */
export async function checkTextFileIsOpened(path: string) {
    const openedWindows = [] as IExtTextEditor[];

    let emptySelectedCountInTheRow = 0;
    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

    // The idea of the condition is we can meet binary files opened, which have no text editor
    // So we should set some maximum occurrences point and get out of the loop
    while (
        emptySelectedCountInTheRow < workspaceUtilMaxEmptyWindowsInTheRow &&
        !openedWindows.some((window) => selectedEditor && window.id === selectedEditor.id)
    ) {
        if (selectedEditor) {
            emptySelectedCountInTheRow = 0;
            openedWindows.push(selectedEditor);
        } else {
            emptySelectedCountInTheRow++;
        }

        await openNextTab(workspaceUtilTabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    }

    return openedWindows.some((window) => window.document.fileName === path);
}

/**
 * Closes opened file tab using iteration through the tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to close only currently selected editor
 * For us it means we need to select editor first, which is again not possible via existing VSCode APIs
 */
export async function closeOpenedTextFile(path: string) {
    const openedWindows = [] as IExtTextEditor[];

    let emptySelectedCountInTheRow = 0;
    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

    // The idea of the condition is we can meet binary files opened, which have no text editor
    // So we should set some maximum occurrences point and get out of the loop
    while (
        emptySelectedCountInTheRow < workspaceUtilMaxEmptyWindowsInTheRow &&
        !openedWindows.some((window) => selectedEditor && window.id === selectedEditor.id)
    ) {
        if (selectedEditor) {
            emptySelectedCountInTheRow = 0;
            openedWindows.push(selectedEditor);
        } else {
            emptySelectedCountInTheRow++;
        }

        await openNextTab(workspaceUtilTabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

        if (selectedEditor && selectedEditor.document.fileName === path) {
            const isDirty = selectedEditor.document.isDirty;
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            if (isDirty) {
                await awaitForDocumentBeingSaved();
            }
            return true;
        }
    }

    return false;
}

/**
 * Handles saving stacking issue by queueing saves as TextEdit until the user has
 * completed their edits and proceeds to save each TextEdit in a FIFO structure.
 */
export function handleSaveStacking(): void {
    const saveListener = vscode.workspace.onWillSaveTextDocument(async (save) => {
        const preSaveEditsQueue: Thenable<vscode.TextEdit[]> = new Promise((resolve) => {
            const documentListener = vscode.workspace.onDidChangeTextDocument(async (document) => {
                const changes: vscode.TextEdit[] = document.contentChanges.map((change) => {
                    return new vscode.TextEdit(change.range, change.text);
                });
                const completedTypingEdits = async () => {
                    await documentListener.dispose();
                    await saveListener.dispose();
                    return changes;
                };
                resolve(await completedTypingEdits());
            });
        });
        save.waitUntil(preSaveEditsQueue);
    });
}
