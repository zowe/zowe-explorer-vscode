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
jest.mock("@zowe/imperative");

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as profileLoader from "../../../src/Profiles";
import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import * as utils from "../../../src/utils";
import { Session, Logger } from "@zowe/imperative";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";

async function createGlobalMocks() {
    const globalMocks = {
        defaultProfileManagerInstance: null,
        profileInstance: null,
        defaultProfile: null,
        mockGetCommonApi: jest.fn(),
        commonApi: null,
        showErrorMessage: jest.fn(),
        showInputBox: jest.fn(),
        showInformationMessage: jest.fn(),
        showQuickPick: jest.fn(),
        createQuickPick: jest.fn(),
        IssueCommand: jest.fn(),
        mockGetValidSession: jest.fn(),
        getConfiguration: jest.fn(),
        createOutputChannel: jest.fn(),
        issueSimple: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        testNode: null,
        mvsActions: null,
        qpItem: new utils.FilterDescriptor("\uFF0B " + "Create a new filter"),
        qpItem2: new utils.FilterItem("/d iplinfo0"),
        testProfile: createIProfile(),
        profileOne: {
            name: "aProfile",
            profile: {},
            type: "zosmf",
            message: "",
            failNotFound: false
        },
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
        withProgress: jest.fn().mockImplementation((progLocation, callback) => {
            return {
                success: true,
                commandResponse: callback()
            };
        }),
        submitResponse: {
            success: true,
            commandResponse: "d iplinfo.."
        },
    };

    Object.defineProperty(vscode.window, "showErrorMessage", {value: globalMocks.showErrorMessage, configurable: true});
    Object.defineProperty(vscode.window, "showInputBox", {value: globalMocks.showInputBox, configurable: true});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: globalMocks.showInformationMessage, configurable: true});
    Object.defineProperty(vscode.window, "showQuickPick", {value: globalMocks.showQuickPick, configurable: true});
    Object.defineProperty(vscode.window, "createQuickPick", {value: globalMocks.createQuickPick, configurable: true});
    Object.defineProperty(vscode.workspace, "getConfiguration", {value: globalMocks.getConfiguration, configurable: true});
    Object.defineProperty(zowe, "IssueCommand", {value: globalMocks.IssueCommand, configurable: true});
    Object.defineProperty(globalMocks.IssueCommand, "issueSimple", {value: globalMocks.issueSimple, configurable: true});
    Object.defineProperty(vscode.window, "createOutputChannel", {value: globalMocks.createOutputChannel, configurable: true});
    Object.defineProperty(vscode, "ProgressLocation", {value: globalMocks.ProgressLocation, configurable: true});
    Object.defineProperty(vscode.window, "withProgress", {value: globalMocks.withProgress, configurable: true});

    // Mocking Default Profile Manager
    globalMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    globalMocks.profileInstance = await profileLoader.Profiles.createInstance(Logger.getAppLogger());
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

    globalMocks.testNode = new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, null,
                                               globalMocks.session, undefined, undefined, globalMocks.profileOne);

    globalMocks.mockGetValidSession.mockResolvedValue(globalMocks.session);
    globalMocks.createOutputChannel.mockReturnValue(globalMocks.outputChannel);
    globalMocks.mockLoadNamedProfile.mockReturnValue({profile: {name:"aProfile", type:"zosmf"}});
    globalMocks.createQuickPick.mockReturnValue({
        placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
        activeItems: [globalMocks.qpItem2],
        ignoreFocusOut: true,
        items: [globalMocks.qpItem, globalMocks.qpItem2],
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
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => ["test"],
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
    const profilesForValidation = {status: "active", name: "fake"};

    it("tests the issueMvsCommand function", async () => {
        const globalMocks = await createGlobalMocks();
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
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo1");
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );
        globalMocks.issueSimple.mockReturnValueOnce("iplinfo1");

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(1);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.showInputBox.mock.calls.length).toBe(1);
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls.length).toBe(2);
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls[0][0]).toBe("> d iplinfo1");
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls[1][0]).toBe("iplinfo1");
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(0);

        globalMocks.outputChannel.appendLine.mockReset();
    });

    it("tests the issueMvsCommand function user selects a history item", async () => {
        const globalMocks = await createGlobalMocks();

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
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("d iplinfo0");
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem2)
        );
        globalMocks.issueSimple.mockReturnValueOnce("iplinfo0");

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(1);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.showInputBox.mock.calls.length).toBe(1);
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls.length).toBe(2);
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls[0][0]).toBe("> d iplinfo0");
        expect(globalMocks.mvsActions.outputChannel.appendLine.mock.calls[1][0]).toBe("iplinfo0");
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function - issueSimple throws an error", async () => {
        const globalMocks = await createGlobalMocks();

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
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo3");
        globalMocks.withProgress.mockRejectedValueOnce(Error("fake testError"));
        globalMocks.issueSimple.mockRejectedValueOnce(Error("fake testError"));
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
        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user escapes the quick pick box", async () => {
        const globalMocks = await createGlobalMocks();

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
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(undefined)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(1);
        expect(globalMocks.showInputBox.mock.calls.length).toBe(0);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command"
        });
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toEqual("No selection made.");
    });

    it("tests the issueMvsCommand function user escapes the command box", async () => {
        const globalMocks = await createGlobalMocks();

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
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce(undefined);
        globalMocks.issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
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
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toEqual("No command entered.");
    });

    it("tests the issueMvsCommand function user starts typing a value in quick pick", async () => {
        const globalMocks = await createGlobalMocks();

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
            }),
            configurable: true});

        globalMocks.createQuickPick.mockReturnValueOnce({
            placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
            activeItems: [globalMocks.qpItem2],
            ignoreFocusOut: true,
            items: [globalMocks.qpItem, globalMocks.qpItem2],
            value: "/d m=cpu",
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

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce(undefined);
        globalMocks.issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
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
    });

    it("tests the issueMvsCommand function no profiles error", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [],
                    defaultProfile: undefined,
                    getValidSession: globalMocks.mockGetValidSession,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    validProfile: profileLoader.ValidProfileEnum.VALID,
                };
            }),
            configurable: true});

        await globalMocks.mvsActions.issueMvsCommand();
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("tests the issueMvsCommand prompt credentials", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", type: "zosmf", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    validProfile: profileLoader.ValidProfileEnum.VALID,
                    getValidSession: globalMocks.mockGetValidSession,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("fake");
        globalMocks.showInputBox.mockReturnValueOnce("fake");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo");
        globalMocks.issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
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
    });

    it("tests the issueMvsCommand prompt credentials for password only", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", type: "zosmf", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    validProfile: profileLoader.ValidProfileEnum.VALID,
                    getValidSession: globalMocks.mockGetValidSession,
                    promptCredentials: jest.fn(()=> {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("fake");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo5");
        globalMocks.issueSimple.mockReturnValueOnce({commandResponse: "fake response"});
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
    });

    it("tests the issueMvsCommand error in prompt credentials", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    validateProfiles: jest.fn(),
                    getValidSession: globalMocks.mockGetValidSession,
                    checkCurrentProfile: jest.fn(()=> {
                        return profileLoader.ValidProfileEnum.INVALID;
                    }),
                };
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");
        globalMocks.showInputBox.mockReturnValueOnce("fake");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo");

        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(globalMocks.qpItem)
        );

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user does not select a profile", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", type: "zosmf", profile: {user:"firstName", password: "12345"}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    validProfile: profileLoader.ValidProfileEnum.VALID,
                    getValidSession: globalMocks.mockGetValidSession,
                    checkCurrentProfile: jest.fn(),
                    zosmfProfile: globalMocks.mockLoadNamedProfile
                };
            }),
            configurable: true});

        globalMocks.showQuickPick.mockReturnValueOnce(undefined);

        await globalMocks.mvsActions.issueMvsCommand();

        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("tests the issueMvsCommand function from a session", async () => {
        const globalMocks = await createGlobalMocks();

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", type: "zosmf", profile: {user:"firstName", password: "12345"}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    validProfile: profileLoader.ValidProfileEnum.VALID,
                    getValidSession: globalMocks.mockGetValidSession,
                    checkCurrentProfile: jest.fn().mockReturnValue({
                        status: "active",
                        name: "firstName"
                    }),
                    zosmfProfile: globalMocks.mockLoadNamedProfile
                };
            }),
            configurable: true});

        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo1");
        globalMocks.issueSimple.mockReturnValueOnce({commandResponse: "fake response"});

        await globalMocks.mvsActions.issueMvsCommand(globalMocks.session, null, globalMocks.testNode);

        expect(globalMocks.showInputBox.mock.calls.length).toBe(1);
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(0);
    });
});
