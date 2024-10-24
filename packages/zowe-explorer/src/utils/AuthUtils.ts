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

import * as util from "util";
import * as vscode from "vscode";
import { imperative, Gui, MainframeInteraction, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";

export class AuthUtils {
    /*************************************************************************************************************
     * Error Handling
     * @param {errorDetails} - string or error object
     * @param {label} - additional information such as profile name, credentials, messageID etc
     * @param {moreInfo} - additional/customized error messages
     *************************************************************************************************************/
    public static async errorHandling(errorDetails: Error | string, label?: string, moreInfo?: string): Promise<boolean> {
        // Use util.inspect instead of JSON.stringify to handle circular references
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        ZoweLogger.error(`${errorDetails.toString()}\n` + util.inspect({ errorDetails, label, moreInfo }, { depth: null }));
        if (typeof errorDetails !== "string" && (errorDetails as imperative.ImperativeError)?.mDetails !== undefined) {
            const imperativeError: imperative.ImperativeError = errorDetails as imperative.ImperativeError;
            const httpErrorCode = Number(imperativeError.mDetails.errorCode);
            // open config file for missing hostname error
            if (imperativeError.toString().includes("hostname")) {
                const mProfileInfo = await Constants.PROFILES_CACHE.getProfileInfo();
                Gui.errorMessage(vscode.l10n.t("Required parameter 'host' must not be blank."));
                const profAllAttrs = mProfileInfo.getAllProfiles();
                for (const prof of profAllAttrs) {
                    if (prof.profName === label.trim()) {
                        const filePath = prof.profLoc.osLoc[0];
                        await Constants.PROFILES_CACHE.openConfigFile(filePath);
                        return false;
                    }
                }
            } else if (
                httpErrorCode === imperative.RestConstants.HTTP_STATUS_401 ||
                imperativeError.message.includes("All configured authentication methods failed")
            ) {
                const errMsg = vscode.l10n.t({
                    message:
                        "Invalid Credentials for profile '{0}'. Please ensure the username and password are valid or this may lead to a lock-out.",
                    args: [label],
                    comment: ["Label"],
                });
                if (label.includes("[")) {
                    label = label.substring(0, label.indexOf(" [")).trim();
                }

                if (imperativeError.mDetails.additionalDetails) {
                    const tokenError: string = imperativeError.mDetails.additionalDetails;
                    const isTokenAuth = await AuthUtils.isUsingTokenAuth(label);

                    if (tokenError.includes("Token is not valid or expired.") || isTokenAuth) {
                        AuthUtils.promptUserForSsoLogin(label);
                        return;
                    }
                }
                const checkCredsButton = vscode.l10n.t("Update Credentials");
                const creds = await Gui.errorMessage(errMsg, {
                    items: [checkCredsButton],
                    vsCodeOpts: { modal: true },
                }).then(async (selection) => {
                    if (selection !== checkCredsButton) {
                        Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                        return;
                    }
                    return Constants.PROFILES_CACHE.promptCredentials(label.trim(), true);
                });
                return creds != null ? true : false;
            }
        }
        if (errorDetails.toString().includes("Could not find profile")) {
            return false;
        }
        if (moreInfo === undefined) {
            moreInfo = errorDetails.toString().includes("Error") ? "" : "Error: ";
        } else {
            moreInfo += " ";
        }
        // Try to keep message readable since VS Code doesn't support newlines in error messages
        Gui.errorMessage(moreInfo + errorDetails.toString().replace(/\n/g, " | "));
        return false;
    }

    /**
     * Prompts user to log in to authentication service.
     * @param profileName The name of the profile used to log in
     */
    public static promptUserForSsoLogin(profileName: string): Thenable<void> {
        return Gui.showMessage(
            vscode.l10n.t({
                message:
                    "Your connection is no longer active for profile '{0}'. Please log in to an Authentication Service to restore the connection.",
                args: [profileName],
                comment: ["Profile name"],
            }),
            { items: [vscode.l10n.t("Log in to Authentication Service")], vsCodeOpts: { modal: true } }
        ).then(async (selection) => {
            if (selection) {
                await Constants.PROFILES_CACHE.ssoLogin(null, profileName);
            }
        });
    }

    /**
     * Function to update session and profile information in provided node
     * @param profiles is data source to find profiles
     * @param getSessionForProfile is a function to build a valid specific session based on provided profile
     * @param sessionNode is a tree node, containing session information
     */
    public static syncSessionNode(
        getCommonApi: (profile: imperative.IProfileLoaded) => MainframeInteraction.ICommon,
        sessionNode: IZoweTreeNode,
        nodeToRefresh?: IZoweTreeNode
    ): void {
        ZoweLogger.trace("ProfilesUtils.syncSessionNode called.");

        const profileType = sessionNode.getProfile()?.type;
        const profileName = sessionNode.getProfileName();

        let profile: imperative.IProfileLoaded;
        try {
            profile = Constants.PROFILES_CACHE.loadNamedProfile(profileName, profileType);
        } catch (e) {
            ZoweLogger.warn(e);
            return;
        }
        sessionNode.setProfileToChoice(profile);
        const session = getCommonApi(profile).getSession();
        sessionNode.setSessionToChoice(session);
        if (nodeToRefresh) {
            nodeToRefresh.dirty = true;
            void nodeToRefresh.getChildren().then(() => SharedTreeProviders.getProviderForNode(nodeToRefresh).refreshElement(nodeToRefresh));
        }
    }

    /**
     * Function that checks whether a profile is using basic authentication
     * @param profile
     * @returns {Promise<boolean>} a boolean representing whether basic auth is being used or not
     */
    public static isProfileUsingBasicAuth(profile: imperative.IProfileLoaded): boolean {
        const prof = profile.profile;
        // See https://github.com/zowe/zowe-explorer-vscode/issues/2664
        return prof.user != null && prof.password != null;
    }

    /**
     * Function that checks whether a profile is using token based authentication
     * @param profileName the name of the profile to check
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static async isUsingTokenAuth(profileName: string): Promise<boolean> {
        const secureProfileProps = await Constants.PROFILES_CACHE.getSecurePropsForProfile(profileName);
        const profileUsesBasicAuth = secureProfileProps.includes("user") && secureProfileProps.includes("password");
        if (secureProfileProps.includes("tokenValue")) {
            return secureProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
        }
        const baseProfile = Constants.PROFILES_CACHE.getDefaultProfile("base");
        const secureBaseProfileProps = await Constants.PROFILES_CACHE.getSecurePropsForProfile(baseProfile?.name);
        return secureBaseProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
    }
}
