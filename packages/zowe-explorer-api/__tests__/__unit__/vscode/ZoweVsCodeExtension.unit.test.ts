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
import { PromptCredentialsOptions, ZoweVsCodeExtension, ProfilesCache, Types } from "../../../src";
import { Login, Logout } from "@zowe/core-for-zowe-sdk";
import * as imperative from "@zowe/imperative";

describe("ZoweVsCodeExtension", () => {
    const fakeLogger = { debug: jest.fn() };
    const fakeVsce = {
        exports: undefined,
        packageJSON: { version: "1.0.1" },
    } as vscode.Extension<unknown>;

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("customLoggingPath should return value if defined in VS Code settings", () => {
        const mockGetConfig = jest.fn().mockReturnValueOnce(__dirname);
        const vscodeMock = {
            get: mockGetConfig,
        } as unknown as vscode.WorkspaceConfiguration;
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce(vscodeMock);
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValueOnce(vscodeMock);
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

    describe("login and logout with base profiles", () => {
        let blockMocks: ReturnType<typeof createBlockMocks>;

        function createBlockMocks() {
            const testProfile: imperative.IProfile = {
                host: "dummy",
                port: 1234,
            };
            const baseProfile: imperative.IProfileLoaded = {
                failNotFound: false,
                message: "",
                name: "base",
                type: "base",
                profile: { ...testProfile },
            };
            const serviceProfile: imperative.IProfileLoaded = {
                failNotFound: false,
                message: "",
                name: "service",
                type: "service",
                profile: { ...testProfile },
            };
            const testCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            const testProfInfo = new imperative.ProfileInfo("zowe");
            const configLayer: imperative.IConfigLayer = {
                exists: true,
                path: "zowe.config.json",
                properties: {
                    ...imperative.Config.empty(),
                    profiles: {
                        service: {
                            type: "service",
                            properties: testProfile,
                        },
                        base: {
                            type: "base",
                            properties: testProfile,
                        },
                    },
                },
                global: false,
                user: true,
            };
            const testConfig = new (imperative.Config as any)();
            Object.assign(testConfig, {
                ...new (imperative.Config as any)(),
                layerActive: jest.fn().mockReturnValue(configLayer),
                layerMerge: jest.fn().mockReturnValue(configLayer.properties),
                mLayers: [configLayer],
            });
            Object.assign(testProfInfo, {
                getTeamConfig: jest.fn().mockReturnValue(testConfig),
                loadSchema: jest.fn().mockReturnValue({}),
                mLoadedConfig: testConfig,
                mProfileSchemaCache: new Map(),
                readProfilesFromDisk: jest.fn(),
            });
            testCache.allProfiles = [serviceProfile, baseProfile];
            jest.spyOn(testCache, "getProfileInfo").mockResolvedValue(testProfInfo);

            return {
                testProfile,
                baseProfile,
                serviceProfile,
                testNode: {
                    setProfileToChoice: jest.fn(),
                    getProfile: jest.fn().mockReturnValue(serviceProfile),
                },
                expectedSession: new imperative.Session({
                    hostname: "dummy",
                    password: "Password",
                    port: 1234,
                    tokenType: "apimlAuthenticationToken",
                    type: "token",
                    user: "Username",
                }),
                updProfile: { tokenType: "apimlAuthenticationToken", tokenValue: "tokenValue" },
                testRegister: {
                    getCommonApi: () => ({
                        login: jest.fn().mockReturnValue("tokenValue"),
                        logout: jest.fn(),
                        getTokenTypeName: () => "apimlAuthenticationToken",
                    }),
                },
                configLayer,
                testCache,
            };
        }

        beforeEach(() => {
            blockMocks = createBlockMocks();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(blockMocks.testCache);
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
        });

        it("should not login if the base profile cannot be fetched", async () => {
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage");
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(undefined);
            const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
            await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" });
            expect(fetchBaseProfileSpy).toHaveBeenCalledTimes(1);
            expect(updateBaseProfileFileLoginSpy).not.toHaveBeenCalled();
            expect(errorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Login failed: No base profile found"));
        });
        it("should not logout if the base profile cannot be fetched", async () => {
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage");
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(undefined);
            const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
            await ZoweVsCodeExtension.ssoLogout({ serviceProfile: "service" });
            expect(fetchBaseProfileSpy).toHaveBeenCalledTimes(1);
            expect(updateBaseProfileFileLoginSpy).not.toHaveBeenCalled();
            expect(errorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Logout failed: No base profile found"));
        });

        describe("user and password chosen", () => {
            it("should login using the base profile given a simple profile name", async () => {
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
                const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
                const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                delete testSession.ISession.user;
                delete testSession.ISession.password;
                testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";
                testSession.ISession.storeCookie = false;

                expect(loginSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
                expect(quickPickMock).toHaveBeenCalled();
                expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(blockMocks.baseProfile, blockMocks.updProfile, false);
            });
            it("should logout using the base profile given a simple profile name", async () => {
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
                const updateBaseProfileFileLogoutSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogout");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                testSpy.mockResolvedValue({ ...blockMocks.serviceProfile, profile: { ...blockMocks.testProfile, ...blockMocks.updProfile } });
                const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogout({ serviceProfile: "service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                testSession.ISession.tokenValue = "tokenValue";
                delete testSession.ISession.base64EncodedAuth;
                delete testSession.ISession.user;
                delete testSession.ISession.password;

                expect(logoutSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
                expect(updateBaseProfileFileLogoutSpy).toHaveBeenCalledWith(blockMocks.baseProfile);
                quickPickMock.mockRestore();
            });
            it("should login using the base profile if the base profile does not have a tokenType stored", async () => {
                const tempBaseProfile = JSON.parse(JSON.stringify(blockMocks.baseProfile));
                tempBaseProfile.profile.tokenType = undefined;
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(tempBaseProfile);
                const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                const newServiceProfile = {
                    ...blockMocks.serviceProfile,
                    profile: { ...blockMocks.testProfile, tokenValue: "tokenValue", host: "service" },
                };
                testSpy.mockResolvedValue(newServiceProfile);
                jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
                const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                delete testSession.ISession.user;
                delete testSession.ISession.password;
                testSession.ISession.hostname = "service";
                testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";
                testSession.ISession.storeCookie = false;

                expect(loginSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
                expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(tempBaseProfile, blockMocks.updProfile, false);
                quickPickMock.mockRestore();
            });
            it("should login using the service profile given a simple profile name", async () => {
                const tempBaseProfile = JSON.parse(JSON.stringify(blockMocks.baseProfile));
                tempBaseProfile.profile.tokenType = "some-dummy-token-type";
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(tempBaseProfile);
                const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                const newServiceProfile = {
                    ...blockMocks.serviceProfile,
                    profile: { ...blockMocks.testProfile, tokenValue: "tokenValue", host: "service" },
                };
                testSpy.mockResolvedValue(newServiceProfile);
                jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
                const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                delete testSession.ISession.user;
                delete testSession.ISession.password;
                testSession.ISession.hostname = "service";
                testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";
                testSession.ISession.tokenType = tempBaseProfile.profile.tokenType;
                testSession.ISession.storeCookie = false;

                expect(loginSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
                expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(
                    newServiceProfile,
                    {
                        tokenType: tempBaseProfile.profile.tokenType,
                        tokenValue: "tokenValue",
                    },
                    true
                );
                quickPickMock.mockRestore();
            });
            it("should login using the parent profile given a nested profile name", async () => {
                const tempBaseProfile = JSON.parse(JSON.stringify(blockMocks.baseProfile));
                tempBaseProfile.name = "lpar";
                tempBaseProfile.profile.tokenType = "some-dummy-token-type";
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(tempBaseProfile);
                const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                const newServiceProfile = {
                    ...blockMocks.serviceProfile,
                    name: "lpar.service",
                    profile: { ...blockMocks.testProfile, tokenValue: "tokenValue", host: "dummy" },
                };
                testSpy.mockResolvedValue(newServiceProfile);
                jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
                const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");
                blockMocks.configLayer.properties.profiles = {
                    lpar: {
                        profiles: {
                            service: {
                                type: "service",
                                properties: [],
                            },
                        },
                        properties: [],
                    },
                };

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.profilesCache.refresh({
                    registeredApiTypes: jest.fn().mockReturnValue(["service"]),
                } as unknown as Types.IApiRegisterClient);
                await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "lpar.service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                delete testSession.ISession.user;
                delete testSession.ISession.password;
                testSession.ISession.hostname = "dummy";
                testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";
                testSession.ISession.tokenType = tempBaseProfile.profile.tokenType;
                testSession.ISession.storeCookie = false;

                expect(loginSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "lpar.service");
                expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(
                    {
                        ...tempBaseProfile,
                        type: null,
                        profile: {
                            ...blockMocks.serviceProfile.profile,
                            tokenType: tempBaseProfile.profile.tokenType,
                        },
                    },
                    {
                        tokenType: tempBaseProfile.profile.tokenType,
                        tokenValue: "tokenValue",
                    },
                    false
                );
                quickPickMock.mockRestore();
            });
            it("should logout using the service profile given a simple profile name", async () => {
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
                const updateBaseProfileFileLogoutSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogout");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                const newServiceProfile = {
                    ...blockMocks.serviceProfile,
                    profile: { ...blockMocks.testProfile, ...blockMocks.updProfile, host: "service" },
                };
                testSpy.mockResolvedValue(newServiceProfile);
                const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogout({ serviceProfile: "service" });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                testSession.ISession.hostname = "service";
                testSession.ISession.tokenValue = "tokenValue";
                delete testSession.ISession.base64EncodedAuth;
                delete testSession.ISession.user;
                delete testSession.ISession.password;

                expect(logoutSpy).toHaveBeenCalledWith(testSession);
                expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
                expect(updateBaseProfileFileLogoutSpy).toHaveBeenCalledWith(newServiceProfile);
                quickPickMock.mockRestore();
            });
            it("should login using the base profile when provided with a node, register, and cache instance", async () => {
                jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
                const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
                const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
                jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
                const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("tokenValue");

                const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
                await ZoweVsCodeExtension.ssoLogin({
                    serviceProfile: blockMocks.serviceProfile,
                    defaultTokenType: "apimlAuthenticationToken",
                    profileNode: blockMocks.testNode,
                    zeRegister: blockMocks.testRegister,
                    zeProfiles: blockMocks.testCache,
                });

                const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
                testSession.ISession.base64EncodedAuth = "dXNlcjpwYXNz";

                expect(loginSpy).not.toHaveBeenCalled();
                expect(testSpy).not.toHaveBeenCalled();
                expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(blockMocks.baseProfile, blockMocks.updProfile, false);
                expect(blockMocks.testNode.setProfileToChoice).toHaveBeenCalled();
                quickPickMock.mockRestore();
            });
        });

        it("should logout using the base profile when provided with a node, register, and cache instance", async () => {
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
            const updateBaseProfileFileLogoutSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogout");
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockImplementation(jest.fn());
            const newServiceProfile = { ...blockMocks.serviceProfile, profile: { ...blockMocks.testProfile, ...blockMocks.updProfile } };

            await ZoweVsCodeExtension.ssoLogout({
                serviceProfile: newServiceProfile,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
            });

            const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
            testSession.ISession.tokenValue = "tokenValue";
            delete testSession.ISession.base64EncodedAuth;
            delete testSession.ISession.user;
            delete testSession.ISession.password;

            expect(logoutSpy).not.toHaveBeenCalled();
            expect(testSpy).not.toHaveBeenCalled();
            expect(updateBaseProfileFileLogoutSpy).toHaveBeenCalledWith(blockMocks.baseProfile);
        });

        it("calls promptCertificate if 'Certificate' was selected in quick pick", async () => {
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
            const updateBaseProfileFileLoginSpy = jest.spyOn(blockMocks.testCache, "updateBaseProfileFileLogin");
            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "getServiceProfileForAuthPurposes");
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            let sessionCopy;
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockImplementation((session: imperative.Session) => {
                sessionCopy = Object.assign(Object.create(Object.getPrototypeOf(session)), session);
                return Promise.resolve("tokenValue");
            });

            // case 1: User selects "user/password" for login quick pick
            const promptCertMock = jest.spyOn(ZoweVsCodeExtension as any, "promptCertificate").mockImplementation();
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[1]);
            await ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" });

            const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
            delete testSession.ISession.user;
            delete testSession.ISession.password;
            delete testSession.ISession.base64EncodedAuth;
            testSession.ISession.storeCookie = false;

            expect(sessionCopy.ISession.type).toBe(imperative.SessConstants.AUTH_TYPE_CERT_PEM);
            expect(testSpy).toHaveBeenCalledWith(blockMocks.testCache, "service");
            expect(loginSpy).toHaveBeenCalledWith(sessionCopy);
            expect(promptCertMock).toHaveBeenCalled();
            expect(quickPickMock).toHaveBeenCalled();
            expect(updateBaseProfileFileLoginSpy).toHaveBeenCalledWith(blockMocks.baseProfile, blockMocks.updProfile, false);
            promptCertMock.mockRestore();
        });

        it("returns false if there's an error from promptCertificate", async () => {
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);

            // case 1: User selects "user/password" for login quick pick
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[1]);

            const promptCertMock = jest
                .spyOn(ZoweVsCodeExtension as any, "promptCertificate")
                .mockRejectedValueOnce(new Error("invalid certificate"));
            await expect(ZoweVsCodeExtension.ssoLogin({ serviceProfile: "service" })).resolves.toBe(false);
            expect(promptCertMock).toHaveBeenCalled();
            expect(quickPickMock).toHaveBeenCalled();
        });

        it("should not login if the user cancels the operation when selecting the authentication method", async () => {
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(blockMocks.baseProfile);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation(() => undefined as any);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: blockMocks.serviceProfile,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
            });

            expect(didLogin).toBeFalsy();
            quickPickMock.mockRestore();
        });

        it("should prefer base profile token type even if the user does not provide credentials to login with", async () => {
            const serviceProfileLoaded = { ...blockMocks.serviceProfile, profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" } };
            const baseProfileLoaded = { ...blockMocks.baseProfile, profile: { ...blockMocks.baseProfile.profile, tokenType: "BASE" } };
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(baseProfileLoaded);

            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(undefined);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
                preferBaseToken: true, // force to use base profile to login
            });

            const testSession = new imperative.Session(JSON.parse(JSON.stringify(blockMocks.expectedSession.ISession)));
            testSession.ISession.base64EncodedAuth = "VXNlcm5hbWU6UGFzc3dvcmQ=";
            delete testSession.ISession.user;
            delete testSession.ISession.password;
            expect(testSpy).toHaveBeenCalledWith({
                rePrompt: true,
                session: { ...testSession.ISession, tokenType: "BASE" },
            });
            expect(didLogin).toBeFalsy();
            quickPickMock.mockRestore();
        });

        it("should update the cache when autoStore is false after a successful login operation", async () => {
            const serviceProfileLoaded = { ...blockMocks.serviceProfile, profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" } };
            const baseProfileLoaded = { ...blockMocks.baseProfile, profile: { ...blockMocks.baseProfile.profile, tokenType: "BASE" } };
            jest.spyOn(blockMocks.testCache, "fetchBaseProfile").mockResolvedValue(baseProfileLoaded);
            blockMocks.configLayer.properties.autoStore = false;

            jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["user", "pass"]);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
            });

            const expectedProfile = {
                ...serviceProfileLoaded,
                profile: { ...blockMocks.testProfile, tokenType: "SERVICE", tokenValue: "tokenValue" },
            };
            expect(didLogin).toBeTruthy();
            expect(blockMocks.testCache.allProfiles).toEqual([expectedProfile, blockMocks.baseProfile]);
            quickPickMock.mockRestore();
        });

        it("should prefer base profile when it exists and has tokenType defined", async () => {
            const serviceProfileLoaded = { ...blockMocks.serviceProfile, profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" } };
            const baseProfileLoaded = { ...blockMocks.baseProfile, profile: { ...blockMocks.baseProfile.profile, tokenType: "BASE" } };
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile");
            blockMocks.configLayer.properties.profiles.service.properties.tokenType = "SERVICE";
            blockMocks.configLayer.properties.profiles.base.properties.tokenType = "BASE";
            blockMocks.configLayer.properties.defaults.base = "base";

            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["abc", "def"]);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
                preferBaseToken: true, // force to use base profile to login
            });

            expect(testSpy).toHaveBeenCalled();
            expect(didLogin).toBe(true);
            await expect(fetchBaseProfileSpy.mock.results[0].value).resolves.toEqual(baseProfileLoaded);
            quickPickMock.mockRestore();
        });

        it("should prefer base profile when it exists, does not have tokenType defined, and service profile is flat", async () => {
            const serviceProfileLoaded = { ...blockMocks.serviceProfile, profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" } };
            const baseProfileLoaded = { ...blockMocks.baseProfile, profile: { ...blockMocks.baseProfile.profile } };
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile");
            blockMocks.configLayer.properties.profiles.service.properties.tokenType = "SERVICE";
            blockMocks.configLayer.properties.profiles.base.properties.tokenType = undefined;
            blockMocks.configLayer.properties.defaults.base = "base";

            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["abc", "def"]);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
                preferBaseToken: true, // force to use base profile to login
            });

            expect(testSpy).toHaveBeenCalled();
            expect(didLogin).toBe(true);
            await expect(fetchBaseProfileSpy.mock.results[0].value).resolves.toEqual(baseProfileLoaded);
            quickPickMock.mockRestore();
        });

        it("should prefer parent profile when base profile does not exist and service profile is nested", async () => {
            const serviceProfileLoaded = {
                ...blockMocks.serviceProfile,
                name: "lpar.service",
                profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" },
            };
            const baseProfileLoaded = { ...blockMocks.baseProfile, name: "lpar", profile: {} };
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile");
            blockMocks.configLayer.properties.profiles = {
                lpar: {
                    profiles: {
                        service: {
                            type: "service",
                            properties: [],
                        },
                    },
                    properties: [],
                },
            };

            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass").mockResolvedValue(["abc", "def"]);
            const quickPickMock = jest.spyOn(Gui, "showQuickPick").mockImplementation((items) => items[0]);
            await ZoweVsCodeExtension.profilesCache.refresh({
                registeredApiTypes: jest.fn().mockReturnValue(["service"]),
            } as unknown as Types.IApiRegisterClient);
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
                preferBaseToken: true, // force to use base profile to login
            });

            expect(testSpy).toHaveBeenCalled();
            expect(didLogin).toBe(true);
            await expect(fetchBaseProfileSpy.mock.results[0].value).resolves.toEqual(baseProfileLoaded);
            quickPickMock.mockRestore();
        });

        it("should cancel the operation if the base profile does not exist and service profile is flat", async () => {
            const serviceProfileLoaded = { ...blockMocks.serviceProfile, profile: { ...blockMocks.serviceProfile.profile, tokenType: "SERVICE" } };
            const fetchBaseProfileSpy = jest.spyOn(blockMocks.testCache, "fetchBaseProfile");
            delete blockMocks.configLayer.properties.profiles.base;

            const testSpy = jest.spyOn(ZoweVsCodeExtension as any, "promptUserPass");
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage");
            const didLogin = await ZoweVsCodeExtension.ssoLogin({
                serviceProfile: serviceProfileLoaded,
                defaultTokenType: "apimlAuthenticationToken",
                profileNode: blockMocks.testNode,
                zeRegister: blockMocks.testRegister,
                zeProfiles: blockMocks.testCache,
                preferBaseToken: true, // force to use base profile to login
            });

            expect(testSpy).not.toHaveBeenCalled();
            expect(errorMessageSpy).toHaveBeenCalledWith(expect.stringContaining("No base profile found"));
            expect(didLogin).toBe(false);
            await expect(fetchBaseProfileSpy.mock.results[0].value).resolves.toBeUndefined();
        });
    });
    describe("updateCredentials", () => {
        const promptCredsOptions: PromptCredentialsOptions.ComplexOptions = {
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
                updateCachedProfile: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: imperative.IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as Types.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(0);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should update user and password as secure fields with rePrompt", async () => {
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
                updateCachedProfile: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: imperative.IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                {
                    ...promptCredsOptions,
                    rePrompt: true,
                },
                undefined as unknown as Types.IApiRegisterClient
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
                updateCachedProfile: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("yes");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: imperative.IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as Types.IApiRegisterClient
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
                updateCachedProfile: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce(undefined);
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: imperative.IProfileLoaded = await ZoweVsCodeExtension.updateCredentials(
                promptCredsOptions,
                undefined as unknown as Types.IApiRegisterClient
            );
            expect(profileLoaded.profile?.user).toBe("fakeUser");
            expect(profileLoaded.profile?.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if user input is cancelled", async () => {
            const fakeProfile = { user: "fakeUser", password: "fakePass" };
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: fakeProfile,
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials(
                { ...promptCredsOptions, rePrompt: true },
                undefined as unknown as Types.IApiRegisterClient
            );
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
            expect(fakeProfile.user).toBeDefined();
            expect(fakeProfile.password).toBeDefined();
        });

        it("should do nothing if password input is cancelled", async () => {
            const fakeProfile = { user: "fakeUser", password: "fakePass" };
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: fakeProfile,
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials(
                { ...promptCredsOptions, rePrompt: true },
                undefined as unknown as Types.IApiRegisterClient
            );
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
            expect(fakeProfile.user).toBeDefined();
            expect(fakeProfile.password).toBeDefined();
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
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials({}, undefined as unknown as Types.IApiRegisterClient);
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
            const profileLoaded = await ZoweVsCodeExtension.updateCredentials({}, undefined as unknown as Types.IApiRegisterClient);
            expect(profileLoaded).toBeUndefined();
            expect(getLoadedProfConfigSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).not.toHaveBeenCalled();
        });
    });

    describe("promptCertificate", () => {
        it("should set up options related to certificates", async () => {
            const options: PromptCredentialsOptions.CertificateOptions = {
                session: {
                    cert: undefined,
                    certKey: undefined,
                },
                openDialogOptions: {},
                profile: {
                    profile: {
                        cert: "/test/cert/path",
                        certKey: "/test/key/path",
                    },
                } as any,
            };

            jest.spyOn(vscode.commands, "executeCommand").mockResolvedValue({
                cert: options.profile?.profile?.cert,
                certKey: options.profile?.profile?.certKey,
            });

            await (ZoweVsCodeExtension as any).promptCertificate(options);
            expect(options.session.cert).toEqual("/test/cert/path");
            expect(options.session.certKey).toEqual("/test/key/path");
        });
    });
});
