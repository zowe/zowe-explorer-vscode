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

// // import { Profiles } from "../../../src/Profiles";
// import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
// import { createProfileManager } from "../../../__mocks__/mockCreators/profiles";
// import { createISession, createISessionWithoutCredentials,
//          createValidBaseProfile, createValidIProfile } from "../../../__mocks__/mockCreators/shared";
// import { Logger, ConnectionPropsForSessCfg } from "@zowe/imperative";
// import * as globals from "../../../src/globals";
// import * as vscode from "vscode";
// import * as zowe from "@zowe/cli";
// import * as profileUtils from "../../../src/profiles/utils";

// jest.mock("@zowe/imperative");

// describe("Profiles Utils Unit Tests - Function validateHostInput", () => {
//     it("Tests that validateHostInput succeeds with a host and port", async () => {
//         const inputString = "https://www.test.com:123";

//         const returnValue = await profileUtils.validateHostInput(inputString, "");

//         expect(returnValue).toEqual(null);
//     });

//     it("Tests that validateHostInput succeeds with optional host and port", async () => {
//         const inputString = "https://";

//         const returnValue = await profileUtils.validateHostInput(inputString, "");

//         expect(returnValue).toEqual(null);
//     });

//     it("Tests that validateHostInput returns an error message if the inputString is undefined", async () => {
//         const inputString = undefined;

//         const returnValue = await profileUtils.validateHostInput(inputString, "");

//         expect(returnValue).toEqual("Please enter a valid host URL in the format 'url:port'.");
//     });
// });

// describe("ZosmfApiCommon Unit Tests - Function getValidProfile", () => {
//     async function createBlockMocks() {
//         const newMocks = {
//             profiles: null,
//             sessionNoCredentials: createISessionWithoutCredentials(),
//             profileInstance: null,
//             mockGetbaseProfile: jest.fn(),
//             mockCollectProfileDetails: jest.fn(),
//             baseProfile: createValidBaseProfile(),
//             serviceProfile: createValidIProfile(),
//             mockShowInputBox: jest.fn(),
//             mockGetConfiguration: jest.fn(),
//             mockCreateQuickPick: jest.fn(),
//             mockShowQuickPick: jest.fn(),
//             mockShowInformationMessage: jest.fn(),
//             mockShowErrorMessage: jest.fn(),
//             mockCreateInputBox: jest.fn(),
//             mockLog: jest.fn(),
//             mockDebug: jest.fn(),
//             baseProfileManagerInstance: null,
//             testSession: createISession(),
//             mockError: jest.fn(),
//             mockConfigurationTarget: jest.fn(),
//             mockCreateBasicZosmfSessionFromArguments: jest.fn(),
//             mockCliProfileManager: createProfileManager(),
//             collectProfileDetailsSpy: jest.spyOn(profileUtils, "collectProfileDetails")
//         };

//         // Mocking Default Profile Manager
//         newMocks.baseProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
//         newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
//         Object.defineProperty(DefaultProfileManager, "getInstance",
//                             { value: jest.fn(() => newMocks.baseProfileManagerInstance), configurable: true });
//         Object.defineProperty(newMocks.baseProfileManagerInstance, "getDefaultProfile",
//                             { value: jest.fn(() => newMocks.baseProfile), configurable: true });

//         Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
//         Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
//         Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
//         Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
//         Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
//         Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
//         Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
//         Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
//         Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSessionFromArguments",
//                               { value: newMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
//         Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
//         Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
//         Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
//         Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.mockGetConfiguration, configurable: true });
//         Object.defineProperty(vscode, "ConfigurationTarget", { value: newMocks.mockConfigurationTarget, configurable: true });

//         newMocks.collectProfileDetailsSpy.mockReset();
//         newMocks.collectProfileDetailsSpy.mockResolvedValue(newMocks.serviceProfile.profile);

//         return newMocks;
//     }

//     it("Tests that getValidProfile tries to retrieve the baseProfile immediately, if it is not passed in", async () => {
//         const blockMocks = await createBlockMocks();

//         const getDefaultSpy = jest.spyOn(blockMocks.baseProfileManagerInstance, "getDefaultProfile");
//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest");

//         expect(getDefaultSpy).toHaveBeenCalledTimes(1);
//     });

//     it("Tests that getValidProfile prompts for user if prompting = true", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.user = null;
//         blockMocks.serviceProfile.profile.host = "test";
//         blockMocks.baseProfile.profile.user = null;
//         blockMocks.serviceProfile.profile.basePath = null;

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledTimes(1);
//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledWith(["user"], null, null);
//     });

//     it("Tests that getValidProfile prompts for password if prompting = true", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.host = blockMocks.serviceProfile.profile.hostname;
//         delete blockMocks.serviceProfile.profile.hostname;
//         blockMocks.serviceProfile.profile.password = null;
//         blockMocks.baseProfile.profile.password = null;
//         blockMocks.baseProfile.profile.tokenValue = null;

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledTimes(1);
//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledWith(["password"], null, null);
//     });

//     it("Tests that getValidProfile prompts for host if prompting = true", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.host = null;
//         blockMocks.baseProfile.profile.host = null;
//         blockMocks.serviceProfile.profile.basePath = "test";
//         blockMocks.baseProfile.profile.basePath = "test";

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledTimes(1);
//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledWith(["hostname"], null, null);
//     });

//     it("Tests that getValidProfile prompts for port if prompting = true", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.port = null;
//         blockMocks.baseProfile.profile.port = null;
//         blockMocks.serviceProfile.profile.host = null;
//         blockMocks.baseProfile.profile.host = null;
//         blockMocks.serviceProfile.profile.basePath = "test";
//         blockMocks.baseProfile.profile.basePath = "test";

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledTimes(1);
//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledWith(["hostname", "port"], null, null);
//     });

