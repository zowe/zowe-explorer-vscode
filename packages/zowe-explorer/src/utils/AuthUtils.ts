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
import { imperative, Gui, MainframeInteraction, IZoweTreeNode, ErrorCorrelator, ZoweExplorerApiType, AuthHandler } from "@zowe/zowe-explorer-api";
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
    /**
     * Locks the profile if an authentication error has occurred (prevents further requests in filesystem until unlocked).
     * If the error is not an authentication error, the profile is unlocked for further use.
     *
     * @param err {Error} The error that occurred
     * @param profile {imperative.IProfileLoaded} The profile used when the error occurred
     */
    public static async handleProfileAuthOnError(err: Error, profile?: imperative.IProfileLoaded): Promise<void> {
        if (
            err instanceof imperative.ImperativeError &&
            profile != null &&
            (Number(err.errorCode) === imperative.RestConstants.HTTP_STATUS_401 ||
                err.message.includes("All configured authentication methods failed"))
        ) {
            if (!AuthHandler.shouldHandleAuthError(profile.name)) {
                ZoweLogger.debug(`[AuthUtils] Skipping authentication prompt for profile ${profile.name} due to debouncing`);
                return;
            }

            // In the case of an authentication error, find a more user-friendly error message if available.
            const errorCorrelation = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, err, {
                templateArgs: {
                    profileName: profile.name,
                },
            });

            const authOpts = {
                authMethods: Constants.PROFILES_CACHE,
                imperativeError: err,
                isUsingTokenAuth: await AuthUtils.isUsingTokenAuth(profile.name),
                errorCorrelation,
                useModal: true,
            };
            // If the profile is already locked, prompt the user to re-authenticate.
            if (AuthHandler.isProfileLocked(profile)) {
                await AuthHandler.waitForUnlock(profile);
            } else {
                // Lock the profile and prompt the user for authentication by providing login/credential prompt options.
                await AuthHandler.lockProfile(profile, authOpts);
            }
        } else if (profile != null && AuthHandler.isProfileLocked(profile)) {
            // Error doesn't satisfy criteria to continue holding the lock. Unlock the profile to allow further use
            AuthHandler.unlockProfile(profile);
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
        const errorCorrelation = ErrorCorrelator.getInstance().correlateError(moreInfo?.apiType ?? ZoweExplorerApiType.All, errorDetails, {
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
                if (!AuthHandler.isProfileLocked(profile)) {
                    await AuthHandler.lockProfile(profile);
                }
                return await AuthHandler.promptForAuthentication(profile, {
                    authMethods: Constants.PROFILES_CACHE,
                    imperativeError,
                    isUsingTokenAuth: await AuthUtils.isUsingTokenAuth(profile.name),
                    errorCorrelation,
                    useModal: true,
                });
            }
        }
        if (errorDetails.toString().includes("Could not find profile")) {
            return false;
        }

        void ErrorCorrelator.getInstance().displayCorrelatedError(errorCorrelation, { templateArgs: { profileName: profile?.name ?? "" } });
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
        const secureProps = await Constants.PROFILES_CACHE.getSecurePropsForProfile(profileName);
        const baseProfile = Constants.PROFILES_CACHE.getDefaultProfile("base");
        const baseSecureProps = await Constants.PROFILES_CACHE.getSecurePropsForProfile(baseProfile?.name);
        return AuthHandler.isUsingTokenAuth(secureProps, baseSecureProps);
    }
}
