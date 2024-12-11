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
import {
    workspaceUtilTabSwitchDelay,
    workspaceUtilMaxEmptyWindowsInTheRow,
    workspaceUtilFileSaveInterval,
    workspaceUtilFileSaveMaxIterationCount,
} from "../config/constants";
import { SettingsConfig } from "./SettingsConfig";
import { Gui } from "@zowe/zowe-explorer-api";

// Set up localization
import * as nls from "vscode-nls";
import { ZoweSaveQueue } from "../abstract/ZoweSaveQueue";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

interface IExtTextEditor extends vscode.TextEditor {
    id: string;
}

/**
 * Opens the next tab in editor with given delay
 */
function openNextTab(delay: number): Promise<void> {
    return new Promise<void>((resolve) => {
        vscode.commands.executeCommand("workbench.action.nextEditor");
        setTimeout(() => resolve(), delay);
    });
}

let fileWasSaved = false;

export function setFileSaved(status: boolean): void {
    fileWasSaved = status;
}

export async function awaitForDocumentBeingSaved(): Promise<void> {
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
export async function checkTextFileIsOpened(path: string): Promise<boolean> {
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
export async function closeOpenedTextFile(path: string): Promise<boolean> {
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
 * Mark a text document as dirty (unsaved) if contents failed to upload.
 * Based on https://stackoverflow.com/questions/74224108
 */
export async function markDocumentUnsaved(document: vscode.TextDocument): Promise<void> {
    const edits = new vscode.WorkspaceEdit();
    edits.insert(document.uri, new vscode.Position(0, 0), " ");
    await vscode.workspace.applyEdit(edits);

    const edits2 = new vscode.WorkspaceEdit();
    edits2.delete(document.uri, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)));
    await vscode.workspace.applyEdit(edits2);
}

/**
 * Call in the event of a save error. This function checks if `Auto Save` is enabled:
 * - If enabled, it is toggled off to prevent an error loop and an error message is shown to inform the user.
 * - If disabled, the function returns.
 *
 * The user can either dismiss the message or click the "Enable Auto Save" button to reactivate the `Auto Save` feature.
 */
export async function handleAutoSaveOnError(): Promise<void> {
    // If auto save is disabled, return. Otherwise, toggle it off
    if (SettingsConfig.getDirectValue("files.autoSave") === "off") {
        return;
    }
    await vscode.commands.executeCommand("workbench.action.toggleAutoSave");

    // Mark remaining documents in queue as unsaved and clear the queue
    await ZoweSaveQueue.markAllUnsaved();

    // Inform the user that `Auto Save` was disabled and offer a button to re-enable it
    Gui.errorMessage(
        localize(
            "zowe.autoSaveToggled",
            "Zowe Explorer encountered a save error and has disabled Auto Save. Once the issue is addressed, enable Auto Save and try again."
        ),
        {
            items: [localize("zowe.enableAutoSave", "Enable Auto Save")],
        }
    ).then(async (value) => {
        if (!value) {
            // User dismissed the message
            return;
        }

        // Toggle auto save back on IFF it wasn't already reactivated
        // (the prompt can be answered or dismissed at any point after its shown)
        if (SettingsConfig.getDirectValue("files.autoSave") === "off") {
            await vscode.commands.executeCommand("workbench.action.toggleAutoSave");
        }
    });
}
