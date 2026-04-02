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
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { LocalStorageAccess } from "../tools/ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import { ConfigUtils } from "./ConfigUtils";
import type {
    EnvVarsQueryMessage,
    InitialSelectionPayload,
    LocalConfigsResult,
    LocalStorageKeyMessage,
    LocalStorageSetMessage,
    OpenFilePathMessage,
    OpenVscodeSettingsMessage,
    SelectFileMessage,
    ValidateProfileNameMessage,
    WebviewPostMessageTarget,
} from "./ConfigTypes";

export class ConfigEditorMessageHandlers {
    constructor(
        private getLocalConfigs: () => Promise<LocalConfigsResult>,
        private areSecureValuesAllowed: () => Promise<boolean>,
        private panel: { webview: WebviewPostMessageTarget },
        private profileOperations: ConfigEditorProfileOperations
    ) {}

    async handleGetProfiles(): Promise<void> {
        try {
            await ConfigUtils.createProfileInfoAndLoad();
        } catch (err) {}

        const { configs, parseErrors } = await this.getLocalConfigs();
        const secureValuesAllowed = await this.areSecureValuesAllowed();
        await this.panel.webview.postMessage({
            command: "CONFIGURATIONS",
            contents: configs,
            parseErrors,
            secureValuesAllowed,
        });
    }

    async handleOpenConfigFile(message: OpenFilePathMessage): Promise<void> {
        try {
            const uri = vscode.Uri.file(message.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            if (message.line !== undefined && message.column !== undefined) {
                const position = new vscode.Position(message.line, message.column);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
        } catch {
            vscode.window.showErrorMessage(`Error opening file: ${message.filePath as string}:`);
        }
    }

    async handleRevealInFinder(message: OpenFilePathMessage): Promise<void> {
        try {
            const fileUri = vscode.Uri.file(message.filePath);
            await vscode.commands.executeCommand("revealFileInOS", fileUri);
        } catch (error) {
            vscode.window.showErrorMessage(`Error revealing file in explorer: ${message.filePath}`);
        }
    }

    async handleOpenSchemaFile(message: OpenFilePathMessage): Promise<void> {
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

    handleInitialSelection(message: InitialSelectionPayload, setInitialSelection: (selection: InitialSelectionPayload | undefined) => void): void {
        setInitialSelection({
            profileName: message.profileName,
            configPath: message.configPath,
            profileType: message.profileType,
        });
    }

    async handleConfigurationsReady(
        initialSelection: InitialSelectionPayload | undefined,
        setInitialSelection: (selection: InitialSelectionPayload | undefined) => void
    ): Promise<void> {
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

    async handleSelectFile(message: SelectFileMessage): Promise<void> {
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
                fullKey: message.fullKey,
                configPath: message.configPath,
            });
        }
    }

    async handleGetLocalStorageValue(message: LocalStorageKeyMessage): Promise<void> {
        try {
            const { key } = message;
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

    async handleOpenVscodeSettings(message: OpenVscodeSettingsMessage): Promise<void> {
        try {
            const searchText = message.searchText || "";
            await vscode.commands.executeCommand("workbench.action.openSettings", searchText);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error opening VS Code settings: ${errorMessage}`);
        }
    }

    async handleSetLocalStorageValue(message: LocalStorageSetMessage): Promise<void> {
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

    async handleGetEnvVars(message: EnvVarsQueryMessage): Promise<void> {
        try {
            const query = message.query || "";
            const envVarNames: string[] = [];

            for (const key of Object.keys(process.env)) {
                if (key.toLowerCase().includes(query.toLowerCase())) {
                    envVarNames.push(key);
                }
            }

            envVarNames.sort((a, b) => a.localeCompare(b));

            await this.panel.webview.postMessage({
                command: "ENV_VARS_RESPONSE",
                envVars: envVarNames,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: "ENV_VARS_ERROR",
                error: errorMessage,
            });
        }
    }

    async handleValidateProfileName(message: ValidateProfileNameMessage): Promise<void> {
        try {
            const { profileName, rootProfile, configPath, profiles, pendingChanges, renames } = message;

            const validationResult = this.profileOperations.validateProfileName({
                profileName,
                rootProfile,
                configPath,
                profiles,
                pendingChanges,
                renames,
            });

            await this.panel.webview.postMessage({
                command: "PROFILE_NAME_VALIDATION_RESULT",
                isValid: validationResult.isValid,
                message: validationResult.message,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: "PROFILE_NAME_VALIDATION_RESULT",
                isValid: false,
                message: errorMessage,
            });
        }
    }
}
