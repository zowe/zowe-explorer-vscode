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

import { ZosmfUssApi, ZosmfMvsApi } from "../../../src/api/ZoweExplorerZosmfApi";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import { AbstractSession, Logger, ConnectionPropsForSessCfg } from "@zowe/imperative";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { Profiles } from "../../../src/Profiles";
import { createISession, createISessionWithoutCredentials, createValidBaseProfile,
         createValidIProfile, createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";
import { createProfileManager } from "../../../__mocks__/mockCreators/profiles";
import * as profileUtils from "../../../src/profiles/utils";

export declare enum TaskStage {
    IN_PROGRESS = 0,
    COMPLETE = 1,
    NOT_STARTED = 2,
    FAILED = 3
}

describe("Zosmf API tests", () => {
    it("should test that copy data set uses default options", async () => {
        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" });
    });

    it("should test that copy data set uses enq", async () => {
        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" },
            { enq: "SHR", fromDataSet: { dataSetName: "BROADCOM.FROM" } });
    });

    it("should test that copy data set uses enq only", async () => {
        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" },
            { enq: "SHR" } as any);
    });

    it("should test that common putContent is called by putContents", async () => {
        const api = new ZosmfUssApi();

        (api.putContent as any) = jest.fn<ReturnType<typeof api.putContents>, Parameters<typeof api.putContents>>(
            async (inputFilePath: string, ussFilePath: string,
                   binary?: boolean, localEncoding?: string,
                   etag?: string, returnEtag?: boolean) => {

                return {
                    success: true,
                    commandResponse: "whatever"
                };

            });

        await api.putContents("someLocalFile.txt", "/some/remote", true);

        expect(api.putContent).toBeCalledTimes(1);
        expect(api.putContent).toBeCalledWith("someLocalFile.txt", "/some/remote", {
            binary: true,
        });
    });

    it("should test putContent method passes all options to Zowe api method", async () => {
        const fileToUssFile = jest.fn(async (session: AbstractSession, inputFile: string, ussname: string, options?: zowe.IUploadOptions) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Upload = { fileToUssFile };

        const api = new ZosmfUssApi();
        api.getSession = jest.fn();

        await api.putContent("someLocalFile.txt", "/some/remote", {
            encoding: 285
        });
    });
});

