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
    describe("promptForSsoLogin", () => {
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

        it("should update a session and a profile in the provided node", () => {
            const session = createISession();
            const sessionNode = createDatasetSessionNode(undefined as any, serviceProfile);
            const getSessionMock = jest.fn().mockReturnValue(session);
            const sessionForProfile = (_profile) =>
                ({
                    getSession: getSessionMock,
                } as any);
            AuthUtils.syncSessionNode(sessionForProfile, sessionNode);
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
            AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
            expect(getSessionMock).toHaveBeenCalled();
            expect(sessionNode.dirty).toBe(true);
            // await the promise since its result is discarded in the called function
            await getChildrenSpy;
            expect(getChildrenSpy).toHaveBeenCalled();
            expect(refreshElementMock).toHaveBeenCalledWith(sessionNode);
        });
        it("should do nothing if there is no profile for the provided node", () => {
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
            AuthUtils.syncSessionNode(dummyFn, sessionNode);
            expect(sessionNode.getSession()).toEqual(initialSession);
            expect(sessionNode.getProfile()).toEqual(initialProfile);
        });
    });
});
