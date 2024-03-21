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

import { Gui, WebView } from "@zowe/zowe-explorer-api";
import { Disposable, ExtensionContext, OpenDialogOptions, Uri } from "vscode";

export type CertWizardOpts = {
    certUri?: Uri;
    keyUri?: Uri;
    dialogOpts: OpenDialogOptions;
};

export class CertificateWizard extends WebView {
    private onUpdateDisposable: Disposable;
    private opts: CertWizardOpts;

    public constructor(context: ExtensionContext, opts: CertWizardOpts) {
        super("Certificate Wizard", "certificate-wizard", context, (message: object) => this.onDidReceiveMessage(message));
        this.opts = opts;
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "promptCert":
                {
                    const tempCert = await Gui.showOpenDialog({
                        title: "Enter the path to the certificate for authenticating the connection.",
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        defaultUri: this.opts.certUri,
                        filters: { "Certificate Files": ["cer", "crt", "pem"], "All Files": ["*"] },
                        openLabel: "Select Certificate",
                        ...(this.opts.dialogOpts ?? {}),
                    });
                    if (tempCert != null && tempCert[0] != null && tempCert[0].fsPath) {
                        this.opts.certUri = tempCert[0];
                    }
                }
                break;
            case "promptCertKey":
                {
                    const tempCertKey = await Gui.showOpenDialog({
                        title: "Enter the path to the certificate key for authenticating the connection.",
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        defaultUri: this.opts.keyUri,
                        filters: { "Certificate Keys": ["cer", "crt", "pem", "key"], "All Files": ["*"] },
                        openLabel: "Select Certificate Key",
                        ...(this.opts.dialogOpts ?? {}),
                    });
                    if (tempCertKey != null && tempCertKey[0] != null && tempCertKey[0].fsPath) {
                        this.opts.keyUri = tempCertKey[0];
                    }
                }
                break;
            default:
                break;
        }

        await this.panel.webview.postMessage({
            opts: this.opts,
        });
        return Promise.resolve();
    }
}
