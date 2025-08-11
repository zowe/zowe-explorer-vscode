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
import {
    imperative,
    Gui,
    MainframeInteraction,
    IZoweTreeNode,
    ErrorCorrelator,
    ZoweExplorerApiType,
    AuthHandler,
    ZoweExplorerZosmf,
    AuthPromptParams,
} from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";
// import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";

interface ErrorContext {
    apiType?: ZoweExplorerApiType;
    profile?: string | imperative.IProfileLoaded;
    scenario?: string;
    [key: string]: any;
}

export class AuthUtils {
    /**
     * Checks if a profile's authentication was previously cancelled and, if so,
     * re-prompts the user to authenticate. This should be called before any
     * remote operation that requires authentication.
     * @param profile The profile to check.
     * @throws {AuthCancelledError} If the user cancels the re-authentication prompt.
     */
    public static async reauthenticateIfCancelled(profile: imperative.IProfileLoaded): Promise<void> {
        if (AuthHandler.isProfileLocked(profile) && AuthHandler.wasAuthCancelled(profile)) {
            try {
                // The original error doesn't matter here, we just need to trigger the flow.
                await this.handleProfileAuthOnError(
                    new Error("User cancelled previous authentication, but a new action requires authentication. Prompting user to re-authenticate."),
                    profile
                );
            } catch (err) {
                // If handleProfileAuthOnError fails (e.g., user cancels again),
                // we should propagate that failure.
                throw err;
            }
        }
    }

