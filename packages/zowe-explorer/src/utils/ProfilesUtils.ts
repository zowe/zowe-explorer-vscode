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

// Generic utility functions (not node type related). See ./src/shared/utils.ts

import * as vscode from "vscode";
import * as globals from "../globals";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import { IZoweTreeNode, ZoweTreeNode, FileManagement, Gui, ProfilesCache, MainframeInteraction, imperative } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./ZoweLogger";
import { SettingsConfig } from "./SettingsConfig";
import { TreeProviders } from "../shared/TreeProviders";

/*************************************************************************************************************
 * Error Handling
 * @param {errorDetails} - string or error object
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export async function errorHandling(errorDetails: Error | string, label?: string, moreInfo?: string): Promise<void> {
    // Use util.inspect instead of JSON.stringify to handle circular references
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    ZoweLogger.error(`${errorDetails.toString()}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null }));
    if (typeof errorDetails !== "string" && (errorDetails as imperative.ImperativeError)?.mDetails !== undefined) {
        const imperativeError: imperative.ImperativeError = errorDetails as imperative.ImperativeError;
        const httpErrorCode = Number(imperativeError.mDetails.errorCode);
        // open config file for missing hostname error
        if (imperativeError.toString().includes("hostname")) {
            const mProfileInfo = await globals.PROFILES_CACHE.getProfileInfo();
            Gui.errorMessage(vscode.l10n.t("Required parameter 'host' must not be blank."));
            const profAllAttrs = mProfileInfo.getAllProfiles();
            for (const prof of profAllAttrs) {
                if (prof.profName === label.trim()) {
                    const filePath = prof.profLoc.osLoc[0];
                    await globals.PROFILES_CACHE.openConfigFile(filePath);
                    return;
                }
            }
        } else if (httpErrorCode === imperative.RestConstants.HTTP_STATUS_401) {
            const errMsg = vscode.l10n.t({
                message: "Invalid Credentials for profile '{0}'. Please ensure the username and password are valid or this may lead to a lock-out.",
                args: [label],
                comment: ["Label"],
            });
            const errToken = vscode.l10n.t({
                message:
                    "Your connection is no longer active for profile '{0}'. Please log in to an authentication service to restore the connection.",
                args: [label],
                comment: ["Label"],
            });
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" [")).trim();
            }

            if (imperativeError.mDetails.additionalDetails) {
                const tokenError: string = imperativeError.mDetails.additionalDetails;
                const isTokenAuth = await ProfilesUtils.isUsingTokenAuth(label);

                if (tokenError.includes("Token is not valid or expired.") || isTokenAuth) {
                    const message = vscode.l10n.t("Log in to Authentication Service");
                    Gui.showMessage(errToken, { items: [message] }).then(async (selection) => {
                        if (selection) {
                            await globals.PROFILES_CACHE.ssoLogin(null, label);
                        }
                    });
                    return;
                }
            }
            const checkCredsButton = vscode.l10n.t("Update Credentials");
            await Gui.errorMessage(errMsg, {
                items: [checkCredsButton],
                vsCodeOpts: { modal: true },
            }).then(async (selection) => {
                if (selection !== checkCredsButton) {
                    Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                    return;
                }
                await globals.PROFILES_CACHE.promptCredentials(label.trim(), true);
            });
            return;
        }
    }
    if (errorDetails.toString().includes("Could not find profile")) {
        return;
    }
    if (moreInfo === undefined) {
        moreInfo = errorDetails.toString().includes("Error") ? "" : "Error: ";
    } else {
        moreInfo += " ";
    }
    // Try to keep message readable since VS Code doesn't support newlines in error messages
    Gui.errorMessage(moreInfo + errorDetails.toString().replace(/\n/g, " | "));
}

/**
 * Function to update session and profile information in provided node
 * @param profiles is data source to find profiles
 * @param getSessionForProfile is a function to build a valid specific session based on provided profile
 * @param sessionNode is a tree node, containing session information
 */
