/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import * as vscode from "vscode";
// import * as zowe from "@zowe/cli";
import * as utils from "../../src/utils";
// import * as profileUtils from "../../src/profiles/utils";
import * as globals from "../../src/globals";
import { createInstanceOfProfile, createIProfile, createISession, createISessionWithoutCredentials, createValidBaseProfile } from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";
// import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";

function createGlobalMocks() {
    const globalMocks = {
        isTheia: false,
        mockGetValidSession: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        commonApi: null,
        baseProfile: createValidBaseProfile(),
        serviceProfile: createIProfile(),
        mockGetCommonApi: jest.fn(),
        testSession: createISession(),
        mockProfileInstance: null,
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.serviceProfile, globalMocks.testSession);
    globalMocks.mockProfileInstance.loadNamedProfile.mockReturnValue(globalMocks.serviceProfile);

    Object.defineProperty(Profiles, "getInstance", { value: jest.fn().mockReturnValue(globalMocks.mockProfileInstance), configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: globalMocks.mockShowErrorMessage, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => globalMocks.isTheia, configurable: true });

    return globalMocks;
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Utils Unit Tests - Function errorHandling", () => {
    it("Checking common error handling (not 401)", async () => {
        const globalMocks = createGlobalMocks();

        const testError = new Error("Test error!");
        const label = "invalidCred";

        await utils.errorHandling(testError, label);

        expect(globalMocks.mockShowErrorMessage).toHaveBeenCalledWith(`Error: Test error!`);
    });

    it("Checking handling of error 401", async () => {
        const globalMocks = createGlobalMocks();

        const label = "invalidCred";
        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        const mockIProfileNoCredentials = globalMocks.serviceProfile;
        delete mockIProfileNoCredentials.profile.user;
        delete mockIProfileNoCredentials.profile.password;
        globalMocks.mockShowErrorMessage.mockResolvedValue(true);

        await utils.errorHandling(testError, label);

        expect(globalMocks.mockShowErrorMessage).toHaveBeenCalledWith(`Invalid Credentials. Please ensure the token or username/password for invalidCred are valid or this may lead to a lock-out.`,
                                                                     "Check Credentials");
        expect(globalMocks.serviceProfile.profile).toEqual(mockIProfileNoCredentials.profile);
        expect(globalMocks.mockProfileInstance.promptCredentials).toBeCalledWith(globalMocks.serviceProfile, true);
    });

    it("Checking handling of error 401 (Theia)", async () => {
        const globalMocks = createGlobalMocks();

        const label = "invalidCred";
        globalMocks.isTheia = true;
        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };

        await utils.errorHandling(testError, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`Invalid Credentials. Please ensure the token or username/password for invalidCred are valid or this may lead to a lock-out.`);
        expect(globalMocks.mockProfileInstance.promptCredentials).toBeCalledWith(globalMocks.serviceProfile, true);
    });
});
