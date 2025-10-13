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

import { Mutex } from "async-mutex";
import { AuthHandler, AuthCancelledError, Gui, ZoweVsCodeExtension } from "../../../src";
import { FileManagement } from "../../../src/utils/FileManagement";
import { ImperativeError, IProfileLoaded, Session, SessConstants, RestConstants } from "@zowe/imperative";
import { AuthPromptParams } from "../../../src/profiles/AuthHandler";
import * as vscode from "vscode";

const TEST_PROFILE_NAME = "lpar.zosmf";

describe("AuthHandler", () => {
    describe("disableLocksForType", () => {
        it("removes the profile type from the list of profile types w/ locks enabled", () => {
            AuthHandler.disableLocksForType("zosmf");
            expect((AuthHandler as any).enabledProfileTypes.has("zosmf")).toBe(false);
        });
    });

    describe("enableLocksForType", () => {
        it("adds the profile type to the list of profile types w/ locks enabled", () => {
            AuthHandler.enableLocksForType("sample-type");
            expect((AuthHandler as any).enabledProfileTypes.has("sample-type")).toBe(true);

            // cleanup for other tests
            (AuthHandler as any).enabledProfileTypes.delete("sample-type");
        });
    });

    describe("wasAuthCancelled", () => {
        beforeEach(() => {
            // Since wasAuthCancelled relies on internal state, we clear it.
            (AuthHandler as any).authCancelledProfiles.clear();
            (AuthHandler as any).authFlows.clear();
        });

        it("should return true when auth has been cancelled for a profile name", () => {
            AuthHandler.setAuthCancelled(TEST_PROFILE_NAME, true);
            expect(AuthHandler.wasAuthCancelled(TEST_PROFILE_NAME)).toBe(true);
        });

        it("should return true when auth has been cancelled for a profile object", () => {
            const profile = { name: TEST_PROFILE_NAME, type: "zosmf" } as IProfileLoaded;
            AuthHandler.setAuthCancelled(profile, true);
            expect(AuthHandler.wasAuthCancelled(profile)).toBe(true);
        });

        it("should return false when auth has not been cancelled", () => {
            expect(AuthHandler.wasAuthCancelled(TEST_PROFILE_NAME)).toBe(false);
        });

        it("should return false when auth was cancelled and then un-cancelled", () => {
            AuthHandler.setAuthCancelled(TEST_PROFILE_NAME, true);
            AuthHandler.setAuthCancelled(TEST_PROFILE_NAME, false);
            expect(AuthHandler.wasAuthCancelled(TEST_PROFILE_NAME)).toBe(false);
        });
    });

    describe("waitForUnlock", () => {
        it("calls Mutex.waitForUnlock if the profile lock is present", async () => {
            // Used so that `setTimeout` can be invoked from 30sec timeout promise
            jest.useFakeTimers();
            const mutex = new Mutex();
            const isLockedMock = jest.spyOn(mutex, "isLocked").mockReturnValueOnce(true);
            const waitForUnlockMock = jest.spyOn(mutex, "waitForUnlock").mockResolvedValueOnce(undefined);
            (AuthHandler as any).profileLocks.set(TEST_PROFILE_NAME, mutex);
            await AuthHandler.waitForUnlock(TEST_PROFILE_NAME, true);
            expect(isLockedMock).toHaveBeenCalled();
            expect(waitForUnlockMock).toHaveBeenCalled();
            (AuthHandler as any).profileLocks.clear();
        });
        it("does nothing if the profile lock is not in the profileLocks map", async () => {
            const waitForUnlockMock = jest.spyOn(Mutex.prototype, "waitForUnlock");
            await AuthHandler.waitForUnlock(TEST_PROFILE_NAME);
            expect(waitForUnlockMock).not.toHaveBeenCalled();
        });
    });

    describe("unlockAllProfiles", () => {
        it("unlocks all profiles in the AuthHandler.profileLocks map", () => {
            const mutexAuthPrompt = new Mutex();
            const mutexProfile = new Mutex();
            const releaseAuthPromptMutex = jest.spyOn(mutexAuthPrompt, "release");
            const releaseProfileMutex = jest.spyOn(mutexProfile, "release");
            (AuthHandler as any).authPromptLocks.set(TEST_PROFILE_NAME, mutexAuthPrompt);
            (AuthHandler as any).profileLocks.set(TEST_PROFILE_NAME, mutexProfile);

            AuthHandler.unlockAllProfiles();
            expect(releaseAuthPromptMutex).toHaveBeenCalledTimes(1);
            expect(releaseProfileMutex).toHaveBeenCalledTimes(1);
            (AuthHandler as any).authPromptLocks.clear();
            (AuthHandler as any).profileLocks.clear();
        });
    });

    describe("isProfileLocked", () => {
        it("returns true if the profile is locked", async () => {
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            expect(AuthHandler.isProfileLocked(TEST_PROFILE_NAME)).toBe(true);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        });

        it("returns false if the profile is not locked", () => {
            expect(AuthHandler.isProfileLocked(TEST_PROFILE_NAME)).toBe(false);
        });

        it("returns false if no mutex is present for the given profile", () => {
            expect(AuthHandler.isProfileLocked("unused_lpar.zosmf")).toBe(false);
        });
    });

    describe("lockProfile", () => {
        it("does not acquire a Mutex if the profile type doesn't have locks enabled", async () => {
            const acquireMutex = jest.spyOn(Mutex.prototype, "acquire");
            await AuthHandler.lockProfile({
                profile: {},
                type: "sample-type",
                message: "",
                failNotFound: false,
            });
            expect(acquireMutex).not.toHaveBeenCalled();
        });

        it("assigns and acquires a Mutex to the profile in the profile map", async () => {
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            expect((AuthHandler as any).profileLocks.has(TEST_PROFILE_NAME)).toBe(true);
            expect((AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME)).toBeInstanceOf(Mutex);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        });

        it("handle promptForAuthentication call if error and options are given", async () => {
            const promptForAuthenticationMock = jest.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValueOnce(true);
            const imperativeError = new ImperativeError({ msg: "Example auth error" });
            const authOpts: AuthPromptParams = {
                authMethods: {
                    promptCredentials: jest.fn(),
                    ssoLogin: jest.fn(),
                },
                imperativeError,
            };
            const result = await AuthHandler.lockProfile(TEST_PROFILE_NAME, authOpts);
            expect(result).toBe(true);
            expect(promptForAuthenticationMock).toHaveBeenCalledTimes(1);
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(TEST_PROFILE_NAME, authOpts);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        });

        it("reuses the same Mutex for the profile if it already exists", async () => {
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            expect((AuthHandler as any).profileLocks.has(TEST_PROFILE_NAME)).toBe(true);
            // cache initial mutex for comparison
            const mutex = (AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME);
            expect(mutex).toBeInstanceOf(Mutex);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);

            // same mutex is still present in map since lock/unlock sequence was used
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            expect(mutex).toBe((AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME));
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        });
    });

    describe("promptForAuthentication", () => {
        it("handles a token-based authentication error - login successful, profile is string", async () => {
            const tokenNotValidMsg = "Token is not valid or expired.";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn().mockResolvedValue(true);
            const promptCredentials = jest.fn();
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Log in to Authentication Service");
            const unlockProfileSpy = jest.spyOn(AuthHandler, "unlockProfile");
            await expect(
                AuthHandler.promptForAuthentication("lpar.zosmf", { authMethods: { promptCredentials, ssoLogin }, imperativeError })
            ).resolves.toBe(true);
            expect(promptCredentials).not.toHaveBeenCalled();
            expect(ssoLogin).toHaveBeenCalledTimes(1);
            expect(ssoLogin).toHaveBeenCalledWith(null, "lpar.zosmf");
            expect(unlockProfileSpy).toHaveBeenCalledTimes(1);
            expect(unlockProfileSpy).toHaveBeenCalledWith("lpar.zosmf", true);
            expect(showMessageMock).toHaveBeenCalledTimes(1);
        });

        it("handles a standard authentication error - credentials provided, profile is string", async () => {
            const tokenNotValidMsg = "Invalid credentials";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn().mockResolvedValue(true);
            const promptCredentials = jest.fn().mockResolvedValue(["us3r", "p4ssw0rd"]);
            const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Update Credentials");
            const unlockProfileSpy = jest.spyOn(AuthHandler, "unlockProfile").mockClear();
            await expect(
                AuthHandler.promptForAuthentication("lpar.zosmf", { authMethods: { promptCredentials, ssoLogin }, imperativeError })
            ).resolves.toBe(true);
            expect(unlockProfileSpy).toHaveBeenCalledTimes(1);
            expect(unlockProfileSpy).toHaveBeenCalledWith("lpar.zosmf", true);
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(errorMessageMock).toHaveBeenCalledTimes(1);
            expect(promptCredentials).toHaveBeenCalledTimes(1);
            expect(promptCredentials).toHaveBeenCalledWith("lpar.zosmf", true);
        });

        it("throws AuthCancelledError when user cancels SSO login", async () => {
            const tokenNotValidMsg = "Token is not valid or expired.";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn().mockResolvedValue(true);
            const promptCredentials = jest.fn();
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockClear().mockResolvedValueOnce(undefined); // User cancels

            await expect(
                AuthHandler.promptForAuthentication("lpar.zosmf", {
                    authMethods: { promptCredentials, ssoLogin },
                    imperativeError,
                    throwErrorOnCancel: true,
                })
            ).rejects.toThrow(AuthCancelledError);

            expect(promptCredentials).not.toHaveBeenCalled();
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(showMessageMock).toHaveBeenCalledTimes(1);
        });

        it("throws AuthCancelledError when user cancels credential prompt", async () => {
            const tokenNotValidMsg = "Invalid credentials";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn();
            const promptCredentials = jest.fn();
            const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockClear().mockResolvedValueOnce(undefined); // User cancels

            await expect(
                AuthHandler.promptForAuthentication("lpar.zosmf", {
                    authMethods: { promptCredentials, ssoLogin },
                    imperativeError,
                    throwErrorOnCancel: true,
                })
            ).rejects.toThrow(AuthCancelledError);

            expect(ssoLogin).not.toHaveBeenCalled();
            expect(errorMessageMock).toHaveBeenCalledTimes(1);
            expect(promptCredentials).not.toHaveBeenCalled();
        });

        it("throws AuthCancelledError when credential input is cancelled", async () => {
            const tokenNotValidMsg = "Invalid credentials";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn();
            const promptCredentials = jest.fn().mockResolvedValue(undefined); // User cancels credential input
            const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockClear().mockResolvedValueOnce("Update Credentials");

            await expect(
                AuthHandler.promptForAuthentication("lpar.zosmf", {
                    authMethods: { promptCredentials, ssoLogin },
                    imperativeError,
                    throwErrorOnCancel: true,
                })
            ).rejects.toThrow(AuthCancelledError);

            expect(ssoLogin).not.toHaveBeenCalled();
            expect(errorMessageMock).toHaveBeenCalledTimes(1);
            expect(promptCredentials).toHaveBeenCalledTimes(1);
        });

        it("returns false when user cancels SSO login and throwErrorOnCancel is false", async () => {
            const tokenNotValidMsg = "Token is not valid or expired.";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn().mockResolvedValue(true);
            const promptCredentials = jest.fn();
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockClear().mockResolvedValueOnce(undefined); // User cancels

            const result = await AuthHandler.promptForAuthentication("lpar.zosmf", {
                authMethods: { promptCredentials, ssoLogin },
                imperativeError,
            });

            expect(result).toBe(false);
            expect(promptCredentials).not.toHaveBeenCalled();
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(showMessageMock).toHaveBeenCalledTimes(1);
        });

        it("returns false when user cancels credential prompt and throwErrorOnCancel is false", async () => {
            const tokenNotValidMsg = "Invalid credentials";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn();
            const promptCredentials = jest.fn();
            const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockClear().mockResolvedValueOnce(undefined); // User cancels

            const result = await AuthHandler.promptForAuthentication("lpar.zosmf", {
                authMethods: { promptCredentials, ssoLogin },
                imperativeError,
            });

            expect(result).toBe(false);
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(errorMessageMock).toHaveBeenCalledTimes(1);
            expect(promptCredentials).not.toHaveBeenCalled();
        });

        it("returns false when credential input is cancelled and throwErrorOnCancel is false", async () => {
            const tokenNotValidMsg = "Invalid credentials";
            const imperativeError = new ImperativeError({ additionalDetails: tokenNotValidMsg, msg: tokenNotValidMsg });
            const ssoLogin = jest.fn();
            const promptCredentials = jest.fn().mockResolvedValue(undefined); // User cancels credential input
            const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockClear().mockResolvedValueOnce("Update Credentials");

            const result = await AuthHandler.promptForAuthentication("lpar.zosmf", {
                authMethods: { promptCredentials, ssoLogin },
                imperativeError,
            });

            expect(result).toBe(false);
            expect(ssoLogin).not.toHaveBeenCalled();
            expect(errorMessageMock).toHaveBeenCalledTimes(1);
            expect(promptCredentials).toHaveBeenCalledTimes(1);
        });
    });

    describe("AuthCancelledError", () => {
        it("extends FileSystemError", () => {
            const error = new AuthCancelledError("testProfile");
            expect(error).toBeInstanceOf(vscode.FileSystemError);
            expect(error).toBeInstanceOf(AuthCancelledError);
        });

        it("sets profileName and message correctly", () => {
            const profileName = "testProfile";
            const customMessage = "Custom cancellation message";
            const error = new AuthCancelledError(profileName, customMessage);

            expect(error.profileName).toBe(profileName);
            expect(error.message).toBe(customMessage);
            expect(error.name).toBe("AuthCancelledError");
        });

        it("uses default message when none provided", () => {
            const profileName = "testProfile";
            const error = new AuthCancelledError(profileName);

            expect(error.profileName).toBe(profileName);
            expect(error.message).toBe(`Authentication cancelled for profile: ${profileName}`);
            expect(error.name).toBe("AuthCancelledError");
        });
    });

    describe("unlockProfile", () => {
        it("releases the Mutex for the profile in the profile map", async () => {
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
            expect((AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME)!.isLocked()).toBe(false);
        });

        it("does nothing if there is no mutex in the profile map", () => {
            const releaseSpy = jest.spyOn(Mutex.prototype, "release").mockClear();
            AuthHandler.unlockProfile("unused_lpar.zosmf");
            expect(releaseSpy).not.toHaveBeenCalled();
        });

        it("deletes auth flow and releases auth prompt lock when unlocking", async () => {
            // Setup mutexes for the profile
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);

            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
            const authPromptLock = AuthHandler.authPromptLocks.get(TEST_PROFILE_NAME);
            expect(authPromptLock).not.toBeUndefined();
            expect(authPromptLock.isLocked()).toBe(false);
            expect(AuthHandler.getActiveAuthFlow(TEST_PROFILE_NAME)).toBe(undefined);
        });

        it("reuses the same Mutex for the profile if it already exists", async () => {
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
            expect((AuthHandler as any).profileLocks.has(TEST_PROFILE_NAME)).toBe(true);
            // cache initial mutex for comparison
            const mutex = (AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME);

            // same mutex is still present in map since lock/unlock sequence was used
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME);
            expect(mutex).toBe((AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME));
        });

        it("refreshes resources if refreshResources parameter is true", async () => {
            const reloadActiveEditorMock = jest.spyOn(FileManagement, "reloadActiveEditorForProfile").mockResolvedValueOnce(undefined);
            const reloadWorkspaceMock = jest.spyOn(FileManagement, "reloadWorkspacesForProfile").mockResolvedValueOnce(undefined);
            await AuthHandler.lockProfile(TEST_PROFILE_NAME);
            AuthHandler.unlockProfile(TEST_PROFILE_NAME, true);
            expect(reloadActiveEditorMock).toHaveBeenCalledWith(TEST_PROFILE_NAME);
            expect(reloadWorkspaceMock).toHaveBeenCalledWith(TEST_PROFILE_NAME);
        });
    });

    describe("getOrCreateAuthFlow", () => {
        const authOpts: AuthPromptParams = {
            authMethods: {
                promptCredentials: jest.fn(),
                ssoLogin: jest.fn(),
            },
            imperativeError: new ImperativeError({
                msg: "Username or password is invalid or expired",
                errorCode: RestConstants.HTTP_STATUS_401.toString(),
            }),
        };

        beforeEach(() => {
            (AuthHandler as any).authFlows.clear();
            (AuthHandler as any).authPromptLocks.clear();
            (AuthHandler as any).profileLocks.clear();
        });

        it("reuses the same promise for concurrent requests", async () => {
            let resolveFlow: ((value: boolean | PromiseLike<boolean>) => void) | undefined;
            const lockProfileMock = jest.spyOn(AuthHandler, "lockProfile").mockImplementation(
                () =>
                    new Promise<boolean>((resolve) => {
                        resolveFlow = resolve;
                    })
            );

            const flowOne = AuthHandler.getOrCreateAuthFlow(TEST_PROFILE_NAME, authOpts);
            const flowTwo = AuthHandler.getOrCreateAuthFlow(TEST_PROFILE_NAME, authOpts);

            expect(flowOne).toStrictEqual(flowTwo);
            expect(lockProfileMock).toHaveBeenCalledTimes(1);

            resolveFlow?.(true);
            await expect(flowOne).resolves.toBeUndefined();
            expect(AuthHandler.getActiveAuthFlow(TEST_PROFILE_NAME)).toBeUndefined();
            lockProfileMock.mockRestore();
        });

        it("clears the cached promise when authentication fails with AuthCancelledError", async () => {
            const cancellationError = new AuthCancelledError(TEST_PROFILE_NAME, "cancelled");
            const lockProfileMock = jest.spyOn(AuthHandler, "lockProfile").mockRejectedValueOnce(cancellationError);

            await expect(AuthHandler.getOrCreateAuthFlow(TEST_PROFILE_NAME, authOpts)).rejects.toBe(cancellationError);
            expect(lockProfileMock).toHaveBeenCalledTimes(1);
            expect(AuthHandler.getActiveAuthFlow(TEST_PROFILE_NAME)).toBeUndefined();
            lockProfileMock.mockRestore();
        });

        it("starts a new flow after the previous one resolves", async () => {
            const lockProfileMock = jest.spyOn(AuthHandler, "lockProfile").mockClear().mockResolvedValueOnce(true).mockResolvedValueOnce(true);

            await expect(AuthHandler.getOrCreateAuthFlow(TEST_PROFILE_NAME, authOpts)).resolves.toBeUndefined();
            expect(AuthHandler.getActiveAuthFlow(TEST_PROFILE_NAME)).toBeUndefined();

            await expect(AuthHandler.getOrCreateAuthFlow(TEST_PROFILE_NAME, authOpts)).resolves.toBeUndefined();
            expect(lockProfileMock).toHaveBeenCalledTimes(2);
            lockProfileMock.mockRestore();
        });
    });

    describe("getSessFromProfile", () => {
        it("should return a session from a profile", () => {
            const mockSession = {} as Session;
            const getSessionMock = jest.fn().mockReturnValue(mockSession);
            jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockImplementation(() => {
                return {
                    getCommonApi: () => ({
                        getSession: getSessionMock,
                    }),
                } as any;
            });

            const profile = { name: "test-profile", type: "zosmf" } as IProfileLoaded;
            const session = AuthHandler.getSessFromProfile(profile);

            expect(getSessionMock).toHaveBeenCalledTimes(1);
            expect(session).toBe(mockSession);
        });
    });

    describe("sessTypeFromSession", () => {
        it("should return the session type when it exists", () => {
            const session = {
                ISession: {
                    type: SessConstants.AUTH_TYPE_TOKEN,
                },
            } as Session;
            expect(AuthHandler.sessTypeFromSession(session)).toBe(SessConstants.AUTH_TYPE_TOKEN);
        });

        it("should return AUTH_TYPE_NONE if session is null", () => {
            expect(AuthHandler.sessTypeFromSession(null as any)).toBe(SessConstants.AUTH_TYPE_NONE);
        });

        it("should return AUTH_TYPE_NONE if ISession is undefined", () => {
            const session = {
                ISession: undefined,
            } as unknown as Session;
            expect(AuthHandler.sessTypeFromSession(session)).toBe(SessConstants.AUTH_TYPE_NONE);
        });

        it("should return AUTH_TYPE_NONE if ISession is null", () => {
            const session = {
                ISession: null,
            } as any as Session;
            expect(AuthHandler.sessTypeFromSession(session)).toBe(SessConstants.AUTH_TYPE_NONE);
        });

        it("should return AUTH_TYPE_NONE if ISession type is undefined", () => {
            const session = {
                ISession: {
                    type: undefined,
                },
            } as Session;
            expect(AuthHandler.sessTypeFromSession(session)).toBe(SessConstants.AUTH_TYPE_NONE);
        });
    });

    describe("sessTypeFromProfile", () => {
        it("should return the session type from a profile", () => {
            const profile = { name: "test-profile", type: "zosmf" } as IProfileLoaded;
            const mockSession = {
                ISession: {
                    type: SessConstants.AUTH_TYPE_BASIC,
                },
            } as Session;
            const getSessFromProfileMock = jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValue(mockSession);

            const sessionType = AuthHandler.sessTypeFromProfile(profile);

            expect(getSessFromProfileMock).toHaveBeenCalledWith(profile);
            expect(sessionType).toBe(SessConstants.AUTH_TYPE_BASIC);

            getSessFromProfileMock.mockRestore();
        });
    });

    describe("isUsingTokenAuth", () => {
        it("should return true when profileProps contains tokenValue and not user/password", () => {
            const profileProps = ["tokenValue", "host", "port"];
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth(profileProps)).toBe(true);
        });

        it("should return false when profileProps contains tokenValue and user/password", () => {
            const profileProps = ["tokenValue", "user", "password"];
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth(profileProps)).toBe(false);
        });

        it("should return true when baseProfileProps contains tokenValue and profileProps does not have user/password", () => {
            const profileProps = ["host", "port"];
            const baseProfileProps = ["tokenValue"];
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth(profileProps, baseProfileProps)).toBe(true);
        });

        it("should return false when profileProps has user/password and tokenValue", () => {
            const profileProps = ["user", "password", "tokenValue"];
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth(profileProps)).toBe(false);
        });

        it("should return false when baseProfileProps is not provided and profileProps lacks tokenValue", () => {
            const profileProps = ["user", "password"];
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth(profileProps)).toBe(false);
        });

        it("should return false for empty properties", () => {
            // eslint-disable-next-line deprecation/deprecation
            expect(AuthHandler.isUsingTokenAuth([], [])).toBe(false);
        });
    });
});
