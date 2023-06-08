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

import * as globals from "../../src/globals";
import { ZoweLogger } from "../../src/utils/LoggerUtils";
import * as SettingsConfig from "../../src/utils/SettingsConfig";

describe("Globals Unit Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    it("should set global security value to false when using Theia", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: true,
            configurable: true,
        });
        jest.spyOn(SettingsConfig.SettingsConfig, "isConfigSettingSetByUser").mockReturnValue(false);
        jest.spyOn(SettingsConfig.SettingsConfig, "getDirectValue").mockReturnValue(false);
        const setDirectValueSpy = jest.spyOn(SettingsConfig.SettingsConfig, "setDirectValue").mockImplementation();
        await expect(globals.setGlobalSecurityValue()).resolves.not.toThrow();
        expect(setDirectValueSpy).toBeCalledTimes(1);
        expect(globals.PROFILE_SECURITY).toBe(false);
    });

    it("should set global security value to default if the secure credential setting is enabled", async () => {
        Object.defineProperty(globals, "ISTHEIA", {
            value: false,
            configurable: true,
        });
        jest.spyOn(SettingsConfig.SettingsConfig, "isConfigSettingSetByUser").mockReturnValue(false);
        jest.spyOn(SettingsConfig.SettingsConfig, "getDirectValue").mockReturnValue(true);
        const loggerInfoSpy = jest.spyOn(ZoweLogger, "info");
        await expect(globals.setGlobalSecurityValue()).resolves.not.toThrow();
        expect(globals.PROFILE_SECURITY).toBe(globals.ZOWE_CLI_SCM);
        expect(loggerInfoSpy).toBeCalledTimes(1);
    });
});
