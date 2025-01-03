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
import { ZoweVsCodeExtension } from "../vscode/ZoweVsCodeExtension";

export interface IAuthMethods {
    /* Method for establishing SSO login with a given profile name */
    ssoLogin: (node?: IZoweTreeNode, profileName?: string) => PromiseLike<boolean>;
    /* Method that prompts the user for credentials, sets them on the profile and returns them to the caller if set */
    promptCredentials: (profile: string | imperative.IProfileLoaded, rePrompt?: boolean) => PromiseLike<string[]>;
}

export interface AuthPromptParams extends IAuthMethods {
    // Whether the profile is using token-based authentication
    isUsingTokenAuth?: boolean;
    // API-friendly error correlation for the "Invalid Credentials" scenario
    errorCorrelation?: CorrelatedError;
}

type ProfileLike = string | imperative.IProfileLoaded;
export class AuthHandler {
    private static profileLocks: Map<string, Mutex> = new Map();

    /**
     * Function that checks whether a profile is using token based authentication
     * @param {string[]} secureProfileProps Secure properties for the service profile
     * @param {string[]} baseSecureProfileProps Base profile's secure properties (optional)
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static isUsingTokenAuth(secureProfileProps: string[], baseSecureProfileProps?: string[]): boolean {
        const profileUsesBasicAuth = secureProfileProps.includes("user") && secureProfileProps.includes("password");
        if (secureProfileProps.includes("tokenValue")) {
            return !profileUsesBasicAuth;
        }
        return baseSecureProfileProps?.includes("tokenValue") && !profileUsesBasicAuth;
    }

    /**
     * Unlocks the given profile so it can be used again.
     * @param profile {ProfileLike} The profile (name or {@link imperative.IProfileLoaded} object) to unlock
     * @param refreshResources {boolean} Whether to refresh high-priority resources (active editor & virtual workspace) after unlocking
     */
    public static unlockProfile(profile: ProfileLike, refreshResources?: boolean): void {
        const profileName = typeof profile === "string" ? profile : profile.name;
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
     * Prompts the user to authenticate over SSO or a credential prompt in the event of an error.
     * @param imperativeError The authentication error that was encountered
     * @param profile The profile to authenticate
     * @param opts {AuthPromptParams} Prompt parameters (login methods, using token auth, error correlation)
     * @returns {boolean} Whether authentication was successful
     */
    public static async promptForAuthentication(
        imperativeError: imperative.ImperativeError,
        profile: ProfileLike,
        opts: AuthPromptParams
    ): Promise<boolean> {
        const profileName = typeof profile === "string" ? profile : profile.name;
        if (imperativeError.mDetails.additionalDetails) {
            const tokenError: string = imperativeError.mDetails.additionalDetails;
            if (tokenError.includes("Token is not valid or expired.") || opts.isUsingTokenAuth) {
                // Handle token-based authentication error through the given `ssoLogin` method.
                const message = "Log in to Authentication Service";
                const userResp = await Gui.showMessage(opts.errorCorrelation?.message ?? imperativeError.message, {
                    items: [message],
                    vsCodeOpts: { modal: true },
                });
                if (userResp === message && (await opts.ssoLogin(null, profileName))) {
                    // SSO login was successful, propagate new profile properties to other tree providers
                    if (typeof profile !== "string") {
                        ZoweVsCodeExtension.onProfileUpdatedEmitter.fire(profile);
                    }
                    // Unlock profile so it can be used again
                    AuthHandler.unlockProfile(profileName, true);
                    return true;
                }
                return false;
            }
        }

        // Prompt the user to update their credentials using the given `promptCredentials` method.
        const checkCredsButton = "Update Credentials";
        const creds = await Gui.errorMessage(opts.errorCorrelation?.message ?? imperativeError.message, {
            items: [checkCredsButton],
            vsCodeOpts: { modal: true },
        }).then(async (selection) => {
            if (selection !== checkCredsButton) {
                return;
            }
            return opts.promptCredentials(profile, true);
        });

        if (creds != null) {
            // New creds were set, propagate new profile properties to other tree providers.
            if (typeof profile !== "string") {
                ZoweVsCodeExtension.onProfileUpdatedEmitter.fire(profile);
            }
            // Unlock profile so it can be used again
            AuthHandler.unlockProfile(profileName, true);
            return true;
        }
        return false;
    }

    /**
     * Locks the given profile to prevent further use in asynchronous operations (at least where the lock is respected).
     * Supports prompting for authentication if an Imperative error and prompt options are given.
     * @param profile The profile to lock
     * @param imperativeError The Imperative error that was encountered when using the profile
     * @param opts Prompt parameters to use during authentication
     * @returns Whether the profile was successfully locked
     */
    public static async lockProfile(profile: ProfileLike, imperativeError?: imperative.ImperativeError, opts?: AuthPromptParams): Promise<boolean> {
        const profileName = typeof profile === "string" ? profile : profile.name;

        // If the mutex does not exist, make one for the profile and acquire the lock
        if (!this.profileLocks.has(profileName)) {
            this.profileLocks.set(profileName, new Mutex());
        }

        // Attempt to acquire the lock
        const mutex = this.profileLocks.get(profileName);
        await mutex.acquire();

        // Prompt the user to re-authenticate if an error and options were provided
        if (imperativeError && opts) {
            await AuthHandler.promptForAuthentication(imperativeError, profile, opts);
            mutex.release();
            // Return `true` as the mutex was still locked successfully.
            return true;
        }

        return true;
    }

    /**
     * Checks whether the given profile has its lock acquired.
     * @param profile The profile to check
     * @returns {boolean} `true` if the given profile is locked, `false` otherwise
     */
    public static isProfileLocked(profile: ProfileLike): boolean {
        const mutex = this.profileLocks.get(typeof profile === "string" ? profile : profile.name);
        if (mutex == null) {
            return false;
        }

        return mutex.isLocked();
    }
}
