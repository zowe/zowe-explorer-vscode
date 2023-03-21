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
import { KeytarCredentialManager } from "../../../src/security/KeytarCredentialManager";

describe("KeytarApi", () => {
    const isCredsSecuredSpy = jest.spyOn(ProfilesCache.prototype, "isCredentialsSecured");
    const getSecurityModulesSpy = jest.spyOn(KeytarCredentialManager, "getSecurityModules");
    const credMgrInitializeSpy = jest.spyOn(imperative.CredentialManagerFactory, "initialize");

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should initialize Imperative credential manager", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(true);
        (getSecurityModulesSpy as any).mockReturnValueOnce(true);
        credMgrInitializeSpy.mockResolvedValueOnce();
        await new KeytarApi(undefined as any).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(getSecurityModulesSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).toBeCalledTimes(1);
    });

    it("should do nothing if secure credential plugin is not active", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(false);
        await new KeytarApi(undefined as any).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(getSecurityModulesSpy).not.toBeCalled();
        expect(credMgrInitializeSpy).not.toBeCalled();
    });

    it("should do nothing if API has already been initialized", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(true);
        (getSecurityModulesSpy as any).mockReturnValueOnce(true);
        await new KeytarApi(undefined as any).activateKeytar(true, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(getSecurityModulesSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).not.toBeCalled();
    });

    it("should do nothing if Keytar module is missing", async () => {
        isCredsSecuredSpy.mockReturnValueOnce(true);
        (getSecurityModulesSpy as any).mockReturnValueOnce(false);
        await new KeytarApi(undefined as any).activateKeytar(false, false);
        expect(isCredsSecuredSpy).toBeCalledTimes(1);
        expect(getSecurityModulesSpy).toBeCalledTimes(1);
        expect(credMgrInitializeSpy).not.toBeCalled();
    });
});
