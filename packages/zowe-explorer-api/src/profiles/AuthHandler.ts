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
import { CorrelatedError, DeferredPromise, reloadWorkspacesForProfile } from "../utils";
import * as imperative from "@zowe/imperative";
import { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweTree, IZoweTreeNode, IZoweUSSTreeNode } from "../tree";
import { commands } from "vscode";

export interface IAuthMethods {
    ssoLogin: (node?: IZoweTreeNode, profileName?: string) => PromiseLike<boolean>;
    promptCredentials: (profile: string | imperative.IProfileLoaded, rePrompt?: boolean) => PromiseLike<string[]>;
}

export interface AuthPromptOpts extends IAuthMethods {
    isUsingTokenAuth?: boolean;
    errorCorrelation?: CorrelatedError;
}

export interface LockProfileOpts extends AuthPromptOpts {
    waitAfterLock?: boolean;
}

type ProfileLike = string | imperative.IProfileLoaded;
export class AuthHandler {
    private static lockedProfiles: Map<string, DeferredPromise<void>> = new Map();

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

    public static unlockProfile(profile: ProfileLike): void {
        const profileName = typeof profile === "string" ? profile : profile.name;
        const deferred = this.lockedProfiles.get(profileName);
        if (deferred) {
            deferred.resolve();
            this.lockedProfiles.delete(profileName);
            // reload virtual workspaces for the profile now that its usable
            reloadWorkspacesForProfile(profileName);
        }
    }

    public static async promptForAuthentication(
        imperativeError: imperative.ImperativeError,
        profile: ProfileLike,
        opts: AuthPromptOpts
    ): Promise<boolean> {
        const profileName = typeof profile === "string" ? profile : profile.name;
        if (imperativeError.mDetails.additionalDetails) {
            const tokenError: string = imperativeError.mDetails.additionalDetails;
            if (tokenError.includes("Token is not valid or expired.") || opts.isUsingTokenAuth) {
                const message = "Log in to Authentication Service";
                const userResp = await Gui.showMessage(opts.errorCorrelation?.message ?? imperativeError.message, {
                    items: [message],
                    vsCodeOpts: { modal: true },
                });
                if (userResp === message) {
                    if (await opts.ssoLogin(null, profileName)) {
                        // SSO login was successful, unlock profile
                        AuthHandler.unlockProfile(profileName);
                        return true;
                    }
                }
                return false;
            }
        }
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
            // New creds were provided
            // Propagate new creds to other profiles
            const treeProviders = (await commands.executeCommand("zowe.getTreeProviders")) as any;
            const dsNode = (await (treeProviders.ds as IZoweTree<IZoweDatasetTreeNode>).getChildren()).find((n) => n.label === profileName);
            if (dsNode && typeof profile !== "string") {
                dsNode.setProfileToChoice(profile);
            }
            const ussNode = (await (treeProviders.uss as IZoweTree<IZoweUSSTreeNode>).getChildren()).find((n) => n.label === profileName);
            if (ussNode && typeof profile !== "string") {
                ussNode.setProfileToChoice(profile);
            }
            const jobsNode = (await (treeProviders.job as IZoweTree<IZoweJobTreeNode>).getChildren()).find((n) => n.label === profileName);
            if (jobsNode && typeof profile !== "string") {
                jobsNode.setProfileToChoice(profile);
            }
            AuthHandler.unlockProfile(profileName);
            return true;
        }
        return false;
    }

    public static async lockProfile(profile: ProfileLike, imperativeError?: imperative.ImperativeError, opts?: LockProfileOpts): Promise<void> {
        const profileName = typeof profile === "string" ? profile : profile.name;
        if (this.lockedProfiles.has(profileName)) {
            return this.lockedProfiles.get(profileName)!.promise;
        }
        const deferred = new DeferredPromise<void>();
        this.lockedProfiles.set(profileName, deferred);

        // Prompt the user to re-authenticate
        if (imperativeError && opts) {
            const credsEntered = await AuthHandler.promptForAuthentication(imperativeError, profile, opts);

            // If the user failed to re-authenticate, reject the promise
            // TODO: more manual testing
            if (!credsEntered) {
                deferred.reject();
            }
        }

        if (opts?.waitAfterLock) {
            return deferred.promise;
        }
    }

    public static isLocked(profile: ProfileLike): boolean {
        return this.lockedProfiles.has(typeof profile === "string" ? profile : profile.name);
    }

    public static async waitIfLocked(profile: ProfileLike): Promise<void> {
        const deferred = this.lockedProfiles.get(typeof profile === "string" ? profile : profile.name);
        if (deferred) {
            await deferred.promise;
        }
    }
}

export function withCredentialManagement<T extends (...args: any[]) => any | PromiseLike<any>>(
    authMethods: IAuthMethods,
    profile: ProfileLike,
    apiMethod: T
): T {
    return async function (...args: any[]) {
        await AuthHandler.waitIfLocked(profile);

        try {
            return await apiMethod(...args);
        } catch (error) {
            if (error instanceof imperative.ImperativeError) {
                const imperativeError: imperative.ImperativeError = error as imperative.ImperativeError;
                const httpErrorCode = Number(imperativeError.mDetails.errorCode);
                if (
                    httpErrorCode === imperative.RestConstants.HTTP_STATUS_401 ||
                    imperativeError.message.includes("All configured authentication methods failed")
                ) {
                    await AuthHandler.lockProfile(profile, imperativeError, { ...authMethods });
                    return await apiMethod(...args);
                } else {
                    throw error;
                }
            }
            throw error;
        }
    } as T;
}
