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

jest.mock("Session");

import * as vscode from "vscode";
import { Gui, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import * as profileLoader from "../../../src/Profiles";
import { UnixCommandHandler } from "../../../src/command/UnixCommandHandler";
import * as utils from "../../../src/utils/ProfilesUtils";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import * as globals from "../../../src/globals";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";
import * as shared from "../../../__mocks__/mockCreators/shared";

describe("UnixCommand Actions Unit Testing", () => {
    function createGlobalMocks() {
        const newMocks = {
            showQuickPick: jest.fn(),
            showInputBox: jest.fn(),
            showInformationMessage: jest.fn(),
            appendLine: jest.fn(),
            createQuickPick: jest.fn(),
            showErrorMessage: jest.fn(),
            createOutputChannel: jest.fn(),
            mockLoadNamedProfile: jest.fn(),
            mockdefaultProfile: jest.fn(),
            getConfiguration: jest.fn(),
            getProfileInfomock: jest.fn(),
            fetchSshProfiles: jest.fn(),
            ProgressLocation: jest.fn(),
            withProgress: jest.fn(),
            session: shared.createISession(),
            profileOne: shared.createIProfile(),
            apiRegisterInstance: ZoweExplorerApiRegister.getInstance(),
            unixActions: UnixCommandHandler.getInstance(),
            profilesForValidation: { status: "active", name: "fake" },
            testNode: null as any,
            outputChannel: null as any,
            qpItem: null as any,
            qpItem2: null as any,
            profInstance: null as any,
        };

        newMocks.testNode = new ZoweDatasetNode(
            "BRTVS99.DDIR",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            newMocks.session,
            undefined,
            undefined,
            newMocks.profileOne
        );
        newMocks.outputChannel = {
            append: jest.fn(),
            name: "fakeChannel",
            appendLine: newMocks.appendLine,
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            replace: jest.fn(),
        } as unknown as vscode.OutputChannel;
        newMocks.createOutputChannel.mockReturnValue(newMocks.outputChannel);
        newMocks.qpItem = new utils.FilterDescriptor("Create a new filter");
        newMocks.qpItem2 = new utils.FilterItem({ text: "/d iplinfo0" });
        newMocks.ProgressLocation = jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        });

        newMocks.withProgress = jest.fn().mockImplementation((progLocation, callback) => {
            return {
                success: true,
                commandResponse: callback(),
            };
        });
        newMocks.createQuickPick.mockReturnValue({
            placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
            activeItems: [newMocks.qpItem2],
            ignoreFocusOut: true,
            items: [newMocks.qpItem, newMocks.qpItem2],
            value: undefined,
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
        newMocks.mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
        newMocks.mockdefaultProfile.mockReturnValue({ profile: { name: "bprofile", type: "ssh" } });

        newMocks.getConfiguration.mockReturnValue({
            get: (setting: string) => undefined,
            update: jest.fn(() => {
                return {};
            }),
        });
        SshSession.createSshSessCfgFromArgs = jest.fn(() => {
            return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined };
        });
        newMocks.getProfileInfomock.mockReturnValue({
            usingTeamConfig: true,
            getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
            mergeArgsForProfile: jest.fn().mockReturnValue({
                knownArgs: [
                    { argName: "port", argValue: "TEST", secure: false },
                    { argName: "host", secure: true },
                ],
                missingArgs: [
                    { argName: "user", argValue: undefined },
                    { argName: "password", secure: true },
                ],
            }),
            loadSecureArg: jest.fn().mockReturnValue("fake"),
        } as any);
        newMocks.fetchSshProfiles.mockReturnValue([
            {
                name: "ssh",
                type: "ssh",
                profile: {
                    host: "host.com",
                    port: 123,
                },
                message: "",
                failNotFound: false,
            } as imperative.IProfileLoaded,
        ]);
        newMocks.profInstance = jest.fn().mockResolvedValue({
            allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
            defaultProfile: { name: "firstName" },
            zosmfProfile: newMocks.mockLoadNamedProfile,
            checkCurrentProfile: jest.fn(() => {
                return newMocks.profilesForValidation;
            }),
            validateProfiles: jest.fn(),
            getBaseProfile: jest.fn(),
            getDefaultProfile: newMocks.mockdefaultProfile,
            validProfile: ValidProfileEnum.VALID,
            getProfileInfo: newMocks.getProfileInfomock,
            fetchAllProfilesByType: newMocks.fetchSshProfiles,
            promptCredentials: ["entered"],
        });

        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: newMocks.profInstance,
            configurable: true,
        });
        Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(profileLoader.Profiles, "createInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                };
            }),
        });
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["firstName", "secondName"]),
            configurable: true,
        });
        Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode, "ProgressLocation", { value: newMocks.ProgressLocation });
        Object.defineProperty(vscode.window, "withProgress", { value: newMocks.withProgress });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.showErrorMessage });
        Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.showQuickPick });
        Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.showInputBox });
        Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.showInformationMessage });
        Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.createQuickPick });
        Object.defineProperty(vscode.window, "createOutputChannel", { value: newMocks.createOutputChannel });
        Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.getConfiguration });
        Object.defineProperty(imperative.ProfileInfo, "profAttrsToProfLoaded", { value: () => ({ name: "test1", profile: {} }) });
        Object.defineProperty(imperative.ConnectionPropsForSessCfg, "addPropsOrPrompt", {
            value: jest.fn(() => {
                return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined, type: "basic", port: 22 };
            }),
        });
        Object.defineProperty(ZoweLocalStorage, "storage", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });

        return newMocks;
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("test the issueUnixCommand function", async () => {
        const globalMocks = createGlobalMocks();
        const mockUssApi = await globalMocks.apiRegisterInstance.getUssApi(globalMocks.profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        globalMocks.apiRegisterInstance.getUssApi = getUssApiMock.bind(globalMocks.apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(globalMocks.session);

        globalMocks.showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await globalMocks.apiRegisterInstance.getCommandApi(globalMocks.profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        globalMocks.apiRegisterInstance.getCommandApi = getCommandApiMock.bind(globalMocks.apiRegisterInstance);

        globalMocks.showInputBox.mockReturnValueOnce("fake");
        globalMocks.showInputBox.mockReturnValueOnce("fakepw");
        globalMocks.showInputBox.mockReturnValueOnce("/u/directorypath");
        globalMocks.showInputBox.mockReturnValueOnce("/d iplinfo1");

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(globalMocks.qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo1" as any);

        await globalMocks.unixActions.issueUnixCommand();

        expect(globalMocks.showQuickPick.mock.calls.length).toBe(1);
        expect(globalMocks.showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(globalMocks.showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(globalMocks.showInputBox.mock.calls.length).toBe(4);
        expect(globalMocks.appendLine.mock.calls.length).toBe(2);
        expect(globalMocks.appendLine.mock.calls[0][0]).toBe("> fake @ test1 : /u/directorypath d iplinfo1");
        expect(globalMocks.appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo1");
        expect(globalMocks.showInformationMessage.mock.calls.length).toBe(0);
    });

    // it("tests the issueUnixCommand function user selects a history item", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
    //     const getUssApiMock = jest.fn();
    //     getUssApiMock.mockReturnValue(mockUssApi);
    //     apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
    //     jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

    //     showQuickPick.mockReturnValueOnce("firstName");

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("/u/directorypath");

    //     jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem2));
    //     jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo0" as any);

    //     await unixActions.issueUnixCommand();

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the Unix command",
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(3);
    //     expect(appendLine.mock.calls.length).toBe(2);
    //     expect(appendLine.mock.calls[0][0]).toBe("> fake @ test1 : /u/directorypath d iplinfo0");
    //     expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo0");
    //     expect(showInformationMessage.mock.calls.length).toBe(0);
    // });

    // it("tests the issueUnixCommand function - issueUnixCommand throws an error", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("/u/directorypath");
    //     showInputBox.mockReturnValueOnce("/d iplinfo3");
    //     withProgress.mockRejectedValueOnce(Error("fake testError"));

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
    //     jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo3" as any);

    //     await unixActions.issueUnixCommand();

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the Unix command",
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(4);
    //     expect(showErrorMessage.mock.calls.length).toBe(1);
    //     expect(showErrorMessage.mock.calls[0][0]).toEqual("Error: fake testError");
    // });

    // it("tests the issueUnixCommand function user escapes the quick pick box", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("/u/directorypath");

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(undefined));

    //     await unixActions.issueUnixCommand();

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the Unix command",
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(3);
    //     expect(showInformationMessage.mock.calls.length).toBe(1);
    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("No selection made. Operation cancelled.");
    // });

    // it("If nothing is entered in the inputbox of path", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });
    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("");
    //     showInputBox.mockReturnValue("/d iplinfo0");

    //     await unixActions.issueUnixCommand();

    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("Redirecting to Home Directory");
    // });

    // it("User escapes the inputBox of path being entered", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });
    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce(undefined);

    //     await unixActions.issueUnixCommand();

    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation cancelled.");
    // });

    // it("tests the issueUnixCommand function user escapes the commandbox", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 getDefaultProfile: mockdefaultProfile,
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("/directorypath");
    //     showInputBox.mockReturnValueOnce(undefined);

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

    //     await unixActions.issueUnixCommand();

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the Unix command",
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(4);
    //     expect(showInformationMessage.mock.calls.length).toBe(1);
    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("No command entered.");
    // });

    // it("tests the issueUnixCommand function user starts typing a value in quick pick", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getDefaultProfile: mockdefaultProfile,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });
    //     createQuickPick.mockReturnValueOnce({
    //         placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
    //         activeItems: [qpItem2],
    //         ignoreFocusOut: true,
    //         items: [qpItem, qpItem2],
    //         value: "/d m=cpu",
    //         show: jest.fn(() => {
    //             return {};
    //         }),
    //         hide: jest.fn(() => {
    //             return {};
    //         }),
    //         onDidAccept: jest.fn(() => {
    //             return {};
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");
    //     showInputBox.mockReturnValueOnce("fakepw");
    //     showInputBox.mockReturnValueOnce("/u/directorypath");
    //     showInputBox.mockReturnValueOnce(undefined);

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

    //     await unixActions.issueUnixCommand();

    //     expect(showQuickPick.mock.calls.length).toBe(1);
    //     expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
    //     expect(showQuickPick.mock.calls[0][1]).toEqual({
    //         canPickMany: false,
    //         ignoreFocusOut: true,
    //         placeHolder: "Select the Profile to use to submit the Unix command",
    //     });
    //     expect(showInputBox.mock.calls.length).toBe(3);
    // });

    // it("tests the issueUnixCommand error in prompt credentials", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return ValidProfileEnum.INVALID;
    //                 }),
    //                 validProfile: ValidProfileEnum.INVALID,
    //                 getDefaultProfile: mockdefaultProfile,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce("firstName");
    //     showInputBox.mockReturnValueOnce("fake");

    //     await unixActions.issueUnixCommand();

    //     expect(showInformationMessage.mock.calls.length).toBe(2);
    // });

    // it("tests the issueUnixCommand function user does not select a profile", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getBaseProfile: jest.fn(),
    //                 checkCurrentProfile: jest.fn(),
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 fetchAllProfilesByType: fetchSshProfiles,
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     showQuickPick.mockReturnValueOnce(undefined);

    //     await unixActions.issueUnixCommand();

    //     expect(showInformationMessage.mock.calls.length).toBe(1);
    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    // });

    // it("tests the issueUnixCommand function no profiles error", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [],
    //                 defaultProfile: undefined,
    //                 checkCurrentProfile: jest.fn(() => {
    //                     return profilesForValidation;
    //                 }),
    //                 validateProfiles: jest.fn(),
    //                 getBaseProfile: jest.fn(),
    //                 validProfile: ValidProfileEnum.VALID,
    //                 fetchAllProfilesByType: jest.fn(),
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });
    //     Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
    //         value: jest.fn().mockReturnValue([]),
    //         configurable: true,
    //     });
    //     await unixActions.issueUnixCommand();
    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    // });

    // it("tests the issueUnixCommand function from a session", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
    //                 defaultProfile: { name: "firstName" },
    //                 validProfile: ValidProfileEnum.VALID,
    //                 getBaseProfile: jest.fn(),
    //                 checkCurrentProfile: jest.fn(),
    //                 zosmfProfile: mockLoadNamedProfile,
    //                 getDefaultProfile: mockdefaultProfile,
    //                 getProfileInfo: getProfileInfomock,
    //                 fetchAllProfilesByType: jest.fn(),
    //                 promptCredentials: jest.fn(),
    //             };
    //         }),
    //     });

    //     jest.spyOn(unixActions, "checkCurrentProfile").mockReturnValue(undefined);

    //     const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
    //     const getCommandApiMock = jest.fn();
    //     getCommandApiMock.mockReturnValue(mockCommandApi);
    //     apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

    //     showInputBox.mockReturnValueOnce("/d iplinfo1");
    //     jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValueOnce("iplinfo1" as any);

    //     await unixActions.issueUnixCommand(session, null as any, testNode);

    //     expect(showInformationMessage.mock.calls.length).toBe(0);
    // });

    // it("ssh profile not found", async () => {
    //     Object.defineProperty(profileLoader.Profiles, "getInstance", {
    //         value: jest.fn(() => {
    //             return {
    //                 fetchAllProfilesByType: jest.fn().mockReturnValue([]),
    //             };
    //         }),
    //     });
    //     await unixActions.setsshSession();
    //     expect(showErrorMessage.mock.calls.length).toBe(1);
    //     expect(showErrorMessage.mock.calls[0][0]).toEqual("No SSH profile found. Please create an SSH profile.");
    // });

    // it("tests the selectSshProfile function", async () => {
    //     showQuickPick.mockReturnValueOnce("test1" as any);
    //     await expect(
    //         (unixActions as any).selectSshProfile([
    //             {
    //                 name: "test1",
    //             },
    //             {
    //                 name: "test2",
    //             },
    //         ])
    //     ).resolves.toEqual({
    //         name: "test1",
    //     });
    // });

    // it("tests the selectSshProfile function when user escapes", async () => {
    //     showQuickPick.mockReturnValueOnce(undefined);
    //     await expect(
    //         (unixActions as any).selectSshProfile([
    //             {
    //                 name: "test1",
    //             },
    //             {
    //                 name: "test2",
    //             },
    //         ])
    //     ).resolves.toBe(undefined);
    //     expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    // });
});
