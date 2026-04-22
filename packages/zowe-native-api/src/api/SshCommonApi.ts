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

import { ImperativeError } from "@zowe/imperative";
import { type SshSession, ZosUssProfile } from "@zowe/zos-uss-for-zowe-sdk";
import {
    AuthHandler,
    ErrorCorrelator,
    type IAuthMethods,
    imperative,
    type MainframeInteraction,
    ZoweExplorerApiType,
    ZoweVsCodeExtension,
} from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { type ZSshClient, ZSshUtils } from "zowex-sdk";
import { SshClientCache } from "../SshClientCache";
import { SshErrorHandler } from "../SshErrorHandler";

export class SshCommonApi implements MainframeInteraction.ICommon {
    public constructor(public profile?: imperative.IProfileLoaded) {}

    public getProfileTypeName(): string {
        return ZosUssProfile.type;
    }

    public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
        return new imperative.Session(this.getSshSession(profile).ISshSession);
    }

    public async getStatus(profile: imperative.IProfileLoaded, profileType?: string): Promise<string> {
        if (profileType === ZosUssProfile.type) {
            try {
                await SshClientCache.inst.connect(profile);
                return "active";
            } catch (err) {
                const errorMessage = (err as Error).toString();

                // Check if this is a private key authentication failure
                if (ZSshUtils.isPrivateKeyAuthFailure(errorMessage, !!profile.profile?.privateKey)) {
                    vscode.window.showWarningMessage(
                        `Private key authentication failed for "${profile.name}". Falling back to password authentication...`
                    );

                    try {
                        // Attempt to prompt for password with retry logic (up to 3 attempts)
                        const updatedProfile = await this.handlePrivateKeyFailure(profile);
                        if (updatedProfile) {
                            await SshClientCache.inst.connect(updatedProfile);
                            return "active";
                        }
                    } catch (retryErr) {
                        imperative.Logger.getAppLogger().warn(
                            `Password authentication failed after 3 attempts for profile ${profile.name}: ${retryErr}`
                        );
                        vscode.window.showErrorMessage(
                            `Authentication failed for profile ${profile.name}. Both private key and password authentication failed.`
                        );
                        return "inactive";
                    }
                } else if (
                    profile.profile?.password &&
                    !profile.profile?.privateKey &&
                    `${err}`.includes("All configured authentication methods failed")
                ) {
                    const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi();
                    let finalErr: ImperativeError | undefined;
                    finalErr = new ImperativeError({
                        msg: ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, err as Error, {
                            templateArgs: { profileName: profile.name! },
                        }).message,
                    });

                    if (finalErr) {
                        const authSuccessful = await AuthHandler.promptForAuthentication(profile, {
                            authMethods: zoweExplorerApi.getExplorerExtenderApi().getProfilesCache() as unknown as IAuthMethods,
                            imperativeError: finalErr,
                        });
                        if (authSuccessful) {
                            return this.getStatus(profile, profileType);
                        }
                    }
                } else {
                    void SshErrorHandler.getInstance().handleError(
                        err as Error,
                        ZoweExplorerApiType.All,
                        "SSH connection status check failed",
                        false
                    );
                }

                return "inactive";
            }
        }
        return "unverified";
    }

    public get client(): Promise<ZSshClient> {
        if (this.profile == null) {
            throw new Error("Failed to create SSH client: no profile found");
        }
        return SshClientCache.inst.connect(this.profile);
    }

    public getSshSession(profile?: imperative.IProfileLoaded): SshSession {
        return ZSshUtils.buildSession((profile ?? this.profile)?.profile!);
    }

    /**
     * Handles private key authentication failure by prompting for password with retry logic
     * @param profile The profile that failed private key authentication
     * @returns Updated profile with password, or undefined if user cancelled or max attempts reached
     */
    private async handlePrivateKeyFailure(profile: imperative.IProfileLoaded): Promise<imperative.IProfileLoaded | undefined> {
        for (let attempts = 0; attempts < 3; attempts++) {
            try {
                // Prompt for password using VS Code's native input box
                const password = await vscode.window.showInputBox({
                    title: `${profile.profile?.user}@${profile.profile?.host}'s password:`,
                    password: true,
                    placeHolder: "Enter your password",
                    prompt: `Enter password for ${profile.profile?.user}@${profile.profile?.host}`,
                    ignoreFocusOut: true,
                });

                if (!password) {
                    return undefined; // User cancelled
                }

                // Create a new profile with password authentication (temporarily disabling private key)
                const testProfile: imperative.IProfileLoaded = {
                    ...profile,
                    profile: {
                        ...profile.profile!,
                        password,
                        // Temporarily disable private key for this connection attempt
                        privateKey: undefined,
                        keyPassphrase: undefined,
                    },
                };

                // Test the password by attempting a connection
                try {
                    await SshClientCache.inst.connect(testProfile);
                    // If we get here, the password is valid
                    return testProfile;
                } catch (authError) {
                    const authErrorMessage = `${authError}`;
                    if (authErrorMessage.includes("FOTS1668")) {
                        vscode.window.showErrorMessage("Password expired on target system");
                        return undefined;
                    }

                    vscode.window.showWarningMessage(`Password authentication failed (${attempts + 1}/3)`);
                }
            } catch (error) {
                imperative.Logger.getAppLogger().error(`Failed to handle private key failure: ${error}`);
                return undefined;
            }
        }

        // All attempts failed
        return undefined;
    }
}
