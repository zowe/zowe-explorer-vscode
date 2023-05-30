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
import { Gui, ICommon, MessageSeverity } from "@zowe/zowe-explorer-api";
import * as globals from "./globals";
import { FtpSession } from "./ftpSession";

export interface ConnectionType {
    close(): void;
}

export abstract class AbstractFtpApi implements ICommon {
    private session?: FtpSession;

    public constructor(public profile?: imperative.IProfileLoaded) {}

    public static getProfileTypeName(): string {
        return "zftp";
    }

    public getSession(profile?: imperative.IProfileLoaded): FtpSession {
        this.session = globals.SESSION_MAP.get(this.profile);
        if (!this.session) {
            const ftpProfile = (profile || this.profile)?.profile;
            if (!ftpProfile) {
                void Gui.showMessage("Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile.", {
                    severity: MessageSeverity.FATAL,
                    logger: globals.LOGGER,
                });
                throw new Error();
            }

            this.session = new FtpSession({
                hostname: ftpProfile.host,
                port: ftpProfile.port,
                user: ftpProfile.user,
                password: ftpProfile.password,
                rejectUnauthorized: ftpProfile.rejectUnauthorized,
            });
            globals.SESSION_MAP.set(this.profile, this.session);
        }
        return this.session;
    }

    public getProfileTypeName(): string {
        return AbstractFtpApi.getProfileTypeName();
    }

    public checkedProfile(): imperative.IProfileLoaded {
        if (!this.profile?.profile) {
            void Gui.showMessage("Internal error: ZoweVscFtpRestApi instance was not initialized with a valid Zowe profile.", {
                severity: MessageSeverity.FATAL,
                logger: globals.LOGGER,
            });
            throw new Error();
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
                if (e instanceof Error) {
                    /* The errMsg should be consistent with the errMsg in ProfilesUtils.ts of zowe-explorer */
                    if (e.message.indexOf("failed") !== -1 || e.message.indexOf("missing") !== -1) {
                        const errMsg =
                            "Invalid Credentials. Please ensure the username and password for " +
                            validateProfile?.name +
                            " are valid or this may lead to a lock-out.";
                        await Gui.errorMessage(errMsg, { logger: globals.LOGGER });
                        throw new Error();
                    } else {
                        await Gui.errorMessage(e.message, { logger: globals.LOGGER });
                        throw new Error();
                    }
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