describe("ZosmfApiCommon Unit Tests - Function getValidProfile", () => {
    async function createBlockMocks() {
        const newMocks = {
            profiles: null,
            sessionNoCredentials: createISessionWithoutCredentials(),
            profileInstance: null,
            mockGetbaseProfile: jest.fn(),
            mockCollectProfileDetails: jest.fn(),
            baseProfile: createValidBaseProfile(),
            serviceProfile: createValidIProfile(),
            mockShowInputBox: jest.fn(),
            mockGetConfiguration: jest.fn(),
            mockCreateQuickPick: jest.fn(),
            mockShowQuickPick: jest.fn(),
            mockShowInformationMessage: jest.fn(),
            mockShowErrorMessage: jest.fn(),
            mockCreateInputBox: jest.fn(),
            mockLog: jest.fn(),
            mockDebug: jest.fn(),
            baseProfileManagerInstance: null,
            testSession: createISession(),
            mockError: jest.fn(),
            mockConfigurationTarget: jest.fn(),
            mockCreateBasicZosmfSessionFromArguments: jest.fn(),
            mockCliProfileManager: createProfileManager(),
        };

        // Mocking Default Profile Manager
        newMocks.baseProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
        newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
        Object.defineProperty(DefaultProfileManager,
                            "getInstance",
                            { value: jest.fn(() => newMocks.baseProfileManagerInstance), configurable: true });
        Object.defineProperty(newMocks.baseProfileManagerInstance,
                            "getbaseProfile",
                            { value: jest.fn(() => newMocks.baseProfile), configurable: true });

        Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
        Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
        Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
        Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
        Object.defineProperty(profileUtils, "collectProfileDetails", { value: newMocks.mockCollectProfileDetails, configurable: true });
        Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
        Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
        Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
        Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSessionFromArguments",
                              { value: newMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
        Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.mockGetConfiguration, configurable: true });
        Object.defineProperty(vscode, "ConfigurationTarget", { value: newMocks.mockConfigurationTarget, configurable: true });

        newMocks.mockCollectProfileDetails.mockReturnValue(newMocks.serviceProfile.profile);

        return newMocks;
    }

    it("Tests that getValidProfile tries to retrieve the baseProfile immediately, if it is not passed in", async () => {
        const blockMocks = await createBlockMocks();

        const getDefaultSpy = jest.spyOn(blockMocks.baseProfileManagerInstance, "getbaseProfile");
        await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest");

        expect(getDefaultSpy).toHaveBeenCalledTimes(1);
    });

    it("Tests that getValidProfile prompts for password if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.baseProfile.profile.password = null;
        blockMocks.baseProfile.profile.tokenValue = null;

        await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password"]);
    });

    it("Tests that getValidProfile prompts for host if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.host = null;
        blockMocks.baseProfile.profile.host = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.basePath = "test";

        await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["host"]);
    });

    it("Tests that getValidProfile prompts for port if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.port = null;
        blockMocks.baseProfile.profile.port = null;
        blockMocks.serviceProfile.profile.host = null;
        blockMocks.baseProfile.profile.host = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.basePath = "test";

        await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["host", "port"]);
    });

    it("Tests that getValidProfile successfully returns an array of new profile details", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.baseProfile.profile.password = null;
        blockMocks.baseProfile.profile.tokenValue = null;
        blockMocks.serviceProfile.profile.host = null;
        blockMocks.baseProfile.profile.host = null;
        blockMocks.serviceProfile.profile.port = null;
        blockMocks.baseProfile.profile.port = null;
        blockMocks.mockCollectProfileDetails.mockResolvedValue({
            host: "testHostNew",
            port: 1234,
            password: "testPassNew",
            basePath: "testBasePathNew"
        });

        await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password", "host", "port"]);
    });

    it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using service profile", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw testError; });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!", "Check Credentials");
    });

    it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using service profile, Theia route", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw testError; });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!");
    });

    it("Tests that getValidProfile throws an error if prompting fails for another reason (not 401 auth error), using service profile", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw new Error("Test error!"); });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(error.message).toBe("Test error!");
    });

    it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using base profile", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.serviceProfile.profile.user = null;
        blockMocks.baseProfile.profile.tokenValue = "testToken";
        Object.defineProperty(ConnectionPropsForSessCfg, "addPropsOrPrompt",
                                                         { value: jest.fn().mockImplementation(() => { throw testError; }), configurable: true });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!", "Check Credentials");
    });

    it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using base profile, Theia route", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.serviceProfile.profile.user = null;
        blockMocks.baseProfile.profile.tokenValue = "testToken";
        Object.defineProperty(ConnectionPropsForSessCfg, "addPropsOrPrompt",
                                                         { value: jest.fn().mockImplementation(() => { throw testError; }), configurable: true });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!");
    });

    it("Tests that getValidProfile throws an error if prompting fails for another reason (not 401 auth error), using base profile", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.user = null;
        blockMocks.baseProfile.profile.tokenValue = "testToken";
        Object.defineProperty(ConnectionPropsForSessCfg, "addPropsOrPrompt",
                                                         { value: jest.fn().mockImplementation(() => { throw new Error("test error!"); }),
                                                           configurable: true });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(error.message).toBe("Test error!");
    });

    it("Tests that getValidProfile removes the 'password' key from the service profile if password is null", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.baseProfile.profile.password = undefined;
        const baseProfileNoPassword = blockMocks.baseProfile;
        baseProfileNoPassword.profile.basePath = undefined;
        baseProfileNoPassword.profile.tokenType = "apimlAuthenticationToken";
        baseProfileNoPassword.profile.tokenValue = "testToken";
        baseProfileNoPassword.profile.$0 = "zowe";
        baseProfileNoPassword.profile._ = [""];
        delete baseProfileNoPassword.profile.name;
        delete baseProfileNoPassword.profile.type;

        await profileUtils.getValidSession(blockMocks.baseProfile, "sestest");

        expect(blockMocks.mockCreateBasicZosmfSessionFromArguments).toBeCalledWith(baseProfileNoPassword.profile);
    });

    it("Tests that getValidProfile successfully returns a connected Session when not using the baseProfile (non-token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await profileUtils.getValidSession(blockMocks.baseProfile, "sestest");

        expect(newSession).toBe(blockMocks.testSession);
    });

    it("Tests that getValidProfile throws an error if generating a Session fails when not using the baseProfile (non-token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockImplementationOnce(() => { throw new Error("Test error!"); });

        let error;
        try {
            await profileUtils.getValidSession(blockMocks.baseProfile, "sestest");
        } catch (err) {
            error = err.message;
        }

        expect(error).toBe("Test error!");
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = true (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await profileUtils.getValidSession(blockMocks.baseProfile, "sestest", true);

        expect(newSession).toBe(blockMocks.testSession);
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = false (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await profileUtils.getValidSession(blockMocks.baseProfile, "sestest", false);

        expect(newSession).toBe(blockMocks.testSession);
    });
});

describe("ZosmfApiCommon Unit Tests - Function getStatus", () => {
    async function createBlockMocks() {
        const newMocks = {
            baseProfile: createValidIProfile(),
            testSession: createISession(),
            commonApi: null,
            mockGetCommonApi: jest.fn()
        };

        // Common API mocks
        newMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(newMocks.baseProfile);
        ZoweExplorerApiRegister.getCommonApi = newMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);
        newMocks.mockGetCommonApi.mockReturnValue(newMocks.commonApi);
        Object.defineProperty(zowe.CheckStatus, "getZosmfInfo", { value: jest.fn().mockReturnValue(true), configurable: true });

        return newMocks;
    }
    it("Tests that getStatus returns Unverified if profileType is not zosmf", async () => {
        const blockMocks = await createBlockMocks();

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(null, "alternate");

        expect(newStatus).toEqual("unverified");
    });

    it("Tests that getStatus returns Active if a valid session can be retrieved", async () => {
        const blockMocks = await createBlockMocks();

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");

        expect(newStatus).toEqual("active");
    });

    it("Tests that getStatus returns Inactive if a valid session cannot be retrieved", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(profileUtils, "getValidSession").mockReturnValueOnce(null);

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");

        expect(newStatus).toEqual("inactive");
    });

    it("Tests that getStatus throws an error if getValidSession fails", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(profileUtils, "getValidSession").mockRejectedValueOnce(new Error("Test error"));

        let error;
        try {
            await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");
        } catch (err) {
            error = err;
        }

        expect(error.message).toEqual("Error: Test error");
    });
});
