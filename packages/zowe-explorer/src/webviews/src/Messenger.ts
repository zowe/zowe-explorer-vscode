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

import { WebviewApi } from "vscode-webview";

export interface EventData<T> extends MessageEvent<T> {
    command: string;
    payload: T;
}

export interface MessageHandlerData<T> extends EventData<T> {
    requestId?: string;
    error?: any;
}

// interface ClientVsCode<T> {
//     getState: () => T;
//     setState: (data: T) => void;
//     postMessage: (msg: unknown) => void;
// }

export class Messenger {
    private static vscode: any;

    /**
     * Get the VS Code API in your webview
     * @returns {ClientVsCode<T>}
     */
    public static getVsCodeAPI<T>(): WebviewApi<T> {
        if (!Messenger.vscode) {
            Messenger.vscode = acquireVsCodeApi();
        }
        return Messenger.vscode as WebviewApi<T>;
    }

    /**
     * Listen to the message from your extension
     * @param callback
     */
    public static listen<T>(callback: (event: MessageEvent<EventData<T>>) => void): void {
        window.addEventListener("message", callback);
    }

    /**
     * Remove the listener from the webview
     * @param callback
     */
    public static unlisten<T>(callback: (event: MessageEvent<EventData<T>>) => void): void {
        window.removeEventListener("message", callback);
    }

    /**
     * Send a message from the webview to the extension
     * @param command
     * @param payload
     */
    public static send(command: string, payload?: any): void {
        const vscode = Messenger.getVsCodeAPI();
        if (payload) {
            vscode.postMessage({ command, payload });
        } else {
            vscode.postMessage({ command });
        }
    }

    /**
     * Send a message from the webview to the extension with a request ID (required for async/await responses)
     * @param command
     * @param requestId
     * @param payload
     */
    public static sendWithReqId(command: string, requestId: string, payload?: any): void {
        const vscode = Messenger.getVsCodeAPI();
        if (payload) {
            vscode.postMessage({ command, requestId, payload });
        } else {
            vscode.postMessage({ command, requestId });
        }
    }

    /**
     * Get the state of the extension
     * @returns
     */
    public static getState = () => {
        const vscode = Messenger.getVsCodeAPI();
        return vscode.getState();
    };

    /**
     * Set the state of the extension
     * @returns
     */
    public static setState = (data: any) => {
        const vscode = Messenger.getVsCodeAPI();
        vscode.setState({
            ...data,
        });
    };
}
