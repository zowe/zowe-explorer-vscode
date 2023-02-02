/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

// Generic utility functions (not node type related). See ./src/shared/utils.ts

import * as vscode from "vscode";
import * as globals from "../globals";
import * as path from "path";
import * as fs from "fs";
import { getSecurityModules, IZoweTreeNode, ZoweTreeNode, getZoweDir, getFullPath, Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import * as nls from "vscode-nls";
import { imperative, getImperativeConfig } from "@zowe/cli";
import { ZoweExplorerExtender } from "../ZoweExplorerExtender";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/*************************************************************************************************************
 * Error Handling
 * @param {errorDetails} error.mDetails
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export async function errorHandling(errorDetails: any, label?: string, moreInfo?: string) {
    let httpErrCode = null;
    const errMsg = localize(
        "errorHandling.invalid.credentials",
        "Invalid Credentials. Please ensure the username and password for {0} are valid or this may lead to a lock-out.",
        label
    );
    const errToken = localize(
        "errorHandling.invalid.token",
        "Your connection is no longer active. Please log in to an authentication service to restore the connection."
    );
    globals.LOG.error(`${errorDetails}\n` + JSON.stringify({ errorDetails, label, moreInfo }));

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
        // open config file for missing hostname error
        const msg = errorDetails.toString();
        if (msg.includes("hostname")) {
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
        }
    }

    switch (httpErrCode) {
        case imperative.RestConstants.HTTP_STATUS_401:
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" [")).trim();
            }

            if (errorDetails.mDetails.additionalDetails) {
                const tokenError: string = errorDetails.mDetails.additionalDetails;
                if (tokenError.includes("Token is not valid or expired.")) {
                    if (isTheia()) {
                        Gui.errorMessage(errToken).then(async () => {
                            await Profiles.getInstance().ssoLogin(null, label);
                        });
                    } else {
                        const message = localize("errorHandling.authentication.login", "Log in to Authentication Service");
                        Gui.showMessage(errToken, { items: [message] }).then(async (selection) => {
                            if (selection) {
                                await Profiles.getInstance().ssoLogin(null, label);
                            }
                        });
                    }
                    break;
                }
            }

            if (isTheia()) {
                Gui.errorMessage(errMsg);
            } else {
                const checkCredsButton = localize("errorHandling.checkCredentials.button", "Check Credentials");
                await Gui.errorMessage(errMsg, {
                    items: [checkCredsButton],
                    vsCodeOpts: { modal: true },
                }).then(async (selection) => {
                    if (selection === checkCredsButton) {
                        await Profiles.getInstance().promptCredentials(label.trim(), true);
                    } else {
                        Gui.showMessage(localize("errorHandling.checkCredentials.cancelled", "Operation Cancelled"));
                    }
                });
            }
            break;
        default:
            if (moreInfo === undefined) {
                moreInfo = errorDetails.toString().includes("Error") ? "" : "Error:";
            }
            Gui.errorMessage(moreInfo + " " + errorDetails);
            break;
    }
    return;
}

// TODO: remove this second occurence
export function isTheia(): boolean {
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
type SessionForProfile = (profile: imperative.IProfileLoaded) => imperative.Session;
export const syncSessionNode =
    (profiles: Profiles) =>
    (getSessionForProfile: SessionForProfile) =>
    async (sessionNode: IZoweTreeNode): Promise<void> => {
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        const profileType = sessionNode.getProfile().type;
        const profileName = sessionNode.getProfileName();

        let profile: imperative.IProfileLoaded;
        try {
            profile = Profiles.getInstance().loadNamedProfile(profileName, profileType);
        } catch (e) {
            globals.LOG.warn(e);
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
    constructor(public filterItem: IFilterItem) {}
    get label(): string {
        const icon = this.filterItem.icon ? this.filterItem.icon + " " : null;
        return (icon ?? "") + this.filterItem.text;
    }
    get description(): string {
        if (this.filterItem.description) {
            return this.filterItem.description;
        } else {
            return "";
        }
    }
    get alwaysShow(): boolean {
        return this.filterItem.show;
    }
}

export class FilterDescriptor implements vscode.QuickPickItem {
    constructor(private text: string) {}
    get label(): string {
        return this.text;
    }
    get description(): string {
        return "";
    }
    get alwaysShow(): boolean {
        return true;
    }
}

/**
 * Function to update the node profile information
 */
export async function setProfile(node: IZoweTreeNode, profile: imperative.IProfile) {
    node.getProfile().profile = profile;
}

/**
 * Function to update the node session information
 */
export async function setSession(node: IZoweTreeNode, combinedSessionProfile: imperative.IProfile) {
    const sessionNode = node.getSession();
    for (const prop of Object.keys(combinedSessionProfile)) {
        if (prop === "host") {
            sessionNode.ISession.hostname = combinedSessionProfile[prop];
        } else {
            sessionNode.ISession[prop] = combinedSessionProfile[prop];
        }
    }
}

export async function getProfileInfo(envTheia: boolean): Promise<imperative.ProfileInfo> {
    const mProfileInfo = new imperative.ProfileInfo("zowe", {
        requireKeytar: () => getSecurityModules("keytar", envTheia),
    });
    return mProfileInfo;
}

export function getProfile(node: vscode.TreeItem) {
    if (node instanceof ZoweTreeNode) {
        return (node as ZoweTreeNode).getProfile();
    }
    throw new Error(localize("getProfile.notTreeItem", "Tree Item is not a Zowe Explorer item."));
}

export async function readConfigFromDisk() {
    let rootPath: string;
    try {
        const mProfileInfo = await getProfileInfo(globals.ISTHEIA);
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir(), projectDir: getFullPath(rootPath) });
        } else {
            await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir(), projectDir: undefined });
        }
        if (mProfileInfo.usingTeamConfig) {
            globals.setConfigPath(rootPath);
            globals.LOG.debug('Zowe Explorer is using the team configuration file "%s"', mProfileInfo.getTeamConfig().configName);
            const layers = mProfileInfo.getTeamConfig().layers || [];
            const layerSummary = layers.map(
                (config: imperative.IConfigLayer) =>
                    `Path: ${config.path}: ${
                        config.exists
                            ? "Found, with the following defaults:" + JSON.stringify(config.properties?.defaults || "Undefined default")
                            : "Not available"
                    } `
            );
            globals.LOG.debug("Summary of team configuration files considered for Zowe Explorer: %s", JSON.stringify(layerSummary));
        }
    } catch (error) {
        throw new Error(error);
    }
}

