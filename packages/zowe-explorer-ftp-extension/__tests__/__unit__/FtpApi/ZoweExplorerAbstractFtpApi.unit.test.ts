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

import * as globals from "../../../src/globals";
import { AbstractFtpApi } from "../../../src/ZoweExplorerAbstractFtpApi";
import { FtpSession } from "../../../src/ftpSession";
import { FTPConfig, IZosFTPProfile } from "@zowe/zos-ftp-for-zowe-cli";
import { Gui, imperative, MessageSeverity } from "@zowe/zowe-explorer-api";

jest.mock("zos-node-accessor");
globals.LOGGER.getExtensionName = jest.fn().mockReturnValue("Zowe Explorer FTP Extension");

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
        expect(globals.SESSION_MAP.size).toBe(1);
    });

    it("should remove the record in sessionMap when call logout function.", async () => {
        const instance = new Dummy(profile);
        const result = instance.getSession(profile);
        const session = new FtpSession(result.ISession);
        globals.SESSION_MAP.clear();
        globals.SESSION_MAP.set(profile, session);
        session.releaseConnections = jest.fn();

        await instance.logout(session);

        expect(session.releaseConnections).toHaveBeenCalledTimes(1);
        expect(globals.SESSION_MAP.size).toBe(0);
    });

    it("should throw an error if the profile is not initialized for the FTP API", () => {
        const instance = new Dummy();
        expect(() => instance.getSession()).toThrow("Internal error: AbstractFtpApi instance was not initialized with a valid Zowe profile.");
    });

    it("should show a fatal message when trying to call getStatus with invalid credentials.", async () => {
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        jest.spyOn(FTPConfig, "connectFromArguments").mockImplementationOnce(
            jest.fn((_val) => {
                throw new Error("PASS command failed");
            })
        );
        const imperativeError = new imperative.ImperativeError({
            msg: "Rest API failure with HTTP(S) status 401 Username or password are not valid or expired",
            errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
        });
        const instance = new Dummy();
        instance.profile = {
            profile: {},
            message: undefined,
            type: undefined,
            failNotFound: undefined,
        };
        await expect(async () => {
            await instance.getStatus(undefined, "zftp");
        }).rejects.toThrow(imperativeError);
    });

    it("should show a different fatal message when trying to call getStatus and an exception occurs", async () => {
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        jest.spyOn(FTPConfig, "connectFromArguments").mockImplementationOnce(
            jest.fn((_prof) => {
                throw new Error("Something happened");
            })
        );
        const instance = new Dummy();
        const imperativeError = new imperative.ImperativeError({
            msg: "Rest API failure with HTTP(S) status 401 Username or password are not valid or expired",
            errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
        });
        instance.profile = {
            profile: {},
            message: undefined,
            type: undefined,
            failNotFound: undefined,
        };
        await expect(async () => {
            await instance.getStatus(undefined, "zftp");
        }).rejects.not.toThrow(imperativeError);
    });

    it("should show a fatal message when using checkedProfile on an invalid profile", () => {
        Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
        const instance = new Dummy();
        instance.profile = {
            message: "",
            type: "",
            failNotFound: true,
        };
        try {
            instance.checkedProfile();
            // intentionally throw error if checkedProfile did not throw error
            expect(true).toBe(false);
        } catch (err) {
            expect(err).not.toBeUndefined();
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe(
                "Zowe Explorer FTP Extension: Internal error: AbstractFtpApi instance was not initialized with a valid Zowe profile."
            );
        }
    });

    it("should return active from sessionStatus when getStatus is called w/ correct profile", async () => {
        Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
        const instance = new Dummy(profile);
        jest.spyOn(FTPConfig, "connectFromArguments").mockImplementationOnce(
            jest.fn(((_prof) => Promise.resolve({ test: "Test successful object" })) as any)
        );

        const status = await instance.getStatus(profile, "zftp");
        expect(status).toStrictEqual("active");
    });

    it("should return inactive from sessionStatus when getStatus is called w/ correct profile", async () => {
        Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
        const instance = new Dummy(profile);
        jest.spyOn(FTPConfig, "connectFromArguments").mockImplementationOnce(jest.fn(((_prof) => Promise.resolve(false)) as any));

        const status = await instance.getStatus(profile, "zftp");
        expect(status).toStrictEqual("inactive");
    });

    it("should return unverified from sessionStatus when getStatus is called w/ unexpected profile type", async () => {
        const instance = new Dummy(profile);

        const status = await instance.getStatus(profile, "test_profile_type");
        expect(status).toStrictEqual("unverified");
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

        await instance.ftpClient({ ...profile, profile: ftpProfile });

        expect(createConfigFromArgsSpy).toHaveBeenLastCalledWith(ftpProfile);
    });

    it("should close the connection", () => {
        const instance = new Dummy(profile);
        const connectionMock = jest.fn();
        instance.releaseConnection({
            close: connectionMock,
        });
        expect(connectionMock).toHaveBeenCalledTimes(1);
    });

    it("should return the profile type of 'zftp'", () => {
        const instance = new Dummy(profile);
        expect(instance.getProfileTypeName()).toEqual("zftp");
    });
});
