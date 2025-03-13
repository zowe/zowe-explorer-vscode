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

import * as extension from "../../src/extension";
import * as vscode from "vscode";
import { AuthHandler, Gui } from "@zowe/zowe-explorer-api";
import { ZoweVsCodeExtension } from "../../__mocks__/@zowe/zowe-explorer-api";

describe("Extension Unit Tests - function registerFtpApis", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should register the ftp API's", () => {
        const registerUssApiMock = jest.fn();
        const registerJesApiMock = jest.fn();
        const registerMvsApiMock = jest.fn();

        jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
            registerUssApi: registerUssApiMock,
            registerJesApi: registerJesApiMock,
            registerMvsApi: registerMvsApiMock,
            getExplorerExtenderApi: () => ({
                initForZowe: jest.fn(),
                reloadProfiles: jest.fn(),
            }),
        });

        const enableLocksForTypeSpy = jest.spyOn(AuthHandler, "enableLocksForType");

        jest.spyOn(Gui, "showMessage").mockImplementation();
        expect(
            extension.activate({
                subscriptions: [],
                extensionPath: "./test",
            } as unknown as vscode.ExtensionContext)
        ).toEqual(undefined);
        expect(registerUssApiMock).toHaveBeenCalledTimes(1);
        expect(registerMvsApiMock).toHaveBeenCalledTimes(1);
        expect(registerJesApiMock).toHaveBeenCalledTimes(1);

        // Verify locks are enabled for FTP profile types
        expect(enableLocksForTypeSpy).toHaveBeenCalledTimes(1);
        expect(enableLocksForTypeSpy).toHaveBeenCalledWith("zftp");
    });

    it("should display error if zoweExplorerApi was not found", () => {
        jest.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue(null);
        const showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
        expect(
            extension.activate({
                subscriptions: [],
                extensionPath: "./test",
            } as unknown as vscode.ExtensionContext)
        ).toEqual(undefined);
        expect(showMessageSpy).toHaveBeenCalledTimes(1);
    });
});
