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

import * as vscode from "vscode";
import { ProfilesCache } from "@zowe/zowe-explorer-api";
import { imperative } from "@zowe/cli";
import * as utils from "../../src/utils/ProfilesUtils";
import * as globals from "../../src/globals";
import { createInstanceOfProfile, createInstanceOfProfileInfo, createIProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";
import { ZoweLogger } from "../../src/utils/LoggerUtils";

function createGlobalMocks() {
    const globalMocks = {
        isTheia: jest.fn(),
        testProfileLoaded: createValidIProfile(),
        mockProfileInstance: null,
        mockProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfileLoaded);
    const isTheia = jest.fn();

    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest
            .fn(() => {
                return { promptCredentials: ["test", "test", "test"] };
            })
            .mockReturnValue(globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(globals, "ISTHEIA", { get: isTheia, configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(utils, "isTheia", { value: jest.fn(), configurable: true });

    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    return {
        isTheia,
    };
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (..._args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Utils Unit Tests - Function errorHandling", () => {
    function createBlockMocks() {
        const imperativeProfile = createIProfile();
        const profile = createInstanceOfProfile(imperativeProfile);

        return {
            profile,
        };
    }

    it("Checking common error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Update Credentials" });
        const errorDetails = new imperative.ImperativeError({
            msg: "Invalid credentials",
            errorCode: 401 as unknown as string,
        });
        const label = "invalidCred";

        await utils.errorHandling(errorDetails, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials for profile '${label}'. Please ensure the username and password are valid or this may lead to a lock-out.`,
            { modal: true },
            "Update Credentials"
        );
    });
    it("Checking USS error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Update Credentials" });
        const errorDetails = new imperative.ImperativeError({
            msg: "Invalid credentials",
            errorCode: 401 as unknown as string,
        });
        let label = "invalidCred [/tmp]";
        label = label.substring(0, label.indexOf(" [")).trim();

        await utils.errorHandling(errorDetails, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials for profile '${label}'. Please ensure the username and password are valid or this may lead to a lock-out.`,
            { modal: true },
            "Update Credentials"
        );
    });
    it("Checking common error handling - Theia", async () => {
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Update Credentials" });
        jest.spyOn(utils, "isTheia").mockReturnValue(true);
        const errorDetails = new imperative.ImperativeError({
            msg: "Invalid credentials",
            errorCode: 401 as unknown as string,
        });
        const label = "invalidCred";

        await utils.errorHandling(errorDetails, label);

        // TODO: check why this return two messages?
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials for profile '${label}'. Please ensure the username and password are valid or this may lead to a lock-out.`,
            { modal: true },
            "Update Credentials"
        );
    });
});
