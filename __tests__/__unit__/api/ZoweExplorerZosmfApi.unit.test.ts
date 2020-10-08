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

import * as zowe from "@zowe/cli";
import { Logger, AbstractSession, ConnectionPropsForSessCfg } from "@zowe/imperative";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { createISession, createISessionWithoutCredentials,
         createValidBaseProfile, createValidIProfile } from "../../../__mocks__/mockCreators/shared";
import { ZosmfMvsApi, ZosmfUssApi } from "../../../src/api/ZoweExplorerZosmfApi";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as utils from "../../../src/utils";
import * as profileUtils from "../../../src/profiles/utils";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { Profiles } from "../../../src/Profiles";

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
        Object.defineProperty(newMocks.commonApi, "getValidSession", { value: jest.fn().mockReturnValue(newMocks.testSession), configurable: true });

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

    it("Tests that getStatus stores the valid connection details in the Active profile, after verification", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.testSession.ISession.user = "testAddConnDetails";
        blockMocks.baseProfile.profile.user = null;
        blockMocks.testSession.ISession.hostname = "testAddConnDetailsHostname";
        blockMocks.baseProfile.profile.host = null;

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");
        expect(blockMocks.baseProfile.profile.user).toEqual("testAddConnDetails");
        expect(blockMocks.baseProfile.profile.host).toEqual("testAddConnDetailsHostname");
    });

    it("Tests that getStatus returns Inactive if a valid session cannot be retrieved", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(blockMocks.commonApi, "getValidSession").mockReturnValueOnce(null);

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");

        expect(newStatus).toEqual("inactive");
    });

    it("Tests that getStatus throws an error if getValidSession fails", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(blockMocks.commonApi, "getValidSession").mockRejectedValueOnce(new Error("Test error"));

        let error;
        try {
            await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");
        } catch (err) {
            error = err;
        }

        expect(error.message).toEqual("Error: Test error");
    });
});

