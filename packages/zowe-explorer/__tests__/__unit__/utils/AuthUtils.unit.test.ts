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

import {
    AuthHandler,
    AuthCancelledError,
    DsEntry,
    DsEntryMetadata,
    ErrorCorrelator,
    FilterEntry,
    FsAbstractUtils,
    Gui,
    imperative,
    PdsEntry,
    ZoweExplorerApiType,
    ZoweVsCodeExtension,
    ZoweScheme,
} from "@zowe/zowe-explorer-api";
import { AuthUtils } from "../../../src/utils/AuthUtils";
import { Constants } from "../../../src/configuration/Constants";
import { MockedProperty } from "../../__mocks__/mockUtils";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { createDatasetSessionNode } from "../../__mocks__/mockCreators/datasets";
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";
import { MarkdownString, TreeItemCollapsibleState, Uri } from "vscode";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/configuration/Profiles";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";

jest.mock("../../../src/tools/ZoweLocalStorage");
const testProfile = createIProfile();
const testUris = {
    ps: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PS" }),
    pds: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS" }),
    pdsMember: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest/USER.DATA.PDS/MEMBER1" }),
    session: Uri.from({ scheme: ZoweScheme.DS, path: "/sestest" }),
};
const testEntries = {
    ps: {
        ...new DsEntry("USER.DATA.PS", false),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PS",
        }),
        etag: "OLDETAG",
        isMember: false,
    } as DsEntry,
    pds: {
        ...new PdsEntry("USER.DATA.PDS"),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PDS",
        }),
    } as PdsEntry,
    pdsMember: {
        ...new DsEntry("MEMBER1", true),
        metadata: new DsEntryMetadata({
            profile: testProfile,
            path: "/USER.DATA.PDS/MEMBER1",
        }),
        isMember: true,
    } as DsEntry,
    session: {
        ...new FilterEntry("sestest"),
        metadata: {
            profile: testProfile,
            path: "/",
        },
    },
};