    /**
     * Locks the profile if an authentication error has occurred (prevents further requests in filesystem until unlocked).
     * If the error is not an authentication error, the profile is unlocked for further use.
     *
     * @param err {Error} The error that occurred
     * @param profile {imperative.IProfileLoaded} The profile used when the error occurred
     * @throws {AuthCancelledError} When the user cancels the authentication prompt
     */
    public static async handleProfileAuthOnError(err: Error, profile?: imperative.IProfileLoaded): Promise<void> {
        if (
            (err instanceof imperative.ImperativeError &&
                profile != null &&
                (Number(err.errorCode) === imperative.RestConstants.HTTP_STATUS_401 ||
                    err.message.includes("All configured authentication methods failed"))) ||
            err.message.includes("HTTP(S) status 401")
        ) {
            if (!(await AuthHandler.shouldHandleAuthError(profile.name))) {
                ZoweLogger.debug(`[AuthUtils] Skipping authentication prompt for profile ${profile.name} due to debouncing`);
                return;
            }

            // In the case of an authentication error, find a more user-friendly error message if available.
            const errorCorrelation = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, err, {
                templateArgs: {
                    profileName: profile.name,
                },
            });

            const sessTypeFromProf = AuthUtils.sessTypeFromProfile(profile);
            const authOpts: AuthPromptParams = {
                authMethods: Constants.PROFILES_CACHE,
                imperativeError: err as unknown as imperative.ImperativeError,
                isUsingTokenAuth:
                    sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_TOKEN || sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_BEARER,
                errorCorrelation,
                throwErrorOnCancel: true,
            };
            // If the profile is already locked, prompt the user to re-authenticate.
            if (AuthHandler.isProfileLocked(profile)) {
                await AuthHandler.waitForUnlock(profile);
            } else {
                // Lock the profile and prompt the user for authentication by providing login/credential prompt options.
                // This may throw AuthCancelledError if the user cancels the authentication prompt
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
            if (imperativeError.toString().includes("hostname") && !imperativeError.toString().includes("protocol")) {
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
                const addDet = imperativeError.mDetails.additionalDetails;
                if (addDet.includes("Auth order:") && addDet.includes("Auth type:") && addDet.includes("Available creds:")) {
                    const additionalDetails = [addDet.split("\n")[0]];
                    additionalDetails.push(
                        vscode.l10n.t({
                            message: "Your available creds: {0}",
                            args: [addDet.match(/\nAvailable creds:(.*?)(?=\n|$)/)?.[1]?.trim()],
                            comment: ["Available credentials"],
                        })
                    );
                    additionalDetails.push(
                        vscode.l10n.t({
                            message: "Your authOrder: {0}",
                            args: [addDet.match(/\nAuth order:(.*?)(?=\n|$)/)?.[1]?.trim()],
                            comment: ["Authentication order"],
                        })
                    );
                    additionalDetails.push(
                        vscode.l10n.t({
                            message: "Selected auth type: {0}",
                            args: [addDet.match(/\nAuth type:(.*?)(?=\n|$)/)?.[1]?.trim()],
                            comment: ["Selected authentication method"],
                        })
                    );
                    imperativeError.mDetails.additionalDetails = additionalDetails.join("\n");
                }

                const sessTypeFromProf = AuthUtils.sessTypeFromProfile(profile);
                return await AuthHandler.promptForAuthentication(profile, {
                    authMethods: Constants.PROFILES_CACHE,
                    imperativeError,
                    isUsingTokenAuth:
                        sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_TOKEN ||
                        sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_BEARER,
                    errorCorrelation,
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
     * @returns true if the user logged in, false if they dismissed the prompt or the login failed
     */
    public static async promptForSsoLogin(profileName: string): Promise<boolean> {
        const selection = await Gui.showMessage(
            vscode.l10n.t({
                message:
                    "Your connection is no longer active for profile '{0}'. Please log in to an authentication service to restore the connection.",
                args: [profileName],
                comment: ["Profile name"],
            }),
            { items: [vscode.l10n.t("Log in to Authentication Service")], vsCodeOpts: { modal: true } }
        );
        if (selection) {
            if (await Constants.PROFILES_CACHE.ssoLogin(null, profileName)) {
                AuthHandler.unlockProfile(profileName);
                return true;
            }
        }
        return false;
    }

    public static updateNodeToolTip(sessionNode: IZoweTreeNode, profile: imperative.IProfileLoaded): void {
        const iSessFromProf = AuthUtils.getSessFromProfile(profile).ISession;
        imperative.AuthOrder.addCredsToSession(iSessFromProf, ZoweExplorerZosmf.CommonApi.getCommandArgs(profile));

        let usingBasicAuth: boolean = false;
        let usingTokenAuth: boolean = false;
        let usingCertAuth: boolean = false;
        switch (iSessFromProf.type) {
            case imperative.SessConstants.AUTH_TYPE_BASIC:
                usingBasicAuth = true;
                break;
            case imperative.SessConstants.AUTH_TYPE_TOKEN:
            case imperative.SessConstants.AUTH_TYPE_BEARER:
                usingTokenAuth = true;
                break;
            case imperative.SessConstants.AUTH_TYPE_CERT_PEM:
                usingCertAuth = true;
                break;
        }
        const tooltipValue: string | undefined =
            sessionNode.tooltip instanceof vscode.MarkdownString ? sessionNode.tooltip.value : sessionNode.tooltip;
        const toolTipList = tooltipValue ? tooltipValue.split("\n") : [];

        const authMethodIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Auth Method: ")));
        if (authMethodIndex === -1) {
            switch (true) {
                case Boolean(usingTokenAuth): {
                    toolTipList.push(`${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Token-based Authentication")}`);
                    break;
                }
                case Boolean(usingBasicAuth): {
                    toolTipList.push(`${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Basic Authentication")}`);
                    toolTipList.push(`${vscode.l10n.t("User: ")}${profile.profile.user as string}`);
                    break;
                }
                case Boolean(usingCertAuth): {
                    toolTipList.push(`${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Certificate Authentication")}`);
                    break;
                }
                default: {
                    toolTipList.push(`${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Unknown")}`);
                    break;
                }
            }
        } else {
            switch (true) {
                case Boolean(usingTokenAuth): {
                    toolTipList[authMethodIndex] = `${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Token-based Authentication")}`;
                    break;
                }
                case Boolean(usingBasicAuth): {
                    toolTipList[authMethodIndex] = `${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Basic Authentication")}`;
                    const userIDIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("User: ")));
                    if (userIDIndex !== -1) {
                        toolTipList[userIDIndex] = `${vscode.l10n.t("User: ")}${profile.profile.user as string}`;
                    } else {
                        toolTipList.splice(authMethodIndex + 1, 0, `${vscode.l10n.t("User: ")}${profile.profile.user as string}`);
                    }
                    break;
                }
                case Boolean(usingCertAuth): {
                    toolTipList[authMethodIndex] = `${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Certificate Authentication")}`;
                    break;
                }
                default: {
                    toolTipList[authMethodIndex] = `${vscode.l10n.t("Auth Method: ")}${vscode.l10n.t("Unknown")}`;
                    const patternIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Pattern: ")));
                    if (patternIndex !== -1) {
                        toolTipList.splice(patternIndex, 1);
                    }
                    const pathIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Path: ")));
                    if (pathIndex !== -1) {
                        toolTipList.splice(pathIndex, 1);
                    }
                    const searchCriteriaIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Owner: ")));
                    if (searchCriteriaIndex !== -1) {
                        toolTipList.splice(searchCriteriaIndex, 1);
                    }
                    const jobIdIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("JobId: ")));
                    if (jobIdIndex !== -1) {
                        toolTipList.splice(jobIdIndex, 1);
                    }
                }
            }
            if (!usingBasicAuth) {
                const userIDIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("User: ")));
                if (userIDIndex !== -1) {
                    toolTipList.splice(userIDIndex, 1);
                }
            }
        }

