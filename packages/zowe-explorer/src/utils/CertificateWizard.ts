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

import { WebView } from "@zowe/zowe-explorer-api";
import { Disposable, ExtensionContext } from "vscode";

export class CertificateWizard extends WebView {
    private onUpdateDisposable: Disposable;

    public constructor(context: ExtensionContext) {
        super("Certificate Wizard", "certificate-wizard", context, (message: object) => this.onDidReceiveMessage(message));
    }

    protected onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "submit":
                break;
            case "cancelled":
                break;
            default:
                break;
        }
        return Promise.resolve();
    }
}
