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

import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";

// This class will hold all UI/GUI actions like input boxes, dialog boxes, pop up messages, and so on.
// This will keep vs code user interaction code separate from logic code.
// NOTE: This refactor is still under construction
export class UIViews {
    /**
     * @deprecated Please use ZoweVsCodeExtension.inputBox(...)
     */
    public static async inputBox(inputBoxOptions: vscode.InputBoxOptions): Promise<string> {
        return await ZoweVsCodeExtension.inputBox(inputBoxOptions);
    }
}
