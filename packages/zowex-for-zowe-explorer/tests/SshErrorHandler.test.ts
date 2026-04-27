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

import { type ErrorCorrelator, type Types, ZoweExplorerApiType, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import * as vscode from "vscode";
import { SshErrorHandler } from "../src/SshErrorHandler";

// Mock vscode module
vi.mock("vscode", () => ({
    window: {
        showErrorMessage: vi.fn(),
        createOutputChannel: vi.fn(),
    },
}));

// Mock Zowe Explorer API (shared structure with SshErrorCorrelations.test.ts)
vi.mock("@zowe/zowe-explorer-api", () => ({
    ZoweExplorerApiType: {
        All: "all",
        Mvs: "mvs",
        Uss: "uss",
        Jobs: "jobs",
        Command: "command",
    },
    ZoweVsCodeExtension: {
        getZoweExplorerApi: vi.fn(),
    },
}));

describe("SshErrorHandler", () => {
    let errorHandler: SshErrorHandler;
    let mockShowErrorMessage: MockedFunction<typeof vscode.window.showErrorMessage>;
    let mockCreateOutputChannel: MockedFunction<typeof vscode.window.createOutputChannel>;
    let mockGetZoweExplorerApi: MockedFunction<typeof ZoweVsCodeExtension.getZoweExplorerApi>;
    let mockErrorCorrelator: ErrorCorrelator;
    let mockOutputChannel: vscode.LogOutputChannel;

    beforeEach(() => {
        // Reset singleton instance
        errorHandler = SshErrorHandler.getInstance();

        // Setup mocks
        mockShowErrorMessage = vi.mocked(vscode.window.showErrorMessage);
        mockCreateOutputChannel = vi.mocked(vscode.window.createOutputChannel);
        mockGetZoweExplorerApi = vi.mocked(ZoweVsCodeExtension.getZoweExplorerApi);

        mockOutputChannel = {
            appendLine: vi.fn(),
            show: vi.fn(),
        } as unknown as vscode.LogOutputChannel;

        mockErrorCorrelator = {
            displayError: vi.fn(),
        } as unknown as ErrorCorrelator;

        mockCreateOutputChannel.mockReturnValue(mockOutputChannel);
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

    describe("handleError with error correlator", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getErrorCorrelator: () => mockErrorCorrelator,
                }),
            } as unknown as Types.IApiRegisterClient);
        });

        it("should use error correlator when available", async () => {
            const testError = new Error("FOTS4241 Authentication failed");
            const expectedResult = { userResponse: "Retry" };

            mockErrorCorrelator.displayError.mockResolvedValue(expectedResult);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.All, "SSH connection", true);

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.All, testError, {
                profileType: "ssh",
                additionalContext: "SSH connection",
                allowRetry: true,
            });
            expect(result).toBe("Retry");
            expect(mockShowErrorMessage).not.toHaveBeenCalled();
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
    });

    describe("handleError fallback behavior", () => {
        beforeEach(() => {
            // Mock no error correlator available
            mockGetZoweExplorerApi.mockReturnValue(null);
        });

        it("should show error message without retry when not allowed", async () => {
            const testError = new Error("Connection failed");
            mockShowErrorMessage.mockResolvedValue("Show Details");

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.All, "Testing operation");

            expect(mockShowErrorMessage).toHaveBeenCalledWith("Testing operation: Connection failed", "Show Details");
            expect(result).toBe("Show Details");
        });

        it("should show error message with retry when allowed", async () => {
            const testError = new Error("Temporary failure");
            mockShowErrorMessage.mockResolvedValue("Retry");

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.Uss, "File upload", true);

            expect(mockShowErrorMessage).toHaveBeenCalledWith("File upload: Temporary failure", "Retry", "Show Details");
            expect(result).toBe("Retry");
        });

        it("should handle string errors in fallback", async () => {
            const testError = "FSUM6260 write error on file";
            mockShowErrorMessage.mockResolvedValue(undefined);

            const result = await errorHandler.handleError(testError, ZoweExplorerApiType.Command);

            expect(mockShowErrorMessage).toHaveBeenCalledWith("FSUM6260 write error on file", "Show Details");
            expect(result).toBeUndefined();
        });

        it("should handle 'Show Details' response by creating output channel", async () => {
            const testError = new Error("Detailed error");
            testError.stack = "Error: Detailed error\n    at test.js:1:1";
            mockShowErrorMessage.mockResolvedValue("Show Details");

            await errorHandler.handleError(testError, ZoweExplorerApiType.All, "Operation");

            expect(mockCreateOutputChannel).toHaveBeenCalledWith("Zowe Remote SSH");
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Error: Detailed error");
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Stack: Error: Detailed error\n    at test.js:1:1");
            expect(mockOutputChannel.show).toHaveBeenCalled();
        });

        it("should handle error without stack trace", async () => {
            const testError = new Error("Simple error");
            delete testError.stack;
            mockShowErrorMessage.mockResolvedValue("Show Details");

            await errorHandler.handleError(testError, ZoweExplorerApiType.All);

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith("Error: Simple error");
            expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1);
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
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getErrorCorrelator: () => mockErrorCorrelator,
                }),
            } as unknown as Types.IApiRegisterClient);
            mockErrorCorrelator.displayError.mockResolvedValue({ userResponse: "Retry" });

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.All, "Upload operation");

            const shouldRetry = await callback(testError, "file transfer");

            expect(mockErrorCorrelator.displayError).toHaveBeenCalledWith(ZoweExplorerApiType.All, testError, {
                profileType: "ssh",
                additionalContext: "Upload operation (file transfer)",
                allowRetry: true,
            });
            expect(shouldRetry).toBe(true);
        });

        it("should return false when user chooses not to retry", async () => {
            mockGetZoweExplorerApi.mockReturnValue(null);
            mockShowErrorMessage.mockResolvedValue("Show Details");

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Jes);
            const shouldRetry = await callback(new Error("Job failed"), "job submission");

            expect(shouldRetry).toBe(false);
        });

        it("should return false when user response is undefined", async () => {
            mockGetZoweExplorerApi.mockReturnValue(null);
            mockShowErrorMessage.mockResolvedValue(undefined);

            const callback = errorHandler.createErrorCallback(ZoweExplorerApiType.Mvs);
            const shouldRetry = await callback(new Error("Dataset error"), "dataset operation");

            expect(shouldRetry).toBe(false);
        });

        it("should combine context strings correctly", async () => {
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getErrorCorrelator: () => mockErrorCorrelator,
                }),
            } as unknown as Types.IApiRegisterClient);
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
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getErrorCorrelator: () => mockErrorCorrelator,
                }),
            } as unknown as Types.IApiRegisterClient);
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

    describe("edge cases and error scenarios", () => {
        it("should handle missing extender API gracefully", async () => {
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => null,
            } as unknown as Types.IApiRegisterClient);
            mockShowErrorMessage.mockResolvedValue("OK");

            const result = await errorHandler.handleError(new Error("Test"), ZoweExplorerApiType.All);

            expect(result).toBe("OK");
            expect(mockShowErrorMessage).toHaveBeenCalled();
        });

        it("should handle missing error correlator gracefully", async () => {
            mockGetZoweExplorerApi.mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getErrorCorrelator: () => null,
                }),
            } as unknown as Types.IApiRegisterClient);
            mockShowErrorMessage.mockResolvedValue("OK");

            const result = await errorHandler.handleError(new Error("Test"), ZoweExplorerApiType.All);

            expect(result).toBe("OK");
            expect(mockShowErrorMessage).toHaveBeenCalled();
        });
    });

    describe("isTimeoutError", () => {
        it("should return true for timeout errors", async () => {
            expect(errorHandler.isTimeoutError("Request timed out after")).toBe(true);
            expect(errorHandler.isTimeoutError(new Error("Request timed out after 200 ms"))).toBe(true);
        });

        it("should return false for non-timeout errors", () => {
            expect(errorHandler.isTimeoutError("Authentication failed")).toBe(false);
            expect(errorHandler.isTimeoutError(new Error("Authentication failed"))).toBe(false);
        });
    });
});
