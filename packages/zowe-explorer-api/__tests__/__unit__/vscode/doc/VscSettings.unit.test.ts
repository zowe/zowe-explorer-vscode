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
import { VscSettings } from "../../../../src/vscode/doc/VscSettings";

function createGlobalMocks() {
    const globalMocks = {
        vscConfSpy: jest.spyOn(vscode.workspace, "getConfiguration"),
        getConfiguration: jest.fn(),
        testProxyVars: {
            http_proxy: "host.com",
            https_proxy: "host.com",
            no_proxy: ["fake.com"],
            proxy_authorization: null,
            proxy_strict_ssl: true,
        },
    };
    globalMocks.getConfiguration = jest.fn().mockReturnValue({
        get: jest.fn(),
    });
    globalMocks.vscConfSpy.mockImplementation(globalMocks.getConfiguration);

    return globalMocks;
}

describe("VscSettings", () => {
    describe("getVsCodeProxySettings", () => {
        beforeEach(() => {
            jest.resetAllMocks();
        });
        it("should return undefined with VSC proxy support off", () => {
            const globalMocks = createGlobalMocks();
            globalMocks.getConfiguration().get.mockReturnValueOnce("off");
            const response = VscSettings.getVsCodeProxySettings();
            expect(response).not.toBeDefined();
        });
        it("should return undefined with VSC proxy support off", () => {
            const globalMocks = createGlobalMocks();
            globalMocks.getConfiguration().get.mockReturnValueOnce("on");
            globalMocks.getConfiguration().get.mockReturnValueOnce("host.com");
            globalMocks.getConfiguration().get.mockReturnValueOnce(["fake.com"]);
            globalMocks.getConfiguration().get.mockReturnValueOnce(true);
            globalMocks.getConfiguration().get.mockReturnValueOnce(null);
            const response = VscSettings.getVsCodeProxySettings();
            expect(response).toEqual(globalMocks.testProxyVars);
        });
    });
});
