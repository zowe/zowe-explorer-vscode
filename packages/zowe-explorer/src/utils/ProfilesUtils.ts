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
import {
    IZoweTreeNode,
    ZoweTreeNode,
    FileManagement,
    Gui,
    ProfilesCache,
    imperative,
    ZoweVsCodeExtension,
    AuthHandler,
} from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { ZoweLogger } from "../tools/ZoweLogger";
import { AuthUtils } from "./AuthUtils";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";

export enum ProfilesConvertStatus {
    ConvertSelected,
    CreateNewSelected,
}

export class ProfilesUtils {
    public static PROFILE_SECURITY: string | boolean = Constants.ZOWE_CLI_SCM;
    private static noConfigDialogShown = false;
    private static mProfileInfo: imperative.ProfileInfo;

    /**
     * Check if the credential manager's vsix is installed for use
     * @param credentialManager the display name of the credential manager
     * @returns boolean whether the VS Code extension for the custom credential manager is installed
     */
    public static isVSCodeCredentialPluginInstalled(credentialManager: string): boolean {
        ZoweLogger.trace("ProfilesUtils.isVSCodeCredentialPluginInstalled called.");
        try {
            const plugin = imperative.CredentialManagerOverride.getCredMgrInfoByDisplayName(credentialManager);
            return vscode.extensions.getExtension(plugin?.credMgrZEName) !== undefined;
        } catch (err) {
            return false;
        }
    }

    /**
     * Get the current credential manager specified in imperative.json
     * @returns string the credential manager override
     */
    public static getCredentialManagerOverride(): string {
        ZoweLogger.trace("ProfilesUtils.getCredentialManagerOverride called.");
        try {
            const settingsFilePath = path.join(FileManagement.getZoweDir(), "settings", "imperative.json");
            const settingsFile = fs.readFileSync(settingsFilePath);
            const imperativeConfig = JSON.parse(settingsFile.toString());
            const credentialManagerOverride = imperativeConfig?.overrides[imperative.CredentialManagerOverride.CRED_MGR_SETTING_NAME];
            if (typeof credentialManagerOverride === "string") {
                return credentialManagerOverride;
            }
            return imperative.CredentialManagerOverride.DEFAULT_CRED_MGR_NAME;
        } catch (err) {
            ZoweLogger.info("imperative.json does not exist, returning the default override of @zowe/cli");
            return imperative.CredentialManagerOverride.DEFAULT_CRED_MGR_NAME;
        }
    }

    /**
     * Get the map of names associated with the custom credential manager
     * @param string credentialManager the credential manager display name
     * @returns imperative.ICredentialManagerNameMap the map with all names related to the credential manager
     */
    public static getCredentialManagerMap(credentialManager: string): imperative.ICredentialManagerNameMap | undefined {
        ZoweLogger.trace("ProfilesUtils.getCredentialManagerNameMap called.");
        return imperative.CredentialManagerOverride.getCredMgrInfoByDisplayName(credentialManager);
    }

