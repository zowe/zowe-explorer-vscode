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

class Dummy extends AbstractFtpApi {}

const profile = {
    message: "",
    failNotFound: true,
    type: "zftp",
    profile: { host: "1.1.1.1", user: "user", password: "password", port: "21", rejectUnauthorized: false },
};
describe("AbstractFtpApi", () => {
    it("should add a record in sessionMap when call getSession function.", async () => {
        let instance;
        instance = new Dummy();
        const result = await instance.getSession(profile);

        expect(result).toBeInstanceOf(FtpSession);
        expect(result.mISession.hostname).toBe("1.1.1.1");
        expect(sessionMap.size).toBe(1);
    });

    it("should remove the record in sessionMap when call logout function.", async () => {
        let instance;
        instance = new Dummy();
        const result = await instance.getSession(profile);
        const session = new FtpSession(result.mISession);
        sessionMap.get = jest.fn().mockReturnValue(session);
        session.releaseConnections = jest.fn();

        await instance.logout(session);

        expect(session.releaseConnections).toBeCalledTimes(1);
        expect(sessionMap.size).toBe(0);
    });
});