export const syncSessionNode = (
    getCommonApi: (profile: imperative.IProfileLoaded) => MainframeInteraction.ICommon,
    sessionNode: IZoweTreeNode
): void => {
    ZoweLogger.trace("ProfilesUtils.syncSessionNode called.");

    const profileType = sessionNode.getProfile()?.type;
    const profileName = sessionNode.getProfileName();

    let profile: imperative.IProfileLoaded;
    try {
        profile = globals.PROFILES_CACHE.loadNamedProfile(profileName, profileType);
    } catch (e) {
        ZoweLogger.warn(e);
        return;
    }
    sessionNode.setProfileToChoice(profile);
    const session = getCommonApi(profile).getSession();
    sessionNode.setSessionToChoice(session);
};

export interface IFilterItem {
    text: string;
    description?: string;
    show?: boolean;
    icon?: string;
    menuType?: globals.JobPickerTypes;
}

export class FilterItem implements vscode.QuickPickItem {
    public constructor(public filterItem: IFilterItem) {}
    public get label(): string {
        const icon = this.filterItem.icon ? this.filterItem.icon + " " : null;
        return (icon ?? "") + this.filterItem.text;
    }
    public get description(): string {
        if (this.filterItem.description) {
            return this.filterItem.description;
        } else {
            return "";
        }
    }
    public get alwaysShow(): boolean {
        return this.filterItem.show;
    }
}

export class FilterDescriptor implements vscode.QuickPickItem {
    public constructor(private text: string) {}
    public get label(): string {
        return this.text;
    }
    public get description(): string {
        return "";
    }
    public get alwaysShow(): boolean {
        return true;
    }
}

