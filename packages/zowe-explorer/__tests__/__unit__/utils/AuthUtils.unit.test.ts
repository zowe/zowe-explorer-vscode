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

import { ErrorCorrelator, Gui, imperative, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { AuthUtils } from "../../../src/utils/AuthUtils";
import { Constants } from "../../../src/configuration/Constants";
import { MockedProperty } from "../../__mocks__/mockUtils";

describe("AuthUtils", () => {
    describe("promptForAuthError", () => {
        it("should prompt for authentication", async () => {
            const errorDetails = new imperative.ImperativeError({
                errorCode: 401 as unknown as string,
                msg: "All configured authentication methods failed",
            });
            const profile = { name: "aProfile", type: "zosmf" } as any;
            const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError");
            const correlatedError = ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.All, errorDetails, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            const promptForAuthenticationMock = jest
                .spyOn(AuthUtils, "promptForAuthentication")
                .mockImplementation(async () => Promise.resolve(true));
            AuthUtils.promptForAuthError(errorDetails, profile);
            expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.All, errorDetails, {
                templateArgs: {
                    profileName: profile.name,
                },
            });
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(errorDetails, profile, correlatedError);
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
});
