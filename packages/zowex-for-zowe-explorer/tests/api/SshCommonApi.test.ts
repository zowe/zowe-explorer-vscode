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

import { describe, afterEach, beforeEach, expect, it, vi } from "vitest";
import { SshCommonApi } from "../../src/api/SshCommonApi";
import { imperative, ZoweExplorerApiType, AuthHandler, ErrorCorrelator } from "@zowe/zowe-explorer-api";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import * as vscode from "vscode";
import { SshClientCache } from "../../src/SshClientCache";

describe("SshCommonApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getProfileTypeName", () => {
        it("should return the profile type name", () => {
            const commonApi = new SshCommonApi();
            expect(commonApi.getProfileTypeName()).toEqual("ssh");
        });
    });

    describe("getSession", () => {
        it("should generate a session from the SSH session", () => {
            const commonApi = new SshCommonApi();
            const mockSshSession: SshSession = { mISshSession: {}, ISshSession: { hostname: "fake-host", type: "none", port: 22 } } as any;
            const getSshSessionSpy = vi.spyOn(commonApi, "getSshSession").mockReturnValue(mockSshSession);

            const session = commonApi.getSession();

            expect(getSshSessionSpy).toHaveBeenCalledTimes(1);
            expect(session).toBeDefined();
            expect(session.ISession.hostname).toEqual("fake-host");
        });
    });

    describe("client", () => {
        it("should connect to the SSH client cache using the profile", async () => {
            const profile: imperative.IProfileLoaded = { type: "ssh", message: "test", failNotFound: true } as any;
            const commonApi = new SshCommonApi(profile);
            const fakeClient = { ds: {}, uss: {} };
            const connectSpy = vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: vi.fn().mockResolvedValue(fakeClient) } as any);

            const client = await commonApi.client;

            expect(connectSpy).toHaveBeenCalledTimes(1);
            expect((SshClientCache.inst as any).connect).toHaveBeenCalledWith(profile);
            expect(client).toEqual(fakeClient);
        });

        it("should throw when no profile is set", async () => {
            const commonApi = new SshCommonApi();
            let error: Error;

            try {
                await commonApi.client;
            } catch (err) {
                error = err as Error;
            }

            expect(error).toBeDefined();
            expect(error.message).toEqual("Failed to create SSH client: no profile found");
        });
    });

    describe("getSshSession", () => {
        it("should call buildSession", () => {
            const mockSession: SshSession = { mISshSession: {}, ISshSession: {}, buildSession: vi.fn() };
            const mockProfile = { type: "ssh", message: "test", failNotFound: true, profile: { data: "fake" } };
            const buildSessionSpy = vi.spyOn(ZSshUtils, "buildSession").mockImplementation((profile) => {
                return mockSession;
            });
            const commonApi = new SshCommonApi();

            const sess = commonApi.getSshSession(mockProfile);

            expect(sess).toEqual(mockSession);
            expect(buildSessionSpy).toHaveBeenCalledTimes(1);
            expect(buildSessionSpy).toHaveBeenCalledWith({ data: "fake" });
        });
    });

    describe("getStatus", () => {
        const profile: imperative.IProfileLoaded = { type: "ssh", name: "sshProf", message: "", failNotFound: true, profile: {} } as any;

        beforeEach(() => {
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: vi.fn() } as any);
        });

        it("should return 'unverified' for a non-ssh profile type", async () => {
            const commonApi = new SshCommonApi(profile);
            const status = await commonApi.getStatus(profile, "some-other-type");
            expect(status).toEqual("unverified");
        });

        it("should return 'active' when the connection succeeds", async () => {
            const commonApi = new SshCommonApi(profile);
            const status = await commonApi.getStatus(profile, "ssh");
            expect(status).toEqual("active");
            expect((SshClientCache.inst as any).connect).toHaveBeenCalledWith(profile);
        });

        it("should return 'inactive' on a generic connection error", async () => {
            const commonApi = new SshCommonApi(profile);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("boom")),
                handleError: vi.fn(),
            } as any);

            const status = await commonApi.getStatus(profile, "ssh");
            expect(status).toEqual("inactive");
        });

        it("should fall back to password auth and return 'active' after private key failure succeeds", async () => {
            const privateKeyProfile: imperative.IProfileLoaded = { ...profile, profile: { privateKey: "/k", host: "h", user: "u" } } as any;
            const commonApi = new SshCommonApi(privateKeyProfile);
            const connectMock = vi
                .fn()
                // first connect (private key) fails
                .mockRejectedValueOnce(new Error("private key failure"))
                // second connect (password) succeeds
                .mockResolvedValueOnce({} as never);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: connectMock } as any);
            vi.spyOn(ZSshUtils, "isPrivateKeyAuthFailure").mockReturnValue(true);
            vi.spyOn(commonApi as any, "handlePrivateKeyFailure").mockResolvedValue(privateKeyProfile);

            const status = await commonApi.getStatus(privateKeyProfile, "ssh");
            expect(status).toEqual("active");
        });

        it("should return 'inactive' when private key fallback fails after retries", async () => {
            const privateKeyProfile: imperative.IProfileLoaded = { ...profile, profile: { privateKey: "/k", host: "h", user: "u" } } as any;
            const commonApi = new SshCommonApi(privateKeyProfile);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("private key failure")),
            } as any);
            vi.spyOn(ZSshUtils, "isPrivateKeyAuthFailure").mockReturnValue(true);
            vi.spyOn(commonApi as any, "handlePrivateKeyFailure").mockResolvedValue(undefined);

            const status = await commonApi.getStatus(privateKeyProfile, "ssh");
            expect(status).toEqual("inactive");
        });

        it("should handle private key fallback throwing and return 'inactive'", async () => {
            const privateKeyProfile: imperative.IProfileLoaded = { ...profile, profile: { privateKey: "/k", host: "h", user: "u" } } as any;
            const commonApi = new SshCommonApi(privateKeyProfile);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("private key failure")),
            } as any);
            vi.spyOn(ZSshUtils, "isPrivateKeyAuthFailure").mockReturnValue(true);
            vi.spyOn(commonApi as any, "handlePrivateKeyFailure").mockRejectedValue(new Error("retry failed"));

            const status = await commonApi.getStatus(privateKeyProfile, "ssh");
            expect(status).toEqual("inactive");
        });

        it("should prompt for authentication when password-only auth fails", async () => {
            const passwordProfile: imperative.IProfileLoaded = { ...profile, profile: { password: "p", host: "h" } } as any;
            const commonApi = new SshCommonApi(passwordProfile);
            const connectMock = vi
                .fn()
                // first getStatus attempt: connect fails (triggers auth prompt)
                .mockRejectedValueOnce(new Error("All configured authentication methods failed"))
                // recursive getStatus attempt after successful auth: connect succeeds
                .mockResolvedValueOnce({} as never);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: connectMock } as any);
            vi.spyOn(ZSshUtils, "isPrivateKeyAuthFailure").mockReturnValue(false);
            const correlateSpy = vi.spyOn(ErrorCorrelator.getInstance(), "correlateError").mockReturnValue({ message: "correlated" } as any);
            const promptSpy = vi.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValue(true);

            const status = await commonApi.getStatus(passwordProfile, "ssh");
            expect(correlateSpy).toHaveBeenCalledWith(ZoweExplorerApiType.All, expect.any(Error), expect.any(Object));
            expect(promptSpy).toHaveBeenCalledTimes(1);
            expect(status).toEqual("active");
        });

        it("should return 'inactive' when auth prompt is not successful", async () => {
            const passwordProfile: imperative.IProfileLoaded = { ...profile, profile: { password: "p", host: "h" } } as any;
            const commonApi = new SshCommonApi(passwordProfile);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("All configured authentication methods failed")),
            } as any);
            vi.spyOn(ZSshUtils, "isPrivateKeyAuthFailure").mockReturnValue(false);
            vi.spyOn(ErrorCorrelator.getInstance(), "correlateError").mockReturnValue({ message: "correlated" } as any);
            vi.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValue(false);

            const status = await commonApi.getStatus(passwordProfile, "ssh");
            expect(status).toEqual("inactive");
        });
    });

    describe("handlePrivateKeyFailure", () => {
        const profile: imperative.IProfileLoaded = {
            type: "ssh",
            name: "sshProf",
            message: "",
            failNotFound: true,
            profile: { host: "host", user: "user" },
        } as any;

        beforeEach(() => {
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: vi.fn() } as any);
        });

        it("should return undefined when the user cancels the password prompt", async () => {
            const commonApi = new SshCommonApi(profile);
            vi.spyOn(vscode.window, "showInputBox").mockResolvedValue(undefined);

            const result = await (commonApi as any).handlePrivateKeyFailure(profile);
            expect(result).toBeUndefined();
        });

        it("should return the updated profile when the password connects successfully", async () => {
            const commonApi = new SshCommonApi(profile);
            vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("my-pass");
            const connectMock = vi.fn().mockResolvedValue({});
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: connectMock } as any);

            const result = await (commonApi as any).handlePrivateKeyFailure(profile);
            expect(connectMock).toHaveBeenCalledWith(
                expect.objectContaining({ profile: expect.objectContaining({ password: "my-pass", privateKey: undefined }) })
            );
            expect(result).toBeDefined();
            expect(result.profile.password).toEqual("my-pass");
        });

        it("should return undefined when password auth keeps failing", async () => {
            const commonApi = new SshCommonApi(profile);
            vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("bad-pass");
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("auth failed")),
            } as any);
            const warningSpy = vi.spyOn(vscode.window, "showWarningMessage").mockReturnValue(undefined);

            const result = await (commonApi as any).handlePrivateKeyFailure(profile);
            expect(result).toBeUndefined();
            expect(warningSpy).toHaveBeenCalled();
        });

        it("should return undefined immediately when the password has expired (FOTS1668)", async () => {
            const commonApi = new SshCommonApi(profile);
            vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("bad-pass");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error("FOTS1668 password expired")),
            } as any);

            const result = await (commonApi as any).handlePrivateKeyFailure(profile);
            expect(result).toBeUndefined();
            expect(errorSpy).toHaveBeenCalledWith("Password expired on target system");
        });

        it("should return undefined and log when an unexpected error occurs during prompting", async () => {
            const commonApi = new SshCommonApi(profile);
            const loggerErrorSpy = vi.fn();
            vi.spyOn(imperative.Logger, "getAppLogger").mockReturnValue({ error: loggerErrorSpy } as any);
            vi.spyOn(vscode.window, "showInputBox").mockImplementation(() => {
                throw new Error("unexpected");
            });

            const result = await (commonApi as any).handlePrivateKeyFailure(profile);
            expect(result).toBeUndefined();
            expect(loggerErrorSpy).toHaveBeenCalled();
        });
    });
});
