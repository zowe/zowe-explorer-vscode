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

import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as sharedMock from "../../../__mocks__/mockCreators/shared";
import * as dsMock from "../../../__mocks__/mockCreators/datasets";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

jest.mock("fs");
jest.mock("vscode");
jest.mock("@zowe/cli");

describe("ProfileManagement unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    function createGlobalMocks() {
        const newMocks = {
            mockSession: sharedMock.createISession(),
            mockBasicAuthProfile: sharedMock.createValidIProfile(),
            mockDsSessionNode: ZoweDatasetNode,
            mockUpdateChosen: null as any,
            mockAddBasicChosen: null as any,
            mockLoginChosen: null as any,
            mockLogoutChosen: null as any,
            mockEditProfChosen: null as any,
            mockCreateQp: jest.fn(),
            debugLogSpy: null as any,
        };
        newMocks.mockDsSessionNode = dsMock.createDatasetSessionNode(newMocks.mockSession, newMocks.mockBasicAuthProfile) as any;
        Object.defineProperty(newMocks.mockDsSessionNode, "getProfile", {
            value: jest.fn().mockReturnValue(newMocks.mockBasicAuthProfile),
            configurable: true,
        });
        newMocks.mockUpdateChosen = ProfileManagement.basicAuthUpdateQpItems[ProfileManagement.AuthQpLabels.update];
        newMocks.mockAddBasicChosen = ProfileManagement.basicAuthAddQpItems[ProfileManagement.AuthQpLabels.add];
        newMocks.mockLoginChosen = ProfileManagement.tokenAuthLoginQpItem[ProfileManagement.AuthQpLabels.login];
        newMocks.mockLogoutChosen = ProfileManagement.tokenAuthLogoutQpItem[ProfileManagement.AuthQpLabels.logout];
        newMocks.mockEditProfChosen = ProfileManagement.otherProfileQpItems[ProfileManagement.AuthQpLabels.edit];
        newMocks.mockCreateQp.mockReturnValue({
            show: jest.fn(() => {
                return {};
            }),
            hide: jest.fn(() => {
                return {};
            }),
            onDidAccept: jest.fn(() => {
                return {};
            }),
        });
        Object.defineProperty(profUtils.ProfilesUtils, "promptCredentials", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "createQuickPick", { value: newMocks.mockCreateQp, configurable: true });
        Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
        newMocks.debugLogSpy = jest.spyOn(ZoweLogger, "debug");
        // Object.defineProperty(profUtils.ProfilesUtils, "isUsingTokenAuth", { value: jest.fn().mockResolvedValueOnce(false), configurable: true });

        return newMocks;
    }
    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });
    it("profile using basic authentication should see Operation Cancelled when escaping quick pick", async () => {
        const globalMocks = createGlobalMocks();
        const logMsg = `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`;
        Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn().mockResolvedValueOnce(undefined), configurable: true });
        const updateSpy = jest.spyOn(profUtils.ProfilesUtils, "promptCredentials");
        const opCancelledSpy = jest.spyOn(Gui, "infoMessage");
        await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
        expect(globalMocks.debugLogSpy).toBeCalledWith(logMsg);
        expect(updateSpy).not.toBeCalled();
        expect(opCancelledSpy).toBeCalledWith("Operation Cancelled");
        globalMocks.debugLogSpy.mockClear();
        updateSpy.mockClear();
        opCancelledSpy.mockClear();
    });
    it("profile using basic authentication should see promptCredentials called when Update Credentials chosen", async () => {
        const globalMocks = createGlobalMocks();
        const logMsg = `Profile ${globalMocks.mockBasicAuthProfile.name} is using basic authentication.`;
        Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn().mockResolvedValueOnce(globalMocks.mockUpdateChosen), configurable: true });
        const scenarioSpy = jest.spyOn(profUtils.ProfilesUtils, "promptCredentials");
        await ProfileManagement.manageProfile(globalMocks.mockDsSessionNode as any);
        expect(globalMocks.debugLogSpy).toBeCalledWith(logMsg);
        expect(scenarioSpy).toBeCalled();
        globalMocks.debugLogSpy.mockClear();
        scenarioSpy.mockClear();
    });
});
