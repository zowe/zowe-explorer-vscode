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

import * as globals from "../../src/globals";
import { SettingsConfig } from "../../src/utils/SettingsConfig";

describe("Globals Unit Test - Function setGlobalSecurityValue", () => {
    it("should set the global secure value to 'off' if Theia is in use", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: true,
            configurable: false,
        });
        const spySetDirectValue = jest.spyOn(SettingsConfig, "setDirectValue");
        await globals.setGlobalSecurityValue();
        expect(globals.PROFILE_SECURITY).toEqual(false);
        expect(spySetDirectValue).toHaveBeenCalledTimes(1);
    });

    it("should set global security value to '@zowe/cli' if using keytar", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: false,
            configurable: false,
        });
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementationOnce(() => {
            return "keytar";
        });
        await globals.setGlobalSecurityValue();
        expect(globals.PROFILE_SECURITY).toEqual(globals.ZOWE_CLI_SCM);
    });

    it("should set global security value to type of 'ICredentialManager' if using kubernetes", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: false,
            configurable: false,
        });
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementationOnce(() => {
            return "kubernetes";
        });
        await globals.setGlobalSecurityValue();
        expect(globals.PROFILE_SECURITY).toEqual({
            plugin: globals.ZOWE_CLI_SCM,
            type: "k8s",
        });
    });

    it("should set global security value to 'false' if disabling secure credentials (off)", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: false,
            configurable: false,
        });
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementationOnce(() => {
            return "off";
        });
        await globals.setGlobalSecurityValue();
        expect(globals.PROFILE_SECURITY).toEqual(false);
    });

    it("should set global security value to '@zowe/cli' by default to use keytar if credential manager is not defined", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: false,
            configurable: false,
        });
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementationOnce(() => {
            return null;
        });
        await globals.setGlobalSecurityValue();
        expect(globals.PROFILE_SECURITY).toEqual("@zowe/cli");
    });
});
