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
 * @param {errorDetails} - string or error object
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export async function errorHandling(errorDetails: Error | string, label?: string, moreInfo?: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    globals.LOG.error(`${errorDetails}\n` + JSON.stringify({ errorDetails, label, moreInfo }));

    if (errorDetails instanceof imperative.ImperativeError && errorDetails.mDetails !== undefined) {
        const httpErrorCode = errorDetails.mDetails.errorCode as unknown as number;
        // open config file for missing hostname error
        if (errorDetails.toString().includes("hostname")) {
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
                "Invalid Credentials. Please ensure the username and password for {0} are valid or this may lead to a lock-out.",
                label
            );
            const errToken = localize(
                "errorHandling.invalid.token",
                "Your connection is no longer active. Please log in to an authentication service to restore the connection."
            );
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
                    return;
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

/**
 * Function to update the node profile information
 */
export function setProfile(node: IZoweTreeNode, profile: imperative.IProfile): void {
    node.getProfile().profile = profile;
}

/**
 * Function to update the node session information
 */
export function setSession(node: IZoweTreeNode, combinedSessionProfile: imperative.IProfile): void {
    const sessionNode = node.getSession();
    for (const prop of Object.keys(combinedSessionProfile)) {
        if (prop === "host") {
            sessionNode.ISession.hostname = combinedSessionProfile[prop];
        } else {
            sessionNode.ISession[prop] = combinedSessionProfile[prop];
        }
    }
}

export function getProfileInfo(envTheia: boolean): imperative.ProfileInfo {
    const mProfileInfo = new imperative.ProfileInfo("zowe", {
        requireKeytar: () => getSecurityModules("keytar", envTheia),
    });
    return mProfileInfo;
}

export function getProfile(node: vscode.TreeItem | ZoweTreeNode): imperative.IProfileLoaded {
    if (node instanceof ZoweTreeNode) {
        return node.getProfile();
    }
    throw new Error(localize("getProfile.notTreeItem", "Tree Item is not a Zowe Explorer item."));
}

export async function readConfigFromDisk(): Promise<void> {
    let rootPath: string;
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
}

export async function promptCredentials(node: IZoweTreeNode): Promise<void> {
    const mProfileInfo = await Profiles.getInstance().getProfileInfo();
    if (mProfileInfo.usingTeamConfig && !mProfileInfo.getTeamConfig().properties.autoStore) {
        Gui.showMessage(localize("zowe.promptCredentials.notSupported", '"Update Credentials" operation not supported when "autoStore" is false'));
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
        Gui.showMessage(
            localize(
                "promptCredentials.updatedCredentials",
                "Credentials for {0} were successfully updated",
                typeof profile === "string" ? profile : profile.name
            )
        );
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
    if (!fs.existsSync(path.join(settingsPath, "imperative.json"))) {
        writeOverridesFile();
    }
    // If not using team config, ensure that the ~/.zowe/profiles directory
    // exists with appropriate types within
    if (!imperative.ImperativeConfig.instance.config?.exists) {
        await imperative.CliProfileManager.initialize({
            configuration: getImperativeConfig().profiles,
            profileRootDirectory: path.join(zoweDir, "profiles"),
        });
    }
}

export function writeOverridesFile(): void {
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
            try {
                settings = JSON.parse(fileContent);
            } catch (err) {
                if (err instanceof Error) {
                    throw new Error(
                        localize("writeOverridesFile.jsonParseError", "Failed to parse JSON file {0}:", settingsFile) + " " + err.message
                    );
                }
            }
            if (settings && settings?.overrides && settings?.overrides?.CredentialManager !== globals.PROFILE_SECURITY) {
                settings.overrides.CredentialManager = globals.PROFILE_SECURITY;
            } else {
                return;
            }
        } else {
            settings = { overrides: { CredentialManager: globals.PROFILE_SECURITY } };
        }
        fileContent = JSON.stringify(settings, null, 2);
        fs.writeFileSync(fd, fileContent, "utf-8");
    } finally {
        fs.closeSync(fd);
    }
}

export async function initializeZoweProfiles(): Promise<void> {
    try {
        await initializeZoweFolder();
    } catch (err) {
        globals.LOG.error(err);
        Gui.errorMessage(localize(
            "initializeZoweFolder.error",
            "Failed to initialize Zowe folder: {0}",
            err.message
        ));
    }

    try {
        await readConfigFromDisk();
    } catch (err) {
        if (err instanceof imperative.ImperativeError) {
            errorHandling(err, undefined, err.details.causeErrors);
        } else {
            globals.LOG.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
        }
    }

    if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    }
}
