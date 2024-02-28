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
import { ZoweLogger } from "../../src/utils/ZoweLogger";
import { createInstanceOfProfile, createInstanceOfProfileInfo, createIProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";
import { mocked } from "../../__mocks__/mockUtils";

function createGlobalMocks() {
    const globalMocks = {
        testProfileLoaded: createValidIProfile(),
        mockProfileInstance: null,
        mockProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfileLoaded);

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

    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    return globalMocks;
}

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
});
