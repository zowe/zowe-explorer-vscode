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
});
