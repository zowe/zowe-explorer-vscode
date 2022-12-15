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

import * as semver from "semver";
import * as vscode from "vscode";
import { ProfilesCache, ZoweExplorerApi } from "../profiles";
import { imperative } from "@zowe/cli";
import { IPromptCredentialsOptions, IPromptUserPassOptions } from "./doc/IPromptCredentials";
import { Gui } from "../globals/Gui";

/**
 * Collection of utility functions for writing Zowe Explorer VS Code extensions.
 */
export class ZoweVsCodeExtension {
    private static profilesCache = new ProfilesCache(
        imperative.Logger.getAppLogger(),
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    );

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
            const zoweExplorerVersion =
                ((zoweExplorerApi.packageJSON as Record<string, unknown>).version as string) || "15.0.0";
            if (requiredVersion && semver.valid(requiredVersion) && !semver.gte(zoweExplorerVersion, requiredVersion)) {
                return undefined;
            }
            return zoweExplorerApi.exports as ZoweExplorerApi.IApiRegisterClient;
        }
        return undefined;
    }

    /**
     * Helper function to standardize the way we ask the user for credentials
     * @param options Set of options to use when prompting for credentials
     * @returns Instance of imperative.IProfileLoaded containing information about the updated profile
     * @deprecated
     */
    public static async promptCredentials(options: IPromptCredentialsOptions): Promise<imperative.IProfileLoaded> {
        const loadProfile = await this.profilesCache.getLoadedProfConfig(options.sessionName.trim());
        if (loadProfile == null) return undefined;
        const loadSession = loadProfile.profile as imperative.ISession;

        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, ...options });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            const upd = { profileName: loadProfile.name, profileType: loadProfile.type };
            await (
                await this.profilesCache.getProfileInfo()
            ).updateProperty({ ...upd, property: "user", value: creds[0], setSecure: options.secure });
            await (
                await this.profilesCache.getProfileInfo()
            ).updateProperty({ ...upd, property: "password", value: creds[1], setSecure: options.secure });

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
        const cache = this.profilesCache;
        const profInfo = await cache.getProfileInfo();
        options.secure = options.secure ? options.secure : profInfo.isSecured();
        const loadProfile = await cache.getLoadedProfConfig(options.sessionName);
        const loadSession = loadProfile.profile as imperative.ISession;
        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, ...options });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            let saved = true;
            if (!options.secure && !profInfo.usingTeamConfig) {
                saved = await ZoweVsCodeExtension.saveCredentials(loadProfile);
            }

            if (saved || profInfo.usingTeamConfig) {
                // v1 write changes to the file, v2 autoStore value determines if written to file
                const upd = { profileName: loadProfile.name, profileType: loadProfile.type };
                await profInfo.updateProperty({ ...upd, property: "user", value: creds[0], setSecure: options.secure });
                await profInfo.updateProperty({
                    ...upd,
                    property: "password",
                    value: creds[1],
                    setSecure: options.secure,
                });
            }
            await cache.refresh(apiRegister);

            return loadProfile;
        }
        return undefined;
    }

    private static async saveCredentials(profile: imperative.IProfileLoaded): Promise<boolean> {
        let save = false;
        const saveButton = "Save Credentials";
        const message = `Save entered credentials in plain text for future use with profile ${profile.name}?\nSaving credentials will update the local information file.`;
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
                prompt: "Enter the user name for the connection. Leave blank to not store.",
                ignoreFocusOut: true,
                value: newUser,
                ...(options.userInputBoxOptions ?? {}),
            });
            options.session.user = newUser;
        }
        if (!newUser || (options.rePrompt && newUser === "")) {
            return undefined;
        }

        let newPass = options.session.password;
        if (!newPass || options.rePrompt) {
            newPass = await Gui.showInputBox({
                placeHolder: "Password",
                prompt: "Enter the password for the connection. Leave blank to not store.",
                password: true,
                ignoreFocusOut: true,
                value: newPass,
                ...(options.passwordInputBoxOptions ?? {}),
            });
            options.session.password = newPass;
        }
        if (!newPass || (options.rePrompt && newPass === "")) {
            return undefined;
        }

        return [newUser.trim(), newPass.trim()];
    }
}
