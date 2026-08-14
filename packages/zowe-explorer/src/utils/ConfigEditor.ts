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
import type { ProfileInfo } from "@zowe/imperative";
import * as path from "path";
import * as fs from "fs";
import { ConfigSchemaHelpers, schemaValidation } from "./ConfigSchemaHelpers";
import { ConfigChangeHandlers } from "./ConfigChangeHandlers";
import { ConfigUtils } from "./ConfigUtils";
import { ConfigEditorMessageHandlers } from "./ConfigEditorMessageHandlers";
import { ConfigEditorProfileOperations } from "./ConfigEditorProfileOperations";
import { ConfigEditorFileOperations } from "./ConfigEditorFileOperations";
import { ConfigEditorMergedProperties } from "./ConfigEditorMergedProperties";
import type { ConfigParseError } from "../webviews/src/config-editor/types";
import type {
    ConfigLayerDescriptor,
    InitialSelectionPayload,
    LayerChangesPayload,
    LayerModifications,
    LocalConfigsResult,
    ProfileRenameEntry,
    WebviewCommandMessage,
    SaveChangesMessage,
    CreateNewConfigMessage,
    EnvVarsQueryMessage,
    LocalStorageKeyMessage,
    LocalStorageSetMessage,
    OpenFilePathMessage,
    OpenVscodeSettingsMessage,
    SelectFileMessage,
    ValidateProfileNameMessage,
} from "./ConfigTypes";

export class ConfigEditor extends WebView {
    public userSubmission: DeferredPromise<{
        cert: string;
        certKey: string;
    }> = new DeferredPromise();

    public initialSelection?: InitialSelectionPayload;

    private messageHandlers: ConfigEditorMessageHandlers;
    private profileOperations: ConfigEditorProfileOperations;
    private mergedProperties: ConfigEditorMergedProperties;
    private fileOperations: ConfigEditorFileOperations;
    private lastParseErrorPaths: Set<string> = new Set();