//     it("Tests that getValidProfile successfully returns an array of new profile details", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.password = null;
//         blockMocks.baseProfile.profile.password = null;
//         blockMocks.baseProfile.profile.tokenValue = null;
//         blockMocks.serviceProfile.profile.host = null;
//         blockMocks.baseProfile.profile.host = null;
//         blockMocks.serviceProfile.profile.port = null;
//         blockMocks.baseProfile.profile.port = null;
//         blockMocks.collectProfileDetailsSpy.mockResolvedValue({
//             host: "testhostNew",
//             port: 1234,
//             password: "testPassNew",
//             basePath: "testBasePathNew"
//         });

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledTimes(1);
//         expect(blockMocks.collectProfileDetailsSpy).toHaveBeenCalledWith(["password", "hostname", "port"], null, null);
//     });

//     it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using service profile", async () => {
//         const blockMocks = await createBlockMocks();
//         Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

//         const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
//         blockMocks.collectProfileDetailsSpy.mockImplementationOnce(() => { throw testError; });

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!", "Check Credentials");
//     });

// tslint:disable-next-line:max-line-length
//     it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using service profile, Theia route", async () => {
//         const blockMocks = await createBlockMocks();
//         Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

//         const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
//         blockMocks.collectProfileDetailsSpy.mockImplementationOnce(() => { throw testError; });

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!");
//     });

// tslint:disable-next-line:max-line-length
//     it("Tests that getValidProfile throws an error if prompting fails for another reason (not 401 auth error), using service profile", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.collectProfileDetailsSpy.mockImplementationOnce(() => { throw new Error("Test error!"); });

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(error.message).toBe("Test error!");
//     });

//     it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using base profile", async () => {
//         const blockMocks = await createBlockMocks();
//         Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });

//         const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
//         blockMocks.serviceProfile.profile.user = null;
//         blockMocks.serviceProfile.profile.basePath = "test";
//         blockMocks.baseProfile.profile.tokenValue = "testToken";
//         jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockRejectedValueOnce(testError);

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!", "Check Credentials");
//     });

//     it("Tests that getValidProfile throws an error if prompting fails due to 401 bad authorization, using base profile, Theia route", async () => {
//         const blockMocks = await createBlockMocks();
//         Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });

//         const testError = { message: "Test error!", mDetails: { errorCode: 401 } };
//         blockMocks.serviceProfile.profile.user = null;
//         blockMocks.serviceProfile.profile.basePath = "test";
//         blockMocks.baseProfile.profile.tokenValue = "testToken";
//         jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockRejectedValueOnce(testError);

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(blockMocks.mockShowErrorMessage).toBeCalledWith("Test error!");
//     });

//     it("Tests that getValidProfile throws an error if prompting fails for another reason (not 401 auth error), using base profile", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.user = null;
//         blockMocks.serviceProfile.profile.basePath = "test";
//         blockMocks.baseProfile.profile.tokenValue = "testToken";
//         jest.spyOn(ConnectionPropsForSessCfg, "addPropsOrPrompt").mockRejectedValueOnce(new Error("Test error!"));

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);
//         } catch (err) {
//             error = err;
//         }

//         expect(error.message).toBe("Test error!");
//     });

//     it("Tests that getValidProfile removes the 'password' key from the service profile if password is null", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.serviceProfile.profile.password = undefined;
//         blockMocks.serviceProfile.profile.host = blockMocks.serviceProfile.profile.hostname;
//         delete blockMocks.serviceProfile.profile.hostname;
//         delete blockMocks.serviceProfile.profile.base64EncodedAuth;
//         const serviceProfileNoPassword = blockMocks.serviceProfile;
//         serviceProfileNoPassword.profile.basePath = undefined;
//         serviceProfileNoPassword.profile.tokenType = "apimlAuthenticationToken";
//         serviceProfileNoPassword.profile.tokenValue = "testToken";
//         serviceProfileNoPassword.profile.$0 = "zowe";
//         serviceProfileNoPassword.profile._ = [""];
//         delete serviceProfileNoPassword.profile.name;
//         delete serviceProfileNoPassword.profile.type;

//         await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest");

//         expect(blockMocks.mockCreateBasicZosmfSessionFromArguments).toBeCalledWith(serviceProfileNoPassword.profile);
//     });

//     it("Tests that getValidProfile successfully returns a connected Session when not using the baseProfile (non-token auth)", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

//         const newSession = await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest");

//         expect(newSession).toBe(blockMocks.testSession);
//     });

//     it("Tests that getValidProfile throws an error if generating a Session fails when not using the baseProfile (non-token auth)", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.mockCreateBasicZosmfSessionFromArguments.mockImplementationOnce(() => { throw new Error("Test error!"); });

//         let error;
//         try {
//             await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest");
//         } catch (err) {
//             error = err.message;
//         }

//         expect(error).toBe("Test error!");
//     });

//     it("Tests that getValidProfile successfully returns a connected Session when prompting = true (token auth)", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

//         const newSession = await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", true);

//         expect(newSession).toBe(blockMocks.testSession);
//     });

//     it("Tests that getValidProfile successfully returns a connected Session when prompting = false (token auth)", async () => {
//         const blockMocks = await createBlockMocks();

//         blockMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(blockMocks.testSession);

//         const newSession = await profileUtils.getValidSession(blockMocks.serviceProfile, "sestest", false);

//         expect(newSession).toBe(blockMocks.testSession);
//     });
// });
