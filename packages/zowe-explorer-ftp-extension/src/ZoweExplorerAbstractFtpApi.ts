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
import { FTPConfig, zosNodeAccessor } from "@zowe/zos-ftp-for-zowe-cli";
import * as crypto from "crypto";
import { imperative, MainframeInteraction } from "@zowe/zowe-explorer-api";
import * as globals from "./globals";
import { FtpSession } from "./ftpSession";
import { ZoweFtpExtensionError } from "./ZoweFtpExtensionError";

export interface ConnectionType {
    close(): void;
}

export abstract class AbstractFtpApi implements MainframeInteraction.ICommon {
    private session?: FtpSession;

    public constructor(public profile?: imperative.IProfileLoaded) {}

    public static getProfileTypeName(): string {
        return "zftp";
    }

    public getSession(profile?: imperative.IProfileLoaded): FtpSession {
        const ftpProfile = profile ?? this.profile;
        if (ftpProfile == null) {
            throw new ZoweFtpExtensionError("Internal error: AbstractFtpApi instance was not initialized with a valid Zowe profile.");
        }

        this.session = globals.SESSION_MAP.get(ftpProfile);
        const loadedProfile = ftpProfile.profile;
        if (this.session == null && loadedProfile != null) {
            this.session = new FtpSession({
                hostname: loadedProfile.host,
                port: loadedProfile.port,
                user: loadedProfile.user,
                password: loadedProfile.password,
                rejectUnauthorized: loadedProfile.rejectUnauthorized,
            });
            globals.SESSION_MAP.set(ftpProfile, this.session);
        }
        return this.session;
    }

    protected hashBuffer(buffer: Buffer): string {
        const hash = crypto.createHash("sha256");
        hash.update(buffer);
        return hash.digest("hex");
    }

    public getProfileTypeName(): string {
        return AbstractFtpApi.getProfileTypeName();
    }

    public checkedProfile(): imperative.IProfileLoaded {
        if (!this.profile?.profile) {
            throw new ZoweFtpExtensionError("Internal error: AbstractFtpApi instance was not initialized with a valid Zowe profile.");
        }
        return this.profile;
    }

    public ftpClient(profile: imperative.IProfileLoaded): Promise<zosNodeAccessor.ZosAccessor> {
        const ftpProfile = profile.profile as imperative.ICommandArguments;
        return FTPConfig.connectFromArguments(ftpProfile);
    }

    public releaseConnection<T extends ConnectionType>(connection: T): void {
        if (connection != null) {
            connection.close();
            return;
        }
    }

    public logout(_session): Promise<void> {
        const ftpsession = globals.SESSION_MAP.get(this.profile);
        if (ftpsession !== undefined) {
            ftpsession.releaseConnections();
            globals.SESSION_MAP.delete(this.profile);
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
                if (e instanceof Error && e.message.includes("PASS command failed")) {
                    const imperativeError = new imperative.ImperativeError({
                        msg: "Rest API failure with HTTP(S) status 401 Username or password are not valid or expired",
                        errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
                    });
                    throw imperativeError;
                }
                throw e;
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
