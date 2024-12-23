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
import { CorrelatedError, reloadActiveEditorForProfile, reloadWorkspacesForProfile } from "../utils";
import * as imperative from "@zowe/imperative";
import { IZoweTree, IZoweTreeNode } from "../tree";
import { commands } from "vscode";
import { Mutex } from "async-mutex";

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
    private static lockedProfiles: Map<string, Mutex> = new Map();

    /**
     * Function that checks whether a profile is using token based authentication
     * @param {string[]} secureProfileProps Secure properties for the service profile
     * @param {string[]} baseSecureProfileProps Base profile's secure properties (optional)
     * @returns {Promise<boolean>} a boolean representing whether token based auth is being used or not
     */
    public static isUsingTokenAuth(secureProfileProps: string[], baseSecureProfileProps?: string[]): boolean {
        const profileUsesBasicAuth = secureProfileProps.includes("user") && secureProfileProps.includes("password");
        if (secureProfileProps.includes("tokenValue")) {
            return secureProfileProps.includes("tokenValue") && !profileUsesBasicAuth;
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
        const deferred = this.lockedProfiles.get(profileName);
        if (deferred) {
            deferred.release();
            if (refreshResources) {
                // TODO: Log errors using ZoweLogger once available in ZE API
                // refresh an active, unsaved editor if it uses the profile
                reloadActiveEditorForProfile(profileName)
                    // eslint-disable-next-line no-console
                    .catch((err) => err instanceof Error && console.error(err.message));

                // refresh virtual workspaces for the profile
                reloadWorkspacesForProfile(profileName)
                    // eslint-disable-next-line no-console
                    .catch((err) => err instanceof Error && console.error(err.message));
            }
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
                if (userResp === message) {
                    if (await opts.ssoLogin(null, profileName)) {
                        // SSO login was successful, unlock profile so it can be used again
                        AuthHandler.unlockProfile(profileName, true);
                        return true;
                    }
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
            // New creds were set, directly propagate new profile to other tree providers.

            // TODO: If we can access extender tree providers (e.g. CICS), it would help to propagate profile updates here.
            // For now we will propagate profile changes to core providers (Data Sets, USS, Jobs)
            const treeProviders = (await commands.executeCommand("zowe.getTreeProviders")) as any;
            for (const provider of [treeProviders.ds, treeProviders.uss, treeProviders.job]) {
                const node = (await (provider as IZoweTree<IZoweTreeNode>).getChildren()).find((n) => n.label === profileName);
                if (node && typeof profile !== "string") {
                    node.setProfileToChoice(profile);
                }
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
        if (!this.lockedProfiles.has(profileName)) {
            this.lockedProfiles.set(profileName, new Mutex());
        }

        // Attempt to acquire the lock
        const mutex = this.lockedProfiles.get(profileName);
        await mutex.acquire();

        // Prompt the user to re-authenticate if an error and options were provided
        if (imperativeError && opts) {
            const credsEntered = await AuthHandler.promptForAuthentication(imperativeError, profile, opts);
            if (!credsEntered) {
                mutex.release();
            }
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
    public static isLocked(profile: ProfileLike): boolean {
        const mutex = this.lockedProfiles.get(typeof profile === "string" ? profile : profile.name);
        if (mutex == null) {
            return false;
        }

        return mutex.isLocked();
    }
}

export function withCredentialManagement<T extends (...args: any[]) => unknown | PromiseLike<unknown>>(
    authMethods: IAuthMethods,
    profile: ProfileLike,
    apiMethod: T
): T {
    return async function (...args: any[]) {
        await AuthHandler.lockProfile(profile);
        try {
            const res = await apiMethod(...args);
            AuthHandler.unlockProfile(profile);
            return res;
        } catch (error) {
            if (error instanceof imperative.ImperativeError) {
                const httpErrorCode = Number(error.mDetails.errorCode);
                if (
                    httpErrorCode === imperative.RestConstants.HTTP_STATUS_401 ||
                    error.message.includes("All configured authentication methods failed")
                ) {
                    await AuthHandler.promptForAuthentication(error, profile, { ...authMethods });
                    return await apiMethod(...args);
                } else {
                    throw error;
                }
            }
            throw error;
        }
    } as T;
}
