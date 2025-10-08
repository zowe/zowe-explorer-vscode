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

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Config, ConfigBuilder, ConfigSchema } from "@zowe/imperative";
import { ZoweVsCodeExtension, FileManagement } from "@zowe/zowe-explorer-api";
import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
export class ConfigEditorFileOperations {
    constructor(private getLocalConfigs: () => Promise<any[]>) {}

    /**
     * Opens a config file with a specific profile highlighted
     */
    async openConfigFileWithProfile(message: any): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
            const editor = await vscode.window.showTextDocument(document);

            const profileKey = message.profileKey;
            const text = document.getText();
            const lines = text.split("\n");

            const profileParts = profileKey.split(".");
            let currentLine = -1;
            let currentColumn = 0;
            let foundProfile = false;
            let globalBraceCount = 0;
            let inProfilesSection = false;
            let profileDepth = 0;
            let inTargetProfile = false;
            let targetProfileBraceCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();

                for (const char of line) {
                    if (char === "{") {
                        globalBraceCount++;
                    }
                    if (char === "}") {
                        globalBraceCount--;
                    }
                }

                if (trimmedLine.includes('"profiles"')) {
                    if (!inTargetProfile) {
                        inProfilesSection = true;
                        profileDepth = 0;
                        inTargetProfile = false;
                        targetProfileBraceCount = 0;
                    } else {
                        profileDepth++;
                        inTargetProfile = false;
                        targetProfileBraceCount = 0;
                    }
                    continue;
                }

