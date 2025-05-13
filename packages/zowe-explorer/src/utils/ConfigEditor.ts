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

import { DeferredPromise, WebView, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { ProfileInfo } from "@zowe/imperative";
import * as path from "path";
import * as fs from "fs";

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

        const allConfigs: { configPath: string; properties: any; schema?: any }[] = [];

        for (const layer of layers) {
            if (layer.exists) {
                const configPath = path.resolve(layer.path);
                try {
                    if (layer.properties && layer.properties.$schema) {
                        const schemaPath = path.join(path.dirname(configPath), layer.properties.$schema);
                        const schemaContent = fs.readFileSync(schemaPath, { encoding: "utf8" });
                        const schema = JSON.parse(schemaContent);
                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema,
                        });
                    } else {
                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema: undefined,
                        });
                    }
                } catch (err) {
                    console.error(`Error reading or parsing file ${configPath}:`, err);
                    allConfigs.push({
                        configPath,
                        properties: layer.properties,
                        schema: undefined,
                    });
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
            case "SAVE_CHANGES":
                this.handleSaveChanges(message);
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });
                break;
            default:
                break;
        }
    }

    private handleSaveChanges(message: any): void {
        console.log("Received save changes command with the following data:");
        console.log("mod:", message);
    }
}