describe("ZosmfApiCommon Unit Tests - Function getValidSession", () => {
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
            commonApi: null,
            mockErrorHandling: jest.fn(),
            mockGetCommonApi: jest.fn(),
            mockConfigurationTarget: jest.fn(),
            mockCreateBasicZosmfSessionFromArguments: jest.fn(),
        };

        newMocks.mockCollectProfileDetails.mockResolvedValue(newMocks.serviceProfile.profile);

        // Mocking Default Profile Manager
        newMocks.baseProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
        newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
        Object.defineProperty(DefaultProfileManager, "getInstance",
                            { value: jest.fn(() => newMocks.baseProfileManagerInstance), configurable: true });
        Object.defineProperty(newMocks.baseProfileManagerInstance, "getDefaultProfile",
                            { value: jest.fn(() => newMocks.baseProfile), configurable: true });

        // Common API mocks
        newMocks.commonApi = ZoweExplorerApiRegister.getUssApi(newMocks.baseProfile);
        ZoweExplorerApiRegister.getCommonApi = newMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);
        newMocks.mockGetCommonApi.mockReturnValue(newMocks.commonApi);

        Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
        Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
        Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
        Object.defineProperty(utils, "errorHandling", { value: newMocks.mockErrorHandling, configurable: true });
        Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
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
        Object.defineProperty(profileUtils, "collectProfileDetails", { value: newMocks.mockCollectProfileDetails, configurable: true });

        return newMocks;
    }

    it("Tests that getValidProfile tries to retrieve the baseProfile immediately, if it is not passed in", async () => {
        const blockMocks = await createBlockMocks();

        const getBaseSpy = jest.spyOn(profileUtils, "getBaseProfile");
        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest");

        expect(getBaseSpy).toHaveBeenCalledTimes(1);
    });

    it("Tests that getValidProfile prompts for user if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.user = null;
        blockMocks.serviceProfile.profile.hostname = "test";
        blockMocks.baseProfile.profile.user = null;
        blockMocks.serviceProfile.profile.basePath = null;

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["user"], null, null, false);
    });

    it("Tests that getValidProfile prompts for password if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.baseProfile.profile.password = null;
        blockMocks.baseProfile.profile.tokenValue = null;

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password"], null, null, false);
    });

    it("Tests that getValidProfile prompts for host if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.hostname = null;
        blockMocks.baseProfile.profile.hostname = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.basePath = "test";

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["hostname"], null, null, false);
    });

    it("Tests that getValidProfile prompts for port if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.port = null;
        blockMocks.baseProfile.profile.port = null;
        blockMocks.serviceProfile.profile.hostname = null;
        blockMocks.baseProfile.profile.hostname = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.basePath = "test";

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["hostname", "port"], null, null, false);
    });

    it("Tests that getValidProfile successfully returns an array of new profile details", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.baseProfile.profile.password = null;
        blockMocks.baseProfile.profile.tokenValue = null;
        blockMocks.serviceProfile.profile.hostname = null;
        blockMocks.baseProfile.profile.hostname = null;
        blockMocks.serviceProfile.profile.port = null;
        blockMocks.baseProfile.profile.port = null;
        blockMocks.mockCollectProfileDetails.mockResolvedValue({
            hostname: "testhostNew",
            port: 1234,
            password: "testPassNew",
            basePath: "testBasePathNew"
        });

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password", "hostname", "port"], null, null, false);
    });

    it("Tests that getValidProfile throws an error if prompting fails, using service profile", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw testError; });

        let error;
        try {
            await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockErrorHandling).toBeCalledWith(testError);
    });

    // tslint:disable-next-line:max-line-length
    it("Tests that getValidProfile throws an error if prompting fails, using service profile, Theia route", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw testError; });

        let error;
        try {
            await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(blockMocks.mockErrorHandling).toBeCalledWith(testError);
    });

    it("Tests that getValidProfile throws an error if prompting fails, using base profile", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.serviceProfile.profile.user = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.tokenValue = "testToken";
        Object.defineProperty(profileUtils, "getBaseProfile", { value: jest.fn().mockReturnValue(blockMocks.baseProfile), configurable: true });
        jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockRejectedValueOnce(testError);

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockErrorHandling).toBeCalledWith(testError);
    });

    it("Tests that getValidProfile throws an error if prompting fails, using base profile, Theia route", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

        const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
        blockMocks.serviceProfile.profile.user = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.baseProfile.profile.tokenValue = "testToken";
        Object.defineProperty(profileUtils, "getBaseProfile", { value: jest.fn().mockReturnValue(blockMocks.baseProfile), configurable: true });
        jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockRejectedValueOnce(testError);

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockErrorHandling).toBeCalledWith(testError);
    });

    it("Tests that getValidProfile removes the 'password' key from the service profile if password is null", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = undefined;
        blockMocks.serviceProfile.profile.host = blockMocks.serviceProfile.profile.hostname;
        delete blockMocks.serviceProfile.profile.hostname;
        delete blockMocks.serviceProfile.profile.base64EncodedAuth;
        const serviceProfileNoPassword = blockMocks.serviceProfile;
        serviceProfileNoPassword.profile.basePath = undefined;
        serviceProfileNoPassword.profile.tokenType = "apimlAuthenticationToken";
        serviceProfileNoPassword.profile.tokenValue = "testToken";
        serviceProfileNoPassword.profile.$0 = "zowe";
        serviceProfileNoPassword.profile._ = [""];
        delete serviceProfileNoPassword.profile.name;
        delete serviceProfileNoPassword.profile.type;

        await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest");

        expect(blockMocks.mockCreateBasicZosmfSessionFromArguments).toBeCalledWith(serviceProfileNoPassword.profile);
    });

    it("Tests that getValidProfile successfully returns a connected Session when not using the baseProfile (non-token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest");

        expect(newSession).toEqual(blockMocks.testSession);
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = true (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        delete blockMocks.serviceProfile.profile.user;
        blockMocks.serviceProfile.profile.basePath = "test";
        jest.spyOn(profileUtils, "getBaseProfile").mockReturnValueOnce(blockMocks.baseProfile);
        jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockResolvedValueOnce(blockMocks.testSession.ISession);

        const newSession = await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(newSession).toEqual(blockMocks.testSession);
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = false (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        delete blockMocks.serviceProfile.profile.user;
        blockMocks.serviceProfile.profile.basePath = "test";
        jest.spyOn(profileUtils, "getBaseProfile").mockReturnValueOnce(blockMocks.baseProfile);
        jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockResolvedValueOnce(blockMocks.testSession.ISession);

        const newSession = await blockMocks.commonApi.getValidSession(blockMocks.serviceProfile, "sestest", false);

        expect(newSession).toEqual(blockMocks.testSession);
    });
});