    public constructor(context: vscode.ExtensionContext, initialSelection?: InitialSelectionPayload) {
        super(vscode.l10n.t("Config Editor"), "config-editor", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message as WebviewCommandMessage),
            retainContext: true,
            viewColumn: vscode.ViewColumn.One,
        });

        this.profileOperations = new ConfigEditorProfileOperations();
        this.mergedProperties = new ConfigEditorMergedProperties(this.profileOperations);
        this.messageHandlers = new ConfigEditorMessageHandlers(
            () => this.getLocalConfigs(),
            () => this.areSecureValuesAllowed(),
            this.panel,
            this.profileOperations
        );
        this.fileOperations = new ConfigEditorFileOperations(() => this.getLocalConfigs());

        // Set initialSelection before initializeWebview() fires so that when the webview
        // responds with CONFIGURATIONS_READY, handleConfigurationsReady already has the
        // selection and sends INITIAL_SELECTION in the same round-trip.
        if (initialSelection) {
            this.initialSelection = initialSelection;
        }
        this.panel.reveal(vscode.ViewColumn.One, false);

        vscode.commands.executeCommand("workbench.action.keepEditor");

        const saveListener = vscode.workspace.onDidSaveTextDocument((doc) => {
            void this.onDidSaveDocumentForParseErrors(doc);
        });
        this.panel.onDidDispose(() => {
            saveListener.dispose();
        });

        void this.initializeWebview();
    }

    private async initializeWebview(): Promise<void> {
        const { configs, parseErrors } = await this.getLocalConfigs();
        const secureValuesAllowed = await this.areSecureValuesAllowed();
        const tutorialSeen = this.messageHandlers.getTutorialSeen();

        await this.panel.webview.postMessage({
            command: "CONFIGURATIONS",
            contents: configs,
            parseErrors,
            secureValuesAllowed,
            tutorialSeen,
        });
    }

    private async onDidSaveDocumentForParseErrors(doc: vscode.TextDocument): Promise<void> {
        if (!this.panel.visible) {
            return;
        }
        const savedPath = path.resolve(doc.uri.fsPath);
        if (this.lastParseErrorPaths.has(savedPath)) {
            await this.refreshConfigurationsAndNotifyWebview();
        }
    }

    public async areSecureValuesAllowed(): Promise<boolean> {
        const profilesCache = (ZoweVsCodeExtension as typeof ZoweVsCodeExtension & { profilesCache?: { getProfileInfo: () => Promise<unknown> } })
            .profilesCache;
        if (!profilesCache) {
            return false;
        }
        try {
            return ((await profilesCache.getProfileInfo()) as ProfileInfo).isSecured();
        } catch (_err) {
            return false;
        }
    }

    public async getLocalConfigs(): Promise<LocalConfigsResult> {
        const parseErrors: ConfigParseError[] = [];
        let profInfo: ProfileInfo;
        try {
            profInfo = await ConfigUtils.createProfileInfoAndLoad();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const fileMatch = errorMessage.match(/file '([^']+)'/);
            if (fileMatch && fileMatch[1]) {
                ConfigUtils.pushParseError(parseErrors, path.resolve(fileMatch[1]), errorMessage);
            } else {
                vscode.window.showErrorMessage(`Error reading profiles from disk: ${errorMessage}`);
            }
            await ConfigUtils.appendJsonParseErrorsForKnownConfigFiles(parseErrors);
            this.lastParseErrorPaths = new Set(parseErrors.map((e) => (e.configPath ? path.resolve(e.configPath) : "")).filter(Boolean));
            return { configs: [], parseErrors };
        }
        const layers = profInfo.getTeamConfig().layers;

        const allConfigs: ConfigLayerDescriptor[] = [];

        for (const layer of layers) {
            if (layer.exists) {
                const configPath = path.resolve(layer.path);
                try {
                    if (layer.properties && layer.properties.$schema) {
                        const schemaPath = path.join(path.dirname(configPath), layer.properties.$schema);
                        const schemaContent = fs.readFileSync(schemaPath, { encoding: "utf8" });
                        const schema = JSON.parse(schemaContent);
                        const schemaValidation = ConfigSchemaHelpers.generateSchemaValidation(schema);

                        ConfigUtils.processProfilesRecursively(layer.properties.profiles, schemaValidation);

                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema,
                            schemaValidation,
                            schemaPath,
                            global: layer.global,
                            user: layer.user,
                        });
                    } else {
                        // Try to find schema in the same directory even if not explicitly referenced
                        let schemaValidation: schemaValidation | undefined;
                        try {
                            const possibleSchemaPath = path.join(path.dirname(configPath), "zowe.schema.json");
                            if (fs.existsSync(possibleSchemaPath)) {
                                const schemaContent = fs.readFileSync(possibleSchemaPath, { encoding: "utf8" });
                                const schema = JSON.parse(schemaContent);
                                schemaValidation = ConfigSchemaHelpers.generateSchemaValidation(schema);
                            }
                        } catch (err) {
                            // Schema not found or invalid, continue without filtering
                        }

                        // Process profiles with schema validation if available
                        ConfigUtils.processProfilesRecursively(layer.properties.profiles, schemaValidation);

                        allConfigs.push({
                            configPath,
                            properties: layer.properties,
                            schema: undefined,
                            global: layer.global,
                            user: layer.user,
                        });
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    ConfigUtils.pushParseError(parseErrors, configPath, `Error reading or parsing file ${configPath}: ${errorMessage}`);
                }
            }
        }

        this.lastParseErrorPaths = new Set(parseErrors.map((e) => (e.configPath ? path.resolve(e.configPath) : "")).filter(Boolean));
        return { configs: allConfigs, parseErrors };
    }

    private async refreshConfigurationsAndNotifyWebview(options?: { saveError?: string }): Promise<void> {
        const { configs, parseErrors } = await this.getLocalConfigs();
        const secureValuesAllowed = await this.areSecureValuesAllowed();
        await this.panel.webview.postMessage({
            command: "CONFIGURATIONS",
            contents: configs,
            parseErrors,
            secureValuesAllowed,
        });
        if (options?.saveError) {
            await this.panel.webview.postMessage({
                command: "SAVE_ERROR",
                error: options.saveError,
            });
        }
        await this.panel.webview.postMessage({
            command: "DISABLE_OVERLAY",
        });
    }

    protected async onDidReceiveMessage(message: WebviewCommandMessage): Promise<void> {
        switch (message.command.toLocaleUpperCase()) {
            case "GET_PROFILES": {
                await this.messageHandlers.handleGetProfiles();
                break;
            }
            case "SAVE_CHANGES": {
                try {
                    const saveMsg = message as SaveChangesMessage;
                    if (saveMsg.renames && Array.isArray(saveMsg.renames)) {
                        await this.profileOperations.handleProfileRenames(saveMsg.renames);
                    }

                    let updatedMessage: LayerChangesPayload = saveMsg;
                    if (saveMsg.renames && Array.isArray(saveMsg.renames)) {
                        updatedMessage = await this.profileOperations.updateProfileChangesForRenames(saveMsg, saveMsg.renames);
                    }

                    const normalizedSave: LayerModifications = {
                        configPath: updatedMessage.configPath,
                        changes: updatedMessage.changes ?? [],
                        deletions: updatedMessage.deletions ?? [],
                        defaultsChanges: updatedMessage.defaultsChanges ?? [],
                        defaultsDeleteKeys: updatedMessage.defaultsDeleteKeys ?? [],
                    };
                    const parsedChanges = ConfigUtils.parseConfigChanges(normalizedSave);
                    for (const change of parsedChanges) {
                        if (change.defaultsChanges || change.defaultsDeleteKeys) {
                            await ConfigChangeHandlers.handleDefaultChanges(change.defaultsChanges, change.defaultsDeleteKeys, change.configPath);
                        }

                        if (change.changes || change.deletions) {
                            await ConfigChangeHandlers.handleProfileChanges(change.changes, change.deletions, change.configPath, () =>
                                this.areSecureValuesAllowed()
                            );
                        }
                    }

                    if (saveMsg.otherChanges) {
                        await ConfigChangeHandlers.handleAutostoreToggle(saveMsg.otherChanges);
                    }

                    await this.refreshConfigurationsAndNotifyWebview();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Save operation failed:", errorMessage);
                    await this.refreshConfigurationsAndNotifyWebview({ saveError: errorMessage });
                }
                break;
            }
            case "OPEN_CONFIG_FILE": {
                await this.messageHandlers.handleOpenConfigFile(message as unknown as OpenFilePathMessage);
                break;
            }
            case "REVEAL_IN_FINDER": {
                await this.messageHandlers.handleRevealInFinder(message as unknown as OpenFilePathMessage);
                break;
            }
            case "OPEN_SCHEMA_FILE": {
                await this.messageHandlers.handleOpenSchemaFile(message as unknown as OpenFilePathMessage);
                break;
            }
            case "GET_ENV_INFORMATION": {
                await this.messageHandlers.handleGetEnvInformation();
                break;
            }
            case "GET_ENV_VARS": {
                await this.messageHandlers.handleGetEnvVars(message as EnvVarsQueryMessage);
                break;
            }
            case "VALIDATE_PROFILE_NAME": {
                await this.messageHandlers.handleValidateProfileName(message as unknown as ValidateProfileNameMessage);
                break;
            }
            case "INITIAL_SELECTION": {
                this.messageHandlers.handleInitialSelection(message as unknown as InitialSelectionPayload, (selection) => {
                    this.initialSelection = selection;
                });
                break;
            }
            case "CONFIGURATIONS_READY": {
                await this.messageHandlers.handleConfigurationsReady(this.initialSelection, (selection) => {
                    this.initialSelection = selection;
                });
                break;
            }
            case "OPEN_CONFIG_FILE_WITH_PROFILE": {
                const openMsg = message as unknown as { filePath: string; profileKey: string };
                await ZoweVsCodeExtension.openConfigFileWithProfile(openMsg.filePath, openMsg.profileKey);
                break;
            }

            case "GET_MERGED_PROPERTIES": {
                try {
                    const mergedArgs = await this.mergedProperties.getPendingMergedArgsForProfile(
                        message.profilePath as string,
                        message.configPath as string,
                        message.changes as LayerModifications,
                        message.renames as ProfileRenameEntry[] | undefined
                    );
                    await this.panel.webview.postMessage({
                        command: "MERGED_PROPERTIES",
                        mergedArgs,
                        mergedPropertiesRequestSeq: message.mergedPropertiesRequestSeq,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Failed to get merged properties:", errorMessage);
                    vscode.window.showErrorMessage(`Cannot show merged properties: ${errorMessage}`);
                    await this.panel.webview.postMessage({
                        command: "MERGED_PROPERTIES",
                        error: errorMessage,
                        mergedPropertiesRequestSeq: message.mergedPropertiesRequestSeq,
                    });
                }
                break;
            }
            case "GET_WIZARD_MERGED_PROPERTIES": {
                try {
                    const mergedArgs = await this.mergedProperties.getWizardMergedProperties(
                        message.rootProfile as string,
                        message.profileType as string,
                        message.configPath as string,
                        message.profileName as string | undefined,
                        message.changes as LayerModifications | undefined,
                        message.renames as ProfileRenameEntry[] | undefined
                    );
                    await this.panel.webview.postMessage({
                        command: "WIZARD_MERGED_PROPERTIES",
                        mergedArgs,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Failed to get wizard merged properties:", errorMessage);
                    vscode.window.showErrorMessage(`Cannot show merged properties: ${errorMessage}`);
                }
                break;
            }

            case "SELECT_FILE": {
                await this.messageHandlers.handleSelectFile(message as SelectFileMessage);
                break;
            }
            case "CREATE_NEW_CONFIG": {
                const result = await this.fileOperations.createNewConfig(message as unknown as CreateNewConfigMessage);
                if (result && result.configs.length > 0) {
                    const secureValuesAllowed = await this.areSecureValuesAllowed();
                    const tutorialSeen = this.messageHandlers.getTutorialSeen();
                    await this.panel.webview.postMessage({
                        command: "CONFIGURATIONS",
                        contents: result.configs,
                        parseErrors: result.parseErrors,
                        secureValuesAllowed,
                        tutorialSeen,
                    });
                }
                break;
            }
            case "GET_LOCAL_STORAGE_VALUE": {
                await this.messageHandlers.handleGetLocalStorageValue(message as unknown as LocalStorageKeyMessage);
                break;
            }
            case "OPEN_VSCODE_SETTINGS": {
                await this.messageHandlers.handleOpenVscodeSettings(message as OpenVscodeSettingsMessage);
                break;
            }
            case "SET_LOCAL_STORAGE_VALUE": {
                await this.messageHandlers.handleSetLocalStorageValue(message as unknown as LocalStorageSetMessage);
                break;
            }
            case "SHOW_ERROR_MESSAGE": {
                vscode.window.showErrorMessage(String((message as { message?: unknown }).message ?? ""));
                break;
            }

            default:
                break;
        }
    }
}
