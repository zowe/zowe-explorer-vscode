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
export const enum MessageSeverity {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

export class IZoweLogger {}

export interface GuiMessageOptions {
    severity?: MessageSeverity;
    items?: string[];
    logger?: IZoweLogger;
    vsCodeOpts?: object;
}

export namespace Gui {
    /**
     * Displays a message to the user, including any specified options.
     * @param message The message to display
     * @param options Any additional options for the message
     * @returns A thenable containing the selected item (if items were specified), or `undefined`
     */
    export function showMessage(message: string, options?: GuiMessageOptions): Thenable<string> {
        return undefined;
    }

    export function errorMessage(message: string, options?: Omit<GuiMessageOptions, "severity">): Thenable<string> {
        return undefined;
    }
}
