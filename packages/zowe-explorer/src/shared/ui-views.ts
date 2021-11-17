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

export class UIViews {
    public static async inputBox(inputBoxOptions: vscode.InputBoxOptions): Promise<string> {
        if (!inputBoxOptions.validateInput) {
            // adding this for the theia breaking changes with input boxes
            inputBoxOptions.validateInput = (value) => null;
        }
        return vscode.window.showInputBox(inputBoxOptions);
    }
}
