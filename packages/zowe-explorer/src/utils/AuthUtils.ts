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
    AuthCancelledError,
} from "@zowe/zowe-explorer-api";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { SharedContext } from "../trees/shared/SharedContext";

interface ErrorContext {
    apiType?: ZoweExplorerApiType;
    profile?: string | imperative.IProfileLoaded;
    scenario?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export class AuthUtils {
    /**
     * Ensures that a profile is in a usable state by throwing if authentication was previously cancelled.
     * Callers should handle the error and trigger a fresh authentication prompt through {@link handleProfileAuthOnError}.
     * @param profile The profile to check.
     * @throws {AuthCancelledError} If the user has an unresolved authentication cancellation.
     */
    public static ensureAuthNotCancelled(profile: imperative.IProfileLoaded): void {
        if (AuthHandler.wasAuthCancelled(profile)) {
            throw new AuthCancelledError(profile.name, "User cancelled previous authentication");
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
    public static async handleProfileAuthOnError(err: Error, profile: imperative.IProfileLoaded): Promise<void> {
        if (
            (err instanceof imperative.ImperativeError &&
                (Number(err.errorCode) === imperative.RestConstants.HTTP_STATUS_401 ||
                    err.message.includes("All configured authentication methods failed"))) ||
            err.message.includes("HTTP(S) status 401")
        ) {
            // In the case of an authentication error, find a more user-friendly error message if available.
            const errorCorrelation = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, err, {
                templateArgs: {
                    profileName: profile.name,
                },
            });

            const sessTypeFromProf = AuthHandler.sessTypeFromProfile(profile);
            const authOpts: AuthPromptParams = {
                authMethods: Constants.PROFILES_CACHE,
                imperativeError: err as unknown as imperative.ImperativeError,
                isUsingTokenAuth:
                    sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_TOKEN ||
                    (await Constants.PROFILES_CACHE.profileHasSecureToken(profile)) ||
                    sessTypeFromProf === imperative.SessConstants.AUTH_TYPE_BEARER,
                errorCorrelation,
                throwErrorOnCancel: true,
            };
            AuthHandler.enableSequentialRequests(profile);
            await AuthHandler.getOrCreateAuthFlow(profile, authOpts);
        } else if (AuthHandler.isProfileLocked(profile)) {
            // Error doesn't satisfy criteria to continue holding the lock. Unlock the profile to allow further use
            AuthHandler.unlockProfile(profile);
        }
    }

    public static async retryRequest(profile: imperative.IProfileLoaded, callback: () => Promise<void>): Promise<void> {
        const executeWithRetries = async (): Promise<void> => {
            while (true) {
                try {
                    await AuthHandler.waitForUnlock(profile);
                    AuthUtils.ensureAuthNotCancelled(profile);
                    const callbackValue = await callback();
                    AuthHandler.disableSequentialRequests(profile);
                    return callbackValue;
                } catch (err) {
                    if (err instanceof Error) {
                        ZoweLogger.error(err.message);
                    }
                    if (
                        (err instanceof imperative.ImperativeError &&
                            (Number(err.errorCode) === imperative.RestConstants.HTTP_STATUS_401 ||
                                err.message.includes("All configured authentication methods failed"))) ||
                        err.message.includes("HTTP(S) status 401")
                    ) {
                        if (profile) {
                            const authPromptLock = AuthHandler.authPromptLocks.get(profile.name);
                            if (authPromptLock?.isLocked()) {
                                await authPromptLock.waitForUnlock();
                                if (AuthHandler.isProfileLocked(profile)) {
                                    throw vscode.FileSystemError.Unavailable();
                                }
                                continue;
                            }
                            await this.handleProfileAuthOnError(err, profile);
                        }
                    } else {
                        throw err;
                    }
                }
            }
        };

        return AuthHandler.runSequentialIfEnabled(profile, executeWithRetries);
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

        ZoweLogger.error(`${errorDetails.toString()}\n` + util.inspect({ errorDetails, ...{ ...moreInfo, profile: undefined } }, { depth: null }));

        const profile = typeof moreInfo?.profile === "string" ? Constants.PROFILES_CACHE.loadNamedProfile(moreInfo.profile) : moreInfo?.profile;
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
                if (addDet?.includes("Auth order:") && addDet?.includes("Auth type:") && addDet?.includes("Available creds:")) {
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

                const sessTypeFromProf = AuthHandler.sessTypeFromProfile(profile);
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
        const iSessFromProf = AuthHandler.getSessFromProfile(profile).ISession;
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
            const shouldPaginate =
                SharedContext.isDatasetNode(nodeToRefresh) &&
                SettingsConfig.getDirectValue<number>(Constants.SETTINGS_DATASETS_PER_PAGE, Constants.DEFAULT_ITEMS_PER_PAGE) > 0;
            void nodeToRefresh
                .getChildren(shouldPaginate)
                .then(() => SharedTreeProviders.getProviderForNode(nodeToRefresh).refreshElement(nodeToRefresh));
        }
    }

    /**
     * Function that checks whether a profile is using basic authentication
     * @deprecated Use AuthHandler.sessTypeFromProfile and/or AuthHandler.sessTypeFromSession, which will adhere to authOrder.
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
     * @deprecated Use AuthHandler.sessTypeFromProfile and/or AuthHandler.sessTypeFromSession, which will adhere to authOrder.
     * @param profileName the name of the profile to check
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static async isUsingTokenAuth(profileName: string): Promise<boolean> {
        const baseProfile = Constants.PROFILES_CACHE.getDefaultProfile("base");
        const props = await Constants.PROFILES_CACHE.getPropsForProfile(profileName, false);
        const baseProps = await Constants.PROFILES_CACHE.getPropsForProfile(baseProfile?.name, false);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        return AuthHandler.isUsingTokenAuth(props, baseProps);
    }
}
