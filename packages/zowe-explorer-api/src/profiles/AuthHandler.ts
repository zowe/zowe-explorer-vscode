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

/**
 * @deprecated Import `AuthHandler` and related types from the vscode/session module.
 * This file is a compatibility shim that lazily forwards to the moved implementation.
 */
import { createRequire } from "node:module";
import type * as imperative from "@zowe/imperative";
import type { Mutex } from "async-mutex";
import type { AuthPromptParams, IAuthMethods, ProfileLike } from "../vscode/session/AuthHandler";

type AuthHandlerModule = typeof import("../vscode/session/AuthHandler");
type AuthHandlerImpl = AuthHandlerModule["AuthHandler"];
type AuthHandlerState = {
    authPromptLocks: Map<string, Mutex>;
    profileLocks: Map<string, Mutex>;
    authCancelledProfiles: Set<string>;
    authFlows: Map<string, Promise<void>>;
    sequentialLocks: Map<string, Mutex>;
    parallelEnabledProfiles: Set<string>;
    enabledProfileTypes: Set<string>;
};

const nodeRequire = createRequire(__filename);

function loadAuthHandlerModule(): AuthHandlerModule {
    return nodeRequire("../vscode/session/AuthHandler") as AuthHandlerModule;
}

function getAuthHandlerImpl(): AuthHandlerImpl {
    return loadAuthHandlerModule().AuthHandler;
}

function getAuthHandlerState(): AuthHandlerState {
    return getAuthHandlerImpl() as unknown as AuthHandlerState;
}

export type { AuthPromptParams, IAuthMethods, ProfileLike };

export class AuthCancelledError extends Error {
    public readonly profileName: string;

    public constructor(profileName: string, message?: string) {
        super(message ?? `Authentication cancelled for profile: ${profileName}`);
        this.name = "AuthCancelledError";
        this.profileName = profileName;
        return new (loadAuthHandlerModule().AuthCancelledError)(profileName, message) as AuthCancelledError;
    }
}

export class AuthHandler {
    public static get authPromptLocks(): Map<string, Mutex> {
        return getAuthHandlerImpl().authPromptLocks;
    }

    public static set authPromptLocks(value: Map<string, Mutex>) {
        getAuthHandlerImpl().authPromptLocks = value;
    }

    public static get profileLocks(): Map<string, Mutex> {
        return getAuthHandlerState().profileLocks;
    }

    public static set profileLocks(value: Map<string, Mutex>) {
        getAuthHandlerState().profileLocks = value;
    }

    public static get authCancelledProfiles(): Set<string> {
        return getAuthHandlerState().authCancelledProfiles;
    }

    public static set authCancelledProfiles(value: Set<string>) {
        getAuthHandlerState().authCancelledProfiles = value;
    }

    public static get authFlows(): Map<string, Promise<void>> {
        return getAuthHandlerState().authFlows;
    }

    public static set authFlows(value: Map<string, Promise<void>>) {
        getAuthHandlerState().authFlows = value;
    }

    public static get sequentialLocks(): Map<string, Mutex> {
        return getAuthHandlerState().sequentialLocks;
    }

    public static set sequentialLocks(value: Map<string, Mutex>) {
        getAuthHandlerState().sequentialLocks = value;
    }

    public static get parallelEnabledProfiles(): Set<string> {
        return getAuthHandlerState().parallelEnabledProfiles;
    }

    public static set parallelEnabledProfiles(value: Set<string>) {
        getAuthHandlerState().parallelEnabledProfiles = value;
    }

    public static get enabledProfileTypes(): Set<string> {
        return getAuthHandlerState().enabledProfileTypes;
    }

    public static set enabledProfileTypes(value: Set<string>) {
        getAuthHandlerState().enabledProfileTypes = value;
    }

    public static setAuthCancelled(profile: ProfileLike, wasCancelled: boolean): void {
        return getAuthHandlerImpl().setAuthCancelled(profile, wasCancelled);
    }

    public static wasAuthCancelled(profile: ProfileLike): boolean {
        return getAuthHandlerImpl().wasAuthCancelled(profile);
    }

    public static enableLocksForType(type: string): void {
        return getAuthHandlerImpl().enableLocksForType(type);
    }

    public static disableLocksForType(type: string): void {
        return getAuthHandlerImpl().disableLocksForType(type);
    }

    public static getSessFromProfile(profile: imperative.IProfileLoaded): imperative.Session {
        return getAuthHandlerImpl().getSessFromProfile(profile);
    }

    public static sessTypeFromSession(session: imperative.Session): imperative.SessConstants.AUTH_TYPE_CHOICES {
        return getAuthHandlerImpl().sessTypeFromSession(session);
    }

    public static sessTypeFromProfile(profile: imperative.IProfileLoaded): imperative.SessConstants.AUTH_TYPE_CHOICES {
        return getAuthHandlerImpl().sessTypeFromProfile(profile);
    }

    /**
     * @deprecated Use AuthHandler.sessTypeFromProfile and/or AuthHandler.sessTypeFromSession, which will adhere to authOrder.
     */
    public static isUsingTokenAuth(profileProps: string[], baseProfileProps?: string[]): boolean {
        const profileUsesBasicAuth = profileProps.includes("user") && profileProps.includes("password");
        if (profileProps.includes("tokenValue")) {
            return !profileUsesBasicAuth;
        }
        return baseProfileProps != null ? baseProfileProps.includes("tokenValue") && !profileUsesBasicAuth : !profileUsesBasicAuth;
    }

    public static unlockProfile(profile: ProfileLike, refreshResources?: boolean): void {
        return getAuthHandlerImpl().unlockProfile(profile, refreshResources);
    }

    public static promptForAuthentication(profile: ProfileLike, params: AuthPromptParams): Promise<boolean> {
        return getAuthHandlerImpl().promptForAuthentication(profile, params);
    }

    public static lockProfile(profile: ProfileLike, authOpts?: AuthPromptParams): Promise<boolean> {
        return getAuthHandlerImpl().lockProfile(profile, authOpts);
    }

    public static enableSequentialRequests(profile: ProfileLike): void {
        return getAuthHandlerImpl().enableSequentialRequests(profile);
    }

    public static disableSequentialRequests(profile: ProfileLike): void {
        return getAuthHandlerImpl().disableSequentialRequests(profile);
    }

    public static areSequentialRequestsEnabled(profile: ProfileLike): boolean {
        return getAuthHandlerImpl().areSequentialRequestsEnabled(profile);
    }

    public static runSequentialIfEnabled<T>(profile: ProfileLike, action: () => Promise<T>): Promise<T> {
        return getAuthHandlerImpl().runSequentialIfEnabled(profile, action);
    }

    public static waitForUnlock(profile: ProfileLike): Promise<void> {
        return getAuthHandlerImpl().waitForUnlock(profile);
    }

    public static unlockAllProfiles(): void {
        return getAuthHandlerImpl().unlockAllProfiles();
    }

    public static isProfileLocked(profile: ProfileLike): boolean {
        return getAuthHandlerImpl().isProfileLocked(profile);
    }

    public static getActiveAuthFlow(profile: ProfileLike): Promise<void> | undefined {
        return getAuthHandlerImpl().getActiveAuthFlow(profile);
    }

    public static getOrCreateAuthFlow(profile: ProfileLike, authOpts: AuthPromptParams): Promise<void> {
        return getAuthHandlerImpl().getOrCreateAuthFlow(profile, authOpts);
    }
}
