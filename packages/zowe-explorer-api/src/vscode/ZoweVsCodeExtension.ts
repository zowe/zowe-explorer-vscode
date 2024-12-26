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

import * as semver from "semver";
import * as vscode from "vscode";
import { ProfilesCache, ZoweExplorerApi } from "../profiles";
import { Login, Logout, imperative } from "@zowe/cli";
import { IPromptCertificateOptions, IPromptCredentialsOptions, IPromptUserPassOptions } from "./doc/IPromptCredentials";
import { Gui } from "../globals/Gui";
import { MessageSeverity, IZoweLogger } from "../logger";
import { IZoweNodeType } from "../tree/IZoweTreeNode";

/**
 * Collection of utility functions for writing Zowe Explorer VS Code extensions.
 */
export class ZoweVsCodeExtension {
    private static get profilesCache(): ProfilesCache {
        return new ProfilesCache(imperative.Logger.getAppLogger(), vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    }

    /**
     * Get custom logging path if one is defined in VS Code settings.
     */
    public static get customLoggingPath(): string | undefined {
        return vscode.workspace.getConfiguration("zowe").get("files.logsFolder.path") || undefined;
    }

    /**
     * @param {string} [requiredVersion] Optional semver string specifying the minimal required version
     *           of Zowe Explorer that needs to be installed for the API to be usable to the client.
     * @returns an initialized instance `ZoweExplorerApi.IApiRegisterClient` that extenders can use
     *          to access the Zowe Explorer APIs or `undefined`. Also `undefined` if requiredVersion
     *          is larger than the version of Zowe Explorer found.
     */
    public static getZoweExplorerApi(requiredVersion?: string): ZoweExplorerApi.IApiRegisterClient {
        const zoweExplorerApi = vscode.extensions.getExtension("Zowe.vscode-extension-for-zowe");
        if (zoweExplorerApi?.exports) {
            const zoweExplorerVersion = (zoweExplorerApi.packageJSON as Record<string, unknown>).version as string;
            if (requiredVersion && semver.valid(requiredVersion) && zoweExplorerVersion && !semver.gte(zoweExplorerVersion, requiredVersion)) {
                return undefined;
            }
            return zoweExplorerApi.exports as ZoweExplorerApi.IApiRegisterClient;
        }
        return undefined;
    }

    /**
     * Show a message within VS Code dialog, and log it to an Imperative logger
     * @param message The message to display
     * @param severity The level of severity for the message (see `MessageSeverity`)
     * @param logger The IZoweLogger object for logging the message
     *
     * @deprecated Please use `Gui.showMessage` instead
     */
    public static showVsCodeMessage(message: string, severity: MessageSeverity, logger: IZoweLogger): void {
        void Gui.showMessage(message, { severity: severity, logger: logger });
    }

    /**
     * Opens an input box dialog within VS Code, given an options object
     * @param inputBoxOptions The options for this input box
     *
     * @deprecated Use `Gui.showInputBox` instead
     */
    public static inputBox(inputBoxOptions: vscode.InputBoxOptions): Promise<string> {
        return Promise.resolve(Gui.showInputBox(inputBoxOptions));
    }

    /**
     * Helper function to standardize the way we ask the user for credentials
     * @param options Set of options to use when prompting for credentials
     * @returns Instance of imperative.IProfileLoaded containing information about the updated profile
     * @deprecated
     */
    public static async promptCredentials(options: IPromptCredentialsOptions): Promise<imperative.IProfileLoaded> {
        const profilesCache = ZoweVsCodeExtension.profilesCache;
        const loadProfile = options.sessionName ? await profilesCache.getLoadedProfConfig(options.sessionName.trim()) : options.profile;
        if (loadProfile == null) {
            return undefined;
        }
        const loadSession = loadProfile.profile as imperative.ISession;

        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, ...options });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            const upd = { profileName: loadProfile?.name, profileType: loadProfile.type };
            await (await profilesCache.getProfileInfo()).updateProperty({ ...upd, property: "user", value: creds[0], setSecure: options.secure });
            await (await profilesCache.getProfileInfo()).updateProperty({ ...upd, property: "password", value: creds[1], setSecure: options.secure });

