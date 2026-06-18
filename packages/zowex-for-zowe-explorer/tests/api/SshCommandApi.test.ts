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
import { SshCommandApi } from "../../src/api/SshCommandApi";

describe("SshCommandApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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

        it("should propagate a rejection from the TSO client", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            const issueCmdSpy = vi.fn().mockRejectedValue(new Error("tso failure"));
            vi.spyOn(commandApi, "client", "get").mockResolvedValue({ tso: { issueCmd: issueCmdSpy } });

            await expect(commandApi.issueTsoCommandWithParms("test")).rejects.toThrow("tso failure");
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
        it("should issue a unix command through the SSH client", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            const issueCmdSpy = vi.fn().mockResolvedValue({ data: "fake-output" });
            const clientSpy = vi.spyOn(commandApi, "client", "get").mockResolvedValue({ uss: { issueCmd: issueCmdSpy } });

            const response = await commandApi.issueUnixCommand("ls", "/u/user");

            expect(clientSpy).toHaveBeenCalledTimes(1);
            expect(issueCmdSpy).toHaveBeenCalledTimes(1);
            expect(issueCmdSpy).toHaveBeenCalledWith({ commandText: "cd '/u/user' && ls" });
            expect(response).toEqual("fake-output");
        });

        it("should return an empty string when no data is returned", async () => {
            const commandApi = new SshCommandApi({ type: "ssh", message: "", failNotFound: true, profile: { profile: { user: "fake" } } });
            vi.spyOn(commandApi, "client", "get").mockResolvedValue({ uss: { issueCmd: vi.fn().mockResolvedValue({}) } });

            const response = await commandApi.issueUnixCommand("ls", "/u/user");

            expect(response).toEqual("");
        });
    });

    describe("sshProfileRequired", () => {
        it("should return false because an SSH session is already in context", () => {
            const commandApi = new SshCommandApi();
            expect(commandApi.sshProfileRequired()).toEqual(false);
        });
    });
});
