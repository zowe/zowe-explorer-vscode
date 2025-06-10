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

import { AuthHandler, ErrorCorrelator, Gui, imperative, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { AuthUtils } from "../../../src/utils/AuthUtils";
import { Constants } from "../../../src/configuration/Constants";
import { MockedProperty } from "../../__mocks__/mockUtils";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { createDatasetSessionNode } from "../../__mocks__/mockCreators/datasets";
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";

describe("AuthUtils", () => {
    describe("handleProfileAuthOnError", () => {
        it("should prompt for authentication", async () => {
            const imperativeError = new imperative.ImperativeError({
                errorCode: 401 as unknown as string,
                msg: "All configured authentication methods failed",
            });
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn().mockImplementation(),
                    promptCredentials: jest.fn().mockImplementation(),
                } as any,
                configurable: true,
            });
            const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError");
            const errorCorrelation = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, imperativeError, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            const isUsingTokenAuthMock = jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            const promptForAuthenticationMock = jest.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValueOnce(true);
            await AuthUtils.handleProfileAuthOnError(imperativeError, profile);
            expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.All, imperativeError, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            expect(promptForAuthenticationMock).toHaveBeenCalledTimes(1);
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(
                profile,
                expect.objectContaining({
                    imperativeError,
                    errorCorrelation,
                    isUsingTokenAuth: false,
                })
            );
            profilesCacheMock[Symbol.dispose]();
            isUsingTokenAuthMock.mockRestore();
        });
        it("should debounce duplicate/parallel auth prompts", async () => {
            const imperativeError = new imperative.ImperativeError({
                errorCode: 401 as unknown as string,
                msg: "All configured authentication methods failed",
            });
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn().mockImplementation(),
                    promptCredentials: jest.fn().mockImplementation(),
                } as any,
                configurable: true,
            });
            const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError");
            const errorCorrelation = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, imperativeError, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            const isUsingTokenAuthMock = jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            const promptForAuthenticationMock = jest.spyOn(AuthHandler, "promptForAuthentication").mockClear().mockResolvedValueOnce(true);
            const debugMock = jest.spyOn(ZoweLogger, "debug").mockClear().mockReturnValue(undefined);
            (AuthHandler as any).authPromptLocks.clear();
            await AuthUtils.handleProfileAuthOnError(imperativeError, profile);
            await AuthUtils.handleProfileAuthOnError(imperativeError, profile);
            expect(debugMock).toHaveBeenCalledTimes(1);
            expect(debugMock).toHaveBeenCalledWith("[AuthUtils] Skipping authentication prompt for profile aProfile due to debouncing");
            expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.All, imperativeError, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            expect(promptForAuthenticationMock).toHaveBeenCalledTimes(1);
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(
                profile,
                expect.objectContaining({
                    imperativeError,
                    errorCorrelation,
                    isUsingTokenAuth: false,
                })
            );
            profilesCacheMock[Symbol.dispose]();
            isUsingTokenAuthMock.mockRestore();
        });
    });

    describe("isUsingTokenAuth", () => {
        it("should return false if shouldRemoveTokenFromProfile() returns true", async () => {
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn().mockImplementation(),
                    promptCredentials: jest.fn().mockImplementation(),
                    getDefaultProfile: jest.fn().mockReturnValue("sestest"),
                    shouldRemoveTokenFromProfile: jest.fn().mockReturnValue(true),
                    loadNamedProfile: jest.fn(),
                } as any,
                configurable: true,
            });

            const usingTokenAuth = await AuthUtils.isUsingTokenAuth(profile.name);
            expect(usingTokenAuth).toBe(false);
            profilesCacheMock[Symbol.dispose]();
        });
        it("should return true if getPropsForProfile() returns tokenValue", async () => {
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn().mockImplementation(),
                    promptCredentials: jest.fn().mockImplementation(),
                    getDefaultProfile: jest.fn().mockReturnValue("sestest"),
                    shouldRemoveTokenFromProfile: jest.fn().mockReturnValue(false),
                    loadNamedProfile: jest.fn(),
                    getPropsForProfile: jest.fn().mockReturnValue(["tokenValue"]),
                } as any,
                configurable: true,
            });

            const usingTokenAuth = await AuthUtils.isUsingTokenAuth(profile.name);
            expect(usingTokenAuth).toBe(true);
            profilesCacheMock[Symbol.dispose]();
        });
    });
    describe("promptForSsoLogin", () => {
        it("should return false if SSO login fails", async () => {
            const ssoLogin = jest.fn().mockResolvedValueOnce(false);
            const profilesCacheMockedProp = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin,
                },
                configurable: true,
            });
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Log in to Authentication Service");
            expect(await AuthUtils.promptForSsoLogin("aProfileName")).toBe(false);
            expect(showMessageMock).toHaveBeenCalledWith(
                "Your connection is no longer active for profile 'aProfileName'. " +
                    "Please log in to an authentication service to restore the connection.",
                { items: ["Log in to Authentication Service"], vsCodeOpts: { modal: true } }
            );
            expect(ssoLogin).toHaveBeenCalledWith(null, "aProfileName");
            profilesCacheMockedProp[Symbol.dispose]();
        });

        it("should return true if SSO login was successful", async () => {
            const ssoLogin = jest.fn().mockResolvedValueOnce(true);
            const unlockProfile = jest.spyOn(AuthHandler, "unlockProfile").mockImplementation();
            const profilesCacheMockedProp = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin,
                },
                configurable: true,
            });
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Log in to Authentication Service");
            expect(await AuthUtils.promptForSsoLogin("aProfileName")).toBe(true);
            expect(showMessageMock).toHaveBeenCalledWith(
                "Your connection is no longer active for profile 'aProfileName'. " +
                    "Please log in to an authentication service to restore the connection.",
                { items: ["Log in to Authentication Service"], vsCodeOpts: { modal: true } }
            );
            expect(ssoLogin).toHaveBeenCalledWith(null, "aProfileName");
            expect(unlockProfile).toHaveBeenCalledWith("aProfileName");
            unlockProfile.mockRestore();
            profilesCacheMockedProp[Symbol.dispose]();
        });

        it("should unlock profile if SSO login was successful", async () => {
            const unlockProfile = jest.spyOn(AuthHandler, "unlockProfile").mockImplementation();
            const profilesCacheMockedProp = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn().mockResolvedValueOnce(true),
                },
                configurable: true,
            });
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Log in to Authentication Service");
            await AuthUtils.promptForSsoLogin("aProfileName");
            expect(showMessageMock).toHaveBeenCalledWith(
                "Your connection is no longer active for profile 'aProfileName'. " +
                    "Please log in to an authentication service to restore the connection.",
                { items: ["Log in to Authentication Service"], vsCodeOpts: { modal: true } }
            );
            expect(unlockProfile).toHaveBeenCalledWith("aProfileName");
            unlockProfile.mockRestore();
            profilesCacheMockedProp[Symbol.dispose]();
        });

        it("should call ProfilesCache.ssoLogin when 'Log In' option is selected", async () => {
            const ssoLogin = jest.fn();
            const profilesCacheMockedProp = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin,
                },
                configurable: true,
            });
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Log in to Authentication Service");
            await AuthUtils.promptForSsoLogin("aProfileName");
            expect(showMessageMock).toHaveBeenCalledWith(
                "Your connection is no longer active for profile 'aProfileName'. " +
                    "Please log in to an authentication service to restore the connection.",
                { items: ["Log in to Authentication Service"], vsCodeOpts: { modal: true } }
            );
            expect(ssoLogin).toHaveBeenCalledWith(null, "aProfileName");
            profilesCacheMockedProp[Symbol.dispose]();
        });
        it("should not call SSO login if prompt dismissed", async () => {
            const ssoLogin = jest.fn();
            const profilesCacheMockedProp = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin,
                },
                configurable: true,
            });
            const showMessageMock = jest.spyOn(Gui, "showMessage").mockResolvedValueOnce(undefined);
            await AuthUtils.promptForSsoLogin("aProfileName");
            expect(showMessageMock).toHaveBeenCalledWith(
                "Your connection is no longer active for profile 'aProfileName'. " +
                    "Please log in to an authentication service to restore the connection.",
                { items: ["Log in to Authentication Service"], vsCodeOpts: { modal: true } }
            );
            expect(ssoLogin).not.toHaveBeenCalledWith(null, "aProfileName");
            profilesCacheMockedProp[Symbol.dispose]();
        });
    });

    describe("syncSessionNode", () => {
        let profilesCacheMock: MockedProperty;
        const loadNamedProfileMock = jest.fn().mockReturnValue(createIProfile());
        beforeAll(() => {
            profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    loadNamedProfile: loadNamedProfileMock,
                    promptCredentials: jest.fn().mockImplementation(),
                } as any,
                configurable: true,
            });
        });

        afterAll(() => {
            profilesCacheMock[Symbol.dispose]();
        });

        const serviceProfile = {
            name: "sestest",
            profile: {},
            type: "zosmf",
            message: "",
            failNotFound: false,
        };

        it("should update a session and a profile in the provided node", async () => {
            const session = createISession();
            const sessionNode = createDatasetSessionNode(undefined as any, serviceProfile);
            const getSessionMock = jest.fn().mockReturnValue(session);
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode);
            expect(sessionNode.getSession()).toEqual(session);
            expect(sessionNode.getProfile()).toEqual(createIProfile());
        });

        it("should update session node and refresh tree node if provided", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(refreshElementMock).toHaveBeenCalledWith(sessionNode);
        });

        it("should do nothing if there is no profile for the provided node", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const initialSession = sessionNode.getSession();
            const initialProfile = sessionNode.getProfile();
            loadNamedProfileMock.mockClear().mockImplementation(() => {
                throw new Error(`There is no such profile with name: ${serviceProfile.name}`);
            });
            const dummyFn = (_profile) =>
                ({
                    getSession: () => new imperative.Session({}),
                } as any);
            await AuthUtils.syncSessionNode(dummyFn, sessionNode);
            expect(sessionNode.getSession()).toEqual(initialSession);
            expect(sessionNode.getProfile()).toEqual(initialProfile);
        });

        it("handles an error if getCommonAPI function fails", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());
            const errorLoggerSpy = jest.spyOn(ZoweLogger, "error");
            const errorText = "Failed to retrieve common API for profile";
            await AuthUtils.syncSessionNode(
                () => {
                    throw new Error(errorText);
                },
                sessionNode,
                sessionNode
            );
            expect(errorLoggerSpy).toHaveBeenCalledTimes(1);
            expect(errorLoggerSpy).toHaveBeenCalledWith(`Error syncing session for sestest: ${errorText}`);
        });

        it("To check for node tooltip when profile is using Token based authentication and when Auth Method is not initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for node tooltip when profile is using Basic authentication and when Auth Method is not initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);

            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: "testuser",
                    password: "testPassword",
                    rejectUnauthorize: false,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Basic Authentication");
        });

        it("To check for node tooltip when profile is using Certificate based authentication and when Auth Method is not initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);

            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: "/testDir/certFile.crt",
                    certKeyFile: "testDir/certKeyFile.crt",
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Certificate Authentication");
        });

        it("To check for node tooltip when profile is using Token based authentication and when Auth Method is initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Unknown`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for node tooltip when profile is using Basic authentication and when Auth Method is initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: "testuser",
                    password: "testPassword",
                    rejectUnauthorize: false,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Unknown`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Basic Authentication");
        });

        it("To check for node tooltip when profile is using Certificate authentication and when Auth Method is initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: "/testDir/certFile.crt",
                    certKeyFile: "testDir/certKeyFile.crt",
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Unknown`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Certificate Authentication");
        });

        it("To check for node tooltip when profile is not in any authentication and when Auth Method is initially present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: undefined,
                    certKeyFile: undefined,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Unknown`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Auth Method: Unknown");
        });

        it("To check for ZoweUSSNode tooltip ", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.fullPath = "/a/user/fileName";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain(`Path: ${sessionNode.fullPath}`);
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for ZoweJobNode tooltip containing search pattern", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Auth Method: Token Authentication\nJobId: JOB0001`;
            sessionNode.description = "Owner: * | Prefix: * | Status: *";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain(`${sessionNode.description}`);
            expect(sessionNode.tooltip).not.toContain("JobId: JOB0001");
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for ZoweJobNode tooltip containing jobID", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Auth Method: Token Authentication\nOwner: * | Prefix: * | Status: *`;
            sessionNode.description = "JobId: JOB0001";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain(`${sessionNode.description}`);
            expect(sessionNode.tooltip).not.toContain("Owner: * | Prefix: * | Status: *");
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for node tooltip when profile is using Basic authentication and User ID is present in the toolTip", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: "testuser",
                    password: "testPassword",
                    rejectUnauthorize: false,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Unknown\nUser: sampleUser`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain(testProfile.profile.user);
            expect(sessionNode.tooltip).toContain("Auth Method: Basic Authentication");
        });

        it("To check for ZoweDatasetNode tooltip when profile is not in any authentication", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: undefined,
                    certKeyFile: undefined,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Basic Authentication\nPattern: USER.*`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).not.toContain("Pattern: ");
            expect(sessionNode.tooltip).toContain("Auth Method: Unknown");
        });

        it("To check for ZoweUSSNode tooltip when profile is not in any authentication", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: undefined,
                    certKeyFile: undefined,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Basic Authentication\nPath: /a/user/fileName.txt`;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).not.toContain("Path: ");
            expect(sessionNode.tooltip).toContain("Auth Method: Unknown");
        });

        it("To check for ZoweJobNode tooltip when profile is not in any authentication and it is filtered based on a job search pattern", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: undefined,
                    certKeyFile: undefined,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Basic Authentication\nOwner: * | Prefix: * | Status: *\n `;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).not.toContain("Owner: * | Prefix: * | Status: *");
            expect(sessionNode.tooltip).toContain("Auth Method: Unknown");
        });

        it("To check for ZoweJobNode tooltip when profile is not in any authentication and it is filtered based on a Job ID", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            const testProfile = {
                name: "sestest",
                profile: {
                    host: "fake",
                    port: 999,
                    user: undefined,
                    password: undefined,
                    rejectUnauthorize: false,
                    certFile: undefined,
                    certKeyFile: undefined,
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            loadNamedProfileMock.mockClear().mockReturnValue(testProfile);
            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(false);
            sessionNode.tooltip = `Profile: ${sessionNode.label}\nAuth Method: Basic Authentication\nJobId: JOB0001\n `;
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).not.toContain("JobId: JOB0001");
            expect(sessionNode.tooltip).toContain("Auth Method: Unknown");
        });

        it("To check for node tooltip when profile is switched to Token based authentication from Basic authentication", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = "Auth Method: Basic Authentication\nUser: sampleUser";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).not.toContain("User: sampleUser");
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for ZoweUSSNode tooltip when path is updated", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Auth Method: Token Authentication\nPath: /a/user/fileNameOne`;
            sessionNode.fullPath = "/a/user/fileNameTwo";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain(`Path: /a/user/fileNameTwo`);
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for ZoweJobNode tooltip when job search pattern is updated", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Auth Method: Token Authentication\nOwner: * | Prefix: * | Status: *`;
            sessionNode.description = "Owner: * | Prefix: * | Status: ACTIVE";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("Owner: * | Prefix: * | Status: ACTIVE");
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });

        it("To check for ZoweJobNode tooltip when job id is updated", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), serviceProfile);
            const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
            const refreshElementMock = jest.fn();
            jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
                refreshElement: refreshElementMock,
            } as any);
            const getSessionMock = jest.fn().mockReturnValue(createISession());
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            loadNamedProfileMock.mockClear().mockReturnValue(createIProfile());

            jest.spyOn(AuthUtils, "isUsingTokenAuth").mockResolvedValueOnce(true);
            sessionNode.tooltip = `Auth Method: Token Authentication\nJobId: JOB0001`;
            sessionNode.description = "JobId: JOB0002";
            await AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(sessionNode.tooltip).toContain("JobId: JOB0002");
            expect(sessionNode.tooltip).toContain("Auth Method: Token-based Authentication");
        });
    });
});