            return loadProfile;
        }
        return undefined;
    }

    /**
     * Helper function to standardize the way we ask the user for credentials that updates ProfilesCache
     * @param options Set of options to use when prompting for credentials
     * @returns Instance of imperative.IProfileLoaded containing information about the updated profile
     */
    public static async updateCredentials(
        options: IPromptCredentialsOptions,
        apiRegister: ZoweExplorerApi.IApiRegisterClient
    ): Promise<imperative.IProfileLoaded> {
        const cache = options.zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const profInfo = await cache.getProfileInfo();
        const setSecure = options.secure ?? profInfo.isSecured();

        if (options.profile == null && options.sessionName == null) {
            return undefined;
        }

        const loadProfile = options.sessionName ? await cache.getLoadedProfConfig(options.sessionName) : options.profile;
        const loadSession = loadProfile?.profile as imperative.ISession;

        if (loadProfile == null || loadSession == null) {
            return undefined;
        }
        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, ...options });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            let shouldSave = true;
            if (!setSecure && !profInfo.usingTeamConfig) {
                shouldSave = await ZoweVsCodeExtension.saveCredentials(loadProfile);
            }

            if (shouldSave || profInfo.usingTeamConfig) {
                // v1 write changes to the file, v2 autoStore value determines if written to file
                const upd = { profileName: loadProfile?.name, profileType: loadProfile.type };
                await profInfo.updateProperty({ ...upd, property: "user", value: creds[0], setSecure });
                await profInfo.updateProperty({ ...upd, property: "password", value: creds[1], setSecure });
            }
            await cache.refresh(apiRegister);

            return loadProfile;
        }
        return undefined;
    }

    /**
     * Trigger a login operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be stored in the service profile.
     *  If there is no API registered for the profile type, this method defaults the login behavior to that of the APIML.
     * @param serviceProfile Profile to be used for login pursposes (either the name of the IProfileLoaded instance)
     * @param loginTokenType The tokenType value for compatibility purposes
     * @param node The node for compatibility purposes
     * @param zeRegister The ZoweExplorerApiRegister instance for compatibility purposes
     * @param zeProfiles The Zowe Explorer "Profiles.ts" instance for compatibility purposes
     */
    public static async loginWithBaseProfile(
        serviceProfile: string | imperative.IProfileLoaded,
        loginTokenType?: string,
        node?: IZoweNodeType,
        zeRegister?: ZoweExplorerApi.IApiRegisterClient, // ZoweExplorerApiRegister
        zeProfiles?: ProfilesCache // Profiles extends ProfilesCache
    ): Promise<boolean> {
        const cache: ProfilesCache = zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const baseProfile = await cache.fetchBaseProfile();
        if (baseProfile == null) {
            return false;
        }
        if (typeof serviceProfile === "string") {
            serviceProfile = await ZoweVsCodeExtension.getServiceProfileForAuthPurposes(cache, serviceProfile);
        }
        const tokenType =
            serviceProfile.profile.tokenType ?? baseProfile.profile.tokenType ?? loginTokenType ?? imperative.SessConstants.TOKEN_TYPE_APIML;
        const updSession = new imperative.Session({
            hostname: serviceProfile.profile.host,
            port: serviceProfile.profile.port,
            user: "Username",
            password: "Password",
            rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
            tokenType,
            type: imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        delete updSession.ISession.user;
        delete updSession.ISession.password;
        const qpItems: vscode.QuickPickItem[] = [
            { label: "$(account) User and Password", description: "Log in with basic authentication" },
            { label: "$(note) Certificate", description: "Log in with PEM format certificate file" },
        ];
        const response = await Gui.showQuickPick(qpItems, { placeHolder: "Select an authentication method for obtaining token" });
        if (response === qpItems[0]) {
            const creds = await ZoweVsCodeExtension.promptUserPass({ session: updSession.ISession, rePrompt: true });
            if (!creds) {
                return false;
            }
            updSession.ISession.base64EncodedAuth = imperative.AbstractSession.getBase64Auth(creds[0], creds[1]);
        } else if (response === qpItems[1]) {
            try {
                await ZoweVsCodeExtension.promptCertificate({ profile: serviceProfile, session: updSession.ISession, rePrompt: true });
            } catch (err) {
                return false;
            }
            delete updSession.ISession.base64EncodedAuth;
            updSession.ISession.storeCookie = true;
            updSession.ISession.type = imperative.SessConstants.AUTH_TYPE_CERT_PEM;
        } else {
            return false;
        }

        const loginToken = await (zeRegister?.getCommonApi(serviceProfile).login ?? Login.apimlLogin)(updSession);
        const updBaseProfile: imperative.IProfile = {
            tokenType: updSession.ISession.tokenType ?? tokenType,
            tokenValue: loginToken,
        };
        updSession.ISession.storeCookie = false;

        // A simplified version of the ProfilesCache.shouldRemoveTokenFromProfile `private` method
        const connOk =
            // First check whether or not the base profile already does not have a token
            baseProfile.profile.tokenType == null || // If base profile does not have a token, we assume it's OK to store the token value there
            // The above will ensure that Zowe Explorer behaves the same way as the Zowe CLI in regards to using the base profile for token auth.

            // If base profile already has a token type stored, then we check whether or not the connection details are the same
            (serviceProfile.profile.host === baseProfile.profile.host && serviceProfile.profile.port === baseProfile.profile.port);
        // If the connection details do not match, then we MUST forcefully store the token in the service profile
        const profileToUpdate = connOk ? baseProfile : serviceProfile;

        await cache.updateBaseProfileFileLogin(profileToUpdate, updBaseProfile, !connOk);
        serviceProfile.profile = { ...serviceProfile.profile, ...updBaseProfile };
        cache.updateProfilesArrays(serviceProfile, node);
        return true;
    }

    /**
     * Trigger a logout operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be removed from the service profile.
     *  If there is no API registered for the profile type, this method defaults the logout behavior to that of the APIML.
     * @param serviceProfile Profile to be used for logout pursposes (either the name of the IProfileLoaded instance)
     * @param zeRegister The ZoweExplorerApiRegister instance for compatibility purposes
     * @param zeProfiles The Zowe Explorer "Profiles.ts" instance for compatibility purposes
     */
    public static async logoutWithBaseProfile(
        serviceProfile: string | imperative.IProfileLoaded,
        zeRegister?: ZoweExplorerApi.IApiRegisterClient, // ZoweExplorerApiRegister
        zeProfiles?: ProfilesCache // Profiles extends ProfilesCache
    ): Promise<void> {
        const cache: ProfilesCache = zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const baseProfile = await cache.fetchBaseProfile();
        if (baseProfile) {
            if (typeof serviceProfile === "string") {
                serviceProfile = await ZoweVsCodeExtension.getServiceProfileForAuthPurposes(cache, serviceProfile);
            }
            const tokenType =
                serviceProfile.profile.tokenType ??
                baseProfile.profile.tokenType ??
                zeRegister?.getCommonApi(serviceProfile).getTokenTypeName() ??
                imperative.SessConstants.TOKEN_TYPE_APIML;
            const updSession = new imperative.Session({
                hostname: serviceProfile.profile.host,
                port: serviceProfile.profile.port,
                rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                tokenType: tokenType,
                tokenValue: serviceProfile.profile.tokenValue ?? baseProfile.profile.tokenValue,
                type: imperative.SessConstants.AUTH_TYPE_TOKEN,
            });
            await (zeRegister?.getCommonApi(serviceProfile).logout ?? Logout.apimlLogout)(updSession);

            const connOk = serviceProfile.profile.host === baseProfile.profile.host && serviceProfile.profile.port === baseProfile.profile.port;
            await cache.updateBaseProfileFileLogout(connOk ? baseProfile : serviceProfile);
            serviceProfile.profile = { ...serviceProfile.profile, tokenType: undefined, tokenValue: undefined };
            cache.updateProfilesArrays(serviceProfile);
        }
    }

    /**
     * This method is intended to be used for authentication (login, logout) purposes
     *
     * Note: this method calls the `getProfileInfo()` which creates a new instance of the ProfileInfo APIs
     *          Be aware that any non-saved updates will not be considered here.
     * @param cache Instance of ProfilesCache already initialized
     * @param profile Name of the profile to load the IProfileLoaded
     * @returns The IProfileLoaded with tokenType and tokenValue
     */
    private static async getServiceProfileForAuthPurposes(cache: ProfilesCache, profile: string): Promise<imperative.IProfileLoaded> {
        const profInfo = await cache.getProfileInfo();
        const profAttrs = profInfo.getAllProfiles().find((prof) => prof.profName === profile);
        if (profAttrs?.profType != null) {
            cache.registerCustomProfilesType(profAttrs.profType);
        }
        await cache.refresh(ZoweVsCodeExtension.getZoweExplorerApi());
        const retP = cache.loadNamedProfile(profile);
        const _props = profInfo.mergeArgsForProfile(profAttrs, { getSecureVals: true }).knownArgs;
        retP.profile.tokenType = retP.profile.tokenType ?? _props.find((p) => p.argName === "tokenType")?.argValue;
        retP.profile.tokenValue = retP.profile.tokenValue ?? _props.find((p) => p.argName === "tokenValue")?.argValue;
        return retP;
    }

    private static async saveCredentials(profile: imperative.IProfileLoaded): Promise<boolean> {
        let save = false;
        const saveButton = "Save Credentials";
        const message = [
            `Save entered credentials in plain text for future use with profile ${profile.name}?`,
            "Saving credentials will update the local information file.",
        ].join("\n");
        await Gui.showMessage(message, { items: [saveButton], vsCodeOpts: { modal: true } }).then((selection) => {
            if (selection) {
                save = true;
            }
        });
        return save;
    }

    private static async promptUserPass(options: IPromptUserPassOptions): Promise<string[] | undefined> {
        let newUser = options.session.user;
        if (!newUser || options.rePrompt) {
            newUser = await Gui.showInputBox({
                placeHolder: "User Name",
                prompt: "Enter the user name for the connection." + (options.rePrompt ? "" : " Leave blank to not store."),
                ignoreFocusOut: true,
                value: newUser,
                ...(options.userInputBoxOptions ?? {}),
            });
        }
        if (!newUser || (options.rePrompt && newUser === "")) {
            return undefined;
        }

        let newPass = options.session.password;
        if (!newPass || options.rePrompt) {
            newPass = await Gui.showInputBox({
                placeHolder: "Password",
                prompt: "Enter the password for the connection." + (options.rePrompt ? "" : " Leave blank to not store."),
                password: true,
                ignoreFocusOut: true,
                value: newPass,
                ...(options.passwordInputBoxOptions ?? {}),
            });
        }
        if (!newPass || (options.rePrompt && newPass === "")) {
            return undefined;
        }

        options.session.user = newUser.trim();
        options.session.password = newPass.trim();
        return [options.session.user, options.session.password];
    }

    private static async promptCertificate(options: IPromptCertificateOptions): Promise<void> {
        const response: { cert: string; certKey: string } = await vscode.commands.executeCommand("zowe.certificateWizard", {
            cert: options.profile.profile.certFile,
            certKey: options.profile.profile.certKeyFile,
            dialogOpts: { ...(options.openDialogOptions ?? {}), canSelectFiles: true, canSelectFolders: false, canSelectMany: false },
        });
        options.session.cert = response.cert;
        options.session.certKey = response.certKey;
    }
}
