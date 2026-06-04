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

import { describe, expect, it, vi } from "vitest";
import { SshCommandApi } from "../../src/api/SshCommandApi";

describe("SshCommandApi", () => {
    describe("issueTsoCommandWithParms", () => {
        it("should attempt to issue the TSO command", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            const issueCmdSpy = vi.fn();
            const issueCommandSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ tso: { issueCmd: issueCmdSpy } });

            issueCmdSpy.mockResolvedValue({ data: "fake-data" });
            const response = await commandApi.issueTsoCommandWithParms("test");

            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCommandSpy).toHaveBeenCalledTimes(1);
            expect(response).toEqual({ success: true, commandResponse: "fake-data", startReady: false, zosmfResponse: [] });
        });
    });

    describe("issueMvsCommand", () => {
        it("should attempt to issue an MVS command (no user)", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: undefined });
            const issueCmdSpy = vi.fn();
            const issueCommandSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ console: { issueCmd: issueCmdSpy } });

            issueCmdSpy.mockResolvedValue({ data: "fake-data" });
            const response = await commandApi.issueMvsCommand("test");

            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCommandSpy).toHaveBeenCalledTimes(1);
            expect(issueCmdSpy).toHaveBeenCalledWith({ commandText: "test", consoleName: "ZOWE00CN" });
            expect(response).toEqual({ success: true, commandResponse: "fake-data", zosmfResponse: [{ "cmd-response": "fake-data" }] });
        });

        it("should attempt to issue an MVS command (user)", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { user: "fake" } });
            const issueCmdSpy = vi.fn();
            const issueCommandSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ console: { issueCmd: issueCmdSpy } });

            issueCmdSpy.mockResolvedValue({ data: "fake-data" });
            const response = await commandApi.issueMvsCommand("test");

            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCommandSpy).toHaveBeenCalledTimes(1);
            expect(issueCmdSpy).toHaveBeenCalledWith({ commandText: "test", consoleName: "faCN" });
            expect(response).toEqual({ success: true, commandResponse: "fake-data", zosmfResponse: [{ "cmd-response": "fake-data" }] });
        });

        it("should attempt to issue an MVS command (console name)", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            const issueCmdSpy = vi.fn();
            const issueCommandSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ console: { issueCmd: issueCmdSpy } });

            issueCmdSpy.mockResolvedValue({ data: "fake-data" });
            const response = await commandApi.issueMvsCommand("test", "console");

            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCommandSpy).toHaveBeenCalledTimes(1);
            expect(issueCmdSpy).toHaveBeenCalledWith({ commandText: "test", consoleName: "console" });
            expect(response).toEqual({ success: true, commandResponse: "fake-data", zosmfResponse: [{ "cmd-response": "fake-data" }] });
        });

        it("should handle a failure", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            const issueCmdSpy = vi.fn();
            const issueCommandSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ console: { issueCmd: issueCmdSpy } });

            issueCmdSpy.mockRejectedValue({ message: "fake error" });
            const response = await commandApi.issueMvsCommand("test");

            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCommandSpy).toHaveBeenCalledTimes(1);
            expect(response).toEqual({ success: false, commandResponse: "fake error", zosmfResponse: [{ "cmd-response": "fake error" }] });
        });
    });

    describe("issueUnixCommand", () => {
        it("should throw an error due to not being implemented", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            let error: Error;

            try {
                await commandApi.issueUnixCommand("fake", "fake");
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.message).toEqual("Method not implemented.");
        });
    });

    describe("sshProfileRequired", () => {
        it("should always say an SSH profile is required", () => {
            const commandApi = new SshCommandApi();
            expect(commandApi.sshProfileRequired()).toEqual(true);
        });
    });
});
