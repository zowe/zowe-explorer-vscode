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
import { IZoweTreeNode, ZoweTreeNode, getZoweDir, getFullPath, Gui, ProfilesCache } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import * as nls from "vscode-nls";
import { imperative, getImperativeConfig } from "@zowe/cli";
import { ZoweExplorerExtender } from "../ZoweExplorerExtender";
import { ZoweLogger } from "./LoggerUtils";
import { SettingsConfig } from "./SettingsConfig";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
            const mProfileInfo = await Profiles.getInstance().getProfileInfo();
            if (mProfileInfo.usingTeamConfig) {
                Gui.errorMessage(localize("errorHandling.invalid.host", "Required parameter 'host' must not be blank."));
                const profAllAttrs = mProfileInfo.getAllProfiles();
                for (const prof of profAllAttrs) {
                    if (prof.profName === label.trim()) {
                        const filePath = prof.profLoc.osLoc[0];
                        await Profiles.getInstance().openConfigFile(filePath);
                        return;
                    }
                }
            }
        } else if (httpErrorCode === imperative.RestConstants.HTTP_STATUS_401) {
            const errMsg = localize(
                "errorHandling.invalid.credentials",
                "Invalid Credentials for profile '{0}'. Please ensure the username and password are valid or this may lead to a lock-out.",
                label
            );
            const errToken = localize(
                "errorHandling.invalid.token",
                "Your connection is no longer active for profile '{0}'. Please log in to an authentication service to restore the connection.",
                label
            );
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" [")).trim();
            }

            if (imperativeError.mDetails.additionalDetails) {
                const tokenError: string = imperativeError.mDetails.additionalDetails;
                const isTokenAuth = await ProfilesUtils.isUsingTokenAuth(label);

                if (tokenError.includes("Token is not valid or expired.") || isTokenAuth) {
                    if (isTheia()) {
                        Gui.errorMessage(errToken);
                        await Profiles.getInstance().ssoLogin(null, label);
                        return;
                    }
                    const message = localize("errorHandling.authentication.login", "Log in to Authentication Service");
                    Gui.showMessage(errToken, { items: [message] }).then(async (selection) => {
                        if (selection) {
                            await Profiles.getInstance().ssoLogin(null, label);
                        }
                    });
                    return;
                }
            }

            if (isTheia()) {
                Gui.errorMessage(errMsg);
                return;
            }
            const checkCredsButton = localize("errorHandling.checkCredentials.button", "Update Credentials");
            await Gui.errorMessage(errMsg, {
                items: [checkCredsButton],
                vsCodeOpts: { modal: true },
            }).then(async (selection) => {
                if (selection !== checkCredsButton) {
                    Gui.showMessage(localize("errorHandling.checkCredentials.cancelled", "Operation Cancelled"));
                    return;
                }
                await Profiles.getInstance().promptCredentials(label.trim(), true);
            });
            return;
        }
    }

    if (moreInfo === undefined) {
        moreInfo = errorDetails.toString().includes("Error") ? "" : "Error: ";
    } else {
        moreInfo += " ";
    }
    // Try to keep message readable since VS Code doesn't support newlines in error messages
    Gui.errorMessage(moreInfo + errorDetails.toString().replace(/\n/g, " | "));
}

// TODO: remove this second occurence
export function isTheia(): boolean {
    ZoweLogger.trace("ProfileUtils.isTheia called.");
    const VSCODE_APPNAME: string[] = ["Visual Studio Code", "VSCodium"];
    const appName = vscode.env.appName;
    if (appName && !VSCODE_APPNAME.includes(appName)) {
        return true;
    }
    return false;
}

/**
 * Function to update session and profile information in provided node
 * @param profiles is data source to find profiles
 * @param getSessionForProfile is a function to build a valid specific session based on provided profile
 * @param sessionNode is a tree node, containing session information
 */
