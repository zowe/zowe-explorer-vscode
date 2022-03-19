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
import { IZoweLogger, MessageSeverityEnum } from "../logger/IZoweLogger";
import { ISession } from "@zowe/imperative";
import { IPromptCredentialsOptions, IPromptCredentialsReturnValue, IPromptUserPassOptions } from "./doc/IPromptCredentials";

/**
 * Collection of utility functions for writing Zowe Explorer VS Code extensions.
 */
export class ZoweVsCodeExtension {
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
     * Reveal an error in VSCode, and log the error to the Imperative log
     *
     */
    public static showVsCodeMessage(message: string, severity: MessageSeverityEnum, logger: IZoweLogger): void {
        logger.logImperativeMessage(message, severity);

        let errorMessage;
        switch (true) {
            case severity < 3:
                errorMessage = `${logger.getExtensionName()}: ${message}`;
                void vscode.window.showInformationMessage(errorMessage);
                break;
            case severity === 3:
                errorMessage = `${logger.getExtensionName()}: ${message}`;
                void vscode.window.showWarningMessage(errorMessage);
                break;
            case severity > 3:
                errorMessage = `${logger.getExtensionName()}: ${message}`;
                void vscode.window.showErrorMessage(errorMessage);
                break;
        }
    }

    public static async promptCredentials(options: IPromptCredentialsOptions): Promise<IPromptCredentialsReturnValue> {
        const loadProfile = ProfilesCache.getLoadedProfConfig(options.sessionName.trim());
        const loadSession = loadProfile.profile as ISession;

        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, rePrompt: options.rePrompt });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            const upd = { profileName: loadProfile.name, profileType: loadProfile.type };
            await ProfilesCache.getConfigInstance().updateProperty({ ...upd, property: "user", value: creds[0] });
            await ProfilesCache.getConfigInstance().updateProperty({ ...upd, property: "password", value: creds[1] });

            const updSession = ZoweVsCodeExtension.getZoweExplorerApi().getMvsApi(loadProfile).getSession();
            return {
                user: updSession.ISession.user,
                password: updSession.ISession.password,
                base64EncodedAuth: updSession.ISession.base64EncodedAuth,
                creds: true,
                profile: loadProfile
            };
        }
        return { creds: false, profile: loadProfile };
    }

    public static async inputBox(inputBoxOptions: vscode.InputBoxOptions): Promise<string> {
        if (!inputBoxOptions.validateInput) {
            // adding this for the theia breaking changes with input boxes
            inputBoxOptions.validateInput = (value) => null;
        }
        return vscode.window.showInputBox(inputBoxOptions);
    }

    private static async promptUserPass(options: IPromptUserPassOptions): Promise<string[] | undefined> {
        let newUser = options.session.user;
        if (!newUser || options.rePrompt) {
            newUser = await ZoweVsCodeExtension.inputBox({
                placeHolder: "User Name",
                prompt: "Enter the user name for the connection. Leave blank to not store.",
                ignoreFocusOut: true,
                value: newUser,
                ...(options.userInputBoxOptions ?? {})
            });
            options.session.user = newUser;
        }
        if (!newUser || (options.rePrompt && newUser === "")) {
            return undefined;
        }

        let newPass = options.session.password;
        if (!newPass || options.rePrompt) {
            newPass = await ZoweVsCodeExtension.inputBox({
                placeHolder: "Password",
                prompt: "Enter the password for the connection. Leave blank to not store.",
                password: true,
                ignoreFocusOut: true,
                value: newPass,
                ...(options.passwordInputBoxOptions ?? {})
            });
            options.session.password = newPass;
        }
        if (!newPass || (options.rePrompt && newPass === "")) {
            return undefined;
        }

        return [newUser.trim(), newPass.trim()];
    }
}