export class ProfilesUtils {
    public static PROFILE_SECURITY: string | boolean = globals.ZOWE_CLI_SCM;

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
    public static updateCredentialManagerSetting(credentialManager?: string): void {
        ZoweLogger.trace("ProfilesUtils.updateCredentialManagerSetting called.");
        const settingEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (settingEnabled) {
            if (settingEnabled && credentialManager) {
                this.PROFILE_SECURITY = credentialManager;
                return;
            } else if (!settingEnabled) {
                this.PROFILE_SECURITY = false;
                ZoweLogger.info(vscode.l10n.t(`Zowe explorer profiles are being set as unsecured.`));
            } else {
                this.PROFILE_SECURITY = globals.ZOWE_CLI_SCM;
                ZoweLogger.info(vscode.l10n.t(`Zowe explorer profiles are being set as secured.`));
            }
            if (this.PROFILE_SECURITY) {
                imperative.CredentialManagerOverride.recordCredMgrInConfig(this.PROFILE_SECURITY);
            }
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
    public static async setupCustomCredentialManager(credentialManagerMap: imperative.ICredentialManagerNameMap): Promise<imperative.ProfileInfo> {
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
        if (credentialManager) {
            Object.setPrototypeOf(credentialManager.prototype, imperative.AbstractCredentialManager.prototype);
            ProfilesUtils.updateCredentialManagerSetting(credentialManagerMap.credMgrDisplayName);
            return new imperative.ProfileInfo("zowe", {
                credMgrOverride: {
                    Manager: credentialManager,
                    service: credentialManagerMap.credMgrDisplayName,
                },
            });
        }
    }

    /**
     * Use the default credential manager in Zowe Explorer and setup before use
     * @returns Promise<imperative.ProfileInfo> the object of profileInfo using the default credential manager
     */
    public static setupDefaultCredentialManager(): imperative.ProfileInfo {
        ZoweLogger.trace("ProfilesUtils.setupDefaultCredentialManager called.");
        ZoweLogger.info(vscode.l10n.t("No custom credential managers found, using the default instead."));
        ProfilesUtils.updateCredentialManagerSetting(globals.ZOWE_CLI_SCM);
        return new imperative.ProfileInfo("zowe", {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            credMgrOverride: imperative.ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
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
                            globals.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS,
                            false,
                            vscode.ConfigurationTarget.Global
                        );
                    }
                    if (selection === optionDontAskAgain) {
                        SettingsConfig.setDirectValue(
                            globals.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS,
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

    public static async getProfileInfo(): Promise<imperative.ProfileInfo> {
        ZoweLogger.trace("ProfilesUtils.getProfileInfo called.");
        const hasSecureCredentialManagerEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);

        if (hasSecureCredentialManagerEnabled) {
            const shouldCheckForCustomCredentialManagers = SettingsConfig.getDirectValue(globals.SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS);
            if (shouldCheckForCustomCredentialManagers) {
                await this.fetchRegisteredPlugins();
            }

            const credentialManagerOverride = this.getCredentialManagerOverride();
            const isVSCodeCredentialPluginInstalled = this.isVSCodeCredentialPluginInstalled(credentialManagerOverride);
            const isCustomCredentialPluginDefined = credentialManagerOverride !== imperative.CredentialManagerOverride.DEFAULT_CRED_MGR_NAME;
            const credentialManagerMap = ProfilesUtils.getCredentialManagerMap(credentialManagerOverride);

            if (isCustomCredentialPluginDefined && !isVSCodeCredentialPluginInstalled && credentialManagerMap) {
                await this.promptAndHandleMissingCredentialManager(credentialManagerMap);
            }
            if (credentialManagerMap && isVSCodeCredentialPluginInstalled) {
                return this.setupCustomCredentialManager(credentialManagerMap);
            }
        }

        return this.setupDefaultCredentialManager();
    }

    public static async readConfigFromDisk(warnForMissingSchema?: boolean): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.readConfigFromDisk called.");
        let rootPath: string;
        const mProfileInfo = await ProfilesUtils.getProfileInfo();
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            await mProfileInfo.readProfilesFromDisk({ homeDir: FileManagement.getZoweDir(), projectDir: FileManagement.getFullPath(rootPath) });
        } else {
            await mProfileInfo.readProfilesFromDisk({ homeDir: FileManagement.getZoweDir(), projectDir: undefined });
        }
        if (mProfileInfo.getTeamConfig().exists) {
            if (warnForMissingSchema && !mProfileInfo.hasValidSchema) {
                const schemaWarning = vscode.l10n.t(
                    "No valid schema was found for the active team configuration. This may introduce issues with profiles in Zowe Explorer."
                );
                Gui.warningMessage(schemaWarning);
                ZoweLogger.warn(schemaWarning);
            }
            globals.setConfigPath(rootPath);
            ZoweLogger.info(`Zowe Explorer is using the team configuration file "${mProfileInfo.getTeamConfig().configName}"`);
            const layers = mProfileInfo.getTeamConfig().layers || [];
            const layerSummary = layers.map(
                (config: imperative.IConfigLayer) =>
                    `Path: ${config.path}: ${
                        config.exists
                            ? "Found, with the following defaults:" + JSON.stringify(config.properties?.defaults || "Undefined default")
                            : "Not available"
                    } `
            );
            ZoweLogger.debug(`Summary of team configuration files considered for Zowe Explorer: ${JSON.stringify(layerSummary)}`);
        } else {
            if (mProfileInfo.getAllProfiles()?.length > 0) {
                this.v1ProfileOptions();
            }
        }
    }

    /**
     * Function that checks whether a profile is using basic authentication
     * @param profile
     * @returns {Promise<boolean>} a boolean representing whether basic auth is being used or not
     */
    public static isProfileUsingBasicAuth(profile: imperative.IProfileLoaded): boolean {
        const prof = profile.profile;
        // See https://github.com/zowe/vscode-extension-for-zowe/issues/2664
        return prof.user != null && prof.password != null;
    }

    /**
     * Function that checks whether a profile is using token based authentication
     * @param profileName the name of the profile to check
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static async isUsingTokenAuth(profileName: string): Promise<boolean> {
        const secureProfileProps = await globals.PROFILES_CACHE.getSecurePropsForProfile(profileName);
        const profileUsesBasicAuth = secureProfileProps.includes("user") && secureProfileProps.includes("password");
        if (secureProfileProps.includes("tokenValue")) {
            return secureProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
        }
        const baseProfile = globals.PROFILES_CACHE.getDefaultProfile("base");
        const secureBaseProfileProps = await globals.PROFILES_CACHE.getSecurePropsForProfile(baseProfile?.name);
        return secureBaseProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
    }

    public static async promptCredentials(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.promptCredentials called.");
        const mProfileInfo = await globals.PROFILES_CACHE.getProfileInfo();
        if (!imperative.ProfileInfo.onlyV1ProfilesExist && !mProfileInfo.getTeamConfig().properties.autoStore) {
            const msg = vscode.l10n.t('"Update Credentials" operation not supported when "autoStore" is false');
            ZoweLogger.warn(msg);
            Gui.showMessage(msg);
            return;
        }
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
                Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                return;
            }
        }

        const creds = await globals.PROFILES_CACHE.promptCredentials(profile, true);

        if (creds != null) {
            const successMsg = vscode.l10n.t({
                message: "Credentials for {0} were successfully updated",
                args: [typeof profile === "string" ? profile : profile.name],
                comment: ["Profile name"],
            });
            ZoweLogger.info(successMsg);
            Gui.showMessage(successMsg);
            // config file watcher isn't noticing changes for secure fields
            await vscode.commands.executeCommand("zowe.extRefresh");
        }
    }

    public static initializeZoweFolder(): void {
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
        const defaultImperativeJson = { overrides: { CredentialManager: globals.ZOWE_CLI_SCM } };
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
                        message: "Reading imperative.json Credential Manager.\n {0}",
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
            if (settings?.overrides?.CredentialManager === this.PROFILE_SECURITY) {
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
                message: "Updating imperative.json Credential Manager to {0}.\n{1}",
                args: [this.PROFILE_SECURITY, newData],
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
            ProfilesUtils.initializeZoweFolder();
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
            ZoweLogger.info(vscode.l10n.t("Zowe Profiles initialized successfully."));
        } catch (err) {
            if (err instanceof imperative.ImperativeError) {
                await errorHandling(err, undefined, err.mDetails.causeErrors);
            } else {
                ZoweLogger.error(err);
                errorCallback(err.message);
            }
        }
    }

    public static initializeZoweTempFolder(): void {
        ZoweLogger.trace("ProfilesUtils.initializeZoweTempFolder called.");
        try {
            if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
                fs.mkdirSync(globals.ZOWETEMPFOLDER, { recursive: true });
                fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
                fs.mkdirSync(globals.USS_DIR);
                fs.mkdirSync(globals.DS_DIR);
                ZoweLogger.info(vscode.l10n.t("Zowe Temp folder initialized successfully."));
            }
        } catch (err) {
            ZoweLogger.error(err);
            Gui.errorMessage(err.message);
        }
    }

    private static v1ProfileOptions(): void {
        const v1ProfileErrorMsg = vscode.l10n.t(
            // eslint-disable-next-line max-len
            "Zowe v1 profiles in use.\nZowe Explorer no longer supports v1 profiles, choose to convert existing profiles to a team configuration or create new."
        );
        ZoweLogger.warn(v1ProfileErrorMsg);
        const createButton = vscode.l10n.t("Create New");
        const convertButton = vscode.l10n.t("Convert Existing Profiles");
        Gui.infoMessage(v1ProfileErrorMsg, { items: [createButton, convertButton], vsCodeOpts: { modal: true } }).then(async (selection) => {
            switch (selection) {
                case createButton: {
                    ZoweLogger.info("Create new team configuration chosen.");
                    vscode.commands.executeCommand("zowe.ds.addSession", TreeProviders.ds);
                    break;
                }
                case convertButton: {
                    ZoweLogger.info("Convert v1 profiles to team configuration chosen.");
                    const convertResults = await globals.PROFILES_CACHE.convertV1ProfToConfig();
                    let responseMsg = "";
                    if (convertResults.success) {
                        responseMsg += `Success: ${convertResults.success}\n`;
                    }
                    if (convertResults.warnings) {
                        responseMsg += `Warning: ${convertResults.warnings}\n`;
                    }
                    ZoweLogger.info(responseMsg);
                    Gui.infoMessage(vscode.l10n.t(responseMsg), { vsCodeOpts: { modal: true } });
                    break;
                }
                default: {
                    Gui.infoMessage(vscode.l10n.t("Operation cancelled"));
                    break;
                }
            }
        });
    }
}

/**
 * Function to update the node profile information
 */
export function setProfile(node: IZoweTreeNode, profile: imperative.IProfile): void {
    ZoweLogger.trace("ProfilesUtils.setProfile called.");
    node.getProfile().profile = profile;
}

/**
 * Function to update the node session information
 */
export function setSession(node: IZoweTreeNode, combinedSessionProfile: imperative.IProfile): void {
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

export function getProfile(node: vscode.TreeItem | ZoweTreeNode): imperative.IProfileLoaded {
    ZoweLogger.trace("ProfilesUtils.getProfile called.");
    if (node instanceof ZoweTreeNode) {
        return node.getProfile();
    }
    throw new Error(vscode.l10n.t("Tree Item is not a Zowe Explorer item."));
}