type SessionForProfile = (_profile: imperative.IProfileLoaded) => imperative.Session;
export const syncSessionNode =
    (_profiles: Profiles) =>
    (getSessionForProfile: SessionForProfile) =>
    (sessionNode: IZoweTreeNode): void => {
        ZoweLogger.trace("ProfilesUtils.syncSessionNode called.");

        const profileType = sessionNode.getProfile()?.type;
        const profileName = sessionNode.getProfileName();

        let profile: imperative.IProfileLoaded;
        try {
            profile = Profiles.getInstance().loadNamedProfile(profileName, profileType);
        } catch (e) {
            ZoweLogger.warn(e);
            return;
        }
        sessionNode.setProfileToChoice(profile);
        const session = getSessionForProfile(profile);
        sessionNode.setSessionToChoice(session);
    };

/**
 * @deprecated Use `Gui.resolveQuickPick` instead
 * @param quickpick The quick pick object to resolve
 * @returns a Promise containing the result of the quick pick
 */
export async function resolveQuickPickHelper(quickpick: vscode.QuickPick<vscode.QuickPickItem>): Promise<vscode.QuickPickItem | undefined> {
    return new Promise<vscode.QuickPickItem | undefined>((c) => {
        quickpick.onDidAccept(() => c(quickpick.activeItems[0]));
        quickpick.onDidHide(() => c(undefined));
    });
}

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
    public static getCredentialManagerOverride(): imperative.ICredentialManagerNameMap | undefined {
        ZoweLogger.trace("ProfilesUtils.getCredentialManagerOverride called.");
        const knownCredentialManagers = imperative.CredentialManagerOverride.getKnownCredMgrs();
        const credentialManager = knownCredentialManagers.find((knownCredentialManager) => {
            try {
                return vscode.extensions.getExtension(knownCredentialManager.credMgrZEName);
            } catch (err) {
                return false;
            }
        });
        if (!credentialManager) {
            return undefined;
        }
        return imperative.CredentialManagerOverride.getCredMgrInfoByDisplayName(credentialManager.credMgrDisplayName);
    }

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
            throw new Error(localize("activateCredentialManagerOverride.failedToActivate", "Custom credential manager failed to activate"));
        }
    }

    public static async updateCredentialManagerSetting(setting: string): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.updateCredentialManagerSetting called.");
        const settingEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (settingEnabled) {
            await globals.setGlobalSecurityValue(setting);
            imperative.CredentialManagerOverride.recordCredMgrInConfig(setting);
        }
    }

    public static async getProfileInfo(envTheia: boolean): Promise<imperative.ProfileInfo> {
        ZoweLogger.trace("ProfilesUtils.getProfileInfo called.");
        const credentialManagerMap = ProfilesUtils.getCredentialManagerOverride();
        const customCredentialManagerExtension =
            credentialManagerMap?.credMgrZEName && vscode.extensions.getExtension(credentialManagerMap.credMgrZEName);
        const settingEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (credentialManagerMap && customCredentialManagerExtension && settingEnabled) {
            ZoweLogger.info(localize("ProfilesUtils.getProfileInfo.usingCustom", "Custom credential manager found, attempting to activate."));
            const credentialManager = await ProfilesUtils.activateCredentialManagerOverride(customCredentialManagerExtension);
            if (credentialManager) {
                Object.setPrototypeOf(credentialManager.prototype, imperative.AbstractCredentialManager.prototype);
                await ProfilesUtils.updateCredentialManagerSetting(credentialManagerMap.credMgrDisplayName);
                return new imperative.ProfileInfo("zowe", {
                    credMgrOverride: {
                        Manager: credentialManager,
                        service: credentialManagerMap.credMgrDisplayName,
                    },
                });
            }
        }

        ZoweLogger.info(localize("ProfilesUtils.getProfileInfo.usingDefault", "No custom credential managers found, using the default instead."));
        await ProfilesUtils.updateCredentialManagerSetting(globals.ZOWE_CLI_SCM);
        return new imperative.ProfileInfo("zowe", {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            credMgrOverride: imperative.ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
    }

    public static async readConfigFromDisk(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.readConfigFromDisk called.");
        let rootPath: string;
        const mProfileInfo = await ProfilesUtils.getProfileInfo(globals.ISTHEIA);
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir(), projectDir: getFullPath(rootPath) });
        } else {
            await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir(), projectDir: undefined });
        }
        if (mProfileInfo.usingTeamConfig) {
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
        }
    }

    /**
     * Function that checks whether a profile is using basic authentication
     * @param profile
     * @returns {Promise<boolean>} a boolean representing whether basic auth is being used or not
     */
    public static isProfileUsingBasicAuth(profile: imperative.IProfileLoaded): boolean {
        const prof = profile.profile;
        return "user" in prof && "password" in prof;
    }

    /**
     * Function that checks whether a profile is using token based authentication
     * @param profileName the name of the profile to check
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static async isUsingTokenAuth(profileName: string): Promise<boolean> {
        const secureProfileProps = await Profiles.getInstance().getSecurePropsForProfile(profileName);
        const profileUsesBasicAuth = secureProfileProps.includes("user") && secureProfileProps.includes("password");
        if (secureProfileProps.includes("tokenValue")) {
            return secureProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
        }
        const baseProfile = Profiles.getInstance().getDefaultProfile("base");
        const secureBaseProfileProps = await Profiles.getInstance().getSecurePropsForProfile(baseProfile?.name);
        return secureBaseProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
    }

    public static async promptCredentials(node: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.promptCredentials called.");
        const mProfileInfo = await Profiles.getInstance().getProfileInfo();
        if (mProfileInfo.usingTeamConfig && !mProfileInfo.getTeamConfig().properties.autoStore) {
            const msg = localize("zowe.promptCredentials.notSupported", '"Update Credentials" operation not supported when "autoStore" is false');
            ZoweLogger.warn(msg);
            Gui.showMessage(msg);
            return;
        }
        let profile: string | imperative.IProfileLoaded = node?.getProfile();
        if (profile == null) {
            // prompt for profile
            profile = (
                await Gui.showInputBox({
                    placeHolder: localize("createNewConnection.option.prompt.profileName.placeholder", "Connection Name"),
                    prompt: localize("createNewConnection.option.prompt.profileName", "Enter a name for the connection."),
                    ignoreFocusOut: true,
                })
            ).trim();

            if (!profile) {
                Gui.showMessage(localize("createNewConnection.undefined.passWord", "Operation Cancelled"));
                return;
            }
        }

        const creds = await Profiles.getInstance().promptCredentials(profile, true);

        if (creds != null) {
            const successMsg = localize(
                "promptCredentials.updatedCredentials",
                "Credentials for {0} were successfully updated",
                typeof profile === "string" ? profile : profile.name
            );
            ZoweLogger.info(successMsg);
            Gui.showMessage(successMsg);
            // config file watcher isn't noticing changes for secure fields
            await vscode.commands.executeCommand("zowe.extRefresh");
        }
    }

    public static async initializeZoweFolder(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.initializeZoweFolder called.");
        // ensure the Secure Credentials Enabled value is read
        // set globals.PROFILE_SECURITY value accordingly
        const credentialManagerMap = ProfilesUtils.getCredentialManagerOverride();
        await globals.setGlobalSecurityValue(credentialManagerMap?.credMgrDisplayName ?? globals.ZOWE_CLI_SCM);
        // Ensure that ~/.zowe folder exists
        // Ensure that the ~/.zowe/settings/imperative.json exists
        // TODO: update code below once this imperative issue is resolved.
        // https://github.com/zowe/imperative/issues/840
        const zoweDir = getZoweDir();
        if (!fs.existsSync(zoweDir)) {
            fs.mkdirSync(zoweDir);
        }
        const settingsPath = path.join(zoweDir, "settings");
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath);
        }
        ProfilesUtils.writeOverridesFile();
        // If not using team config, ensure that the ~/.zowe/profiles directory
        // exists with appropriate types within
        if (!imperative.ImperativeConfig.instance.config?.exists) {
            await imperative.CliProfileManager.initialize({
                configuration: getImperativeConfig().profiles,
                profileRootDirectory: path.join(zoweDir, "profiles"),
            });
        }
        ZoweLogger.info(localize("initializeZoweFolder.location", "Zowe home directory is located at {0}", zoweDir));
    }

    public static writeOverridesFile(): void {
        ZoweLogger.trace("ProfilesUtils.writeOverridesFile called.");
        const defaultImperativeJson = { overrides: { CredentialManager: globals.ZOWE_CLI_SCM } };
        const settingsFile = path.join(getZoweDir(), "settings", "imperative.json");
        let fileContent: string;
        try {
            fileContent = fs.readFileSync(settingsFile, { encoding: "utf-8" });
        } catch (error) {
            ZoweLogger.debug(localize("writeOverridesFile.readFile.error", "Reading imperative.json failed. Will try to create file."));
        }
        let settings: any;
        if (fileContent) {
            try {
                settings = JSON.parse(fileContent);
                ZoweLogger.debug(localize("writeOverridesFile.readFile", "Reading imperative.json Credential Manager.\n {0}", fileContent));
            } catch (err) {
                if (err instanceof Error) {
                    const errorMsg = localize(
                        "writeOverridesFile.jsonParse.error",
                        "Failed to parse JSON file {0}. Will try to re-create the file.",
                        settingsFile
                    );
                    ZoweLogger.error(errorMsg);
                    ZoweLogger.debug(fileContent.toString());
                    settings = { ...defaultImperativeJson };
                    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), {
                        encoding: "utf-8",
                        flag: "w",
                    });
                }
            }
            if (settings?.overrides?.CredentialManager === globals.PROFILE_SECURITY) {
                return;
            }
            if (!settings?.overrides?.CredentialManager) {
                settings = { ...defaultImperativeJson, ...settings };
            }
        } else {
            settings = { ...defaultImperativeJson };
        }
        settings.overrides.CredentialManager = globals.PROFILE_SECURITY;
        const newData = JSON.stringify(settings, null, 2);
        ZoweLogger.debug(
            localize("writeOverridesFile.updateFile", "Updating imperative.json Credential Manager to {0}.\n{1}", globals.PROFILE_SECURITY, newData)
        );
        fs.writeFileSync(settingsFile, newData, {
            encoding: "utf-8",
            flag: "w",
        });
    }

    public static async initializeZoweProfiles(): Promise<void> {
        ZoweLogger.trace("ProfilesUtils.initializeZoweProfiles called.");
        try {
            await ProfilesUtils.initializeZoweFolder();
        } catch (err) {
            ZoweLogger.error(err);
            Gui.errorMessage(localize("initializeZoweFolder.error", "Failed to initialize Zowe folder: {0}", err.message));
        }

        try {
            await ProfilesUtils.readConfigFromDisk();
            ZoweLogger.info(localize("initializeZoweProfiles.success", "Zowe Profiles initialized successfully."));
        } catch (err) {
            if (err instanceof imperative.ImperativeError) {
                await errorHandling(err, undefined, err.mDetails.causeErrors);
            } else {
                ZoweLogger.error(err);
                ZoweExplorerExtender.showZoweConfigError(err.message);
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
                ZoweLogger.info(localize("initializeZoweTempFolder.success", "Zowe Temp folder initialized successfully."));
            }
        } catch (err) {
            ZoweLogger.error(err);
            Gui.errorMessage(err.message);
        }
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
    throw new Error(localize("getProfile.notTreeItem", "Tree Item is not a Zowe Explorer item."));
}
