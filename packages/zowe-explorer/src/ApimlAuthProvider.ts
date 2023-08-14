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
        for (const sessionId of new Set(...oldSessions.map((session) => session.id), ...this._sessionCache.map((session) => session.id))) {
            const oldSession = oldSessions.find((session) => session.id === sessionId);
            const newSession = newSessions.find((session) => session.id === sessionId);
            if (oldSession == null && newSession != null) {
                added.push(newSession);
            } else if (oldSession != null && newSession == null) {
                removed.push(newSession);
            } else if (oldSession.accessToken !== newSession.accessToken) {
                changed.push(newSession);
            }
        }
        this._sessionChangeEmitter.fire({ added, removed, changed });
    }

    public async login(profileName: string, loginSession: zowe.imperative.Session): Promise<zowe.imperative.IProfile> {
        const session = await this.createSession([profileName], loginSession);
        return {
            tokenType: loginSession.ISession.tokenType,
            tokenValue: session.accessToken,
        };
    }

    public async logout(profileName: string, logoutSession: zowe.imperative.Session): Promise<void> {
        const apimlSession = this._sessionCache.find((session) => session.scopes[0] === profileName);
        if (apimlSession != null) {
            await this.removeSession(apimlSession.id, logoutSession);
        }
    }

    public get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
        return this._sessionChangeEmitter.event;
    }

    public async getSessions(_scopes?: string[]): Promise<readonly AuthenticationSession[]> {
        await this.updateSessionCache();
        return this._sessionCache;
    }

    public async createSession(scopes: string[], loginSession?: zowe.imperative.Session): Promise<AuthenticationSession> {
        const profileName = scopes[0];
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile(profileName);
        if (loginSession == null) {
            const creds = await profiles.loginCredentialPrompt();
            if (!creds) {
                return Promise.reject();
            }
            loginSession = new zowe.imperative.Session({
                hostname: baseProfile.profile.host,
                port: baseProfile.profile.port,
                user: creds[0],
                password: creds[1],
                rejectUnauthorized: baseProfile.profile.rejectUnauthorized,
                tokenType: zowe.imperative.SessConstants.TOKEN_TYPE_APIML,
                type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
            });
        }
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

    public async removeSession(sessionId: string, logoutSession?: zowe.imperative.Session): Promise<void> {
        const session = this._sessionCache.find((s) => s.id === sessionId);
        const profileName = session.scopes[0];
        const profiles = Profiles.getInstance();
        const baseProfile = await profiles.fetchBaseProfile(profileName);
        if (logoutSession == null) {
            logoutSession = new zowe.imperative.Session({
                hostname: baseProfile.profile.host,
                port: baseProfile.profile.port,
                rejectUnauthorized: baseProfile.profile.rejectUnauthorized,
                tokenType: baseProfile.profile.tokenType,
                tokenValue: baseProfile.profile.tokenValue,
                type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
            });
        }
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
            if (baseProfile.profile.tokenType === zowe.imperative.SessConstants.TOKEN_TYPE_APIML && baseProfile.profile.tokenValue != null) {
                this._sessionCache.push(this.buildSession(baseProfile));
            }
        }
    }
}
