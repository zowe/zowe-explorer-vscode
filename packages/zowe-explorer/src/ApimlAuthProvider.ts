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

/* eslint-disable */
import * as url from "url";
import {
    authentication,
    AuthenticationProvider,
    AuthenticationProviderAuthenticationSessionsChangeEvent,
    AuthenticationSession,
    Disposable,
    EventEmitter,
    window,
} from "vscode";
import * as zowe from "@zowe/cli";
import { Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "./Profiles";

export class ApimlAuthenticationProvider implements AuthenticationProvider, Disposable {
    private _disposable: Disposable;
    private _sessionChangeEmitter = new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    private static mInstance: ApimlAuthenticationProvider;

    public static readonly authId = "zoweapiml";
    public static readonly authName = "Zowe API ML";

    private constructor() {
        this._disposable = Disposable.from(
            authentication.registerAuthenticationProvider(ApimlAuthenticationProvider.authId, ApimlAuthenticationProvider.authName, this, {
                supportsMultipleAccounts: false,
            }),
            authentication.onDidChangeSessions(async (e) => {
                if (e.provider.id === ApimlAuthenticationProvider.authId) {
                    // TODO handle session added/removed/changed
                }
            })
        );
    }

    public static get instance(): ApimlAuthenticationProvider {
        if (this.mInstance == null) {
            this.mInstance = new ApimlAuthenticationProvider();
        }
        return this.mInstance;
    }

    public get onDidChangeSessions() {
        return this._sessionChangeEmitter.event;
    }

    public async getSessions(scopes?: string[]): Promise<readonly AuthenticationSession[]> {
        const allSessions: AuthenticationSession[] = [];
        const profiles = Profiles.getInstance();
        for (const baseProfile of await profiles.fetchAllProfilesByType("base")) {
            if (baseProfile.profile.tokenType === zowe.imperative.SessConstants.TOKEN_TYPE_APIML && baseProfile.profile.tokenValue != null) {
                allSessions.push({
                    id: `${baseProfile.name}_${baseProfile.type}`,
                    accessToken: baseProfile.profile.tokenValue,
                    account: {
                        label: baseProfile.name,
                        id: baseProfile.profile.tokenType,
                    },
                    scopes: [],
                });
            }
        }
        return allSessions;
    }

    public async createSession(scopes: string[]): Promise<AuthenticationSession> {
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile();
        const defaultApimlUrlStr = "https://" + (baseProfile.profile.host || "example.com") + ":" + (baseProfile.profile.port || 7554).toString();
        const apimlUrlStr = await Gui.showInputBox({
            prompt: "Enter the URL for your API ML instance:",
            value: defaultApimlUrlStr,
        });
        if (apimlUrlStr == null) {
            return Promise.reject();
        }
        const apimlUrl = new url.URL(apimlUrlStr);
        baseProfile.profile.host = apimlUrl.hostname;
        baseProfile.profile.port = parseInt(apimlUrl.port);
        const apimlUser = await Gui.showInputBox({
            prompt: "Enter the username for your API ML instance:",
            value: baseProfile.profile.user,
        });
        if (apimlUser == null) {
            return Promise.reject();
        }
        const apimlPass = await Gui.showInputBox({
            prompt: "Enter the password for your API ML instance:",
            value: baseProfile.profile.password,
            password: true,
        });
        if (apimlPass == null) {
            return Promise.reject();
        }
        const apimlSession = new zowe.imperative.Session({
            hostname: baseProfile.profile.host,
            port: baseProfile.profile.port,
            user: apimlUser,
            password: apimlPass,
            rejectUnauthorized: baseProfile.profile.rejectUnauthorized,
            tokenType: zowe.imperative.SessConstants.TOKEN_TYPE_APIML,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        const tokenValue = await zowe.Login.apimlLogin(apimlSession);
        baseProfile.profile.tokenType = apimlSession.ISession.tokenType;
        baseProfile.profile.tokenValue = apimlSession.ISession.tokenValue;
        try {
            const profInfo = await profiles.getProfileInfo();
            for (const property of Object.keys(baseProfile.profile)) {
                await profInfo.updateProperty({
                    profileType: baseProfile.type,
                    profileName: baseProfile.name,
                    property,
                    value: baseProfile.profile[property],
                });
            }
        } catch (err) {
            window.showErrorMessage(err.stack);
            return;
        }
        const session: AuthenticationSession = {
            id: `${baseProfile.name}_${baseProfile.type}`,
            accessToken: tokenValue,
            account: {
                label: baseProfile.name,
                id: apimlSession.ISession.tokenType,
            },
            scopes: [],
        };
        this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
        return session;
    }

    public async removeSession(sessionId: string): Promise<void> {
        const session = (await this.getSessions()).find((s) => s.id === sessionId);
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile();
        const apimlSession = new zowe.imperative.Session({
            hostname: baseProfile.profile.host,
            port: baseProfile.profile.port,
            rejectUnauthorized: baseProfile.profile.rejectUnauthorized,
            tokenType: baseProfile.profile.tokenType,
            tokenValue: baseProfile.profile.tokenValue,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        await zowe.Logout.apimlLogout(apimlSession);
        try {
            const profInfo = await profiles.getProfileInfo();
            await profInfo.updateProperty({
                profileType: baseProfile.type,
                profileName: baseProfile.name,
                property: "tokenValue",
                value: undefined,
            });
        } catch (err) {
            window.showErrorMessage(err.stack);
            return;
        }
        this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
    }

    public dispose() {
        this._disposable.dispose();
    }

    public async login(session: zowe.imperative.Session): Promise<string> {
        return "";
    }

    public async logout(session: zowe.imperative.Session): Promise<void> {}
}
