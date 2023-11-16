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
import * as globals from "../../../src/globals";
import * as sharedMock from "../../../__mocks__/mockCreators/shared";
import * as dsMock from "../../../__mocks__/mockCreators/datasets";
import * as unixMock from "../../../__mocks__/mockCreators/uss";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { Profiles } from "../../../src/Profiles";
import * as vscode from "vscode";
import { imperative } from "@zowe/cli";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { Job } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { TreeProviders } from "../../../src/shared/TreeProviders";

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
            mockUnixSessionNode: ZoweUSSNode,
            mockJobSessionNode: Job,
            mockResolveQp: jest.fn(),
            mockCreateQp: jest.fn(),
            mockUpdateChosen: ProfileManagement.basicAuthUpdateQpItems[ProfileManagement.AuthQpLabels.update],
            mockAddBasicChosen: ProfileManagement.basicAuthAddQpItems[ProfileManagement.AuthQpLabels.add],
            mockLoginChosen: ProfileManagement.tokenAuthLoginQpItem[ProfileManagement.AuthQpLabels.login],
            mockLogoutChosen: ProfileManagement.tokenAuthLogoutQpItem[ProfileManagement.AuthQpLabels.logout],
            mockEditProfChosen: ProfileManagement.editProfileQpItems[ProfileManagement.AuthQpLabels.edit],
            mockDeleteProfChosen: ProfileManagement.deleteProfileQpItem[ProfileManagement.AuthQpLabels.delete],
            mockHideProfChosen: ProfileManagement.hideProfileQpItems[ProfileManagement.AuthQpLabels.hide],
            mockEnableValidationChosen: ProfileManagement.enableProfileValildationQpItem[ProfileManagement.AuthQpLabels.enable],
            mockDisableValidationChosen: ProfileManagement.disableProfileValildationQpItem[ProfileManagement.AuthQpLabels.disable],
            mockProfileInfo: { usingTeamConfig: true },
            mockProfileInstance: null as any,
            mockTreeProviders: sharedMock.createTreeProviders(),
            debugLogSpy: null as any,
            promptSpy: null as any,
            editSpy: null as any,
            loginSpy: null as any,
            logoutSpy: null as any,
            logMsg: null as any,
            commandSpy: null as any,
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
        Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
        newMocks.commandSpy = jest.spyOn(vscode.commands, "executeCommand");

        return newMocks;
    }

    describe("unit tests around basic auth selections", () => {
        function createBlockMocks(globalMocks): any {
            globalMocks.logMsg = `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`;
            globalMocks.mockDsSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockBasicAuthProfile);
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
        it("profile using basic authentication should see hide session command called for profile in data set tree view", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            Object.defineProperty(mocks.mockProfileInstance, "getProfileInfo", {
                value: jest.fn().mockResolvedValue(mocks.mockProfileInfo as imperative.ProfileInfo),
                configurable: true,
            });
            mocks.mockTreeProviders.ds.mSessionNodes.push(mocks.mockDsSessionNode);
            mocks.mockTreeProviders.uss.mSessionNodes.push(mocks.mockDsSessionNode);
            mocks.mockTreeProviders.job.mSessionNodes.push(mocks.mockDsSessionNode);
            jest.spyOn(TreeProviders, "providers", "get").mockReturnValue(mocks.mockTreeProviders);
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockHideProfChosen);
            mocks.mockResolveQp.mockResolvedValueOnce(ProfileManagement["getPromptHideFromAllTreesQpItems"]()[0]);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.ds.removeSession", mocks.mockDsSessionNode, null, true);
        });
        it("profile using basic authentication should see delete commands called when Delete Profile chosen with v1 profile", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockDeleteProfChosen);
            mocks.mockProfileInfo.usingTeamConfig = false;
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.editSpy).not.toBeCalled();
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.ds.deleteProfile", mocks.mockDsSessionNode);
        });
    });
    describe("unit tests around token auth selections", () => {
        function createBlockMocks(globalMocks): any {
            globalMocks.logMsg = `Profile ${globalMocks.mockTokenAuthProfile.name} is using token authentication.`;
            globalMocks.mockUnixSessionNode = unixMock.createUSSSessionNode(globalMocks.mockSession, globalMocks.mockBasicAuthProfile) as any;
            Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(true), configurable: true });
            globalMocks.mockDsSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockTokenAuthProfile);
            globalMocks.mockUnixSessionNode.getProfile = jest.fn().mockReturnValue(globalMocks.mockTokenAuthProfile);
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
        it("profile using token authentication should see correct command called for hiding a unix tree session node", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            jest.spyOn(TreeProviders, "providers", "get").mockReturnValue(mocks.mockTreeProviders);
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockHideProfChosen);
            mocks.mockResolveQp.mockResolvedValueOnce(ProfileManagement["getPromptHideFromAllTreesQpItems"]()[1]);
            await ProfileManagement.manageProfile(mocks.mockUnixSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.uss.removeSession", mocks.mockUnixSessionNode, null, false);
        });
        it("profile using token authentication should see correct command called for enabling validation a unix tree session node", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockEnableValidationChosen);
            await ProfileManagement.manageProfile(mocks.mockUnixSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.uss.enableValidation", mocks.mockUnixSessionNode);
        });
        it("profile using token authentication should see correct command called for disabling validation a unix tree session node", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockDisableValidationChosen);
            await ProfileManagement.manageProfile(mocks.mockUnixSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.uss.disableValidation", mocks.mockUnixSessionNode);
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
        it("profile using token authentication should see correct command called for enabling validation a data set tree session node", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockEnableValidationChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.ds.enableValidation", mocks.mockDsSessionNode);
        });
        it("profile using token authentication should see correct command called for disabling validation a data set tree session node", async () => {
            const mocks = createBlockMocks(createGlobalMocks());
            mocks.mockResolveQp.mockResolvedValueOnce(mocks.mockDisableValidationChosen);
            await ProfileManagement.manageProfile(mocks.mockDsSessionNode);
            expect(mocks.debugLogSpy).toBeCalledWith(mocks.logMsg);
            expect(mocks.commandSpy).toHaveBeenLastCalledWith("zowe.ds.disableValidation", mocks.mockDsSessionNode);
        });
    });

    describe("handleHideProfiles unit tests", () => {
        it("should display 'operation cancelled' if no option is selected for hiding a profile", async () => {
            const mocks = createGlobalMocks();
            const infoMessageSpy = jest.spyOn(Gui, "infoMessage");
            jest.spyOn(ProfileManagement as any, "promptHideFromAllTrees").mockReturnValue(undefined);
            await expect(ProfileManagement["handleHideProfiles"](mocks.mockDsSessionNode)).resolves.toEqual(undefined);
            expect(infoMessageSpy).toBeCalledTimes(1);
        });
        it("should hide the job session", async () => {
            const mocks = createGlobalMocks();
            const commandSpy = jest.spyOn(vscode.commands, "executeCommand");
            jest.spyOn(ProfileManagement as any, "promptHideFromAllTrees").mockReturnValue(
                ProfileManagement["getPromptHideFromAllTreesQpItems"]()[1]
            );
            await expect(ProfileManagement["handleHideProfiles"](mocks.mockJobSessionNode)).resolves.toEqual(undefined);
            expect(commandSpy).toHaveBeenCalledWith("zowe.jobs.removeJobsSession", mocks.mockJobSessionNode, null, false);
        });
    });

    describe("getRegisteredProfileNameList unit tests", () => {
        function createBlockMocks(globalMocks): any {
            const theMocks = {
                registry: {
                    registeredMvsApiTypes: jest.fn(),
                    registeredUssApiTypes: jest.fn(),
                    registeredJesApiTypes: jest.fn(),
                },
            };
            globalMocks.mockProfileInstance.allProfiles = [{ name: "sestest" }];
            jest.spyOn(globalMocks.mockProfileInstance, "loadNamedProfile").mockReturnValue(sharedMock.createValidIProfile());
            Object.defineProperty(ZoweExplorerApiRegister, "getInstance", {
                value: jest.fn().mockReturnValue(theMocks.registry),
                configurable: true,
            });
            return theMocks;
        }
        afterEach(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });
        it("should return zosmf profile registered with the MVS tree", () => {
            const blockMocks = createBlockMocks(createGlobalMocks());
            blockMocks.registry.registeredMvsApiTypes = jest.fn().mockReturnValueOnce("zosmf");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.MVS)).toEqual(["sestest"]);
        });
        it("should return zosmf profile registered with the USS tree", () => {
            const blockMocks = createBlockMocks(createGlobalMocks());
            blockMocks.registry.registeredUssApiTypes = jest.fn().mockReturnValueOnce("zosmf");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.USS)).toEqual(["sestest"]);
        });
        it("should return zosmf profile registered with the JES tree", () => {
            const blockMocks = createBlockMocks(createGlobalMocks());
            blockMocks.registry.registeredJesApiTypes = jest.fn().mockReturnValueOnce("zosmf");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.JES)).toEqual(["sestest"]);
        });
        it("should return empty array with no profiles in allProfiles", () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            globalMocks.mockProfileInstance.allProfiles = [];
            const regSpy = jest.spyOn(blockMocks.registry, "registeredJesApiTypes");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.JES)).toEqual([]);
            expect(regSpy).not.toBeCalled();
        });
        it("should return empty array when profile in allProfiles doesn't load", () => {
            const globalMocks = createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            jest.spyOn(globalMocks.mockProfileInstance, "loadNamedProfile").mockReturnValue(undefined);
            const regSpy = jest.spyOn(blockMocks.registry, "registeredJesApiTypes");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.JES)).toEqual([]);
            expect(regSpy).not.toBeCalled();
        });
        it("should return empty array when profile type isn't registered", () => {
            const blockMocks = createBlockMocks(createGlobalMocks());
            blockMocks.registry.registeredJesApiTypes = jest.fn().mockReturnValueOnce("zftp");
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.JES)).toEqual([]);
        });
        it("should return empty array when unkown tree is forcefully passed", () => {
            createBlockMocks(createGlobalMocks());
            expect(ProfileManagement.getRegisteredProfileNameList("fake" as any)).toEqual([]);
        });
        it("should catch error and log a warning then return empty array", () => {
            const globalMocks = createGlobalMocks();
            createBlockMocks(globalMocks);
            const thrownError = new Error("fake error");
            const warnSpy = jest.spyOn(ZoweLogger, "warn");
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn().mockImplementationOnce(() => {
                    throw thrownError;
                }),
                configurable: true,
            });
            expect(ProfileManagement.getRegisteredProfileNameList(globals.Trees.JES)).toEqual([]);
            expect(warnSpy).toBeCalledWith(thrownError);
        });
    });
});
