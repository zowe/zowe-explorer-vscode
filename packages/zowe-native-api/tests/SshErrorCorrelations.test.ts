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

import {
    type ErrorCorrelator,
    type IApiExplorerExtender,
    type Types,
    ZoweExplorerApiType,
    ZoweVsCodeExtension,
} from "@zowe/zowe-explorer-api";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { registerSshErrorCorrelations } from "../src/SshErrorCorrelations";

// Mock Zowe Explorer API (shared structure with SshErrorHandler.test.ts)
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

describe("SshErrorCorrelations", () => {
    let mockGetZoweExplorerApi: MockedFunction<typeof ZoweVsCodeExtension.getZoweExplorerApi>;
    let mockErrorCorrelator: ErrorCorrelator;
    let mockExtenderApi: IApiExplorerExtender;
    let mockZoweExplorerApi: Types.IApiRegisterClient;

    beforeEach(() => {
        mockGetZoweExplorerApi = vi.mocked(ZoweVsCodeExtension.getZoweExplorerApi);

        mockErrorCorrelator = {
            addCorrelation: vi.fn(),
        } as unknown as ErrorCorrelator;

        mockExtenderApi = {
            getErrorCorrelator: vi.fn().mockReturnValue(mockErrorCorrelator),
        } as unknown as IApiExplorerExtender;

        mockZoweExplorerApi = {
            getExplorerExtenderApi: vi.fn().mockReturnValue(mockExtenderApi),
        } as unknown as Types.IApiRegisterClient;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("registerSshErrorCorrelations", () => {
        it("should register all error correlations when APIs are available", () => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);

            registerSshErrorCorrelations();

            expect(mockGetZoweExplorerApi).toHaveBeenCalled();
            expect(mockZoweExplorerApi.getExplorerExtenderApi).toHaveBeenCalled();
            expect(mockExtenderApi.getErrorCorrelator).toHaveBeenCalled();

            // Should register multiple correlations (connection failures, memory failures, filesystem errors, expired password)
            expect(mockErrorCorrelator.addCorrelation).toHaveBeenCalledTimes(17); // 1 request timeout + 6 connection (incl. FOTS1668) + 4 memory + 6 filesystem
        });

        it("should handle missing Zowe Explorer API gracefully", () => {
            mockGetZoweExplorerApi.mockReturnValue(null);

            expect(() => registerSshErrorCorrelations()).not.toThrow();
            expect(mockErrorCorrelator.addCorrelation).not.toHaveBeenCalled();
        });

        it("should handle missing extender API gracefully", () => {
            mockZoweExplorerApi.getExplorerExtenderApi.mockReturnValue(null);
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);

            expect(() => registerSshErrorCorrelations()).not.toThrow();
            expect(mockErrorCorrelator.addCorrelation).not.toHaveBeenCalled();
        });

        it("should handle missing error correlator gracefully", () => {
            mockExtenderApi.getErrorCorrelator.mockReturnValue(null);
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);

            expect(() => registerSshErrorCorrelations()).not.toThrow();
            expect(mockErrorCorrelator.addCorrelation).not.toHaveBeenCalled();
        });

        it("should handle missing getErrorCorrelator function gracefully", () => {
            mockExtenderApi.getErrorCorrelator = undefined;
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);

            expect(() => registerSshErrorCorrelations()).not.toThrow();
        });
    });

    describe("connection failure correlations", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);
            registerSshErrorCorrelations();
        });

        it("should register FOTS4241 authentication failure correlation", () => {
            const authFailureCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4241",
            );

            expect(authFailureCall).toBeDefined();
            expect(authFailureCall[0]).toBe(ZoweExplorerApiType.All);
            expect(authFailureCall[1]).toBe("ssh");

            const correlation = authFailureCall[2];
            expect(correlation.errorCode).toBe("FOTS4241");
            expect(correlation.matches).toContain("Authentication failed.");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp)]));
            expect(correlation.summary).toContain("SSH authentication failed");
            expect(correlation.tips).toHaveLength(4);
            expect(correlation.resources).toHaveLength(3);

            // Verify resources have required properties
            correlation.resources.forEach((resource: { href: string; title: string }) => {
                expect(resource).toHaveProperty("href");
                expect(resource).toHaveProperty("title");
                expect(new URL(resource.href).host).toBe("www.ibm.com");
            });
        });

        it("should register FOTS4134 unsafe key agreement correlation", () => {
            const unsafeKeyCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4134",
            );

            expect(unsafeKeyCall).toBeDefined();
            const correlation = unsafeKeyCall[2];
            expect(correlation.errorCode).toBe("FOTS4134");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4134"]));
            expect(correlation.summary).toContain("unsafe key agreement");
            expect(correlation.tips.length).toBeGreaterThan(0);
        });

        it("should register FOTS4231 server unsafe key agreement correlation", () => {
            const serverUnsafeCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4231",
            );

            expect(serverUnsafeCall).toBeDefined();
            const correlation = serverUnsafeCall[2];
            expect(correlation.errorCode).toBe("FOTS4231");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4231"]));
            expect(correlation.summary).toContain("server version uses an unsafe key agreement");
        });

        it("should register FOTS4203 host key ownership correlation", () => {
            const hostKeyCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4203",
            );

            expect(hostKeyCall).toBeDefined();
            const correlation = hostKeyCall[2];
            expect(correlation.errorCode).toBe("FOTS4203");
            expect(correlation.matches).toContain("Server failed to confirm ownership of private host keys");
            expect(correlation.summary).toContain("security issue");
            expect(correlation.tips[0]).toContain("system administrator immediately");
        });

        it("should register FOTS4240 key exchange error correlation", () => {
            const kexErrorCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4240",
            );

            expect(kexErrorCall).toBeDefined();
            const correlation = kexErrorCall[2];
            expect(correlation.errorCode).toBe("FOTS4240");
            expect(correlation.matches).toContain("kex_prop2buf: error");
            expect(correlation.matches).toContain("FOTS4240");
            expect(correlation.summary).toContain("key exchange internal error");
        });
    });

    describe("memory failure correlations", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);
            registerSshErrorCorrelations();
        });

        it("should register FOTS4314 xreallocarray memory error correlation", () => {
            const memoryCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4314",
            );

            expect(memoryCall).toBeDefined();
            const correlation = memoryCall[2];
            expect(correlation.errorCode).toBe("FOTS4314");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4314"]));
            expect(correlation.summary).toContain("out of memory");
            expect(correlation.tips).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("Close other applications"),
                    expect.stringContaining("Restart the SSH client"),
                ]),
            );
        });

        it("should register FOTS4315 xrecallocarray memory error correlation", () => {
            const memoryCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4315",
            );

            expect(memoryCall).toBeDefined();
            const correlation = memoryCall[2];
            expect(correlation.errorCode).toBe("FOTS4315");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4315"]));
            expect(correlation.summary).toContain("out of memory");
        });

        it("should register FOTS4216 session state allocation error correlation", () => {
            const sessionCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4216",
            );

            expect(sessionCall).toBeDefined();
            const correlation = sessionCall[2];
            expect(correlation.errorCode).toBe("FOTS4216");
            expect(correlation.matches).toContain("Couldn't allocate session state");
            expect(correlation.summary).toContain("allocate memory for session state");
        });

        it("should register FOTS4311 state allocation error correlation", () => {
            const stateCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4311",
            );

            expect(stateCall).toBeDefined();
            const correlation = stateCall[2];
            expect(correlation.errorCode).toBe("FOTS4311");
            expect(correlation.matches).toContain("could not allocate state");
            expect(correlation.summary).toContain("internal state management");
        });
    });

    describe("filesystem error correlations", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);
            registerSshErrorCorrelations();
        });

        it("should register FSUM6260 write error correlation", () => {
            const writeErrorCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FSUM6260",
            );

            expect(writeErrorCall).toBeDefined();
            const correlation = writeErrorCall[2];
            expect(correlation.errorCode).toBe("FSUM6260");
            expect(correlation.matches).toEqual(
                expect.arrayContaining([
                    expect.any(RegExp),
                    "FSUM6260",
                    "Failed to upload server PAX file with RC 4: Error: Failure",
                ]),
            );
            expect(correlation.summary).toContain("Failed to write to file");
            expect(correlation.tips).toEqual(
                expect.arrayContaining([
                    expect.stringContaining("write permissions"),
                    expect.stringContaining("disk has sufficient free space"),
                ]),
            );
        });

        it("should register FOTS4152 openpty error correlation", () => {
            const ptyCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4152",
            );

            expect(ptyCall).toBeDefined();
            const correlation = ptyCall[2];
            expect(correlation.errorCode).toBe("FOTS4152");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4152"]));
            expect(correlation.summary).toContain("pseudo-terminal");
        });

        it("should register FOTS4154 packet connection error correlation", () => {
            const packetCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4154",
            );

            expect(packetCall).toBeDefined();
            const correlation = packetCall[2];
            expect(correlation.errorCode).toBe("FOTS4154");
            expect(correlation.matches).toContain("ssh_packet_set_connection failed");
            expect(correlation.summary).toContain("packet connection");
        });

        it("should register FOTS4150 kex_setup error correlation", () => {
            const kexSetupCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4150",
            );

            expect(kexSetupCall).toBeDefined();
            const correlation = kexSetupCall[2];
            expect(correlation.errorCode).toBe("FOTS4150");
            expect(correlation.matches).toEqual(expect.arrayContaining([expect.any(RegExp), "FOTS4150"]));
            expect(correlation.summary).toContain("key exchange setup failed");
        });

        it("should register FOTS4312 cipher initialization error correlation", () => {
            const cipherCall = mockErrorCorrelator.addCorrelation.mock.calls.find(
                (call) => call[2].errorCode === "FOTS4312",
            );

            expect(cipherCall).toBeDefined();
            const correlation = cipherCall[2];
            expect(correlation.errorCode).toBe("FOTS4312");
            expect(correlation.matches).toContain("cipher_init failed:");
            expect(correlation.summary).toContain("cipher initialization failed");
        });
    });

    describe("correlation structure validation", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);
            registerSshErrorCorrelations();
        });

        it("should ensure all correlations have required properties", () => {
            const allCalls = mockErrorCorrelator.addCorrelation.mock.calls;

            allCalls.forEach((call) => {
                const correlation = call[2];

                expect(correlation).toHaveProperty("errorCode");
                expect(correlation).toHaveProperty("matches");
                expect(correlation).toHaveProperty("summary");
                expect(correlation).toHaveProperty("tips");
                expect(correlation).toHaveProperty("resources");

                expect(typeof correlation.errorCode).toBe("string");
                expect(Array.isArray(correlation.matches)).toBe(true);
                expect(typeof correlation.summary).toBe("string");
                if (correlation.tips) {
                    expect(Array.isArray(correlation.tips)).toBe(true);
                    expect(correlation.tips.length).toBeGreaterThan(0);
                }
                if (correlation.resources) {
                    expect(Array.isArray(correlation.resources)).toBe(true);
                    expect(correlation.resources.length).toBeGreaterThan(0);
                }
                expect(correlation.matches.length).toBeGreaterThan(0);
            });
        });

        it("should ensure all resources have valid URLs and titles", () => {
            const allCalls = mockErrorCorrelator.addCorrelation.mock.calls;

            allCalls.forEach((call) => {
                const correlation = call[2];

                // Not every correlation has resources, but the ones that do should have HTTPS links
                correlation.resources?.forEach((resource: { href: string; title: string }) => {
                    expect(resource).toHaveProperty("href");
                    expect(resource).toHaveProperty("title");
                    expect(typeof resource.href).toBe("string");
                    expect(typeof resource.title).toBe("string");
                    expect(resource.href).toMatch(/^https?:\/\//);
                    expect(resource.title.length).toBeGreaterThan(0);
                });
            });
        });

        it("should register correlations for ZoweExplorerApiType.All with ssh profile type", () => {
            const allCalls = mockErrorCorrelator.addCorrelation.mock.calls;

            allCalls.forEach((call) => {
                expect(call[0]).toBe(ZoweExplorerApiType.All);
                expect(call[1]).toBe("ssh");
            });
        });
    });

    describe("error code uniqueness", () => {
        beforeEach(() => {
            mockGetZoweExplorerApi.mockReturnValue(mockZoweExplorerApi);
            registerSshErrorCorrelations();
        });

        it("should not register duplicate error codes", () => {
            const allCalls = mockErrorCorrelator.addCorrelation.mock.calls;
            const errorCodes = allCalls.map((call) => call[2].errorCode);
            const uniqueErrorCodes = [...new Set(errorCodes)];

            expect(errorCodes.length).toBe(uniqueErrorCodes.length);
        });

        it("should register expected error codes", () => {
            const allCalls = mockErrorCorrelator.addCorrelation.mock.calls;
            const errorCodes = allCalls.map((call) => call[2].errorCode);

            const expectedCodes = [
                // Connection failures
                "FOTS4241",
                "FOTS4134",
                "FOTS4231",
                "FOTS4203",
                "FOTS4240",
                // Memory failures
                "FOTS4314",
                "FOTS4315",
                "FOTS4216",
                "FOTS4311",
                // Filesystem errors
                "FSUM6260",
                "FOTS4152",
                "FOTS4154",
                "FOTS4150",
                "FOTS4312",
            ];

            expectedCodes.forEach((expectedCode) => {
                expect(errorCodes).toContain(expectedCode);
            });
        });
    });
});
