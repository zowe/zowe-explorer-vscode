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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { imperative } from "@zowe/cli";
import { FTPConfig, IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli";
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { sessionMap } from "./extension";
import { FtpSession } from "./ftpSession";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";

export interface ConnectionType {
    close(): void;
}

export abstract class AbstractFtpApi implements ZoweExplorerApi.ICommon {
    private session?: FtpSession;

    public constructor(public profile?: imperative.IProfileLoaded) {}

    public static getProfileTypeName(): string {
        return "zftp";
    }

    public getSession(profile?: imperative.IProfileLoaded): FtpSession {
        this.session = sessionMap.get(this.profile);
        if (!this.session) {
            const ftpProfile = (profile || this.profile)?.profile;
            if (!ftpProfile) {
                throw new ZoweFtpExtensionError("Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile.");
            }

            this.session = new FtpSession({
                hostname: ftpProfile.host,
                port: ftpProfile.port,
                user: ftpProfile.user,
                password: ftpProfile.password,
                rejectUnauthorized: ftpProfile.rejectUnauthorized,
            });
            sessionMap.set(this.profile, this.session);
        }
        return this.session;
    }

    public getProfileTypeName(): string {
        return AbstractFtpApi.getProfileTypeName();
    }

    public checkedProfile(): imperative.IProfileLoaded {
        if (!this.profile?.profile) {
            throw new ZoweFtpExtensionError("Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile.");
        }
        return this.profile;
    }

    public ftpClient(profile: imperative.IProfileLoaded): Promise<unknown> {
        const ftpProfile = profile.profile as IZosFTPProfile;
        return FTPConfig.connectFromArguments(ftpProfile);
    }

    public releaseConnection<T extends ConnectionType>(connection: T): void {
        if (connection != null) {
            connection.close();
            return;
        }
    }

    public logout(_session): Promise<void> {
        const ftpsession = sessionMap.get(this.profile);
        if (ftpsession !== undefined) {
            ftpsession.releaseConnections();
            sessionMap.delete(this.profile);
        }
        return;
    }

    public async getStatus(validateProfile?: imperative.IProfileLoaded, profileType?: string): Promise<string> {
        if (profileType === "zftp") {
            let sessionStatus;
            /* check the ftp connection to validate the profile */
            try {
                sessionStatus = await this.ftpClient(this.checkedProfile());
            } catch (e) {
                const imperativeError = new imperative.ImperativeError({
                    msg: "Rest API failure with HTTP(S) status 401 Authentication error.",
                    errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
                });
                throw imperativeError;
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
