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
            retainContext: true,
        });
        this.panel.onDidDispose(() => {});
    }

    protected async getLocalConfigs(): Promise<any[]> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const layers = profInfo.getTeamConfig().layers;

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
        //Send the next profiles to webview after saving changes
        const profInfo = new ProfileInfo("zowe");
        switch (message.command.toLocaleUpperCase()) {
            case "GETPROFILES":
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });
                break;
            case "SAVE_CHANGES":
                if (message.defaultsChanges || message.defaultsDeleteKeys) {
                    await this.handleDefaultChanges(message.defaultsChanges, message.defaultsDeleteKeys, message.configPath);
                }

                if (message.changes || message.deletions) {
                    await this.handleProfileChanges(message.changes, message.deletions, message.configPath);
                }
                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

                console.debug("Updated config being sent:", JSON.stringify(await this.getLocalConfigs(), null, 2));

                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });

                await this.panel.webview.postMessage({
                    command: "DISABLE_OVERLAY",
                });
                break;
            case "OPEN_CONFIG_FILE":
                try {
                    vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
                } catch {
                    vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}:`);
                }
                break;
            case "GET_LOCALIZATION":
            default:
                break;
        }
    }

    private async handleDefaultChanges(changes: any, deletions: any, activeLayer: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        // Activate proper layer
        if (activeLayer !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === activeLayer);
            profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
        }

        // Apply changes to default settings at active layer
        for (const change of changes) {
            profInfo.getTeamConfig().api.profiles.defaultSet(change.key, change.value);
        }

        // Apply deletions to default settings at active layer
        for (const deletion in deletions) {
            profInfo.getTeamConfig().delete(`defaults.${deletions[deletion] as string}`);
        }

        await profInfo.getTeamConfig().save();
    }

    private async handleProfileChanges(changes: any, deletions: any, configPath: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        // Activate proper layer
        if (configPath !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === configPath);
            profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            if (typeof change.value === "object" || typeof change.value === "string") {
                try {
                    // profInfo.getTeamConfig().api.profiles.set(change.key, change.value);
                    // profInfo.getTeamConfig().
                } catch (err) {
                    // console.log(err);
                }
            }
        }
        for (const deletion of deletions) {
            try {
                profInfo.getTeamConfig().delete(`profiles.${deletion as string}`);
                // profInfo.getTeamConfig().api.layers.
                // profInfo.getTeamConfig().api.profiles.set(change.key, change.value);
                // profInfo.getTeamConfig().
            } catch (err) {
                console.log(err);
            }
        }

        await profInfo.getTeamConfig().save();
    }
}