describe("AuthUtils", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
            getCommonApi: () => ({
                getSession: () => createISession(),
            }),
        } as any);
        AuthHandler.enableSequentialRequests(testProfile);
    });

    describe("handleProfileAuthOnError", () => {
        const createImperativeAuthError = () =>
            new imperative.ImperativeError({
                errorCode: Number(401).toString(),
                msg: "All configured authentication methods failed",
            });

        it("delegates authentication handling to the shared auth flow", async () => {
            const imperativeError = createImperativeAuthError();
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn(),
                    promptCredentials: jest.fn(),
                    profileHasSecureToken: jest.fn().mockResolvedValue(false),
                } as any,
                configurable: true,
            });
            const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError");
            const enableSequentialRequestsMock = jest.spyOn(AuthHandler, "enableSequentialRequests");
            const getOrCreateAuthFlowMock = jest.spyOn(AuthHandler, "getOrCreateAuthFlow").mockResolvedValueOnce(undefined);
            jest.spyOn(AuthHandler, "sessTypeFromProfile").mockReturnValueOnce(imperative.SessConstants.AUTH_TYPE_BASIC);

            await AuthUtils.handleProfileAuthOnError(imperativeError, profile);

            expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.All, imperativeError, {
                templateArgs: { profileName: profile.name },
            });
            expect(getOrCreateAuthFlowMock).toHaveBeenCalledTimes(1);
            expect(getOrCreateAuthFlowMock).toHaveBeenCalledWith(
                profile,
                expect.objectContaining({
                    imperativeError,
                    isUsingTokenAuth: false,
                })
            );
            expect(enableSequentialRequestsMock).toHaveBeenCalledWith(profile);

            profilesCacheMock[Symbol.dispose]();
        });

        it("propagates AuthCancelledError thrown by the shared auth flow", async () => {
            const imperativeError = createImperativeAuthError();
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
                value: {
                    ssoLogin: jest.fn(),
                    promptCredentials: jest.fn(),
                    profileHasSecureToken: jest.fn().mockResolvedValue(false),
                } as any,
                configurable: true,
            });
            jest.spyOn(AuthHandler, "sessTypeFromProfile").mockReturnValueOnce(imperative.SessConstants.AUTH_TYPE_BASIC);
            const authError = new AuthCancelledError(profile.name);
            jest.spyOn(AuthHandler, "getOrCreateAuthFlow").mockRejectedValueOnce(authError);

            await expect(AuthUtils.handleProfileAuthOnError(imperativeError, profile)).rejects.toBe(authError);
            profilesCacheMock[Symbol.dispose]();
        });

        it("unlocks the profile when the error is not authentication-related", async () => {
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const unlockProfileMock = jest.spyOn(AuthHandler, "unlockProfile");
            jest.spyOn(AuthHandler, "isProfileLocked").mockReturnValueOnce(true);

            await AuthUtils.handleProfileAuthOnError(new Error("Some other error"), profile);

            expect(unlockProfileMock).toHaveBeenCalledWith(profile);
        });
    });

    describe("retryRequest", () => {
        let loadNamedProfileMock;
        let mockMvsApi;
        let promptForAuthErrorMock;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.restoreAllMocks();

            jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
                getCommonApi: () => ({
                    getSession: () => createISession(),
                }),
            } as any);

            // Setup common mocks
            loadNamedProfileMock = jest.fn().mockReturnValue(createIProfile());
            jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: loadNamedProfileMock,
            } as any);

            mockMvsApi = {
                dataSet: jest.fn(() => {
                    throw new imperative.ImperativeError({
                        msg: "All configured authentication methods failed",
                    });
                }),
            };

            promptForAuthErrorMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation();

            // Common spies setup
            jest.spyOn(DatasetFSProvider.instance as any, "lookup").mockReturnValue(testEntries.ps);

            jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({
                isRoot: false,
                slashAfterProfilePos: testUris.ps.path.indexOf("/", 1),
                profileName: "sestest",
                profile: testEntries.ps.metadata.profile,
            });
            AuthHandler.enableSequentialRequests(testEntries.ps.metadata.profile);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("processes requests sequentially when sequential mode is enabled", async () => {
            const profile = createIProfile();
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(0);
            const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValue(undefined);
            AuthHandler.enableSequentialRequests(profile);

            const order: string[] = [];
            let resolveFirst: (() => void) | undefined;

            const first = AuthUtils.retryRequest(profile, async () => {
                order.push("first-start");
                await new Promise<void>((resolve) => {
                    resolveFirst = resolve;
                });
                order.push("first-end");
            });

            const second = AuthUtils.retryRequest(profile, async () => {
                order.push("second");
            });

            await new Promise((resolve) => setImmediate(resolve));
            expect(order).toEqual(["first-start"]);

            resolveFirst?.();
            await Promise.all([first, second]);

            expect(order).toEqual(["first-start", "first-end", "second"]);
            expect(AuthHandler.areSequentialRequestsEnabled(profile)).toBe(false);
            AuthHandler.disableSequentialRequests(profile);

            waitForUnlockMock.mockRestore();
        });

        describe("successful authentication retry", () => {
            it("should return stat value when handleProfileAuthOnError receives correct credentials", async () => {
                const successfulMvsApi = {
                    dataSet: jest.fn(() => ({ success: true })),
                };

                // Mock sequence: fail twice, then succeed
                jest.spyOn(ZoweExplorerApiRegister, "getMvsApi")
                    .mockReturnValueOnce(mockMvsApi as any)
                    .mockReturnValueOnce(mockMvsApi as any)
                    .mockReturnValue(successfulMvsApi as any);

                // Act
                const runSequentialMock = jest.spyOn(AuthHandler, "runSequentialIfEnabled").mockImplementation((_profile, action) => action());
                try {
                    const statResult = await DatasetFSProvider.instance.stat(testUris.ps);
                    const fetchResult = await DatasetFSProvider.instance.fetchDatasetAtUri(testUris.ps);

                    // Assert
                    expect(statResult).toBeDefined();
                    expect(fetchResult).toBeDefined();
                    expect(promptForAuthErrorMock).toHaveBeenCalledTimes(2);
                } finally {
                    runSequentialMock.mockRestore();
                }
            });
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
                    getPropsForProfile: jest.fn().mockReturnValue([]),
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "basic" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "cert-pem" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "basic" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "cert-pem" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "none" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "basic" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "none" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "none" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "none" } } as any);
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
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "none" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValueOnce({ ISession: { type: "token" } } as any);
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

    describe("ensureAuthNotCancelled", () => {
        const profile = { name: "test-profile", type: "zosmf" } as any;
        let isProfileLockedMock: jest.SpyInstance;
        let wasAuthCancelledMock: jest.SpyInstance;
        let handleProfileAuthOnErrorMock: jest.SpyInstance;

        beforeEach(() => {
            isProfileLockedMock = jest.spyOn(AuthHandler, "isProfileLocked");
            wasAuthCancelledMock = jest.spyOn(AuthHandler, "wasAuthCancelled");
            handleProfileAuthOnErrorMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockResolvedValue(undefined);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should do nothing if profile is unlocked and auth was not cancelled", async () => {
            isProfileLockedMock.mockReturnValue(false);
            wasAuthCancelledMock.mockReturnValue(false);

            await AuthUtils.ensureAuthNotCancelled(profile);

            expect(handleProfileAuthOnErrorMock).not.toHaveBeenCalled();
        });

        it("should do nothing if profile is locked and auth was not cancelled", async () => {
            isProfileLockedMock.mockReturnValue(true);
            wasAuthCancelledMock.mockReturnValue(false);

            await AuthUtils.ensureAuthNotCancelled(profile);

            expect(handleProfileAuthOnErrorMock).not.toHaveBeenCalled();
        });

        it("should throw auth cancelled error if user just cancelled auth prompt", async () => {
            wasAuthCancelledMock.mockReturnValue(true);
            await expect(AuthUtils.ensureAuthNotCancelled(profile)).rejects.toThrow("User cancelled previous authentication");
        });
    });

    describe("updateNodeToolTip", () => {
        let mockProfile: imperative.IProfileLoaded;

        beforeEach(() => {
            mockProfile = {
                name: "testProfile",
                profile: {
                    user: "testUser",
                    password: "testPassword",
                },
                type: "zosmf",
                message: "",
                failNotFound: false,
            };
            jest.spyOn(AuthHandler, "getSessFromProfile").mockReturnValue({ ISession: { type: "basic" } } as any);
            jest.spyOn(ZoweLogger, "error").mockImplementation();
            jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should not throw when sessionNode has an undefined tooltip", () => {
            const mockSessionNode = new ZoweUSSNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.USS_SESSION_CONTEXT,
                parentNode: undefined,
                session: createISession(),
                profile: mockProfile,
            });
            mockSessionNode.fullPath = "/test/path";

            AuthUtils.updateNodeToolTip(mockSessionNode, mockProfile);
            expect(mockSessionNode.tooltip).toBeDefined();
            expect(typeof mockSessionNode.tooltip).toBe("string");
            expect(mockSessionNode.tooltip).toContain("Auth Method: Basic Authentication");
            expect(mockSessionNode.tooltip).toContain("User: testUser");
            expect(mockSessionNode.tooltip).toContain("Path: /test/path");
        });

        it("should not throw when sessionNode has a MarkdownString tooltip", () => {
            const mockMarkdownString = new MarkdownString("Existing tooltip content");
            const mockSessionNode = new ZoweUSSNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.USS_SESSION_CONTEXT,
                parentNode: undefined,
                session: createISession(),
                profile: mockProfile,
            });
            mockSessionNode.tooltip = mockMarkdownString;
            mockSessionNode.fullPath = "/test/path";

            AuthUtils.updateNodeToolTip(mockSessionNode, mockProfile);
            expect(mockSessionNode.tooltip).toBeDefined();
            expect(typeof mockSessionNode.tooltip).toBe("string");
            expect(mockSessionNode.tooltip).toContain("Existing tooltip content");
            expect(mockSessionNode.tooltip).toContain("Auth Method: Basic Authentication");
            expect(mockSessionNode.tooltip).toContain("User: testUser");
            expect(mockSessionNode.tooltip).toContain("Path: /test/path");
        });

        it("should not throw when sessionNode has a string tooltip", () => {
            const mockSessionNode = new ZoweUSSNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.USS_SESSION_CONTEXT,
                parentNode: undefined,
                session: createISession(),
                profile: mockProfile,
            });
            mockSessionNode.fullPath = "/test/path";
            mockSessionNode.tooltip = "Existing string tooltip";

            AuthUtils.updateNodeToolTip(mockSessionNode, mockProfile);
            expect(mockSessionNode.tooltip).toBeDefined();
            expect(typeof mockSessionNode.tooltip).toBe("string");
            expect(mockSessionNode.tooltip).toContain("Existing string tooltip");
            expect(mockSessionNode.tooltip).toContain("Auth Method: Basic Authentication");
            expect(mockSessionNode.tooltip).toContain("User: testUser");
            expect(mockSessionNode.tooltip).toContain("Path: /test/path");
        });
    });

    describe("errorHandling", () => {
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
        it("should properly format Imperative errors with additional details", async () => {
            const testError = new imperative.ImperativeError({
                msg: "Test error message",
                errorCode: "401",
                additionalDetails: "\nAuth order: token,basic\nAuth type: token\nAvailable creds: token,basic\n",
            });
            const promptForAuthenticationMock = jest.spyOn(AuthHandler, "promptForAuthentication").mockResolvedValue(true);
            const moreInfo = {
                profile: "testProfile",
                apiType: ZoweExplorerApiType.Mvs,
            };
            await expect(AuthUtils.errorHandling(testError, moreInfo)).resolves.toBe(true);
            expect(promptForAuthenticationMock.mock.calls[0][1]).toEqual(
                expect.objectContaining({
                    imperativeError: testError,
                })
            );
        });
    });
});