                if (inProfilesSection) {
                    if (inTargetProfile) {
                        for (const char of line) {
                            if (char === "{") {
                                targetProfileBraceCount++;
                            }
                            if (char === "}") {
                                targetProfileBraceCount--;
                            }
                        }

                        const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                        if (profileMatch) {
                            const foundProfileName = profileMatch[1];

                            if (profileParts[profileDepth] === foundProfileName) {
                                if (profileDepth === profileParts.length - 1) {
                                    // This is the final profile we're looking for
                                    foundProfile = true;
                                    currentLine = i;
                                    // Find the column position at the end of the profile name
                                    const profileNameIndex = line.indexOf(`"${foundProfileName}"`);
                                    currentColumn = profileNameIndex >= 0 ? profileNameIndex + foundProfileName.length + 2 : 0;
                                    break;
                                }
                            }
                        }
                        if (targetProfileBraceCount === 0) {
                            inTargetProfile = false;
                            profileDepth = 0;
                        }
                    } else {
                        const profileMatch = trimmedLine.match(/"([^"]+)":\s*\{/);
                        if (profileMatch) {
                            const foundProfileName = profileMatch[1];

                            if (profileParts[profileDepth] === foundProfileName) {
                                if (profileDepth === profileParts.length - 1) {
                                    foundProfile = true;
                                    currentLine = i;
                                    const profileNameIndex = line.indexOf(`"${foundProfileName}"`);
                                    currentColumn = profileNameIndex >= 0 ? profileNameIndex + foundProfileName.length + 2 : 0;
                                    break;
                                } else {
                                    inTargetProfile = true;
                                    targetProfileBraceCount = 1;
                                    continue;
                                }
                            }
                        }
                    }
                    if (globalBraceCount === 0) {
                        inProfilesSection = false;
                        profileDepth = 0;
                        inTargetProfile = false;
                        targetProfileBraceCount = 0;
                    }
                }
            }

            if (foundProfile && currentLine !== -1) {
                const position = new vscode.Position(currentLine, currentColumn);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            } else {
                vscode.window.showInformationMessage(`Profile "${profileKey as string}" not found in the config file.`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}`);
        }
    }

    /**
     * Creates a new configuration file
     */
    async createNewConfig(message: any): Promise<any[]> {
        try {
            const configType = message.configType;
            let global = false;
            let user = false;
            let rootPath = "";

            // Parse config type
            if (configType === "global-team") {
                global = true;
                user = false;
                rootPath = FileManagement.getZoweDir();
            } else if (configType === "global-user") {
                global = true;
                user = true;
                rootPath = FileManagement.getZoweDir();
            } else if (configType === "project-team") {
                global = false;
                user = false;
                rootPath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath || "";
            } else if (configType === "project-user") {
                global = false;
                user = true;
                rootPath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath || "";
            }

            if (!rootPath) {
                vscode.window.showErrorMessage("Cannot create project configuration: No workspace is open.");
                return;
            }

            if (global && !fs.existsSync(rootPath)) {
                try {
                    fs.mkdirSync(rootPath, { recursive: true });
                } catch (dirError) {
                    vscode.window.showErrorMessage(
                        `Cannot create directory ${rootPath}: ${dirError instanceof Error ? dirError.message : String(dirError)}`
                    );
                    return;
                }
            }

            const existingFile = await this.checkExistingConfig(rootPath, user);
            if (existingFile === false) {
                return;
            }
            if (existingFile != null) {
                user = existingFile.includes("user");
            }

            const config = await Config.load("zowe", {
                homeDir: FileManagement.getZoweDir(),
                projectDir: FileManagement.getFullPath(rootPath),
            });

            if (global) {
                config.api.layers.activate(user, global);
            } else if (ZoweVsCodeExtension.workspaceRoot != null) {
                config.api.layers.activate(user, global, rootPath);
            }

            const knownCliConfig: any[] = (ZoweVsCodeExtension as any).profilesCache.getCoreProfileTypes();
            knownCliConfig.push(...(ZoweVsCodeExtension as any).profilesCache.getConfigArray());
            knownCliConfig.push(ProfileConstants.BaseProfile);
            config.setSchema(ConfigSchema.buildSchema(knownCliConfig));

            const opts: any = {
                populateProperties: true,
            };

            const impConfig: any = {
                profiles: [...knownCliConfig],
                baseProfile: ProfileConstants.BaseProfile,
            };

            const newConfig: any = await ConfigBuilder.build(impConfig, global, opts);

            config.api.layers.merge(newConfig);
            await config.save(false);

            let configName;
            if (user) {
                configName = config.userConfigName;
            } else {
                configName = config.configName;
            }

            const configFilePath = path.join(rootPath, configName);

            // Ensure the file is fully written to disk
            await new Promise((resolve) => setTimeout(resolve, 100));

            if (fs.existsSync(configFilePath)) {
                await ZoweVsCodeExtension.openConfigFile(configFilePath);
                vscode.window.showInformationMessage(`Configuration file created and opened: ${configFilePath}`);
            } else {
                vscode.window.showErrorMessage(`Failed to create configuration file at: ${configFilePath}. Please check permissions and try again.`);
            }

            const configs = await this.getLocalConfigs();
            return configs;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error creating new configuration: ${errorMessage}`);
            return [];
        }
    }

    /**
     * Checks if a configuration file already exists in the specified location
     */
    private async checkExistingConfig(filePath: string, user: boolean): Promise<string | false | null> {
        const existingLayers = await ZoweVsCodeExtension.getConfigLayers();

        const configFiles = user ? ["zowe.config.user.json"] : ["zowe.config.json"];
        const foundLayer = existingLayers.find((layer) => {
            const layerDir = path.dirname(layer.path);
            const layerFile = path.basename(layer.path);
            return layerDir === filePath && configFiles.includes(layerFile);
        });

        if (foundLayer == null) {
            return null;
        }

        const createButton = "Create New";
        const message =
            `A Team Configuration File already exists in this location\n{0}\n` + `Continuing may alter the existing file, would you like to proceed?`;
        const response = await vscode.window.showInformationMessage(message, { modal: true }, createButton);
        if (response) {
            return path.basename(foundLayer.path);
        } else {
            await ZoweVsCodeExtension.openConfigFile(foundLayer.path);
        }
        return false;
    }
}
