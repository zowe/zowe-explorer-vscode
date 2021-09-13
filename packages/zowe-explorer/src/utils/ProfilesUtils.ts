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
import * as os from "os";
import * as path from "path";
import { Session, IProfile, ImperativeConfig, IProfileLoaded } from "@zowe/imperative";
import { IZoweTreeNode } from "@zowe/zowe-explorer-api";
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
export const syncSessionNode = (profiles: Profiles) => (getSessionForProfile: SessionForProfile) => async (
    sessionNode: IZoweTreeNode
): Promise<void> => {
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

    const baseProfile = profiles.getBaseProfile();
    const combinedProfile = await profiles.getCombinedProfile(profile, baseProfile);
    const session = getSessionForProfile(combinedProfile);
    sessionNode.setSessionToChoice(session);
};

export async function resolveQuickPickHelper(
    quickpick: vscode.QuickPick<vscode.QuickPickItem>
): Promise<vscode.QuickPickItem | undefined> {
    return new Promise<vscode.QuickPickItem | undefined>((c) =>
        quickpick.onDidAccept(() => c(quickpick.activeItems[0]))
    );
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements vscode.QuickPickItem {
    constructor(private text: string, private desc?: string, private show?: boolean) {}
    get label(): string {
        return this.text;
    }
    get description(): string {
        if (this.desc) {
            return this.desc;
        } else {
            return "";
        }
    }
    get alwaysShow(): boolean {
        return this.show;
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
 * Function to retrieve the home directory. In the situation Imperative has
 * not initialized it we mock a default value.
 */
export function getZoweDir(): string {
    ImperativeConfig.instance.loadedConfig = {
        defaultHome: path.join(os.homedir(), ".zowe"),
        envVariablePrefix: "ZOWE",
    };
    return ImperativeConfig.instance.cliHome;
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
