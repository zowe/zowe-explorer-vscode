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
import { IZoweLogger, MessageSeverity } from "../logger";

/**
 * Options for GUI's
 */
export namespace GuiOptions {
    export interface GuiMessageOptions<T extends string | vscode.MessageItem> {
        severity?: MessageSeverity;
        items?: T[];
        logger?: IZoweLogger;
        vsCodeOpts?: vscode.MessageOptions;
    }

    export interface GuiWebviewOptions {
        viewType: string;
        title: string;
        showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean };
        vscode?: vscode.WebviewPanelOptions & vscode.WebviewOptions;
    }
}
