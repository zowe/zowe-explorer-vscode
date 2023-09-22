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

jest.mock("fs");
jest.mock("vscode");

describe("ProfileManagement unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    function createGlobalMocks() {
        const newMocks = {
            mockSession: sharedMock.createISession(),
            mockBasicAuthProfile: sharedMock.createValidIProfile(),
            mockTokenAuthProfile: sharedMock.createTokenAuthIProfile(),
            mockNoAuthProfile: sharedMock.createInvalidIProfile(),
            opCancelledSpy: jest.spyOn(Gui, "infoMessage"),
            mockDsSessionNode: ZoweDatasetNode,
            mockResolveQp: jest.fn(),
            mockCreateQp: jest.fn(),
            mockUpdateChosen: ProfileManagement.basicAuthUpdateQpItems[ProfileManagement.AuthQpLabels.update],
            mockAddBasicChosen: ProfileManagement.basicAuthAddQpItems[ProfileManagement.AuthQpLabels.add],
            mockLoginChosen: ProfileManagement.tokenAuthLoginQpItem[ProfileManagement.AuthQpLabels.login],
            mockLogoutChosen: ProfileManagement.tokenAuthLogoutQpItem[ProfileManagement.AuthQpLabels.logout],
            mockEditProfChosen: ProfileManagement.otherProfileQpItems[ProfileManagement.AuthQpLabels.edit],
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

        return newMocks;
    }

    describe("unit tests around basic auth selections", () => {
        function createBlockMocks(globalMocks) {
            globalMocks.logMsg = `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`;
            globalMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockBasicAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(globalMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(globalMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            globalMocks.editSpy = jest.spyOn(globalMocks.mockProfileInstance, "editSession");
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockBasicAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockBasicAuthProfile),
                configurable: true,
            });
        }
        it("profile using basic authentication should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile using basic authentication should see promptCredentials called when Update Credentials chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockUpdateChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.promptSpy).toBeCalled();
        });
        it("profile using basic authentication should see editSession called when Edit Profile chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockEditProfChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.editSpy).toBeCalled();
        });
    });
    describe("unit tests around token auth selections", () => {
        function createBlockMocks(globalMocks) {
            globalMocks.logMsg = `Profile ${globalMocks.mockTokenAuthProfile.name} is using token authentication.`;
            globalMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockTokenAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(globalMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(globalMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            globalMocks.editSpy = jest.spyOn(globalMocks.mockProfileInstance, "editSession");
            Object.defineProperty(globalMocks.mockProfileInstance, "ssoLogin", { value: jest.fn(), configurable: true });
            globalMocks.loginSpy = jest.spyOn(Profiles.getInstance(), "ssoLogin");
            Object.defineProperty(globalMocks.mockProfileInstance, "ssoLogout", { value: jest.fn(), configurable: true });
            globalMocks.logoutSpy = jest.spyOn(Profiles.getInstance(), "ssoLogout");
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(true), configurable: true });
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockTokenAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockTokenAuthProfile),
                configurable: true,
            });
        }
        it("profile using token authentication should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile using token authentication should see ssoLogin called when Log in to authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockLoginChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.loginSpy).toBeCalled();
        });
        it("profile using token authentication should see ssoLogout called when Log out from authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockLogoutChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.logoutSpy).toBeCalled();
        });
    });
    describe("unit tests around no auth declared selections", () => {
        function createBlockMocks(globalMocks) {
            globalMocks.logMsg = `Profile ${globalMocks.mockNoAuthProfile.name} authentication method is unkown.`;
            globalMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockNoAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(globalMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(globalMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            globalMocks.editSpy = jest.spyOn(globalMocks.mockProfileInstance, "editSession");
            Object.defineProperty(globalMocks.mockProfileInstance, "ssoLogin", { value: jest.fn(), configurable: true });
            globalMocks.loginSpy = jest.spyOn(Profiles.getInstance(), "ssoLogin");
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(false), configurable: true });
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockTokenAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockNoAuthProfile),
                configurable: true,
            });
        }
        it("profile with no authentication method should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(undefined);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
        });
        it("profile with no authentication method should see promptCredentials called when Add Basic Credentials chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockAddBasicChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.promptSpy).toBeCalled();
        });
        it("profile with no authentication method should see ssoLogin called when Log in to authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockLoginChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.loginSpy).toBeCalled();
        });
        it("profile with no authentication method should see editSession called when Edit Profile chosen", async () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            globalMocks.mockResolveQp.mockResolvedValueOnce(globalMocks.mockEditProfChosen);
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(globalMocks.logMsg);
            expect(globalMocks.editSpy).toBeCalled();
        });
    });
});
