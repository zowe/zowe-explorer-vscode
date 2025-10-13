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

import { Gui } from "../globals";
import { CorrelatedError, FileManagement } from "../utils";
import * as imperative from "@zowe/imperative";
import { IZoweTreeNode } from "../tree";
import { Mutex } from "async-mutex";
import * as vscode from "vscode";
import { ZoweVsCodeExtension } from "../vscode/ZoweVsCodeExtension";

/**
 * @brief individual authentication methods (also supports a `ProfilesCache` class)
 */
export interface IAuthMethods {
    // Method for establishing SSO login with a given profile name
    ssoLogin: (node?: IZoweTreeNode, profileName?: string) => PromiseLike<boolean>;
    // Method that prompts the user for credentials, sets them on the profile and returns them to the caller if set
    promptCredentials: (profile: string | imperative.IProfileLoaded, rePrompt?: boolean) => PromiseLike<string[]>;
}

export type AuthPromptParams = {
    // Whether the profile is using token-based authentication
    isUsingTokenAuth?: boolean;
    // API-friendly error correlation for the "Invalid Credentials" scenario
    errorCorrelation?: CorrelatedError;
    // Authentication methods to call after user responds to prompts
    authMethods: IAuthMethods;
    // Error encountered from API call
    imperativeError: imperative.ImperativeError;
    // Whether to throw an AuthCancelledError if the user cancels the authentication prompt
    throwErrorOnCancel?: boolean;
};

export type ProfileLike = string | imperative.IProfileLoaded;

/**
 * Error thrown when the user cancels an authentication prompt.
 * This allows extenders to distinguish between authentication failures and user cancellation.
 * Extends FileSystemError to be compliant with VS Code's filesystem API expectations.
 */
export class AuthCancelledError extends vscode.FileSystemError {
    public readonly profileName: string;

    public constructor(profileName: string, message?: string) {
        super(message ?? `Authentication cancelled for profile: ${profileName}`);
        this.name = "AuthCancelledError";
        this.profileName = profileName;
    }
}

export class AuthHandler {
    public static authPromptLocks = new Map<string, Mutex>();
    private static profileLocks = new Map<string, Mutex>();
    private static authCancelledProfiles = new Set<string>();
    private static enabledProfileTypes: Set<string> = new Set(["zosmf"]);

    /**
     * Records whether the user cancelled the authentication prompt for a profile.
     * @param profile The profile to update
     * @param wasCancelled Whether the prompt was cancelled
     */
    public static setAuthCancelled(profile: ProfileLike, wasCancelled: boolean): void {
        const profileName = AuthHandler.getProfileName(profile);
        if (wasCancelled) {
            this.authCancelledProfiles.add(profileName);
        } else {
            this.authCancelledProfiles.delete(profileName);
        }
    }

    /**
     * Checks if the last authentication attempt for a profile was cancelled.
     * @param profile The profile to check
     * @returns {boolean} True if authentication was cancelled, false otherwise
     */
    public static wasAuthCancelled(profile: ProfileLike): boolean {
        return this.authCancelledProfiles.has(AuthHandler.getProfileName(profile));
    }

    /**
     * Enables profile locks for the given type.
     * @param type The profile type to enable locks for.
     */
    public static enableLocksForType(type: string): void {
        this.enabledProfileTypes.add(type);
    }

    /**
     * Disables profile locks for the given type.
     * @param type The profile type to disable locks for.
     */
    public static disableLocksForType(type: string): void {
        this.enabledProfileTypes.delete(type);
    }

    /**
     * Function that returns the session associated with the specified profile.
     *
     * @param {imperative.IProfileLoaded} profile The profile to be inspected.
     *
     * @returns {imperative.Session}
     *      The session associated with the specified profile
     *
     * @throws {Error} If the profile type is not supported by the common APIs in the Zowe Explorer API register
     */
    public static getSessFromProfile(profile: imperative.IProfileLoaded): imperative.Session {
        return ZoweVsCodeExtension.getZoweExplorerApi().getCommonApi(profile).getSession(profile);
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
        return session?.ISession?.type ?? imperative.SessConstants.AUTH_TYPE_NONE;
    }

    /**
     * Function that returns the session type for the session associated with the specified profile.
     *
     * @param {imperative.IProfileLoaded} profile The profile to be inspected.
     *
     * @returns {imperative.SessConstants.AUTH_TYPE_CHOICES}
     *      The session type for the session associated with the specified profile
     *
     * @throws {Error} If the profile type is not supported by the common APIs in the Zowe Explorer API register
     */
    public static sessTypeFromProfile(profile: imperative.IProfileLoaded): imperative.SessConstants.AUTH_TYPE_CHOICES {
        return AuthHandler.sessTypeFromSession(AuthHandler.getSessFromProfile(profile));
    }

