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
import { ProfileCredentials, ProfileInfo } from "@zowe/imperative";
import { ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { LocalStorageAccess } from "../tools/ZoweLocalStorage";
import { Profiles } from "../configuration/Profiles";
import { Definitions } from "../configuration/Definitions";

export class ConfigEditorMessageHandlers {
    constructor(
        private getLocalConfigs: () => Promise<any[]>,
        private areSecureValuesAllowed: () => Promise<boolean>,
        private panel: { webview: { postMessage: (message: any) => Thenable<boolean> } }
    ) {}

    async handleGetProfiles(): Promise<void> {
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as any).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        try {
            await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        } catch (err) {}

        const configurations = await this.getLocalConfigs();
        const secureValuesAllowed = await this.areSecureValuesAllowed();
        await this.panel.webview.postMessage({
            command: "CONFIGURATIONS",
            contents: configurations,
            secureValuesAllowed,
        });
    }

    async handleOpenConfigFile(message: any): Promise<void> {
        try {
            vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
        } catch {
            vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}:`);
        }
    }

    async handleRevealInFinder(message: any): Promise<void> {
        try {
            const fileUri = vscode.Uri.file(message.filePath);
            await vscode.commands.executeCommand("revealFileInOS", fileUri);
        } catch (error) {
            vscode.window.showErrorMessage(`Error revealing file in explorer: ${message.filePath}`);
        }
    }

    async handleOpenSchemaFile(message: any): Promise<void> {
        try {
            vscode.window.showTextDocument(vscode.Uri.file(message.filePath));
        } catch {
            vscode.window.showErrorMessage(`Error opening schema file: ${message.filePath as string}:`);
        }
    }

    async handleGetEnvInformation(): Promise<void> {
        const hasWorkspace = ZoweVsCodeExtension.workspaceRoot != null;
        await this.panel.webview.postMessage({
            command: "ENV_INFORMATION",
            hasWorkspace: hasWorkspace,
        });
    }

    handleInitialSelection(message: any, setInitialSelection: (selection: any) => void): void {
        setInitialSelection({
            profileName: message.profileName,
            configPath: message.configPath,
            profileType: message.profileType,
        });
    }

    async handleConfigurationsReady(initialSelection: any, setInitialSelection: (selection: any) => void): Promise<void> {
        if (initialSelection) {
            await this.panel.webview.postMessage({
                command: "INITIAL_SELECTION",
                profileName: initialSelection.profileName,
                configPath: initialSelection.configPath,
                profileType: initialSelection.profileType,
            });
            setInitialSelection(undefined);
        }
    }

    async handleSelectFile(message: any): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: "Select File",
            filters: {
                "All Files": ["*"],
            },
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri.length > 0) {
            const filePath = fileUri[0].fsPath;
            await this.panel.webview.postMessage({
                command: "FILE_SELECTED",
                filePath: filePath,
                propertyIndex: message.propertyIndex,
                isNewProperty: message.isNewProperty,
                source: message.source,
            });
        }
    }

    async handleGetLocalStorageValue(message: any): Promise<void> {
        try {
            const { key } = message;
            // Map string keys to enum keys for LocalStorageAccess
            const enumKey = key as Definitions.LocalStorageKey;
            const value = LocalStorageAccess.getValue(enumKey);
            await this.panel.webview.postMessage({
                command: "LOCAL_STORAGE_VALUE",
                key,
                value,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: "LOCAL_STORAGE_ERROR",
                key: message.key,
                error: errorMessage,
            });
        }
    }

    async handleOpenVscodeSettings(message: any): Promise<void> {
        try {
            const searchText = message.searchText || "";
            await vscode.commands.executeCommand("workbench.action.openSettings", searchText);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error opening VS Code settings: ${errorMessage}`);
        }
    }

    async handleSetLocalStorageValue(message: any): Promise<void> {
        try {
            const { key, value } = message;
            // Map string keys to enum keys for LocalStorageAccess
            const enumKey = key as Definitions.LocalStorageKey;
            await LocalStorageAccess.setValue(enumKey, value);
            await this.panel.webview.postMessage({
                command: "LOCAL_STORAGE_SET_SUCCESS",
                key,
                value,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: "LOCAL_STORAGE_ERROR",
                key: message.key,
                error: errorMessage,
            });
        }
    }

    handleShowErrorMessage(message: any): void {
        vscode.window.showErrorMessage(message.message);
    }

    async handleGetEnvVars(message: any): Promise<void> {
        try {
            const query = message.query || "";
            const envVarNames: string[] = [];

            // Get keys only for security
            for (const key of Object.keys(process.env)) {
                if (key.toLowerCase().includes(query.toLowerCase())) {
                    envVarNames.push(key);
                }
            }

            envVarNames.sort((a, b) => a.localeCompare(b));

            await this.panel.webview.postMessage({
                command: "ENV_VARS_RESPONSE",
                envVars: envVarNames.slice(0, 100),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: "ENV_VARS_ERROR",
                error: errorMessage,
            });
        }
    }
}