export async function promptCredentials(node: IZoweTreeNode) {
    const mProfileInfo = await Profiles.getInstance().getProfileInfo();
    if (mProfileInfo.usingTeamConfig && !mProfileInfo.getTeamConfig().properties.autoStore) {
        Gui.showMessage(localize("zowe.promptCredentials.notSupported", '"Update Credentials" operation not supported when "autoStore" is false'));
        return;
    }
    let profileName: string;
    if (node == null) {
        // prompt for profile
        profileName = await Gui.showInputBox({
            placeHolder: localize("createNewConnection.option.prompt.profileName.placeholder", "Connection Name"),
            prompt: localize("createNewConnection.option.prompt.profileName", "Enter a name for the connection."),
            ignoreFocusOut: true,
        });

        if (profileName === undefined) {
            Gui.showMessage(localize("createNewConnection.undefined.passWord", "Operation Cancelled"));
            return;
        }
        profileName = profileName.trim();
    } else {
        profileName = node.getProfile().name;
    }

    const creds = await Profiles.getInstance().promptCredentials(profileName, true);

    if (creds != null) {
        Gui.showMessage(localize("promptCredentials.updatedCredentials", "Credentials for {0} were successfully updated", profileName));
    }
}

export async function initializeZoweFolder(): Promise<void> {
    // ensure the Secure Credentials Enabled value is read
    // set globals.PROFILE_SECURITY value accordingly
    await globals.setGlobalSecurityValue();
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
    writeOverridesFile();
    // If not using team config, ensure that the ~/.zowe/profiles directory
    // exists with appropriate types within
    if (!imperative.ImperativeConfig.instance.config?.exists) {
        await imperative.CliProfileManager.initialize({
            configuration: getImperativeConfig().profiles,
            profileRootDirectory: path.join(zoweDir, "profiles"),
        });
    }
}

export function writeOverridesFile() {
    let fd: number;
    let fileContent: string;
    const settingsFile = path.join(getZoweDir(), "settings", "imperative.json");
    try {
        fd = fs.openSync(settingsFile, "r+");
        fileContent = fs.readFileSync(fd, "utf-8");
    } catch {
        // If reading the file failed because it does not exist, then create it
        // This should never fail, unless file system is read-only or the file
        // was created by another process after first openSync call
        fd = fs.openSync(settingsFile, "wx");
    }
    try {
        let settings: any;
        if (fileContent) {
            settings = JSON.parse(fileContent);
            if (settings && settings?.overrides && settings?.overrides?.CredentialManager !== globals.PROFILE_SECURITY) {
                settings.overrides.CredentialManager = globals.PROFILE_SECURITY;
            } else {
                return;
            }
        } else {
            settings = { overrides: { CredentialManager: globals.PROFILE_SECURITY } };
        }
        fileContent = JSON.stringify(settings, null, 2);
        fs.writeSync(fd, fileContent, 0, "utf-8");
    } finally {
        fs.closeSync(fd);
    }
}

export async function initializeZoweProfiles(): Promise<void> {
    try {
        await initializeZoweFolder();
        await readConfigFromDisk();
    } catch (err) {
        globals.LOG.error(err);
        ZoweExplorerExtender.showZoweConfigError(err.message);
    }

    if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    }
}
