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
import { imperative, Gui, MainframeInteraction, IZoweTreeNode, ErrorCorrelator, ZoweExplorerApiType, CorrelatedError } from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";

interface ErrorContext {
    apiType?: ZoweExplorerApiType;
    profile?: string | imperative.IProfileLoaded;
    scenario?: string;
    [key: string]: any;
}

export class AuthUtils {
    public static async promptForAuthentication(
        imperativeError: imperative.ImperativeError,
        profile: imperative.IProfileLoaded,
        correlation?: CorrelatedError
    ): Promise<boolean> {
        if (imperativeError.mDetails.additionalDetails) {
            const tokenError: string = imperativeError.mDetails.additionalDetails;
            const isTokenAuth = await AuthUtils.isUsingTokenAuth(profile.name);

            if (tokenError.includes("Token is not valid or expired.") || isTokenAuth) {
                const message = vscode.l10n.t("Log in to Authentication Service");
                const userResp = await Gui.showMessage(correlation?.message ?? imperativeError.message, {
                    items: [message],
                    vsCodeOpts: { modal: true },
                });
                return userResp === message ? Constants.PROFILES_CACHE.ssoLogin(null, profile.name) : false;
            }
        }
        const checkCredsButton = vscode.l10n.t("Update Credentials");
        const creds = await Gui.errorMessage(correlation?.message ?? imperativeError.message, {
            items: [checkCredsButton],
            vsCodeOpts: { modal: true },
        }).then(async (selection) => {
            if (selection !== checkCredsButton) {
                return;
            }
            return Constants.PROFILES_CACHE.promptCredentials(profile, true);
        });
        return creds != null ? true : false;
    }

    public static promptForAuthError(err: Error, profile: imperative.IProfileLoaded): void {
        if (
            err instanceof imperative.ImperativeError &&
            profile != null &&
            (Number(err.errorCode) === imperative.RestConstants.HTTP_STATUS_401 ||
                err.message.includes("All configured authentication methods failed"))
        ) {
            void AuthUtils.promptForAuthentication(err, profile).catch((error) => error instanceof Error && ZoweLogger.error(error.message));
        }
    }

    public static async openConfigForMissingHostname(profile: imperative.IProfileLoaded): Promise<void> {
        const mProfileInfo = await Constants.PROFILES_CACHE.getProfileInfo();
        Gui.errorMessage(vscode.l10n.t("Required parameter 'host' must not be blank."));
        const profAllAttrs = mProfileInfo.getAllProfiles();
        for (const prof of profAllAttrs) {
            if (prof.profName === profile?.name) {
                const filePath = prof.profLoc.osLoc[0];
                await Constants.PROFILES_CACHE.openConfigFile(filePath);
            }
        }
    }

    /*************************************************************************************************************
     * Error Handling
     * @param {errorDetails} - string or error object
     * @param {label} - additional information such as profile name, credentials, messageID etc
     * @param {moreInfo} - additional/customized error messages
     *************************************************************************************************************/
    public static async errorHandling(errorDetails: Error | string, moreInfo?: ErrorContext): Promise<boolean> {
        // Use util.inspect instead of JSON.stringify to handle circular references
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        ZoweLogger.error(`${errorDetails.toString()}\n` + util.inspect({ errorDetails, ...{ ...moreInfo, profile: undefined } }, { depth: null }));

        const profile = typeof moreInfo.profile === "string" ? Constants.PROFILES_CACHE.loadNamedProfile(moreInfo.profile) : moreInfo?.profile;
        const correlation = ErrorCorrelator.getInstance().correlateError(moreInfo?.apiType ?? ZoweExplorerApiType.All, errorDetails, {
            profileType: profile?.type,
            ...Object.keys(moreInfo).reduce((all, k) => (typeof moreInfo[k] === "string" ? { ...all, [k]: moreInfo[k] } : all), {}),
            templateArgs: { profileName: profile?.name ?? "", ...moreInfo?.templateArgs },
        });
        if (typeof errorDetails !== "string" && (errorDetails as imperative.ImperativeError)?.mDetails !== undefined) {
            const imperativeError: imperative.ImperativeError = errorDetails as imperative.ImperativeError;
            const httpErrorCode = Number(imperativeError.mDetails.errorCode);
            // open config file for missing hostname error
            if (imperativeError.toString().includes("hostname")) {
                await AuthUtils.openConfigForMissingHostname(profile);
                return false;
            } else if (
                profile != null &&
                (httpErrorCode === imperative.RestConstants.HTTP_STATUS_401 ||
                    imperativeError.message.includes("All configured authentication methods failed"))
            ) {
                return AuthUtils.promptForAuthentication(imperativeError, profile, correlation);
            }
        }
        if (errorDetails.toString().includes("Could not find profile")) {
            return false;
        }

        void ErrorCorrelator.getInstance().displayCorrelatedError(correlation, { templateArgs: { profileName: profile?.name ?? "" } });
        return false;
    }

    /**
     * Prompts user to log in to authentication service.
     * @param profileName The name of the profile used to log in
     */
    public static promptForSsoLogin(profileName: string): Thenable<string> {
        return Gui.showMessage(
            vscode.l10n.t({
                message:
                    "Your connection is no longer active for profile '{0}'. Please log in to an authentication service to restore the connection.",
                args: [profileName],
                comment: ["Profile name"],
            }),
            { items: [vscode.l10n.t("Log in to Authentication Service")], vsCodeOpts: { modal: true } }
        ).then(async (selection) => {
            if (selection) {
                await Constants.PROFILES_CACHE.ssoLogin(null, profileName);
            }
            return selection;
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
