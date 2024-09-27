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

import { NetworkError, WebView } from "@zowe/zowe-explorer-api";
import { ExtensionContext, l10n } from "vscode";

type TroubleshootData = {
    error: NetworkError;
    stackTrace?: string;
};

export class TroubleshootError extends WebView {
    public constructor(context: ExtensionContext, public errorData: TroubleshootData) {
        super(l10n.t("Troubleshoot Error"), "troubleshoot-error", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
        });
    }

    public async onDidReceiveMessage(message: object): Promise<void> {
        if (!("command" in message)) {
            return;
        }

        switch (message.command) {
            case "ready":
                await this.setErrorData(this.errorData);
        }
    }

    /**
     * Propagate error data to the webview
     *
     * @param errorData Error and stack trace
     * @returns Whether Zowe Explorer successfully sent the data to the webview
     */
    public async setErrorData(errorData: TroubleshootData): Promise<boolean> {
        return this.panel.webview.postMessage({
            error: errorData.error,
            stackTrace: errorData.stackTrace,
        });
    }
}
