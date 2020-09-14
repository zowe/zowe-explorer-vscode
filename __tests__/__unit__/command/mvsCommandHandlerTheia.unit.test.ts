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

jest.mock("Session");

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as profileLoader from "../../../src/Profiles";
import { Session, Logger } from "@zowe/imperative";
import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import * as globals from "../../../src/globals";
import * as utils from "../../../src/utils";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { createValidIProfile, createIProfile } from "../../../__mocks__/mockCreators/shared";

async function createGlobalMocks() {
    const globalMocks = {
        defaultProfileManagerInstance: null,
        defaultProfile: null,
        mockGetCommonApi: jest.fn(),
        commonApi: null,
        showErrorMessage: jest.fn(),
        showInputBox: jest.fn(),
        showInformationMessage: jest.fn(),
        showQuickPick: jest.fn(),
        IssueCommand: jest.fn(),
        mockGetValidSession: jest.fn(),
        getConfiguration: jest.fn(),
        createOutputChannel: jest.fn(),
        appendLine: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        withProgress: jest.fn(),
        mvsActions: null,
        qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
        testProfile: createIProfile(),
        session: new Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        }),
        outputChannel: {
            append: jest.fn(),
            name: "fakeChannel",
            appendLine: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        },
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        submitResponse: {
            success: true,
            commandResponse: "d iplinfo.."
        },
    };

    Object.defineProperty(vscode.window, "showErrorMessage", {value: globalMocks.showErrorMessage});
    Object.defineProperty(vscode.window, "showInputBox", {value: globalMocks.showInputBox});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: globalMocks.showInformationMessage});
    Object.defineProperty(vscode.window, "showQuickPick", {value: globalMocks.showQuickPick});
    Object.defineProperty(vscode.workspace, "getConfiguration", {value: globalMocks.getConfiguration});
    Object.defineProperty(vscode.window, "createOutputChannel", {value: globalMocks.createOutputChannel});
    Object.defineProperty(zowe, "IssueCommand", {value: globalMocks.IssueCommand});
    Object.defineProperty(vscode, "ProgressLocation", {value: globalMocks.ProgressLocation});
    Object.defineProperty(vscode.window, "withProgress", {value: globalMocks.withProgress});

    // Mocking Default Profile Manager
    globalMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    await profileLoader.Profiles.createInstance(Logger.getAppLogger());
    globalMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
    Object.defineProperty(DefaultProfileManager,
                          "getInstance",
                          { value: jest.fn(() => globalMocks.defaultProfileManagerInstance), configurable: true });
    Object.defineProperty(globalMocks.defaultProfileManagerInstance,
                          "getDefaultProfile",
                          { value: jest.fn(() => globalMocks.defaultProfile), configurable: true });

    // Common API mocks
    globalMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(globalMocks.testProfile);
    globalMocks.mockGetCommonApi.mockReturnValue(globalMocks.commonApi);
    Object.defineProperty(globalMocks.commonApi, "getValidSession", { value: jest.fn(() => globalMocks.session), configurable: true });
    ZoweExplorerApiRegister.getCommonApi = globalMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);

    globalMocks.createOutputChannel.mockReturnValue(globalMocks.outputChannel);
    globalMocks.withProgress.mockReturnValue(globalMocks.submitResponse);
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => undefined,
        update: jest.fn(()=>{
            return {};
        })
    });
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"}
            };
        })
    });

    globalMocks.mvsActions = MvsCommandHandler.getInstance();

    return globalMocks;
}

describe("mvsCommandActions unit testing", () => {
    it("tests the issueMvsCommand function - theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const originalTheia = globals.ISTHEIA;
        const profilesForValidation = {status: "active", name: "fake"};
        Object.defineProperty(globals, "ISTHEIA", { get: () => true });
        // First run enters a command directly
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", type: "zosmf", profile: {user:"firstName", password: "12345"}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    zosmfProfile: globalMocks.mockLoadNamedProfile,
                    getValidSession: globalMocks.mockGetValidSession,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    validProfile: profileLoader.ValidProfileEnum.VALID
                };
            })
        });

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo1");
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(1);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.showInputBox.mock.calls.length).toBe(1);
        expect(globalMocks.outputChannel.appendLine.mock.calls.length).toBe(2);
        expect(globalMocks.outputChannel.appendLine.mock.calls[0][0]).toBe("> d iplinfo1");
        expect(globalMocks.outputChannel.appendLine.mock.calls[1][0]).toBe(globalMocks.submitResponse.commandResponse);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(0);

        globalMocks.showQuickPick.mockReset();
        globalMocks.showInputBox.mockReset();
        globalMocks.withProgress.mockReset();
        globalMocks.outputChannel.appendLine.mockReset();

        // Second run selects previously added run
        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showQuickPick.mockReturnValueOnce({label: "d iplinfo2"});
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(2);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.outputChannel.appendLine.mock.calls[0][0]).toBe("> d iplinfo2");
        expect(globalMocks.withProgress.mock.calls.length).toBe(1);

        globalMocks.showQuickPick.mockReset();
        globalMocks.showInputBox.mockReset();
        globalMocks.withProgress.mockReset();
        globalMocks.outputChannel.appendLine.mockReset();

        // Third run selects an alternative value
        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showQuickPick.mockReturnValueOnce(new utils.FilterItem("/d m=cpu"));
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(2);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.withProgress.mock.calls.length).toBe(1);

        globalMocks.showQuickPick.mockReset();
        globalMocks.showInputBox.mockReset();
        globalMocks.withProgress.mockReset();
        globalMocks.showInformationMessage.mockReset();
        globalMocks.outputChannel.appendLine.mockReset();

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showQuickPick.mockReturnValueOnce(undefined);
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toEqual("No selection made.");

        globalMocks.showQuickPick.mockReset();
        globalMocks.showInputBox.mockReset();
        globalMocks.withProgress.mockReset();

        Object.defineProperty(globals, "ISTHEIA", { get: () => originalTheia });
    });
});
