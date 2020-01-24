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

let wasSavedRecently = false;
let saveListener = null;

/**
 * Helper function which sets up listener for save wiping out the data after certain delay to prevent the fact of second save
 * @param wipeOutTime {number}
 */
export function attachRecentSaveListener(wipeOutTime = 500) {
    if (saveListener) {
        saveListener.dispose();
    }

    saveListener = vscode.workspace.onDidSaveTextDocument(() => {
        wasSavedRecently = true;

        setTimeout(() => {
            wasSavedRecently = false;
        }, wipeOutTime);
    });
}

/**
 * Helper function which returns saved save flag
 *
 * @returns {boolean}
 */
export function getRecentSaveStatus() {
    return wasSavedRecently;
}

/**
 * Helper function which disposes recent save listener
 */
export function disposeRecentSaveListener() {
    if (saveListener) {
        saveListener.dispose();
    }
}
