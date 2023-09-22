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
jest.mock("@zowe/cli");

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
            mockDsSessionNode: ZoweDatasetNode,
            mockUpdateChosen: null as any,
            mockAddBasicChosen: null as any,
            mockLoginChosen: null as any,
            mockLogoutChosen: null as any,
            mockEditProfChosen: null as any,
            mockCreateQp: jest.fn(),
            debugLogSpy: null as any,
            opCancelledSpy: jest.spyOn(Gui, "infoMessage"),
        };
        newMocks.mockUpdateChosen = ProfileManagement.basicAuthUpdateQpItems[ProfileManagement.AuthQpLabels.update];
        newMocks.mockAddBasicChosen = ProfileManagement.basicAuthAddQpItems[ProfileManagement.AuthQpLabels.add];
        newMocks.mockLoginChosen = ProfileManagement.tokenAuthLoginQpItem[ProfileManagement.AuthQpLabels.login];
        newMocks.mockLogoutChosen = ProfileManagement.tokenAuthLogoutQpItem[ProfileManagement.AuthQpLabels.logout];
        newMocks.mockEditProfChosen = ProfileManagement.otherProfileQpItems[ProfileManagement.AuthQpLabels.edit];
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
        Object.defineProperty(profUtils.ProfilesUtils, "promptCredentials", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "createQuickPick", { value: newMocks.mockCreateQp, configurable: true });
        Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
        newMocks.debugLogSpy = jest.spyOn(ZoweLogger, "debug");

        return newMocks;
    }

    describe("unit tests around basic auth selections", () => {
        function createBlockMocks(globalMocks) {
            const newMocks = {
                mockProfileInstance: null as any,
                editSpy: null as any,
                promptSpy: jest.spyOn(profUtils.ProfilesUtils, "promptCredentials"),
                logMsg: `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`,
            };
            newMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockBasicAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(newMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(newMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            newMocks.editSpy = jest.spyOn(newMocks.mockProfileInstance, "editSession");
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockBasicAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockBasicAuthProfile),
                configurable: true,
            });
            return newMocks;
        }
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });
        it("profile using basic authentication should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn().mockResolvedValueOnce(undefined), configurable: true });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.promptSpy).not.toBeCalled();
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
            globalMocks.debugLogSpy.mockClear();
            blockMocks.promptSpy.mockClear();
            globalMocks.opCancelledSpy.mockClear();
        });
        it("profile using basic authentication should see promptCredentials called when Update Credentials chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockUpdateChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.promptSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.promptSpy.mockClear();
        });
        it("profile using basic authentication should see editSession called when Edit Profile chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockEditProfChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.promptSpy).not.toBeCalled();
            expect(blockMocks.editSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.promptSpy.mockClear();
            blockMocks.editSpy.mockClear();
        });
    });
    describe("unit tests around token auth selections", () => {
        function createBlockMocks(globalMocks) {
            const newMocks = {
                mockProfileInstance: null as any,
                loginSpy: null as any,
                logoutSpy: null as any,
                editSpy: null as any,
                logMsg: `Profile ${globalMocks.mockTokenAuthProfile.name} is using token authentication.`,
            };
            newMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockTokenAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(newMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(newMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            newMocks.editSpy = jest.spyOn(newMocks.mockProfileInstance, "editSession");
            Object.defineProperty(newMocks.mockProfileInstance, "ssoLogin", { value: jest.fn(), configurable: true });
            newMocks.loginSpy = jest.spyOn(Profiles.getInstance(), "ssoLogin");
            Object.defineProperty(newMocks.mockProfileInstance, "ssoLogout", { value: jest.fn(), configurable: true });
            newMocks.logoutSpy = jest.spyOn(Profiles.getInstance(), "ssoLogout");
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(true), configurable: true });
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockTokenAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockTokenAuthProfile),
                configurable: true,
            });
            return newMocks;
        }
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });
        it("profile using token authentication should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn().mockResolvedValueOnce(undefined), configurable: true });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.loginSpy).not.toBeCalled();
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
            globalMocks.debugLogSpy.mockClear();
            blockMocks.loginSpy.mockClear();
            globalMocks.opCancelledSpy.mockClear();
        });
        it("profile using token authentication should see ssoLogin called when Log in to authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockLoginChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.loginSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.loginSpy.mockClear();
        });
        it("profile using token authentication should see ssoLogout called when Log out from authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockLogoutChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.loginSpy).not.toBeCalled();
            expect(blockMocks.logoutSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.loginSpy.mockClear();
            blockMocks.logoutSpy.mockClear();
        });
    });
    describe("unit tests around no auth declared selections", () => {
        function createBlockMocks(globalMocks) {
            const newMocks = {
                mockProfileInstance: null as any,
                loginSpy: null as any,
                editSpy: null as any,
                promptSpy: jest.spyOn(profUtils.ProfilesUtils, "promptCredentials"),
                logMsg: `Profile ${globalMocks.mockNoAuthProfile.name} authentication method is unkown.`,
            };
            newMocks.mockProfileInstance = sharedMock.createInstanceOfProfile(globalMocks.mockNoAuthProfile);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockReturnValue(newMocks.mockProfileInstance),
                configurable: true,
            });
            Object.defineProperty(newMocks.mockProfileInstance, "editSession", { value: jest.fn(), configurable: true });
            newMocks.editSpy = jest.spyOn(newMocks.mockProfileInstance, "editSession");
            Object.defineProperty(newMocks.mockProfileInstance, "ssoLogin", { value: jest.fn(), configurable: true });
            newMocks.loginSpy = jest.spyOn(Profiles.getInstance(), "ssoLogin");
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(false), configurable: true });
            globalMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(globalMocks.mockSession, globalMocks.mockTokenAuthProfile) as any;
            Object.defineProperty(globalMocks.mockDsSessionNode, "getProfile", {
                value: jest.fn().mockReturnValue(globalMocks.mockNoAuthProfile),
                configurable: true,
            });
            return newMocks;
        }
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });
        it("profile with no authentication method should see Operation Cancelled when escaping quick pick", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn().mockResolvedValueOnce(undefined), configurable: true });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.loginSpy).not.toBeCalled();
            expect(globalMocks.opCancelledSpy).toBeCalledWith("Operation Cancelled");
            globalMocks.debugLogSpy.mockClear();
            blockMocks.loginSpy.mockClear();
            globalMocks.opCancelledSpy.mockClear();
        });
        it("profile with no authentication method should see promptCredentials called when Add Basic Credentials chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockAddBasicChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.promptSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.promptSpy.mockClear();
        });
        it("profile with no authentication method should see ssoLogin called when Log in to authentication service chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockLoginChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.loginSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.loginSpy.mockClear();
        });
        it("profile with no authentication method should see editSession called when Edit Profile chosen", async () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            Object.defineProperty(Gui, "resolveQuickPick", {
                value: jest.fn().mockResolvedValueOnce(globalMocks.mockEditProfChosen),
                configurable: true,
            });
            await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
            expect(globalMocks.debugLogSpy).toBeCalledWith(blockMocks.logMsg);
            expect(blockMocks.promptSpy).not.toBeCalled();
            expect(blockMocks.editSpy).toBeCalled();
            globalMocks.debugLogSpy.mockClear();
            blockMocks.promptSpy.mockClear();
            blockMocks.editSpy.mockClear();
        });
    });
});
