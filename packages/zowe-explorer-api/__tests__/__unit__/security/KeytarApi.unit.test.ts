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

import { imperative } from "@zowe/cli";
import { ProfilesCache } from "../../../src/profiles/ProfilesCache";
import { KeytarApi } from "../../../src/security/KeytarApi";

describe("KeytarApi", () => {
    const isCredsSecuredSpy = jest.spyOn(ProfilesCache.prototype, "isSecureCredentialPluginActive");
    const credMgrInitializeSpy = jest.spyOn(imperative.CredentialManagerFactory, "initialize");

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should initialize Imperative credential manager", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(true);
        credMgrInitializeSpy.mockResolvedValueOnce();
        await new KeytarApi(undefined as unknown as imperative.Logger).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).toBeCalledTimes(1);
    });

    it("should do nothing if secure credential plugin is not active", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(false);
        await new KeytarApi(undefined as unknown as imperative.Logger).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).not.toBeCalled();
    });

    it("should do nothing if API has already been initialized", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(true);
        await new KeytarApi(undefined as unknown as imperative.Logger).activateKeytar(true, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).not.toBeCalled();
    });

    it("should do nothing if Keytar module is missing", async () => {
        jest.mock("@zowe/secrets-for-zowe-sdk", () => {});
        isCredsSecuredSpy.mockReturnValueOnce(true);
        await new KeytarApi(undefined as unknown as imperative.Logger).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).not.toBeCalled();
    });
});
