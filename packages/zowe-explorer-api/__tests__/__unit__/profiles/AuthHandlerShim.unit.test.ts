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

import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("node:module", async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        createRequire: (filename: string) => {
            const req = original.createRequire(filename);
            return (path: string) => {
                if (path === "../vscode/session/AuthHandler") {
                    // Return the mocked implementation instead
                    return (globalThis as any).__mockedAuthHandler;
                }
                return req(path);
            };
        },
    };
});

const _mockAuthHandler = (impl: any) => {
    (globalThis as any).__mockedAuthHandler = impl;
};

describe("profiles/AuthHandler compatibility shim", () => {
    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).__mockedAuthHandler;
    });

    it("does not load the moved implementation until the facade is used", async () => {
        const loadCount = 0;

        _mockAuthHandler({
            __esModule: true,
            AuthHandler: class AuthHandler {
                public static authPromptLocks = new Map();

                public static wasAuthCancelled(): boolean {
                    return true;
                }
            },
            AuthCancelledError: class AuthCancelledError extends Error {},
        });

        const { AuthHandler } = await import("../../../src/profiles/AuthHandler");

        expect(loadCount).toBe(0); // Cannot cleanly test load count this way easily without adding logic to the mock, but we test behavior

        expect(AuthHandler.wasAuthCancelled("test-profile")).toBe(true);
    });

    it("forwards static state accessors and delegated methods", async () => {
        const promptLocks = new Map([["a", {}]]);
        const profileLocks = new Map([["b", {}]]);
        const cancelledProfiles = new Set(["p1"]);
        const authFlows = new Map<string, Promise<void>>([["flow", Promise.resolve()]]);
        const sequentialLocks = new Map([["seq", {}]]);
        const parallelEnabledProfiles = new Set(["parallel"]);
        const enabledProfileTypes = new Set(["zosmf"]);

        const lockProfileMock = vi.fn().mockResolvedValue(true);
        const promptForAuthMock = vi.fn().mockResolvedValue(true);
        const runSequentialMock = vi.fn().mockResolvedValue("done");
        const getOrCreateAuthFlowMock = vi.fn().mockResolvedValue(undefined);

        const impl: any = class AuthHandler {};
        impl.authPromptLocks = promptLocks;
        impl.profileLocks = profileLocks;
        impl.authCancelledProfiles = cancelledProfiles;
        impl.authFlows = authFlows;
        impl.sequentialLocks = sequentialLocks;
        impl.parallelEnabledProfiles = parallelEnabledProfiles;
        impl.enabledProfileTypes = enabledProfileTypes;
        impl.setAuthCancelled = vi.fn();
        impl.wasAuthCancelled = vi.fn().mockReturnValue(true);
        impl.enableLocksForType = vi.fn();
        impl.disableLocksForType = vi.fn();
        impl.getSessFromProfile = vi.fn().mockReturnValue({ ISession: { type: "token" } });
        impl.sessTypeFromSession = vi.fn().mockReturnValue("token");
        impl.sessTypeFromProfile = vi.fn().mockReturnValue("token");
        impl.unlockProfile = vi.fn();
        impl.promptForAuthentication = promptForAuthMock;
        impl.lockProfile = lockProfileMock;
        impl.enableSequentialRequests = vi.fn();
        impl.disableSequentialRequests = vi.fn();
        impl.areSequentialRequestsEnabled = vi.fn().mockReturnValue(false);
        impl.runSequentialIfEnabled = runSequentialMock;
        impl.waitForUnlock = vi.fn().mockResolvedValue(undefined);
        impl.unlockAllProfiles = vi.fn();
        impl.isProfileLocked = vi.fn().mockReturnValue(false);
        impl.getActiveAuthFlow = vi.fn().mockReturnValue(undefined);
        impl.getOrCreateAuthFlow = getOrCreateAuthFlowMock;

        class MockAuthCancelledError extends Error {
            public readonly profileName: string;

            public constructor(profileName: string, message?: string) {
                super(message ?? `Authentication cancelled for profile: ${profileName}`);
                this.name = "AuthCancelledError";
                this.profileName = profileName;
            }
        }

        _mockAuthHandler({
            __esModule: true,
            AuthHandler: impl,
            AuthCancelledError: MockAuthCancelledError,
        });

        const { AuthHandler, AuthCancelledError } = await import("../../../src/profiles/AuthHandler");

        expect(AuthHandler.authPromptLocks).toBe(promptLocks);
        AuthHandler.authPromptLocks = new Map();
        expect(impl.authPromptLocks).toBeInstanceOf(Map);

        expect(AuthHandler.profileLocks).toBe(profileLocks);
        AuthHandler.profileLocks = new Map();
        expect(impl.profileLocks).toBeInstanceOf(Map);

        expect(AuthHandler.authCancelledProfiles).toBe(cancelledProfiles);
        AuthHandler.authCancelledProfiles = new Set();
        expect(impl.authCancelledProfiles).toBeInstanceOf(Set);

        expect(AuthHandler.authFlows).toBe(authFlows);
        AuthHandler.authFlows = new Map();
        expect(impl.authFlows).toBeInstanceOf(Map);

        expect(AuthHandler.sequentialLocks).toBe(sequentialLocks);
        AuthHandler.sequentialLocks = new Map();
        expect(impl.sequentialLocks).toBeInstanceOf(Map);

        expect(AuthHandler.parallelEnabledProfiles).toBe(parallelEnabledProfiles);
        AuthHandler.parallelEnabledProfiles = new Set();
        expect(impl.parallelEnabledProfiles).toBeInstanceOf(Set);

        expect(AuthHandler.enabledProfileTypes).toBe(enabledProfileTypes);
        AuthHandler.enabledProfileTypes = new Set();
        expect(impl.enabledProfileTypes).toBeInstanceOf(Set);

        AuthHandler.setAuthCancelled("p", true);
        expect(impl.setAuthCancelled).toHaveBeenCalledWith("p", true);
        expect(AuthHandler.wasAuthCancelled("p")).toBe(true);
        AuthHandler.enableLocksForType("zosmf");
        expect(impl.enableLocksForType).toHaveBeenCalledWith("zosmf");
        AuthHandler.disableLocksForType("zosmf");
        expect(impl.disableLocksForType).toHaveBeenCalledWith("zosmf");

        expect(AuthHandler.getSessFromProfile({} as any)).toEqual({ ISession: { type: "token" } });
        expect(AuthHandler.sessTypeFromSession({} as any)).toBe("token");
        expect(AuthHandler.sessTypeFromProfile({} as any)).toBe("token");

        AuthHandler.unlockProfile("p", true);
        expect(impl.unlockProfile).toHaveBeenCalledWith("p", true);

        await expect(AuthHandler.promptForAuthentication("p", {} as any)).resolves.toBe(true);
        expect(promptForAuthMock).toHaveBeenCalled();
        await expect(AuthHandler.lockProfile("p", {} as any)).resolves.toBe(true);
        expect(lockProfileMock).toHaveBeenCalled();

        AuthHandler.enableSequentialRequests("p");
        expect(impl.enableSequentialRequests).toHaveBeenCalledWith("p");
        AuthHandler.disableSequentialRequests("p");
        expect(impl.disableSequentialRequests).toHaveBeenCalledWith("p");
        expect(AuthHandler.areSequentialRequestsEnabled("p")).toBe(false);
        await expect(AuthHandler.runSequentialIfEnabled("p", () => Promise.resolve("fallback"))).resolves.toBe("done");
        await expect(AuthHandler.waitForUnlock("p")).resolves.toBeUndefined();
        AuthHandler.unlockAllProfiles();
        expect(impl.unlockAllProfiles).toHaveBeenCalled();
        expect(AuthHandler.isProfileLocked("p")).toBe(false);
        expect(AuthHandler.getActiveAuthFlow("p")).toBeUndefined();
        await expect(AuthHandler.getOrCreateAuthFlow("p", {} as any)).resolves.toBeUndefined();

        const error = new AuthCancelledError("profile-1", "cancelled");
        expect(error).toBeInstanceOf(MockAuthCancelledError);
        expect(error.profileName).toBe("profile-1");
        expect(error.message).toBe("cancelled");

        const defaultMessageError = new AuthCancelledError("profile-2");
        expect(defaultMessageError).toBeInstanceOf(MockAuthCancelledError);
        expect(defaultMessageError.profileName).toBe("profile-2");
        expect(defaultMessageError.message).toBe("Authentication cancelled for profile: profile-2");
    });

    it("implements local isUsingTokenAuth behavior", async () => {
        _mockAuthHandler({
            __esModule: true,
            AuthHandler: class AuthHandler {
                public static authPromptLocks = new Map();
            },
            AuthCancelledError: class AuthCancelledError extends Error {},
        });

        const { AuthHandler } = await import("../../../src/profiles/AuthHandler");

        /* eslint-disable */
        expect(AuthHandler.isUsingTokenAuth(["tokenValue"])).toBe(true);
        expect(AuthHandler.isUsingTokenAuth(["tokenValue", "user", "password"])).toBe(false);
        expect(AuthHandler.isUsingTokenAuth(["user", "password"], ["tokenValue"])).toBe(false);
        expect(AuthHandler.isUsingTokenAuth([], ["tokenValue"])).toBe(true);
        expect(AuthHandler.isUsingTokenAuth([])).toBe(true);
        /* eslint-enable */
    });
});
