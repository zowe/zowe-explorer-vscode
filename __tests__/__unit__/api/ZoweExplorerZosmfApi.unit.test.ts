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
import { AbstractSession, Logger, SessConstants } from "@zowe/imperative";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { Profiles } from "../../../src/Profiles";
import { createISession, createISessionWithoutCredentials, createValidBaseProfile, createValidIProfile, createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";
import { createProfileManager } from "../../../__mocks__/mockCreators/profiles";
import * as utils from "../../../src/utils";
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
            mockGetDefaultProfile: jest.fn(),
            mockCollectProfileDetails: jest.fn(),
            baseProfile: createValidBaseProfile(),
            serviceProfile: createValidIProfile(),
            mockShowInputBox: jest.fn(),
            mockGetConfiguration: jest.fn(),
            mockCreateQuickPick: jest.fn(),
            mockShowQuickPick: jest.fn(),
            mockShowInformationMessage: jest.fn(),
            mockGetInstance: jest.fn(),
            mockShowErrorMessage: jest.fn(),
            mockCreateInputBox: jest.fn(),
            mockLog: jest.fn(),
            mockDebug: jest.fn(),
            defaultProfileManagerInstance: null,
            defaultProfile: null,
            testSession: createISession(),
            mockError: jest.fn(),
            commonApi: null,
            mockGetCommonApi: jest.fn(),
            mockGetValidSession: jest.fn(),
            mockConfigurationTarget: jest.fn(),
            mockCreateBasicZosmfSessionFromArguments: jest.fn(),
            mockAddPropsOrPrompt: jest.fn(),
            addPropsOrPromptSpy: null,
            mockCliProfileManager: createProfileManager(),
        };

        // Mocking Default Profile Manager
        newMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
        newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
        newMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
        Object.defineProperty(DefaultProfileManager,
                            "getInstance",
                            { value: jest.fn(() => newMocks.defaultProfileManagerInstance), configurable: true });
        Object.defineProperty(newMocks.defaultProfileManagerInstance,
                            "getDefaultProfile",
                            { value: jest.fn(() => newMocks.defaultProfile), configurable: true });

        // Common API mocks
        newMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(newMocks.defaultProfile);
        newMocks.mockGetCommonApi.mockReturnValue(newMocks.commonApi);
        newMocks.mockGetValidSession.mockReturnValue(newMocks.testSession);
        ZoweExplorerApiRegister.getCommonApi = newMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);

        Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
        Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
        Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
        Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
        Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });
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

        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.sessionNoCredentials);
        newMocks.mockGetDefaultProfile.mockResolvedValue(newMocks.baseProfile);
        newMocks.mockCollectProfileDetails.mockReturnValue(newMocks.serviceProfile.profile);
        // Object.defineProperty(newMocks.commonApi, "collectProfileDetails", {value: newMocks.mockCollectProfileDetails, configurable: true});
        newMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);

        return newMocks;
    }

    it("Tests that getValidProfile tries to retrieve the baseProfile immediately, if it is not passed in", async () => {
        const blockMocks = await createBlockMocks();

        const getDefaultSpy = jest.spyOn(blockMocks.defaultProfileManagerInstance, "getDefaultProfile");
        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile).getValidSession(blockMocks.serviceProfile, "sestest");

        expect(getDefaultSpy).toHaveBeenCalledTimes(1);
    });

    it("Tests that getValidProfile prompts for password if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.defaultProfile.profile.password = null;
        blockMocks.defaultProfile.profile.tokenValue = null;

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                     .getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password"]);
    });

    it("Tests that getValidProfile prompts for host if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.host = null;
        blockMocks.defaultProfile.profile.host = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.defaultProfile.profile.basePath = "test";

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                     .getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["host"]);
    });

    it("Tests that getValidProfile prompts for port if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.port = null;
        blockMocks.defaultProfile.profile.port = null;
        blockMocks.serviceProfile.profile.host = null;
        blockMocks.defaultProfile.profile.host = null;
        blockMocks.serviceProfile.profile.basePath = "test";
        blockMocks.defaultProfile.profile.basePath = "test";

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                     .getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["host", "port"]);
    });

    it("Tests that getValidProfile prompts for basePath if prompting = true", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.basePath = null;
        blockMocks.defaultProfile.profile.basePath = null;
        blockMocks.serviceProfile.profile.host = null;
        blockMocks.defaultProfile.profile.host = null;

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                     .getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["host", "basePath"]);
    });

    it("Tests that getValidProfile successfully returns an array of new profile details", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.serviceProfile.profile.password = null;
        blockMocks.defaultProfile.profile.password = null;
        blockMocks.defaultProfile.profile.tokenValue = null;
        blockMocks.serviceProfile.profile.host = null;
        blockMocks.defaultProfile.profile.host = null;
        blockMocks.serviceProfile.profile.port = null;
        blockMocks.defaultProfile.profile.port = null;
        blockMocks.serviceProfile.profile.basePath = null;
        blockMocks.defaultProfile.profile.basePath = null;
        blockMocks.mockCollectProfileDetails.mockResolvedValue({
            host: "testHostNew",
            port: 1234,
            password: "testPassNew",
            basePath: "testBasePathNew"
        });

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                     .getValidSession(blockMocks.serviceProfile, "sestest", true);

        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledTimes(1);
        expect(blockMocks.mockCollectProfileDetails).toHaveBeenCalledWith(["password", "host", "port", "basePath"]);
    });

    it("Tests that getValidProfile throws an error if prompting fails", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCollectProfileDetails.mockImplementationOnce(() => { throw new Error("Test error!"); });

        let error;
        try {
            await ZoweExplorerApiRegister.getCommonApi(blockMocks.serviceProfile)
                                         .getValidSession(blockMocks.serviceProfile, "sestest", true);
        } catch (err) {
            error = err;
        }

        expect(error.message).toBe("Test error!");
    });

    it("Tests that getValidProfile removes the 'password' key from the service profile if password is null", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.defaultProfile.profile.password = undefined;
        const defaultProfileNoPassword = blockMocks.defaultProfile;
        defaultProfileNoPassword.profile.basePath = undefined;
        defaultProfileNoPassword.profile.tokenType = "apimlAuthenticationToken";
        defaultProfileNoPassword.profile.tokenValue = "testToken";
        defaultProfileNoPassword.profile.$0 = "zowe";
        defaultProfileNoPassword.profile._ = [""];
        delete defaultProfileNoPassword.profile.name;
        delete defaultProfileNoPassword.profile.type;

        await ZoweExplorerApiRegister.getCommonApi(blockMocks.defaultProfile)
                                     .getValidSession(blockMocks.defaultProfile, "sestest");

        expect(blockMocks.mockCreateBasicZosmfSessionFromArguments).toBeCalledWith(defaultProfileNoPassword.profile);
    });

    it("Tests that getValidProfile successfully returns a connected Session when not using the baseProfile (non-token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await ZoweExplorerApiRegister.getCommonApi(blockMocks.defaultProfile)
                                     .getValidSession(blockMocks.defaultProfile, "sestest");

        expect(newSession).toBe(blockMocks.testSession);
    });

    it("Tests that getValidProfile throws an error if generating a Session fails when not using the baseProfile (non-token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockImplementationOnce(() => { throw new Error("Test error!"); });

        let error;
        try {
            await ZoweExplorerApiRegister.getCommonApi(blockMocks.defaultProfile)
                  .getValidSession(blockMocks.defaultProfile, "sestest");
        } catch (err) {
            error = err.message;
        }

        expect(error.message).toBe("Test error!");
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = true (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await ZoweExplorerApiRegister.getCommonApi(blockMocks.defaultProfile)
                                                        .getValidSession(blockMocks.defaultProfile, "sestest", true);

        expect(newSession).toBe(blockMocks.testSession);
    });

    it("Tests that getValidProfile successfully returns a connected Session when prompting = false (token auth)", async () => {
        const blockMocks = await createBlockMocks();

        blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

        const newSession = await ZoweExplorerApiRegister.getCommonApi(blockMocks.defaultProfile)
                                                        .getValidSession(blockMocks.defaultProfile, "sestest", false);

        expect(newSession).toBe(blockMocks.testSession);
    });
});