        if (usingTokenAuth || usingBasicAuth || usingCertAuth) {
            switch (true) {
                case Boolean(sessionNode.fullPath): {
                    const pathIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Path: ")));
                    if (pathIndex === -1) {
                        toolTipList.push(`${vscode.l10n.t("Path: ")}${sessionNode.fullPath}`);
                    } else {
                        toolTipList[pathIndex] = `${vscode.l10n.t("Path: ")}${sessionNode.fullPath}`;
                    }
                    break;
                }
                case `${sessionNode.description}`.includes(vscode.l10n.t("Owner: ")): {
                    const jobIdIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("JobId: ")));
                    if (jobIdIndex !== -1) {
                        toolTipList.splice(jobIdIndex, 1);
                    }
                    const searchCriteriaIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Owner: ")));
                    if (searchCriteriaIndex === -1) {
                        toolTipList.push(sessionNode.description as string);
                    } else {
                        toolTipList[searchCriteriaIndex] = sessionNode.description as string;
                    }
                    break;
                }
                case `${sessionNode.description}`.includes(vscode.l10n.t("JobId: ")): {
                    const searchFilterIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Owner: ")));
                    if (searchFilterIndex !== -1) {
                        toolTipList.splice(searchFilterIndex, 1);
                    }
                    const jobIdIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("JobId: ")));
                    if (jobIdIndex === -1) {
                        toolTipList.push(sessionNode.description as string);
                    } else {
                        toolTipList[jobIdIndex] = sessionNode.description as string;
                    }
                    break;
                }
            }
        }
        sessionNode.tooltip = toolTipList.join("\n");
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
        try {
            const commonApi = getCommonApi(profile);
            this.updateNodeToolTip(sessionNode, profile);
            sessionNode.setSessionToChoice(commonApi.getSession());
        } catch (err) {
            if (err instanceof Error) {
                // API is not yet registered, or building the session failed for this profile
                ZoweLogger.error(`Error syncing session for ${profileName}: ${err.message}`);
            }
            return;
        }
        if (nodeToRefresh) {
            nodeToRefresh.dirty = true;
            void nodeToRefresh.getChildren().then(() => SharedTreeProviders.getProviderForNode(nodeToRefresh).refreshElement(nodeToRefresh));
        }
    }

    /**
     * Function that returns the session associated with the specified profile.
     *
     * @param {imperative.IProfileLoaded} profile The profile to be inspected.
     *
     * @returns {imperative.SessConstants.AUTH_TYPE_CHOICES}
     *      The session type for the session associated with the specified profile
     */
    public static getSessFromProfile(profile: imperative.IProfileLoaded): imperative.Session {
        if (!profile) {
            throw new Error("Supplied profile was null or undefined.");
        }
        return new ZoweExplorerZosmf.CommonApi(profile).getSession();
        // return ZoweExplorerApiRegister.getInstance().getCommonApi(profile).getSession();
    }

    /**
     * Function that returns the session type for the session associated with the specified profile.
     *
     * @param {imperative.IProfileLoaded} profile The profile to be inspected.
     *
     * @returns {imperative.SessConstants.AUTH_TYPE_CHOICES}
     *      The session type for the session associated with the specified profile
     */
    public static sessTypeFromProfile(profile: imperative.IProfileLoaded): imperative.SessConstants.AUTH_TYPE_CHOICES {
        if (!profile) {
            return imperative.SessConstants.AUTH_TYPE_NONE;
        }
        return AuthUtils.sessTypeFromSession(AuthUtils.getSessFromProfile(profile));
    }

    /**
     * Function that returns the session type for the specified session.
     *
     * @param {imperative.Session} session The session to be inspected.
     *
     * @returns {imperative.SessConstants.AUTH_TYPE_CHOICES}
     *      The session type for the specified session
     */
    public static sessTypeFromSession(session: imperative.Session): imperative.SessConstants.AUTH_TYPE_CHOICES {
        if (session?.ISession?.type) {
            return session.ISession.type;
        }
        return imperative.SessConstants.AUTH_TYPE_NONE;
    }

    /**
     * Function that checks whether a profile is using basic authentication
     * @deprecated Use sessTypeFromProfile and/or sessTypeFromSession, which will adhere to authOrder.
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
     * @deprecated Use sessTypeFromProfile and/or sessTypeFromSession, which will adhere to authOrder.
     * @param profileName the name of the profile to check
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static async isUsingTokenAuth(profileName: string): Promise<boolean> {
        const baseProfile = Constants.PROFILES_CACHE.getDefaultProfile("base");
        const props = await Constants.PROFILES_CACHE.getPropsForProfile(profileName, false);
        const baseProps = await Constants.PROFILES_CACHE.getPropsForProfile(baseProfile?.name, false);
        return AuthHandler.isUsingTokenAuth(props, baseProps);
    }
}
