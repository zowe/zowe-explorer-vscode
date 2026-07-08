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

import { ImperativeError } from "@zowe/imperative";
import { ErrorCorrelator, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { SshErrorHandler } from "../src/SshErrorHandler";

// Mock Zowe Explorer API
vi.mock("@zowe/zowe-explorer-api", () => ({
    ZoweExplorerApiType: {
        All: "all",
        Mvs: "mvs",
        Uss: "uss",
        Jes: "jes",
        Command: "cmd",
    },
    ErrorCorrelator: {
        getInstance: vi.fn(),
    },
}));

describe("SshErrorHandler", () => {
    let errorHandler: SshErrorHandler;
    let mockGetInstance: MockedFunction<typeof ErrorCorrelator.getInstance>;
    let mockErrorCorrelator: {
        displayError: MockedFunction<any>;
    };

    beforeEach(() => {
        // Reset singleton instance
        errorHandler = SshErrorHandler.getInstance();

        // Setup mocks
        mockGetInstance = vi.mocked(ErrorCorrelator.getInstance);
        mockErrorCorrelator = {
            displayError: vi.fn(),
        };

        mockGetInstance.mockReturnValue(mockErrorCorrelator as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("getInstance", () => {
        it("should return singleton instance", () => {
            const instance1 = SshErrorHandler.getInstance();
            const instance2 = SshErrorHandler.getInstance();
            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(SshErrorHandler);
        });
    });

    describe("handleError", () => {
        it("should use error correlator for Error objects", async () => {
            const testError = new Error("FOTS4241 Authentication failed");
            const expectedResult = { userResponse: "Retry" };

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.All, "SSH connection", true);

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.All, testError, {
                profileType: "ssh",
                additionalContext: "SSH connection",
                allowRetry: true,
                templateArgs: { profileName: "" },
            });
            expect(result).toBe("Retry");
        });

        it("should handle string errors with correlator", async () => {
            const testError = "FOTS4240 kex_prop2buf: error";
            const expectedResult = { userResponse: "Troubleshoot" };

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.Jes, undefined, false);

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.Jes, testError, {
                profileType: "ssh",
                additionalContext: undefined,
                allowRetry: false,
                templateArgs: { profileName: "" },
            });
            expect(result).toBe("Troubleshoot");
        });

        it("should pass through correlator response", async () => {
            const testError = new Error("Connection timeout");
            const expectedResult = { userResponse: "Show Details" };

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.Mvs);

            expect(result).toBe("Show Details");
        });

        it("should handle correlator response without user response", async () => {
            const testError = new Error("Network error");
            const expectedResult = {}; // No userResponse property

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.Uss);

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.Uss, testError, {
                profileType: "ssh",
                additionalContext: undefined,
                allowRetry: false,
                templateArgs: { profileName: "" },
            });
            expect(result).toBeUndefined();
        });

        it("should use default allowRetry value of false", async () => {
            const testError = new Error("Default retry test");
            const expectedResult = { userResponse: "OK" };

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            await errorHandler.handleError(testError, ZoweExplorerApiType.Command, "Test context");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.Command, testError, {
                profileType: "ssh",
                additionalContext: "Test context",
                allowRetry: false,
                templateArgs: { profileName: "" },
            });
        });

        it("should pass the given profile name as a template arg", async () => {
            const testError = new Error("Invalid credentials");
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Troubleshoot" });

            await errorHandler.handleError(testError, ZoweExplorerApiType.All, "SSH connection", false, "myProfile");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.All, testError, {
                profileType: "ssh",
                additionalContext: "SSH connection",
                allowRetry: false,
                templateArgs: { profileName: "myProfile" },
            });
        });
    });

    describe("isFatalError", () => {
        it("should identify fatal OpenSSH error codes", () => {
            const fatalErrors = [
                "FOTS4240 kex_prop2buf: error",
                "FOTS4241 Authentication failed",
                "FOTS4134 Client version uses unsafe key agreement",
                "FOTS4231 Server version uses unsafe key agreement",
                "FOTS4203 Server failed to confirm ownership",
                "FOTS4314 xreallocarray: out of memory",
                "FOTS4315 xrecallocarray: out of memory",
                "FOTS4216 Couldn't allocate session state",
                "FOTS4311 could not allocate state",
                "FOTS4154 ssh_packet_set_connection failed",
                "FOTS4150 kex_setup failed",
                "FOTS4312 cipher_init failed",
                "FSUM6260 write error on file",
            ];

            fatalErrors.forEach((errorMsg) => {
                expect(errorHandler.isFatalError(errorMsg)).toBe(true);
                expect(errorHandler.isFatalError(new Error(errorMsg))).toBe(true);
            });
        });

        it("should return false for timeout errors", () => {
            expect(errorHandler.isFatalError("Request timed out after 200 ms")).toBe(false);
        });

        it("should not identify non-fatal errors as fatal", () => {
            const nonFatalErrors = [
                "FOTS1681 chdir error",
                "Connection timeout",
                "Network unreachable",
                "FOTS9999 Unknown error",
                "Some other error message",
            ];

            nonFatalErrors.forEach((errorMsg) => {
                expect(errorHandler.isFatalError(errorMsg)).toBe(false);
                expect(errorHandler.isFatalError(new Error(errorMsg))).toBe(false);
            });
        });

        it("should handle partial error code matches", () => {
            expect(errorHandler.isFatalError("Prefix FOTS4241 Authentication failed suffix")).toBe(true);
            expect(errorHandler.isFatalError("Some message with FSUM6260 in the middle")).toBe(true);
        });

        it("should classify any literal SshErrors key substring as fatal (e.g. FOTS1668, EDC5133I)", () => {
            expect(errorHandler.isFatalError("FOTS1668 Your password has expired")).toBe(true);
            expect(errorHandler.isFatalError("EDC5133I no space left on device")).toBe(true);
            expect(errorHandler.isFatalError(new Error("EDC5133I no space left on device"))).toBe(true);
        });

        it("should not treat the REQUEST_TIMEOUT key as fatal when the message is an actual timeout", () => {
            expect(errorHandler.isFatalError("Request timed out after 5000 ms")).toBe(false);
        });
    });

    describe("extractErrorCode", () => {
        it("should extract FOTS error codes", () => {
            expect(errorHandler.extractErrorCode("FOTS4241 Authentication failed")).toBe("FOTS4241");
            expect(errorHandler.extractErrorCode("Error: FOTS4240 kex_prop2buf")).toBe("FOTS4240");
            expect(errorHandler.extractErrorCode(new Error("FOTS4314 out of memory"))).toBe("FOTS4314");
        });

        it("should extract FSUM error codes", () => {
            expect(errorHandler.extractErrorCode("FSUM6260 write error")).toBe("FSUM6260");
            expect(errorHandler.extractErrorCode("FSUM7351 not found")).toBe("FSUM7351");
            expect(errorHandler.extractErrorCode(new Error("FSUM1234 test error"))).toBe("FSUM1234");
        });

        it("should return undefined for non-matching errors", () => {
            expect(errorHandler.extractErrorCode("Connection timeout")).toBeUndefined();
            expect(errorHandler.extractErrorCode("Network error")).toBeUndefined();
            expect(errorHandler.extractErrorCode(new Error("Generic error"))).toBeUndefined();
            expect(errorHandler.extractErrorCode("INVALID1234 bad format")).toBeUndefined();
        });

        it("should return first match when multiple codes present", () => {
            expect(errorHandler.extractErrorCode("FOTS4241 then FSUM6260")).toBe("FOTS4241");
            expect(errorHandler.extractErrorCode("FSUM7351 and FOTS4240")).toBe("FSUM7351");
        });
    });

    describe("createErrorCallback", () => {
        it("should create callback that handles errors and returns retry decision", async () => {
            const testError = new Error("Test error");
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Retry" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.All, "Upload operation");

            const shouldRetry = await callback(testError, "file transfer");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.All, testError, {
                profileType: "ssh",
                additionalContext: "Upload operation (file transfer)",
                allowRetry: true,
                templateArgs: { profileName: "" },
            });
            expect(shouldRetry).toBe(true);
        });

        it("should forward the given profile name as a template arg", async () => {
            const testError = new Error("Test error");
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Retry" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.All, "Upload operation", "myProfile");
            await callback(testError, "file transfer");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(
                ZoweExplorerApiType.All,
                testError,
                expect.objectContaining({ templateArgs: { profileName: "myProfile" } })
            );
        });

        it("should return false when user chooses not to retry", async () => {
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Show Details" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Jes);
            const shouldRetry = await callback(new Error("Job failed"), "job submission");

            expect(shouldRetry).toBe(false);
        });

        it("should return false when user response is undefined", async () => {
            mockErrorCorrelator.displayError.mockResolvedValue({});

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Mvs);
            const shouldRetry = await callback(new Error("Dataset error"), "dataset operation");

            expect(shouldRetry).toBe(false);
        });

        it("should combine context strings correctly", async () => {
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Cancel" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Uss, "File operations");

            await callback(new Error("Permission denied"), "chmod command");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(
                ZoweExplorerApiType.Uss,
                expect.any(Error),
                expect.objectContaining({
                    additionalContext: "File operations (chmod command)",
                })
            );
        });

        it("should handle callback without base context", async () => {
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Retry" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Command);
            await callback(new Error("Command failed"), "execute command");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(
                ZoweExplorerApiType.Command,
                expect.any(Error),
                expect.objectContaining({
                    additionalContext: "execute command",
                })
            );
        });
    });

    describe("isTimeoutError", () => {
        it("should return true for timeout errors", () => {
            expect(errorHandler.isTimeoutError("Request timed out after")).toBe(true);
            expect(errorHandler.isTimeoutError(new Error("Request timed out after 200 ms"))).toBe(true);
        });

        it("should return false for non-timeout errors", () => {
            expect(errorHandler.isTimeoutError("Authentication failed")).toBe(false);
            expect(errorHandler.isTimeoutError(new Error("Authentication failed"))).toBe(false);
        });

        it("should handle ImperativeError with ETIMEDOUT code", () => {
            const imperativeError = new ImperativeError({
                msg: "Timeout",
                errorCode: "ETIMEDOUT",
            });

            expect(errorHandler.isTimeoutError(imperativeError)).toBe(true);
        });

        it("should handle ImperativeError with RPC timeout code", () => {
            const imperativeError = new ImperativeError({
                msg: "RPC Timeout",
                errorCode: "-32001", // RpcErrorCode.REQUEST_TIMEOUT
            });

            expect(errorHandler.isTimeoutError(imperativeError)).toBe(true);
        });

        it("should recognize the fully-formed 'after N ms' timeout message", () => {
            expect(errorHandler.isTimeoutError("Request timed out after 12345 ms")).toBe(true);
            expect(errorHandler.isTimeoutError(new Error("Request timed out after 1 ms"))).toBe(true);
        });

        it("should exercise the RegExp matcher branch and return false for a non-timeout message", () => {
            const imperativeError = new ImperativeError({ msg: "Some failure", errorCode: "EOTHER" });
            expect(errorHandler.isTimeoutError(imperativeError)).toBe(false);
            expect(errorHandler.isTimeoutError("Connection reset by peer")).toBe(false);
        });
    });
});
