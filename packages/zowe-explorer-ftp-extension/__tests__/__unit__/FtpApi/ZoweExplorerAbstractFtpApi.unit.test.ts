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

import { sessionMap } from "../../../src/extension";
import { AbstractFtpApi } from "../../../src/ZoweExplorerAbstractFtpApi";
import { FtpSession } from "../../../src/ftpSession";
import { FTPConfig, IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli";

jest.mock("zos-node-accessor");

class Dummy extends AbstractFtpApi {}

const profile = {
    message: "",
    failNotFound: true,
    type: "zftp",
    profile: { host: "1.1.1.1", user: "user", password: "password", port: "21", rejectUnauthorized: false },
};

describe("AbstractFtpApi", () => {
    it("should add a record in sessionMap when call getSession function.", () => {
        const instance = new Dummy();
        const result = instance.getSession(profile);

        expect(result).toBeInstanceOf(FtpSession);
        expect(result.ISession.hostname).toBe("1.1.1.1");
        expect(sessionMap.size).toBe(1);
    });

    it("should remove the record in sessionMap when call logout function.", async () => {
        const instance = new Dummy();
        const result = instance.getSession(profile);
        const session = new FtpSession(result.ISession);
        sessionMap.get = jest.fn().mockReturnValue(session);
        session.releaseConnections = jest.fn();

        await instance.logout(session);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(session.releaseConnections).toBeCalledTimes(1);
        expect(sessionMap.size).toBe(0);
    });

    it("should load all properties from zftp profile", async () => {
        const ftpProfile: IZosFTPProfile = {
            host: "example.com",
            port: 21,
            user: "fakeUser",
            password: "fakePass",
            secureFtp: true,
            connectionTimeout: 60000,
            rejectUnauthorized: false,
            serverName: "example2.com",
        };
        const createConfigFromArgsSpy = jest.spyOn(FTPConfig, "createConfigFromArguments");
        const instance = new Dummy();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        await instance.ftpClient({ ...profile, profile: ftpProfile });

        expect(createConfigFromArgsSpy).toHaveBeenLastCalledWith(ftpProfile);
    });
});
