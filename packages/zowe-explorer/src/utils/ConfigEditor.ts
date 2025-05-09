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

import { DeferredPromise, Gui, WebView, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { ProfileInfo } from "@zowe/imperative";
import * as path from "path";

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

    protected async getLocalConfigs() {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const layers = profInfo.getTeamConfig().layers;
        console.log(layers);

        const allConfigs: { configPath: string; properties: any }[] = [];

        for (const layer of layers) {
            if (layer.exists) {
                const configPath = path.resolve(layer.path);
                try {
                    if (layer.properties) {
                        allConfigs.push({ configPath, properties: layer.properties });
                    }
                } catch (err) {
                    console.error(`Error reading or parsing file ${configPath}:`, err);
                }
            }
        }

        return allConfigs;
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command.toLocaleUpperCase()) {
            case "GETPROFILES":
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });
                break;
            case "TEST":
                await this.panel.webview.postMessage({
                    command: "TEST",
                    contents: "test-contents",
                });
                break;
            default:
                break;
        }
    }
}
