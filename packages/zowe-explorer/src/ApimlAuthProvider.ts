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

import {
    authentication,
    AuthenticationProvider,
    AuthenticationProviderAuthenticationSessionsChangeEvent,
    AuthenticationSession,
    Disposable,
    Event,
    EventEmitter,
} from "vscode";
import * as zowe from "@zowe/cli";
import { Profiles } from "./Profiles";

export class ApimlAuthenticationProvider implements AuthenticationProvider, Disposable {
    private _disposable: Disposable;
    private _sessionChangeEmitter = new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    private _sessionCache: AuthenticationSession[];
    private static mInstance: ApimlAuthenticationProvider;

    public static readonly authId = "zowe.apiml";
    public static readonly authName = "Zowe API ML";

    private constructor() {
        this._disposable = Disposable.from(
            authentication.registerAuthenticationProvider(ApimlAuthenticationProvider.authId, ApimlAuthenticationProvider.authName, this, {
                supportsMultipleAccounts: false,
            })
        );
    }

    public static get instance(): ApimlAuthenticationProvider {
        if (this.mInstance == null) {
            this.mInstance = new ApimlAuthenticationProvider();
        }
        return this.mInstance;
    }

    public async checkForUpdates(): Promise<void> {
        const oldSessions: AuthenticationSession[] = JSON.parse(JSON.stringify(this._sessionCache));
        const newSessions = await this.getSessions();
        const added: AuthenticationSession[] = [];
        const removed: AuthenticationSession[] = [];
        const changed: AuthenticationSession[] = [];
        for (const sessionId of new Set([...oldSessions.map((s) => s.id), ...newSessions.map((s) => s.id)])) {
            const oldSession = oldSessions.find((s) => s.id === sessionId);
            const newSession = newSessions.find((s) => s.id === sessionId);
            if (oldSession == null && newSession != null) {
                added.push(newSession);
            } else if (oldSession != null && newSession == null) {
                removed.push(newSession);
            } else if (oldSession.accessToken !== newSession.accessToken) {
                changed.push(newSession);
            }
        }
        if (added || removed || changed) {
            this._sessionChangeEmitter.fire({ added, removed, changed });
        }
    }

    public async login(profile: zowe.imperative.IProfileLoaded): Promise<[string, string]> {
        const apimlProfile = await Profiles.getInstance().findApimlProfile(profile);
        if (apimlProfile != null) {
            const session = await this.createSession([apimlProfile.name], profile.profile);
            const loginTokenType = session.account.id.slice(session.account.id.indexOf(zowe.imperative.SessConstants.TOKEN_TYPE_APIML));
            return [loginTokenType, session.accessToken];
        }
    }

    public async logout(profile: zowe.imperative.IProfileLoaded): Promise<void> {
        const apimlProfile = await Profiles.getInstance().findApimlProfile(profile);
        const apimlSession = this._sessionCache.find((session) => session.scopes[0] === apimlProfile.name);
        if (apimlSession != null) {
            await this.removeSession(apimlSession.id, profile.profile);
        }
    }

    public get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
        return this._sessionChangeEmitter.event;
    }

    public async getSessions(_scopes?: string[]): Promise<readonly AuthenticationSession[]> {
        await this.updateSessionCache();
        return this._sessionCache;
    }

    public async createSession(scopes: string[], loginProps?: zowe.imperative.IProfile): Promise<AuthenticationSession> {
        const profileName = scopes[0];
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile(profileName);
        const creds = await profiles.loginCredentialPrompt();
        if (!creds) {
            return Promise.reject();
        }
        const loginSession = new zowe.imperative.Session({
            hostname: (loginProps ?? baseProfile.profile).host,
            port: (loginProps ?? baseProfile.profile).port,
            user: creds[0],
            password: creds[1],
            rejectUnauthorized: (loginProps ?? baseProfile.profile).rejectUnauthorized,
            tokenType: zowe.imperative.SessConstants.TOKEN_TYPE_APIML,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        const profileProps: zowe.imperative.IProfile = {
            tokenType: loginSession.ISession.tokenType,
            tokenValue: await zowe.Login.apimlLogin(loginSession),
        };
        await profiles.updateBaseProfileFileLogin(baseProfile, profileProps);
        const baseIndex = profiles.allProfiles.findIndex((profile) => profile.name === baseProfile.name);
        profiles.allProfiles[baseIndex] = { ...baseProfile, profile: { ...baseProfile.profile, ...profileProps } };
        const session = this.buildSession(profiles.allProfiles[baseIndex]);
        if (this._sessionCache.find((s) => s.id === session.id) == null) {
            this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
        } else {
            this._sessionChangeEmitter.fire({ added: [], removed: [], changed: [session] });
        }
        return session;
    }

    public async removeSession(sessionId: string, logoutProps?: zowe.imperative.IProfile): Promise<void> {
        const session = this._sessionCache.find((s) => s.id === sessionId);
        const profileName = session.scopes[0];
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile(profileName);
        const logoutSession = new zowe.imperative.Session({
            hostname: (logoutProps ?? baseProfile.profile).host,
            port: (logoutProps ?? baseProfile.profile).port,
            rejectUnauthorized: (logoutProps ?? baseProfile.profile).rejectUnauthorized,
            tokenType: (logoutProps ?? baseProfile.profile).tokenType,
            tokenValue: (logoutProps ?? baseProfile.profile).tokenValue,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        try {
            await zowe.Logout.apimlLogout(logoutSession);
        } catch (err) {
            if (
                !(err instanceof zowe.imperative.ImperativeError) ||
                (err.errorCode as unknown as number) !== zowe.imperative.RestConstants.HTTP_STATUS_401
            ) {
                throw err;
            }
        }
        await profiles.updateBaseProfileFileLogout(baseProfile);
        this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
    }

    public dispose(): void {
        this._disposable.dispose();
    }

    private buildSession(profile: zowe.imperative.IProfileLoaded): AuthenticationSession {
        return {
            id: `${profile.name}_${profile.type}`,
            accessToken: profile.profile.tokenValue,
            account: {
                label: profile.name,
                id: `${profile.name}_${profile.profile.tokenType as string}`,
            },
            scopes: [profile.name],
        };
    }

    private async updateSessionCache(): Promise<void> {
        this._sessionCache = [];
        for (const baseProfile of await Profiles.getInstance().fetchAllProfilesByType("base")) {
            if (baseProfile.profile.tokenType?.startsWith(zowe.imperative.SessConstants.TOKEN_TYPE_APIML) && baseProfile.profile.tokenValue != null) {
                this._sessionCache.push(this.buildSession(baseProfile));
            }
        }
    }
}
