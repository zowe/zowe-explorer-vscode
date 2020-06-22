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
import * as globals from "./globals";
import * as os from "os";
import * as path from "path";
import { ISession, IProfile, ImperativeConfig } from "@zowe/imperative";
import { Profiles } from "./Profiles";

import * as nls from "vscode-nls";
import { IZoweTreeNode } from "./api/IZoweTreeNode";
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/*************************************************************************************************************
 * Error Handling
 * @param {errorDetails} error.mDetails
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export function errorHandling(errorDetails: any, label?: string, moreInfo?: string) {
    let httpErrCode = null;
    const errMsg = localize("errorHandling.invalid.credentials", "Invalid Credentials. Please ensure the username and password for {0} are valid or this may lead to a lock-out.", label);

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
    }

    switch(httpErrCode) {
        // tslint:disable-next-line: no-magic-numbers
        case 401:
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" ["));
            }

            if (globals.ISTHEIA) {
                vscode.window.showErrorMessage(errMsg);
                Profiles.getInstance().promptCredentials(label.trim());
            } else {
                vscode.window.showErrorMessage(errMsg, "Check Credentials").then(async (selection) => {
                    if (selection) {
                        await Profiles.getInstance().promptCredentials(label.trim(), true);
                    }
                });
            }
            break;
        default:
            if (moreInfo === undefined) {
                moreInfo = "Error:";
            }
            vscode.window.showErrorMessage(moreInfo + " " +  errorDetails);
            break;
    }
    return;
}

/*************************************************************************************************************
 * Refresh Profile and Session
 * @param {sessNode} IZoweTreeNode
 *************************************************************************************************************/
export function refreshTree(sessNode: IZoweTreeNode) {
    const allProf = Profiles.getInstance().getProfiles();
    for (const profNode of allProf) {
        if (sessNode.getProfileName() === profNode.name) {
            setProfile(sessNode, profNode.profile);
            const SessionProfile = profNode.profile as ISession;
            if (sessNode.getSession().ISession !== SessionProfile) {
                setSession(sessNode, SessionProfile);
            }
        }
    }
    sessNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

}

export async function resolveQuickPickHelper(quickpick: vscode.QuickPick<vscode.QuickPickItem>): Promise<vscode.QuickPickItem | undefined> {
    return new Promise<vscode.QuickPickItem | undefined>(
        (c) => quickpick.onDidAccept(() => c(quickpick.activeItems[0])));
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements vscode.QuickPickItem {
    constructor(private text: string, private desc?: string) { }
    get label(): string { return this.text; }
    get description(): string { if (this.desc) { return this.desc; } else { return ""; } }
    get alwaysShow(): boolean { return false; }
}

// tslint:disable-next-line: max-classes-per-file
export class FilterDescriptor implements vscode.QuickPickItem {
    constructor(private text: string) { }
    get label(): string { return this.text; }
    get description(): string { return ""; }
    get alwaysShow(): boolean { return true; }
}

/**
 * Function to retrieve the home directory. In the situation Imperative has
 * not initialized it we mock a default value.
 */
export function getZoweDir(): string {
    ImperativeConfig.instance.loadedConfig = {
        defaultHome: path.join(os.homedir(), ".zowe"),
        envVariablePrefix: "ZOWE"
    };
    return ImperativeConfig.instance.cliHome;
}

/**
 * Function to update the node profile information
 */
export async function setProfile(node: IZoweTreeNode, profile: IProfile) {
    node.getProfile().profile= profile;
}

/**
 * Function to update the node session information
 */
export async function setSession(node: IZoweTreeNode, session: ISession) {
    node.getSession().ISession.user = session.user;
    node.getSession().ISession.password = session.password;
    node.getSession().ISession.hostname = session.hostname;
    node.getSession().ISession.port = session.port;
    node.getSession().ISession.base64EncodedAuth = session.base64EncodedAuth;
    node.getSession().ISession.rejectUnauthorized = session.rejectUnauthorized;
}
