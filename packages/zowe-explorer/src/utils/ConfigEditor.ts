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

type ChangeEntry = {
    key: string;
    value: string;
    path: string[];
    profile?: string;
    configPath: string;
    secure: boolean;
};

type LayerModifications = {
    configPath: string;
    changes: ChangeEntry[];
    deletions: ChangeEntry[];
    defaultsChanges: ChangeEntry[];
    defaultsDeleteKeys: ChangeEntry[];
};

export type schemaValidation = {
    propertySchema: Record<string, Record<string, { type?: string; description?: string }>>;
    validDefaults: string[];
};

type ArrayField = "changes" | "deletions" | "defaultsChanges" | "defaultsDeleteKeys";

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public constructor(context: vscode.ExtensionContext) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
            viewColumn: vscode.ViewColumn.Active,
        });
        this.panel.onDidDispose(() => {});
    }

    protected async getLocalConfigs(): Promise<any[]> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        const layers = profInfo.getTeamConfig().layers;

        const allConfigs: {
            configPath: string;
            properties: any;
            schema?: any;
            schemaValidation?: schemaValidation;
            global: boolean;
            user: boolean;
        }[] = [];

        for (const layer of layers) {
            if (layer.exists) {
                const configPath = path.resolve(layer.path);
                try {
                    if (layer.properties && layer.properties.$schema) {
                        const schemaPath = path.join(path.dirname(configPath), layer.properties.$schema);
                        const schemaContent = fs.readFileSync(schemaPath, { encoding: "utf8" });
                        const schema = JSON.parse(schemaContent);
                        const schemaValidation = this.generateSchemaValidation(schema);

                        // Process profiles recursively to handle nested profiles
                        this.processProfilesRecursively(layer.properties.profiles);

                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema,
                            schemaValidation,
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
                } catch (err) {
                    vscode.window.showErrorMessage(`Error reading or parsing file ${configPath}:`);
                }
            }
        }

        return allConfigs;
    }

    private processProfilesRecursively(profiles: any): void {
        if (!profiles || typeof profiles !== "object") {
            return;
        }

        for (const profileName in profiles) {
            const profile = profiles[profileName];

            // Handle secure properties for current profile
            if (profile.secure && profile.properties) {
                const secureKeys = profile.secure;
                profile.properties = Object.fromEntries(Object.entries(profile.properties).filter(([key]) => !secureKeys.includes(key)));
            }

            // Recursively process nested profiles
            if (profile.profiles) {
                this.processProfilesRecursively(profile.profiles);
            }
        }
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        switch (message.command.toLocaleUpperCase()) {
            case "GET_PROFILES": {
                const configurations = await this.getLocalConfigs();
                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: configurations,
                });
                break;
            }
            case "SAVE_CHANGES": {
                const parsedChanges = this.parseConfigChanges(message);
                for (const change of parsedChanges) {
                    if (change.defaultsChanges || change.defaultsDeleteKeys) {
                        await this.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath);
                    }

                    if (change.changes || change.deletions) {
                        await this.handleProfileChanges(change.changes, change.deletions, change.configPath);
                    }
                }
                await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

                await this.panel.webview.postMessage({
                    command: "CONFIGURATIONS",
                    contents: await this.getLocalConfigs(),
                });

                await this.panel.webview.postMessage({
                    command: "DISABLE_OVERLAY",
                });
                break;
            }
            case "OPEN_CONFIG_FILE": {
                try {
                    vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
                } catch {
                    vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}:`);
                }
                break;
            }
            case "GET_LOCALIZATION":
            default:
                break;
        }
    }

    private async handleDefaultChanges(changes: ChangeEntry[], deletions: ChangeEntry[], activeLayer: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        if (activeLayer !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === activeLayer);
            profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            profInfo.getTeamConfig().api.profiles.defaultSet(change.key, change.value);
        }

        for (const deletion of deletions) {
            profInfo.getTeamConfig().delete(`defaults.${deletion.key}`);
        }

        await profInfo.getTeamConfig().save();
    }

    private async handleProfileChanges(changes: ChangeEntry[], deletions: ChangeEntry[], configPath: string): Promise<void> {
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });

        if (configPath !== profInfo.getTeamConfig().api.layers.get().path) {
            const findProfile = profInfo.getTeamConfig().layers.find((prof) => prof.path === configPath);
            profInfo.getTeamConfig().api.layers.activate(findProfile.user, findProfile.global);
        }

        for (const change of changes) {
            try {
                profInfo.getTeamConfig().set(change.key, change.value, { parseString: true, secure: change.secure });
            } catch (err) {
                // console.log(err);
            }
        }

        for (const deletion of deletions) {
            try {
                profInfo.getTeamConfig().delete(deletion.key);
            } catch (err) {
                // console.log(err);
            }
        }

        await profInfo.getTeamConfig().save();
    }

    private parseConfigChanges(data: LayerModifications): LayerModifications[] {
        const groups: Record<string, LayerModifications> = {};

        const addToGroup = (items: ChangeEntry[], field: ArrayField): any => {
            for (const item of items) {
                const configPath = item.configPath;
                if (!groups[configPath]) {
                    groups[configPath] = {
                        configPath,
                        changes: [],
                        deletions: [],
                        defaultsChanges: [],
                        defaultsDeleteKeys: [],
                    };
                }
                groups[configPath][field].push(item);
            }
        };

        addToGroup(data.changes || [], "changes");
        addToGroup(data.deletions || [], "deletions");
        addToGroup(data.defaultsChanges || [], "defaultsChanges");
        addToGroup(data.defaultsDeleteKeys || [], "defaultsDeleteKeys");

        return Object.values(groups);
    }

    private generateSchemaValidation(schema: any): schemaValidation {
        const propertySchema: Record<string, Record<string, { type?: string; description?: string }>> = {};
        const allOf = schema.properties.profiles.patternProperties["^\\S*$"].allOf;

        for (const rule of allOf) {
            const profileType = rule?.if?.properties?.type?.const;
            const properties = rule?.then?.properties?.properties?.properties;

            if (profileType && properties) {
                propertySchema[profileType] = Object.keys(properties).reduce((acc, key) => {
                    acc[key] = {
                        type: properties[key].type,
                        description: properties[key].description,
                    };
                    return acc;
                }, {} as Record<string, { type?: string; description?: string }>);
            }
        }

        return {
            validDefaults: Object.keys(schema.properties.defaults.properties) ?? undefined,
            propertySchema,
        };
    }
}
