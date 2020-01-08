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

import * as vscode from "vscode";
import * as brightside from "@brightside/core";
import * as profileLoader from "../../../src/Profiles";
import * as tsoActions from "../../../src/tso/tsoCommandActions";
import * as utils from "../../../src/utils";

describe("tsoCommandActions unit testing", () => {
    const showErrorMessage = jest.fn();
    const showInputBox = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const createQuickPick = jest.fn();
    const issueSimple = jest.fn();
    const getConfiguration = jest.fn();
    const IssueCommand = jest.fn();

    const outputChannel: vscode.OutputChannel = {
        append: jest.fn(),
        name: "fakeChannel",
        appendLine: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
    };

    const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

    issueSimple.mockReturnValue({commandResponse: "fake response"});

    const mockLoadNamedProfile = jest.fn();
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"}
            };
        })
    });

    createQuickPick.mockReturnValue({
        placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
        activeItems: [qpItem],
        ignoreFocusOut: true,
        items: [qpItem],
        value: undefined,
        show: jest.fn(()=>{
            return {};
        }),
        hide: jest.fn(()=>{
            return {};
        }),
        onDidAccept: jest.fn(()=>{
            return {};
        })
    });

    getConfiguration.mockReturnValue({
        get: (setting: string) => undefined,
        update: jest.fn(()=>{
            return {};
        })
    });

    // await extension.addZoweSession(testTree);
    // expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");


    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "createQuickPick", {value: createQuickPick});
    Object.defineProperty(vscode.workspace, "getConfiguration", {value: getConfiguration});
    Object.defineProperty(brightside, "IssueCommand", {value: IssueCommand});
    Object.defineProperty(IssueCommand, "issueSimple", {value: issueSimple});

    beforeEach(() => {
        mockLoadNamedProfile.mockReturnValue({profile: {name:"aProfile", type:"zosmf"}});
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("tests the issueTsoCommand function", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:"firstName", password: "12345"}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    zosmfProfile: mockLoadNamedProfile
                };
            })
        });

        showQuickPick.mockReset();
        showInputBox.mockReset();

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/d iplinfo");
        issueSimple.mockReturnValueOnce({commandResponse: "fake response"});

        await tsoActions.issueTsoCommand(outputChannel);

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    // it("tests the issueTsoCommand function 2", async () => {
    //     showQuickPick.mockReset();
    //     showInputBox.mockReset();
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [],
    //                 defaultProfile: undefined,
    //             };
    //         })
    //     });
    //     await tsoActions.issueTsoCommand(outputChannel);
    //     expect(expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available"));
    // });

    // it("tests the issueTsoCommand error function", async () => {
    //     showQuickPick.mockReset();
    //     showInputBox.mockReset();

    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:"firstName", password: "12345"}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 zosmfProfile: mockLoadNamedProfile
    //             };
    //         })
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("/d iplinfo");
    //     issueSimple.mockReturnValueOnce({commandResponse: "fake response"});

    //     await tsoActions.issueTsoCommand(undefined);

    //     expect(showErrorMessage.mock.calls.length).toBe(1);
    // });

    // it("tests the issueTsoCommand prompt credentials", async () => {
    //     showQuickPick.mockReset();
    //     showInputBox.mockReset();

    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 promptCredentials: jest.fn(()=> {
    //                     return ["fake", "fake", "fake"];
    //                 }),
    //             };
    //         })
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("/d iplinfo");
    //     issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
    //     showQuickPick.mockReturnValueOnce("\uFF0B" + "Create a new Command");

    //     await tsoActions.issueTsoCommand(outputChannel);

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the command"
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(1);
    // });

    // it("tests the issueTsoCommand prompt credentials for password only", async () => {
    //     showQuickPick.mockReset();
    //     showInputBox.mockReset();

    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //                 promptCredentials: jest.fn(()=> {
    //                     return ["fake", "fake", "fake"];
    //                 }),
    //             };
    //         })
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("/d iplinfo");
    //     issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
    //     showQuickPick.mockReturnValueOnce("\uFF0B" + "Create a new Command");

    //     await tsoActions.issueTsoCommand(outputChannel);

    //     expect(showQuickPick.mock.calls.length).toBe(2);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the command"
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(1);
    // });

    // it("tests the issueTsoCommand error in prompt credentials", async () => {
    //     showQuickPick.mockReset();
    //     showInputBox.mockReset();

    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
    //                 defaultProfile: {name: "firstName"},
    //             };
    //         })
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("/d iplinfo");
    //     issueSimple.mockReturnValueOnce({commandResponse: "fake response"});

    //     await tsoActions.issueTsoCommand(outputChannel);

    //     expect(showErrorMessage.mock.calls.length).toBe(1);
    // });
});
