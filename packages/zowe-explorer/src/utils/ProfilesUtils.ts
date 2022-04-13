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
import * as path from "path";
import * as globals from "../globals";
import { Session, IProfile, IProfileLoaded, ProfileInfo } from "@zowe/imperative";
import { getSecurityModules, IZoweTreeNode, ProfilesCache, ZoweTreeNode, getZoweDir } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import * as nls from "vscode-nls";

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

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
        // open config file for missing hostname error
        const msg = errorDetails.toString();
        if (msg.includes("hostname")) {
            if (ProfilesCache.getConfigInstance().usingTeamConfig) {
                vscode.window.showErrorMessage("Required parameter 'host' must not be blank");
                const currentProfile = ProfilesCache.getProfileFromConfig(label.trim());
                const filePath = currentProfile.profLoc.osLoc[0];
                await Profiles.getInstance().openConfigFile(filePath);
                return;
            }
        }
    }

    switch (httpErrCode) {
        // tslint:disable-next-line: no-magic-numbers
        case 401:
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" ["));
            }

            if (errorDetails.mDetails.additionalDetails) {
                const tokenError: string = errorDetails.mDetails.additionalDetails;
                if (tokenError.includes("Token is not valid or expired.")) {
                    if (isTheia()) {
                        vscode.window.showErrorMessage(errToken).then(async () => {
                            await Profiles.getInstance().ssoLogin(null, label);
                        });
                    } else {
                        const message = localize(
                            "ErrorHandling.authentication.login",
                            "Log in to Authentication Service"
                        );
                        vscode.window.showErrorMessage(errToken, message).then(async (selection) => {
                            if (selection) {
                                await Profiles.getInstance().ssoLogin(null, label);
                            }
                        });
                    }
                    break;
                }
            }

            if (isTheia()) {
                vscode.window.showErrorMessage(errMsg);
            } else {
                const checkCredsButton = localize("ErrorHandling.checkCredentials.button", "Check Credentials");
                await vscode.window
                    .showErrorMessage(errMsg, { modal: true }, ...[checkCredsButton])
                    .then(async (selection) => {
                        if (selection === checkCredsButton) {
                            await Profiles.getInstance().promptCredentials(label.trim(), true);
                        } else {
                            vscode.window.showInformationMessage(
                                localize("ErrorHandling.checkCredentials.cancelled", "Operation Cancelled")
                            );
                        }
                    });
            }
            break;
        default:
            if (moreInfo === undefined) {
                moreInfo = errorDetails.toString().includes("Error") ? "" : "Error:";
            }
            vscode.window.showErrorMessage(moreInfo + " " + errorDetails);
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
type SessionForProfile = (profile: IProfileLoaded) => Session;
export const syncSessionNode =
    (profiles: Profiles) =>
    (getSessionForProfile: SessionForProfile) =>
    async (sessionNode: IZoweTreeNode): Promise<void> => {
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        const profileType = sessionNode.getProfile().type;
        const profileName = sessionNode.getProfileName();

        let profile: IProfileLoaded;
        try {
            profile = profiles.loadNamedProfile(profileName, profileType);
        } catch (e) {
            return;
        }
        sessionNode.setProfileToChoice(profile);
        const session = getSessionForProfile(profile);
        sessionNode.setSessionToChoice(session);
    };

export async function resolveQuickPickHelper(
    quickpick: vscode.QuickPick<vscode.QuickPickItem>
): Promise<vscode.QuickPickItem | undefined> {
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
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements vscode.QuickPickItem {
    constructor(private filterItem: IFilterItem) {}
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

// tslint:disable-next-line: max-classes-per-file
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
export async function setProfile(node: IZoweTreeNode, profile: IProfile) {
    node.getProfile().profile = profile;
}

/**
 * Function to update the node session information
 */
export async function setSession(node: IZoweTreeNode, combinedSessionProfile: IProfile) {
    const sessionNode = node.getSession();
    for (const prop of Object.keys(combinedSessionProfile)) {
        if (prop === "host") {
            sessionNode.ISession.hostname = combinedSessionProfile[prop];
        } else {
            sessionNode.ISession[prop] = combinedSessionProfile[prop];
        }
    }
}

export async function getProfileInfo(envTheia: boolean): Promise<ProfileInfo> {
    const mProfileInfo = new ProfileInfo("zowe", {
        requireKeytar: () => getSecurityModules("keytar", envTheia),
    });
    ProfilesCache.createConfigInstance(mProfileInfo);
    return mProfileInfo;
}

export function getProfile(node: vscode.TreeItem) {
    if (node instanceof ZoweTreeNode) {
        return (node as ZoweTreeNode).getProfile();
    }
    throw new Error(localize("getProfile.notTreeItem", "Tree Item is not a Zowe Explorer item."));
}

export async function readConfigFromDisk() {
    const mProfileInfo = await getProfileInfo(globals.ISTHEIA);
    let rootPath;
    if (vscode.workspace.workspaceFolders) {
        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await mProfileInfo.readProfilesFromDisk({ projectDir: path.normalize(rootPath) });
    } else {
        await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir() });
    }
    if (mProfileInfo.usingTeamConfig) {
        globals.setConfigPath(rootPath);
    }
}
