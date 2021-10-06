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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as imperative from "@zowe/imperative";
import { FTPConfig, IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli";
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";

export abstract class AbstractFtpApi implements ZoweExplorerApi.ICommon {
    private session?: imperative.Session;

    public constructor(public profile?: imperative.IProfileLoaded) {}

    public static getProfileTypeName(): string {
        return "zftp";
    }

    public getSession(profile?: imperative.IProfileLoaded): imperative.Session {
        if (!this.session) {
            const ftpProfile = (profile || this.profile)?.profile;
            if (!ftpProfile) {
                throw new Error(
                    "Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile."
                );
            }
            this.session = new imperative.Session({
                hostname: ftpProfile.host,
                port: ftpProfile.port,
                user: ftpProfile.user,
                password: ftpProfile.password,
                rejectUnauthorized: ftpProfile.rejectUnauthorized,
            });
        }
        return this.session;
    }

    public getProfileTypeName(): string {
        return AbstractFtpApi.getProfileTypeName();
    }

    public checkedProfile(): imperative.IProfileLoaded {
        if (!this.profile?.profile) {
            throw new Error(
                "Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile."
            );
        }
        return this.profile;
    }

    public async ftpClient(profile: imperative.IProfileLoaded): Promise<any> {
        const ftpProfile = profile.profile as IZosFTPProfile;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await FTPConfig.connectFromArguments({
            host: ftpProfile.host,
            user: ftpProfile.user,
            password: ftpProfile.password,
            port: ftpProfile.port,
            secureFtp: ftpProfile.secureFtp,
        });
    }

    public releaseConnection(connection: any): void {
        if (connection != null) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            connection.close();
            return;
        }
    }

    public async getStatus(validateProfile?: imperative.IProfileLoaded, profileType?: string): Promise<string> {
        if (profileType === "zftp") {
            let sessionStatus;
            /* check the ftp connection to validate the profile */
            try {
                sessionStatus = await this.ftpClient(this.checkedProfile());
            } catch (e) {
                /* The errMsg should be consistent with the errMsg in ProfilesUtils.ts of zowe-explorer */
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                if (e.message.indexOf("failed") !== -1 || e.message.indexOf("missing") !== -1) {
                    const errMsg =
                        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                        "Invalid Credentials. Please ensure the username and password for " +
                        validateProfile?.name +
                        " are valid or this may lead to a lock-out.";

                    throw new imperative.ImperativeError({ msg: errMsg, causeErrors: [e] });
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    throw new imperative.ImperativeError({ msg: e.message, causeErrors: [e] });
                }
            }
            if (sessionStatus) {
                return "active";
            } else {
                return "inactive";
            }
        } else {
            return "unverified";
        }
    }
}
