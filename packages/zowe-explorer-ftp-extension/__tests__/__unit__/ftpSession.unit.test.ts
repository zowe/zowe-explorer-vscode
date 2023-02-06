import { FtpSession } from "../../src/ftpSession";
import { AbstractFtpApi } from "../../src/ZoweExplorerAbstractFtpApi";
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