    /**
     * Function that checks whether a profile is using token based authentication
     * @deprecated Use AuthHandler.sessTypeFromProfile and/or AuthHandler.sessTypeFromSession, which will adhere to authOrder.
     * @param {string[]} profileProps Secure properties for the service profile
     * @param {string[]} baseProfileProps Base profile's secure properties (optional)
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static isUsingTokenAuth(profileProps: string[], baseProfileProps?: string[]): boolean {
        const profileUsesBasicAuth = profileProps.includes("user") && profileProps.includes("password");
        if (profileProps.includes("tokenValue")) {
            return !profileUsesBasicAuth;
        }
        return baseProfileProps != null ? baseProfileProps.includes("tokenValue") && !profileUsesBasicAuth : !profileUsesBasicAuth;
    }

    /**
     * Unlocks the given profile so it can be used again.
     * @param profile {ProfileLike} The profile (name or {@link imperative.IProfileLoaded} object) to unlock
     * @param refreshResources {boolean} Whether to refresh high-priority resources (active editor & virtual workspace) after unlocking
     */
    public static unlockProfile(profile: ProfileLike, refreshResources?: boolean): void {
        const profileName = AuthHandler.getProfileName(profile);
        this.authCancelledProfiles.delete(profileName);
        this.authPromptLocks.get(profileName)?.release();
        const mutex = this.profileLocks.get(profileName);
        // If a mutex doesn't exist for this profile or the mutex is no longer locked, return
        if (mutex == null || !mutex.isLocked()) {
            return;
        }

        mutex.release();
        if (refreshResources) {
            // TODO: Log errors using ZoweLogger once available in ZE API
            // refresh an active, unsaved editor if it uses the profile
            FileManagement.reloadActiveEditorForProfile(profileName)
                // eslint-disable-next-line no-console
                .catch((err) => err instanceof Error && console.error(err.message));

            // refresh virtual workspaces for the profile
            FileManagement.reloadWorkspacesForProfile(profileName)
                // eslint-disable-next-line no-console
                .catch((err) => err instanceof Error && console.error(err.message));
        }
    }

    /**
     * Determines whether to handle an authentication error for a given profile.
     * This uses a mutex to prevent additional authentication prompts until the first prompt is resolved.
     * @param profileName The name of the profile to check
     * @returns {boolean} Whether to handle the authentication error
     */
    public static async shouldHandleAuthError(profileName: string): Promise<boolean> {
        if (!this.authPromptLocks.has(profileName)) {
            this.authPromptLocks.set(profileName, new Mutex());
        }

        const mutex = this.authPromptLocks.get(profileName);
        if (mutex.isLocked()) {
            return false;
        }

        await mutex.acquire();
        return true;
    }

    /**
     * Prompts the user to authenticate over SSO or a credential prompt in the event of an error.
     * @param profile The profile to authenticate
     * @param params {AuthPromptParams} Prompt parameters (login methods, using token auth, error correlation)
     * @returns {boolean} Whether authentication was successful
     * @throws {AuthCancelledError} When the user cancels the authentication prompt
     */
    public static async promptForAuthentication(profile: ProfileLike, params: AuthPromptParams): Promise<boolean> {
        const profileName = AuthHandler.getProfileName(profile);
        AuthHandler.setAuthCancelled(profileName, false);
        if (params.imperativeError.mDetails.additionalDetails) {
            const tokenError: string = params.imperativeError.mDetails.additionalDetails;
            if (tokenError.includes("Token is not valid or expired.") || params.isUsingTokenAuth) {
                // Handle token-based authentication error through the given `ssoLogin` method.
                const message = "Log in to Authentication Service";
                const userResp = await Gui.showMessage(params.errorCorrelation?.message ?? params.imperativeError.message, {
                    items: [message],
                    vsCodeOpts: { modal: true },
                });
                if (userResp === message && (await params.authMethods.ssoLogin(null, profileName))) {
                    // Unlock profile so it can be used again
                    AuthHandler.unlockProfile(profileName, true);
                    return true;
                }
                if (userResp === undefined) {
                    // User cancelled the SSO login prompt
                    AuthHandler.setAuthCancelled(profileName, true);
                    if (params.throwErrorOnCancel) {
                        throw new AuthCancelledError(profileName, "User cancelled SSO authentication");
                    }
                }
                return false;
            }
        }

        // Prompt the user to update their credentials using the given `promptCredentials` method.
        const checkCredsButton = "Update Credentials";
        const selection = await Gui.errorMessage(params.errorCorrelation?.message ?? params.imperativeError.message, {
            items: [checkCredsButton],
            vsCodeOpts: { modal: true },
        });

        if (selection !== checkCredsButton) {
            // User cancelled the credential prompt
            AuthHandler.setAuthCancelled(profileName, true);
            if (params.throwErrorOnCancel) {
                throw new AuthCancelledError(profileName, "User cancelled credential authentication");
            }
            return false;
        }

        const creds = await params.authMethods.promptCredentials(profile, true);
        if (creds != null) {
            // Unlock profile so it can be used again
            AuthHandler.unlockProfile(profileName, true);
            return true;
        }

        // User cancelled during credential input
        AuthHandler.setAuthCancelled(profileName, true);
        if (params.throwErrorOnCancel) {
            throw new AuthCancelledError(profileName, "User cancelled during credential input");
        }
        return false;
    }

