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

import { DeferredPromise, Gui, WebView } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";

const userDismissed = vscode.l10n.t("User dismissed the Config Editor.");

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
        });
        this.panel.onDidDispose(() => {
            this.userSubmission.reject(userDismissed);
        });
    }
    protected async onDidReceiveMessage(message: any): Promise<void> {}
}
