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
import { Gui } from "../../../src/globals/Gui";
import { MessageSeverity, IZoweLogger } from "../../../src/logger/IZoweLogger";
import { IProfileLoaded, Session } from "@zowe/imperative";
import { IPromptCredentialsOptions, ZoweVsCodeExtension } from "../../../src/vscode";
import { ProfilesCache, ZoweExplorerApi } from "../../../src";
import { Login, Logout, imperative } from "@zowe/cli";

describe("ZoweVsCodeExtension", () => {
    const fakeVsce = {
        exports: "zowe",
        packageJSON: { version: "1.0.1" },
    } as vscode.Extension<unknown>;

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("customLoggingPath should return value if defined in VS Code settings", () => {
        const mockGetConfig = jest.fn().mockReturnValueOnce(__dirname);
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            get: mockGetConfig,
        } as unknown as vscode.WorkspaceConfiguration);
        expect(ZoweVsCodeExtension.customLoggingPath).toBe(__dirname);
        expect(ZoweVsCodeExtension.customLoggingPath).toBeUndefined();
        expect(mockGetConfig).toHaveBeenCalledTimes(2);
    });

    describe("getZoweExplorerApi", () => {
        it("should return client API", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version matches", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version is invalid", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("test");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if extension version is unknown", () => {
            const vsceWithoutVersion = {
                exports: fakeVsce.exports,
                packageJSON: {},
            } as vscode.Extension<unknown>;
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutVersion);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should not return API if extension is not installed", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(undefined);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBeUndefined();
        });

        it("should not return API if there are no exports", () => {
            const vsceWithoutExports = { packageJSON: fakeVsce.packageJSON as object } as vscode.Extension<unknown>;
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutExports);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBeUndefined();
        });

        it("should not return API if required version does not match", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.2");
            expect(zeApi).toBeUndefined();
        });
    });

    describe("deprecated methods", () => {
        it("showVsCodeMessage should pass on params to Gui module", () => {
            const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
            ZoweVsCodeExtension.showVsCodeMessage("test", MessageSeverity.INFO, undefined as unknown as IZoweLogger);
            expect(showMessageSpy).toHaveBeenCalledWith("test", {
                severity: MessageSeverity.INFO,
                logger: undefined,
            });
        });

        it("inputBox should pass on params to Gui module", async () => {
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockImplementation();
            const inputBoxOptions: vscode.InputBoxOptions = {
                title: "fakeTitle",
                value: "fakeValue",
            };
            await ZoweVsCodeExtension.inputBox(inputBoxOptions);
            expect(showInputBoxSpy).toHaveBeenCalledWith(inputBoxOptions);
        });

        describe("promptCredentials", () => {
            const promptCredsOptions: IPromptCredentialsOptions = {
                sessionName: "test",
            };

            it("should update user and password", async () => {
                const mockUpdateProperty = jest.fn();
                jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                    getLoadedProfConfig: jest.fn().mockReturnValue({
                        profile: {},
                    }),
                    getProfileInfo: jest.fn().mockReturnValue({
                        updateProperty: mockUpdateProperty,
                    }),
                });
                const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
                const profileLoaded: IProfileLoaded = await ZoweVsCodeExtension.promptCredentials(promptCredsOptions);
                expect(profileLoaded.profile?.user).toBe("fakeUser");
                expect(profileLoaded.profile?.password).toBe("fakePassword");
                expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
                expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
            });

            it("should do nothing if profile does not exist", async () => {
                jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                    getLoadedProfConfig: jest.fn().mockReturnValue(undefined),
                    getProfileInfo: jest.fn(),
                });
                const showInputBoxSpy = jest.spyOn(Gui, "showInputBox");
                const profileLoaded: any = await ZoweVsCodeExtension.promptCredentials(promptCredsOptions);
                expect(profileLoaded).toBeUndefined();
                expect(showInputBoxSpy).not.toHaveBeenCalled();
            });

            it("should do nothing if user input is cancelled", async () => {
                const mockUpdateProperty = jest.fn();
                jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                    getLoadedProfConfig: jest.fn().mockReturnValue({
                        profile: {},
                    }),
                    getProfileInfo: jest.fn().mockReturnValue({
                        updateProperty: mockUpdateProperty,
                    }),
                });
                const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce(undefined);
                const profileLoaded: any = await ZoweVsCodeExtension.promptCredentials(promptCredsOptions);
                expect(profileLoaded).toBeUndefined();
                expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
                expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
            });

            it("should do nothing if password input is cancelled", async () => {
                const mockUpdateProperty = jest.fn();
                jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                    getLoadedProfConfig: jest.fn().mockReturnValue({
                        profile: {},
                    }),
                    getProfileInfo: jest.fn().mockReturnValue({
                        updateProperty: mockUpdateProperty,
                    }),
                });
                const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
                const profileLoaded: any = await ZoweVsCodeExtension.promptCredentials(promptCredsOptions);
                expect(profileLoaded).toBeUndefined();
                expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
                expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe("login and logout with base profiles", () => {
        const testProfile = {
            host: "dummy",
            port: 1234,
        };
        const baseProfile = { name: "base", type: "base", profile: testProfile };
        const serviceProfile: any = { name: "service", type: "service", profile: testProfile };
        const allProfiles = [serviceProfile, baseProfile];
        const testNode: any = {
            setProfileToChoice: jest.fn(),
            getProfile: jest.fn().mockReturnValue(serviceProfile),
        };
        const expectedSession = new Session({
            hostname: "dummy",
            password: "Password",
            port: 1234,
            tokenType: "apimlAuthenticationToken",
            type: "token",
            user: "Username",
        });
        const updProfile = { tokenType: "apimlAuthenticationToken", tokenValue: "tokenValue" };
        const testRegister: any = {
            getCommonApi: () => ({
                login: jest.fn().mockReturnValue("tokenValue"),
                logout: jest.fn(),
                getTokenTypeName: () => "apimlAuthenticationToken",
            }),
        };
        const testCache: any = {
            allProfiles,
            allExternalTypes: [],
            fetchBaseProfile: jest.fn(),
            loadNamedProfile: jest.fn().mockReturnValue({ profile: testProfile }),
            updateBaseProfileFileLogin: jest.fn(),
            updateBaseProfileFileLogout: jest.fn(),
            getLoadedProfConfig: jest.fn().mockReturnValue({ profile: {} }),
            getProfileInfo: jest.fn().mockReturnValue({
                isSecured: jest.fn().mockReturnValue(false),
                getAllProfiles: jest.fn().mockReturnValue(allProfiles),
                mergeArgsForProfile: jest.fn().mockReturnValue({ knownArgs: [] }),
            }),
            refresh: jest.fn(),
        };

        beforeEach(() => {
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(testCache);
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
        });

        it("should not login if the base profile cannot be fetched", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(null);
            await ZoweVsCodeExtension.loginWithBaseProfile("service");
            expect(testCache.fetchBaseProfile).toHaveBeenCalledTimes(1);
            expect(testCache.updateBaseProfileFileLogin).not.toHaveBeenCalled();
        });
        it("should not logout if the base profile cannot be fetched", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(null);
            await ZoweVsCodeExtension.logoutWithBaseProfile("service");
            expect(testCache.fetchBaseProfile).toHaveBeenCalledTimes(1);
            expect(testCache.updateBaseProfileFileLogin).not.toHaveBeenCalled();
        });
        it("should login using the base profile given a simple profile name", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(baseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

            await ZoweVsCodeExtension.loginWithBaseProfile("service");

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            delete testSession.ISession.user;
            delete testSession.ISession.password;
            testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";

            expect(loginSpy).toHaveBeenCalledWith(testSession);
            expect(testSpy).toHaveBeenCalledWith(testCache, "service");
            expect(testCache.updateBaseProfileFileLogin).toHaveBeenCalledWith(baseProfile, updProfile, false);
        });
        it("should logout using the base profile given a simple profile name", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(baseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            testSpy.mockResolvedValue({ profile: { ...testProfile, ...updProfile } });
            const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());

            await ZoweVsCodeExtension.logoutWithBaseProfile("service");

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            testSession.ISession.tokenValue = "tokenValue";
            delete testSession.ISession.base64EncodedAuth;
            delete testSession.ISession.user;
            delete testSession.ISession.password;

            expect(logoutSpy).toHaveBeenCalledWith(testSession);
            expect(testSpy).toHaveBeenCalledWith(testCache, "service");
            expect(testCache.updateBaseProfileFileLogout).toHaveBeenCalledWith(baseProfile);
        });
        it("should login using the base profile if the base profile does not have a tokenType stored", async () => {
            const tempBaseProfile = JSON.parse(JSON.stringify(baseProfile));
            tempBaseProfile.profile.tokenType = undefined;
            testCache.fetchBaseProfile.mockResolvedValue(tempBaseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            const newServiceProfile = { ...serviceProfile, profile: { ...testProfile, tokenValue: "tokenValue", host: "service" } };
            testSpy.mockResolvedValue(newServiceProfile);
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

            await ZoweVsCodeExtension.loginWithBaseProfile("service");

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            delete testSession.ISession.user;
            delete testSession.ISession.password;
            testSession.ISession.hostname = "service";
            testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";

            expect(loginSpy).toHaveBeenCalledWith(testSession);
            expect(testSpy).toHaveBeenCalledWith(testCache, "service");
            expect(testCache.updateBaseProfileFileLogin).toHaveBeenCalledWith(tempBaseProfile, updProfile, false);
        });
        it("should login using the service profile given a simple profile name", async () => {
            const tempBaseProfile = JSON.parse(JSON.stringify(baseProfile));
            tempBaseProfile.profile.tokenType = "some-dummy-token-type";
            testCache.fetchBaseProfile.mockResolvedValue(tempBaseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            const newServiceProfile = { ...serviceProfile, profile: { ...testProfile, tokenValue: "tokenValue", host: "service" } };
            testSpy.mockResolvedValue(newServiceProfile);
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

            await ZoweVsCodeExtension.loginWithBaseProfile("service");

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            delete testSession.ISession.user;
            delete testSession.ISession.password;
            testSession.ISession.hostname = "service";
            testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";

            expect(loginSpy).toHaveBeenCalledWith(testSession);
            expect(testSpy).toHaveBeenCalledWith(testCache, "service");
            expect(testCache.updateBaseProfileFileLogin).toHaveBeenCalledWith(newServiceProfile, updProfile, true);
        });
        it("should logout using the service profile given a simple profile name", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(baseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            const newServiceProfile = { ...serviceProfile, profile: { ...testProfile, ...updProfile, host: "service" } };
            testSpy.mockResolvedValue(newServiceProfile);
            const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());

            await ZoweVsCodeExtension.logoutWithBaseProfile("service");

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            testSession.ISession.hostname = "service";
            testSession.ISession.tokenValue = "tokenValue";
            delete testSession.ISession.base64EncodedAuth;
            delete testSession.ISession.user;
            delete testSession.ISession.password;

            expect(logoutSpy).toHaveBeenCalledWith(testSession);
            expect(testSpy).toHaveBeenCalledWith(testCache, "service");
            expect(testCache.updateBaseProfileFileLogout).toHaveBeenCalledWith(newServiceProfile);
        });
        it("should login using the base profile when provided with a node, register, and cache instance", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(baseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

            await ZoweVsCodeExtension.loginWithBaseProfile(serviceProfile, "apimlAuthenticationToken", testNode, testRegister, testCache);

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";

            expect(loginSpy).not.toHaveBeenCalled();
            expect(testSpy).not.toHaveBeenCalled();
            expect(testCache.updateBaseProfileFileLogin).toHaveBeenCalledWith(baseProfile, updProfile, false);
            expect(testNode.setProfileToChoice).toHaveBeenCalled();
        });
        it("should logout using the base profile when provided with a node, register, and cache instance", async () => {
            testCache.fetchBaseProfile.mockResolvedValue(baseProfile);
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());
            const newServiceProfile = { ...serviceProfile, profile: { ...testProfile, ...updProfile } };

            await ZoweVsCodeExtension.logoutWithBaseProfile(newServiceProfile, testRegister, testCache);

            const testSession = new Session(JSON.parse(JSON.stringify(expectedSession.ISession)));
            testSession.ISession.tokenValue = "tokenValue";
            delete testSession.ISession.base64EncodedAuth;
            delete testSession.ISession.user;
            delete testSession.ISession.password;

            expect(logoutSpy).not.toHaveBeenCalled();
            expect(testSpy).not.toHaveBeenCalled();
            expect(testCache.updateBaseProfileFileLogout).toHaveBeenCalledWith(baseProfile);
        });
    });
    describe("updateCredentials", () => {
        const promptCredsOptions: IPromptCredentialsOptions = {
            sessionName: "test",
        };

        it("should update user and password as secure fields", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(0);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should update user and password as secure fields with reprompt", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: { user: "badUser", password: "badPassword" },
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                {
                    ...promptCredsOptions,
                    rePrompt: true,
                },
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(0);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should update user and password as plain text if prompt accepted", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(false),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("yes");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should not update user and password as plain text if prompt cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(false),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce(undefined);
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if user input is cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if password input is cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as ZoweExplorerApi.IApiRegisterClient
            );
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if profile and sessionName args are not provided", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials({}, undefined as unknown as ZoweExplorerApi.IApiRegisterClient);
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).not.toHaveBeenCalled();
            expect(mockUpdateProperty).not.toHaveBeenCalled();
        });

        it("should not call ProfilesCache.getLoadedProfConfig if profile object is provided", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {
                        name: "someExampleProfile",
                        profile: {
                            user: "testUser",
                            password: "testPassword",
                        } as imperative.IProfile,
                    } as imperative.IProfileLoaded,
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const getLoadedProfConfigSpy = jest.spyOn(ProfilesCache.prototype, "getLoadedProfConfig");
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials({}, undefined as unknown as ZoweExplorerApi.IApiRegisterClient);
            expect(profileLoaded).toBeUndefined();
            expect(getLoadedProfConfigSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).not.toHaveBeenCalled();
        });
    });
});
