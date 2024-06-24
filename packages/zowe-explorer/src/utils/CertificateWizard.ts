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
import * as vscode from "vscode";
import { ZoweLogger } from "../tools/ZoweLogger";

export type CertWizardOpts = {
    cert?: string;
    certKey?: string;
    dialogOpts?: vscode.OpenDialogOptions;
};

class DeferredPromise<T> {
    public promise: Promise<T>;
    public resolve: (value: T | PromiseLike<T>) => void;
    public reject: (reason?: any) => void;

    public constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

const allFiles = vscode.l10n.t("All Files");
const userDismissed = vscode.l10n.t("User dismissed the certificate wizard.");

export class CertificateWizard extends WebView {
    private opts: CertWizardOpts;
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public constructor(context: vscode.ExtensionContext, opts: CertWizardOpts) {
        super(vscode.l10n.t("Certificate Wizard"), "certificate-wizard", context, (message: object) => this.onDidReceiveMessage(message));
        this.opts = opts;
        this.panel.onDidDispose(() => {
            this.userSubmission.reject(userDismissed);
        });
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "promptCert":
                {
                    const tempCert = await Gui.showOpenDialog({
                        title: vscode.l10n.t("Enter the path to the certificate for authenticating the connection."),
                        defaultUri: this.opts.cert ? vscode.Uri.file(this.opts.cert) : undefined,
                        filters: {
                            [vscode.l10n.t("Certificate Files")]: ["cer", "crt", "pem"],
                            [allFiles]: ["*"],
                        },
                        openLabel: vscode.l10n.t("Select Certificate"),
                        ...(this.opts.dialogOpts ?? {}),
                    });
                    if (tempCert != null && tempCert[0] != null) {
                        this.opts.cert = tempCert[0].fsPath;
                        await this.panel.webview.postMessage({
                            opts: {
                                cert: tempCert[0].fsPath,
                            },
                        });
                    }
                }
                break;
            case "promptCertKey":
                {
                    const tempCertKey = await Gui.showOpenDialog({
                        title: vscode.l10n.t("Enter the path to the certificate key for authenticating the connection."),
                        defaultUri: this.opts.certKey ? vscode.Uri.file(this.opts.certKey) : undefined,
                        filters: {
                            [vscode.l10n.t("Certificate Keys")]: ["cer", "crt", "pem", "key"],
                            [allFiles]: ["*"],
                        },
                        openLabel: vscode.l10n.t("Select Certificate Key"),
                        ...(this.opts.dialogOpts ?? {}),
                    });
                    if (tempCertKey != null && tempCertKey[0] != null) {
                        this.opts.certKey = tempCertKey[0].fsPath;
                        await this.panel.webview.postMessage({
                            opts: {
                                certKey: tempCertKey[0].fsPath,
                            },
                        });
                    }
                }
                break;
            case "submitted":
                this.userSubmission.resolve({
                    cert: this.opts.cert,
                    certKey: this.opts.certKey,
                });
                return;
            case "ready":
                await this.panel.webview.postMessage({
                    opts: this.opts,
                });
                break;
            case "close":
                setImmediate(() => {
                    this.panel.dispose();
                });
                ZoweLogger.trace(userDismissed);
                break;
            default:
                break;
        }
    }
}
