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
import { AuthHandler } from "../../../src";
import { FileManagement } from "../../../src/utils/FileManagement";
import { ImperativeError } from "@zowe/imperative";

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
        expect((AuthHandler as any).lockedProfiles.has(TEST_PROFILE_NAME)).toBe(true);
        expect((AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME)).toBeInstanceOf(Mutex);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
    });

    it("handle promptForAuthentication call if error and options are given", async () => {
        const promptForAuthenticationMock = jest.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValueOnce(true);
        const impError = new ImperativeError({ msg: "Example auth error" });
        const promptOpts = {
            promptCredentials: jest.fn(),
            ssoLogin: jest.fn(),
        };
        const releaseSpy = jest.spyOn(Mutex.prototype, "release");
        const result = await AuthHandler.lockProfile(TEST_PROFILE_NAME, impError, promptOpts);
        expect(result).toBe(true);
        expect(promptForAuthenticationMock).toHaveBeenCalledTimes(1);
        expect(promptForAuthenticationMock).toHaveBeenCalledWith(impError, TEST_PROFILE_NAME, promptOpts);
        expect(releaseSpy).toHaveBeenCalledTimes(1);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
    });

    it("reuses the same Mutex for the profile if it already exists", async () => {
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        expect((AuthHandler as any).lockedProfiles.has(TEST_PROFILE_NAME)).toBe(true);
        // cache initial mutex for comparison
        const mutex = (AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME);
        expect(mutex).toBeInstanceOf(Mutex);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);

        // same mutex is still present in map since lock/unlock sequence was used
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        expect(mutex).toBe((AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME));
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
    });
});

describe("AuthHandler.unlockProfile", () => {
    it("releases the Mutex for the profile in the profile map", async () => {
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        expect((AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME)!.isLocked()).toBe(false);
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
        expect((AuthHandler as any).lockedProfiles.has(TEST_PROFILE_NAME)).toBe(true);
        // cache initial mutex for comparison
        const mutex = (AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME);

        // same mutex is still present in map since lock/unlock sequence was used
        await AuthHandler.lockProfile(TEST_PROFILE_NAME);
        AuthHandler.unlockProfile(TEST_PROFILE_NAME);
        expect(mutex).toBe((AuthHandler as any).lockedProfiles.get(TEST_PROFILE_NAME));
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
