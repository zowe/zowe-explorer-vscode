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

import { FtpSession } from "../../src/ftpSession";
import { imperative } from "@zowe/cli";

describe("FtpSession Unit Tests - function releaseConnections", () => {
    it("should release all connecitons", () => {
        const testFtpSession = new FtpSession({
            hostname: "sample.com",
        } as imperative.ISession);
        const ussListConnectionMock = jest.fn();
        const mvsListConnectionMock = jest.fn();
        const jesListConnectionMock = jest.fn();
        Object.defineProperty(testFtpSession, "ussListConnection", {
            value: {
                close: ussListConnectionMock,
            },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(testFtpSession, "mvsListConnection", {
            value: {
                close: mvsListConnectionMock,
            },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(testFtpSession, "jesListConnection", {
            value: {
                close: jesListConnectionMock,
            },
            configurable: true,
            writable: true,
        });
        expect(testFtpSession.releaseConnections()).toEqual(undefined);
        expect(ussListConnectionMock).toBeCalledTimes(1);
        expect(mvsListConnectionMock).toBeCalledTimes(1);
        expect(jesListConnectionMock).toBeCalledTimes(1);
    });
});
