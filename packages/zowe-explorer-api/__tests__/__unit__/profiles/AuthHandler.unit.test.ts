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
import { AuthHandler, Gui } from "../../../src";
import { FileManagement } from "../../../src/utils/FileManagement";
import { ImperativeError } from "@zowe/imperative";
import { AuthPromptParams } from "@zowe/zowe-explorer-api";

const TEST_PROFILE_NAME = "lpar.zosmf";

describe("AuthHandler.isProfileLocked", () => {
    it("returns true if the profile is locked", async () => {
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        expect(AuthHandler.isProfileLocked(TEST_PROFILE_NAME)).toBe(true);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
    });

    it("returns false if the profile is not locked", async () => {
        expect(AuthHandler.isProfileLocked(TEST_PROFILE_NAME)).toBe(false);
    });

    it("returns false if no mutex is present for the given profile", async () => {
        expect(AuthHandler.isProfileLocked("unused_lpar.zosmf")).toBe(false);
    });
});

describe("AuthHandler.lockProfile", () => {
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
        const releaseSpy = jest.spyOn(Mutex.prototype, "release");
        const result = await AuthHandler.lockProfile(TEST_PROFILE_NAME, authOpts);
        expect(result).toBe(true);
        expect(promptForAuthenticationMock).toHaveBeenCalledTimes(1);
        expect(promptForAuthenticationMock).toHaveBeenCalledWith(TEST_PROFILE_NAME, authOpts);
        expect(releaseSpy).toHaveBeenCalledTimes(1);
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

describe("AuthHandler.promptForAuthentication", () => {
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
});

describe("AuthHandler.unlockProfile", () => {
    it("releases the Mutex for the profile in the profile map", async () => {
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        expect((AuthHandler as any).profileLocks.get(TEST_PROFILE_NAME)!.isLocked()).toBe(false);
    });

    it("does nothing if there is no mutex in the profile map", async () => {
        const releaseSpy = jest.spyOn(Mutex.prototype, "release").mockClear();
        AuthHandler.unlockProfile("unused_lpar.zosmf");
        expect(releaseSpy).not.toHaveBeenCalled();
    });

    it("does nothing if the mutex in the map is not locked", async () => {
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);

        const releaseSpy = jest.spyOn(Mutex.prototype, "release").mockClear();
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        expect(releaseSpy).not.toHaveBeenCalled();
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