    /**
     * Update the current credential manager override
     * @param setting the credential manager to use in imperative.json
     */
    public static updateCredentialManagerSetting(credentialManager?: string | false): void {
        ZoweLogger.trace("ProfilesUtils.updateCredentialManagerSetting called.");
        const currentProfileSecurity = ProfilesUtils.PROFILE_SECURITY;
        const settingEnabled: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED, true);
        const defaultCredentialManagerFound = ProfilesUtils.checkDefaultCredentialManager();
        if (settingEnabled && credentialManager) {
            ProfilesUtils.PROFILE_SECURITY = credentialManager;
            return;
        } else if (!settingEnabled || !defaultCredentialManagerFound) {
            ProfilesUtils.PROFILE_SECURITY = false;
            ZoweLogger.info(vscode.l10n.t(`Zowe Explorer profiles are being set as unsecured.`));
        } else {
            ProfilesUtils.PROFILE_SECURITY = Constants.ZOWE_CLI_SCM;
            ZoweLogger.info(vscode.l10n.t(`Zowe Explorer profiles are being set as secured.`));
        }
        if (currentProfileSecurity !== ProfilesUtils.PROFILE_SECURITY) {
            imperative.CredentialManagerOverride.recordCredMgrInConfig(ProfilesUtils.PROFILE_SECURITY);
        }
    }

    /**
     * Activate a vscode extension of a custom credential manager
     * @param credentialManagerExtension The credential manager VS Code extension name to activate
     * @returns Promise<imperative.ICredentialManagerConstructor> the constructor of the activated credential manager
     */
    public static async activateCredentialManagerOverride(
        credentialManagerExtension: vscode.Extension<any>
    ): Promise<imperative.ICredentialManagerConstructor | undefined> {
        try {
            ZoweLogger.trace("ProfilesUtils.activateCredentialManagerOverride called.");
            const exports = await credentialManagerExtension.activate();
            if (credentialManagerExtension.isActive && exports) {
                return credentialManagerExtension.exports as imperative.ICredentialManagerConstructor;
            }
            return undefined;
        } catch (err) {
            throw new Error(vscode.l10n.t("Custom credential manager failed to activate"));
        }
    }

    /**
     * Use the custom credential manager in Zowe Explorer and setup before use
     * @param credentialManagerMap The map with associated names of the custom credential manager
     * @returns Promise<imperative.ProfileInfo> the object of profileInfo using the custom credential manager
     */
    public static async setupCustomCredentialManager(
        credentialManagerMap: imperative.ICredentialManagerNameMap
    ): Promise<imperative.ICredentialManagerInit | undefined> {
        ZoweLogger.trace("ProfilesUtils.setupCustomCredentialManager called.");
        ZoweLogger.info(
            vscode.l10n.t({
                message: "Custom credential manager {0} found, attempting to activate.",
                args: [credentialManagerMap.credMgrDisplayName],
                comment: ["Credential manager display name"],
            })
        );
        const customCredentialManagerExtension =
            credentialManagerMap.credMgrZEName && vscode.extensions.getExtension(credentialManagerMap.credMgrZEName);
        const credentialManager = await ProfilesUtils.activateCredentialManagerOverride(customCredentialManagerExtension);
        if (credentialManager && credentialManagerMap.credMgrDisplayName) {
            Object.setPrototypeOf(credentialManager.prototype, imperative.AbstractCredentialManager.prototype);
            ProfilesUtils.updateCredentialManagerSetting(credentialManagerMap.credMgrDisplayName);
            return {
                Manager: credentialManager,
                service: credentialManagerMap.credMgrDisplayName,
            };
        }
    }

    /**
     * Prompt whether to disable credential management setting
     *
     * This will disable credential management on all settings
     * scopes since order precedence can be hard to predict based on the user's setup
     */
    public static async disableCredentialManagement(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.disableCredentialManagement called.");
        const settingEnabled: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED, true);
        if (settingEnabled) {
            ProfilesUtils.PROFILE_SECURITY = false;
            await SettingsConfig.setDirectValue(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED, false, vscode.ConfigurationTarget.Global);
            await Gui.infoMessage(
                vscode.l10n.t(
                    "Zowe Explorer's default credential manager is not supported in your environment. Consider installing a custom solution for your platform. Click Reload to start Zowe Explorer without a credential manager."
                ),
                {
                    items: [vscode.l10n.t("Reload window")],
                }
            );
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
    }

    public static checkDefaultCredentialManager(): boolean {
        try {
            ProfilesCache.requireKeyring();
        } catch (_error) {
            ZoweLogger.info(
                vscode.l10n.t(
                    "Default Zowe credentials manager not found on current platform. This is typically the case when running in container-based environments or Linux systems that miss required security libraries or user permissions."
                )
            );
            return false;
        }
        return true;
    }

    /**
     * Use the default credential manager in Zowe Explorer and setup before use
     * @returns {imperative.ProfileInfo} a ProfileInfo instance using the default credential manager,
     * or undefined if an error occurred unrelated to credential manager initialization
     */
    public static async setupDefaultCredentialManager(): Promise<imperative.ICredentialManagerInit | undefined> {
        ZoweLogger.trace("ProfilesUtils.setupDefaultCredentialManager called.");
        ZoweLogger.info(vscode.l10n.t("No custom credential managers found, using the default instead."));
        ProfilesUtils.updateCredentialManagerSetting(Constants.ZOWE_CLI_SCM);
        const defaultCredentialManager = imperative.ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring);
        const overrideWithEnv: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_OVERRIDE_WITH_ENV_VAR);
        const profileInfo = new imperative.ProfileInfo("zowe", {
            overrideWithEnv: overrideWithEnv,
            credMgrOverride: defaultCredentialManager,
        });

        if (await profileInfo.profileManagerWillLoad()) {
            return defaultCredentialManager;
        } else {
            await ProfilesUtils.disableCredentialManagement();
        }
    }

    /**
     * Fetches the first available registered custom credential manager from installed VS Code extensions.
     * This function will suggest changing the imperative.json file override property if the override is different
     * from the available custom credential manager.
     *
     * @returns Promise<void>
     */
    public static async fetchRegisteredPlugins(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.fetchRegisteredPlugins called.");
        const knownCredentialManagers = imperative.CredentialManagerOverride.getKnownCredMgrs();
        const credentialManager = knownCredentialManagers.find((knownCredentialManager) => {
            try {
                return vscode.extensions.getExtension(knownCredentialManager.credMgrZEName);
            } catch (err) {
                return false;
            }
        });
        if (credentialManager) {
            const header = vscode.l10n.t({
                message: `Custom credential manager {0} found`,
                args: [credentialManager.credMgrDisplayName],
                comment: ["Credential manager display name"],
            });

            const message = vscode.l10n.t("Do you wish to use this credential manager instead?");
            const optionYes = vscode.l10n.t("Yes");
            const optionDontAskAgain = vscode.l10n.t("Don't ask again");

            await Gui.infoMessage(header, { items: [optionYes, optionDontAskAgain], vsCodeOpts: { modal: true, detail: message } }).then(
                (selection) => {
                    if (selection === optionYes) {
                        ProfilesUtils.updateCredentialManagerSetting(credentialManager.credMgrDisplayName);
                        SettingsConfig.setDirectValue(
                            Constants.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS,
                            false,
                            vscode.ConfigurationTarget.Global
                        );
                    }
                    if (selection === optionDontAskAgain) {
                        SettingsConfig.setDirectValue(
                            Constants.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS,
                            false,
                            vscode.ConfigurationTarget.Global
                        );
                    }
                }
            );
        }
    }

    /**
     * Prompts to install the missing VS Code extension associated with the credential manager override in imperative.json
     *
     * @param credentialManager the credential manager to handle its missing VS Code extension
     * @returns Promise<void>
     */
    public static async promptAndHandleMissingCredentialManager(credentialManager: imperative.ICredentialManagerNameMap): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.promptAndHandleMissingCredentialManager called.");
        const header = vscode.l10n.t({
            message: "Plugin of name '{0}' was defined for custom credential management on imperative.json file.",
            args: [credentialManager.credMgrDisplayName],
            comment: ["Credential manager display name"],
        });
        const installMessage = vscode.l10n.t("Please install associated VS Code extension for custom credential manager or revert to default.");
        const revertToDefaultButton = vscode.l10n.t("Use Default");
        const installButton = vscode.l10n.t("Install");
        await Gui.infoMessage(header, { items: [installButton, revertToDefaultButton], vsCodeOpts: { modal: true, detail: installMessage } }).then(
            async (selection) => {
                if (selection === installButton) {
                    const credentialManagerInstallURL = vscode.Uri.parse(
                        `https://marketplace.visualstudio.com/items?itemName=${credentialManager.credMgrZEName}`
                    );
                    if (await vscode.env.openExternal(credentialManagerInstallURL)) {
                        const refreshMessage = vscode.l10n.t(
                            "After installing the extension, please make sure to reload your VS Code window in order to start using the installed credential manager"
                        );
                        const reloadButton = vscode.l10n.t("Reload");
                        if ((await Gui.showMessage(refreshMessage, { items: [reloadButton] })) === reloadButton) {
                            await vscode.commands.executeCommand("workbench.action.reloadWindow");
                        }
                    }
                }
            }
        );
    }

    /**
     * Creates an instance of ProfileInfo with the configured credential manager override.
     * @returns An instance of `ProfileInfo`, or `undefined` if there was an error.
     */
    public static async setupProfileInfo(): Promise<imperative.ProfileInfo> {
        ZoweLogger.trace("ProfilesUtils.getProfileInfo called.");

        const overrideWithEnv: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_OVERRIDE_WITH_ENV_VAR);
        const hasSecureCredentialManagerEnabled: boolean = ProfilesUtils.checkDefaultCredentialManager();
        if (hasSecureCredentialManagerEnabled) {
            const shouldCheckForCustomCredentialManagers = SettingsConfig.getDirectValue<boolean>(
                Constants.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS
            );
            if (shouldCheckForCustomCredentialManagers) {
                await ProfilesUtils.fetchRegisteredPlugins();
            }

            const credentialManagerOverride = ProfilesUtils.getCredentialManagerOverride();
            const isVSCodeCredentialPluginInstalled = ProfilesUtils.isVSCodeCredentialPluginInstalled(credentialManagerOverride);
            const isCustomCredentialPluginDefined = credentialManagerOverride !== imperative.CredentialManagerOverride.DEFAULT_CRED_MGR_NAME;
            const credentialManagerMap = ProfilesUtils.getCredentialManagerMap(credentialManagerOverride);

            if (isCustomCredentialPluginDefined && !isVSCodeCredentialPluginInstalled && credentialManagerMap) {
                await ProfilesUtils.promptAndHandleMissingCredentialManager(credentialManagerMap);
            }
            if (credentialManagerMap && isVSCodeCredentialPluginInstalled) {
                return new imperative.ProfileInfo("zowe", {
                    overrideWithEnv: overrideWithEnv,
                    credMgrOverride: await ProfilesUtils.setupCustomCredentialManager(credentialManagerMap),
                });
            }
        }

        return new imperative.ProfileInfo("zowe", {
            overrideWithEnv: overrideWithEnv,
            credMgrOverride: hasSecureCredentialManagerEnabled ? await ProfilesUtils.setupDefaultCredentialManager() : undefined,
        });
    }

    public static async readConfigFromDisk(warnForMissingSchema?: boolean): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.readConfigFromDisk called.");
        let rootPath: string;
        const profInfo = await ProfilesUtils.setupProfileInfo();
        const workspacePath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath;
        if (workspacePath) {
            rootPath = workspacePath;
            await profInfo.readProfilesFromDisk({
                homeDir: FileManagement.getZoweDir(),
                projectDir: FileManagement.getFullPath(rootPath),
            });
        } else {
            await profInfo.readProfilesFromDisk({ homeDir: FileManagement.getZoweDir(), projectDir: undefined });
        }
        ProfilesUtils.mProfileInfo = profInfo;
        if (profInfo.getTeamConfig().exists) {
            if (warnForMissingSchema && !profInfo.hasValidSchema) {
                const schemaWarning = vscode.l10n.t(
                    "No valid schema was found for the active team configuration. This may introduce issues with profiles in Zowe Explorer."
                );
                Gui.warningMessage(schemaWarning);
                ZoweLogger.warn(schemaWarning);
            }
            ZoweLogger.info(`Zowe Explorer is using the team configuration file "${profInfo.getTeamConfig().configName}"`);
            const layers = profInfo.getTeamConfig().layers || [];
            const layerSummary = layers.map(
                (config: imperative.IConfigLayer) =>
                    `Path: ${config.path}, ${
                        config.exists
                            ? "Found with the following defaults: " + JSON.stringify(config.properties?.defaults || "Undefined default")
                            : "Not available"
                    } `
            );
            ZoweLogger.debug(["Summary of team configuration files considered for Zowe Explorer:", ...layerSummary].join("\t\n"));
        }
    }

    public static async handleV1MigrationStatus(): Promise<void> {
        // For users upgrading from v1 to v3, we must force a "Reload Window" operation to make sure that
        // VS Code registers our updated TreeView IDs. Otherwise, VS Code's "Refresh Extensions" option will break v3 init.
        const ussPersistentSettings = vscode.workspace.getConfiguration("Zowe-USS-Persistent");
        const upgradingFromV1 = ZoweLocalStorage.getValue<Definitions.V1MigrationStatus>(Definitions.LocalStorageKey.V1_MIGRATION_STATUS);
        if (ProfilesUtils.mProfileInfo == null) {
            return;
        }

        if (ussPersistentSettings != null && upgradingFromV1 == null && ProfilesUtils.mProfileInfo.onlyV1ProfilesExist) {
            await ZoweLocalStorage.setValue(Definitions.LocalStorageKey.V1_MIGRATION_STATUS, Definitions.V1MigrationStatus.JustMigrated);
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }

        if (upgradingFromV1 == null || !ProfilesUtils.mProfileInfo.onlyV1ProfilesExist) {
            return;
        }
        const userSelection = await ProfilesUtils.v1ProfileOptions();

        // Open the "Add Session" quick pick if the user selected "Create New" in the v1 migration prompt.
        if (userSelection === ProfilesConvertStatus.CreateNewSelected) {
            await vscode.commands.executeCommand("zowe.ds.addSession", SharedTreeProviders.ds);
        }
    }

    /**
     * Displays a notification if a user does not have any Zowe client configurations.
     *
     * This aims to help direct new Zowe Explorer users to create a new team configuration.
     */
    public static promptUserWithNoConfigs(): void {
        if (ProfilesUtils.noConfigDialogShown || ProfilesUtils.mProfileInfo == null) {
            return;
        }

        if (!ProfilesUtils.mProfileInfo.getTeamConfig().exists && !ProfilesUtils.mProfileInfo.onlyV1ProfilesExist) {
            Gui.showMessage(
                vscode.l10n.t("No Zowe client configurations were detected. Click 'Create New' to create a new Zowe team configuration."),
                {
                    items: [vscode.l10n.t("Create New")],
                }
            ).then(async (selection) => {
                if (selection === vscode.l10n.t("Create New")) {
                    await vscode.commands.executeCommand("zowe.ds.addSession");
                }
            });
            ProfilesUtils.noConfigDialogShown = true;
        }
    }

    public static async promptCredentials(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.promptCredentials called.");
        let profile: string | imperative.IProfileLoaded = node?.getProfile();
        if (profile == null) {
            // prompt for profile
            profile = (
                await Gui.showInputBox({
                    placeHolder: vscode.l10n.t("Connection Name"),
                    prompt: vscode.l10n.t("Enter a name for the connection."),
                    ignoreFocusOut: true,
                })
            ).trim();

            if (!profile) {
                Gui.showMessage(vscode.l10n.t("Operation cancelled"));
                return;
            }
        }

        const creds = await Constants.PROFILES_CACHE.promptCredentials(profile, true);

        if (creds != null) {
            const successMsg = vscode.l10n.t({
                message: "Credentials for {0} were successfully updated",
                args: [typeof profile === "string" ? profile : profile.name],
                comment: ["Profile name"],
            });
            AuthHandler.unlockProfile(profile, true);
            if (typeof profile !== "string") {
                await Constants.PROFILES_CACHE.updateCachedProfile(profile, node);
            }
            if (node != null) {
                const toolTipList = (node.tooltip as string)?.split("\n") ?? [];
                const userIDIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("User: ")));
                if (userIDIndex !== -1) {
                    toolTipList[userIDIndex] = `${vscode.l10n.t("User: ")}${creds[0]}`;
                } else {
                    toolTipList.push(`${vscode.l10n.t("User: ")}${creds[0]}`);
                }
                node.tooltip = toolTipList.join("\n");
                if (node) {
                    SharedTreeProviders.getProviderForNode(node).refreshElement(node);
                }
            }
            ZoweLogger.info(successMsg);
            Gui.showMessage(successMsg);
        }
    }

    public static async initializeZoweFolder(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.initializeZoweFolder called.");
        // Ensure that ~/.zowe folder exists
        const zoweDir = FileManagement.getZoweDir();
        if (!fs.existsSync(zoweDir)) {
            fs.mkdirSync(zoweDir);
        }
        const settingsPath = path.join(zoweDir, "settings");
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath);
        }

        if (!ProfilesUtils.checkDefaultCredentialManager()) {
            await ProfilesUtils.disableCredentialManagement();
        }

        ProfilesUtils.writeOverridesFile();
        // set global variable of security value to existing override
        // this will later get reverted to default in getProfilesInfo.ts if user chooses to
        ProfilesUtils.updateCredentialManagerSetting(ProfilesUtils.getCredentialManagerOverride());
        ZoweLogger.info(
            vscode.l10n.t({
                message: "Zowe home directory is located at {0}",
                args: [zoweDir],
                comment: ["Zowe directory path"],
            })
        );
    }

    public static writeOverridesFile(): void {
        ZoweLogger.trace("ProfilesUtils.writeOverridesFile called.");
        const defaultImperativeJson = { overrides: { CredentialManager: Constants.ZOWE_CLI_SCM } };
        const settingsFile = path.join(FileManagement.getZoweDir(), "settings", "imperative.json");
        let fileContent: string;
        try {
            fileContent = fs.readFileSync(settingsFile, { encoding: "utf-8" });
        } catch (error) {
            ZoweLogger.debug(vscode.l10n.t("Reading imperative.json failed. Will try to create file."));
        }
        let settings: any;
        if (fileContent) {
            try {
                settings = JSON.parse(fileContent);
                ZoweLogger.debug(
                    vscode.l10n.t({
                        message: "Reading imperative.json credential manager.\n {0}",
                        args: [fileContent],
                        comment: ["File content"],
                    })
                );
            } catch (err) {
                if (err instanceof Error) {
                    const errorMsg = vscode.l10n.t({
                        message: "Failed to parse JSON file {0}. Will try to re-create the file.",
                        args: [settingsFile],
                        comment: ["Settings file"],
                    });
                    ZoweLogger.error(errorMsg);
                    ZoweLogger.debug(fileContent.toString());
                    settings = { ...defaultImperativeJson };
                    return fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), {
                        encoding: "utf-8",
                        flag: "w",
                    });
                }
            }
            if (settings?.overrides?.CredentialManager === ProfilesUtils.PROFILE_SECURITY) {
                return;
            }
            if (!settings?.overrides?.CredentialManager) {
                settings = { ...defaultImperativeJson, ...settings };
            }
        } else {
            settings = { ...defaultImperativeJson };
        }
        const newData = JSON.stringify(settings, null, 2);
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Updating imperative.json credential manager to {0}.\n{1}",
                args: [ProfilesUtils.PROFILE_SECURITY, newData],
                comment: ["Default credential override setting", "New credential override setting"],
            })
        );
        return fs.writeFileSync(settingsFile, newData, {
            encoding: "utf-8",
            flag: "w",
        });
    }

    public static async initializeZoweProfiles(errorCallback: (msg: string) => unknown): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.initializeZoweProfiles called.");
        try {
            await ProfilesUtils.initializeZoweFolder();
        } catch (err) {
            ZoweLogger.error(err);
            Gui.errorMessage(
                vscode.l10n.t({
                    message: "Failed to initialize Zowe folder: {0}",
                    args: [err.message],
                    comment: ["Error message"],
                })
            );
        }

        try {
            await ProfilesUtils.readConfigFromDisk(true);
            ZoweLogger.info(vscode.l10n.t("Zowe profiles initialized successfully."));
        } catch (err) {
            // JSON parsing errors in team config files will have suppressDump=true
            if (err instanceof imperative.ImperativeError && !err.mDetails.suppressDump) {
                await AuthUtils.errorHandling(err, { scenario: err.mDetails.causeErrors });
            } else {
                ZoweLogger.error(err);
                errorCallback(err.message);
            }
        }
    }

    private static async v1ProfileOptions(): Promise<ProfilesConvertStatus | undefined> {
        const v1ProfileErrorMsg = vscode.l10n.t(
            "Zowe V1 profiles in use.\nZowe Explorer no longer supports V1 profiles. Choose to convert existing profiles to a team configuration or create new profiles."
        );
        ZoweLogger.warn(v1ProfileErrorMsg);
        const convertButton = vscode.l10n.t("Convert existing profiles");
        const createButton = vscode.l10n.t("Create New");
        const selection = await Gui.infoMessage(v1ProfileErrorMsg, { items: [convertButton, createButton], vsCodeOpts: { modal: true } });
        switch (selection) {
            case createButton:
                ZoweLogger.info("Create new team configuration chosen.");
                await ZoweLocalStorage.setValue(Definitions.LocalStorageKey.V1_MIGRATION_STATUS, undefined);
                return ProfilesConvertStatus.CreateNewSelected;
            case convertButton:
                ZoweLogger.info("Convert v1 profiles to team configuration chosen.");
                await ProfilesUtils.convertV1Profs();
                await ZoweLocalStorage.setValue(Definitions.LocalStorageKey.V1_MIGRATION_STATUS, undefined);
                return ProfilesConvertStatus.ConvertSelected;
            default:
                return undefined;
        }
    }

    /**
     * Function to update the node profile information
     */
    public static setProfile(node: IZoweTreeNode, profile: imperative.IProfile): void {
        ZoweLogger.trace("ProfilesUtils.setProfile called.");
        node.getProfile().profile = profile;
    }

    /**
     * Function to update the node session information
     */
    public static setSession(node: IZoweTreeNode, combinedSessionProfile: imperative.IProfile): void {
        ZoweLogger.trace("ProfilesUtils.setSession called.");
        const sessionNode = node.getSession();
        for (const prop of Object.keys(combinedSessionProfile)) {
            if (prop === "host") {
                sessionNode.ISession.hostname = combinedSessionProfile[prop];
            } else {
                sessionNode.ISession[prop] = combinedSessionProfile[prop];
            }
        }
    }

    public static getProfile(node: vscode.TreeItem | ZoweTreeNode): imperative.IProfileLoaded {
        ZoweLogger.trace("ProfilesUtils.getProfile called.");
        if (node instanceof ZoweTreeNode) {
            return node.getProfile();
        }
        throw new Error(vscode.l10n.t("Tree item is not a Zowe Explorer item."));
    }

    /**
     * Adds new types and updates the Zowe schema.
     * @param {imperative.ProfileInfo} profileInfo an imperative ProfileInfo object that has been prepared with a `readProfilesFromDisk`
     * @param {imperative.ICommandProfileTypeConfiguration[]} profileTypeConfigurations Profile type configurations to add to the schema
     * @param {boolean} updateProjectSchema (optional) false by default. pass true to update project level schema along with global level
     */
    public static updateSchema(
        profileInfo: imperative.ProfileInfo,
        profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[],
        updateProjectSchema: boolean = false
    ): void {
        if (profileTypeConfigurations) {
            try {
                for (const typeConfig of profileTypeConfigurations) {
                    const addResult = profileInfo.addProfileTypeToSchema(
                        typeConfig.type,
                        {
                            schema: typeConfig.schema,
                            sourceApp: "Zowe Explorer (for VS Code)",
                        },
                        updateProjectSchema
                    );
                    if (addResult.info.length > 0) {
                        ZoweLogger.warn(addResult.info);
                    }
                }
            } catch (err) {
                // Only show an error if we failed to update the on-disk schema.
                if (err.code === "EACCES" || err.code === "EPERM") {
                    Gui.errorMessage(
                        vscode.l10n.t({
                            message: "Failed to update Zowe schema: insufficient permissions or read-only file. {0}",
                            args: [err.message ?? ""],
                            comment: ["Error message"],
                        })
                    );
                }
            }
        }
    }

    private static async convertV1Profs(): Promise<void> {
        const profileInfo = await ProfilesUtils.setupProfileInfo();
        const convertResult: imperative.IConvertV1ProfResult = await ProfilesCache.convertV1ProfToConfig(profileInfo);
        ZoweLogger.debug(JSON.stringify(convertResult));
        if (convertResult.profilesConverted) {
            const successMsg: string[] = [];
            for (const [k, v] of Object.entries(convertResult.profilesConverted)) {
                successMsg.push(`Converted ${k} profile: ${v.join(", ")}`);
            }
            ZoweLogger.info(successMsg.join("\n"));
            const document = await vscode.workspace.openTextDocument(path.join(FileManagement.getZoweDir(), profileInfo.getTeamConfig().configName));
            if (document) {
                await Gui.showTextDocument(document);
            }
        }
        if (convertResult.profilesFailed?.length > 0) {
            const warningMsg: string[] = [];
            warningMsg.push(`Failed to convert ${convertResult.profilesFailed.length} profile(s). See details below`);
            for (const { name, type, error } of convertResult.profilesFailed) {
                if (name != null) {
                    warningMsg.push(`Failed to load ${type} profile "${name}":\n${String(error)}`);
                } else {
                    warningMsg.push(`Failed to find default ${type} profile:\n${String(error)}`);
                }
            }
            ZoweLogger.warn(warningMsg.join("\n"));
        }
        const responseMsg = convertResult.msgs.reduce((msgs: string[], msg: imperative.ConvertMsg) => {
            if (msg.msgFormat & imperative.ConvertMsgFmt.PARAGRAPH) {
                msgs.push("\n");
            }
            if (msg.msgFormat & imperative.ConvertMsgFmt.INDENT) {
                msgs.push("\t");
            }
            msgs.push(msg.msgText + "\n");
            return msgs;
        }, []);
        Gui.infoMessage(responseMsg.join(""), { vsCodeOpts: { modal: true } });
    }

    public static extenderTypeReady: Map<string, imperative.DeferredPromise<void>> = new Map([
        [
            "zosmf",
            ((): imperative.DeferredPromise<void> => {
                const deferred = new imperative.DeferredPromise<void>();
                deferred.resolve();
                return deferred;
            })(),
        ],
    ]);

    public static async awaitExtenderType(profileName: string, profInfo: ProfilesCache): Promise<void> {
        const profAttrs = await profInfo.getProfileFromConfig(profileName);
        if (profAttrs && !ProfilesUtils.extenderTypeReady.has(profAttrs.profType)) {
            const deferredPromise = new imperative.DeferredPromise<void>();
            ProfilesUtils.extenderTypeReady.set(profAttrs.profType, deferredPromise);
        }
        const profilePromise = ProfilesUtils.extenderTypeReady.get(profAttrs?.profType);
        const promiseTimeout = 10000;
        if (profilePromise) {
            let timeoutHandle: NodeJS.Timeout;
            const timeoutPromise = new Promise<void>((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("Timeout waiting for profile")), promiseTimeout);
            });
            await Promise.race([profilePromise.promise.finally(() => clearTimeout(timeoutHandle)), timeoutPromise]);
        }
    }

    public static async resolveTypePromise(extenderType: string): Promise<void> {
        if (!ProfilesUtils.extenderTypeReady.has(extenderType)) {
            // Prevent deadlocks by setting a resolved promise to avoid setting a new promise
            ProfilesUtils.extenderTypeReady.set(extenderType, new imperative.DeferredPromise());
        }
        ProfilesUtils.extenderTypeReady.get(extenderType).resolve();
        await vscode.commands.executeCommand("zowe.setupRemoteWorkspaceFolders", extenderType);
    }
}
