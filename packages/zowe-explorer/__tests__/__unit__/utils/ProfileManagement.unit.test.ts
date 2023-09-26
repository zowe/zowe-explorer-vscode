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

import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as sharedMock from "../../../__mocks__/mockCreators/shared";
import * as dsMock from "../../../__mocks__/mockCreators/datasets";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { Profiles } from "../../../src/Profiles";
import * as vscode from "vscode";
import { imperative } from "@zowe/cli";

jest.mock("fs");
jest.mock("vscode");

describe("ProfileManagement unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    function createGlobalMocks(): any {
        const newMocks = {
            mockSession: sharedMock.createISession(),
            mockBasicAuthProfile: sharedMock.createValidIProfile(),
            mockTokenAuthProfile: sharedMock.createTokenAuthIProfile(),
            mockNoAuthProfile: sharedMock.createNoAuthIProfile(),
            opCancelledSpy: jest.spyOn(Gui, "infoMessage"),
            mockDsSessionNode: ZoweDatasetNode,
            mockResolveQp: jest.fn(),
            mockCreateQp: jest.fn(),
            mockUpdateChosen: ProfileManagement.basicAuthUpdateQpItems[ProfileManagement.AuthQpLabels.update],
            mockAddBasicChosen: ProfileManagement.basicAuthAddQpItems[ProfileManagement.AuthQpLabels.add],
            mockLoginChosen: ProfileManagement.tokenAuthLoginQpItem[ProfileManagement.AuthQpLabels.login],
            mockLogoutChosen: ProfileManagement.tokenAuthLogoutQpItem[ProfileManagement.AuthQpLabels.logout],
            mockEditProfChosen: ProfileManagement.editProfileQpItems[ProfileManagement.AuthQpLabels.edit],
            mockDeleteProfChosen: ProfileManagement.deleteProfileQpItem[ProfileManagement.AuthQpLabels.delete],
            mockProfileInfo: { usingTeamConfig: true },
            mockProfileInstance: null as any,
            debugLogSpy: null as any,
            promptSpy: null as any,
            editSpy: null as any,
            loginSpy: null as any,
            logoutSpy: null as any,
            logMsg: null as any,
        };
        Object.defineProperty(profUtils.ProfilesUtils, "promptCredentials", { value: jest.fn(), configurable: true });
        newMocks.promptSpy = jest.spyOn(profUtils.ProfilesUtils, "promptCredentials");
        Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
        newMocks.debugLogSpy = jest.spyOn(ZoweLogger, "debug");
        Object.defineProperty(Gui, "resolveQuickPick", { value: newMocks.mockResolveQp, configurable: true });
        newMocks.mockCreateQp.mockReturnValue({
            show: jest.fn(() => {
                return {};
            }),
            hide: jest.fn(() => {
                return {};
            }),
            onDidAccept: jest.fn(() => {
                return {};
            }),
        });
        Object.defineProperty(Gui, "createQuickPick", { value: newMocks.mockCreateQp, configurable: true });
        newMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(newMocks.mockSession, newMocks.mockBasicAuthProfile) as any;
        newMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(newMocks.mockBasicAuthProfile);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn().mockReturnValue(newMocks.mockProfileInstance),
            configurable: true,
        });
        Object.defineProperty(newMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
        newMocks.editSpy = jest.spyOn(newMocks.mockProfileInstance, "editSession");
        Object.defineProperty(newMocks.mockProfileInstance, "ssoLogin", { value: jest.fn(), configurable: true });
        newMocks.loginSpy = jest.spyOn(newMocks.mockProfileInstance, "ssoLogin");
        Object.defineProperty(newMocks.mockProfileInstance, "ssoLogout", { value: jest.fn(), configurable: true });
        newMocks.logoutSpy = jest.spyOn(newMocks.mockProfileInstance, "ssoLogout");

        return newMocks;
    }

    describe("unit tests around basic auth selections", () => {
        function createBlockMocks(globalMocks): any {
            globalMocks.logMsg = `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`;
            globalMocks.mockDsSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockBasicAuthProfile);
            Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
            return globalMocks;
        }
        it("profile using basic authentication should see Operation Cancelled when escaping quick pick", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile using basic authentication should see promptCredentials called when Update Credentials chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockUpdateChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.promptSpy).toBeCalled();
        });
        it("profile using basic authentication should see editSession called when Edit Profile chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockEditProfChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.editSpy).toBeCalled();
        });
        it("profile using basic authentication should see editSession called when Delete Profile chosen with v2 profile", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            Object.defineProperty(mocks.mockProfileInstance, "getProfileInfo", {
                value: jest.fn().mockResolvedValue(mocks.mockProfileInfo as imperative.ProfileInfo),
                configurable: true,
            });
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockDeleteProfChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.editSpy).toBeCalled();
        });
        it("profile using basic authentication should see delete commands called when Delete Profile chosen with v1 profile", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockDeleteProfChosen);
            mocks.mockProfileInfo.usingTeamConfig = false;
            const commandSpy = jest.spyOn(vscode.commands, "executeCommand");
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.editSpy).not.toBeCalled();
            expect(commandSpy).toBeCalled();
        });
    });
    describe("unit tests around token auth selections", () => {
        function createBlockMocks(globalMocks): any {
            globalMocks.logMsg = `Profile ${globalMocks.mockTokenAuthProfile.name} is using token authentication.`;
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(true), configurable: true });
            globalMocks.mockDsSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockTokenAuthProfile);
            return globalMocks;
        }
        it("profile using token authentication should see Operation Cancelled when escaping quick pick", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile using token authentication should see ssoLogin called when Log in to authentication service chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockLoginChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.loginSpy).toBeCalled();
        });
        it("profile using token authentication should see ssoLogout called when Log out from authentication service chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockLogoutChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.logoutSpy).toBeCalled();
        });
    });
    describe("unit tests around no auth declared selections", () => {
        function createBlockMocks(globalMocks): any {
            globalMocks.logMsg = `Profile ${globalMocks.mockNoAuthProfile.name} authentication method is unkown.`;
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(false), configurable: true });
            globalMocks.mockDsSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockNoAuthProfile);
            return globalMocks;
        }
        it("profile with no authentication method should see Operation Cancelled when escaping quick pick", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile with no authentication method should see promptCredentials called when Add Basic Credentials chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockAddBasicChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.promptSpy).toBeCalled();
        });
        it("profile with no authentication method should see ssoLogin called when Log in to authentication service chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockLoginChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.loginSpy).toBeCalled();
        });
        it("profile with no authentication method should see editSession called when Edit Profile chosen", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockEditProfChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.editSpy).toBeCalled();
        });
    });
});
