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

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
        });
        this.panel.onDidDispose(() => {});
    }

    protected async getLocalConfigs() {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const layers = profInfo.getTeamConfig().layers;
        console.log(layers);

        const allConfigs: { configPath: string; properties: any; schema?: any; global: boolean; user: boolean }[] = [];

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
                            global: layer.global,
                            user: layer.user,
                        });
                    } else {
                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema: undefined,
                            global: layer.global,
                            user: layer.user,
                        });
                    }
                } catch {
                    vscode.window.showErrorMessage(`Error reading or parsing file ${configPath}:`);
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
            case "SAVE_CHANGES":
                this.dummyLog(message);
                if (message.defaultsChanges || message.defaultsDeleteKeys)
                    this.handleDefaultChanges(message.defaultsChanges, message.defaultsDeleteKeys, message.configPath);
                if (message.changes || message.deletions) this.handleProfileChanges(message.changes, message.deletions);

                //Send the next profiles to webview after saving changes
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });
                break;
            case "OPEN_CONFIG_FILE":
                try {
                    vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
                } catch {
                    vscode.window.showErrorMessage(`Error opening file: ${message.filePath}:`);
                }
                break;
            case "GET_LOCALIZATION":
            default:
                break;
        }
    }

    private dummyLog(message: any): void {
        console.log("Received save changes command with the following data:");
        console.log("mod:", message);
    }
    private async handleDefaultChanges(changes: any, deletions: any, activeProfile: string): Promise<void> {
        console.log("Default Changes:", changes);
        console.log("Default Deletions:", deletions);

        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk();
        const teamConfig = profInfo.getTeamConfig();

        if (activeProfile !== teamConfig.api.layers.get().path) {
            // teamConfig.api.layers.activate(teamConfig.layers.find((prof) => prof.path === activeProfile));
        }
        for (const change of changes) {
            teamConfig.api.profiles.defaultSet(change.key, change.value);
        }

        console.log("test");
    }

    private async handleProfileChanges(changes: any, deletions: any): Promise<void> {
        console.log("Profile Changes:", changes);
        console.log("Profile Deletions:", deletions);
    }
}
