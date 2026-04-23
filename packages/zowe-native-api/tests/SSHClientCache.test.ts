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

import { imperative, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { ZSshClient, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { SshClientCache } from "../src/SshClientCache";
import { deployWithProgress, getVsceConfig } from "../src/Utilities";

vi.mock("@zowe/zowe-explorer-api", () => {
    class MockDeferredPromise {
        promise = Promise.resolve();
        resolve = vi.fn();
    }
    return {
        Gui: {},
        ZoweExplorerApiType: {
            All: "all",
            Mvs: "mvs",
            Uss: "uss",
            Jobs: "jobs",
            Command: "command",
        },
        ZoweVsCodeExtension: {
            getZoweExplorerApi: () => ({
                getExplorerExtenderApi: () => ({
                    getProfilesCache: () => ({
                        getLoadedProfConfig: vi.fn(),
                    }),
                }),
            }),
        },
        imperative: {
            Logger: {
                getAppLogger: () => ({
                    debug: vi.fn(),
                    error: vi.fn(),
                    info: vi.fn(),
                    warn: vi.fn(),
                }),
            },

            ImperativeError: class extends Error {
                errorCode: string;
                constructor(msg: string) {
                    super(msg);
                    this.errorCode = "ENOTFOUND";
                }
            },
            DeferredPromise: MockDeferredPromise,
        },
    };
});

vi.mock("@zowe/zowex-for-zowe-sdk", () => {
    return {
        ZSshClient: {
            create: vi.fn(),
        },
        ZSshUtils: {
            buildSession: vi.fn(),
            checkIfOutdated: vi.fn(),
        },
    };
});

vi.mock("../src/ConfigUtils", () => ({
    ConfigUtils: {
        getServerPath: () => "/mock/server/path",
    },
}));

vi.mock("../src/Utilities", () => ({
    deployWithProgress: vi.fn(),
    getVsceConfig: vi.fn(),
}));

vi.mock("vscode", () => ({
    Disposable: class {},
    window: {
        showErrorMessage: vi.fn(),
    },
}));

describe("SshClientCache", () => {
    let cache: SshClientCache;
    let mockGetLoadedProfConfig: ReturnType<typeof vi.fn>;

    const mockProfile: imperative.IProfileLoaded = {
        name: "testProfile",
        type: "ssh",
        profile: {},
    } as any;

    const clientId = "testProfile_ssh";

    beforeEach(() => {
        const mockCollectedRequests = new Set([{ id: "mock-inflight-request-1" }]);
        // Reset the singleton instance for clean tests
        (SshClientCache as any).mInstance = undefined;
        cache = SshClientCache.inst;

        // Default mocks
        vi.mocked(getVsceConfig).mockReturnValue({
            get: vi.fn().mockImplementation((key, defaultVal) => {
                const config: any = {
                    keepAliveInterval: 30,
                    workerCount: 2,
                    requestTimeout: 60,
                    responseTimeout: 60,
                    serverAutoUpdate: true,
                };
                return config[key] === undefined ? defaultVal : config[key];
            }),
        } as any);
        vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
        vi.mocked(ZSshUtils.checkIfOutdated).mockResolvedValue(false);
        vi.mocked(ZSshClient.create).mockResolvedValue({
            dispose: vi.fn(),
            collectAllRequests: vi.fn().mockReturnValue(mockCollectedRequests),
            serverChecksums: {},
        } as any);
        const api = ZoweVsCodeExtension.getZoweExplorerApi();
        mockGetLoadedProfConfig = api.getExplorerExtenderApi().getProfilesCache().getLoadedProfConfig as any;
        mockGetLoadedProfConfig.mockResolvedValue(mockProfile); // Resolve with valid profile by default
    });

    describe("connect()", () => {
        beforeEach(() => {
            vi.mocked(ZSshUtils.buildSession).mockReturnValue({ host: "fake-mock-host" } as any);
        });

        it("should harvest in-flight requests and pass them to the new client when retryRequests is true", async () => {
            const reqSet = new Set(["req1", "req2"]);
            const existingClientMock = {
                dispose: vi.fn(),
                collectAllRequests: vi.fn().mockReturnValue(reqSet),
            };
            (cache as any).mClientSessionMap.set(clientId, {
                client: existingClientMock,
                profile: mockProfile,
                status: 0,
                startTime: Date.now(),
                responseTimeoutMillis: 60000,
            });

            vi.mocked(ZSshClient.create).mockClear();

            await cache.connect(mockProfile, { restart: true, retryRequests: true });

            expect(existingClientMock.collectAllRequests).toHaveBeenCalledWith(true);

            expect(ZSshClient.create).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    keepAliveInterval: 30,
                })
            );
        });

        it("should pass an empty set of requests to the new client if retryRequests is false", async () => {
            const existingClientMock = {
                dispose: vi.fn(),
                collectAllRequests: vi.fn(),
            };
            (cache as any).mClientSessionMap.set(clientId, { client: existingClientMock });
            vi.mocked(ZSshClient.create).mockClear();

            await cache.connect(mockProfile, { restart: true, retryRequests: false });

            // Should NOT have harvested requests
            expect(existingClientMock.collectAllRequests).not.toHaveBeenCalled();

            // Should have passed an empty Set to the new client
            expect(ZSshClient.create).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    requests: new Set(),
                })
            );
        });

        it("should create a new client session if one does not exist", async () => {
            const client = await cache.connect(mockProfile);

            expect(client).toBeDefined();
            expect(ZSshClient.create).toHaveBeenCalled();
            expect(ZSshUtils.buildSession).toHaveBeenCalledWith(mockProfile.profile);

            // Verify it was added to the map
            const map = (cache as any).mClientSessionMap;
            expect(map.has(clientId)).toBe(true);
        });

        it("should restart the client if restart flag is true", async () => {
            const endSpy = vi.spyOn(cache, "end");

            // First connection
            await cache.connect(mockProfile);
            // Second connection with restart=true
            await cache.connect(mockProfile, { restart: true, retryRequests: false });

            expect(endSpy).toHaveBeenCalledWith(clientId, { restart: true, retryRequests: false });
            expect(ZSshClient.create).toHaveBeenCalledTimes(2);
        });

        it("should deploy a new server if the current one is missing (ENOTFOUND)", async () => {
            // Force ZSshClient.create to throw ENOTFOUND on the first try
            vi.mocked(ZSshClient.create)
                .mockRejectedValueOnce(new imperative.ImperativeError({ msg: "Not found", errorCode: "ENOTFOUND" }))
                .mockResolvedValueOnce({ dispose: vi.fn() } as any);

            await cache.connect(mockProfile);

            expect(deployWithProgress).toHaveBeenCalledWith(expect.anything(), "/mock/server/path");
            expect(ZSshClient.create).toHaveBeenCalledTimes(2);
        });

        it("should deploy a new server if the current one is outdated and autoUpdate is true", async () => {
            vi.mocked(ZSshUtils.checkIfOutdated).mockResolvedValueOnce(true);

            await cache.connect(mockProfile);

            expect(deployWithProgress).toHaveBeenCalled();
            expect(ZSshClient.create).toHaveBeenCalledTimes(2); // Initial try + post-deploy try
        });

        it("should restart the client if opts.restart flag is true", async () => {
            const endSpy = vi.spyOn(cache, "end");

            await cache.connect(mockProfile);
            await cache.connect(mockProfile, { restart: true, retryRequests: true });

            // Should pass the flags down to end()
            expect(endSpy).toHaveBeenCalledWith(clientId, { restart: true, retryRequests: true });
            expect(ZSshClient.create).toHaveBeenCalledTimes(2);
        });
    });

    describe("end()", () => {
        it("should pass the restart boolean when calling client.dispose()", () => {
            const mockClient = { dispose: vi.fn() };
            (cache as any).mClientSessionMap.set(clientId, { client: mockClient });

            cache.end(clientId, { restart: true, retryRequests: true });

            expect(mockClient.dispose).toHaveBeenCalledWith(true);
        });

        it("should dispose the client with correct flags and remove it from the map", () => {
            const mockClient = { dispose: vi.fn() };
            (cache as any).mClientSessionMap.set(clientId, { client: mockClient });

            cache.end(clientId, { restart: true, retryRequests: true });

            expect(mockClient.dispose).toHaveBeenCalledWith(true);
            expect((cache as any).mClientSessionMap.has(clientId)).toBe(false);
        });
    });

    describe("reloadClient()", () => {
        beforeEach(() => {
            (cache as any).mClientSessionMap.set(clientId, {
                client: { dispose: vi.fn() },
                profile: mockProfile,
                status: 0, // UP
                startTime: Date.now(),
                responseTimeoutMillis: 60000,
            });

            vi.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
                getExplorerExtenderApi: () => ({
                    getProfilesCache: () => ({
                        getLoadedProfConfig: mockGetLoadedProfConfig,
                    }),
                }),
            } as any);
        });

        it("should call connect with restart set to true", async () => {
            const connectSpy = vi.spyOn(cache, "connect").mockResolvedValue({} as any);

            await (cache as any).reloadClient(clientId);

            expect(connectSpy).toHaveBeenCalledWith(mockProfile, { restart: true, retryRequests: false });
        });

        it("should fetch updated profile and call connect with restart and retryRequests", async () => {
            const connectSpy = vi.spyOn(cache, "connect").mockResolvedValue({} as any);

            await (cache as any).reloadClient(clientId, true);

            expect(mockGetLoadedProfConfig).toHaveBeenCalledWith(mockProfile.name, mockProfile.type);
            expect(connectSpy).toHaveBeenCalledWith(mockProfile, { restart: true, retryRequests: true });
        });

        it("should throw an error if the profile no longer exists", async () => {
            // Simulate profile deletion from config
            mockGetLoadedProfConfig.mockResolvedValueOnce(null);

            await expect((cache as any).reloadClient(clientId, false)).rejects.toThrow(/Could not load profile testProfile/);
        });
    });

    describe("handleClientError() / promptErrorAndReload()", () => {
        beforeEach(() => {
            // Inject a mock session
            (cache as any).mClientSessionMap.set(clientId, {
                client: { dispose: vi.fn() },
                profile: mockProfile,
                status: 0, // ServerStatus.UP
                startTime: Date.now() - 30000, // Started 30 seconds ago
                responseTimeoutMillis: 60000,
            });
        });

        it("should reload AND retry if 'Reload and Retry' is clicked", async () => {
            const reloadSpy = vi.spyOn(cache as any, "reloadClient").mockResolvedValue(Promise.resolve(undefined));

            const session = (cache as any).mClientSessionMap.get(clientId);
            session.startTime = Date.now() - 70000; // make sure we throw an error

            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue("Reload and Retry" as any);

            await (cache as any).handleClientError(clientId, new Error("Request timed out"));

            await new Promise(process.nextTick);

            expect(reloadSpy).toHaveBeenCalledWith(clientId, true);
        });

        it("should reload without retrying requests if 'Reload' is clicked", async () => {
            const reloadSpy = vi.spyOn(cache as any, "reloadClient").mockResolvedValue(undefined);
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue("Reload" as any);

            await (cache as any).handleClientError(clientId, new Error("Something went wrong CEE5207E offset"));

            await new Promise(process.nextTick);
            expect(reloadSpy).toHaveBeenCalledWith(clientId, false);
        });

        const errorMessages = [
            "CEE3204S The system detected a protection exception (System Completion Code=0C4).",
            "Znbdj__some_abend_method38432mangled at compile unit offset",
            "Fatal error encountered in zowex: CEEERR# some internal error",
            "CEE5207E The signal SIGABRT was received.",
        ];
        it.each(errorMessages)("should prompt to reload on FATAL error and set status to DOWN", async (testCase) => {
            const reloadSpy = vi.spyOn(cache as any, "reloadClient").mockResolvedValue(undefined);
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue("Reload" as any);
            const fatalError = new Error(testCase);
            await (cache as any).handleClientError(clientId, fatalError);

            const session = (cache as any).mClientSessionMap.get(clientId);
            expect(session.status).toBe(1); // ServerStatus.DOWN
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining("stopped unexpectedly"),
                "Reload",
                "Reload and Retry",
                "Close"
            );

            expect(reloadSpy).toHaveBeenCalledWith(clientId, false);
            reloadSpy.mockClear();
            vi.mocked(vscode.window.showErrorMessage).mockClear();
            session.status = 0;
        });

        it("should prompt to reload on TIMEOUT error (new timeout)", async () => {
            const timeoutError = new Error("Request timed out");
            const session = (cache as any).mClientSessionMap.get(clientId);
            session.startTime = Date.now() - 70 * 1000;
            await (cache as any).handleClientError(clientId, timeoutError);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining("A request timed out."),
                "Reload",
                "Reload and Retry",
                "Close"
            );
            vi.mocked(vscode.window.showErrorMessage).mockClear();
            session.status = 1; // ServerStatus.DOWN
            await (cache as any).handleClientError(clientId, timeoutError);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining("A request timed out because the server is down."),
                "Reload",
                "Reload and Retry",
                "Close"
            );
        });

        it("should ignore TIMEOUT error if it is an old timeout", async () => {
            // Simulate an old session that has been restarted
            (cache as any).mClientSessionMap.set(clientId, {
                ...(cache as any).mClientSessionMap.get(clientId),
                startTime: Date.now(), // Started just now
                responseTimeoutMillis: 60e3,
            });

            const timeoutError = new Error("Request timed out");
            await (cache as any).handleClientError(clientId, timeoutError);

            // Should not show error message
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });

        it("should show specific message on UNSUPPORTED error", async () => {
            const unsupportedError = new Error("Error CEE3561S");
            await (cache as any).handleClientError(clientId, unsupportedError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("doesn't currently support this version of z/OS"));
        });

        it("should show generic message for unclassified errors", async () => {
            const genericError = new Error("Some random network error");
            await (cache as any).handleClientError(clientId, genericError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Error: Some random network error");
        });
    });

    describe("dispose()", () => {
        it("should iterate over all sessions and dispose them with the inverted retryRequests flag", () => {
            const mockClient1 = { dispose: vi.fn() };
            const mockClient2 = { dispose: vi.fn() };

            (cache as any).mClientSessionMap.set("client_1", { client: mockClient1 });
            (cache as any).mClientSessionMap.set("client_2", { client: mockClient2 });

            cache.dispose({ restart: true, retryRequests: true });

            expect(mockClient1.dispose).toHaveBeenCalledWith(true);
            expect(mockClient2.dispose).toHaveBeenCalledWith(true);
        });

        it("should handle calls with undefined opts safely", () => {
            const mockClient = { dispose: vi.fn() };
            (cache as any).mClientSessionMap.set("client_1", { client: mockClient });

            cache.dispose(); // No opts provided

            expect(mockClient.dispose).toHaveBeenCalledWith(undefined);
        });
    });

    describe("buildClient()", () => {
        const mockSession = { host: "fake-host" } as any;
        const mockOpts = { serverPath: "/test/path", keepAliveInterval: 30, numWorkers: 2 } as any;

        it("should call ZSshClient.create with the correct options and callbacks", async () => {
            const endSpy = vi.spyOn(cache, "end");
            const handleErrorSpy = vi.spyOn(cache as any, "handleClientError").mockImplementation(() => {});
            await (cache as any).buildClient(mockSession, clientId, mockOpts);

            expect(ZSshClient.create).toHaveBeenCalledWith(
                mockSession,
                expect.objectContaining({
                    ...mockOpts,
                    onClose: expect.any(Function),
                    onError: expect.any(Function),
                })
            );

            const createCallArgs = vi.mocked(ZSshClient.create).mock.calls[0];
            const passedConfig = createCallArgs[1] as any;

            passedConfig.onClose();
            expect(endSpy).toHaveBeenCalledWith(clientId);

            const fakeError = new Error("Test connection error");
            passedConfig.onError(fakeError);
            expect(handleErrorSpy).toHaveBeenCalledWith(clientId, fakeError);
        });
    });
});