    /**
     * Locks the given profile to prevent further use in asynchronous operations (at least where the lock is respected).
     * Supports prompting for authentication if an Imperative error and prompt options are given.
     * @param profile The profile to lock
     * @param authOpts Authentication methods and related options. If provided, {@link promptForAuthentication} will be called with the given options.
     * @returns Whether the profile was successfully locked
     */
    public static async lockProfile(profile: ProfileLike, authOpts?: AuthPromptParams): Promise<boolean> {
        const profileName = AuthHandler.getProfileName(profile);

        // Only create a lock for the profile when we can determine the profile type and the profile type has locks enabled
        if (!AuthHandler.isProfileLoaded(profile) || this.enabledProfileTypes.has(profile.type)) {
            // If the mutex does not exist, make one for the profile and acquire the lock
            if (!this.profileLocks.has(profileName)) {
                this.profileLocks.set(profileName, new Mutex());
            }

            // Attempt to acquire the lock - only lock the mutex if the profile type has locks enabled
            const mutex = this.profileLocks.get(profileName);
            await mutex.acquire();
        }

        // Prompt the user to re-authenticate if an error and options were provided
        if (authOpts) {
            const result = await AuthHandler.promptForAuthentication(profile, authOpts);
            if (result) {
                this.profileLocks.get(profileName)?.release();
            }
            return result;
        }

        return true;
    }

    private static isProfileLoaded(profile: ProfileLike): profile is imperative.IProfileLoaded {
        return typeof profile !== "string";
    }

    private static getProfileName(profile: ProfileLike): string {
        return typeof profile === "string" ? profile : profile.name;
    }

    /**
     * Waits for the profile to be unlocked (ONLY if the profile was locked after an authentication error)
     * @param profile The profile name or object that may be locked
     */
    public static async waitForUnlock(profile: ProfileLike, shouldAwaitTimeout: boolean = true): Promise<void> {
        const profileName = AuthHandler.getProfileName(profile);
        if (!this.profileLocks.has(profileName)) {
            return;
        }

        const mutex = this.profileLocks.get(profileName);
        // If the mutex isn't locked, no need to wait
        if (!mutex.isLocked()) {
            return;
        }

        if (mutex.isLocked() && !shouldAwaitTimeout) {
            throw new Error(`Profile ${profileName} is locked`);
        }

        // Wait for the mutex to be unlocked with a timeout to prevent indefinite waiting
        const timeoutMs = 10000;
        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Timeout waiting for profile ${profileName} to be unlocked`));
            }, timeoutMs);
        });

        try {
            await Promise.race([mutex.waitForUnlock(), timeoutPromise]);
        } catch (error) {
            // Log the timeout to console since we don't have access to the logger in the API
            // This is acceptable as this is just a fallback for an edge case where the user did not respond to a credential prompt in time
            // eslint-disable-next-line no-console
            console.log(`Timeout waiting for profile ${profileName} to be unlocked`);
            throw error;
        }
    }

    /**
     * Releases locks for all profiles.
     * Used for scenarios such as the `onVaultChanged` event, where we don't know what secure values have changed,
     * but we can't assume that the profile still has invalid credentials.
     */
    public static unlockAllProfiles(): void {
        for (const mutex of this.authPromptLocks.values()) {
            mutex.release();
        }

        for (const mutex of this.profileLocks.values()) {
            mutex.release();
        }
        this.authCancelledProfiles.clear();
    }

    /**
     * Checks whether the given profile has its lock acquired.
     * @param profile The profile to check
     * @returns {boolean} `true` if the given profile is locked, `false` otherwise
     */
    public static isProfileLocked(profile: ProfileLike): boolean {
        const mutex = this.profileLocks.get(AuthHandler.getProfileName(profile));
        if (mutex == null) {
            return false;
        }

        return mutex.isLocked();
    }
}
