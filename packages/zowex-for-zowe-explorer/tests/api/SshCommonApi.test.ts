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

import { describe, afterEach, expect, it, vi } from "vitest";
import { SshCommonApi } from "../../src/api/SshCommonApi";
import { imperative } from "@zowe/zowe-explorer-api";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";

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
        it("should generate a session", () => {
            const commonApi = new SshCommonApi();
            const getSshSessionSpy = vi.spyOn(commonApi, "getSession");

            const profile: imperative.IProfileLoaded = { type: "ssh", message: "test", failNotFound: true };
            const mockSession: SshSession = { mISshSession: {}, ISshSession: {}, buildSession: vi.fn() };

            getSshSessionSpy.mockReturnValue(mockSession);
            const session = commonApi.getSession(profile);

            expect(getSshSessionSpy).toHaveBeenCalledTimes(1);
            expect(getSshSessionSpy).toHaveBeenCalledWith(profile);
            expect(session).toBeDefined();
        });
    });

    //describe("getStatus", () => {});

    //describe("client", () => {});

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

    //describe("handlePrivateKeyFailure", () => {});

    describe("buildRequestError", () => {
        it("should build a request error (error)", () => {
            const commonApi = new SshCommonApi();
            const err = new Error("test error");

            const error = (commonApi as unknown).buildRequestError(err);

            expect(error).toEqual(err);
        });

        it("should build a request error (ImperativeError)", () => {
            const commonApi = new SshCommonApi();
            const err = new imperative.ImperativeError({ msg: "test error", additionalDetails: "fake" });

            const error = (commonApi as unknown).buildRequestError(err);

            expect(error).not.toEqual(err);
            expect(error.message).toContain(err.message);
            expect(error.message).toContain(err.additionalDetails);
        });
    });
});
